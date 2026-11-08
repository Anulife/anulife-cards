// Opens Stripe's page where a customer can change their payment card or cancel.
import { cardWithToken, syncFromCheckout, stripe, json, fail, origin } from '../../lib/shared.mjs';
export default async (req) => {
  if(req.method !== 'POST') return fail('Use POST', 405);
  let body; try{ body = await req.json() }catch{ return fail('Something went wrong.') }
  let c = await cardWithToken(body?.s, body?.t); if(!c) return fail('We could not find that card.', 404);
  if(c.parent) return fail('Payments are managed from the main card\'s edit page.', 400);
  if(c.plan === 'once') return fail('This card was paid once, so there is no subscription to manage.', 400);
  c = await syncFromCheckout(body.s, c);
  if(!c.customerId) return fail('There is no payment on this card yet.', 400);
  try{
    const p = await stripe('billing_portal/sessions', { customer: c.customerId, return_url: `${origin(req)}/?s=${body.s}&t=${body.t}` });
    return json({ url: p.url });
  }catch(e){ console.error(e.message); return fail('We could not open the billing page. Please try again.', 502) }
};
export const config = { path: '/api/portal' };
