// node cavaleiros/tests/rodada2.cjs — lógica real, sem rede e sem dependências.
// Cena e DOM são duplos; peças e animações são conferidas nos GLB reais.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
const recipes = fs.readFileSync(path.join(dir, 'characters.js'), 'utf8');
const monsters = fs.readFileSync(path.join(dir, 'monsters.js'), 'utf8');
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
const el=()=>({ style:{setProperty:noop}, classList:{add:noop,remove:noop,toggle:noop}, children:[], setAttribute:noop,
  append(...c){ this.children.push(...c); },
  appendChild(c){ this.children.push(c); }, addEventListener:noop, querySelector:()=>el(), querySelectorAll:()=>[el(),el()],
  remove:noop, firstChild:{style:{}}, innerHTML:'', textContent:'' });
const elements=new Map();
const color=()=>({set:noop,setHex:noop});
const material=()=>({color:color(),emissive:color(),dispose:noop});
const root=()=>({position:new Vector3(),rotation:{y:0},scale:new Vector3(1,1,1),quaternion:{setFromUnitVectors:noop},
  traverse:noop,add:noop,removeFromParent:noop,getObjectByName:()=>({add:noop}),material:material(),children:[],rotateZ:noop});
const action=()=>({reset(){return this},setLoop(){return this},play(){return this},crossFadeFrom:noop,getClip:()=>({duration:1,name:'Idle'})});
const THREE = new Proxy({ Vector3, Mesh:class {constructor(){Object.assign(this,root())}}, Group:class {constructor(){Object.assign(this,root())}},
  MeshBasicMaterial:class {constructor(){Object.assign(this,material())}}, MeshLambertMaterial:class {constructor(){Object.assign(this,material())}},
  AnimationMixer:class {constructor(){this.time=0}update(dt){this.time+=dt}clipAction(){return action()}stopAllAction(){}},
  AnimationClip:{findByName:(_,name)=>({name,duration:1})}, Clock:class{getDelta(){return .016}},
  MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(v,b))}, LoopOnce:1, LoopRepeat:2, RingGeometry:class{}, DoubleSide:2 }, { get:(o,k)=>k in o?o[k]:class{constructor(){Object.assign(this,root())}} });
const context=vm.createContext({THREE,document:{createElement:el,getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)}},
  addEventListener:noop,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,innerWidth:1440,innerHeight:1000,
  URLSearchParams,location:{search:''},
  localStorage:{data:{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=String(v)}},
  SKY:[],HEMI:[],HEMI_GROUND:[],SUN:[],hemi:{color:{lerpColors:noop},groundColor:{lerpColors:noop}},
  SkeletonUtils:{clone:root}, scene:{add:noop,remove:noop,background:{lerpColors:noop},fog:{color:{copy:noop}}}, assets:{}, ringGeo:{},haloGeo:{},goldMat:{},starGeo:{},
  boltGeo:{},axeGeo:{},bladeGeo:{},handleGeo:{},flameGeo:{},groundGeo:{},boltMats:{viking:{},iceviking:{},arcane:{},pyro:{}},
  newStats:()=>({}),openHeroPanel:noop,closeHeroPanel:noop,panelHero:()=>null,tickHeroPanel:noop,summaryHTML:()=>'', LOOKS:{}, applyLook:noop,
  renderer:{render:noop,domElement:{addEventListener:noop}}, camera:{position:new Vector3()}, sun:{position:new Vector3(),target:{position:new Vector3()},color:{lerpColors:noop}},
  follow:new Vector3(),controls:{target:new Vector3(),update:noop}, world:{obstacles:[],pointAt:s=>new Vector3(0,0,-s),
    tangentAt:()=>new Vector3(0,0,-1),sideOf:()=>new Vector3(1,0,0),anchorS:p=>p*10,along:(s,x)=>new Vector3(x,0,-s),update:noop,canStep:()=>true,groundHeight:()=>0,isShallow:()=>false,nextWaypoint:(a,b)=>b,zoneOf:()=>null,gloomAt:()=>0},
  poof:noop,ring:noop,beam:noop,popText:noop, colors:{arcane:0}, bolts:[],blasts:[],flames:[],fx:[],updateFx:noop,
  fireBolt:(from,target,kind)=>context.bolts.push({from,target,kind}),updateBolts:noop});
