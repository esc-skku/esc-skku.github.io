/* <esc-hero-scene>: interactive MBE + ARPES scene for the Home page.
   Self-contained custom element (shadow DOM) so the page template engine never touches its internals. */
(function(){
'use strict';
var TEMPLATE = '<style>'
+':host{display:block}*{box-sizing:border-box}'
+'.panel{background:#06120d;color:#e8f1e9;border-radius:16px;padding:20px 24px 16px;font-family:"IBM Plex Sans KR","IBM Plex Sans",system-ui,sans-serif;font-size:15px;line-height:1.6;display:flex;flex-direction:column;gap:11px}'
+'.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#a6e05a}'
+'h2{font-family:"Space Grotesk","IBM Plex Sans KR",sans-serif;font-weight:700;font-size:clamp(20px,2.3vw,28px);line-height:1.15;margin:3px 0 0;color:#e8f1e9}h2 span{color:#a6e05a}'
+'.lede{color:#86a393;font-size:13.5px;line-height:1.55;margin:0}'
+'.stage{background:#0a1c14;border:1px solid #1d3a2c;border-radius:12px;overflow:hidden}'
+'canvas{display:block;width:100%;height:auto;touch-action:manipulation}'
+'.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
+'button{font-family:inherit;font-size:13px;font-weight:600;color:#e8f1e9;background:transparent;border:1px solid #1d3a2c;border-radius:999px;padding:6px 14px;cursor:pointer;transition:border-color .15s,background .15s,color .15s}'
+'button:hover{border-color:#a6e05a}button:focus-visible{outline:2px solid #a6e05a;outline-offset:2px}button:disabled{opacity:.5;cursor:default}'
+'button[aria-pressed="true"]{background:#a6e05a;border-color:#a6e05a;color:#0b1d12}button.ghost{color:#86a393}'
+'.status{font-size:13px;min-height:1.6em;flex:1 1 240px}'
+'.readouts{display:flex;flex-wrap:wrap;gap:4px 26px;align-items:baseline;border-top:1px solid #1d3a2c;padding-top:9px}'
+'.ro{display:flex;align-items:baseline;gap:8px}.ro b{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:500;font-size:14px;color:#a6e05a;font-variant-numeric:tabular-nums}.ro span{font-size:12px;color:#86a393}'
+'.note{font-size:11px;color:#6f8c7d;margin:0}'
+'@media (max-width:600px){.panel{padding:18px 14px 16px;border-radius:12px}}'
+'</style>'
+'<div class="panel">'
+'<div><div class="eyebrow">Interactive · MBE + ARPES</div><h2>Grow it. Light it. <span>Read its electrons.</span></h2></div>'
+'<p class="lede">박막을 한 층 쌓을 때마다 전자가 갇히는 방식이 바뀌고, ARPES에 보이는 밴드 개수가 달라집니다. 광원을 X선으로 바꾸면 같은 분석기로 XPS를 잽니다. 장면 안의 박막, 광원, 분석기를 직접 눌러 보세요.</p>'
+'<div class="stage"><canvas id="cv" width="1100" height="600" role="img" aria-label="MBE 박막 성장과 ARPES 측정 장면. 아래 버튼으로도 조작할 수 있습니다."></canvas></div>'
+'<div class="controls"><button id="bGrow" type="button">박막 한 층 쌓기</button><button id="bLight" type="button" aria-pressed="true">빛 hν</button><button id="bSrc" type="button">광원: He 램프</button><button id="bMeas" type="button" aria-pressed="true">전자 측정</button><button id="bReset" type="button" class="ghost">처음부터</button><div class="status" id="status" aria-live="polite"></div></div>'
+'<div class="readouts"><div class="ro"><b id="rLayers">2 u.c.</b><span>박막 두께 (unit cell)</span></div><div class="ro"><b id="rBands">2</b><span>페르미 준위 아래 양자우물 밴드</span></div><div class="ro"><b id="rHv">21.2 eV</b><span id="rHvL">광자 에너지, He-Iα</span></div><div class="ro"><b id="rCounts">0</b><span>검출한 광전자 수</span></div></div>'
+'<p class="note">밴드와 XPS 스펙트럼은 단순한 모형으로 계산한 개념도입니다. 실제 측정 데이터가 아닙니다.</p>'
+'</div>';

function boot(root, host){

var cv=root.getElementById('cv'),ctx=cv.getContext('2d'),W=1100,H=600,S=1;
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var C={bg:'#0a1c14',line:'#1d3a2c',ink:'#e8f1e9',muted:'#86a393',lime:'#a6e05a',amber:'#ffb84d',cyan:'#58d1c2'};
var $=function(i){return root.getElementById(i)};

var st={layers:2,grow:-1,light:true,meas:true,t:0,counts:0,hover:null,src:'he',xcounts:0};
var atoms=[],elec=[],rheed=[],flashes=[];
var MAXL=6;

/* ---------- ARPES spectral model ---------- */
var GW=140,GH=120,grid=new Float32Array(GW*GH),gmax=1;
var EMIN=-1.25,EMAX=0.18;
var off=document.createElement('canvas');off.width=GW;off.height=GH;var octx=off.getContext('2d'),img=octx.createImageData(GW,GH);
function bottoms(N){var b=[];for(var n=1;n<=N;n++){var e=-0.62*Math.cos(n*Math.PI/(N+1))-0.45;if(e<-0.02)b.push(e)}return b}
var XB=230,XMIN=100,XMAX=560,xps=new Float32Array(XB),xmax=1;
var PEAKS=[{n:'O 1s',e:530.0,w:1.0,t:0},{n:'Ti 2p',e:458.6,w:0.62,t:1},{n:'Ti 2p',e:464.3,w:0.31,t:1,nl:1},{n:'Ru 3d',e:281.0,w:0.6,t:2},{n:'Ru 3d',e:285.2,w:0.4,t:2,nl:1},{n:'Sr 3d',e:133.4,w:0.9,t:0}];
function pkW(p){var a=Math.exp(-0.25*st.layers);return p.w*(p.t===1?a:(p.t===2?(1-a)*1.3:1))}
function gs(){return(Math.random()+Math.random()+Math.random()+Math.random()-2)*1.2}
function sampleX(){var tot=0,i;for(i=0;i<PEAKS.length;i++)tot+=pkW(PEAKS[i]);var r=Math.random()*tot;for(i=0;i<PEAKS.length;i++){r-=pkW(PEAKS[i]);if(r<=0)break}
  var p=PEAKS[Math.min(i,PEAKS.length-1)],be=p.e+gs()*2.6;if(Math.random()<0.3)be+=Math.random()*(XMAX-be);if(Math.random()<0.05)be=XMIN+Math.random()*(XMAX-XMIN);return be}
function addXps(m){for(var i=0;i<m;i++){var be=sampleX();if(be<XMIN||be>=XMAX)continue;var b=((be-XMIN)/(XMAX-XMIN)*XB)|0,v=++xps[b];if(v>xmax)xmax=v;st.xcounts++}}
function clearGrid(){grid.fill(0);gmax=1;st.counts=0;xps.fill(0);xmax=1;st.xcounts=0}
function sample(b){var k=Math.random()*2-1,E;
  if(Math.random()<0.1){E=EMIN+Math.random()*(-EMIN)}
  else{var n=(Math.random()*b.length)|0,e0=b[n]+1.15*k*k,g=0.022+0.09*Math.abs(e0);E=e0+g*Math.tan(Math.PI*(Math.random()-0.5)*0.92)}
  if(E<EMIN||E>EMAX)return null;if(Math.random()>1/(Math.exp(E/0.022)+1))return null;return{k:k,E:E}}
function addEvents(m){var b=bottoms(st.layers);if(!b.length)return;
  for(var i=0;i<m;i++){var s=sample(b);if(!s)continue;
    var gx=((s.k+1)/2*(GW-1))|0,gy=((EMAX-s.E)/(EMAX-EMIN)*(GH-1))|0,v=++grid[gy*GW+gx];if(v>gmax)gmax=v;st.counts++}}
function pgeo(){var p=PANEL;return{ix:p.x+44,iy:p.y+34,iw:p.w-62,ih:p.h-74}}
var stops=[[0,6,14,24],[0.3,12,56,120],[0.62,40,132,222],[0.86,150,212,255],[1,245,250,255]];
function cmap(v){for(var i=1;i<stops.length;i++){if(v<=stops[i][0]){var a=stops[i-1],b=stops[i],f=(v-a[0])/(b[0]-a[0]);
  return[a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f,a[3]+(b[3]-a[3])*f]}}return stops[4].slice(1)}
function paintGrid(){var d=img.data,inv=1/Math.max(gmax,6);for(var i=0;i<grid.length;i++){var c=cmap(Math.pow(Math.min(1,grid[i]*inv),0.55)),j=i*4;d[j]=c[0];d[j+1]=c[1];d[j+2]=c[2];d[j+3]=255}
  octx.putImageData(img,0,0)}

/* ---------- geometry ---------- */
var FX=520,FBASE=452,FW=250,FSK=58,FD=44,LT=30,SUBT=26;
function topY(n){return FBASE-SUBT-n*LT}
function spot(){var n=st.layers+(st.grow>=0?st.grow:0);return{x:FX+10,y:topY(n)-FD/2}}
var SURF=336,AIM={x:FX+10,y:SURF-FD/2};
var CELLS=[{x:150,y:170,c:C.cyan},{x:236,y:118,c:C.lime}];
var LAMP={x:392,y:64},XRAY={x:566,y:76};
var AN={cx:765,cy:161,r:58},ATH=Math.PI/4,ACS=Math.cos(ATH),ASN=Math.sin(ATH);
function A2W(lx,ly){return{x:AN.cx+lx*ACS-ly*ASN,y:AN.cy+lx*ASN+ly*ACS}}
var PANEL={x:806,y:268,w:262,h:286};
var RH={x:36,y:432,w:196,h:112};

function quad(x,y,w,sk,d){ctx.beginPath();ctx.moveTo(x-w/2+sk/2,y-d);ctx.lineTo(x+w/2+sk/2,y-d);ctx.lineTo(x+w/2-sk/2,y);ctx.lineTo(x-w/2-sk/2,y);ctx.closePath()}
function slab(yTop,th,top,front,side,a){ctx.globalAlpha=a;
  ctx.fillStyle=front;ctx.beginPath();ctx.moveTo(FX-FW/2-FSK/2,yTop);ctx.lineTo(FX+FW/2-FSK/2,yTop);ctx.lineTo(FX+FW/2-FSK/2,yTop+th);ctx.lineTo(FX-FW/2-FSK/2,yTop+th);ctx.closePath();ctx.fill();
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(FX+FW/2-FSK/2,yTop);ctx.lineTo(FX+FW/2+FSK/2,yTop-FD);ctx.lineTo(FX+FW/2+FSK/2,yTop-FD+th);ctx.lineTo(FX+FW/2-FSK/2,yTop+th);ctx.closePath();ctx.fill();
  ctx.fillStyle=top;quad(FX,yTop,FW,FSK,FD);ctx.fill();ctx.globalAlpha=1}
function glow(x,y,r,col,a){var g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=a;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.globalAlpha=1}
function label(t,x,y,col,al,size,mono){if(S<0.62)return;var wt=(mono?'500 ':'600 '),fam=(mono?'"IBM Plex Mono",monospace':'"Space Grotesk","IBM Plex Sans KR",sans-serif'),sz=size||13,m=t.match(/^(.*?)_\{(.+?)\}(.*)$/);
  ctx.fillStyle=col||C.muted;ctx.font=wt+sz+'px '+fam;
  if(!m){ctx.textAlign=al||'left';ctx.fillText(t,x,y);return}
  var ss=Math.round(sz*0.7),w1=ctx.measureText(m[1]).width,w3=ctx.measureText(m[3]).width;ctx.font=wt+ss+'px '+fam;var w2=ctx.measureText(m[2]).width,tot=w1+w2+w3,x0=al==='right'?x-tot:(al==='center'?x-tot/2:x);
  ctx.textAlign='left';ctx.fillText(m[2],x0+w1+1,y+sz*0.3);ctx.font=wt+sz+'px '+fam;ctx.fillText(m[1],x0,y);ctx.fillText(m[3],x0+w1+w2+1,y)}
function ball(x,y,r,col){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
  var g=ctx.createRadialGradient(x-r*0.35,y-r*0.4,r*0.08,x,y,r);g.addColorStop(0,'rgba(255,255,255,0.95)');g.addColorStop(0.4,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,0.5)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}
function tri(x1,y1,x2,y2,x3,y3,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill()}
function star(x,y,r,a){if(a<=0||r<=0)return;ctx.globalAlpha=a;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.moveTo(x-r,y);ctx.quadraticCurveTo(x,y,x,y-r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.quadraticCurveTo(x,y,x,y+r);ctx.quadraticCurveTo(x,y,x-r,y);ctx.fill();ctx.globalAlpha=1}
function steelH(x,w){var g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#1a2620');g.addColorStop(0.2,'#6f847a');g.addColorStop(0.45,'#c9d6ce');g.addColorStop(0.7,'#5a6e64');g.addColorStop(1,'#121b17');return g}
function block(x,yTop,w,sk,d,th,top,front,side,a){ctx.globalAlpha=a;
  ctx.fillStyle=front;ctx.fillRect(x-w/2-sk/2,yTop,w,th);
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(x+w/2-sk/2,yTop);ctx.lineTo(x+w/2+sk/2,yTop-d);ctx.lineTo(x+w/2+sk/2,yTop-d+th);ctx.lineTo(x+w/2-sk/2,yTop+th);ctx.closePath();ctx.fill();
  ctx.fillStyle=top;quad(x,yTop,w,sk,d);ctx.fill();ctx.globalAlpha=1}
function atomsOnTop(y,frac){var cols=7,rows=4,n=0,show=Math.round(frac*cols*rows);
  for(var r=rows-1;r>=0;r--)for(var c=0;c<cols;c++){if(n++>=show)return;var u=c/(cols-1),v=r/(rows-1);
    var x=FX-FW/2-FSK/2+u*FW+v*FSK,yy=y-v*FD,rad=5.4-v*1.3;ctx.globalAlpha=0.55+0.45*(1-v);ball(x,yy,rad,'#9fe36a');ctx.globalAlpha=1}}
function octaRow(yTop,th,ox,oy,a,frac,kind){var n=6,cw=FW/n,x0=FX-FW/2-FSK/2+ox,show=Math.ceil(frac*n);
  var P=kind===2?['#97a59d','#6f7c75','#4f5b55','#3b4540','#b9c4bd','#86938c']:(kind?['#8ff0e4','#42bdb1','#1f8379','#145a52','#ff7566','#9fe36a']:['#b4f29a','#66c764','#2f8f3e','#1d612a','#ff7566','#9fe36a']);
  for(var i=0;i<show;i++){var cx=x0+cw*(i+0.5),cy=yTop+oy+th/2,w=cw*0.5,h=th*0.5,zc=cy+3;ctx.globalAlpha=a;
    tri(cx,cy-h,cx-w,cy,cx,zc,P[1]);tri(cx,cy-h,cx+w,cy,cx,zc,P[0]);tri(cx,cy+h,cx-w,cy,cx,zc,P[3]);tri(cx,cy+h,cx+w,cy,cx,zc,P[2]);
    ctx.strokeStyle='rgba(240,255,248,0.6)';ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(cx,cy-h);ctx.lineTo(cx+w,cy);ctx.lineTo(cx,cy+h);ctx.lineTo(cx-w,cy);ctx.closePath();ctx.moveTo(cx-w,cy);ctx.lineTo(cx,zc);ctx.lineTo(cx+w,cy);ctx.moveTo(cx,cy-h);ctx.lineTo(cx,cy+h);ctx.stroke();
    ball(cx,cy-h,2.2,P[4]);ball(cx,cy+h,2.2,P[4]);ball(cx-w,cy,2.2,P[4]);ball(cx+w,cy,2.2,P[4]);ball(cx,zc,1.9,P[4])}
  if(kind!==2)for(var j=0;j<=Math.min(show,n);j++){ctx.globalAlpha=a;ball(x0+cw*j,yTop+oy+th,5,P[5])}
  ctx.globalAlpha=1}
function filmLayer(i,a,frac){var y=topY(i+1),odd=i%2;
  slab(y,LT,odd?'rgba(70,190,178,0.26)':'rgba(110,200,110,0.26)',odd?'rgba(16,78,72,0.62)':'rgba(24,84,36,0.62)',odd?'rgba(12,58,54,0.7)':'rgba(18,62,26,0.7)',a);
  octaRow(y,LT,FSK*0.66,-FD*0.66,a*0.22,frac,odd);octaRow(y,LT,FSK*0.33,-FD*0.33,a*0.45,frac,odd);octaRow(y,LT,0,0,a,frac,odd);
  ctx.globalAlpha=a*0.55;ctx.strokeStyle='rgba(225,255,238,0.7)';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(FX-FW/2-FSK/2,y);ctx.lineTo(FX+FW/2-FSK/2,y);ctx.lineTo(FX+FW/2+FSK/2,y-FD);ctx.stroke();ctx.globalAlpha=1}

function drawSource(P,name,sel,on,sp,c1,c2,hov,wl){var tipx=P.x,tipy=P.y+18,dx=sp.x-tipx,dy=sp.y-tipy,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  if(st.hover===hov){ctx.strokeStyle=C.amber;ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(P.x,P.y,40,0,7);ctx.stroke();ctx.setLineDash([])}
  ctx.save();ctx.globalAlpha=sel?1:0.42;ctx.translate(tipx,tipy);ctx.rotate(Math.atan2(AIM.y-tipy,AIM.x-tipx));
  var tg=ctx.createLinearGradient(0,-13,0,13);tg.addColorStop(0,'#26362f');tg.addColorStop(0.28,'#c6d4cb');tg.addColorStop(0.55,'#5d7168');tg.addColorStop(1,'#121c17');ctx.fillStyle=tg;
  ctx.beginPath();ctx.roundRect(-84,-13,70,26,4);ctx.fill();ctx.beginPath();ctx.moveTo(-14,-13);ctx.lineTo(0,-4.5);ctx.lineTo(0,4.5);ctx.lineTo(-14,13);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(8,14,11,0.7)';ctx.fillRect(-64,-13,3,26);ctx.fillRect(-36,-13,3,26);ctx.restore();
  if(on){ctx.save();ctx.globalCompositeOperation='lighter';
    [[34,0.045],[18,0.08],[8,0.14],[2.5,0.4]].forEach(function(b){var g2=ctx.createLinearGradient(tipx,tipy,sp.x,sp.y);g2.addColorStop(0,'rgba('+c1+','+b[1]+')');g2.addColorStop(1,'rgba('+c2+','+Math.min(1,b[1]*1.7)+')');ctx.fillStyle=g2;
      ctx.beginPath();ctx.moveTo(tipx-uy*2,tipy+ux*2);ctx.lineTo(sp.x-uy*b[0],sp.y+ux*b[0]);ctx.lineTo(sp.x+uy*b[0],sp.y-ux*b[0]);ctx.lineTo(tipx+uy*2,tipy-ux*2);ctx.closePath();ctx.fill()});
    for(var wp=0;wp<3;wp++){var c0=((st.t*0.5+wp/3)%1)*L,first=true;ctx.beginPath();ctx.lineWidth=1.8;ctx.strokeStyle='rgba('+c2+',0.98)';
      for(var s=-36;s<=36;s+=(wl<1.2?0.35:1.5)){var pos=c0+s;if(pos<6||pos>L-6)continue;var amp=(wl<1.2?5:7)*Math.exp(-s*s/280)*Math.sin(s/wl),qx=tipx+ux*pos-uy*amp,qy=tipy+uy*pos+ux*amp;if(first){ctx.moveTo(qx,qy);first=false}else ctx.lineTo(qx,qy)}ctx.stroke()}
    glow(tipx,tipy,24,'rgba('+c1+',0.95)',0.85);
    glow(sp.x,sp.y,50+6*Math.sin(st.t*7),'rgba('+c2+',0.95)',0.75);glow(sp.x,sp.y,15,'rgba(255,255,255,1)',0.9);
    for(var k2=0;k2<8;k2++){var rr2=20+28*((Math.sin(k2*12.9)+1)/2),a2=k2*2.4+st.t*0.25,tw=Math.max(0,Math.sin(st.t*3.1+k2*1.7));star(sp.x+Math.cos(a2)*rr2*1.6,sp.y+Math.sin(a2)*rr2*0.55,2+7*tw,tw)}
    star(sp.x,sp.y,18+5*Math.sin(st.t*9),0.95);
    ctx.restore()}
  if(sel)label('hν',tipx+ux*L*0.42+18,tipy+uy*L*0.42-6,C.amber,'left',17);
  label(name,P.x+30,P.y-14,sel?C.ink:C.muted,'left',12,true)}

/* ---------- draw ---------- */
function draw(){
  FBASE=SURF+SUBT+(st.layers+(st.grow>=0?st.grow:0))*LT;
  ctx.setTransform(S,0,0,S,0,0);ctx.clearRect(0,0,W,H);
  var bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0c2218');bg.addColorStop(1,'#07140e');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(166,224,90,0.07)';for(var gx=30;gx<W;gx+=40)for(var gy=30;gy<H;gy+=40)ctx.fillRect(gx,gy,1.5,1.5);
  glow(FX,360,330,'rgba(18,90,60,0.9)',0.5);
  var vg=ctx.createRadialGradient(W/2,H*0.55,H*0.3,W/2,H*0.55,W*0.62);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.6)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);

  /* MBE cells */
  var sp=spot(),growing=st.grow>=0;
  CELLS.forEach(function(c){var ang=Math.atan2(AIM.y-c.y,AIM.x-c.x);
    if(growing){ctx.save();ctx.globalCompositeOperation='lighter';var gr=ctx.createLinearGradient(c.x,c.y,sp.x,sp.y);gr.addColorStop(0,c.c);gr.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=0.2;ctx.fillStyle=gr;
      ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(sp.x-80,sp.y+30);ctx.lineTo(sp.x+100,sp.y-22);ctx.closePath();ctx.fill();ctx.restore()}
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(ang);
    var mg=ctx.createLinearGradient(0,-17,0,17);mg.addColorStop(0,'#26362f');mg.addColorStop(0.28,'#bccbc2');mg.addColorStop(0.55,'#5d7168');mg.addColorStop(1,'#121c17');
    ctx.fillStyle=mg;ctx.beginPath();ctx.roundRect(-72,-17,72,34,5);ctx.fill();ctx.fillStyle='rgba(8,14,11,0.7)';ctx.fillRect(-54,-17,3,34);ctx.fillRect(-30,-17,3,34);
    ctx.fillStyle='#16241e';ctx.beginPath();ctx.ellipse(0,0,6,17,0,0,7);ctx.fill();
    var hot=ctx.createRadialGradient(0,0,0,0,0,13);hot.addColorStop(0,growing?'#fff3c8':'#ffb36b');hot.addColorStop(0.5,growing?'#ff9a3c':'#a8481a');hot.addColorStop(1,'rgba(120,40,10,0)');
    ctx.fillStyle=hot;ctx.beginPath();ctx.ellipse(0,0,4.5,13,0,0,7);ctx.fill();ctx.restore();
    if(growing)glow(c.x,c.y,32,'rgba(255,170,80,0.9)',0.5)});
  label('Oxide MBE',70,72,C.ink,'left',17);label('effusion cells',70,92,C.muted,'left',12,true);

  /* film */
  if(st.hover==='film'){ctx.strokeStyle=C.lime;ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.strokeRect(FX-FW/2-FSK/2-14,topY(st.layers)-FD-22,FW+FSK+28,(st.layers*LT)+SUBT+FD+36);ctx.setLineDash([])}
  ctx.fillStyle='rgba(0,0,0,0.45)';ctx.beginPath();ctx.ellipse(FX+12,FBASE+44,236,24,0,0,7);ctx.fill();
  block(FX-4,FBASE+12,FW+72,FSK+16,FD+12,16,'#8fa39a',steelH(FX-210,420),'#1b2621',1);
  slab(FBASE-SUBT,SUBT,'#3a4b43','#1f2b26','#18211d',1);octaRow(FBASE-SUBT,SUBT,0,0,0.7,1,2);
  for(var i=0;i<st.layers;i++)filmLayer(i,1,1);
  if(growing){filmLayer(st.layers,Math.min(1,st.grow*1.3),st.grow);atomsOnTop(topY(st.layers+1),st.grow)}
  else atomsOnTop(topY(st.layers),1);
  label('Substrate',FX-FW/2-FSK/2-56,FBASE+9,C.muted,'right',12,true);
  label('Thin film',FX+FW/2+FSK/2+14,topY(st.layers)-6,C.ink,'left',15);label(st.layers+' unit cell'+(st.layers>1?'s':''),FX+FW/2+FSK/2+14,topY(st.layers)+13,C.lime,'left',12,true);

  /* falling atoms */
  atoms.forEach(function(a){glow(a.x,a.y,10,a.c,0.35);ball(a.x,a.y,3.8,a.c)});

  /* RHEED */
  ctx.strokeStyle=C.line;ctx.lineWidth=1;ctx.strokeRect(RH.x,RH.y,RH.w,RH.h);label('RHEED intensity',RH.x+10,RH.y+20,C.muted,'left',12,true);
  ctx.beginPath();ctx.strokeStyle=C.lime;ctx.lineWidth=2;var n=rheed.length,x0=RH.x+10,ww=RH.w-20;
  for(var j=0;j<n;j++){var px=x0+ww*j/Math.max(239,n-1),py=RH.y+RH.h-14-rheed[j]*(RH.h-48);j?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();
  if(n){var lx=x0+ww*(n-1)/Math.max(239,n-1),ly=RH.y+RH.h-14-rheed[n-1]*(RH.h-48);glow(lx,ly,10,C.lime,0.7)}

  /* photon sources: He lamp (ARPES) and X-ray (XPS) */
  var lit=st.light;
  drawSource(LAMP,'He lamp',st.src==='he',lit&&st.src==='he',sp,'255,140,50','255,176,96','light',3.2);
  drawSource(XRAY,'X-ray source',st.src==='xray',lit&&st.src==='xray',sp,'236,244,255','255,255,255','xray',0.7);

  /* analyzer (whole assembly tilted 45 degrees so the lens axis points at the sample) */
  var on=st.meas,R=AN.r+27;
  if(st.hover==='meas'){ctx.strokeStyle=C.lime;ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(AN.cx,AN.cy,R+18,0,7);ctx.stroke();ctx.setLineDash([])}
  var cab0=A2W(AN.r,66),cab1={x:PANEL.x+46,y:PANEL.y+2};
  ctx.lineCap='round';ctx.strokeStyle='#0b1410';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(cab0.x,cab0.y);ctx.bezierCurveTo(cab0.x-30,cab0.y+34,cab1.x,cab1.y-50,cab1.x,cab1.y);ctx.stroke();
  ctx.strokeStyle='#3d5247';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cab0.x,cab0.y);ctx.bezierCurveTo(cab0.x-30,cab0.y+34,cab1.x,cab1.y-50,cab1.x,cab1.y);ctx.stroke();ctx.lineCap='butt';
  ctx.save();ctx.translate(AN.cx,AN.cy);ctx.rotate(ATH);
  var lx0=-AN.r;ctx.fillStyle=steelH(lx0-19,38);ctx.beginPath();ctx.roundRect(lx0-19,2,38,66,4);ctx.fill();
  ctx.fillStyle=steelH(lx0-13,26);ctx.beginPath();ctx.roundRect(lx0-13,66,26,40,3);ctx.fill();
  ctx.beginPath();ctx.moveTo(lx0-13,106);ctx.lineTo(lx0+13,106);ctx.lineTo(lx0+5.5,134);ctx.lineTo(lx0-5.5,134);ctx.closePath();ctx.fill();
  ctx.fillStyle='#2a3a33';ctx.fillRect(lx0-22,62,44,6);ctx.fillRect(lx0-16,102,32,5);ctx.fillStyle='rgba(8,14,11,0.55)';ctx.fillRect(lx0-19,24,38,2);ctx.fillRect(lx0-19,42,38,2);
  var dx0=AN.r-25;ctx.fillStyle=steelH(dx0,50);ctx.beginPath();ctx.roundRect(dx0,2,50,66,4);ctx.fill();
  ctx.fillStyle='rgba(8,14,11,0.55)';for(var fy=18;fy<62;fy+=9)ctx.fillRect(dx0+4,fy,42,2);
  var dg=ctx.createRadialGradient(-R*0.1,-R*0.72,R*0.06,0,0,R*1.02);dg.addColorStop(0,'#f1f7f3');dg.addColorStop(0.18,'#b3c2b9');dg.addColorStop(0.55,'#5a6e64');dg.addColorStop(1,'#141e19');
  ctx.fillStyle=dg;ctx.beginPath();ctx.arc(0,0,R,Math.PI,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(10,18,14,0.55)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,R-7,Math.PI,0);ctx.stroke();
  ctx.strokeStyle='rgba(5,12,9,0.9)';ctx.lineWidth=27;ctx.beginPath();ctx.arc(0,0,AN.r,Math.PI,0);ctx.stroke();
  ctx.strokeStyle='rgba(205,228,216,0.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,AN.r+13.5,Math.PI,0);ctx.stroke();ctx.beginPath();ctx.arc(0,0,AN.r-13.5,Math.PI,0);ctx.stroke();
  ctx.strokeStyle=on?'rgba(111,182,255,0.4)':'rgba(120,150,135,0.18)';[-9,0,9].forEach(function(o){ctx.beginPath();ctx.arc(0,0,AN.r+o,Math.PI,0);ctx.stroke()});
  var ig=ctx.createRadialGradient(-4,-24,2,0,0,AN.r-14);ig.addColorStop(0,'#dfe9e3');ig.addColorStop(0.5,'#6f847a');ig.addColorStop(1,'#1a2620');ctx.fillStyle=ig;ctx.beginPath();ctx.arc(0,0,AN.r-14,Math.PI,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=steelH(-R-12,2*R+24);ctx.beginPath();ctx.roundRect(-R-12,-3,2*R+24,15,3);ctx.fill();
  for(var bz=0;bz<=10;bz++)ball(-R+bz*(2*R/10),4.5,2.3,'#b8c6be');
  ctx.restore();
  var ltip=A2W(-AN.r,134),lt1=A2W(-AN.r-6,134),lt2=A2W(-AN.r+6,134);
  if(st.light&&st.grow<0){ctx.fillStyle=on?'rgba(111,182,255,0.13)':'rgba(232,241,233,0.05)';ctx.beginPath();ctx.moveTo(sp.x,sp.y);ctx.lineTo(lt1.x,lt1.y);ctx.lineTo(lt2.x,lt2.y);ctx.closePath();ctx.fill()}ctx.setLineDash([5,6]);ctx.strokeStyle='rgba(232,241,233,0.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sp.x,sp.y);ctx.lineTo(ltip.x,ltip.y);ctx.stroke();ctx.setLineDash([]);
  label('Hemispherical analyzer',AN.cx+36,AN.cy-R-22,C.ink,'center',15);
  var lp=A2W(-AN.r+30,100);label('lens',lp.x,lp.y,C.muted,'left',12,true);
  var dp=A2W(AN.r+46,-4);label('detector',dp.x,dp.y,C.muted,'left',12,true);

  /* ARPES panel */
  var p=PANEL,ix=p.x+44,iy=p.y+34,iw=p.w-62,ih=p.h-74;
  ctx.fillStyle='#07140e';ctx.strokeStyle=on?C.lime:C.line;ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,10);ctx.fill();ctx.stroke();
  if(st.src==='xray'){
    ctx.fillStyle='#06101c';ctx.fillRect(ix,iy,iw,ih);
    var base=iy+ih-6,ptop=iy+20,xinv=1/Math.max(xmax,8),b;
    ctx.beginPath();ctx.moveTo(ix,base);for(b=XB-1;b>=0;b--)ctx.lineTo(ix+(XB-1-b)/(XB-1)*iw,base-(base-ptop)*Math.min(1,xps[b]*xinv));ctx.lineTo(ix+iw,base);ctx.closePath();
    var xg=ctx.createLinearGradient(0,ptop,0,base);xg.addColorStop(0,'rgba(120,190,255,0.55)');xg.addColorStop(1,'rgba(40,110,220,0.05)');ctx.fillStyle=xg;ctx.fill();
    ctx.beginPath();for(b=XB-1;b>=0;b--){var x3=ix+(XB-1-b)/(XB-1)*iw,y3=base-(base-ptop)*Math.min(1,xps[b]*xinv);if(b===XB-1)ctx.moveTo(x3,y3);else ctx.lineTo(x3,y3)}ctx.strokeStyle='#9fd0ff';ctx.lineWidth=1.4;ctx.stroke();
    ctx.strokeStyle='#3c6a52';ctx.lineWidth=1;ctx.strokeRect(ix,iy,iw,ih);
    if(st.xcounts>600)PEAKS.forEach(function(pk){if(pk.nl||pkW(pk)<0.1)return;var bi=((pk.e-XMIN)/(XMAX-XMIN)*XB)|0,px2=ix+(XMAX-pk.e)/(XMAX-XMIN)*iw,py2=base-(base-ptop)*Math.min(1,xps[bi]*xinv);label(pk.n,Math.max(ix+18,px2),Math.max(iy+13,py2-7),C.ink,'center',11,true)});
    [500,400,300,200].forEach(function(t){var tx=ix+(XMAX-t)/(XMAX-XMIN)*iw;ctx.fillStyle='#3c6a52';ctx.fillRect(tx,iy+ih,1,4);label(String(t),tx,iy+ih+15,C.muted,'center',10,true)});
    label('XPS',p.x+14,p.y+22,C.ink,'left',15);label('Binding energy (eV)',ix+iw/2,iy+ih+31,C.muted,'center',11,true);
    if(!st.xcounts)label(st.light?'분석기를 켜세요':'빛을 켜세요',ix+iw/2,iy+ih/2,C.muted,'center',14);
  }else{
  paintGrid();ctx.imageSmoothingEnabled=true;ctx.drawImage(off,ix,iy,iw,ih);
  var yEF=iy+ih*(EMAX/(EMAX-EMIN));ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(232,241,233,0.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ix,yEF);ctx.lineTo(ix+iw,yEF);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#3c6a52';ctx.strokeRect(ix,iy,iw,ih);
  label('ARPES',p.x+14,p.y+22,C.ink,'left',15);label('E_{F}',ix-8,yEF+5,C.ink,'right',15);label('E',ix-8,iy+13,C.ink,'right',15);label('k_{∥}',ix+iw/2,iy+ih+24,C.ink,'center',15);
  if(!st.counts)label(st.light?'분석기를 켜세요':'빛을 켜세요',ix+iw/2,iy+ih/2,C.muted,'center',14);
  }
  flashes.forEach(function(f){glow(f.x,f.y,11,'rgba(150,205,255,0.95)',f.a)});
  elec.forEach(function(e){glow(e.x,e.y,11,'rgba(80,160,255,0.95)',e.a*0.85);ctx.globalAlpha=e.a;ctx.fillStyle='#9fd0ff';ctx.beginPath();ctx.arc(e.x,e.y,2.8,0,7);ctx.fill();ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(e.x-0.8,e.y-0.8,1,0,7);ctx.fill();ctx.globalAlpha=1});
}

/* ---------- step ---------- */
function ePos(e){var sp=e.s,u=e.u,kk=e.k,rr=AN.r+kk*9;
  if(u<0.42){var ent=A2W(-rr,8),f=u/0.42,dx=ent.x-sp.x,dy=ent.y-sp.y,L=Math.hypot(dx,dy),bow=kk*26*Math.sin(Math.PI*f)*(1-f*0.6);return{x:sp.x+dx*f-dy/L*bow,y:sp.y+dy*f+dx/L*bow}}
  if(u<0.47){return A2W(-rr,8-(u-0.42)/0.05*8)}
  if(u<0.8){var a=Math.PI+(u-0.47)/0.33*Math.PI;return A2W(rr*Math.cos(a),rr*Math.sin(a))}
  if(u<0.87){return A2W(rr,(u-0.8)/0.07*60)}
  var g=pgeo(),f2=Math.min(1,(u-0.87)/0.13),p1=A2W(rr,60),x2=g.ix+e.fx*g.iw,y2=g.iy+e.fy*g.ih,s2=f2*f2*(3-2*f2);
  return{x:p1.x+(x2-p1.x)*s2,y:p1.y+(y2-p1.y)*s2}}
var last=0;
function step(now){var dt=Math.min(0.05,(now-last)/1000||0.016);last=now;st.t+=dt;
  if(st.grow>=0){st.grow+=dt/2.4;var sp=spot();
    if(Math.random()<0.9)for(var i=0;i<2;i++){var c=CELLS[(Math.random()*2)|0];atoms.push({x:c.x,y:c.y,sx:c.x,sy:c.y,tx:sp.x-110+Math.random()*230,ty:sp.y-18+Math.random()*36,u:0,c:c.c})}
    rheed.push(0.5+0.45*Math.cos(2*Math.PI*st.grow)*(1-0.15*st.grow));
    if(st.grow>=1){st.grow=-1;st.layers++;atoms.length=0;clearGrid();if(st.lightWas)st.light=true;st.lightWas=false;sync();say(st.layers+'층 완성. 두께가 바뀌면 밴드 개수도 바뀝니다.')}}
  else if(rheed.length&&rheed.length<240&&Math.random()<0.5)rheed.push(rheed[rheed.length-1]);
  if(rheed.length>240)rheed.splice(0,rheed.length-240);
  for(var j=atoms.length-1;j>=0;j--){var a=atoms[j];a.u+=dt*1.9;if(a.u>=1){atoms.splice(j,1);continue}a.x=a.sx+(a.tx-a.sx)*a.u;a.y=a.sy+(a.ty-a.sy)*a.u*a.u}
  if(st.light&&st.grow<0){var s0=spot();
    if(st.meas){if(st.src==='xray'){var be=sampleX();if(be>=XMIN&&be<XMAX)elec.push({s:s0,u:0,a:1,x:s0.x,y:s0.y,m:1,v:2,k:Math.random()*2-1,fx:(XMAX-be)/(XMAX-XMIN),fy:0.9});addXps(110)}
      else{var sm=sample(bottoms(st.layers));if(sm)elec.push({s:s0,u:0,a:1,x:s0.x,y:s0.y,m:1,k:sm.k,fx:(sm.k+1)/2,fy:(EMAX-sm.E)/(EMAX-EMIN)});addEvents(140)}}
    for(var ne=0;ne<2;ne++)if(Math.random()<0.55){var an=-Math.PI*(0.05+0.9*Math.random());if(Math.abs(an+Math.PI/4)<0.15)continue;var xr=st.src==='xray',sp0=(190+90*Math.random())*(xr?2:1);elec.push({f:xr?1.7:1.05,s:s0,u:0,a:0.9,x:s0.x,y:s0.y,m:0,vx:Math.cos(an)*sp0,vy:Math.sin(an)*sp0})}}
  for(var k=elec.length-1;k>=0;k--){var e=elec[k];
    if(e.m){e.u+=dt*0.8*(e.v||1);if(e.u>=1){e.u=1;var qe=ePos(e);flashes.push({x:qe.x,y:qe.y,a:1});elec.splice(k,1);continue}var q=ePos(e);e.x=q.x;e.y=q.y}
    else{e.x+=e.vx*dt;e.y+=e.vy*dt;e.a-=dt*(e.f||1.05);if(e.a<=0)elec.splice(k,1)}}
  for(var fi=flashes.length-1;fi>=0;fi--){flashes[fi].a-=dt*2.4;if(flashes[fi].a<=0)flashes.splice(fi,1)}
  $('rCounts').textContent=(st.src==='xray'?st.xcounts:st.counts).toLocaleString('en-US');
  draw();if(host._alive)requestAnimationFrame(step);else running=false}

/* ---------- actions ---------- */
function say(t){$('status').textContent=t}
function setSrc(s){if(st.src===s){light();return}st.src=s;elec.length=0;if(st.grow>=0)st.lightWas=true;else st.light=true;sync();
  say(s==='xray'?'X선(Al Kα)으로 바꿨습니다. 같은 분석기로 내각 준위를 재는 XPS입니다. 층을 쌓으면 Ru 피크가 커지고 Ti 피크가 줄어듭니다.':'He 램프로 바꿨습니다. 페르미 준위 근처의 밴드를 보는 ARPES입니다.')}
function sync(){$('bSrc').textContent='광원: '+(st.src==='he'?'He 램프':'X선');$('rHv').textContent=st.src==='he'?'21.2 eV':'1486.6 eV';$('rHvL').textContent='광자 에너지, '+(st.src==='he'?'He-Iα':'Al Kα');$('rLayers').textContent=st.layers+' u.c.';$('rBands').textContent=bottoms(st.layers).length;
  $('bLight').setAttribute('aria-pressed',st.light);$('bMeas').setAttribute('aria-pressed',st.meas);
  $('bGrow').textContent=st.layers>=MAXL?'최대 두께 도달':'박막 한 층 쌓기';$('bGrow').disabled=st.layers>=MAXL}
function grow(){if(st.grow>=0)return;if(st.layers>=MAXL){say('최대 '+MAXL+'층입니다. 처음부터를 눌러 다시 시작하세요.');return}
  if(RM){st.layers++;clearGrid();if(st.light&&st.meas)addEvents(60000);sync();say(st.layers+'층 완성.');return}
  st.grow=0;st.lightWas=st.light;st.light=false;sync();elec.length=0;say('MBE로 한 층을 쌓는 중입니다. 성장하는 동안에는 빛을 끕니다.')}
function light(){if(st.grow>=0){st.lightWas=!st.lightWas;say(st.lightWas?'성장이 끝나면 빛을 켭니다.':'성장이 끝나도 빛을 켜지 않습니다.');return}st.light=!st.light;if(!st.light)elec.length=0;sync();say(st.light?'빛이 박막 표면에서 전자를 떼어 냅니다.':'빛을 껐습니다. 전자가 나오지 않습니다.')}
function meas(){st.meas=!st.meas;elec.length=0;sync();say(st.meas?'사방으로 나오는 전자 중 렌즈 쪽으로 오는 것만 받아 밴드를 그립니다.':'분석기를 껐습니다. 전자는 계속 사방으로 나옵니다.')}
function reset(){st.src='he';st.layers=1;st.grow=-1;st.light=true;st.meas=true;atoms.length=0;elec.length=0;rheed.length=0;clearGrid();if(RM)addEvents(60000);sync();say('한 층짜리 박막에서 다시 시작합니다.')}
var introT=[];function cancelIntro(){introT.forEach(clearTimeout);introT=[]}
function user(fn){return function(){cancelIntro();fn()}}
$('bGrow').addEventListener('click',user(grow));$('bLight').addEventListener('click',user(light));$('bMeas').addEventListener('click',user(meas));$('bReset').addEventListener('click',user(reset));$('bSrc').addEventListener('click',user(function(){setSrc(st.src==='he'?'xray':'he')}));

function hit(ev){var r=cv.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*W,y=(ev.clientY-r.top)/r.height*H;
  if(Math.hypot(x-XRAY.x,y-XRAY.y)<38)return'xray';if(Math.hypot(x-LAMP.x,y-LAMP.y)<40)return'light';
  var sp=spot(),dx=sp.x-LAMP.x,dy=sp.y-LAMP.y-18,L2=dx*dx+dy*dy,t=((x-LAMP.x)*dx+(y-LAMP.y-18)*dy)/L2;
  if(t>0&&t<0.8&&Math.hypot(x-(LAMP.x+dx*t),y-(LAMP.y+18+dy*t))<20)return'light';
  if(x>FX-FW/2-FSK/2-14&&x<FX+FW/2+FSK/2+14&&y>topY(st.layers)-FD-22&&y<FBASE+14)return'film';
  if(x>CELLS[0].x-70&&x<CELLS[1].x+20&&y>CELLS[1].y-40&&y<CELLS[0].y+40)return'film';
  if(Math.hypot(x-AN.cx,y-AN.cy)<AN.r+48)return'meas';var lm=A2W(-AN.r,70);if(Math.hypot(x-lm.x,y-lm.y)<60)return'meas';
  if(x>PANEL.x&&x<PANEL.x+PANEL.w&&y>PANEL.y&&y<PANEL.y+PANEL.h)return'meas';
  return null}
cv.addEventListener('mousemove',function(e){st.hover=hit(e);cv.style.cursor=st.hover?'pointer':'default'});
cv.addEventListener('mouseleave',function(){st.hover=null});
cv.addEventListener('click',function(e){var h=hit(e);if(!h)return;cancelIntro();if(h==='film')grow();else if(h==='light')setSrc('he');else if(h==='xray')setSrc('xray');else meas()});

function fit(){var w=cv.clientWidth||W,dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(w*dpr);cv.height=Math.round(w*H/W*dpr);S=cv.width/W;draw()}
window.addEventListener('resize',fit);
if(RM){addEvents(60000);sync();say('지금은 2층 박막을 측정 중입니다. 박막을 눌러 한 층 더 쌓아 보세요.')}
else{st.layers=1;st.light=false;st.meas=false;sync();say('기판 위 한 층짜리 박막에서 시작합니다.');
  introT.push(setTimeout(function(){grow()},800));
  introT.push(setTimeout(function(){st.light=true;sync();say('빛이 박막 표면에서 전자를 떼어 냅니다.')},3900));
  introT.push(setTimeout(function(){st.meas=true;sync();say('사방으로 나오는 전자 중 렌즈 쪽으로 오는 것만 받아 밴드를 그립니다. 이제 직접 눌러 보세요.')},5600))}
fit();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
var running=false;
host._start=function(){fit();if(RM||running)return;running=true;last=0;requestAnimationFrame(step)};
if(RM){setInterval(function(){if(!host._alive)return;$('rCounts').textContent=(st.src==='xray'?st.xcounts:st.counts).toLocaleString('en-US');draw()},400)}
if(window.ResizeObserver)new ResizeObserver(fit).observe(cv.parentNode);
host._start();
}

class EscHeroScene extends HTMLElement {
  connectedCallback(){
    this._alive = true;
    if (!this.shadowRoot) { var root = this.attachShadow({mode:'open'}); root.innerHTML = TEMPLATE; boot(root, this); }
    else if (this._start) this._start();
  }
  disconnectedCallback(){ this._alive = false; }
}
if (!customElements.get('esc-hero-scene')) customElements.define('esc-hero-scene', EscHeroScene);
})();
