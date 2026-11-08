// The edit page loads the card's current details (only with a private edit key).
import { cards, access, liveStatus, json, fail, MAX_EXTRAS } from '../../lib/shared.mjs';
const PRIVATE = ['tokenHash','sessionId','customerId','subscriptionId','extras'];
export default async (req) => {
  const u = new URL(req.url), slug = u.searchParams.get('s');
  const a = await access(slug, u.searchParams.get('t')); if(!a) return fail('We could not find that card. Check that you used your full private edit link.', 404);
  const { c, parent, viaOwner } = a;
  const out = { ...c }; PRIVATE.forEach(k => delete out[k]);
  out.status = liveStatus(c, parent);
  out.plan = c.plan || 'monthly';
  out.photoUrl = c.hasPhoto ? `/p/${slug}?v=${c.photoAt}` : '';
  out.viaOwner = viaOwner;
  // The main monthly card sees the list of its extra cards
  if(!c.parent && out.plan === 'monthly'){
    const ex = Array.isArray(c.extras) ? c.extras : [];
    out.extraCards = (await Promise.all(ex.map(s => cards().get(s, { type: 'json' })))).filter(Boolean).map(x => ({ slug: x.slug, name: x.name, role: x.role }));
    out.maxExtras = MAX_EXTRAS;
  }
  return json(out);
};
export const config = { path: '/api/card' };
