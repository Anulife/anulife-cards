// The flip-book business card. Used in two places: the live preview in the card maker,
// and the real card page at /c/<name>. Everything a customer typed is escaped before it goes in.

export const THEMES = {
  gold:    { label:'Ebony & Gold',  field:'#0d0906', page:'#16100a', glow:'#2b1d10', panel:'#1f160d', accent:'#e3b24f', accent2:'#f6d27a', accentInk:'#1b1209', ink:'#f5ead2', muted:'#c3ad85', line:'#4a3820' },
  royal:   { label:'Royal Blue',    field:'#060a16', page:'#0d1630', glow:'#1b2b57', panel:'#14204a', accent:'#7fa7ff', accent2:'#b7ccff', accentInk:'#0a1230', ink:'#eef2ff', muted:'#a8b4d8', line:'#2b3d72' },
  emerald: { label:'Emerald',       field:'#04100b', page:'#0b2018', glow:'#123526', panel:'#11291f', accent:'#d9b45a', accent2:'#f0d590', accentInk:'#14100a', ink:'#effaf3', muted:'#a9c7b6', line:'#24503c' },
  pearl:   { label:'Pearl & Wine',  field:'#e9e2d6', page:'#fbf7f0', glow:'#ffffff', panel:'#f3ece0', accent:'#8a2433', accent2:'#b5414f', accentInk:'#ffffff', ink:'#2a1d18', muted:'#6f6158', line:'#d8cbb8' },
};

export const LIMITS = { name:40, subtitle:60, role:70, tagline:90, phone:24, email:80, website:120, message:420,
  bizTitle:50, bizText:320, bullet:80, bullets:4, ctaText:28, ctaMessage:160, link:200 };

export function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export const digits = s => String(s || '').replace(/[^\d+]/g, '');
export function safeUrl(u){
  u = String(u || '').trim(); if(!u) return '';
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : ''; } catch { return ''; }
}
export const showUrl = u => String(u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
export function youtubeId(u){ const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/); return m ? m[1] : ''; }

// Plain contact file so "Save contact" puts the person straight into a phone's contacts
export function vcard(c, photoUrl){
  const e = s => String(s || '').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/([,;])/g,'\\$1');
  const L = ['BEGIN:VCARD','VERSION:3.0', `N:;${e(c.name)};;;`, `FN:${e([c.name, c.subtitle].filter(Boolean).join(' '))}`];
  if(c.role) L.push(`TITLE:${e(c.role)}`);
  if(c.bizTitle) L.push(`ORG:${e(c.bizTitle)}`);
  if(c.phone) L.push(`TEL;TYPE=CELL:${digits(c.phone)}`);
  if(c.email) L.push(`EMAIL;TYPE=INTERNET:${e(c.email)}`);
  if(c.website) L.push(`URL:${e(safeUrl(c.website))}`);
  if(photoUrl && /^https?:/.test(photoUrl)) L.push(`PHOTO;VALUE=URI:${photoUrl}`);
  if(c.tagline) L.push(`NOTE:${e(c.tagline)}`);
  L.push('END:VCARD');
  return L.join('\r\n') + '\r\n';
}

const ICON = {
  call:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
  text:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2z"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M2 21c0-4 4-6 8-6s8 2 8 6M19 8v6M16 11h6"/></svg>',
};

