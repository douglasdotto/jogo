// node cavaleiros/tests/rodada2.cjs — lógica real, sem rede e sem dependências.
// Cena e DOM são duplos; peças e animações são conferidas nos GLB reais.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
const recipes = fs.readFileSync(path.join(dir, 'characters.js'), 'utf8');
class Vector3 {
  constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); }
  set(x,y,z) { Object.assign(this,{x,y,z}); return this; }
  setY(y) { this.y=y; return this; }
  copy(v) { return this.set(v.x,v.y,v.z); }
  clone() { return new Vector3().copy(this); }
  add(v) { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
  sub(v) { this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; }
  subVectors(a,b) { return this.copy(a).sub(b); }
  addScaledVector(v,k) { return this.add(v.clone().multiplyScalar(k)); }
  multiplyScalar(k) { this.x*=k; this.y*=k; this.z*=k; return this; }
  divideScalar(k) { return this.multiplyScalar(1/k); }
  length() { return Math.hypot(this.x,this.y,this.z); }
  normalize() { return this.divideScalar(this.length() || 1); }
  dot(v) { return this.x*v.x+this.y*v.y+this.z*v.z; }
  distanceTo(v) { return this.clone().sub(v).length(); }
  distanceToSquared(v) { return this.distanceTo(v)**2; }
  lerp(v,k) { return this.addScaledVector(v.clone().sub(this),k); }
  applyAxisAngle(_,a) { const x=this.x,z=this.z; this.x=x*Math.cos(a)+z*Math.sin(a); this.z=z*Math.cos(a)-x*Math.sin(a); return this; }
  project() { return this; }
  setScalar(k) { return this.set(k,k,k); }
}
const noop=()=>{};
const el=()=>({ style:{setProperty:noop}, classList:{add:noop,remove:noop,toggle:noop}, children:[],
  appendChild(c){ this.children.push(c); }, addEventListener:noop, querySelector:()=>el(), querySelectorAll:()=>[el(),el()],
  remove:noop, firstChild:{style:{}}, innerHTML:'', textContent:'' });
const elements=new Map();
const color=()=>({set:noop,setHex:noop});
const material=()=>({color:color(),emissive:color(),dispose:noop});
const root=()=>({position:new Vector3(),rotation:{y:0},scale:new Vector3(1,1,1),quaternion:{setFromUnitVectors:noop},
  traverse:noop,add:noop,removeFromParent:noop,getObjectByName:()=>({add:noop}),material:material(),children:[],rotateZ:noop});
const action=()=>({reset(){return this},setLoop(){return this},play(){return this},crossFadeFrom:noop,getClip:()=>({duration:1,name:'Idle'})});
const THREE={ Vector3, Mesh:class {constructor(){Object.assign(this,root())}}, Group:class {constructor(){Object.assign(this,root())}},
  MeshBasicMaterial:class {constructor(){Object.assign(this,material())}}, MeshLambertMaterial:class {constructor(){Object.assign(this,material())}},
  AnimationMixer:class {constructor(){this.time=0}update(dt){this.time+=dt}clipAction(){return action()}stopAllAction(){}},
  AnimationClip:{findByName:(_,name)=>({name,duration:1})}, Clock:class{getDelta(){return .016}},
  MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(v,b))}, LoopOnce:1, LoopRepeat:2 };
const context=vm.createContext({THREE,document:{createElement:el,getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)}},
  addEventListener:noop,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,innerWidth:1440,innerHeight:1000,
  SkeletonUtils:{clone:root}, scene:{add:noop,remove:noop}, assets:{}, ringGeo:{},haloGeo:{},goldMat:{},starGeo:{},
  boltGeo:{},axeGeo:{},bladeGeo:{},handleGeo:{},flameGeo:{},groundGeo:{},boltMats:{viking:{},iceviking:{},arcane:{},pyro:{}},
  renderer:{render:noop}, camera:{position:new Vector3()}, sun:{position:new Vector3(),target:{position:new Vector3()}},
  follow:new Vector3(),controls:{target:new Vector3(),update:noop}, world:{obstacles:[],pointAt:s=>new Vector3(0,0,-s),
    tangentAt:()=>new Vector3(0,0,-1),sideOf:()=>new Vector3(1,0,0),anchorS:p=>p*10,along:(s,x)=>new Vector3(x,0,-s),update:noop},
  poof:noop,ring:noop,beam:noop,popText:noop, colors:{arcane:0}, bolts:[],blasts:[],flames:[],fx:[],updateFx:noop,
  fireBolt:(from,target,kind)=>context.bolts.push({from,target,kind}),updateBolts:noop});
