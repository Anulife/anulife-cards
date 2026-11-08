// A card's photo, at /p/<name>.
import { photos, validSlug } from '../../lib/shared.mjs';
export default async (req, context) => {
  const slug = context?.params?.slug || new URL(req.url).pathname.split('/').pop();
  if(!validSlug(slug)) return new Response('Not found', { status: 404 });
  const r = await photos().getWithMetadata(slug, { type: 'arrayBuffer' });
  if(!r || !r.data) return new Response('Not found', { status: 404 });
  return new Response(r.data, { headers: { 'content-type': r.metadata?.type || 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
};
export const config = { path: '/p/:slug' };
