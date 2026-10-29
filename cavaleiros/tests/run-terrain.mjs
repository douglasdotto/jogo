// node cavaleiros/tests/run-terrain.mjs — lógica real de navegação, sem WebGL/CDN.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { checkTerrain } from './terrain.js';
class Vector3 {
  constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); }
  clone() { return new Vector3(this.x,this.y,this.z); }
  copy(v) { return this.set(v.x,v.y,v.z); }
  set(x,y,z) { Object.assign(this,{x,y,z}); return this; }
  setY(y) { this.y=y; return this; }
  add(v) { this.x+=v.x;this.y+=v.y;this.z+=v.z;return this; }
  sub(v) { this.x-=v.x;this.y-=v.y;this.z-=v.z;return this; }
  addScaledVector(v,k) { this.x+=v.x*k;this.y+=v.y*k;this.z+=v.z*k;return this; }
  subVectors(a,b) { return this.copy(a).sub(b); }
  multiplyScalar(k) { return this.set(this.x*k,this.y*k,this.z*k); }
  divideScalar(k) { return this.multiplyScalar(1/k); }
  lengthSq() { return this.dot(this); }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { return this.divideScalar(this.length()||1); }
  dot(v) { return this.x*v.x+this.y*v.y+this.z*v.z; }
  distanceTo(v) { return this.clone().sub(v).length(); }
  lerp(v,k) { return this.addScaledVector(v.clone().sub(this),k); }
}
const THREE={Vector3,MathUtils:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  smoothstep:(x,a,b)=>{if(x<=a)return 0;if(x>=b)return 1;x=(x-a)/(b-a);return x*x*(3-2*x);}}};
const difficulty={hp:1,dmg:1,count:1,interval:1,boss:1,heal:0.35,revive:0.4,reviveDelay:0,behind:0.25,behindFrom:4,shooters:0};
const source=readFileSync(new URL('../world.js',import.meta.url),'utf8');
const biomeStart=source.indexOf('const MAP_STYLES = ['),worldStart=source.indexOf('export function createWorld',biomeStart);
if(biomeStart<0||worldStart<0)throw Error('Seleção de biomas ausente');
const biomeApi=runInNewContext(source.slice(biomeStart,worldStart).replace('export function biomeForSeed','function biomeForSeed')+';({biomeForSeed})');
const biomeCycle=['Pradaria','Outono','Pântano','Crepúsculo'];
for(let seed=1;seed<=8;seed++)if(biomeApi.biomeForSeed(seed)!==biomeCycle[seed%biomeCycle.length])throw Error('Prévia de bioma diverge da semente '+seed);
if(biomeApi.biomeForSeed(11)!=='Pradaria')throw Error('Mapa-base deixou de usar a pradaria');
console.log('Biomas: prévia usa o mesmo ciclo determinístico da semente OK');
const start=source.indexOf('  const zones = new Map();');
if(start<0) throw Error('API de zonas ausente');
const end=source.indexOf('  // ---------- rio,',start);
// Centros curvos e bem separados: exercita coordenadas locais sem carregar a geometria.
const pointAt=s=>new Vector3(Math.sin(s*0.03)*5,0,-s);
const tangentAt=s=>new Vector3(Math.cos(s*0.03)*0.15,0,-1).normalize();
const sideOf=t=>new Vector3(-t.z,0,t.x);
const along=(s,lat)=>pointAt(s).addScaledVector(sideOf(tangentAt(s)),lat);
const anchorS=p=>12+(p-1)*23;
const world=runInNewContext(source.slice(start,end)+';({zoneOf,groundHeight,isShallow,nextWaypoint,canStep})',{THREE,pointAt,tangentAt,sideOf,along,anchorS});
console.log(checkTerrain(world,THREE));
const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const move=main.slice(main.indexOf('  moveTo(target, dt) {'),main.indexOf('  // anima a locomoção'));
world.obstacles=[5,9].map((p)=>({x:world.zoneOf(p).center.x,z:world.zoneOf(p).center.z,r:3.2}));
const Walker=runInNewContext('class Walker {'+move+'}; Walker',{THREE,world,tmp:new Vector3(),moveDir:new Vector3()});
function walk(from,to) {
  const u=new Walker();Object.assign(u,{pos:from.clone(),vel:new Vector3(),speed:3.2,size:1,face:()=>{}});
  let maxY=u.pos.y;
  for(let i=0;i<4000;i++) {
    const next=u.pos.clone().addScaledVector(u.vel,1/60);
    if(world.canStep(u.pos,next))u.pos.copy(next);else u.vel.set(0,0,0);
    u.pos.y=world.groundHeight(u.pos.x,u.pos.z);maxY=Math.max(maxY,u.pos.y);
    u.moveTo(to,1/60);
    if(u.pos.distanceTo(to)<0.2)return {u,maxY};
  }
  throw Error('Trajeto preso: '+JSON.stringify({from,to,at:u.pos,next:world.nextWaypoint(u.pos,to)}));
}
for(const phase of [3,7,10]) {
  const z=world.zoneOf(phase);
  for(const from of [pointAt(anchorS(phase)),...z.ground]) {
    const reached=walk(from,z.top[0]);
    if(reached.maxY<2.9)throw Error('Não subiu pela rampa');
    walk(reached.u.pos,from);
  }
  walk(z.center.clone().addScaledVector(z.fwd,6),z.center.clone().addScaledVector(z.fwd,-11));
  for(const side of [-1,1])for(const offset of [1.51,1.65,1.8]) {
    const beside=z.center.clone().addScaledVector(z.side,side*offset).addScaledVector(z.fwd,-6);
    walk(z.top[0],beside);walk(beside,z.top[0]);
  }
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,beside=z.center.clone().addScaledVector(z.side,Math.cos(a)*4.1).addScaledVector(z.fwd,Math.sin(a)*4.1);
    if(world.groundHeight(beside.x,beside.z)===0)walk(z.top[0],beside);
  }
  const mid = z.ramp.bottom.clone().lerp(z.ramp.top,0.5);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    const ground=z.center.clone().addScaledVector(z.side,Math.cos(a)*7).addScaledVector(z.fwd,Math.sin(a)*11);
    if(world.groundHeight(ground.x,ground.z)!==0)continue;
    walk(z.top[0],ground); walk(ground,mid); walk(mid,ground);
  }
}
for(const phase of [5,9]) {
  const z=world.zoneOf(phase);
  walk(z.center.clone().addScaledVector(z.fwd,7),z.center.clone().addScaledVector(z.fwd,-7));
  for(const from of z.water)walk(from,z.ground[0]);
}
console.log('Movimento real: subida, descida, contorno de platôs e lagos OK');