const part=(text,a,b)=>text.slice(text.indexOf(a),text.indexOf(b));
vm.runInContext(part(recipes,'export const CHARACTERS','// arquivos').replace('export ',''),context);
vm.runInContext(part(source,'const ROAD','// ---------- cena'),context);
vm.runInContext(part(source,'const $','// retrato de cada'),context);
vm.runInContext(part(source,'const units =','// projéteis e áreas'),context);
vm.runInContext(part(source,'function fireBolt','// ---------- efeitos'),context);
vm.runInContext(part(source,'class Hero','// empurra unidades'),context);
vm.runInContext(part(source,'// ---------- fases',"addEventListener('resize'"),context);
vm.runInContext('globalThis.t={Hero,Skeleton,Minion,Unit,VARIANTS,CHARACTERS,units,heroes,game,pick,evolutions,UPGRADES,showPick,pickConfig,changeVariant,confirmPick,showEvolution,confirmEvolution,arrangeParty,damageCleave,startGame,startPhase,spawnSkeleton,updateGame,endGame,frame};',context);
const t=context.t;
const cfg=id=>t.VARIANTS.find(v=>v.id===id);
for(const v of t.VARIANTS) v.built={scene:{},animations:[]},v.portraits=['1','2','3'];
for(const n of ['Minion','Warrior','Rogue']) context.assets['Skeleton_'+n]={scene:{},animations:[]};
for(const n of ['Skeleton_Blade','Skeleton_Axe','Skeleton_Shield_Small_A']) context.assets[n]={scene:{clone:root}};
const results=[];
function test(name,fn){fn();results.push(name);console.log('OK:',name)}
function clear(){for(const u of [...t.units])u.remove();t.evolutions.length=0;t.pick.open=false;Object.assign(t.game,{over:false,paused:false,state:'fight',guideS:10});}
test('16 variantes, receitas e animações existentes nos GLB',()=>{
  assert.equal(t.VARIANTS.length,16);
  const glb=n=>{const b=fs.readFileSync(path.join(dir,'assets',n+'.glb'));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};
  for(const v of t.VARIANTS){
    const g=glb(v.recipe?.base||v.model),clips=g.animations.map(a=>a.name);
    for(const clip of [v.idle,...v.attacks,'Death_A','Block_Hit','Spellcast_Raise','Cheer','Throw']) assert.ok(clips.includes(clip),v.id+': '+clip);
    if(v.recipe) for(const add of v.recipe.add) assert.ok(glb(add.from).nodes.some(n=>n.name.replaceAll('.','')===add.part));
  }
});
test('variantes repetem classe, pulam ocupadas e usam postos distintos',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));t.arrangeParty();
  assert.ok(a.post.distanceTo(b.post)>1);t.showPick('','');assert.ok(t.pick.options.includes(2));
  const card=t.pick.options.indexOf(2);
  for(let k=0;k<8;k++){t.changeVariant(card,1);assert.ok(!['pyro','arcane'].includes(t.pickConfig(card).id))}
  assert.ok(t.pick.cards[card].innerHTML.includes('No grupo'));
});
test('evoluções simultâneas pausam em fila e oferecem três opções distintas',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));a.gainXp(350);b.gainXp(90);
  assert.equal(t.evolutions.length,3);assert.equal(a.level,3);assert.ok(Math.abs(a.dmg-28*1.1**2)<.001);
  t.showEvolution();assert.equal(t.game.paused,true);assert.equal(new Set(t.pick.upgrades.map(o=>o.id)).size,3);
  t.confirmPick(0);assert.equal(t.evolutions.length,2);assert.equal(t.game.paused,true);
  t.confirmPick(0);t.confirmPick(0);assert.equal(t.evolutions.length,0);assert.equal(t.game.paused,false);
});
test('todas as melhorias acumulam sem perder os ganhos anteriores',()=>{
  clear();const h=new t.Hero(cfg('paladin'));const hp=h.maxHp,dmg=h.dmg;
  for(const option of t.UPGRADES){t.evolutions.push({hero:h,level:2});t.pick.upgrades=[option];t.confirmEvolution(0)}
  assert.equal(h.maxHp,hp*1.25);assert.equal(h.hp,h.maxHp);assert.equal(h.dmg,dmg*1.2);assert.equal(h.haste,1.2);
  assert.equal(h.skillRate,.75);assert.equal(h.skillPower,1.25);assert.equal(h.damageTaken,.8);
  h.gainXp(90);assert.ok(h.dmg>dmg*1.2);t.showEvolution();assert.ok(t.pick.upgrades.every(o=>o.id!=='range'));
});
test('brado, invocações, raízes e cura têm os efeitos previstos',()=>{
  clear();const king=new t.Hero(cfg('king')),necro=new t.Hero(cfg('necro')),druid=new t.Hero(cfg('druid'));
  const enemy=new t.Skeleton('Warrior',1);enemy.spawning=false;enemy.pos.set(0,0,2);
  for(const h of t.heroes())h.pos.set(0,0,0);
  const cast=h=>{assert.equal(h.useSkill(enemy),true,h.cfg.id);h.pendingHit.effect();h.pendingHit=null};
  cast(king);assert.equal(druid.royalT,5);assert.equal(druid.royalBonus,.25);
  cast(necro);assert.equal(t.units.filter(u=>u.summoner===necro).length,2);assert.equal(t.heroes().length,3);
  cast(necro);assert.equal(t.units.filter(u=>u.summoner===necro).length,2);
  const summon=t.units.find(u=>u.summoner===necro);summon.update(9);assert.ok(!t.units.includes(summon));
  king.hp=10;cast(druid);assert.equal(enemy.rootT,1.5);assert.equal(king.hp,30);
});
test('machado glacial causa dano e lentidão na área',()=>{
  clear();context.bolts.length=0;
  const h=new t.Hero(cfg('iceviking'));h.pos.set(0,0,0);
  const a=new t.Skeleton('Warrior',1),b=new t.Skeleton('Warrior',1);
  a.spawning=b.spawning=false;a.pos.set(0,0,3);b.pos.set(1,0,3);
  assert.equal(h.useSkill(a),true);h.pendingHit.effect();h.pendingHit=null;
  context.updateBolts(.25);assert.equal(a.hp,48);assert.equal(b.hp,48);assert.equal(a.slowT,3);assert.equal(b.slowT,3);
});
test('cleave frontal limita raio, dano secundário e recuo',()=>{
  clear();const h=new t.Hero(cfg('crusher'));h.pos.set(0,0,0);h.root.rotation.y=0;
  const enemy=(x,z)=>{const u=new t.Skeleton('Minion',1);u.spawning=false;u.pos.set(x,0,z);u.hp=1000;return u};
  const a=enemy(0,1.8),b=enemy(1,1.5),back=enemy(0,-1.8),far=enemy(0,2.3);
  t.damageCleave(h,a);assert.equal(a.hp,966);assert.equal(b.hp,979.6);assert.equal(back.hp,1000);assert.equal(far.hp,1000);
  assert.ok(b.vel.length()<a.vel.length());
});
test('fim de jogo mantém animação e impede dano e golpes pendentes',()=>{
  clear();const h=new t.Hero(cfg('king'));h.die();t.endGame('Derrota');const before=h.mixer.time;
  const enemy=new t.Skeleton('Minion',1),hp=enemy.hp;enemy.takeDamage(100,h.pos);assert.equal(enemy.hp,hp);
  let hit=false;enemy.pendingHit={t:0,effect:()=>{hit=true}};t.frame();assert.ok(h.mixer.time>before);assert.equal(hit,false);
});
test('reinício limpa invocados, fila, efeitos e reabre seleção',()=>{
  clear();const h=new t.Hero(cfg('necro'));new t.Minion(h,1);h.gainXp(90);t.showEvolution();t.startGame();
  assert.equal(t.units.length,0);assert.equal(t.evolutions.length,0);assert.equal(t.pick.mode,'hero');assert.equal(t.pick.open,true);assert.equal(t.game.paused,true);
});
test('entrada tardia recebe metade da média de XP e respeita limite de quatro',()=>{
  clear();const a=new t.Hero(cfg('paladin')),b=new t.Hero(cfg('berserker'));a.xp=300;b.xp=100;
  let confirm;context.setTimeout=(fn,ms)=>{if(ms===550)confirm=fn};
  t.showPick('','');t.confirmPick(t.pick.options.indexOf(2));assert.ok(confirm);confirm();
  const added=t.heroes().at(-1);assert.equal(added.xp,100);assert.equal(added.level,2);assert.equal(t.evolutions.length,1);
  t.evolutions.length=0;t.pick.open=false;t.game.paused=false;new t.Hero(cfg('assassin'));
  t.showPick('','');t.confirmPick(0);assert.equal(t.heroes().length,4);assert.equal(t.pick.open,true);
  context.setTimeout=noop;
});
test('fase revive aliados, oferece reforço, gera chefe e termina em vitória',()=>{
  clear();const a=new t.Hero(cfg('paladin')),b=new t.Hero(cfg('pyro'));b.die();
  Object.assign(t.game,{phase:1,toSpawn:0});t.updateGame(.1);
  assert.equal(t.game.state,'cleared');assert.equal(b.dead,false);
  t.game.timer=0;t.updateGame(.1);assert.equal(t.game.phase,2);assert.equal(t.pick.open,true);
  t.pick.open=false;t.game.paused=false;t.game.phase=6;t.startPhase();assert.equal(t.game.bossPending,true);
  t.game.toSpawn=1;t.spawnSkeleton();assert.ok(t.units.some(u=>u.boss));
  for(const u of [...t.units])if(u.team==='skeleton')u.remove();
  Object.assign(t.game,{phase:12,state:'cleared',timer:0});t.updateGame(.1);assert.equal(t.game.over,true);
  assert.ok(elements.get('overlayText').textContent.startsWith('Vitória'));
});
console.log(results.length+' verificações passaram.');
