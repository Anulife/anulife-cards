// Monthly customers can make up to 5 extra cards (family, friends, a second business).
// They follow the owner's subscription: if it ends, these switch off too.
import { cards, photos, access, cleanCard, decodePhoto, makeSlug, newToken, hash, json, fail, origin, MAX_EXTRAS } from '../../lib/shared.mjs';

export default async (req) => {
  if(req.method !== 'POST') return fail('Use POST', 405);
  let body; try{ body = await req.json() }catch{ return fail('Something went wrong. Please try again.') }
  const a = await access(body?.s, body?.t);
  if(!a || a.c.parent || a.viaOwner) return fail('Only the main card\'s private edit link can make extra cards.', 404);
  const owner = a.c, store = cards();
  if(owner.plan === 'once') return fail('Extra cards come with the monthly plan.', 403);
  if(owner.status !== 'active') return fail('Your subscription is not active, so you can\'t make extra cards right now.', 403);
  owner.extras = Array.isArray(owner.extras) ? owner.extras : [];

  if(body.action === 'delete'){
    const slug = String(body.slug || '');
    if(!owner.extras.includes(slug)) return fail('That card is not one of your extra cards.', 404);
    await store.delete(slug); await photos().delete(slug);
    owner.extras = owner.extras.filter(x => x !== slug); owner.updatedAt = Date.now();
    await store.setJSON(owner.slug, owner);
    return json({ ok: true, left: MAX_EXTRAS - owner.extras.length });
  }

  if(owner.extras.length >= MAX_EXTRAS) return fail(`You have used all ${MAX_EXTRAS} extra cards. Delete one to make room for a new one.`, 403);
  const { card, error } = cleanCard(body?.card); if(error) return fail(error);
  const pic = decodePhoto(body?.photo); if(pic?.error) return fail(pic.error);
  let slug = makeSlug(card.name);
  for(let i = 0; i < 5 && await store.get(slug); i++) slug = makeSlug(card.name);
  const token = newToken(), now = Date.now(), site = origin(req);
  if(pic) await photos().set(slug, pic.buf, { metadata: { type: pic.type, at: now } });
  await store.setJSON(slug, { ...card, slug, parent: owner.slug, plan: 'extra', status: 'active', tokenHash: hash(token), hasPhoto: !!pic, photoAt: pic ? now : 0, createdAt: now, updatedAt: now });
  owner.extras.push(slug); owner.updatedAt = now;
  await store.setJSON(owner.slug, owner);
  return json({ ok: true, slug, cardUrl: `${site}/c/${slug}`, editUrl: `${site}/?s=${slug}&t=${token}`, left: MAX_EXTRAS - owner.extras.length });
};
export const config = { path: '/api/extra' };
