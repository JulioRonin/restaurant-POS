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
    // 1. Resolve the amount: custom price > global config > default.
    const { data: business } = await supabase
      .from('businesses')
      .select('custom_price')
      .eq('id', businessId)
      .single();

    let finalAmount = req.body.amount || 899; // Profesional default per tier strategy

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

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      success_url: `${req.headers.origin}/#/billing?success=true`,
      cancel_url: `${req.headers.origin}/#/billing?canceled=true`,
      client_reference_id: businessId,
      // Stripe uses these for receipts + customer portal. Pass the business
      // name so the receipt header reads "ServiRest" + restaurant.
      metadata: {
        businessId,
        businessName: businessName || 'Unknown',
        paymentType: type,
        planName,
      },
    };

    if (priceId) {
      sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
      sessionConfig.mode = mode || 'subscription';
    } else {
      // Inline price for one-off charges (equipment, manual top-ups).
      sessionConfig.line_items = [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: planName,
              description:
                type === 'SUBSCRIPTION'
                  ? 'Renovación de licencia ServiRest (30 días)'
                  : 'Pago de equipo / hardware ServiRest',
            },
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
