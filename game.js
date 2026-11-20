/* Wolkenhüpfer — standalone Canvas platformer, no build step required. */
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s);
const W=1100,H=520,G=440;
const themes=[
 {name:'Sonnenwiese',icon:'🌼',sky:'#c3eaf2',hill:'#a7d9a4',grass:'#86bd65',ground:'#dbb684',accent:'#f6cf69'},
 {name:'Pilzwald',icon:'🍄',sky:'#cbdedb',hill:'#88b7a0',grass:'#63a77c',ground:'#ba9d7e',accent:'#ed938c'},
 {name:'Wolkeninseln',icon:'☁️',sky:'#c7e1f7',hill:'#b4c8e6',grass:'#b4b5e4',ground:'#e1d7ee',accent:'#c7a0e4'},
 {name:'Wüstenzauber',icon:'🌵',sky:'#f8dfb3',hill:'#edbf7e',grass:'#d9aa63',ground:'#e9c58c',accent:'#e99365'},
 {name:'Sternental',icon:'⭐',sky:'#333c70',hill:'#515087',grass:'#8d86c4',ground:'#6a618e',accent:'#ffe29a'},
 {name:'Frostfunkeln',icon:'❄️',sky:'#d2edf7',hill:'#a5cbdc',grass:'#f2fbff',ground:'#80b9d5',accent:'#72cfee',kind:'ice'},
 {name:'Korallenküste',icon:'🐚',sky:'#b9e9ed',hill:'#69bfca',grass:'#f3dda1',ground:'#dfb879',accent:'#f5a4ac',kind:'coast'},
 {name:'Kristallhöhle',icon:'💎',sky:'#242743',hill:'#36385e',grass:'#83d0d3',ground:'#514a71',accent:'#96f2e5',kind:'crystal'},
 {name:'Glut-Unterwelt',icon:'🌋',sky:'#16121e',hill:'#302333',grass:'#a95844',ground:'#43303d',accent:'#ffba64',kind:'underworld'},
 {name:'Himmelsreich',icon:'🌈',sky:'#a8dafa',hill:'#d9edfc',grass:'#ffffff',ground:'#dae9fa',accent:'#ffce75',kind:'heaven'}
];
// Body, outline, highlight: keep hazards readable against each world's ground.
const spikePalettes=[
 ['#759c57','#354d34','#dceba8'],['#c46c87','#663c60','#f8c4cf'],
 ['#9a94d7','#515783','#e6e7ff'],['#b98149','#6b482e','#ffe0a0'],
 ['#a893da','#534378','#ffe6b0'],['#8dcfe8','#376e97','#edfcff'],
 ['#df8593','#79475d','#ffd8bb'],['#78d5cd','#385b81','#d7fff0'],
 ['#f08049','#6d3342','#ffdb89'],['#bba8e6','#64548e','#fff0be']
];
let level=0,lives=5,score=0,mode='ready',camera=0,world,time=0,last=0,accumulator=0,audioOn=false,audioContext;
let player,checkpoint=60,invulnerable=0,jumpBuffer=0,coyote=0,toastTimer=0;
let shield=false,jumpBoost=0;
let hazardTime=0;
let deathAnimation=null,resumeMode='playing';
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const powerTypes={shield:{icon:'◆',color:'#64bfd8',name:'Schutzschild'},jump:{icon:'↑',color:'#af8ae4',name:'Sprungboost'},life:{icon:'♥',color:'#ed8b94',name:'Extra-Leben'}};
const keys=new Set();
function tone(freq,duration=.1){if(!audioOn)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.06,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);}catch{}}
function makeEnding(n,x,type){
 const top=(dx,height,w,h=height)=>({x:x+dx,y:G-height,w,h,type,role:'route'});
 let kind,pieces,surfaces;
 if(n===5){
  kind='Eisgrat';surfaces=[top(0,64,90),top(180,136,90),top(360,208,90),top(540,136,90),top(720,64,90)];pieces=[...surfaces];
 }else if(n===6){
  kind='Korallenbögen';surfaces=[top(0,72,90),top(180,144,130,24),top(420,216,100,24),top(650,128,140,24)];
  pieces=[...surfaces,top(286,144,24),top(458,192,24),top(766,128,24)];
 }else if(n===7){
  // The second sketch: two facing L ledges with a broad, solid T between them.
  kind='Kristall-L-T-L';
  surfaces=[top(150,132,130,24),top(400,202,140,24),top(660,128,150,24),top(786,208,24,80)];
  pieces=[...surfaces,top(150,260,24,128),top(455,178,30)];
 }else if(n===8){
  kind='Basalttreppe';surfaces=[top(0,72,90),top(180,152,90),top(360,232,90),top(540,152,90),top(720,72,90)];pieces=[...surfaces];
 }else{
  kind='Wolkenkrone';surfaces=[top(0,80,120,24),top(220,160,100,24),top(440,240,110,24),top(680,160,120,24)];
  pieces=[...surfaces,top(478,216,34)];
 }
 // Every high landing has its own return ladder on the right: ground -> 64 -> 136.
 // These are one-way footholds, so a player can jump up through them after a fall.
 const recoveries=[];
 for(const surface of surfaces){
  const height=G-surface.y;
  if(height<=118)continue;
  const next=surfaces.find(s=>s.x>=surface.x+surface.w&&s!==surface);
  const recoveryX=surface.x+surface.w+10;
  if(next&&next.x<recoveryX+70)continue;
  for(const h of height>190?[64,136]:[64])recoveries.push({x:recoveryX,y:G-h,w:70,h:16,baseY:G-h,recovery:true,forSurface:surface});
 }
 // The right upright in the cave is reached from the L shelf, and has an outer ladder.
 return {kind,pieces,surfaces,recoveries};
}
function makeLevel(n){
 const kind=themes[n].kind,skyWorld=kind==='heaven';
 const segments=5+n,stride=520;
 let length=1200+segments*stride;
 const holes=[],platforms=[],enemies=[],stars=[],spikes=[],obstacles=[],jumpRoutes=[];
 for(let i=0;i<5+n;i++){
  const x=520+i*stride;
  const hasHole=i%3===1||n===2||(skyWorld&&i%2===0)||(kind==='coast'&&i%3===2);
  const gapWidth=skyWorld?125:Math.min(135,85+n*8);
  if(hasHole)holes.push({x:x+100,w:gapWidth});
  const baseY=skyWorld||kind==='ice'?355:355-(i%2)*55;
  platforms.push({x,y:baseY,w:125+(n===2||skyWorld?25:0),h:22,moving:n>=2&&i%3===2,baseY,phase:i});
  if(skyWorld)platforms.push({x:x+110,y:320,w:100,h:22,baseY:320});
  if(i%2===0)platforms.push({x:x+170,y:280,w:95,h:22,baseY:280});
  const patrolMin=x+Math.max(190,hasHole?100+gapWidth+8:190);
  enemies.push({x:patrolMin+15,y:G-30,w:34,h:30,min:patrolMin,max:Math.min(x+325,length-170),dir:i%2?1:-1,speed:45+Math.min(n,6)*9,alive:true});
  if(n>=1&&i%3===0&&(!skyWorld||i%2===1))spikes.push({x:x+335,y:G-30,w:48,h:30});
  stars.push({x:x+45,y:baseY-34,taken:false});
  stars.push({x:x+200,y:235,taken:false});
 }
 // Dedicated clear stretches keep each mandatory jump away from enemies and pits.
 const obstacleType=['none','mushroom','cloud','sandstone','moonstone','ice','coral','crystal','lava','cloudgate'][n];
 if(n>0)obstacles.push({x:400,y:G-36,w:42,h:36,type:obstacleType});
 for(let i=0;n>0&&i<=n;i++){
  const segment=n===0?1:Math.floor(i*(segments-1)/n);
  const layers=n>=4?2+i%2:n>=2?1+i%2:1;
  const h=layers===1?44:layers*30,w=44+Math.min(n,6)*3;
  obstacles.push({x:520+segment*stride+415,y:G-h,w,h,type:obstacleType,layers});
 }
 if(n>=5){
  const route=makeEnding(n,length-500,obstacleType);
  obstacles.push(...route.pieces);
  platforms.push(...route.recoveries.filter((p,i,list)=>list.findIndex(q=>q.x===p.x&&q.y===p.y)===i));
  jumpRoutes.push(route);
  for(const p of route.surfaces)stars.push({x:p.x+p.w/2,y:p.y-25,taken:false});
  length+=1100;
 }
 for(const o of obstacles)stars.push({x:o.x+o.w/2,y:o.y-26,taken:false});
 for(let x=180;x<length-130;x+=230){if(!holes.some(h=>x>h.x-20&&x<h.x+h.w+20))stars.push({x,y:390,taken:false});}
 for(const s of stars){const o=obstacles.find(o=>s.x>o.x-12&&s.x<o.x+o.w+12);if(o)s.y=Math.min(s.y,o.y-26);}
 const powerups=['shield','jump','life'].map((type,i)=>{
  let x=[330,950,2200][i];
  while(holes.some(h=>x>h.x-35&&x<h.x+h.w+35)||spikes.some(s=>x>s.x-45&&x<s.x+s.w+45)||obstacles.some(o=>x>o.x-35&&x<o.x+o.w+35))x+=50;
  return {type,x,y:G-25,taken:false};
 });
 return {length,holes,platforms,enemies,stars,spikes,obstacles,jumpRoutes,powerups,flag:length-110};
}
function spawn(){player={x:checkpoint,y:330,w:30,h:42,vx:0,vy:0,grounded:false,face:1};camera=Math.max(0,checkpoint-230);invulnerable=1.7;coyote=0;jumpBuffer=0;}
function loadLevel(){deathAnimation=null;world=makeLevel(level);checkpoint=60;spawn();updateHud();}
function updateHud(){ $('#level-number').textContent=String(level+1).padStart(2,'0');$('#world-label').textContent=`WELT ${level+1} VON ${themes.length}`;$('#level-name').textContent=themes[level].name;$('#lives').textContent=lives>5?'♥ × '+lives:'♥ '.repeat(lives)+'♡ '.repeat(Math.max(0,5-lives));$('#lives').setAttribute('aria-label',`${lives} Leben`);$('#score').textContent=score;$('#worlds').innerHTML=themes.map((t,i)=>`<div class="world ${i===level?'active':i<level?'done':''}"><span class="world-icon">${i<level?'✓':t.icon}</span><div><small>WELT ${String(i+1).padStart(2,'0')}</small><strong>${t.name}</strong></div></div>`).join('');}
function overlay(label,title,text,button,hint=''){ $('#overlay-label').textContent=label;$('#overlay-title').textContent=title;$('#overlay-text').textContent=text;$('#start').textContent=button;$('#overlay-hint').textContent=hint;$('#overlay').classList.remove('hidden');}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=2;}
function loseLife(falling=false){
 if(mode!=='playing'||invulnerable>0)return;
 if(shield&&!falling){shield=false;invulnerable=1.7;tone(330,.2);toast('◆ Dein Schild hat den Treffer abgefangen!');return;}
 shield=false;jumpBoost=0;lives--;updateHud();keys.clear();jumpBuffer=0;
 deathAnimation={elapsed:0,duration:reducedMotion?.matches ? .45 : 1,p:{...player,y:Math.min(player.y,H-85),vx:0,grounded:false}};
 mode='dying';tone(660,.18);toast('✦ Ein kleiner Sternenwirbel …');
}
function finishDeath(){
 deathAnimation=null;
 if(lives<=0){mode='gameover';overlay('NOCH EIN ABENTEUER?','Jeder Sprung macht dich besser.',`Du hast ${score} Sterne gesammelt und Welt ${level+1} erreicht. Versuche es noch einmal!`,'Neu starten · Enter ↻');}
 else{spawn();mode='playing';toast('Weiter geht’s! Du schaffst das.');}
}
function startAction(){if(mode==='ready'||mode==='gameover'||mode==='won'){level=0;lives=5;score=0;shield=false;jumpBoost=0;loadLevel();}else if(mode==='leveldone'){level++;loadLevel();}mode=mode==='paused'?resumeMode:'playing';last=performance.now();accumulator=0;$('#overlay').classList.add('hidden');canvas.focus();}
$('#start').onclick=startAction;
function pause(){if(mode==='playing'||mode==='dying'){resumeMode=mode;mode='paused';keys.clear();overlay('KLEINE VERSCHNAUFPAUSE','Dein Abenteuer wartet.', 'Bereit für den nächsten großen Sprung?','Weiterspielen ➜');}else if(mode==='paused')startAction();$('#pause').textContent=mode==='paused'?'▶':'Ⅱ';}
$('#pause').onclick=pause;
let expanded=false;
function setExpanded(value){
 expanded=value;
 document.body.classList.toggle('game-expanded',expanded);
 $('#fullscreen').setAttribute('aria-pressed',String(expanded));
 $('#fullscreen').setAttribute('aria-label',expanded?'Vollbild verlassen':'Vollbild einschalten');
 $('#fullscreen').title=expanded?'Vollbild verlassen (Esc oder F)':'Vollbild (F)';
 $('#fullscreen').textContent=expanded?'⊡':'⛶';
 keys.clear();canvas.focus();
}
$('#fullscreen').onclick=()=>setExpanded(!expanded);
$('#sound').onclick=()=>{audioOn=!audioOn;$('#sound').textContent=audioOn?'♫ Ton an':'♫ Ton aus';$('#sound').setAttribute('aria-label',audioOn?'Ton ausschalten':'Ton einschalten');tone(660);};
function queueJump(){if(mode==='playing')jumpBuffer=.14;}
function handleKeyDown(e){
 if(e.code==='Escape'&&expanded){e.preventDefault();setExpanded(false);return;}
 if(e.code==='KeyF'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
  e.preventDefault();if(!e.repeat)setExpanded(!expanded);return;
 }
 if((e.code==='Enter'||e.code==='NumpadEnter')&&['ready','leveldone','gameover'].includes(mode)){
  e.preventDefault();if(!e.repeat)startAction();return;
 }
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)&&!['INPUT','BUTTON'].includes(document.activeElement.tagName))e.preventDefault();if(e.code==='KeyP'&&!e.repeat)pause();if((e.code==='Space'||e.code==='ArrowUp')&&!e.repeat&&document.activeElement.tagName!=='BUTTON'&&document.activeElement.tagName!=='INPUT')queueJump();keys.add(e.code);
}
window.addEventListener('keydown',handleKeyDown);
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(mode==='playing'||mode==='dying')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='playing'||mode==='dying'))pause();});
for(const [id,key] of [['left','ArrowLeft'],['right','ArrowRight'],['jump','Space']]){
 const b=$('#'+id),pointers=new Set();
 // Suppress native long-press selection, callouts and repeated-tap gestures only here.
 for(const event of ['contextmenu','selectstart','dragstart','touchstart']){
  b.addEventListener(event,e=>e.preventDefault(),{passive:false});
 }
 b.addEventListener('pointerdown',e=>{
  e.preventDefault();b.setPointerCapture(e.pointerId);pointers.add(e.pointerId);
  keys.add(key);if(key==='Space')queueJump();
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{
  pointers.delete(e.pointerId);if(!pointers.size)keys.delete(key);
 });
}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function obstacleParts(o){
 if(o.layers>1)return Array.from({length:o.layers},(_,i)=>obstacleParts({...o,layers:1,y:o.y+i*o.h/o.layers,h:o.h/o.layers})).flat();
 if(o.type==='mushroom')return [
  {x:o.x,y:o.y,w:o.w,h:o.h*.48},
  {x:o.x+o.w*.3,y:o.y+o.h*.48,w:o.w*.4,h:o.h*.52}
 ];
 return [o];
}
// Feet can still rest on an edge until both feet have left the solid ground.
function hasGroundSupport(p){
 let start=0;
 for(const hole of [...world.holes,{x:world.length,w:0}]){
  if(p.x+5<hole.x&&p.x+p.w-5>start)return true;
  start=hole.x+hole.w;
 }
 return false;
}
function playerHitbox(){return {x:player.x+5,y:player.y+5,w:player.w-10,h:player.h-5};}
function spikeTriangles(s,at=hazardTime){
 const width=s.w/3;
 const travel=Math.min(16,s.h*.55);
 return Array.from({length:3},(_,i)=>{
  const offset=reducedMotion?.matches?0:travel*(.5+.5*Math.sin(at*2.4+(i===1?Math.PI:0)));
  return {left:s.x+i*width,center:s.x+(i+.5)*width,right:s.x+(i+1)*width,top:s.y+offset,bottom:s.y+s.h};
 });
}
function touchesSpikes(p,s){
 // Test the actual triangular tips, not the empty corners of their bounding box.
 for(const tip of spikeTriangles(s)){
  const bottom=Math.min(p.y+p.h,tip.bottom);
  if(bottom<=tip.top||p.y>=tip.bottom)continue;
  const halfWidth=(tip.right-tip.left)/2*(bottom-tip.top)/(tip.bottom-tip.top);
  if(p.x<tip.center+halfWidth&&p.x+p.w>tip.center-halfWidth)return true;
 }
 return false;
}
function collectPowerup(p){
 p.taken=true;tone(990,.2);
 if(p.type==='shield'){shield=true;toast('◆ Schutzschild! Fängt einen Gegner- oder Stacheltreffer ab.');}
 if(p.type==='jump'){jumpBoost=15;toast('↑ Sprungboost! 15 Sekunden höher springen.');}
 if(p.type==='life'){lives++;toast('♥ Ein zusätzliches Leben!');updateHud();}
}
function update(dt){
 time+=dt;
 if(mode==='dying'){deathAnimation.elapsed+=dt;if(deathAnimation.elapsed>=deathAnimation.duration)finishDeath();return;}
 if(mode!=='playing')return;
 hazardTime+=dt;
 jumpBoost=Math.max(0,jumpBoost-dt);
 invulnerable=Math.max(0,invulnerable-dt);jumpBuffer=Math.max(0,jumpBuffer-dt);coyote=player.grounded?.11:Math.max(0,coyote-dt);
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('show');}
 const direction=keys.has('ArrowLeft')?-1:keys.has('ArrowRight')?1:$('#autorun').checked?1:0;
 if(themes[level].kind==='ice'){
  // A short glide on ice, with stronger steering in the air for fair jumps.
  const target=direction*245;
  const reversing=direction!==0&&player.vx*direction<0;
  const acceleration=direction===0?650:player.grounded?(reversing?850:1100):2000;
  const change=acceleration*dt;
  player.vx+=Math.max(-change,Math.min(change,target-player.vx));
 }else player.vx=direction*245;
 if(direction)player.face=direction;
 if(jumpBuffer>0&&coyote>0){player.vy=jumpBoost>0?-770:-625;player.grounded=false;coyote=0;jumpBuffer=0;tone(440,.12);}
 const oldY=player.y;player.vy+=1650*dt;player.x=Math.max(0,Math.min(world.length-player.w,player.x+player.vx*dt));
 for(const o of world.obstacles.flatMap(obstacleParts))if(overlaps(player,o)){
  if(player.vx>0)player.x=o.x-player.w;
  else if(player.vx<0)player.x=o.x+o.w;
  player.vx=0;
 }
 player.y+=player.vy*dt;player.grounded=false;
 for(const o of world.obstacles.flatMap(obstacleParts)){
  if(player.x+player.w<=o.x||player.x>=o.x+o.w)continue;
  if(player.vy>=0&&oldY+player.h<=o.y+.01&&player.y+player.h>=o.y){player.y=o.y-player.h;player.vy=0;player.grounded=true;}
  else if(player.vy<0&&oldY>=o.y+o.h&&player.y<o.y+o.h){player.y=o.y+o.h;player.vy=0;}
 }
 for(const p of world.platforms){const previous=p.y;p.y=p.baseY+(p.moving?Math.sin(time*1.6+p.phase)*35:0);if(player.vy>=0&&player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=previous+3&&player.y+player.h>=p.y){player.y=p.y-player.h;player.vy=0;player.grounded=true;}}
 const overHole=!hasGroundSupport(player);
 if(!overHole&&player.vy>=0&&oldY+player.h<=G+2&&player.y+player.h>=G){player.y=G-player.h;player.vy=0;player.grounded=true;}
 if(player.y>H+80||(themes[level].kind==='underworld'&&overHole&&player.y+player.h>H-27)){invulnerable=0;loseLife(true);return;}
 for(const p of world.powerups)if(!p.taken&&overlaps(playerHitbox(),{x:p.x-14,y:p.y-14,w:28,h:28}))collectPowerup(p);
 for(const e of world.enemies){
  if(!e.alive)continue;
  e.x+=e.dir*e.speed*dt;
  if(e.x<e.min||e.x>e.max){e.x=Math.max(e.min,Math.min(e.max,e.x));e.dir*=-1;}
  const hitbox=playerHitbox();
  const enemyBox={x:e.x+3,y:e.y+2,w:e.w-6,h:e.h-2};
  const stomp=player.vy>0&&oldY+player.h<=enemyBox.y+4&&player.y+player.h>=enemyBox.y&&hitbox.x<enemyBox.x+enemyBox.w&&hitbox.x+hitbox.w>enemyBox.x;
  if(stomp){e.alive=false;player.y=enemyBox.y-player.h;player.vy=-410;player.grounded=false;score+=3;tone(280);updateHud();}
  else if(overlaps(hitbox,enemyBox)&&invulnerable<=0){loseLife();return;}
 }
 for(const s of world.spikes)if(touchesSpikes(playerHitbox(),s)&&invulnerable<=0){loseLife();return;}
 for(const s of world.stars)if(!s.taken&&Math.hypot(player.x+15-s.x,player.y+21-s.y)<31){s.taken=true;score++;tone(880,.09);updateHud();}
 if(player.x>1750&&checkpoint<1700&&player.grounded&&!overHole&&!world.obstacles.some(o=>player.x+player.w>o.x-40&&player.x<o.x+o.w+40)&&!world.spikes.some(s=>Math.abs(s.x-player.x)<100)){checkpoint=player.x;toast('✦ Checkpoint erreicht!');}
 camera=Math.max(0,Math.min(world.length-W,player.x-270));
 if(player.x>=world.flag){tone(1046,.3);if(level===themes.length-1){mode='won';overlay('DU HAST ES GESCHAFFT!','Zehn Welten. Ein echter Held!',`Fantastisch! Du hast ${score} Sterne gesammelt und noch ${lives} Leben übrig.`,'Noch einmal spielen ↻');}else{mode='leveldone';overlay('WELT GESCHAFFT!',`Hallo, ${themes[level+1].name}!`,`Großartig! ${score} Sterne sind schon in deiner Tasche. Das nächste Abenteuer wartet.`,'Nächste Welt · Enter ➜',`${lives} Leben reisen mit dir weiter · Mit Enter bestätigen`);}}
}
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function cloud(x,y,s){ellipse(x,y,45*s,15*s,'#ffffffb3');ellipse(x-18*s,y-10*s,23*s,23*s,'#ffffffb3');ellipse(x+12*s,y-16*s,28*s,28*s,'#ffffffb3');}
function star(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rad=i%2?r*.46:r;ctx.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad);}ctx.closePath();ctx.fill();}
function drawSpikes(s){
 const phase=reducedMotion?.matches?0:hazardTime;
 const glow=.5+.5*Math.sin(phase*2+s.x*.01);
 const [body,outline,highlight]=spikePalettes[level];
 ctx.save();
 ellipse(s.x+s.w/2,s.y+s.h-2,s.w/2+9+glow*3,10+glow*2,body+'33');
 round(s.x-3,s.y+s.h,s.w+6,7,3,outline);
 ctx.save();ctx.beginPath();ctx.rect(s.x-1,s.y+s.h+1,s.w+2,5);ctx.clip();
 ctx.strokeStyle=highlight;ctx.lineWidth=5;
 for(let x=s.x-6;x<s.x+s.w+12;x+=12){ctx.beginPath();ctx.moveTo(x,s.y+s.h+7);ctx.lineTo(x+7,s.y+s.h);ctx.stroke();}
 ctx.restore();
 for(const tip of spikeTriangles(s)){
  ctx.beginPath();ctx.moveTo(tip.left,tip.bottom);ctx.lineTo(tip.center,tip.top);ctx.lineTo(tip.right,tip.bottom);ctx.closePath();
  ctx.fillStyle=body;ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
  // Rendering and hit detection share the same moving triangular silhouette.
  ctx.save();ctx.clip();
  ctx.fillStyle=highlight;ctx.beginPath();ctx.moveTo(tip.left+2,tip.bottom);ctx.lineTo(tip.center,tip.top+3);ctx.lineTo(tip.center,tip.bottom);ctx.fill();
  const shineY=tip.top+((phase*.45+s.x*.003)%1)*(tip.bottom-tip.top+14)-7;
  ctx.fillStyle=highlight+'aa';ctx.fillRect(tip.left,shineY,tip.right-tip.left,3);ctx.restore();
 }
 ctx.restore();
}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y])=>ctx.lineTo(x,y));ctx.closePath();ctx.fill();}
function drawUnderworld(){
 const clock=reducedMotion?.matches?0:hazardTime;
 // Layered rock walls and a continuous ceiling make this an enclosed cavern.
 for(let i=-1;i<10;i++){
  const x=i*170-camera*.12;
  polygon([[x,0],[x+170,0],[x+180,390],[x+125,362],[x+102,194],[x+45,170],[x+10,420]],'#241c2b');
  polygon([[x+20,180],[x+70,100],[x+135,150],[x+120,330],[x+65,370],[x+30,290]],'#322434');
 }
 round(0,0,W,45,0,'#100f18');
 for(let i=-1;i<14;i++){
  const x=i*100-camera*.22,depth=70+((i+14)%4)*20;
  polygon([[x,25],[x+108,25],[x+100,57],[x+65,depth],[x+38,60],[x+8,85]],'#1d1723');
  polygon([[x+18,45],[x+45,58],[x+32,depth+24]],'#3c2c3d');
  polygon([[x+74,42],[x+90,42],[x+82,depth-5]],'#59404a');
 }
 // Glowing lava river deep behind the playable rock ledges.
 round(0,390,W,50,0,'#6e302e');
 for(let i=0;i<28;i++){
  const x=(i*75-camera*.15+W*8)%W;
  ellipse(x,414+(i%3)*9,26,2,'#ef864844');
 }
 for(let i=0;i<5;i++){
  const x=i*310+80-camera*.25;
  ellipse(x,390,75,100,'#ef6c2510');
  polygon([[x-6,190],[x+5,193],[x+11,400],[x-8,400]],'#a64b35');
  polygon([[x-2,196],[x+2,198],[x+5,400],[x-3,400]],'#ffb459');
  ellipse(x,400,21+Math.sin(clock*1.5+i)*2,4,'#f99b4e');
 }
 for(let i=0;i<30;i++){
  const drift=clock*16;
  ellipse((i*157-camera*.1+W*8)%W,430-((i*41+drift)%310),1.5+(i%2),2.5,'#ffc78a88');
 }
}
function drawThemeBackdrop(t){
 if(t.kind==='underworld'){drawUnderworld();return;}
 const cave=t.kind==='crystal'||t.kind==='underworld';
 if(cave){
  for(let i=-1;i<12;i++){
   const x=i*120-camera*.18;
   polygon([[x,0],[x+100,0],[x+55,60+(i+12)%4*23]],t.hill);
   polygon([[x,440],[x+65,225+(i+12)%3*40],[x+130,440]],t.hill);
  }
  if(t.kind==='underworld')for(let i=0;i<18;i++){
   const drift=reducedMotion?.matches?0:hazardTime*15;
   ellipse((i*157-camera*.1+W*5)%W,420-((i*41+drift)%330),2,3,'#ffc78a99');
  }
 }else{
  ellipse(920-camera*.04,83,36,36,level===4?'#ffedb3':'#fff2b1');
  for(let i=0;i<7;i++)cloud(i*260+50-camera*.16,75+(i%3)*38,.6+(i%2)*.35);
  if(t.kind==='heaven'){
   ctx.save();ctx.lineWidth=9;
   ['#f3a7b3','#f9ca87','#f7e5a3','#a4d6b5','#b3b4e8'].forEach((c,i)=>{
    ctx.strokeStyle=c;ctx.beginPath();ctx.arc(700-camera*.08,300,170-i*10,Math.PI,Math.PI*2);ctx.stroke();
   });ctx.restore();
  }
  if(t.kind==='ice')for(let i=-1;i<8;i++){
   const x=i*230-camera*.2;
   polygon([[x,440],[x+115,160+(i+8)%3*30],[x+230,440]],t.hill);
   polygon([[x+83,238+(i+8)%3*30],[x+115,160+(i+8)%3*30],[x+147,238+(i+8)%3*30]],'#f1fbff');
  }
 }
 if(t.kind==='coast'){
  round(0,330,W,110,0,'#53b9c9');
  for(let i=0;i<25;i++)round((i*90-camera*.25+W*8)%W,355+(i%3)*23,35,3,2,'#d8fafb80');
 }
}
function drawThemeScenery(t,x,i){
 if(t.kind==='ice'){
  round(x,350,9,90,3,'#8eafc7');
  for(let j=0;j<3;j++)polygon([[x-28+j*5,405-j*25],[x+5,335-j*8],[x+38-j*5,405-j*25]],j%2?'#f0faff':'#b8e1ed');
 }else if(t.kind==='coast'){
  round(x,353,9,87,4,'#b79669');
  for(let j=-2;j<=2;j++)ellipse(x+j*12,350+Math.abs(j)*6,25,8,'#65a888');
  ellipse(x+50,433,14,6,'#f6c8b9');
 }else if(t.kind==='crystal'){
  for(let j=0;j<3;j++){const cx=x+j*21,top=365-(j%2)*35;
   polygon([[cx,440],[cx-9,top+15],[cx+4,top],[cx+17,top+15],[cx+20,440]],j%2?'#bda1ef':'#70c8d0');
   polygon([[cx+4,top],[cx+17,top+15],[cx+20,440],[cx+6,430]],'#e4faff66');
  }
 }else if(t.kind==='underworld'){
  polygon([[x-25,440],[x-10,355],[x+15,335],[x+32,385],[x+50,440]],'#705064');
  ctx.strokeStyle='#f6ae6a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+15,350);ctx.lineTo(x+4,385);ctx.lineTo(x+21,405);ctx.lineTo(x+15,430);ctx.stroke();
 }else if(t.kind==='heaven'){
  round(x,360,10,80,3,'#e9edff');round(x-8,355,26,8,4,'#fff');
  ellipse(x+5,350,19,5,'#ffe5a2');
 }else return false;
 return true;
}
function drawObstacle(o,t){
 if(o.layers>1){for(let i=0;i<o.layers;i++)drawObstacle({...o,layers:1,y:o.y+i*o.h/o.layers,h:o.h/o.layers},t);return;}
 const {x,y,w,h,type}=o;
 ctx.save();
 if(type==='mushroom'){
  const [cap,stem]=obstacleParts(o);
  round(stem.x,stem.y-2,stem.w,stem.h+2,4,'#f6dfb3');
  round(stem.x+stem.w*.65,stem.y,stem.w*.25,stem.h,2,'#d8b98d');
  round(cap.x,cap.y,cap.w,cap.h,[12,12,4,4],'#b64e5e');
  round(cap.x+2,cap.y+2,cap.w-4,cap.h-5,[10,10,3,3],'#eb7e7c');
  ellipse(x+w*.25,y+cap.h*.48,4,3,'#fff3d7');ellipse(x+w*.65,y+cap.h*.3,5,3,'#fff3d7');ellipse(x+w*.82,y+cap.h*.7,3,2,'#fff3d7');
 }else if(type==='cloud'||type==='cloudgate'){
  round(x,y,w,h,8,type==='cloudgate'?'#d8cff2':'#d9e8fa');
  round(x+2,y+2,w-4,10,6,'#fff');
  for(let i=0;i<3;i++)ellipse(x+w*(i+.5)/3,y+11,w/6-1,8,'#fff');
  if(type==='cloudgate'){
   round(x+8,y+19,6,h-24,3,'#f3efff');round(x+w-14,y+19,6,h-24,3,'#f3efff');
   star(x+w/2,y+h*.55,8,'#ffe29a');
  }else{ellipse(x+w*.3,y+h*.65,8,5,'#eff7ff');ellipse(x+w*.7,y+h*.72,9,5,'#eff7ff');}
 }else if(type==='sandstone'){
  round(x,y,w,h,3,'#bc8956');round(x+2,y+2,w-4,h-4,2,'#e5b879');
  for(let row=1;row<3;row++){round(x+2,y+h*row/3,w-4,2,0,'#ba8859');round(x+w*(row%2?.35:.7),y+h*(row-1)/3,2,h/3,0,'#ba8859');}
  round(x+2,y+2,w-4,5,2,'#f8d798');
 }else if(type==='moonstone'){
  round(x,y,w,h,8,'#756792');round(x+2,y+2,w-4,h-5,7,'#a494c4');
  ellipse(x+w*.25,y+h*.3,6,5,'#7e709f');ellipse(x+w*.72,y+h*.7,8,6,'#8272a5');
  ellipse(x+w*.75,y+h*.25,3,3,'#d6c7eb');star(x+w*.5,y+h*.5,7,'#ffe6a2');
 }else if(type==='ice'){
  round(x,y,w,h,4,'#65a6c7');round(x+2,y+2,w-4,h-4,3,'#a7e0ef');
  polygon([[x+3,y+3],[x+w-3,y+3],[x+w*.4,y+h-3],[x+3,y+h-3]],'#d9f7ff99');
  ctx.strokeStyle='#f0fcff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w*.65,y+6);ctx.lineTo(x+w*.45,y+h*.5);ctx.lineTo(x+w*.65,y+h*.7);ctx.stroke();
  round(x+1,y,w-2,6,3,'#f4fdff');
 }else if(type==='coral'){
  round(x,y,w,h,9,'#ba6576');round(x+2,y+2,w-4,h-4,8,'#f09b99');
  for(let i=0;i<3;i++){
   round(x+4+i*(w-8)/3,y+4,(w-12)/3,h-8,6,i%2?'#ffc1a5':'#e98091');
   ellipse(x+9+i*(w-8)/3,y+h*.32,2,3,'#a85879');ellipse(x+10+i*(w-8)/3,y+h*.7,2,2,'#a85879');
  }
 }else if(type==='crystal'){
  round(x,y,w,h,3,'#668ba9');
  polygon([[x+1,y+1],[x+w*.5,y+1],[x+w*.4,y+h-1],[x+1,y+h-1]],'#9de8df');
  polygon([[x+w*.5,y+1],[x+w-1,y+1],[x+w-1,y+h-1],[x+w*.4,y+h-1]],'#a695df');
  polygon([[x+4,y+3],[x+w*.5,y+3],[x+w*.35,y+h*.65]],'#e2fff3bb');
  ctx.strokeStyle='#e5fffa';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);
 }else{
  round(x,y,w,h,4,'#3c2937');round(x+2,y+2,w-4,h-4,4,'#66414b');
  polygon([[x+3,y+3],[x+w-3,y+3],[x+w*.7,y+h*.4],[x+4,y+h*.3]],'#835257');
  ctx.strokeStyle='#ef793d';ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(x+w*.65,y+4);ctx.lineTo(x+w*.4,y+h*.4);ctx.lineTo(x+w*.65,y+h*.65);ctx.lineTo(x+w*.45,y+h-3);ctx.stroke();
  ctx.strokeStyle='#ffd27c';ctx.lineWidth=2;ctx.stroke();
 }
 ctx.restore();
}
function drawDeath(){
 const a=deathAnimation,t=Math.min(1,a.elapsed/a.duration),still=reducedMotion?.matches;
 const hop=still?0:-Math.sin(t*Math.PI)*85+t*t*110;
 const p={...a.p,y:a.p.y+hop};
 ctx.save();ctx.globalAlpha=1-Math.max(0,(t-.55)/.45);
 ellipse(p.x+15,p.y+20,27,29,'#fff1ba88');
 drawPlayer(p);
 for(let i=0;i<7;i++){
  const angle=i*Math.PI*2/7+(still?0:t*1.7),radius=still?32:25+t*50;
  star(p.x+15+Math.cos(angle)*radius,p.y+20+Math.sin(angle)*radius*.7,4+(i%2)*2,i%2?'#fff7d3':'#ffd87d');
 }
 ctx.restore();
}
function draw(){const t=themes[level];ctx.fillStyle=t.sky;ctx.fillRect(0,0,W,H);
 if(level===4)for(let i=0;i<38;i++)star((i*137+31)%W,20+(i*73)%220,2+(i%3),'#fff4c7');
 if(!t.kind||t.kind==='heaven')for(let i=-1;i<9;i++){let x=i*250-camera*.25;ellipse(x,430,190,140+(i%3)*25,t.hill);ellipse(x+100,455,140,115,t.grass+'70');}
 drawThemeBackdrop(t);
 ctx.save();ctx.translate(-camera,0);
 // Trees, flowers and scenery move more slowly than the foreground.
 for(let i=0;i<world.length/300;i++){const x=i*300+110;if(drawThemeScenery(t,x,i))continue;if(level===1){round(x,280,15,160,5,'#8f8870');ellipse(x+8,275,60,70,'#58977c');ellipse(x-23,300,42,45,'#69ab87');}else if(level===3){round(x,365,15,75,7,'#76a280');round(x-20,385,25,13,6,'#76a280');round(x-24,365,11,29,5,'#76a280');round(x+10,375,25,12,6,'#76a280');round(x+29,355,10,30,5,'#76a280');}else{round(x,358,9,82,4,level===4?'#77719e':'#9eb486');ellipse(x+4,350,35,43,level===4?'#8279b2':'#91c58a');}}
 let groundX=0;for(const hole of [...world.holes,{x:world.length,w:0}]){round(groundX,G,hole.x-groundX,H-G,0,t.ground);round(groundX,G,hole.x-groundX,14,4,t.grass);for(let x=groundX+18;x<hole.x;x+=43)round(x,G+32,9,5,2,'#ffffff28');groundX=hole.x+hole.w;}
 if(!t.kind)for(let i=0;i<world.length/65;i++){let x=i*65+20;if(world.holes.some(h=>x>h.x&&x<h.x+h.w))continue;round(x,427,2,13,1,'#719b5b');ellipse(x+1,425,4,4,i%2?'#ffecab':'#f3a9a0');}
 if(t.kind==='underworld')for(const h of world.holes){
  round(h.x,H-35,h.w,35,0,'#ff803d33');round(h.x,H-27,h.w,27,0,'#f17c4d');
  round(h.x,H-27,h.w,4,0,'#ffe191');
  const clock=reducedMotion?.matches?0:hazardTime;
  for(let x=h.x+9;x<h.x+h.w;x+=22){ellipse(x,H-22+Math.sin(clock*2+x)*2,8,3,'#ffd27c');ellipse(x+3,H-9,5,2,'#ac3b30');}
 }
 if(t.kind==='heaven'){
  let start=0;for(const h of [...world.holes,{x:world.length,w:0}]){for(let x=start+14;x<h.x-10;x+=35)ellipse(x,G+16,19,14,'#f4f9ff');start=h.x+h.w;}
 }
 for(const p of world.platforms){round(p.x,p.y,p.w,p.h,7,t.ground);round(p.x,p.y,p.w,7,5,t.grass);if(t.kind==='heaven'){for(let x=p.x+12;x<p.x+p.w-5;x+=24)ellipse(x,p.y+14,14,10,'#ffffff');}if(p.moving){ctx.fillStyle=t.kind==='heaven'?'#748cba':'#ffffffc0';ctx.font='13px sans-serif';ctx.fillText('↕',p.x+p.w/2-5,p.y+19);}}
 for(const p of world.platforms)if(p.recovery){
  ctx.save();ctx.strokeStyle=t.accent;ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(p.x+1,p.y+1,p.w-2,p.h-2);
  ctx.fillStyle=t.kind==='crystal'||t.kind==='underworld'?'#ffe6b3':'#495f7e';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('↶',p.x+p.w/2,p.y+13);ctx.restore();
 }
 for(const o of world.obstacles)drawObstacle(o,t);
 for(const s of world.spikes)drawSpikes(s);
 for(const s of world.stars)if(!s.taken){const sy=s.y+Math.sin(time*3+s.x)*3;ellipse(s.x,sy,15,15,'#fff4b33d');star(s.x,sy,11,'#f4bd4e');}
 for(const p of world.powerups)if(!p.taken){const type=powerTypes[p.type],y=p.y+Math.sin(time*3+p.x)*2;ellipse(p.x,y,21,21,'#ffffff65');ellipse(p.x,y,16,16,type.color);ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(type.icon,p.x,y+8);ctx.textAlign='left';}
 for(const e of world.enemies)if(e.alive){ellipse(e.x+17,e.y+30,20,4,'#00000012');round(e.x,e.y+6,34,23,10,level===4?'#bc9ee2':'#e98d80');ellipse(e.x+17,e.y+7,20,12,level===4?'#a782d0':'#de7f73');ellipse(e.x+9,e.y+4,4,3,'#ffe8c4');ellipse(e.x+24,e.y+8,3,3,'#ffe8c4');ellipse(e.x+11,e.y+18,3,4,'#fff');ellipse(e.x+23,e.y+18,3,4,'#fff');ellipse(e.x+11+e.dir,e.y+19,1.5,2.5,'#39443a');ellipse(e.x+23+e.dir,e.y+19,1.5,2.5,'#39443a');round(e.x+2,e.y+28,10,4,2,'#725d58');round(e.x+23,e.y+28,10,4,2,'#725d58');}
 round(world.flag,240,6,200,3,'#f9fcdf');ctx.fillStyle=t.accent;ctx.beginPath();ctx.moveTo(world.flag+6,244);ctx.lineTo(world.flag+80,266);ctx.lineTo(world.flag+6,290);ctx.fill();star(world.flag+30,264,9,'#fffef0');ellipse(world.flag+3,237,7,7,'#ffe5a0');
 if(shield){ellipse(player.x+15,player.y+21,26,30,'#73d6ee55');ctx.strokeStyle='#baf6ff';ctx.lineWidth=2;ctx.stroke();}
 if(jumpBoost>0){star(player.x-7,player.y+10,6,'#c4a2f1');star(player.x+37,player.y+30,5,'#c4a2f1');}
 if(deathAnimation)drawDeath();
 else if(invulnerable<=0||Math.floor(time*12)%2===0||mode!=='playing')drawPlayer();
 ctx.restore();
 const buffs=[shield?'◆ Schutzschild bereit':'',jumpBoost>0?'↑ Sprungboost '+Math.ceil(jumpBoost)+' s':''].filter(Boolean);
 if(buffs.length){round(15,15,210,buffs.length*25+12,10,'#fffef2ed');ctx.fillStyle='#38564c';ctx.font='bold 13px sans-serif';buffs.forEach((text,i)=>ctx.fillText(text,28,39+i*25));}
 // A thin progress track along the lower edge of the world.
 round(18,H-15,W-36,4,2,'#ffffff40');round(18,H-15,(W-36)*Math.min(1,player.x/world.flag),4,2,'#fff8cb');
}
function drawPlayer(p=player){const x=p.x,y=p.y,step=p.grounded&&Math.abs(p.vx)>0?Math.sin(time*18)*4:0;ellipse(x+15,y+44,18,4,'#243c3020');round(x+4,y+29,9,13+step,4,'#3b6861');round(x+18,y+29,9,13-step,4,'#3b6861');round(x+1,y+37+step,13,6,3,'#d58d55');round(x+17,y+37-step,15,6,3,'#d58d55');round(x+2,y+17,27,18,7,'#edbc58');round(x-3,y+20,7,12,3,'#f6d4aa');round(x+27,y+20,7,12,3,'#f6d4aa');round(x+3,y+1,25,23,9,'#ffdcad');round(x+1,y,29,9,5,'#4d927b');round(x+(p.face>0?6:-3),y+6,29,5,3,'#4d927b');ellipse(x+(p.face>0?22:9),y+14,2,3,'#344d46');ellipse(x+(p.face>0?25:6),y+20,3,2,'#eeaa8e');round(x+12,y+24,6,10,2,'#5f9b87');}
function frame(now){let elapsed=Math.min((now-last)/1000,.05);last=now;accumulator+=elapsed;while(accumulator>=1/120){update(1/120);accumulator-=1/120;}draw();requestAnimationFrame(frame);}
loadLevel();requestAnimationFrame(t=>{last=t;requestAnimationFrame(frame);});
