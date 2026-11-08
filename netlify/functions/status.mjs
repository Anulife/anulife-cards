// The "thank you" page asks: has the payment gone through, and what is my card's link?
import { cardWithToken, syncFromCheckout, json, fail, origin } from '../../lib/shared.mjs';
export default async (req) => {
  const u = new URL(req.url), slug = u.searchParams.get('s'), t = u.searchParams.get('t');
  let c = await cardWithToken(slug, t); if(!c) return fail('We could not find that card.', 404);
  c = await syncFromCheckout(slug, c);
  const site = origin(req);
  return json({ status: c.status, plan: c.plan || 'monthly', cardUrl: `${site}/c/${slug}`, editUrl: `${site}/?s=${slug}&t=${t}`, name: c.name });
};
export const config = { path: '/api/status' };
