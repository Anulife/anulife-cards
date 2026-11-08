// "Save contact": a contact file phones can open, at /v/<name>.
import { cards, validSlug, origin, cardStatus } from '../../lib/shared.mjs';
import { vcard } from '../../public/card-template.js';
export default async (req, context) => {
  const slug = context?.params?.slug || new URL(req.url).pathname.split('/').pop();
  if(!validSlug(slug)) return new Response('Not found', { status: 404 });
  const c = await cards().get(slug, { type: 'json' });
  if(!c || await cardStatus(c) !== 'active') return new Response('Not found', { status: 404 });
  const file = (c.name || 'contact').replace(/[^\w-]+/g, '-') + '.vcf';
  return new Response(vcard(c, c.hasPhoto ? `${origin(req)}/p/${slug}?v=${c.photoAt}` : ''), { headers: { 'content-type': 'text/vcard; charset=utf-8', 'content-disposition': `attachment; filename="${file}"`, 'cache-control': 'no-store' } });
};
export const config = { path: '/v/:slug' };
