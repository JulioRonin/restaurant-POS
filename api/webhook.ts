import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Inicializar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // @ts-ignore (Stripe version can be safely ignored standard)
  apiVersion: '2023-10-16',
});

// Inicializamos Supabase usando SERVICE ROLE (Bypasses RLS limits)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Desactivar el Body Parser por defecto de Next/Vercel (Stripe necesita el Raw Body)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Función para recomponer el Raw Body de Node
const getRawBody = async (req: VercelRequest): Promise<Buffer> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let event: Stripe.Event;
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('Missing Stripe signature or Webhook Secret');
    return res.status(400).send('Webhook configuration error.');
  }

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`⚠️  Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Este ID lo inyectaremos en la App de React
    const businessId = session.client_reference_id;

    if (!businessId) {
      console.warn('⚠️ Se completo el checkout pero falta el client_reference_id');
      return res.status(200).json({ received: true, msg: 'Ignored missing businessId' });
    }

    try {
      // 1. Obtener caducidad actual
      const { data: businessInfo, error: fetchErr } = await supabase
        .from('businesses')
        .select('subscription_expiry')
        .eq('id', businessId)
        .single();
        
      if (fetchErr) throw fetchErr;

      const now = new Date();
      const currentExpiry = businessInfo.subscription_expiry ? new Date(businessInfo.subscription_expiry) : now;
      
      // Si ya estaba vencido, dar 30 días desde HOY. Si tenía días a favor, sumarles 30.
      const baseDate = currentExpiry > now ? currentExpiry : now;
      baseDate.setDate(baseDate.getDate() + 30);

      // 2. Actualizar negocio (Esto salta RLS porque usamos SERVICE ROLE)
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          subscription_expiry: baseDate.toISOString(),
          saas_status: 'ACTIVE'
        })
        .eq('id', businessId);

      if (updateError) throw updateError;

      // 3. Crear Registro de Pago en el Historial
      const { error: historyError } = await supabase
        .from('subscription_payments')
        .insert({
          business_id: businessId,
          amount: session.amount_total ? session.amount_total / 100 : 850,
          method: 'stripe',
          status: 'PAID',
          payment_type: session.metadata?.paymentType || 'SUBSCRIPTION',
          stripe_link: session.id, // Guardamos el ID de sesión de Stripe como referencia
          period_start: now.toISOString(),
          period_end: baseDate.toISOString()
        });

      if (historyError) {
        console.warn('⚠️ Pago aplicado pero fallo el registro en el historial:', historyError.message);
      }
      
      console.log(`✅ Pago Aplicado y Registrado. Negocio: ${businessId}. Vence: ${baseDate.toISOString()}`);
    } catch (err: any) {
      console.error('❌ Error de BD al aplicar pago:', err.message);
      // Responder 200 a Stripe para evitar reintentos infinitos si fue error nuestro en BD
      return res.status(200).json({ received: true, error: err.message });
    }
  }

  res.status(200).json({ received: true });
}
