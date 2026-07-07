import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Default ServiRest plan name when none is provided by the caller. The old
 * 'KŌSO POS Premium' string used to leak into the Stripe Checkout product
 * line ("KŌSO POS - Renovación Mensual") visible to paying customers.
 */
const DEFAULT_PLAN_NAME = 'ServiRest — Suscripción';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    businessId,
    businessName,
    type = 'SUBSCRIPTION',
    planName = DEFAULT_PLAN_NAME,
    priceId,
    mode,
  } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Missing businessId' });
  }

  try {
    // ── Ramas por tipo ────────────────────────────────────────────
    // DIGITAL_ORDER  → pedido del cliente en kiosko o storefront público.
    //                  Usa req.body.amount tal cual, sin tocar la
    //                  configuración global de suscripción.
    // SUBSCRIPTION   → renovación mensual del SaaS. Prioriza custom_price
    //                  del negocio o membership_monthly_price global.
    // EQUIPMENT      → pago del kit físico (impresora, cajón, terminal).
    //                  Usa req.body.amount.
    const isDigitalOrder = type === 'DIGITAL_ORDER';

    let finalAmount: number;
    if (isDigitalOrder || type === 'EQUIPMENT') {
      // Confía en el monto que envía el cliente (el kiosko ya sumó
      // subtotal + envío + IVA).
      finalAmount = Number(req.body.amount);
      if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount for digital order' });
      }
    } else {
      // SUBSCRIPTION: resolver precio desde el negocio / config global.
      const { data: business } = await supabase
        .from('businesses')
        .select('custom_price')
        .eq('id', businessId)
        .single();

      finalAmount = req.body.amount || 899;
      if (business && business.custom_price) {
        finalAmount = business.custom_price;
      } else {
        const { data: globalConfig } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'membership_monthly_price')
          .single();
        if (globalConfig) finalAmount = Number(globalConfig.value);
      }
    }

    // ── URLs de retorno ───────────────────────────────────────────
    // Para pedidos digitales, el cliente puede pedir un successUrl /
    // cancelUrl específicos (el kiosko regresa al /kiosk con ?paid=id).
    const successUrl = req.body.successUrl || `${req.headers.origin}/#/billing?success=true`;
    const cancelUrl = req.body.cancelUrl || `${req.headers.origin}/#/billing?canceled=true`;

    // ── Descripción legible en el checkout de Stripe ──────────────
    const productDescription = isDigitalOrder
      ? `Pedido del canal digital · ${businessName || 'ServiRest'}`
      : type === 'SUBSCRIPTION'
      ? 'Renovación de licencia ServiRest (30 días)'
      : 'Pago de equipo / hardware ServiRest';

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: businessId,
      metadata: {
        businessId,
        businessName: businessName || 'Unknown',
        paymentType: type,
        planName,
        ...(req.body.orderId ? { orderId: req.body.orderId } : {}),
      },
    };

    if (priceId && !isDigitalOrder) {
      // Solo suscripciones/equipment usan priceId de Stripe (ver Billing).
      sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
      sessionConfig.mode = mode || 'subscription';
    } else {
      // Line item inline (digital orders, equipment, top-ups manuales).
      sessionConfig.line_items = [
        {
          price_data: {
            currency: 'mxn',
            product_data: { name: planName, description: productDescription },
            unit_amount: Math.round(finalAmount * 100),
          },
          quantity: 1,
        },
      ];
      sessionConfig.mode = 'payment';
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: err.message });
  }
}