// c = the card's details. opts: photoUrl, vcardUrl (or built in), pageUrl (for Share), preview (true in the card maker)
export function renderCard(c, opts = {}){
  const t = THEMES[c.theme] || THEMES.gold;
  const tel = digits(c.phone), site = safeUrl(c.website), yt = youtubeId(c.youtube);
  const photo = opts.photoUrl || '';
  const vcf = opts.vcardUrl || ('data:text/vcard;charset=utf-8,' + encodeURIComponent(vcard(c, photo)));
  const fullName = [c.name, c.subtitle].filter(Boolean).join(' ');
  const socials = [['Facebook', c.facebook], ['Instagram', c.instagram], ['LinkedIn', c.linkedin], ['TikTok', c.tiktok], ['X', c.x], ['YouTube', c.youtubeChannel]]
    .map(([k, u]) => [k, safeUrl(u)]).filter(([, u]) => u);
  const bullets = (c.bullets || []).filter(Boolean);
  const sms = tel ? `sms:${tel}${c.ctaMessage ? '?&body=' + encodeURIComponent(c.ctaMessage) : ''}` : '';
  const pages = [];

  // 1. Front
  pages.push(`<div class="pg" style="gap:7px">
    ${photo ? `<div class="photo"><img src="${esc(photo)}" alt="${esc(fullName)}"></div>` : `<div class="photo nophoto" aria-hidden="true">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</div>`}
    <h1>${esc(c.name || 'Your Name')}${c.subtitle ? `<span class="full">${esc(c.subtitle)}</span>` : ''}</h1>
    ${c.role ? `<p class="role">${esc(c.role)}</p>` : ''}
    ${c.tagline ? `<p class="tag">${esc(c.tagline)}</p>` : ''}
    ${site ? `<a class="site" href="${esc(site)}" target="_blank" rel="noopener">${esc(showUrl(site))}</a>` : ''}
    <div class="actions">
      ${tel ? `<a class="btn gold" href="tel:${esc(tel)}">${ICON.call}Call</a><a class="btn gold" href="sms:${esc(tel)}">${ICON.text}Text</a>` : ''}
      ${c.email ? `<a class="btn" href="mailto:${esc(c.email)}">${ICON.mail}Email</a>` : ''}
      <a class="btn${c.email ? '' : ' wide'}" href="${esc(vcf)}" download="${esc((c.name || 'contact').replace(/[^\w-]+/g, '-'))}.vcf">${ICON.save}Save contact</a>
    </div>
    <p class="turn">Swipe for more ›</p>
  </div>`);

  // 2. Message (with video when there is one)
  if(c.message || yt){
    pages.push(`<div class="pg">
      <p class="eyebrow">A MESSAGE FROM ${esc((c.name || '').toUpperCase())}</p>
      ${c.messageTitle ? `<h2>${esc(c.messageTitle)}</h2>` : ''}
      ${yt ? `<div class="video"><iframe src="https://www.youtube.com/embed/${esc(yt)}?playsinline=1&rel=0" title="Video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>` : ''}
      ${c.message ? `<p class="quote">${esc(c.message)}</p>` : ''}
      <p class="sig">${esc(fullName)}</p>
    </div>`);
  }

  // 3. Business
  if(c.bizTitle || c.bizText || bullets.length){
    pages.push(`<div class="pg">
      <p class="eyebrow">WHAT I DO</p>
      ${c.bizTitle ? `<h2>${esc(c.bizTitle)}</h2>` : ''}
      ${c.bizText ? `<p class="lead">${esc(c.bizText)}</p>` : ''}
      ${bullets.length ? `<ul class="list">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${tel && c.ctaText ? `<div class="actions"><a class="btn gold wide" href="${esc(sms)}">${esc(c.ctaText)}</a></div>` : ''}
    </div>`);
  }

  // 4. Contact
  pages.push(`<div class="pg">
    <p class="eyebrow">STAY IN TOUCH</p>
    <h2>Contact</h2>
    <div class="rows">
      ${tel ? `<div class="row"><span class="k">Phone</span><span class="v">${esc(c.phone)}</span></div>` : ''}
      ${c.email ? `<div class="row"><span class="k">Email</span><span class="v">${esc(c.email)}</span></div>` : ''}
      ${site ? `<a class="row" href="${esc(site)}" target="_blank" rel="noopener"><span class="k">Website</span><span class="v acc">${esc(showUrl(site))} ›</span></a>` : ''}
    </div>
    ${socials.length ? `<div class="social">${socials.map(([k, u]) => `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>`).join('')}</div>` : ''}
    <div class="actions">
      ${tel ? `<a class="btn gold" href="tel:${esc(tel)}">Call</a>` : ''}
      <button class="btn${tel ? '' : ' wide'}" id="shareBtn" type="button">Share this card</button>
    </div>
  </div>`);

  // 5. Back cover
  pages.push(`<div class="pg back">
    ${photo ? `<div class="mini"><img src="${esc(photo)}" alt=""></div>` : ''}
    <div class="mark">${esc(fullName || 'Your Name')}</div>
    ${c.tagline ? `<p class="motto">${esc(c.tagline)}</p>` : ''}
    <p class="tag">${[c.phone, site ? showUrl(site) : ''].filter(Boolean).map(esc).join(' · ')}</p>
    ${opts.preview ? '' : `<p class="made">Made with <a href="/" target="_blank" rel="noopener">ANU Life Cards</a></p>`}
  </div>`);

  const title = esc(fullName || 'Business card');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${esc([fullName, c.role].filter(Boolean).join(', '))}. Call, text, email or save my contact.">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${esc(c.role || c.tagline || 'My digital business card')}">
${photo && /^https?:/.test(photo) ? `<meta property="og:image" content="${esc(photo)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Source+Sans+3:wght@400;600;700&display=swap">
<style>
:root{--field:${t.field};--ebony:${t.page};--glow:${t.glow};--panel:${t.panel};--gold:${t.accent};--gold-2:${t.accent2};--gold-ink:${t.accentInk};--ink:${t.ink};--muted:${t.muted};--line:${t.line};
  --display:"Marcellus","Trajan Pro",Georgia,serif;--body:"Source Sans 3","Segoe UI",Roboto,Helvetica,Arial,sans-serif}
html,body{height:100%;margin:0}
body{background:radial-gradient(ellipse at 50% 30%,var(--glow),var(--field) 70%);background-color:var(--field);color:var(--ink);font-family:var(--body);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;overflow:hidden;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:12px;box-sizing:border-box}
*{box-sizing:border-box}
[hidden]{display:none!important}
a,button{-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
#fit{width:360px;height:600px;flex:none;transform-origin:50% 50%}
#book{width:360px}
.page{background:var(--ebony);overflow:hidden;font-size:17.5px;line-height:1.42}
.pg{position:absolute;inset:0;display:flex;flex-direction:column;padding:18px 20px 14px;gap:9px;
  background:radial-gradient(ellipse at 50% 0%,var(--glow) 0%,transparent 60%),var(--ebony);border:1px solid var(--line)}
.pg::before{content:"";position:absolute;inset:7px;border:1px solid color-mix(in srgb,var(--gold) 25%,transparent);pointer-events:none}
.eyebrow{font:400 .82rem var(--display);letter-spacing:.28em;color:var(--gold);text-align:center;margin:0}
h1,h2{font-family:var(--display);font-weight:400;margin:0;text-wrap:balance;color:var(--ink)}
h1{font-size:2.2rem;letter-spacing:.08em;text-align:center;line-height:1.05;overflow-wrap:anywhere}
h1 .full{display:block;font-size:1.15rem;letter-spacing:.05em;margin-top:4px}
h2{font-size:1.6rem;color:var(--gold);letter-spacing:.03em}
.role{line-height:1.25;margin:0;text-align:center;color:var(--gold-2);font-weight:600;letter-spacing:.03em}
.tag{margin:0;text-align:center;color:var(--muted);font-style:italic}
.site{align-self:center;color:var(--gold-2);font-weight:700;font-size:1.05rem;text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--gold) 45%,transparent);overflow-wrap:anywhere;text-align:center}
.photo{align-self:center;width:172px;height:220px;border-radius:86px 86px 8px 8px;overflow:hidden;border:3px solid var(--gold);box-shadow:0 0 0 6px color-mix(in srgb,var(--gold) 14%,transparent),0 10px 24px #0007;flex:none}
.photo img{width:100%;height:100%;object-fit:cover;object-position:50% 40%;display:block}
.photo.nophoto{display:flex;align-items:center;justify-content:center;font:400 5rem var(--display);color:var(--gold);background:var(--panel)}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:8px;white-space:nowrap;border-radius:6px;border:1px solid var(--line);background:var(--panel);
  color:var(--ink);font:600 1.05rem var(--body);text-decoration:none;cursor:pointer}
.btn:hover{border-color:var(--gold)}
.btn.gold{background:linear-gradient(var(--gold-2),var(--gold) 60%);color:var(--gold-ink);border-color:var(--gold)}
.btn.wide{grid-column:1/-1}
.btn svg{width:18px;height:18px;flex:none}
.turn{margin:0;text-align:center;font-size:.9rem;color:var(--muted)}
.lead{margin:0}
.quote{margin:0;padding:12px 14px;border-left:3px solid var(--gold);background:color-mix(in srgb,var(--ink) 5%,transparent);font-style:italic;overflow-wrap:anywhere}
.sig{margin:0;text-align:right;font-family:var(--display);color:var(--gold-2)}
.video{position:relative;border-radius:6px;overflow:hidden;border:1px solid var(--line);aspect-ratio:16/9;background:#000;flex:none}
.video iframe{width:100%;height:100%;border:0;display:block}
.list{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.list li{display:flex;gap:10px;align-items:baseline}
.list li::before{content:"◆";color:var(--gold);flex:none;font-size:.8em}
.rows{display:grid;gap:8px}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel);text-decoration:none;color:inherit}
.row .k{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.row .v{font-weight:700;font-size:1rem;overflow-wrap:anywhere;text-align:right}
.row .acc{color:var(--gold-2)}
.social{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.social .btn{font-size:.9rem}
.back{align-items:center;justify-content:center;text-align:center;gap:14px}
.mini{width:92px;height:92px;border-radius:50%;overflow:hidden;border:3px solid var(--gold)}
.mini img{width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.mark{font:400 1.7rem var(--display);letter-spacing:.08em;color:var(--gold)}
.motto{margin:0;color:var(--gold-2);font-family:var(--display);font-size:1.2rem;max-width:24ch}
.made{position:absolute;bottom:16px;left:0;right:0;margin:0;font-size:.75rem;color:var(--muted)}
.made a{color:inherit}
.getown{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 16px;border-radius:999px;border:1px solid var(--gold);color:var(--gold-2);background:color-mix(in srgb,var(--panel) 80%,transparent);font:600 .95rem var(--body);text-decoration:none;letter-spacing:.02em}
.getown:hover{background:var(--gold);color:var(--gold-ink)}
.nav{display:flex;align-items:center;gap:14px;flex:none}
.nav button{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--gold);font-size:1.1rem;cursor:pointer}
.nav button:disabled{opacity:.35;cursor:default}
.dots{display:flex;gap:7px}
.dots i{width:8px;height:8px;border-radius:50%;background:color-mix(in srgb,var(--gold) 30%,transparent)}
.dots i.on{background:var(--gold)}
#toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--panel);border:1px solid var(--gold);color:var(--ink);padding:9px 14px;border-radius:6px;font-size:.9rem;z-index:20;max-width:calc(100vw - 40px)}
</style></head><body>
<div id="fit"><div id="book">
${pages.map(p => `<div class="page">${p}</div>`).join('\n')}
</div></div>
<div class="nav" aria-label="Turn pages"><button id="prev" aria-label="Previous page">‹</button><div class="dots" id="dots"></div><button id="next" aria-label="Next page">›</button></div>
${opts.preview ? '' : `<a class="getown" href="/" target="_blank" rel="noopener">Get your own card ›</a>`}
<div id="toast" hidden role="status"></div>
<script src="/flip.js"></script>
<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  function toast(m){var t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},3200)}
  function fit(){var s=Math.min((innerWidth-32)/360,(innerHeight-${opts.preview ? 94 : 144})/600,1.5);s=Math.max(.5,s);$('fit').style.transform='scale('+s+')';$('fit').style.margin=((600*s-600)/2)+'px '+((360*s-360)/2)+'px'}
  fit();addEventListener('resize',fit);
  var share=$('shareBtn');
  var pages=[].slice.call(document.querySelectorAll('#book .page'));
  if(!window.St){return}
  var pf=new St.PageFlip($('book'),{width:600,height:1000,usePortrait:true,minWidth:100000,flippingTime:900,maxShadowOpacity:.55});
  pf.loadFromHTML(pages);
  $('dots').innerHTML=pages.map(function(){return '<i></i>'}).join('');
  function sync(){var i=pf.getCurrentPageIndex();[].forEach.call($('dots').children,function(d,k){d.classList.toggle('on',k===i)});$('prev').disabled=i===0;$('next').disabled=i>=pages.length-1}
  pf.on('flip',sync);sync();
  $('next').onclick=function(){pf.flipNext()};$('prev').onclick=function(){pf.flipPrev()};
  addEventListener('keydown',function(e){if(e.key==='ArrowRight')pf.flipNext();if(e.key==='ArrowLeft')pf.flipPrev()});
  if(share)share.onclick=function(){
    var url=${JSON.stringify(opts.pageUrl || '').replace(/</g,'\\u003c')}||location.href.split('#')[0];
    if(navigator.share){navigator.share({title:document.title,url:url}).catch(function(){});return}
    if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){toast('Link copied. Paste it into a text or post.')},function(){toast(url)})}else toast(url);
  };
})();
</script>
</body></html>`;
}