// Exercita o dano e o disparo diferido reais, com apenas renderização/DOM substituídos.
let enemyShots=0,heroShots=0;
const Unit=runInNewContext(main.slice(main.indexOf('class Unit {'),main.indexOf('const skeletonsAlive ='))+';Unit',{
  THREE,world,tmp:new Vector3(),moveDir:new Vector3(),stepNext:new Vector3(),game:{kills:0},popText:()=>{},audio:{play:()=>{}},fireEnemyBolt:()=>enemyShots++,fireBolt:()=>heroShots++
});
function unit(team='hero') {
  const u=Object.create(Unit.prototype);
  Object.assign(u,{root:{position:new Vector3(),rotation:{y:0},scale:{set:()=>{}}},team,cfg:{id:'paladin'},hp:100,maxHp:100,size:1,vel:new Vector3(),mats:[],mixer:{update:()=>{}},once:()=>1,attackTimer:0,busy:0,flash:0,moving:false});
  return u;
}
const victim=unit('skeleton'),melee=unit();victim.pos.y=3;
victim.takeDamage(20,melee.pos,melee);
if(victim.hp!==100)throw Error('Corpo a corpo acertou outro nível');
melee.ranged=true;victim.takeDamage(20,melee.pos,melee);
if(victim.hp!==80)throw Error('Ataque à distância não acertou outro nível');
const archer=unit('skeleton');archer.ranged=true;archer.pendingHit={target:unit(),t:0.1};
archer.updateCommon(0.2);
if(enemyShots!==1||heroShots!==0)throw Error('Disparo inimigo usou sistema dos heróis');
let shotsBefore=enemyShots;archer.updateCommon(0);
if(enemyShots!==shotsBefore)throw Error('Pausa disparou projétil');
const dry=unit(),wet=unit();dry.speed=wet.speed=3.2;
const lake=world.zoneOf(5);wet.pos.copy(lake.water[0]);
dry.moveTo(dry.pos.clone().addScaledVector(lake.fwd,0.5),1);
wet.moveTo(wet.pos.clone().addScaledVector(lake.fwd,0.5),1);
if(Math.abs(wet.vel.length()/dry.vel.length()-0.6)>0.001)throw Error('Água rasa não reduz velocidade em 40%');
console.log('Combate: níveis, disparo inimigo, pausa e lentidão de 40% OK');

