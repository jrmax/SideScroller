// Run with: node tests/collision.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const elements = new Map();
const document = {activeElement: {tagName: 'BODY'}, addEventListener() {}};
document.querySelector = selector => {
  if (!elements.has(selector)) elements.set(selector, {
    checked: false, classList: {add() {}, remove() {}},
    setAttribute() {}, addEventListener() {}, getContext() {return new Proxy({}, {get(target,key){return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});},
    focus() {document.activeElement = this;}, tagName: selector === '#game' ? 'CANVAS' : 'BUTTON'
  });
  return elements.get(selector);
};
const sandbox = vm.createContext({assert, document, window: {addEventListener() {}},
  performance: {now: () => 0}, requestAnimationFrame() {}, console});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8'), sandbox);
vm.runInContext(`
function reset(){
 level=0;lives=5;score=0;mode='playing';loadLevel();invulnerable=0;keys.clear();
 world.obstacles=[];world.holes=[];world.platforms=[];world.enemies=[];world.spikes=[];world.stars=[];world.powerups=[];shield=false;jumpBoost=0;
 player.x=200;player.y=G-player.h;player.vy=0;player.grounded=true;
}
reset();world.holes=[{x:300,w:100}];
assert.equal(hasGroundSupport({...player,x:280}),true,'left edge still supports feet');
assert.equal(hasGroundSupport({...player,x:390}),true,'right edge supports feet');
assert.equal(hasGroundSupport({...player,x:320}),false,'inside the hole has no ground');
player.x=280;for(let i=0;i<240;i++)update(1/120);
assert.equal(lives,5);assert.equal(player.y,G-player.h);
player.x=320;for(let i=0;i<120;i++)update(1/120);
assert.equal(lives,4,'a real fall costs exactly one life');

const spikes={x:300,y:418,w:40,h:22};
assert.equal(touchesSpikes({x:299,y:400,w:3,h:20},spikes),false,'empty triangle corner');
const movingTip=spikeTriangles(spikes)[0];
assert.equal(touchesSpikes({x:movingTip.center-1,y:movingTip.top-2,w:2,h:4},spikes),true,'actual moving tip');
assert.equal(touchesSpikes({x:300,y:380,w:40,h:38},spikes),false,'above the spikes');
reset();world.spikes=[spikes];player.x=300;update(1/120);
assert.equal(lives,4,'actual spike contact');

function enemy(){return {x:230,y:410,w:34,h:30,min:230,max:230,dir:1,speed:0,alive:true};}
reset();world.enemies=[enemy()];player.x=202;update(1/120);
assert.equal(lives,5,'near miss does not hurt');
player.x=215;update(1/120);assert.equal(lives,4,'side contact does hurt');
assert.equal(mode,'dying','damage begins a short animation');
const frozenX=player.x,frozenEnemyX=world.enemies[0].x;
draw();queueJump();loseLife();update(.1);
assert.equal(lives,4,'animation cannot cause repeated damage');assert.equal(player.x,frozenX);
assert.equal(world.enemies[0].x,frozenEnemyX,'gameplay freezes during animation');
pause();const animationTime=deathAnimation.elapsed;update(.5);assert.equal(deathAnimation.elapsed,animationTime);
startAction();assert.equal(mode,'dying','resume continues the animation');
for(let i=0;i<130;i++)update(1/120);
assert.equal(player.x,checkpoint,'respawn after animation');assert.equal(mode,'playing');assert.ok(invulnerable>0);
reset();world.enemies=[enemy()];player.x=230;player.y=370;player.vy=20;player.grounded=false;
update(1/120);assert.equal(lives,5);assert.equal(world.enemies[0].alive,false,'slow downward stomp');
assert.ok(player.vy<0,'stomp bounces');
reset();world.enemies=[enemy()];player.x=230;invulnerable=1;
update(1/120);assert.equal(lives,5,'respawn protection');
reset();queueJump();update(1/120);assert.ok(player.vy<0,'jump from solid ground');
for(let n=0;n<themes.length;n++){reset();level=n;loadLevel();invulnerable=0;
 for(let i=0;i<360;i++)update(1/120);
 assert.equal(lives,5,'safe starting area in world '+(n+1));
}
startAction();assert.equal(document.activeElement.tagName,'CANVAS','game receives keyboard focus');
reset();world.powerups=[{type:'shield',x:215,y:415,taken:false}];update(1/120);
assert.equal(shield,true,'touch collects shield');assert.equal(world.powerups[0].taken,true);
loseLife();assert.equal(lives,5);assert.equal(shield,false,'shield absorbs one hit');
invulnerable=0;loseLife();assert.equal(lives,4,'next unprotected hit costs a life');
reset();shield=true;loseLife(true);assert.equal(lives,4,'shield cannot prevent a fall');
reset();collectPowerup({type:'jump'});queueJump();update(1/120);
assert.ok(player.vy < -740,'boost increases jump height');
mode='paused';const remaining=jumpBoost;update(1);assert.equal(jumpBoost,remaining,'pause freezes boost');
mode='playing';jumpBoost=.001;update(1/120);assert.equal(jumpBoost,0,'boost expires');
reset();lives=3;collectPowerup({type:'life'});assert.equal(lives,4);
lives=5;collectPowerup({type:'life'});assert.equal(lives,6);assert.equal(score,0);
for(let i=0;i<20;i++)collectPowerup({type:'life'});
assert.equal(lives,26);assert.equal(document.querySelector('#lives').textContent,'♥ × 26');
reset();shield=true;jumpBoost=10;mode='leveldone';
let prevented=false;
handleKeyDown({code:'Enter',repeat:true,preventDefault(){prevented=true;}});
assert.equal(mode,'leveldone','held Enter does not skip a world');
handleKeyDown({code:'Enter',repeat:false,preventDefault(){prevented=true;}});
assert.equal(prevented,true);assert.equal(mode,'playing');assert.equal(level,1);
assert.equal(shield,true);assert.equal(jumpBoost,10,'powers travel to next level');
handleKeyDown({code:'Enter',repeat:false,preventDefault(){}});assert.equal(level,1);
mode='gameover';startAction();assert.equal(shield,false);assert.equal(jumpBoost,0);
for(const code of ['Enter','NumpadEnter']){
 reset();lives=1;loseLife();assert.equal(mode,'dying');
 handleKeyDown({code,repeat:false,preventDefault(){}});assert.equal(mode,'dying','Enter does not skip animation');
 for(let i=0;i<125;i++)update(1/120);
 assert.equal(mode,'gameover');assert.equal(lives,0);draw();
 handleKeyDown({code,repeat:true,preventDefault(){}});assert.equal(mode,'gameover');
 handleKeyDown({code,repeat:false,preventDefault(){}});
 assert.equal(mode,'playing');assert.equal(lives,5);assert.equal(level,0);assert.equal(score,0);
}
for(let n=0;n<themes.length;n++){const w=makeLevel(n);assert.equal(w.powerups.length,3);
 for(const p of w.powerups){assert.ok(p.x<w.flag);assert.ok(!w.holes.some(h=>p.x>h.x-14&&p.x<h.x+h.w+14));}
 for(const s of w.spikes){
  assert.equal(s.y+s.h,G,'spikes stand on ground');
  const tips=spikeTriangles(s);assert.equal(tips[0].left,s.x);assert.equal(tips[2].right,s.x+s.w);
  for(const tip of tips){
   assert.equal(touchesSpikes({x:tip.center-1,y:tip.top-2,w:2,h:4},s),true,'visible tip hits');
   assert.equal(touchesSpikes({x:tip.left,y:tip.top-2,w:2,h:4},s),false,'empty corner is safe');
  }
 }
}
mode='paused';const frozenHazardTime=hazardTime;update(.5);
assert.equal(hazardTime,frozenHazardTime,'warning animation freezes while paused');
const savedHazardTime=hazardTime,animatedSpikes={x:300,y:410,w:48,h:30};
for(let sample=0;sample<24;sample++){
 hazardTime=sample*Math.PI/12/2.4;
 const tips=spikeTriangles(animatedSpikes);
 assert.equal(tips[0].top,tips[2].top,'outer spikes move together');
 assert.ok(Math.abs(tips[0].top+tips[1].top-2*animatedSpikes.y-16)<1e-8,'middle spike moves in opposite phase');
 for(const tip of tips){
  assert.ok(tip.top>=animatedSpikes.y&&tip.top<=animatedSpikes.y+16,'motion stays in visible bounds');
  assert.equal(touchesSpikes({x:tip.center-1,y:tip.top-2,w:2,h:4},animatedSpikes),true,'animated tip collision');
  assert.equal(touchesSpikes({x:tip.center-1,y:tip.top-5,w:2,h:3},animatedSpikes),false,'empty space above moving tip is safe');
 }
}
hazardTime=Math.PI/2/2.4;
assert.equal(touchesSpikes({x:307,y:411,w:2,h:3},animatedSpikes),false,'retracted outer tip leaves safe space');
hazardTime=3*Math.PI/2/2.4;
assert.equal(touchesSpikes({x:307,y:411,w:2,h:3},animatedSpikes),true,'extended outer tip hits in same place');
hazardTime=savedHazardTime;
assert.equal(themes.length,10,'ten worlds');
reset();
for(let n=0;n<themes.length;n++){
 level=n;loadLevel();mode='playing';invulnerable=0;
 assert.equal(document.querySelector('#world-label').textContent,'WELT '+(n+1)+' VON 10');
 assert.ok(!document.querySelector('#worlds').innerHTML.includes('WELT 010'),'correct two-digit world numbers');
 for(const e of world.enemies){
  assert.ok(e.min<=e.max&&e.x>=e.min&&e.x<=e.max,'valid enemy patrol');
  assert.ok(!world.holes.some(h=>e.min<h.x+h.w&&e.max+e.w>h.x),'enemies stay on solid ground');
 }
 for(const p of world.platforms)assert.ok(p.x>=0&&p.x+p.w<world.flag,'platform within level');
 for(const h of world.holes)assert.ok(h.w<=135,'gaps remain jumpable without boost');
 draw(); // Exercise all theme drawing paths with a Canvas API stub.
 player.x=world.flag;player.y=G-player.h;player.vy=0;
 update(1/120);
 assert.equal(mode,n===themes.length-1?'won':'leveldone','completion in world '+(n+1));
 if(n<themes.length-1){handleKeyDown({code:'Enter',repeat:false,preventDefault(){}});assert.equal(level,n+1);assert.equal(mode,'playing');}
}
console.log('All ten worlds: generation, drawing, patrols, Enter transitions and finale passed.');
let previousCount=0;
for(let n=0;n<themes.length;n++){
 const generated=makeLevel(n);
 assert.equal(generated.obstacles.filter(o=>o.role!=='route').length,n===0?0:n+2,'no obstacles in level 1; increasing from level 2');
 const basicCount=generated.obstacles.filter(o=>o.role!=='route').length;if(n>0)assert.ok(basicCount>previousCount);previousCount=basicCount;
 for(const o of generated.obstacles.filter(o=>o.role!=='route')){
  assert.equal(o.type,['none','mushroom','cloud','sandstone','moonstone','ice','coral','crystal','lava','cloudgate'][n],'theme-specific obstacle');
  assert.ok(!generated.holes.some(h=>o.x<h.x+h.w&&o.x+o.w>h.x),'obstacle on solid ground');
  assert.ok(!generated.enemies.some(e=>o.x<e.max+e.w&&o.x+o.w>e.min),'clear of patrols');
  reset();level=n;world.length=generated.length;world.flag=generated.flag;world.obstacles=[o];
  player.x=o.x-60;keys.add('ArrowRight');
  for(let i=0;i<90;i++)update(1/120);
  assert.equal(player.x,o.x-player.w,'walking is blocked');assert.equal(lives,5,'obstacles do not hurt');
  player.x=o.x-85;queueJump();
  for(let i=0;i<150;i++)update(1/120);
  assert.ok(player.x>o.x+o.w,'normal jump clears obstacle in world '+(n+1));
  assert.equal(lives,5);
  reset();world.length=generated.length;world.flag=generated.flag;world.obstacles=[o];player.x=o.x+5;player.y=o.y-player.h-8;player.vy=100;player.grounded=false;
  for(let i=0;i<30;i++)update(1/120);
  assert.equal(player.y,o.y-player.h,'can land on obstacle');assert.equal(player.grounded,true);
 }
}
reset();level=8;world.holes=[{x:300,w:120}];player.x=340;player.y=H-27-player.h+1;shield=true;
update(1/120);assert.equal(lives,4,'lava surface costs a life even with shield');
console.log('Increasing obstacles, solid collisions, normal jumps, landings and lava passed.');
reset();level=5;keys.add('ArrowRight');update(1/120);
assert.ok(player.vx>0&&player.vx<245,'ice accelerates gradually');
for(let i=0;i<60;i++)update(1/120);
assert.equal(player.vx,245,'ice reaches regular running speed');
keys.clear();const glideStart=player.x;update(1/120);
assert.ok(player.vx>0&&player.vx<245,'release glides instead of stopping immediately');
for(let i=0;i<60;i++)update(1/120);
assert.equal(player.vx,0,'glide comes to a complete stop');
assert.ok(player.x-glideStart>20&&player.x-glideStart<55,'glide stays gentle');
player.vx=245;keys.add('ArrowLeft');update(1/120);
assert.ok(player.vx>0,'direction change first brakes');
for(let i=0;i<90;i++)update(1/120);
assert.equal(player.vx,-245,'direction change eventually runs left');
reset();player.vx=245;update(1/120);assert.equal(player.vx,0,'normal worlds still stop immediately');
reset();level=5;document.querySelector('#autorun').checked=true;
for(let i=0;i<90;i++)update(1/120);
assert.equal(player.vx,245,'auto-run works on ice');
document.querySelector('#autorun').checked=false;
console.log('Ice acceleration, glide, reversal, normal movement and auto-run passed.');
function jumpToLanding(n,targetX){
 queueJump();
 for(let i=0;i<200;i++){
  keys.clear();
  if(targetX!==undefined&&player.x>targetX+1)keys.add('ArrowLeft');
  update(1/120);
  if(i>4&&player.grounded)return;
 }
 assert.fail('no landing after recovery jump in world '+(n+1));
}
const endingKinds=new Set();
for(let n=5;n<10;n++){
 const generated=makeLevel(n),route=generated.jumpRoutes[0];
 assert.equal(generated.jumpRoutes.length,1,'one distinct finale per advanced world');
 endingKinds.add(route.kind);
 for(const surface of route.surfaces){
  const ladder=route.recoveries.filter(p=>p.forSurface===surface);
  if(!ladder.length)continue;
  reset();level=n;world=makeLevel(n);player.x=ladder[0].x+20;player.y=G-player.h;
  document.querySelector('#autorun').checked=false;
  for(const rung of ladder){jumpToLanding(n);assert.equal(player.y+player.h,rung.y,'recover from ground up the footholds');}
  const target=surface.x+surface.w-(n===5?10:45);
  let escaped=false;
  for(let attempt=0;attempt<3;attempt++){
   jumpToLanding(n,target);
   escaped=world.obstacles.some(o=>o.role==='route'&&Math.abs(player.y+player.h-o.y)<.01&&player.x+player.w>o.x&&player.x<o.x+o.w);
   if(escaped)break;
  }
  assert.ok(escaped,'jump LEFT back onto a solid high surface after falling in world '+(n+1));
  assert.equal(lives,5);assert.equal(jumpBoost,0,'recovery without power-ups');
 }
}
assert.equal(endingKinds.size,5,'five distinct ending layouts');
const cave=makeLevel(7).jumpRoutes[0];
assert.equal(cave.kind,'Kristall-L-T-L');
assert.ok(cave.pieces.some(p=>p.w===140&&p.h===24),'wide T crossbar in cave');
assert.ok(cave.pieces.some(p=>p.w===30&&p.h===178),'central T stem in cave');
reset();document.querySelector('#autorun').checked=true;keys.add('ArrowLeft');update(1/120);
assert.ok(player.vx<0,'left arrow overrides auto-run for return jumps');document.querySelector('#autorun').checked=false;
console.log('Distinct endings and ground-to-left recovery routes passed without boosts.');
const mushroom=makeLevel(1).obstacles[0];
const mushroomParts=obstacleParts(mushroom);
assert.equal(mushroomParts.length,2,'mushroom cap and stem have separate solid parts');
assert.ok(!mushroomParts.some(p=>overlaps({x:mushroom.x,y:mushroom.y+mushroom.h-5,w:3,h:4},p)),'empty space beside mushroom stem is not solid');
console.log('Collision regression checks passed.');
`, sandbox);
