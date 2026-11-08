/* BookFlip: the page-turning engine built into every book (works offline).
   The page curls from its corner: a diagonal fold, the back of the page showing, shadows along the crease.
   Calls used by the reader: loadFromHTML, flipNext, flipPrev, flip, getCurrentPageIndex,
   getPageCount, getOrientation, getBoundsRect, on, destroy. */
(function(){
  const CSS=`.bf-book{position:relative;touch-action:none;-webkit-user-select:none;user-select:none}
.bf-slot{position:absolute;top:0;height:100%;width:50%;overflow:hidden}
.bf-L{left:0}.bf-R{left:50%}
.bf-book.bf-portrait .bf-R{left:0;width:100%}.bf-book.bf-portrait .bf-L{display:none}
.bf-slot.bf-has{box-shadow:0 10px 28px rgba(0,0,0,.45)}
.bf-page{position:absolute!important;inset:0;width:100%!important;height:100%!important;display:block!important}
.bf-book{transition:transform var(--bf-slide,.7s) ease}
.bf-blank{background:linear-gradient(90deg,#e9dfc5,#f6efdd 40%,#efe5cc)}
.bf-flip{position:absolute;top:0;z-index:6;pointer-events:none;transform-origin:0 0}
.bf-flip>*{position:absolute;left:0;top:0}
.bf-fw,.bf-bw{overflow:visible;transform-origin:0 0}
.bf-bw{background:#efe6cf;box-shadow:0 0 18px rgba(0,0,0,.35)}
.bf-mir{position:absolute;inset:0;transform:scaleX(-1)}
.bf-paper{position:absolute;inset:0;background:linear-gradient(90deg,#efe5cc,#f6efdd 60%,#e9dfc5)}
.bf-sw{overflow:visible}
.bf-strip{position:absolute;transform-origin:50% 0}`;
  function addCSS(){if(document.getElementById('bf-css2'))return;const s=document.createElement('style');s.id='bf-css2';s.textContent=CSS;document.head.appendChild(s)}
  const NOFLIP='a,button,input,select,textarea,video,iframe,.vid,label';
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  // keep the part of a polygon on one side of a line (M, normal n)
  function clipHalf(poly,M,n,positive){const out=[];
    for(let i=0;i<poly.length;i++){const A=poly[i],B=poly[(i+1)%poly.length];
      const da=(A.x-M.x)*n.x+(A.y-M.y)*n.y, db=(B.x-M.x)*n.x+(B.y-M.y)*n.y;
      const inA=positive?da>=0:da<=0, inB=positive?db>=0:db<=0;
      if(inA)out.push(A);
      if(inA!==inB&&da!==db){const t=da/(da-db);out.push({x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t})}}
    return out}
  const poly=pts=>pts.length<3?'polygon(0 0,0 0,0 0)':'polygon('+pts.map(p=>p.x.toFixed(1)+'px '+p.y.toFixed(1)+'px').join(',')+')';

  class BookFlip{
    constructor(el,opts){
      this.el=el; this.o=Object.assign({width:600,height:712,flippingTime:1000,usePortrait:true,minWidth:300,drawShadow:true,maxShadowOpacity:.6,startPage:0},opts||{});
      this.h={}; this.pages=[]; this.s=0; this.anim=null; this.drag=null; this.busy=false; addCSS();
    }
    on(n,f){(this.h[n]=this.h[n]||[]).push(f);return this}
    emit(n,d){(this.h[n]||[]).forEach(f=>{try{f({data:d,object:this})}catch(e){}})}
    loadFromHTML(list){
      const el=this.el; this.pages=[...list];
      const w=el.clientWidth||this.o.width*2;
      this.portrait=!!this.o.usePortrait&&w<2*this.o.minWidth;
      this.pw=this.portrait?w:w/2; this.ph=this.pw*this.o.height/this.o.width;
      el.classList.add('bf-book'); el.classList.toggle('bf-portrait',this.portrait);
      el.style.height=this.ph+'px';
      this.pages.forEach(p=>{p.classList.add('bf-page');p.remove()});
      el.innerHTML='';
      this.L=document.createElement('div');this.L.className='bf-slot bf-L';
      this.R=document.createElement('div');this.R.className='bf-slot bf-R';
      el.append(this.L,this.R);
      // spreads: front cover alone, two-page spreads, then the back cover alone (a plain endpaper fills a gap, like a real book)
      const P=this.pages, n=P.length; this.S=[];
      if(this.portrait)P.forEach(p=>this.S.push({L:null,R:p}));
      else if(n){
        this.S.push({L:null,R:P[0]});
        for(let i=1;i<n-1;i+=2){let r=P[i+1];
          if(i+1>=n-1){r=document.createElement('div');r.className='page bf-page bf-blank';r.dataset.blank='1'}
          this.S.push({L:P[i],R:r})}
        if(n>1)this.S.push({L:P[n-1],R:null});
      }
      el.style.setProperty('--bf-slide',Math.max(.3,(this.o.flippingTime||1000)/1000*.7)+'s');
      this.s=this.spreadOf(Math.max(0,Math.min(this.o.startPage||0,this.pages.length-1)));
      this.render(this.s);
      this._down=e=>this.down(e); this._move=e=>this.move(e); this._up=e=>this.up(e);
      el.addEventListener('pointerdown',this._down);
      window.addEventListener('pointermove',this._move); window.addEventListener('pointerup',this._up); window.addEventListener('pointercancel',this._up);
    }
    spreadCount(){return this.S.length}
    spreadOf(i){const p=this.pages[i]; const k=this.S.findIndex(s=>s.L===p||s.R===p); return k<0?0:k}
    spread(s){return this.S[s]||{L:null,R:null}}
    // a closed book (only one cover showing) slides to the middle
    center(s){ if(this.portrait){this.el.style.transform='';return} const sp=this.spread(s);
      this.el.style.transform=!sp.L&&sp.R?`translateX(${-this.pw/2}px)`:sp.L&&!sp.R?`translateX(${this.pw/2}px)`:'translateX(0)' }
    getVisible(){const sp=this.spread(this.s); return [sp.L,sp.R].map(p=>p&&!p.dataset.blank?this.pages.indexOf(p):-1).filter(i=>i>=0)}
    render(s){const sp=this.spread(s); this.fill(this.L,sp.L); this.fill(this.R,sp.R); this.center(s)}
    fill(slot,page){slot.replaceChildren(); slot.classList.toggle('bf-has',!!page); if(page)slot.appendChild(page)}
    getCurrentPageIndex(){const v=this.getVisible(); return v.length?v[0]:0}
    getPageCount(){return this.pages.length}
    getOrientation(){return this.portrait?'portrait':'landscape'}
    getBoundsRect(){return {left:0,top:0,width:this.el.clientWidth,height:this.ph,pageWidth:this.pw}}
    update(){}
    flipNext(){this.flipTo(this.s+1)}
    flipPrev(){this.flipTo(this.s-1)}
    flip(i){this.flipTo(this.spreadOf(i))}
    turnToPage(i){if(this.busy)return;this.s=this.spreadOf(i);this.render(this.s);this.emit('flip',this.getCurrentPageIndex())}
    destroy(){const el=this.el; el.removeEventListener('pointerdown',this._down);
      window.removeEventListener('pointermove',this._move); window.removeEventListener('pointerup',this._up); window.removeEventListener('pointercancel',this._up);
      if(this.anim)cancelAnimationFrame(this.anim)}

    // ---- build the curling page ----
    // Everything is worked out in "flip space": the turning page spans x 0..W with the spine at x=0.
    setup(s2,top){
      if(this.busy||s2===this.s||s2<0||s2>=this.spreadCount())return false;
      const fwd=s2>this.s, A=this.spread(this.s), B=this.spread(s2);
      const W=this.pw, H=this.ph, sh=this.o.drawShadow!==false?this.o.maxShadowOpacity:0;
      const back=!fwd&&!this.portrait;             // turning a left page back to the right
      const pBack=!fwd&&this.portrait;             // one-page view, going back: the previous page curls back in
      let frontPage, backPage, mirror=back;
      if(this.portrait){
        if(fwd){frontPage=A.R; this.fill(this.R,B.R)} else {frontPage=B.R; this.fill(this.R,A.R)}
        backPage=null;
      }else if(fwd){frontPage=A.R; backPage=B.L; this.fill(this.L,A.L); this.fill(this.R,B.R)}
      else{frontPage=A.L; backPage=B.R; this.fill(this.L,B.L); this.fill(this.R,A.R)}
      const box=document.createElement('div'); box.className='bf-flip';
      box.style.cssText=`left:${this.portrait?0:W}px;width:${W}px;height:${H}px;${back?'transform:scaleX(-1)':''}`;
      const mk=(cls,w,h)=>{const d=document.createElement('div');d.className=cls;d.style.width=w+'px';d.style.height=h+'px';return d};
      const fw=mk('bf-fw',W,H), bw=mk('bf-bw',W,H), s1=mk('bf-sw',W,H), s2w=mk('bf-sw',W,H);
      const put=(wrap,page)=>{ if(!page)return; if(mirror){const m=document.createElement('div');m.className='bf-mir';m.appendChild(page);wrap.appendChild(m)} else wrap.appendChild(page) };
      if(frontPage)put(fw,frontPage);
      if(backPage)put(bw,backPage); else bw.appendChild(Object.assign(document.createElement('div'),{className:'bf-paper'}));
      if(!backPage&&!this.portrait)bw.style.background='transparent',bw.style.boxShadow='none';
      const L=3*(W+H);
      const st1=mk('bf-strip',L,10), st2=mk('bf-strip',L,10);
      st1.style.background='linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,0))';
      st2.style.background='linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,0))';
      s1.appendChild(st1); s2w.appendChild(st2);
      box.append(fw,s1,bw,s2w); this.el.appendChild(box);
      const Oy=top?0:H;
      this.t={s2,fwd,pBack,W,H,Oy,sh,box,fw,bw,s1,s2w,st1,st2,L,
        start:pBack?{x:-W,y:Oy}:{x:W,y:Oy}, end:pBack?{x:W,y:Oy}:{x:-W,y:Oy}};
      this.busy=true; this.emit('turn',s2); this.setP(this.t.start); this.center(s2); return true;
    }
    clamp(P){const t=this.t,W=t.W,H=t.H;
      const a1={x:0,y:t.Oy}, a2={x:0,y:H-t.Oy}, D=Math.hypot(W,H);
      let dx=P.x-a1.x, dy=P.y-a1.y, r=Math.hypot(dx,dy); if(r>W){P={x:a1.x+dx*W/r,y:a1.y+dy*W/r}}
      dx=P.x-a2.x; dy=P.y-a2.y; r=Math.hypot(dx,dy); if(r>D){P={x:a2.x+dx*D/r,y:a2.y+dy*D/r}}
      if(P.x>W)P.x=W; return P}
    setP(P){
      const t=this.t; if(!t)return; P=this.clamp(P); t.P=P;
      const W=t.W,H=t.H,O={x:W,y:t.Oy};
      const vx=O.x-P.x, vy=O.y-P.y, dist=Math.hypot(vx,vy);
      if(dist<0.5){t.fw.style.clipPath='none'; t.bw.style.visibility='hidden'; t.s1.style.visibility=t.s2w.style.visibility='hidden'; return}
      t.bw.style.visibility=t.s1.style.visibility=t.s2w.style.visibility='visible';
      const n={x:vx/dist,y:vy/dist}, M={x:(O.x+P.x)/2,y:(O.y+P.y)/2};
      const rect=[{x:0,y:0},{x:W,y:0},{x:W,y:H},{x:0,y:H}];
      const G=clipHalf(rect,M,n,false), F=clipHalf(rect,M,n,true);
      // reflect across the crease: the back of the page shows the next page the right way round
      const d={x:-n.y,y:n.x}, a=d.x*d.x-d.y*d.y, b=2*d.x*d.y;
      const ux=W-M.x, uy=-M.y, tx=M.x+a*ux+b*uy, ty=M.y+b*ux-a*uy;
      t.fw.style.clipPath=poly(G);
      t.bw.style.transform=`matrix(${-a},${-b},${b},${-a},${tx},${ty})`;
      t.bw.style.clipPath=poly(F.map(p=>({x:W-p.x,y:p.y})));
      const ref=X=>{const qx=X.x-M.x,qy=X.y-M.y;return {x:M.x+a*qx+b*qy,y:M.y+b*qx-a*qy}};
      // shadows along the crease: on the page underneath, and inside the fold
      const prog=Math.min(1,dist/(2*W)), k=t.sh*Math.min(1,dist/(W*0.2))*(1-prog*prog*0.8);
      const sz=Math.min(W*0.35,dist*0.45)+4, phi=Math.atan2(-n.x,n.y);
      for(const [st,wrap,clipPts,ang,op] of [[t.st1,t.s1,F,phi,k],[t.st2,t.s2w,F.map(ref),phi+Math.PI,k*0.8]]){
        wrap.style.clipPath=poly(clipPts);
        st.style.height=sz+'px'; st.style.left=(M.x-t.L/2)+'px'; st.style.top=M.y+'px';
        st.style.transform=`rotate(${ang}rad)`; st.style.opacity=op.toFixed(3);
      }
    }
    animateTo(target,done){
      const t=this.t, from={...t.P}, span=Math.hypot(target.x-from.x,target.y-from.y)/(2*t.W);
      const dur=Math.max(160,(this.o.flippingTime||1000)*Math.min(1,span)), t0=performance.now();
      const lift=t.Oy===0?1:-1, H=t.H;
      const step=now=>{const k=Math.min(1,(now-t0)/dur), e=ease(k);
        const arc=Math.sin(Math.PI*e)*H*0.12*Math.min(1,span*1.5);
        this.setP({x:from.x+(target.x-from.x)*e,y:from.y+(target.y-from.y)*e+lift*arc});
        if(k<1)this.anim=requestAnimationFrame(step); else {this.anim=null;done()}};
      this.anim=requestAnimationFrame(step);
    }
    finish(commit){
      const t=this.t; t.box.remove(); this.t=null; this.busy=false;
      if(!commit)this.center(this.s);
      if(commit)this.s=t.s2;
      this.render(this.s);
      if(commit)this.emit('flip',this.getCurrentPageIndex()); else this.emit('turncancel',this.s);
    }
    flipTo(s2,top){if(!this.setup(s2,top))return; this.animateTo(this.t.end,()=>this.finish(true))}
    // ---- mouse and touch ----
    down(e){
      if(e.button!==0||this.busy||e.target.closest(NOFLIP))return;
      const r=this.el.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
      const fwd=x>r.width/2, s2=this.s+(fwd?1:-1);
      if(s2<0||s2>=this.spreadCount())return;
      this.drag={x0:e.clientX,y0:e.clientY,fwd,s2,top:y<r.height/2,on:false,id:e.pointerId};
    }
    move(e){
      const d=this.drag; if(!d||e.pointerId!==d.id)return;
      if(!d.on){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<8)return; if(!this.setup(d.s2,d.top)){this.drag=null;return} d.on=true}
      e.preventDefault();
      const t=this.t, dx=e.clientX-d.x0, dy=e.clientY-d.y0;
      if(t.pBack){const p=Math.max(0,Math.min(1,dx/(t.W*1.4))); d.p=p; this.setP({x:t.start.x+(t.end.x-t.start.x)*p,y:t.Oy}); return}
      const fx=(d.fwd?dx:-dx)*1.15;           // turning a left page works in mirror image
      this.setP({x:t.start.x+fx,y:t.start.y+dy});
      d.p=(t.W-t.P.x)/(2*t.W);
    }
    up(e){
      const d=this.drag; if(!d||e.pointerId!==d.id)return; this.drag=null;
      if(d.on){const t=this.t; if((d.p||0)>0.22)this.animateTo(t.end,()=>this.finish(true)); else this.animateTo(t.start,()=>this.finish(false)); return}
      if(Math.abs(e.clientY-d.y0)<10)this.flipTo(d.s2,d.top);   // a click turns the page
    }
  }
  window.St={PageFlip:BookFlip};
})();
