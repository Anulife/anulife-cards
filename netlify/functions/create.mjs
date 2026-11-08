// A customer finished their card: save it (not live yet) and send them to Stripe to pay.
// Two plans: "monthly" ($9.99 a month: unlimited changes + 5 extra cards) or "once" ($75 one time: the card can't be changed).
import { cards, photos, cleanCard, decodePhoto, makeSlug, newToken, hash, stripe, env, json, fail, origin } from '../../lib/shared.mjs';

export default async (req) => {
  if(req.method !== 'POST') return fail('Use POST', 405);
  let body; try{ body = await req.json() }catch{ return fail('Something went wrong sending your card. Please try again.') }
  const plan = body?.plan === 'once' ? 'once' : 'monthly';
  const { card, error } = cleanCard(body?.card); if(error) return fail(error);
  const pic = decodePhoto(body?.photo); if(pic?.error) return fail(pic.error);
  const price = env(plan === 'once' ? 'STRIPE_ONCE_PRICE_ID' : 'STRIPE_PRICE_ID');
  if(!price) return fail(`Payments are not set up yet. (${plan === 'once' ? 'STRIPE_ONCE_PRICE_ID' : 'STRIPE_PRICE_ID'} is missing in Netlify.)`, 500);

  const store = cards();
  let slug = makeSlug(card.name);
  for(let i = 0; i < 5 && await store.get(slug); i++) slug = makeSlug(card.name);
  const token = newToken(), now = Date.now(), site = origin(req);
  if(pic) await photos().set(slug, pic.buf, { metadata: { type: pic.type, at: now } });

  const common = {
    line_items: [{ price, quantity: 1 }],
    client_reference_id: slug,
    metadata: { slug, plan },
    customer_email: card.email || undefined,
    allow_promotion_codes: 'true',
    success_url: `${site}/done.html?s=${slug}&t=${token}`,
    cancel_url: `${site}/?back=1`,
  };
  let session;
  try{
    session = await stripe('checkout/sessions', plan === 'once'
      ? { ...common, mode: 'payment', customer_creation: 'always', payment_intent_data: { metadata: { slug, plan } } }
      : { ...common, mode: 'subscription', subscription_data: { metadata: { slug, plan } } });
  }catch(e){ console.error(e.message); if(pic) await photos().delete(slug); return fail('We could not start the payment. Please try again in a minute.', 502) }

  await store.setJSON(slug, { ...card, slug, plan, extras: [], status: 'pending', tokenHash: hash(token), hasPhoto: !!pic, photoAt: pic ? now : 0, sessionId: session.id, createdAt: now, updatedAt: now });
  return json({ checkoutUrl: session.url, slug });
};
export const config = { path: '/api/create' };