const spawned=[],spawnGame={phase:3,toSpawn:2,bossPending:false};let splashes=0;
Object.assign(world,{anchorS,along,pointAt});
const spawn=runInNewContext(main.slice(main.indexOf('function spawnSkeleton()'),main.indexOf('function updateGame('))+';spawnSkeleton',{
  world,game:spawnGame,ROAD:5,difficulty,waterSplash:()=>splashes++,pickMonster:(_,type)=>type,waveLeader:(_,pending)=>pending?'Warrior':null,
  linkMonsters:()=>{},units:[],heroes:()=>[],allies:()=>[],skeletonsAlive:()=>[],
  scene:{},assets:{},ring:()=>{},beam:()=>{},poof:()=>{},popText:()=>{},showBanner:()=>{},
  Skeleton:class {constructor(type,phase,boss){Object.assign(this,{type,phase,boss,pos:new Vector3(),root:{rotation:{}}});spawned.push(this);}}
});
difficulty.shooters=0.06;
for(const phase of [3,7,10])for(const count of [2,1]) {
  Object.assign(spawnGame,{phase,toSpawn:count});spawn();
  const s=spawned.at(-1);
  if(s.pos.y!==3||s.type!==(count===2?'Crossbow':'Mage'))throw Error('Atirador ausente no topo');
}
difficulty.shooters=0;   // no Fácil o platô não ganha atirador
Object.assign(spawnGame,{phase:3,toSpawn:2});spawn();
if(['Crossbow','Mage'].includes(spawned.at(-1).type))throw Error('Fácil colocou atirador no topo');
for(const phase of [5,9]) {
  Object.assign(spawnGame,{phase,toSpawn:3});spawn();
  const s=spawned.at(-1);if(!world.isShallow(s.pos.x,s.pos.z))throw Error('Não surgiu na água rasa');
}
if(splashes!==2)throw Error('Surgimento sem respingo');
Object.assign(spawnGame,{phase:6,toSpawn:1,bossPending:true});spawn();
if(!spawned.at(-1).boss||spawned.at(-1).type!=='Warrior')throw Error('Chefe alterado');
const h={dead:false,hp:60,maxHp:100,gainXp:()=>{},once:()=>1};
const phaseGame={state:'fight',phase:3,toSpawn:0,over:false,paused:false};let living=[{pos:world.zoneOf(3).top[0]}];
const tick=runInNewContext(main.slice(main.indexOf('function updateGame('),main.indexOf('function endGame('))+';updateGame',{
  game:phaseGame,difficulty,heroes:()=>[h],skeletonsAlive:()=>living,captivePrisoner:()=>null,pressForward:()=>{},showBanner:()=>{},popText:()=>{},setText:()=>{},HEROES:[{}],MAX_PARTY:4,PHASES:12
});
tick(0.1);if(phaseGame.state!=='fight')throw Error('Terminou fase com atirador vivo');
living=[];tick(0.1);if(phaseGame.state!=='cleared')throw Error('Fase não terminou após último inimigo');
const removed=[],enemyBolts=[{mesh:{id:'tiro'}}],resetGame={};let chose=false;
const reset=runInNewContext(main.slice(main.indexOf('function startGame('),main.indexOf('function startPhase()'))+';startGame',{
  clearTimeout:()=>{},showBanner:()=>{},pick:{variants:[0,0,0,0]},THREE,evolutions:[],aiming:null,cancelAim:()=>{},setUserPause:()=>{},audio:{stopMusic:()=>{}},FX:{clear:()=>{}},battleGateId:0,battleLoadingVisible:false,
  closeHeroPanel:()=>{},clearMonsterFx:()=>{},document:{body:{classList:{add:()=>{}}}},PHASES:12,location:{search:''},URLSearchParams,$:()=>({style:{},classList:{add:()=>{},remove:()=>{},toggle:()=>{}},innerHTML:''}),
  enemyBolts,bolts:[],blasts:[],flames:[],fx:[],scene:{remove:m=>removed.push(m)},bars:{querySelectorAll:()=>[]},units:[],game:resetGame,world,
  follow:new Vector3(),controls:{target:new Vector3()},camera:{position:new Vector3()},showMenu:()=>{chose=true;},renderRelicTray:()=>{}
});
reset();if(enemyBolts.length||removed[0]?.id!=='tiro'||resetGame.phase!==1||!chose)throw Error('Reinício deixou projétil ou não abriu escolha');
console.log('Fases: surgimento no topo/água, chefe, último inimigo e reinício OK');
