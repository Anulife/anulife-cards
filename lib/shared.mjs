// Shared helpers for the card maker's server parts.
import { getStore } from '@netlify/blobs';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { LIMITS, safeUrl, digits } from '../public/card-template.js';

export const env = k => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k] ?? '';
export const cards = () => getStore({ name: 'cards', consistency: 'strong' });
export const photos = () => getStore({ name: 'photos', consistency: 'strong' });

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export const fail = (msg, status = 400) => json({ error: msg }, status);
export const hash = s => createHash('sha256').update(String(s)).digest('hex');
export const newToken = () => randomBytes(24).toString('hex');
export const origin = req => { const u = new URL(req.url); return env('SITE_URL').replace(/\/$/, '') || u.origin; };

// The card's address: their name plus 4 random letters, e.g. /c/pharaoh-ptah-k7m2
export function makeSlug(name){
  const base = String(name || 'card').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 30).replace(/^-|-$/g, '') || 'card';
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'; const r = randomBytes(4);
  return base + '-' + [...r].map(b => abc[b % abc.length]).join('');
}
export const validSlug = s => /^[a-z0-9-]{3,40}$/.test(String(s || ''));

// Keep only the fields we expect, trimmed to their limits
const TEXT = ['name','subtitle','role','tagline','phone','email','website','messageTitle','message','bizTitle','bizText','ctaText','ctaMessage','youtube','facebook','instagram','linkedin','tiktok','x','youtubeChannel'];
const LIM = { messageTitle: 50, youtube: LIMITS.link, facebook: LIMITS.link, instagram: LIMITS.link, linkedin: LIMITS.link, tiktok: LIMITS.link, x: LIMITS.link, youtubeChannel: LIMITS.link };
export function cleanCard(input){
  const c = {};
  for(const k of TEXT){ const v = String(input?.[k] ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim(); c[k] = v.slice(0, LIM[k] || LIMITS[k] || 120); }
  c.bullets = (Array.isArray(input?.bullets) ? input.bullets : []).map(b => String(b || '').trim().slice(0, LIMITS.bullet)).filter(Boolean).slice(0, LIMITS.bullets);
  c.theme = ['gold','royal','emerald','pearl'].includes(input?.theme) ? input.theme : 'gold';
  for(const k of ['website','youtube','facebook','instagram','linkedin','tiktok','x','youtubeChannel']) if(c[k] && !safeUrl(c[k])) c[k] = '';
  if(c.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.email)) return { error: 'That email address doesn\'t look right.' };
  if(!c.name) return { error: 'Please type the name to show on the card.' };
  if(!digits(c.phone) && !c.email) return { error: 'Please add a phone number or an email, so people can reach you.' };
  return { card: c };
}

// Photo arrives as a data URL that the page already shrank; we check it really is a picture
export function decodePhoto(dataUrl){
  if(!dataUrl) return null;
  const m = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!m) return { error: 'That photo could not be read. Please choose a JPG or PNG picture.' };
  const buf = Buffer.from(m[2], 'base64');
  if(buf.length > 1.5 * 1024 * 1024) return { error: 'That photo is too big. Please choose a smaller one.' };
  const sig = buf.subarray(0, 12);
  const ok = (sig[0] === 0xff && sig[1] === 0xd8) || (sig[0] === 0x89 && sig[1] === 0x50) || (sig.toString('ascii', 0, 4) === 'RIFF' && sig.toString('ascii', 8, 12) === 'WEBP');
  if(!ok) return { error: 'That file is not a picture. Please choose a JPG or PNG.' };
  return { buf, type: m[1] };
}

// ---- Stripe (talked to directly, no extra packages) ----
function form(obj, prefix = '', out = []){
  for(const [k, v] of Object.entries(obj)){
    if(v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if(typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
export async function stripe(path, params, method = 'POST'){
  const key = env('STRIPE_SECRET_KEY');
  if(!key) throw new Error('STRIPE_SECRET_KEY is not set in Netlify');
  const body = params ? form(params).join('&') : undefined;
  const url = 'https://api.stripe.com/v1/' + path + (method === 'GET' && body ? '?' + body : '');
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/x-www-form-urlencoded' }, body: method === 'GET' ? undefined : body });
  const data = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error('Stripe: ' + (data?.error?.message || r.status));
  return data;
}
export function verifyStripe(raw, header, secret, tolerance = 300){
  if(!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(',').filter(p => p.trim().startsWith('v1=')).map(p => p.trim().slice(3));
  const t = +parts.t; if(!t || Math.abs(Date.now() / 1000 - t) > tolerance) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sigs.some(s => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

// A paid subscription keeps the card on; these Stripe states count as paid
export const LIVE = new Set(['active', 'trialing', 'past_due']);

// Find a card and check a private edit key. A monthly owner's key also opens their extra cards.
export const MAX_EXTRAS = 5;
export async function access(slug, token){
  if(!validSlug(slug) || !token) return null;
  const store = cards(), c = await store.get(slug, { type: 'json' }); if(!c) return null;
  const h = hash(token);
  const parent = c.parent ? await store.get(c.parent, { type: 'json' }) : null;
  if(c.tokenHash === h) return { c, parent, viaOwner: false };
  if(parent && parent.tokenHash === h) return { c, parent, viaOwner: true };
  return null;
}
export async function cardWithToken(slug, token){ const a = await access(slug, token); return a ? a.c : null; }

// Is the card switched on? Extra cards follow their owner's subscription.
export const liveStatus = (c, parent) => c.parent ? (parent ? parent.status : 'canceled') : c.status;
export async function cardStatus(c){
  if(!c.parent) return c.status;
  return liveStatus(c, await cards().get(c.parent, { type: 'json' }));
}

// If a payment went through but Stripe's message hasn't arrived yet, ask Stripe directly
export async function syncFromCheckout(slug, c){
  if(c.status !== 'pending' || !c.sessionId) return c;
  try{
    const s = await stripe('checkout/sessions/' + encodeURIComponent(c.sessionId), null, 'GET');
    if(s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required')){
      c.status = 'active'; if(s.mode === 'payment') c.plan = 'once'; c.customerId = s.customer || c.customerId; c.subscriptionId = s.subscription || c.subscriptionId; c.activatedAt = c.activatedAt || Date.now();
      await cards().setJSON(slug, c);
    }
  }catch(e){ console.error(e.message) }
  return c;
}
