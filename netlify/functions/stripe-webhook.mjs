// Stripe tells us when someone pays, stops paying, or cancels. That switches their card on or off.
import { cards, verifyStripe, env, LIVE, json, fail, validSlug } from '../../lib/shared.mjs';
export default async (req) => {
  const raw = await req.text();
  if(!verifyStripe(raw, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET'))) return fail('Bad signature', 400);
  const ev = JSON.parse(raw), o = ev.data?.object || {};
  const slug = o.metadata?.slug || o.client_reference_id;
  if(!validSlug(slug)) return json({ ignored: true });
  const store = cards(), c = await store.get(slug, { type: 'json' });
  if(!c) return json({ ignored: 'no card' });
  if(ev.type === 'checkout.session.completed'){
    if(o.payment_status === 'paid' || o.payment_status === 'no_payment_required'){ c.status = 'active'; if(o.mode === 'payment') c.plan = 'once'; c.activatedAt = c.activatedAt || Date.now(); }
    c.customerId = o.customer || c.customerId; c.subscriptionId = o.subscription || c.subscriptionId;
  } else if(c.plan === 'once'){ return json({ ignored: 'one-time card' });
  } else if(ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.created'){
    c.subscriptionId = o.id; c.customerId = o.customer || c.customerId;
    c.status = LIVE.has(o.status) ? 'active' : (o.status === 'canceled' || o.status === 'incomplete_expired') ? 'canceled' : o.status === 'incomplete' ? c.status : 'paused';
  } else if(ev.type === 'customer.subscription.deleted'){
    c.status = 'canceled';
  } else return json({ ignored: ev.type });
  c.updatedAt = Date.now();
  await store.setJSON(slug, c);
  return json({ ok: true, status: c.status });
};
export const config = { path: '/api/stripe-webhook' };
