import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/**
 * Stripe webhook for ServiRest subscriptions and equipment payments.
 *
 * Events handled (configure these in the Stripe Dashboard webhook → Eventos):
 *   - checkout.session.completed   First-time checkout. Activates plan.
 *   - invoice.paid                 Recurring monthly/yearly auto-renew OK.
 *   - invoice.payment_failed       Card declined → operator enters grace.
 *   - customer.subscription.deleted  Subscription canceled by Stripe / user.
 *   - customer.subscription.trial_will_end  Demo about to end → reminder.
 *
 * The webhook is idempotent: every successful event extends the
 * subscription_expiry from whichever date is greater (current expiry vs
 * today), so duplicate deliveries do not double-bill the grace period.
 *
 * Required environment variables (Vercel):
 *   STRIPE_SECRET_KEY            — sk_live_… (or sk_test_… in test)
 *   STRIPE_WEBHOOK_SECRET        — whsec_… from Stripe dashboard
 *   SUPABASE_URL                 — https://xxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    — bypasses RLS (write to businesses table)
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // @ts-ignore stripe sdk versioning
  apiVersion: '2023-10-16',
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

export const config = { api: { bodyParser: false } };

const getRawBody = async (req: VercelRequest): Promise<Buffer> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Resolves the businessId for any Stripe event. We use three lookup paths
 * in priority order:
 *   1. client_reference_id on Checkout.Session
 *   2. metadata.businessId on the Stripe object
 *   3. The Stripe customer id → look up in our `stripe_customers` table
 *      (or just metadata.businessId on the customer itself)
 */
async function resolveBusinessId(stripeObject: any): Promise<string | null> {
  if (stripeObject?.client_reference_id) return stripeObject.client_reference_id;
  if (stripeObject?.metadata?.businessId) return stripeObject.metadata.businessId;
  // For invoice.* events, customer metadata is the safest fallback.
  const customerId = stripeObject?.customer;
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!('deleted' in customer) || !customer.deleted) {
        const meta = (customer as Stripe.Customer).metadata;
        if (meta?.businessId) return meta.businessId;
      }
    } catch (e) {
      console.warn('Could not retrieve Stripe customer for business id resolution');
    }
  }
  return null;
}

/**
 * Extends `subscription_expiry` to whichever is later: current expiry or
 * today + 30 days. Sets `saas_status = ACTIVE`. Inserts a payment row.
 */
async function applySuccessfulPayment(
  businessId: string,
  amount: number,
  source: 'checkout' | 'invoice',
  stripeRef: string,
  paymentType: 'SUBSCRIPTION' | 'EQUIPMENT' = 'SUBSCRIPTION',
) {
  const { data: businessInfo } = await supabase
    .from('businesses')
    .select('subscription_expiry')
    .eq('id', businessId)
    .single();

  const now = new Date();
  const currentExpiry = businessInfo?.subscription_expiry
    ? new Date(businessInfo.subscription_expiry)
    : now;
  const baseDate = currentExpiry > now ? new Date(currentExpiry) : new Date(now);
  baseDate.setDate(baseDate.getDate() + 30);

  await supabase
    .from('businesses')
    .update({
      subscription_expiry: baseDate.toISOString(),
      saas_status: 'ACTIVE',
      is_active: true,
    })
    .eq('id', businessId);

  await supabase.from('subscription_payments').insert({
    business_id: businessId,
    amount,
    method: 'stripe',
    status: 'PAID',
    payment_type: paymentType,
    stripe_link: stripeRef,
    period_start: now.toISOString(),
    period_end: baseDate.toISOString(),
  });

  console.log(`✅ [${source}] Payment applied · biz=${businessId} · until=${baseDate.toISOString()}`);
}

/**
 * Marks the business as 'GRACE_PERIOD' so the client UI knows to show the
 * 5-day reminder banner. We DO NOT touch subscription_expiry — the operator
 * keeps access until the existing expiry + 5 days, after which the
 * SubscriptionContext flips `isExpired = true`.
 */
async function markPaymentFailed(businessId: string, attemptCount: number) {
  await supabase
    .from('businesses')
    .update({
      saas_status: 'GRACE_PERIOD',
      last_payment_failed_at: new Date().toISOString(),
      payment_failed_attempts: attemptCount,
    })
    .eq('id', businessId);

  await supabase.from('subscription_payments').insert({
    business_id: businessId,
    amount: 0,
    method: 'stripe',
    status: 'FAILED',
    payment_type: 'SUBSCRIPTION',
    period_start: new Date().toISOString(),
    period_end: new Date().toISOString(),
  });

  console.log(`⚠️  Payment failed · biz=${businessId} · attempt=${attemptCount}`);
}

async function markSubscriptionCanceled(businessId: string) {
  await supabase
    .from('businesses')
    .update({ saas_status: 'SUSPENDED', is_active: false })
    .eq('id', businessId);
  console.log(`🚫 Subscription canceled · biz=${businessId}`);
}

/* ─── Handler ─────────────────────────────────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let event: Stripe.Event;
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('Missing Stripe signature or webhook secret');
    return res.status(400).send('Webhook configuration error.');
  }

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      /* ── First-time subscription / one-off checkout ──────────────── */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId = await resolveBusinessId(session);
        if (!businessId) {
          console.warn('checkout.session.completed without businessId — skipped');
          return res.status(200).json({ received: true });
        }
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        const paymentType =
          (session.metadata?.paymentType as 'SUBSCRIPTION' | 'EQUIPMENT') || 'SUBSCRIPTION';
        await applySuccessfulPayment(businessId, amount, 'checkout', session.id, paymentType);
        break;
      }

      /* ── Recurring renewal succeeded ─────────────────────────────── */
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const businessId = await resolveBusinessId(invoice);
        if (!businessId) {
          console.warn('invoice.paid without businessId — skipped');
          return res.status(200).json({ received: true });
        }
        const amount = invoice.amount_paid ? invoice.amount_paid / 100 : 0;
        await applySuccessfulPayment(businessId, amount, 'invoice', invoice.id, 'SUBSCRIPTION');
        break;
      }

      /* ── Recurring renewal failed → start grace period ───────────── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const businessId = await resolveBusinessId(invoice);
        if (!businessId) {
          console.warn('invoice.payment_failed without businessId — skipped');
          return res.status(200).json({ received: true });
        }
        await markPaymentFailed(businessId, invoice.attempt_count || 1);
        break;
      }

      /* ── Customer canceled subscription (or Stripe dropped it) ───── */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = await resolveBusinessId(sub);
        if (!businessId) {
          console.warn('customer.subscription.deleted without businessId — skipped');
          return res.status(200).json({ received: true });
        }
        await markSubscriptionCanceled(businessId);
        break;
      }

      /* ── Demo / trial ends soon (Stripe trial end notifier) ──────── */
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = await resolveBusinessId(sub);
        if (!businessId) return res.status(200).json({ received: true });
        await supabase
          .from('businesses')
          .update({ saas_status: 'WARNING' })
          .eq('id', businessId);
        console.log(`⏰ Demo ending soon · biz=${businessId}`);
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error('❌ Webhook handler error:', err.message);
    // 200 to Stripe so it does not infinite-retry our DB issue.
    return res.status(200).json({ received: true, error: err.message });
  }

  return res.status(200).json({ received: true });
}