const part=(text,a,b)=>text.slice(text.indexOf(a),text.indexOf(b));
vm.runInContext(part(recipes,'export const CHARACTERS','// arquivos').replace('export ',''),context);
vm.runInContext(monsters.replace(/^import .*$/gm,'').replace(/^export /gm,''),context);
vm.runInContext(part(source,'const ROAD','// ---------- cena'),context);
vm.runInContext(part(source,'const $','// retrato de cada'),context);
vm.runInContext(part(source,'const units =','// projéteis e áreas'),context);
vm.runInContext(part(source,'function fireBolt','// ---------- efeitos'),context);
vm.runInContext(part(source,'class Hero','// empurra unidades'),context);
vm.runInContext(part(source,'// empurra unidades','// ---------- fases'),context);
vm.runInContext(part(source,'// ---------- fases',"addEventListener('resize'"),context);
vm.runInContext('globalThis.t={Hero,Skeleton,Minion,Unit,VARIANTS,CHARACTERS,units,heroes,game,pick,evolutions,UPGRADES,showPick,selectCard,moveGrid,confirmPick,showEvolution,confirmEvolution,arrangeParty,damageCleave,startGame,DIFFICULTIES,showDifficulty,loadRecords,setDifficulty:i=>{difficulty=DIFFICULTIES[i]},getDifficulty:()=>difficulty,startPhase,spawnSkeleton,updateGame,endGame,frame,MONSTER_TYPES,updateMonsterFx,clearMonsterFx,dangerAt,pickMonster,waveLeader,skeletonsAlive,separate};',context);
const t=context.t;
const cfg=id=>t.VARIANTS.find(v=>v.id===id);
for(const v of t.VARIANTS) v.built={scene:{},animations:[]},v.portraits=['1','2','3'];
for(const n of ['Minion','Warrior','Rogue','Mage']) context.assets['Skeleton_'+n]={scene:{},animations:[]};
for(const n of ['Skeleton_Blade','Skeleton_Axe','Skeleton_Shield_Small_A','Skeleton_Staff']) context.assets[n]={scene:{clone:root}};
const results=[];
function test(name,fn){fn();results.push(name);console.log('OK:',name)}
function clear(){for(const u of [...t.units])u.remove();t.evolutions.length=0;t.pick.open=false;Object.assign(t.game,{over:false,paused:false,state:'fight',guideS:10});}
test('16 variantes, receitas e animações existentes nos GLB',()=>{
  assert.equal(t.VARIANTS.length,16);
  const glb=n=>{const f=path.join(dir,'assets',n+'.glb');if(!fs.existsSync(f))return JSON.parse(fs.readFileSync(path.join(dir,'assets',n+'.gltf'),'utf8'));const b=fs.readFileSync(f);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};
  for(const v of t.VARIANTS){
    const g=glb(v.recipe?.base||v.model),clips=g.animations.map(a=>a.name);
    for(const clip of [v.idle,...v.attacks,'Death_A','Block_Hit','Spellcast_Raise','Cheer','Throw']) assert.ok(clips.includes(clip),v.id+': '+clip);
    if(v.recipe) for(const add of v.recipe.add) assert.ok(glb(add.from).nodes.some(n=>n.name.replaceAll('.','')===add.part));
  }
});
test('variantes repetem classe, pulam ocupadas e usam postos distintos',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));t.arrangeParty();
  assert.ok(a.post.distanceTo(b.post)>1);t.showPick('','');assert.equal(t.pick.options.length,16);
  const at=id=>t.pick.options.findIndex(v=>v.id===id);
  for(const id of ['pyro','arcane'])assert.ok(t.pick.cards[at(id)].innerHTML.includes('No grupo'));
  assert.ok(!t.pick.cards[at('cryo')].innerHTML.includes('No grupo'));
  t.confirmPick(at('pyro'));assert.equal(t.pick.open,true);
  t.selectCard(at('paladin'));t.moveGrid(0,1);assert.equal(t.pick.sel,at('berserker'));
  t.moveGrid(0,1);assert.equal(t.pick.sel,at('cryo'));t.moveGrid(-1,0);assert.equal(t.pick.sel,at('necro'));
  t.moveGrid(1,0);assert.equal(t.pick.sel,at('cryo'));
});
test('evoluções simultâneas pausam em fila e oferecem três opções distintas',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));a.gainXp(350);b.gainXp(90);
  assert.equal(t.evolutions.length,3);assert.equal(a.level,3);assert.ok(Math.abs(a.dmg-24*1.1**2)<.001);
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
  cast(king);assert.equal(druid.royalT,5);assert.equal(druid.royalBonus,.2);
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
  context.updateBolts(.25);assert.equal(a.hp,a.maxHp-29);assert.equal(b.hp,b.maxHp-29);assert.equal(a.slowT,3);assert.equal(b.slowT,3);
});
test('cleave frontal limita raio, dano secundário e recuo',()=>{
  clear();const h=new t.Hero(cfg('crusher'));h.pos.set(0,0,0);h.root.rotation.y=0;
  const enemy=(x,z)=>{const u=new t.Skeleton('Minion',1);u.spawning=false;u.pos.set(x,0,z);u.hp=1000;return u};
  const a=enemy(0,1.8),b=enemy(1,1.5),back=enemy(0,-1.8),far=enemy(0,2.3);
  t.damageCleave(h,a);assert.equal(a.hp,969);assert.equal(b.hp,981.4);assert.equal(back.hp,1000);assert.equal(far.hp,1000);
  assert.ok(b.vel.length()<a.vel.length());
});
test('fim de jogo mantém animação e impede dano e golpes pendentes',()=>{
  clear();const h=new t.Hero(cfg('king'));h.die();t.endGame('Derrota');const before=h.mixer.time;
  const enemy=new t.Skeleton('Minion',1),hp=enemy.hp;enemy.takeDamage(100,h.pos);assert.equal(enemy.hp,hp);
  let hit=false;enemy.pendingHit={t:0,effect:()=>{hit=true}};t.frame();assert.ok(h.mixer.time>before);assert.equal(hit,false);
});
test('reinício limpa invocados, fila, efeitos e volta à tela de dificuldade',()=>{
  clear();const h=new t.Hero(cfg('necro'));new t.Minion(h,1);h.gainXp(90);t.showEvolution();t.startGame();
  assert.equal(t.units.length,0);assert.equal(t.evolutions.length,0);assert.equal(t.pick.mode,'difficulty');assert.equal(t.pick.open,true);assert.equal(t.game.paused,true);
  assert.equal(t.pick.cards.length,4);
  let next;context.setTimeout=(fn,ms)=>{if(ms===550)next=fn};
  t.confirmPick(2);assert.equal(t.getDifficulty().id,'dificil');assert.equal(elements.get('level').textContent,'Difícil');
  next();assert.equal(t.pick.mode,'hero');assert.equal(t.pick.open,true);
  context.setTimeout=noop;t.setDifficulty(1);
});
test('dificuldade escala esqueletos e ondas; Pesadelo segura o caído uma fase',()=>{
  clear();t.setDifficulty(0);const easy=new t.Skeleton('Warrior',1).maxHp;
  t.setDifficulty(3);const hard=new t.Skeleton('Warrior',1);assert.ok(hard.maxHp>easy*1.5&&hard.dmg>11);
  Object.assign(t.game,{phase:4});t.startPhase();assert.equal(t.game.toSpawn,Math.round(10*t.getDifficulty().count));assert.ok(t.game.toSpawn>10);
  for(const u of [...t.units])u.remove();
  const a=new t.Hero(cfg('paladin')),b=new t.Hero(cfg('pyro'));Object.assign(t.game,{phase:3});b.die();
  Object.assign(t.game,{state:'fight',toSpawn:0});t.updateGame(.1);assert.equal(b.dead,true);
  Object.assign(t.game,{phase:4,state:'fight',toSpawn:0});t.updateGame(.1);assert.equal(b.dead,false);assert.equal(b.hp,b.maxHp*.25);
  t.setDifficulty(1);
});
test('recorde guarda a melhor fase por dificuldade e marca vitória',()=>{
  clear();context.localStorage.data={};Object.assign(t.game,{start:1,phase:5,kills:40});t.endGame('Derrota',false);
  assert.ok(elements.get('overlayText').textContent.includes('Novo recorde'));
  Object.assign(t.game,{over:false,phase:3,kills:90});t.endGame('Derrota',false);assert.equal(t.loadRecords().normal.phase,5);
  Object.assign(t.game,{over:false,phase:12,kills:200});t.endGame('Vitória',true);assert.equal(t.loadRecords().normal.won,true);
  Object.assign(t.game,{over:false,start:6,phase:12,kills:999});t.endGame('Vitória',true);assert.equal(t.loadRecords().normal.kills,200);
  t.showDifficulty();assert.ok(t.pick.cards[1].innerHTML.includes('Vitória!'));assert.ok(t.pick.cards[0].innerHTML.includes('Sem recorde'));
});
test('entrada tardia recebe metade da média de XP e respeita limite de quatro',()=>{
  clear();const a=new t.Hero(cfg('paladin')),b=new t.Hero(cfg('berserker'));a.xp=300;b.xp=100;
  let confirm;context.setTimeout=(fn,ms)=>{if(ms===550)confirm=fn};
  t.showPick('','');t.confirmPick(t.pick.options.findIndex(v=>v.id==='pyro'));assert.ok(confirm);confirm();
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
const cMath=vm.runInContext('Math',context);   // o sorteio do jogo é o Math do contexto
const foe=(type,x,z,boss=false)=>{const u=new t.Skeleton(type,6,boss);u.spawning=false;u.busy=0;u.pos.set(x,0,z);return u};
const hero=(id,x,z)=>{const h=new t.Hero(cfg(id));h.pos.set(x,0,z);h.post.copy(h.pos);return h};   // posto no lugar: não volta à formação
const tick=(dt,n=1)=>{for(let i=0;i<n;i++){for(const u of [...t.units])u.update(dt);context.updateEnemyBolts(dt)}};
test('monstros novos usam animações que existem nos GLB',()=>{
  const glb=n=>{const b=fs.readFileSync(path.join(dir,'assets',n+'.glb'));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()).animations.map(a=>a.name)};
  const used=['Blocking','Block_Hit','Block','Use_Item','Spellcast_Raise','Spellcast_Summon','Spellcast_Shoot','Spellcasting','Death_C_Skeletons_Resurrect','Jump_Idle','Spawn_Air','1H_Melee_Attack_Stab','1H_Melee_Attack_Jump_Chop','2H_Melee_Attack_Chop','Taunt','Running_C'];
  for(const [type,m] of Object.entries(t.MONSTER_TYPES)){const clips=glb('Skeleton_'+m.model);for(const c of used)assert.ok(clips.includes(c),type+': '+c)}
  for(const c of ['Lie_Down','Lie_StandUp'])assert.ok(glb('Knight').includes(c));
});
test('escudeiro bloqueia pela frente; pelas costas entra tudo',()=>{
  clear();t.clearMonsterFx();const s=foe('Shieldbearer',0,0);s.root.rotation.y=0;s.hp=s.maxHp=1000;
  s.takeDamage(100,new Vector3(0,0,3));assert.equal(s.hp,945);s.busy=0;s.takeDamage(100,new Vector3(0,0,-3));assert.equal(s.hp,845);
});
test('bombardeiro acende o pavio perto do herói e explode em área; morto perto também explode',()=>{
  clear();t.clearMonsterFx();const rnd=cMath.random;cMath.random=()=>.99;const h=hero('berserker',0,0);const hp=h.hp;
  const b=foe('Bomber',0,1.2);tick(.05);assert.ok(b.cast?.alive);tick(.1,12);assert.equal(b.dead,true);assert.ok(h.hp<hp);
  const hp2=h.hp,c=foe('Bomber',0,1.5);c.takeDamage(999,h.pos);assert.equal(c.dead,true);tick(.1,6);cMath.random=rnd;assert.ok(h.hp<hp2);
});
test('sacerdote cura esqueletos próximos e reergue um caído',()=>{
  clear();t.clearMonsterFx();const h=hero('pyro',0,0);
  const p=foe('Priest',0,6),w=foe('Warrior',1,6);w.hp=10;p.cd.heal=0;p.cd.revive=99;tick(.1);tick(.1,6);assert.ok(w.hp>10);
  const m=foe('Minion',-1,6);m.die();p.busy=0;p.cd.revive=0;p.cd.heal=99;const before=t.skeletonsAlive().length;tick(.1);tick(.1,14);
  assert.equal(t.skeletonsAlive().length,before+1);
});
test('fantasma flutua e atravessa o grupo atrás de quem atira',()=>{
  clear();t.clearMonsterFx();const front=hero('paladin',0,2),back=hero('pyro',0,-2);
  const g=foe('Ghost',0,8);g.hp=g.maxHp=1e4;for(let i=0;i<80;i++){tick(.05);t.separate()}
  assert.ok(g.hover>0.2&&g.pos.y>0.2);assert.ok(g.pos.distanceTo(back.pos)<g.pos.distanceTo(front.pos));
});
test('pancada do Rei avisa no chão, derruba e quem percebe o aviso foge',()=>{
  clear();t.clearMonsterFx();const h=hero('crusher',0,1.5);
  const k=foe('King',0,0,true);k.cd={slam:0,summon:99,charge:99};const rnd=cMath.random;cMath.random=()=>.99;   // ninguém percebe
  tick(.05);assert.ok(t.dangerAt(h)===null);const hp=h.hp;tick(.1,16);cMath.random=rnd;assert.ok(h.hp<hp);assert.ok(h.busy>0);
  t.clearMonsterFx();k.cd.slam=0;k.busy=0;h.busy=0;h.pos.set(0,0,1.5);cMath.random=()=>0;tick(.05);const away=t.dangerAt(h);cMath.random=rnd;
  assert.ok(away&&away.distanceTo(k.pos)>3);
});
test('Lich: escudo absorve e ao quebrar deixa zonzo; abaixo de 50% entra na fase 2',()=>{
  clear();t.clearMonsterFx();const h=hero('pyro',0,0);const l=foe('Lich',0,6,true);
  const shield=l.shieldHp;assert.ok(shield>0);l.takeDamage(shield/2,h.pos);assert.equal(l.hp,l.maxHp);
  l.takeDamage(shield,h.pos);assert.equal(l.shieldHp,0);assert.ok(l.stunT>0);l.takeDamage(10,h.pos);assert.equal(l.hp,l.maxHp-10);
  l.hp=l.maxHp*.4;l.stunT=0;tick(.05);assert.equal(l.enraged,true);
});
test('chefes e golem fecham as ondas certas; tipos novos entram aos poucos',()=>{
  assert.equal(t.waveLeader(6,true),'King');assert.equal(t.waveLeader(12,true),'Lich');assert.equal(t.waveLeader(8,false),'Golem');assert.equal(t.waveLeader(3,false),null);
  t.clearMonsterFx();for(let i=0;i<50;i++)assert.equal(t.pickMonster(1,'Minion'),'Minion');
  assert.equal(t.pickMonster(2,'Minion'),'Shieldbearer');for(let i=0;i<50;i++)assert.ok(['Minion','Shieldbearer'].includes(t.pickMonster(2,'Minion')));
  t.clearMonsterFx();const seen=new Set();for(let i=0;i<300;i++)seen.add(t.pickMonster(12,'Minion'));for(const k of ['Shieldbearer','Bomber','Ghost'])assert.ok(seen.has(k),k);
});
console.log(results.length+' verificações passaram.');
