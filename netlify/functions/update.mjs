// Save changes from the edit page.
import { cards, photos, access, liveStatus, cleanCard, decodePhoto, json, fail } from '../../lib/shared.mjs';
export default async (req) => {
  if(req.method !== 'POST') return fail('Use POST', 405);
  let body; try{ body = await req.json() }catch{ return fail('Something went wrong. Please try again.') }
  const slug = body?.s, a = await access(slug, body?.t); if(!a) return fail('We could not find that card.', 404);
  const { c, parent } = a;
  if(c.plan === 'once') return fail('This card was a one-time purchase, so it can\'t be changed. The monthly plan allows changes anytime.', 403);
  const st = liveStatus(c, parent);
  if(st === 'canceled') return fail('This card\'s subscription has ended. Start a new card to bring it back.', 403);
  const { card, error } = cleanCard(body?.card); if(error) return fail(error);
  const now = Date.now(); let photoAt = c.photoAt, hasPhoto = c.hasPhoto;
  if(body?.removePhoto){ await photos().delete(slug); hasPhoto = false; }
  else if(body?.photo){ const pic = decodePhoto(body.photo); if(pic?.error) return fail(pic.error); await photos().set(slug, pic.buf, { metadata: { type: pic.type, at: now } }); hasPhoto = true; photoAt = now; }
  await cards().setJSON(slug, { ...c, ...card, hasPhoto, photoAt, updatedAt: now });
  return json({ ok: true });
};
export const config = { path: '/api/update' };
