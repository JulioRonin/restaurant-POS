import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessId, businessName, type = 'SUBSCRIPTION', planName = 'Solaris POS Premium' } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Missing businessId' });
  }

  try {
    // 1. Buscar precio personalizado para este negocio
    const { data: business } = await supabase
      .from('businesses')
      .select('custom_price')
      .eq('id', businessId)
      .single();

    let finalAmount = req.body.amount || 850;

    if (business && business.custom_price) {
        finalAmount = business.custom_price;
    } else {
        // Fallback al precio global si no hay personalizado
        const { data: globalConfig } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'membership_monthly_price')
          .single();
        if (globalConfig) finalAmount = Number(globalConfig.value);
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `${planName}`,
              description: type === 'SUBSCRIPTION' ? 'Renovación de Licencia Solaris POS (30 días)' : 'Pago de Equipo/Hardware Solaris POS',
            },
            unit_amount: Math.round(finalAmount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/#/billing?success=true`,
      cancel_url: `${req.headers.origin}/#/billing?canceled=true`,
      client_reference_id: businessId,
      metadata: {
        businessId,
        businessName: businessName || 'Unknown',
        paymentType: type,
        planName
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: err.message });
  }
}
