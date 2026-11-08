// The card itself, at /c/<name>. Shows only while paid (one-time cards stay on; extra cards follow their owner).
import { cards, validSlug, origin, cardStatus } from '../../lib/shared.mjs';
import { renderCard, esc } from '../../public/card-template.js';
const page = (title, msg, status) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0906;color:#f5ead2;font:18px/1.5 'Segoe UI',Roboto,Arial,sans-serif;padding:24px;text-align:center"><div><h1 style="font:400 1.8rem Georgia,serif;color:#e3b24f;margin:0 0 10px">${esc(title)}</h1><p style="margin:0">${msg}</p><p style="margin-top:22px"><a href="/" style="color:#f6d27a">Make your own card</a></p></div></body>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
export default async (req, context) => {
  const slug = context?.params?.slug || new URL(req.url).pathname.split('/').pop();
  if(!validSlug(slug)) return page('Card not found', 'Please check the link and try again.', 404);
  const c = await cards().get(slug, { type: 'json' });
  if(!c) return page('Card not found', 'Please check the link and try again.', 404);
  const st = await cardStatus(c);
  if(st !== 'active') return page('This card is not active', st === 'pending' ? 'The payment for this card has not gone through yet.' : 'This card is switched off right now.', 404);
  const site = origin(req);
  const html = renderCard(c, { photoUrl: c.hasPhoto ? `${site}/p/${slug}?v=${c.photoAt}` : '', vcardUrl: `/v/${slug}`, pageUrl: `${site}/c/${slug}` });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
};
export const config = { path: '/c/:slug' };
