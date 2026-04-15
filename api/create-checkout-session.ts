import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessId, businessName, amount, type = 'SUBSCRIPTION', planName = 'Solaris POS Premium' } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Missing businessId' });
  }

  try {
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
            unit_amount: Math.round(amount * 100), // Stripe expects cents
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
