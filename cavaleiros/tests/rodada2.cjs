// node cavaleiros/tests/rodada2.cjs — lógica real, sem rede e sem dependências.
// Cena e DOM são duplos; peças e animações são conferidas nos GLB reais.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
const recipes = fs.readFileSync(path.join(dir, 'characters.js'), 'utf8');
const campaign = fs.readFileSync(path.join(dir, 'campaign.js'), 'utf8');
const classInfo = fs.readFileSync(path.join(dir, 'class-info.js'), 'utf8');
const skillbook = fs.readFileSync(path.join(dir, 'skillbook.js'), 'utf8');
const skillTargeting = fs.readFileSync(path.join(dir, 'skill-targeting.js'), 'utf8');
const synergies = fs.readFileSync(path.join(dir, 'synergies.js'), 'utf8');
const upgradeBranches = fs.readFileSync(path.join(dir, 'upgrade-branches.js'), 'utf8');
const battleReport = fs.readFileSync(path.join(dir, 'battle-report.js'), 'utf8');
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
  setLength(l) { const n=Math.hypot(this.x,this.y,this.z)||1; return this.multiplyScalar(l/n); }
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
const el=()=>{ const cls=new Set(); return { style:{setProperty:noop}, classList:{add:(...c)=>c.forEach(x=>cls.add(x)),remove:(...c)=>c.forEach(x=>cls.delete(x)),
  toggle:(c,on)=>((on??!cls.has(c))?cls.add(c):cls.delete(c)),contains:c=>cls.has(c)}, children:[], setAttribute:noop,
  append(...c){ this.children.push(...c); }, prepend:noop,
  appendChild(c){ this.children.push(c); }, addEventListener:noop, querySelector:()=>el(), querySelectorAll:()=>[el(),el()],
  remove:noop, firstChild:{style:{}}, innerHTML:'', textContent:'' }; };
const elements=new Map();
const color=()=>({set:noop,setHex:noop});
const material=()=>({color:color(),emissive:color(),dispose:noop,clone:material});
const root=()=>({position:new Vector3(),rotation:{y:0,set:noop},scale:new Vector3(1,1,1),quaternion:{setFromUnitVectors:noop},
  traverse:noop,add:noop,removeFromParent:noop,getObjectByName:()=>({add:noop,rotation:{z:0}}),material:material(),children:[],rotateZ:noop});
const geometry=()=>({attributes:{position:{needsUpdate:false,setXYZ:noop}},setFromPoints(){return this},computeBoundingSphere:noop,dispose:noop});
const action=()=>({reset(){return this},setLoop(){return this},play(){return this},crossFadeFrom:noop,getClip:()=>({duration:1,name:'Idle'})});
const THREE = new Proxy({ Vector3, Mesh:class {constructor(){Object.assign(this,root())}}, Group:class {constructor(){Object.assign(this,root())}},
  Line:class {constructor(geometry,material){Object.assign(this,root(),{geometry,material,visible:false})}},
  BufferGeometry:class {constructor(){Object.assign(this,geometry())}setFromPoints(){return this}},
  LineBasicMaterial:class {constructor(){Object.assign(this,material())}},
  MeshBasicMaterial:class {constructor(){Object.assign(this,material())}}, MeshLambertMaterial:class {constructor(){Object.assign(this,material())}},
  AnimationMixer:class {constructor(){this.time=0}update(dt){this.time+=dt}clipAction(){return action()}stopAllAction(){}},
  AnimationClip:{findByName:(_,name)=>({name,duration:1})}, Clock:class{getDelta(){return .016}},
  MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(v,b))}, LoopOnce:1, LoopRepeat:2, RingGeometry:class{}, DoubleSide:2,
  Color:class{}, CylinderGeometry:class{}, SphereGeometry:class{}, TorusGeometry:class{} }, { get:(o,k)=>k in o?o[k]:class{constructor(){Object.assign(this,root())}} });
const context=vm.createContext({THREE,document:{createElement:el,body:el(),getElementById:(id)=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)}},
  addEventListener:noop,removeEventListener:noop,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,innerWidth:1440,innerHeight:1000,aiming:null,battleGateId:0,battleLoadingVisible:false,
  URLSearchParams,location:{search:''},
  biomeForSeed:seed=>seed===11?'Pradaria':['Pradaria','Outono','Pântano','Crepúsculo'][Math.abs(Math.trunc(seed))%4],
  localStorage:{data:{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=String(v)}},
  SKY:[],HEMI:[],HEMI_GROUND:[],SUN:[],hemi:{color:{lerpColors:noop},groundColor:{lerpColors:noop}},
  SkeletonUtils:{clone:root}, scene:{add:noop,remove:noop,background:{lerpColors:noop},fog:{color:{copy:noop}}}, assets:{}, ringGeo:{},haloGeo:{},goldMat:{},starGeo:{},
  boltGeo:{},axeGeo:{},bladeGeo:{},handleGeo:{},flameGeo:{},groundGeo:{},boltMats:{viking:{},iceviking:{},arcane:{},pyro:{}},
  newStats:()=>({}),openHeroPanel:noop,closeHeroPanel:noop,panelHero:()=>null,tickHeroPanel:noop,summaryHTML:()=>'', LOOKS:{}, applyLook:noop,
  renderer:{render:noop,domElement:{addEventListener:noop}}, camera:{position:new Vector3()}, sun:{position:new Vector3(),target:{position:new Vector3()},color:{lerpColors:noop}},
  follow:new Vector3(),cam:{zoom:1,userDist:0,wheel:false},controls:{target:new Vector3(),update:noop}, world:{obstacles:[],pointAt:s=>new Vector3(0,0,-s),
    tangentAt:()=>new Vector3(0,0,-1),sideOf:()=>new Vector3(1,0,0),anchorS:p=>p*10,along:(s,x)=>new Vector3(x,0,-s),update:noop,canStep:()=>true,groundHeight:()=>0,isShallow:()=>false,nextWaypoint:(a,b)=>b,zoneOf:()=>null,gloomAt:()=>0},
  poof:noop,ring:noop,beam:noop,popText:noop, colors:{arcane:0}, bolts:[],blasts:[],flames:[],fx:[],updateFx:noop,
  wave:noop,burst:noop,column:noop,
  fireBolt:(from,target,kind)=>context.bolts.push({from,target,kind}),updateBolts:noop,
  // efeitos visuais, som e barra de habilidades ficam fora dos trechos carregados
  FX:new Proxy({},{get:(_,k)=>k==='jolt'?()=>new Vector3():noop}),audio:new Proxy({},{get:()=>noop}),updateSkillBar:noop});
const part=(text,a,b)=>text.slice(text.indexOf(a),text.indexOf(b));
vm.runInContext(part(recipes,'export const CHARACTERS','// arquivos').replace('export ',''),context);
vm.runInContext(campaign.replaceAll('export ',''),context);
vm.runInContext(classInfo.replaceAll('export ',''),context);
vm.runInContext(skillbook.replace(/^import .*$/gm,'').replaceAll('export ',''),context);
vm.runInContext(skillTargeting.replaceAll('export ',''),context);
vm.runInContext(synergies.replaceAll('export ',''),context);
vm.runInContext(upgradeBranches.replaceAll('export ',''),context);
vm.runInContext(battleReport.replaceAll('export ',''),context);
vm.runInContext(monsters.replace(/^import .*$/gm,'').replace(/^export /gm,''),context);
vm.runInContext(part(source,'const ROAD','// ---------- cena'),context);
vm.runInContext(part(source,'const $','// retrato de cada'),context);
vm.runInContext(part(source,'const units =','// projéteis e áreas'),context);
vm.runInContext(part(source,'function fireBolt','// ---------- efeitos'),context);
// Carrega heróis, inimigos e separação física até o bloco de fases.
vm.runInContext(part(source,'class Hero','// ---------- fases'),context);
vm.runInContext(part(source,'// ---------- fases',"addEventListener('resize'"),context);
vm.runInContext('globalThis.t={Hero,Skeleton,Minion,Unit,HEROES,CLASSES,VARIANTS,CHARACTERS,units,heroes,game,pick,evolutions,UPGRADES,showPick,selectCard,moveGrid,confirmPick,showEvolution,confirmEvolution,arrangeParty,SKILL_MOVES,loadAuto,loadAutoSlot,saveAuto,skillSetFor,cooldownForSkill,aimSpec,validAim,damageCleave,startGame,DIFFICULTIES,showDifficulty,loadRecords,setDifficulty:i=>{difficulty=DIFFICULTIES[i]},getDifficulty:()=>difficulty,startPhase,spawnSkeleton,updateGame,updateBars,endGame,frame,frameTargetContext,MISSIONS,UNLOCKS,STARTERS,totalStars,variantOpen,starsToUnlock,showMenu,Villager,Totem,skeletonsAlive,starsOf,unlocked,saveMissionRecord,missionRecords,setMission:m=>{game.mission=m},MONSTER_TYPES,updateMonsterFx,clearMonsterFx,dangerAt,pickMonster,waveLeader,campaignThreats,separate,chooseHeroTarget,heroTargetScore,highestPriorityHeroTarget,bestSkillTarget,skillTargetScore,teamCoverage,missionRoleNeeds,fireBolt,updateBolts,bolts};',context);
vm.runInContext('t.world=world;',context);
const t=context.t;
vm.runInContext('t.missionProgress=missionProgress;',context);
vm.runInContext('t.makeTargetContext=makeTargetContext;',context);
const cfg=id=>t.VARIANTS.find(v=>v.id===id);
for(const v of t.VARIANTS) v.built={scene:{},animations:[]},v.portraits=['1','2','3'];
for(const n of ['Minion','Warrior','Rogue','Mage']) context.assets['Skeleton_'+n]={scene:{},animations:[]};
context.assets.Barbarian={scene:{},animations:[]};
context.location={search:'?tudo=1'};   // os testes antigos usam todas as variantes
for(const n of ['Skeleton_Blade','Skeleton_Axe','Skeleton_Shield_Small_A','Skeleton_Staff','Skeleton_Crossbow']) context.assets[n]={scene:{clone:root}};
const results=[];
function test(name,fn){fn();results.push(name);console.log('OK:',name)}
function clear(){for(const u of [...t.units])u.remove();t.evolutions.length=0;t.pick.open=false;Object.assign(t.game,{over:false,paused:false,state:'fight',guideS:10,mission:null,last:12,picksLeft:0,falls:0,fallLog:[],runTime:0,damageSources:{},missionT:0,villager:null,test:false});}
test('barras de vida pausam sob overlays e só atualizam quando mudam',()=>{
  clear();const hero=new t.Hero(cfg('paladin'));hero.pos.set(0,0,-4);t.updateBars();
  const transform=hero.bar.style.transform,width=hero.bar.firstChild.style.width;
  assert.ok(transform);assert.equal(width,'100%');
  t.game.paused=true;hero.pos.x+=10;hero.hp-=hero.maxHp*.5;t.updateBars();
  assert.equal(hero.bar.style.transform,transform);assert.equal(hero.bar.firstChild.style.width,width);
  t.game.paused=false;t.updateBars();
  assert.notEqual(hero.bar.style.transform,transform);assert.equal(hero.bar.firstChild.style.width,'50%');
  const settled=hero.bar.style.transform;hero.pos.x+=0.0001;t.updateBars();assert.equal(hero.bar.style.transform,settled);
  hero.pos.z=10;t.updateBars();assert.equal(hero.bar.style.display,'none');
  hero.pos.z=-4;t.updateBars();assert.equal(hero.bar.style.display,'');
  clear();
});
test('20 variantes, receitas e animações existentes nos GLB',()=>{
  assert.equal(t.VARIANTS.length,20);
  const glb=n=>{const f=path.join(dir,'assets',n+'.glb');if(!fs.existsSync(f))return JSON.parse(fs.readFileSync(path.join(dir,'assets',n+'.gltf'),'utf8'));const b=fs.readFileSync(f);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};
  for(const v of t.VARIANTS){
    const g=glb(v.recipe?.base||v.model),clips=g.animations.map(a=>a.name);
    for(const clip of [v.idle,...v.attacks,'Death_A','Block_Hit',t.SKILL_MOVES[v.id][0],'Dualwield_Melee_Attack_Stab']) assert.ok(clips.includes(clip),v.id+': '+clip);
    if(v.recipe) for(const add of v.recipe.add) assert.ok(glb(add.from).nodes.some(n=>n.name.replaceAll('.','')===add.part));
  }
});
test('classes agrupam apoio, dão categoria própria à natureza e Bardo usa silhueta leve',()=>{
  assert.equal(t.HEROES.length,7);assert.equal(t.CLASSES.length,7);
  for(const [id,classId] of [['cleric',4],['bard',4],['angel',4],['druid',5],['chronist',6]])assert.equal(cfg(id).classId,classId,id);
  assert.equal(cfg('cleric').recipe.base,'Mage');assert.ok(cfg('cleric').recipe.add.some(a=>a.part==='2H_Staff'));
  assert.notEqual(cfg('druid').classId,3,'Druida deve sair da categoria Ladino');assert.equal(t.CLASSES[5].name,'Druida');
  assert.equal(cfg('bard').recipe.base,'Rogue');assert.ok(cfg('bard').recipe.extras.some(e=>e.type==='lute'));
});
test('composição equilibrada mostra cobertura e papéis que ainda faltam',()=>{
  const balanced=t.teamCoverage(['paladin','guardian','pyro','cleric'].map(cfg));
  assert.deepEqual(Array.from(balanced.missing),[]);
  const partial=t.teamCoverage(['pyro','arcane'].map(cfg));
  assert.deepEqual(Array.from(partial.missing),['Defesa','Cura','Controle']);
  assert.equal(partial.roles.find(role=>role.name==='Área').count,2);
  assert.deepEqual(Array.from(t.missionRoleNeeds({type:'escort'})),['Defesa','Cura','Controle']);
  assert.deepEqual(Array.from(t.missionRoleNeeds({type:'boss'})),['Defesa','Cura','Dano a chefe']);
  assert.deepEqual(Array.from(t.missionRoleNeeds({type:'totems'})),['À distância','Controle','Área']);
  const bossDamage=t.teamCoverage(['champion','assassin','viking'].map(cfg));
  assert.equal(bossDamage.roles.find(role=>role.name==='Dano a chefe').count,3);
});
test('Anjo tem asas animadas e paira acima do chão',()=>{
  clear();const angel=new t.Hero(cfg('angel'));
  assert.equal(angel.hover,0.52);assert.equal(cfg('angel').idle,'Jump_Idle');
  assert.ok(t.CHARACTERS.find(c=>c.id==='angel').extras.some(e=>e.type==='wings'));
  assert.match(recipes,/wing\.userData\.wingFlap/);
});
test('navegação respeita as linhas de classe, pula ocupadas e usa postos distintos',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));t.arrangeParty();
  assert.ok(a.post.distanceTo(b.post)>1);t.showPick('','');assert.equal(t.pick.options.length,20);
  const at=id=>t.pick.options.findIndex(v=>v.id===id);
  assert.equal(t.pick.cards[at('cryo')].tabIndex,0);
  assert.ok(t.pick.cards[at('cryo')].innerHTML.includes('pick-card-role'));
  t.pick.cards[at('cryo')].onclick();
  assert.equal(t.pick.sel,at('cryo'),'clicar no cartão deve atualizar a prévia sem confirmar');
  assert.equal(t.pick.open,true);
  const selectButton=t.pick.info.children.find(child=>child.className==='hero-select-btn');
  assert.ok(selectButton);assert.equal(selectButton.disabled,false);
  selectButton.onclick();assert.equal(t.pick.open,false,'o botão confirma o herói em foco');
  t.showPick('','');
  for(const id of ['pyro','arcane'])assert.ok(t.pick.cards[at(id)].innerHTML.includes('No grupo'));
  assert.ok(!t.pick.cards[at('cryo')].innerHTML.includes('No grupo'));
  assert.ok(t.pick.info.innerHTML.includes('Equipe se escolher')&&t.pick.info.innerHTML.includes('class="candidate"')
    &&t.pick.info.innerHTML.includes('Controle')&&t.pick.info.innerHTML.includes('Nas próximas vagas'));
  t.confirmPick(at('pyro'));assert.equal(t.pick.open,true);
  t.selectCard(at('paladin'));t.moveGrid(0,1);assert.equal(t.pick.sel,at('berserker'));
  t.moveGrid(0,1);assert.equal(t.pick.sel,at('cryo'));t.moveGrid(-1,0);assert.equal(t.pick.sel,at('necro'));
  t.moveGrid(1,0);assert.equal(t.pick.sel,at('cryo'));
});
test('escolha na campanha mostra objetivo e papéis prioritários projetados',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data,previousMission=t.game.mission;
  clear();context.location={search:''};context.localStorage.data={};t.setMission(t.MISSIONS.find(m=>m.id==='ponte'));
  t.showPick('','');const at=id=>t.pick.options.findIndex(hero=>hero.id===id);t.selectCard(at('paladin'));
  assert.ok(t.pick.info.innerHTML.includes('Proteja o aldeão'));
  assert.ok(t.pick.info.innerHTML.includes('priority')&&t.pick.info.innerHTML.includes('Para esta missão, priorize: Controle.'));
  t.selectCard(at('pyro'));
  assert.ok(t.pick.info.innerHTML.includes('Para esta missão, priorize: Defesa · Cura · Controle.'));
  t.setMission(t.MISSIONS.find(m=>m.id==='fazendas'));t.selectCard(at('assassin'));
  assert.ok(t.pick.info.innerHTML.includes('Derrote o chefe')&&t.pick.info.innerHTML.includes('class="covered priority">Dano a chefe<b>1</b>'));
  clear();context.location=previousLocation;context.localStorage.data=previousStorage;t.setMission(previousMission);
});
test('prévia da equipe não trata heróis bloqueados como se fossem escolhidos',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data;
  clear();context.location={search:''};context.localStorage.data={};new t.Hero(cfg('pyro'));
  t.showPick('','');const locked=t.pick.options.findIndex(hero=>hero.id==='cleric');t.selectCard(locked);
  assert.ok(t.pick.info.innerHTML.includes('Equipe atual')&&t.pick.info.innerHTML.includes('Ganhe ★ 2 na campanha'));
  assert.ok(!t.pick.info.innerHTML.includes('class="candidate"'));
  context.location=previousLocation;context.localStorage.data=previousStorage;
});
test('evoluções simultâneas pausam em fila e oferecem três opções distintas',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));a.gainXp(350);b.gainXp(90);
  assert.equal(t.evolutions.length,3);assert.equal(a.level,3);assert.ok(Math.abs(a.dmg-24*1.1**2)<.001);
  t.showEvolution();assert.equal(t.game.paused,true);assert.equal(new Set(t.pick.upgrades.map(o=>o.id)).size,3);
  t.confirmPick(0);assert.equal(t.evolutions.length,2);assert.equal(t.game.paused,true);
  t.confirmPick(0);t.confirmPick(0);assert.equal(t.evolutions.length,0);assert.equal(t.game.paused,false);
});
test('autoevolução só liga com permissão e resolve as escolhas automaticamente',()=>{
  clear();const key='cavaleiros-auto-evoluir',saved=context.localStorage.data[key];delete context.localStorage.data[key];
  const button=elements.get('autoEvolve');assert.equal(button.textContent,'Autoevoluir: não');
  button.onclick();assert.equal(context.localStorage.data[key],'true');
  const healer=new t.Hero(cfg('cleric')),tank=new t.Hero(cfg('guardian'));
  t.evolutions.push({hero:healer,level:2},{hero:healer,level:3},{hero:tank,level:2});t.showEvolution();
  assert.equal(t.evolutions.length,0);assert.equal(t.pick.open,false);assert.equal(t.game.paused,false);
  assert.equal(healer.evolutionBranches.support,1);assert.equal(Object.keys(healer.evolutionBranches).length,2);assert.equal(tank.evolutionBranches.control,1);
  button.onclick();assert.equal(context.localStorage.data[key],'false');assert.equal(button.textContent,'Autoevoluir: não');
  if(saved===undefined)delete context.localStorage.data[key];else context.localStorage.data[key]=saved;
  clear();
});
test('evolução manual oculta rotas já escolhidas pelo herói',()=>{
  clear();const hero=new t.Hero(cfg('pyro'));
  t.evolutions.push({hero,level:2},{hero,level:3});t.showEvolution();
  const first=t.pick.upgrades[0].id;t.confirmEvolution(0);
  assert.equal(t.pick.upgrades.length,2);assert.ok(t.pick.upgrades.every(option=>option.id!==first));
  const second=t.pick.upgrades[0].id;assert.notEqual(second,first);t.confirmEvolution(0);
  assert.deepEqual(Object.keys(hero.evolutionBranches).sort(),[first,second].sort());
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
test('o snapshot do quadro não atualiza uma unidade criada durante o próprio quadro',()=>{
  clear();t.game.paused=true;
  let spawned=false,newcomerUpdates=0;
  const makeUnit=update=>({team:'neutral',dead:false,spawning:false,size:1,hp:1,maxHp:1,pos:new context.THREE.Vector3(),vel:new context.THREE.Vector3(),bar:{style:{},firstChild:{style:{}}},update,remove(){const i=t.units.indexOf(this);if(i>=0)t.units.splice(i,1)}});
  const newcomer=makeUnit(()=>newcomerUpdates++);
  const spawner=makeUnit(()=>{if(!spawned){spawned=true;t.units.push(newcomer)}});
  t.units.push(spawner);t.frame();assert.equal(newcomerUpdates,0);
  t.frame();assert.equal(newcomerUpdates,1);clear();
});
test('contexto tático reutiliza seus arrays sem carregar alvos removidos',()=>{
  clear();const contextRef=t.makeTargetContext(t.frameTargetContext),skeletonsRef=contextRef.skeletons;
  const first=new t.Skeleton('Minion',1);assert.equal(contextRef.skeletons.includes(first),false);
  const refreshed=t.makeTargetContext(t.frameTargetContext);
  assert.equal(refreshed,contextRef);assert.equal(refreshed.skeletons,skeletonsRef);assert.equal(refreshed.skeletons.length,1);assert.ok(refreshed.skeletons.includes(first));
  first.dead=true;t.game.paused=true;t.frame();assert.equal(t.frameTargetContext.skeletons.length,0);
  first.remove();const afterRemoval=t.makeTargetContext(t.frameTargetContext);assert.equal(afterRemoval.skeletons.length,0);
});
test('reinício limpa invocados, fila, efeitos e volta ao menu; Jornada leva à dificuldade',()=>{
  clear();const h=new t.Hero(cfg('necro'));new t.Minion(h,1);h.gainXp(90);t.showEvolution();t.startGame();
  assert.equal(t.units.length,0);assert.equal(t.evolutions.length,0);assert.equal(t.pick.mode,'mode');assert.equal(t.pick.open,true);assert.equal(t.game.paused,true);
  assert.equal(t.pick.cards.length,2);
  let next;context.setTimeout=(fn,ms)=>{if(ms===550||ms===450)next=fn};
  t.confirmPick(1);next();assert.equal(t.pick.mode,'difficulty');assert.equal(t.pick.cards.length,4);assert.equal(t.game.mission,null);
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
test('manual espera o jogador; pedido sem alvo avisa e não gasta a recarga',()=>{
  clear();context.localStorage.data={};
  const h=new t.Hero(cfg('pyro'));assert.equal(h.auto,true);h.auto=false;h.pos.set(0,0,0);h.skillTimer=0;
  const e=new t.Skeleton('Minion',1);e.spawning=false;e.busy=99;e.pos.set(0,0,4);e.hp=1000;
  h.busy=0;h.update(.016);assert.ok(h.skillTimer<=0);assert.ok(!h.pendingHit?.effect);
  h.busy=0;h.pendingHit=null;assert.equal(h.requestSkill(),'ok');h.update(.016);
  assert.ok(h.skillTimer>0);assert.ok(h.pendingHit.effect);assert.equal(h.skillMax,h.skillTimer);
  assert.equal(h.requestSkill(),'wait');
  e.remove();h.busy=0;h.pendingHit=null;h.skillTimer=0;assert.equal(h.requestSkill(),'ok');h.update(.016);
  assert.ok(h.noTarget>0);assert.equal(h.wantSkill,0);assert.ok(h.skillTimer<=0);
  h.die();assert.equal(h.requestSkill(),'off');
});
test('automático/manual fica salvo por variante',()=>{
  clear();context.localStorage.data={};t.saveAuto('ninja',false);
  assert.equal(new t.Hero(cfg('ninja')).auto,false);assert.equal(new t.Hero(cfg('cryo')).auto,true);
  t.saveAuto('ninja',true);assert.equal(t.loadAuto('ninja'),true);
});
test('cada variante oferece três habilidades e a ultimate tem recarga maior',()=>{
  for(const v of t.VARIANTS){
    const skills=t.skillSetFor(v);
    assert.equal(skills.length,3,v.id);
    assert.equal(skills.filter(s=>s.ultimate).length,1,v.id);
    assert.ok(t.cooldownForSkill(v,2)>t.cooldownForSkill(v,1),v.id+' ultimate vs técnica');
    assert.ok(t.cooldownForSkill(v,2)>t.cooldownForSkill(v,0),v.id+' ultimate vs assinatura');
  }
});
test('automático/manual pode ser salvo por habilidade sem perder o modo antigo',()=>{
  clear();context.localStorage.data={};t.saveAuto('ninja',false,2);
  const h=new t.Hero(cfg('ninja'));
  assert.deepEqual(Array.from(h.autoSkills),[true,true,false]);
  t.saveAuto('ninja',false);assert.equal(new t.Hero(cfg('ninja')).auto,false);
});
test('ultimate de área causa dano, anima o golpe e inicia uma recarga longa',()=>{
  clear();const h=new t.Hero(cfg('champion'));h.pos.set(0,0,0);h.skillTimers[2]=0;
  const e=new t.Skeleton('Minion',1);e.spawning=false;e.busy=99;e.pos.set(0,0,3);e.hp=e.maxHp=1000;
  assert.equal(h.useSkill(e,false,true,2),true);
  assert.ok(h.skillTimers[2]>=60);assert.ok(h.pendingHit?.effect);
  const before=e.hp;h.pendingHit.effect();assert.ok(e.hp<before);
});
test('técnicas e ultimates das 20 variantes executam seus efeitos sem erro',()=>{
  for(const v of t.VARIANTS)for(const slot of [1,2]){
    clear();const h=new t.Hero(v);h.pos.set(0,0,0);
    const e=new t.Skeleton('Minion',1);e.spawning=false;e.busy=99;e.pos.set(0,0,2);e.hp=e.maxHp=100000;
    assert.equal(h.useSkill(e,false,true,slot),true,v.id+' slot '+slot);
    assert.ok(h.pendingHit?.effect,v.id+' sem efeito pendente');
    h.pendingHit.effect();
    assert.ok(h.skillTimers[slot]>0,v.id+' sem recarga');
  }
  clear();
});
test('habilidades principais dos quatro novos heróis têm efeitos funcionais',()=>{
  clear();
  const cleric=new t.Hero(cfg('cleric')),bard=new t.Hero(cfg('bard')),angel=new t.Hero(cfg('angel')),chronist=new t.Hero(cfg('chronist'));
  for(const h of [cleric,bard,angel,chronist])h.pos.set(0,0,0);
  const enemy=new t.Skeleton('Minion',1);enemy.spawning=false;enemy.busy=99;enemy.pos.set(0,0,2);enemy.hp=enemy.maxHp=10000;
  cleric.hp-=45;assert.equal(cleric.useSkill(enemy,false,true),true);cleric.pendingHit.effect();assert.ok(cleric.hp>cleric.maxHp-45);assert.ok(cleric.guardT>0);
  assert.equal(bard.useSkill(enemy,false,true),true);bard.pendingHit.effect();assert.ok(bard.songT>0);assert.ok(bard.songHaste<1);
  const before=enemy.hp;assert.equal(angel.useSkill(enemy,false,true),true);angel.pendingHit.effect();assert.ok(enemy.hp<before);
  assert.equal(t.aimSpec(angel).mode,'ground');assert.equal(t.validAim(angel,enemy),true);
  assert.equal(chronist.useSkill(enemy,false,true),true);chronist.pendingHit.effect();assert.ok(enemy.rootT>0);
  clear();
});
test('virotes perfurantes reutilizam vetores e acertam vários inimigos no quadro',()=>{
  clear();t.bolts.length=0;
  const shooter=new t.Hero(cfg('crossbow'));shooter.pos.set(0,0,0);shooter.dmg=120;
  const first=new t.Skeleton('Minion',1),second=new t.Skeleton('Minion',1);
  first.spawning=second.spawning=false;first.pos.set(0,0,-1);second.pos.set(0,0,-2);first.hp=second.hp=10000;
  t.frameTargetContext.skeletons.length=0;t.frameTargetContext.skeletons.push(first,second);
  t.fireBolt(shooter,first,'crossbow');t.fireBolt(shooter,first,'crossbow');
  const OriginalVector3=context.THREE.Vector3;let allocations=0;
  const originalFilter=t.units.filter;let skeletonScans=0;
  context.THREE.Vector3=class CountedVector3 extends OriginalVector3 { constructor(...args){super(...args);allocations++;} };
  t.units.filter=function(predicate,...args){if(String(predicate).includes("'skeleton'"))skeletonScans++;return originalFilter.call(this,predicate,...args);};
  const before=[first.hp,second.hp];
  try { t.updateBolts(.15); } finally { context.THREE.Vector3=OriginalVector3;t.units.filter=originalFilter; }
  assert.ok(first.hp<before[0]&&second.hp<before[1],'o mesmo virote deve atravessar os dois alvos');
  assert.equal(allocations,0,'a atualização de virotes existentes não deve alocar vetores');
  assert.equal(skeletonScans,0,'o quadro com snapshot pronto não deve reconstruir a lista de inimigos');
  t.bolts.length=0;clear();t.frameTargetContext.skeletons.length=0;
});
test('fúria acelera o berserker e o passo das sombras leva o assassino às costas do alvo',()=>{
  clear();const b=new t.Hero(cfg('berserker')),a=new t.Hero(cfg('assassin'));b.pos.set(0,0,0);a.pos.set(3,0,0);
  const e=new t.Skeleton('Warrior',1);e.spawning=false;e.pos.set(0,0,2);e.hp=1000;
  assert.equal(b.useSkill(e),true);b.pendingHit.effect();b.pendingHit=null;assert.ok(b.furyT>0);
  b.busy=9;b.update(.016);assert.ok(Math.abs(b.cooldown-cfg('berserker').cooldown/1.5)<1e-9);
  assert.equal(a.useSkill(e),true);a.pendingHit.effect();assert.ok(a.pos.distanceTo(e.pos)<1.5);
  a.pendingHit.effect();assert.ok(e.hp<1000);
});
test('contexto tático reúne alvos válidos uma vez para o quadro',()=>{
  clear();const hero=new t.Hero(cfg('paladin')),minion=new t.Minion(hero,1);
  const active=new t.Skeleton('Warrior',1),spawning=new t.Skeleton('Rogue',1);
  active.spawning=false;spawning.spawning=true;
  const context=t.makeTargetContext();
  assert.ok(context.alliedUnits.includes(hero)&&context.alliedUnits.includes(minion));
  assert.ok(context.attackableSkeletons.includes(active)&&!context.attackableSkeletons.includes(spawning));
  clear();
});
test('alvos táticos priorizam o sacerdote e o inimigo que ameaça o aldeão',()=>{
  clear();const h=new t.Hero(cfg('pyro'));h.pos.set(0,0,0);
  const minion=new t.Skeleton('Minion',1),priest=new t.Skeleton('Priest',1);
  minion.spawning=priest.spawning=false;minion.pos.set(0,0,2);priest.pos.set(0,0,6);
  assert.equal(t.highestPriorityHeroTarget(h,[minion,priest]),priest);
  const villager={team:'villager',dead:false,pos:new Vector3(0,0,10)};
  t.game.villager=villager;t.game.mission={goal:{type:'escort'}};
  const attacker=new t.Skeleton('Bomber',1);attacker.spawning=false;attacker.pos.set(0,0,8);attacker.pendingHit={target:villager};
  assert.equal(t.highestPriorityHeroTarget(h,[minion,attacker]),attacker);
});
test('heróis distribuem ataques contra alvos quase derrotados sem perder prioridades',()=>{
  clear();const focused=new t.Hero(cfg('berserker')),teammate=new t.Hero(cfg('paladin'));
  focused.pos.set(0,0,0);teammate.pos.set(0,0,0);focused.post.copy(focused.pos);teammate.post.copy(teammate.pos);
  const weak=new t.Skeleton('Minion',1),alternative=new t.Skeleton('Warrior',1);
  weak.spawning=alternative.spawning=false;weak.pos.set(0,0,3);alternative.pos.set(0,0,3.4);
  focused.targetFocus=weak;
  const team=t.makeTargetContext();
  assert.equal(t.chooseHeroTarget(teammate,[weak,alternative],.016,team),weak);
  weak.hp=weak.maxHp*.1;teammate.targetFocus=weak;teammate.targetFocusT=1;
  assert.equal(t.chooseHeroTarget(teammate,[weak,alternative],.016,team),alternative);
  const priest=new t.Skeleton('Priest',1),nearby=new t.Skeleton('Minion',1);
  priest.spawning=nearby.spawning=false;priest.pos.set(0,0,6);nearby.pos.set(0,0,1.4);
  priest.hp=priest.maxHp*.1;focused.targetFocus=priest;
  assert.equal(t.chooseHeroTarget(teammate,[alternative,nearby,priest],.016,team),priest);
});
test('escolta troca para ameaça urgente, mantém foco comum e respeita limite',()=>{
  clear();const h=new t.Hero(cfg('pyro'));h.pos.set(0,0,0);h.post.copy(h.pos);
  const minion=new t.Skeleton('Minion',1),other=new t.Skeleton('Warrior',1);
  minion.spawning=other.spawning=false;minion.pos.set(0,0,2);other.pos.set(0,0,4);
  h.targetFocus=minion;h.targetFocusT=1;
  assert.equal(t.chooseHeroTarget(h,[minion,other],.016),minion); // foco breve evita alternância
  const villager={team:'villager',dead:false,pos:new Vector3(0,0,8)};
  const attacker=new t.Skeleton('Bomber',1);attacker.spawning=false;attacker.pos.set(0,0,8);attacker.pendingHit={target:villager};
  t.game.villager=villager;t.game.mission={goal:{type:'escort'}};
  assert.equal(t.chooseHeroTarget(h,[minion,attacker],.016),attacker); // ameaça urgente quebra o foco
  attacker.pos.set(0,0,6);attacker.pendingHit=null;h.targetFocus=minion;h.targetFocusT=1;
  assert.equal(t.chooseHeroTarget(h,[minion,attacker],.016),attacker); // também antecipa o perigo junto ao aldeão
  attacker.pos.set(0,0,19);villager.pos.set(0,0,19);attacker.pendingHit={target:villager};
  assert.equal(t.chooseHeroTarget(h,[attacker],.016),null); // mesmo ameaçando, não puxa o grupo para longe
});
test('missão sem quedas prioriza inimigo junto a aliado crítico',()=>{
  clear();const h=new t.Hero(cfg('pyro')),ally=new t.Hero(cfg('paladin'));
  h.pos.set(0,0,0);h.post.copy(h.pos);ally.pos.set(6,0,0);ally.hp=ally.maxHp*.3;
  const minion=new t.Skeleton('Minion',1),threat=new t.Skeleton('Warrior',1);
  minion.spawning=threat.spawning=false;minion.pos.set(0,0,2);threat.pos.set(5,0,0);
  h.targetFocus=minion;h.targetFocusT=1;t.game.mission={goal:{type:'nofall'}};
  assert.equal(t.chooseHeroTarget(h,[minion,threat],.016),threat);
});
test('sem quedas permite interceptar ameaça curta fora do limite normal',()=>{
  clear();const h=new t.Hero(cfg('paladin')),ally=new t.Hero(cfg('berserker'));
  h.pos.set(0,0,0);h.post.copy(h.pos);ally.pos.set(0,0,10);ally.hp=ally.maxHp*.3;
  const attacker=new t.Skeleton('Warrior',1);attacker.spawning=false;attacker.pos.set(0,0,9.5);attacker.pendingHit={target:ally};
  t.game.mission={goal:{type:'nofall'}};
  assert.equal(t.chooseHeroTarget(h,[attacker],.016),attacker);
});
test('heróis interceptam arqueiros de uma onda sem perseguir indefinidamente nem puxar totens',()=>{
  clear();const h=new t.Hero(cfg('paladin'));h.pos.set(0,0,0);h.post.copy(h.pos);
  const shooter=new t.Skeleton('Mage',1);shooter.spawning=false;shooter.pos.set(0,0,17);
  assert.equal(t.chooseHeroTarget(h,[shooter],.016),shooter);
  const second=new t.Hero(cfg('berserker')),third=new t.Hero(cfg('assassin'));
  second.pos.set(0,0,0);second.post.copy(second.pos);third.pos.set(0,0,0);third.post.copy(third.pos);
  assert.equal(t.chooseHeroTarget(second,[shooter],.016),shooter);
  assert.equal(t.chooseHeroTarget(third,[shooter],.016),null); // o grupo mantém dois heróis na formação
  shooter.pos.set(0,0,25);assert.equal(t.chooseHeroTarget(h,[shooter],.016),null);
  const backliner=new t.Hero(cfg('pyro'));backliner.pos.set(0,0,0);backliner.post.copy(backliner.pos);
  shooter.pos.set(0,0,23);assert.equal(t.chooseHeroTarget(backliner,[shooter],.016),null);
  shooter.pos.set(0,0,10);shooter.totem=true;t.game.mission={goal:{type:'totems'}};
  assert.equal(t.chooseHeroTarget(h,[shooter],.016),shooter);
  t.game.mission={goal:{type:'win'}};assert.equal(t.chooseHeroTarget(h,[shooter],.016),null);
});
test('Pyro escolhe um grupo para a explosão em vez de um alvo isolado',()=>{
  clear();const h=new t.Hero(cfg('pyro'));h.pos.set(0,0,0);
  const cluster=[new t.Skeleton('Minion',1),new t.Skeleton('Warrior',1),new t.Skeleton('Rogue',1)];
  cluster[0].pos.set(0,0,4.4);cluster[1].pos.set(.2,0,4.5);cluster[2].pos.set(-.2,0,4.3);
  const lone=new t.Skeleton('Minion',1);lone.pos.set(0,0,1.8);
  for(const s of [...cluster,lone])s.spawning=false;
  assert.ok(cluster.includes(t.bestSkillTarget(h,[lone,...cluster])));
});
test('Paladino guarda a cura para aliados feridos e ainda salva um aliado crítico',()=>{
  clear();const paladin=new t.Hero(cfg('paladin')),ally=new t.Hero(cfg('berserker'));
  paladin.pos.set(0,0,0);ally.pos.set(0,0,1);ally.hp=ally.maxHp-1;
  assert.equal(paladin.useSkill(null,false,false),false);
  ally.hp=ally.maxHp*.5;
  assert.equal(paladin.useSkill(null,false,false),true);
});
test('Druida não gasta habilidade manual sem aliado ferido ou inimigo ao alcance',()=>{
  clear();const druid=new t.Hero(cfg('druid')),ally=new t.Hero(cfg('berserker'));
  druid.pos.set(0,0,0);ally.pos.set(0,0,1);druid.skillTimer=0;
  assert.equal(druid.useSkill(null,false,true),false);assert.equal(druid.skillTimer,0);assert.equal(druid.stats.habilidades||0,0);
  ally.hp=ally.maxHp*.5;
  assert.equal(druid.useSkill(null,false,true),true);
});
test('dica pós-derrota usa o objetivo e o estado real da missão',()=>{
  const tip=mission=>context.buildBattleReport({won:false,mission}).find(item=>item.id==='next-try').text;
  assert.match(tip({goal:{type:'escort'},villagerDown:true}),/aldeão caiu/);
  assert.match(tip({goal:{type:'escort'},villagerDown:false}),/grupo caiu antes de concluir a escolta/);
  assert.match(tip({goal:{type:'nofall'}}),/ninguém caia/);
  assert.match(tip({goal:{type:'timer',time:240},time:241}),/limite de tempo acabou/);
  assert.match(tip({goal:{type:'totems',count:3},totemsDown:1}),/Faltaram 2 totens/);
  assert.match(tip({goal:{type:'boss'},bossDown:false,bossSeen:false,phase:5}),/antes da estreia do chefe.*fase 6/);
  assert.match(tip({goal:{type:'boss'},bossDown:false,bossSeen:true}),/chefe ainda está ativo/);
  assert.match(tip({goal:{type:'survive',time:90},surviveRemaining:12.1}),/Faltavam 13 s/);
});
test('dica de vitória orienta a próxima arena e a busca por estrelas',()=>{
  const report=mission=>context.buildBattleReport({won:true,mission}).find(item=>item.id==='next-try');
  let result=report({stars:2,nextMission:'A Ponte do Rio'});
  assert.equal(result.title,'Progresso da campanha');assert.match(result.text,/Vitória com 2\/3 estrelas/);assert.match(result.text,/A Ponte do Rio está liberada/);
  result=report({stars:3,nextMission:'Fazendas'});assert.match(result.text,/Três estrelas! Fazendas está liberada/);
  result=report({stars:3,nextMission:null,remainingStars:4});assert.match(result.text,/4 estrelas restantes/);
  result=report({stars:3,nextMission:null,remainingStars:0});assert.match(result.text,/Campanha perfeita/);
});
test('resultado da campanha encaminha o objetivo para a dica pós-batalha',()=>{
  clear();const previousSummary=context.summaryHTML;let report;
  try {
    context.summaryHTML=(_,value)=>{report=value;return '';};
    t.game.test=true;t.game.roster=[];t.game.mission=t.MISSIONS.find(m=>m.id==='ponte');t.game.villager={dead:true};
    t.endGame('O aldeão caiu! Proteja-o até o fim.',false);
    assert.match(report.find(item=>item.id==='next-try').text,/aldeão caiu/);

    clear();t.game.test=true;t.game.roster=[];t.game.phase=5;t.game.bossSeen=false;t.game.mission=t.MISSIONS.find(m=>m.goal.type==='boss');
    t.endGame('Os esqueletos venceram.',false);
    assert.match(report.find(item=>item.id==='next-try').text,/fase 6/);
    assert.equal(report.find(item=>item.id==='next-try').text.includes('chefe surgir'),false);

    clear();t.game.test=true;t.game.roster=[];t.game.phase=6;t.game.bossSeen=true;t.game.mission=t.MISSIONS.find(m=>m.goal.type==='boss');
    t.endGame('Os esqueletos venceram.',false);
    assert.match(report.find(item=>item.id==='next-try').text,/chefe ainda está ativo/);
  } finally { context.summaryHTML=previousSummary;clear(); }
});
test('resultado da vitória inclui o desbloqueio real da próxima arena',()=>{
  clear();const previousSummary=context.summaryHTML,previousLocation=context.location,previousStorage={...context.localStorage.data};let report;
  try {
    context.summaryHTML=(_,value)=>{report=value;return '';};context.location={search:''};context.localStorage.data={};
    t.game.test=false;t.game.roster=[];t.game.mission=t.MISSIONS.find(m=>m.id==='vila');
    t.endGame('Missão cumprida',true);
    const progress=report.find(item=>item.id==='next-try');
    assert.equal(progress.title,'Progresso da campanha');assert.match(progress.text,/A Ponte do Rio está liberada/);
    assert.equal(t.starsOf('vila'),2);
  } finally { context.summaryHTML=previousSummary;context.location=previousLocation;context.localStorage.data=previousStorage;clear(); }
});
// ---------- campanha ----------
const mission=id=>t.MISSIONS.find(m=>m.id===id);
const idx=id=>t.pick.options.findIndex(v=>v.id===id);
test('mapas da campanha ficam estáveis ao voltar da dificuldade e rerrolam na próxima visita',()=>{
  let draws=0;
  const session=context.createCampaignMapSeedSession(t.MISSIONS,()=>((++draws)%90)/100);
  const first=session.get();
  assert.strictEqual(session.get(),first);
  assert.equal(draws,t.MISSIONS.length);
  assert.equal(new Set(Array.from(first.values())).size,t.MISSIONS.length);
  session.reset();
  const next=session.get();
  assert.notStrictEqual(next,first);
  assert.equal(draws,t.MISSIONS.length*2);
  assert.notEqual(next.get('vila'),first.get('vila'));
});
// escolhe a missão, a dificuldade Normal e os heróis do grupo inicial
function begin(id,picks){
  clear();t.setMission(mission(id));t.showDifficulty();
  let next;context.setTimeout=(fn,ms)=>{if(ms===550)next=fn};
  t.confirmPick(1);next();
  for(const p of picks){t.confirmPick(idx(p));next();}
  context.setTimeout=noop;
}
test('8 missões com objetivo; quatro variantes começam liberadas e as novas entram no fluxo de estrelas',()=>{
  assert.equal(t.MISSIONS.length,8);for(const m of t.MISSIONS)assert.ok(context.goalText(m.goal),m.id);
  context.location={search:''};context.localStorage.data={};
  assert.equal(t.VARIANTS.filter(v=>t.variantOpen(v.id)).map(v=>v.id).sort().join(),'assassin,berserker,paladin,pyro');
  assert.equal(t.UNLOCKS.length,16);assert.equal(new Set([...t.UNLOCKS.map(u=>u.id),...t.STARTERS]).size,20);
  assert.equal(t.UNLOCKS.at(-1).stars,23);
  assert.ok(t.UNLOCKS.every(u=>u.stars<=24));
  assert.deepEqual(['cleric','bard','angel','chronist'].map(id=>t.starsToUnlock(id)),[2,8,14,20]);
  clear();t.showPick('','');assert.ok(t.pick.cards[idx('guardian')].innerHTML.includes('★ 1 para liberar'));
  t.confirmPick(idx('guardian'));assert.equal(t.pick.open,true);
  t.selectCard(idx('paladin'));t.moveGrid(1,0);assert.equal(t.pick.sel,idx('paladin'));t.moveGrid(0,1);assert.equal(t.pick.sel,idx('berserker'));
  context.saveStars('vila',3);assert.equal(t.totalStars(),3);assert.ok(t.variantOpen('guardian')&&t.variantOpen('viking')&&!t.variantOpen('cryo'));
  context.location={search:'?tudo=1'};assert.ok(t.variantOpen('druid'));assert.ok(t.unlocked(7));
});
test('estrelas da campanha são cumulativas e missão sem quedas usa vida como desafio extra',()=>{
  const stars=context.starsFor;
  assert.equal(stars({won:false,falls:0,hpRatio:1}),0);
  assert.equal(stars({won:true,falls:1,hpRatio:1}),1);
  assert.equal(stars({won:true,falls:0,hpRatio:.4}),2);
  assert.equal(stars({won:true,falls:0,hpRatio:.5}),3);
  const nofall={type:'nofall'};
  assert.equal(stars({won:true,falls:1,hpRatio:1,goal:nofall}),0);
  assert.equal(stars({won:true,falls:0,hpRatio:.6,goal:nofall}),1);
  assert.equal(stars({won:true,falls:0,hpRatio:.75,goal:nofall}),2);
  assert.equal(stars({won:true,falls:0,hpRatio:.9,goal:nofall}),3);
  const regular=Array.from(context.starConditions({won:true,falls:1,hpRatio:.8}),c=>[c.achieved,c.label]);
  assert.deepEqual(regular,[[true,'Concluir a missão'],[false,'Terminar sem quedas (1 queda)'],[false,'Sem quedas e com 50%+ de vida (atual 80%)']]);
  const special=Array.from(context.starConditions({won:true,falls:0,hpRatio:.8,goal:nofall}),c=>c.achieved);
  assert.deepEqual(special,[true,true,false]);
});
test('progresso da missão acompanha o objetivo exibido no HUD',()=>{
  clear();t.game.mission={from:5,to:7};t.game.phase=5;t.game.state='fight';
  t.game.surviveT=90;
  assert.equal(t.missionProgress({type:'survive',phase:5,time:90},null,[]),0);
  t.game.surviveT=45;assert.equal(t.missionProgress({type:'survive',phase:5,time:90},null,[]),.5);
  t.game.totemsDown=2;assert.ok(Math.abs(t.missionProgress({type:'totems',count:3},null,[])-2/3)<.001);
  t.game.missionT=60;assert.equal(t.missionProgress({type:'timer',time:240},null,[]),.25);
  assert.equal(t.missionProgress({type:'escort'},{hp:35,maxHp:100},[]),.35);
  t.game.state='cleared';assert.equal(t.missionProgress({type:'win'},null,[]),1/3);
});
test('recordes de campanha guardam apenas a melhor vitória por missão e dificuldade',()=>{
  context.localStorage.data={};
  const save=(won,seconds,difficultyId='normal')=>t.saveMissionRecord('vila',{won,seconds,difficultyId});
  assert.equal(save(false,70),false);
  assert.equal(save(true,0),false);
  assert.equal(save(true,70,'impossivel'),false);
  assert.equal(save(true,70),true);
  assert.equal(save(true,75),false);
  assert.equal(save(true,68),true);
  assert.equal(save(true,82,'pesadelo'),true);
  assert.deepEqual(Array.from(t.missionRecords('vila'),r=>[r.difficultyId,r.time]),[['normal','1:08'],['pesadelo','1:22']]);
});
test('campanha acompanha o foco e Enter só inicia a missão focada',()=>{
  const previousAdd=context.addEventListener,previousLocation=context.location,previousStorage=context.localStorage.data;
  context.location={search:'?tudo=1'};context.localStorage.data={};
  t.saveMissionRecord('ponte',{won:true,seconds:72,difficultyId:'normal'});
  let keyHandler,started=[];context.addEventListener=(type,fn)=>{if(type==='keydown')keyHandler=fn};
  const map=el(),info=el(),playButton=el(),root=el();
  map.children=[];info.querySelector=()=>playButton;root.isConnected=true;root.closest=()=>null;
  root.querySelector=selector=>selector==='.camp-map'?map:info;
  context.renderCampaign(root,m=>started.push(m),m=>m.id==='ponte'?'Outono':'Pradaria',m=>t.campaignThreats(m.from,m.to));
  const focusedNode=map.children[1];focusedNode.classList.add('camp-node');focusedNode.onfocus();
  assert.ok(info.innerHTML.includes('ARENA 02 · OUTONO'));
  assert.ok(info.innerHTML.includes('Inimigos especiais'));
  assert.ok(info.innerHTML.includes('Pode surgir · fase 3'));
  assert.ok(info.innerHTML.includes('Bombardeiro'));
  assert.ok(info.innerHTML.includes('Seus melhores tempos')&&info.innerHTML.includes('1:12'));
  context.document.activeElement=focusedNode;
  let prevented=false;keyHandler({key:'Enter',preventDefault(){prevented=true}});
  assert.equal(started[0].id,'ponte');assert.equal(prevented,true);

  const otherControl=el();context.document.activeElement=otherControl;prevented=false;
  keyHandler({key:'Enter',preventDefault(){prevented=true}});
  assert.equal(started.length,1);assert.equal(prevented,false);

  context.document.activeElement=playButton;prevented=false;
  keyHandler({key:'Enter',preventDefault(){prevented=true}});
  assert.equal(started.length,1);assert.equal(prevented,false);
  playButton.onclick();assert.equal(started.length,2);assert.equal(started[1].id,'ponte');
  context.addEventListener=previousAdd;context.location=previousLocation;context.localStorage.data=previousStorage;
});
test('intel da campanha acompanha estreias, chefes e golem opcional',()=>{
  const ids=(from,to)=>Array.from(t.campaignThreats(from,to),threat=>threat.id);
  assert.deepEqual(ids(1,3),['Shieldbearer','Bomber']);
  const village=t.campaignThreats(1,3);assert.equal(village.find(threat=>threat.id==='Shieldbearer').possible,false);
  const lake=t.campaignThreats(5,7);assert.equal(lake.find(threat=>threat.id==='Shieldbearer').possible,true);assert.equal(lake.find(threat=>threat.id==='Priest').possible,false);
  for(const id of ['Priest','Golem','King']) assert.ok(ids(4,6).includes(id),`fase 4–6 deve prever ${id}`);
  assert.ok(ids(11,12).includes('Lich'));
  const golem=t.campaignThreats(9,10).find(threat=>threat.id==='Golem');
  assert.equal(golem.optional,true);
});
test('campanha concluída destaca o castelo e oferece replay pelas estrelas restantes',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data;
  context.location={search:''};
  context.localStorage.data={'cavaleiros-campanha':JSON.stringify(Object.fromEntries(t.MISSIONS.map(m=>[m.id,1])))};
  const render=()=>{
    const map=el(),info=el(),root=el();
    map.children=[];root.isConnected=true;root.closest=()=>null;
    root.querySelector=selector=>selector==='.camp-map'?map:info;
    context.renderCampaign(root,noop);
    return {map,info};
  };
  let view=render();
  assert.ok(view.map.children.at(-1).classList.contains('sel'));
  assert.match(view.info.innerHTML,/Campanha concluída/);
  assert.match(view.info.innerHTML,/16 estrelas restantes/);
  context.localStorage.data={'cavaleiros-campanha':JSON.stringify(Object.fromEntries(t.MISSIONS.map(m=>[m.id,3])))};
  view=render();
  assert.ok(view.map.children.at(-1).classList.contains('sel'));
  assert.match(view.info.innerHTML,/Campanha perfeita/);
  assert.match(view.info.innerHTML,/todas as variantes estão liberadas/);
  context.location=previousLocation;context.localStorage.data=previousStorage;
});
test('atalho ?tudo=1 não grava estrelas de campanha',()=>{
  context.location={search:'?tudo=1'};context.localStorage.data={};
  begin('vila',['paladin']);
  assert.equal(t.game.test,true);
  Object.assign(t.game,{phase:3,state:'cleared',timer:0});t.updateGame(.1);
  assert.equal(t.starsOf('vila'),0);
  assert.ok(elements.get('overlayStars').innerHTML.includes('Modo de teste'));
  assert.equal(context.localStorage.getItem('cavaleiros-equipe-campanha'),null);
  context.location={search:''};
});
test('campanha: escolhe N heróis em sequência, já no nível da missão e sem telas de evolução',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('fazendas',['paladin','pyro']);
  assert.equal(t.heroes().length,2);assert.ok(t.heroes().every(h=>h.level===2));assert.equal(t.evolutions.length,0);
  assert.equal(t.game.phase,4);assert.equal(t.game.last,6);assert.equal(t.game.paused,false);assert.equal(t.pick.open,false);
  begin('ponte',['berserker','assassin']);assert.ok(t.game.villager instanceof t.Villager);assert.equal(t.game.phase,3);
  assert.deepEqual(JSON.parse(context.localStorage.getItem('cavaleiros-equipe-campanha')),['berserker','assassin']);
  clear();t.setMission(mission('lago'));t.showDifficulty();
  let next;context.setTimeout=(fn,ms)=>{if(ms===550)next=fn};t.confirmPick(1);next();
  assert.equal(t.pick.options[t.pick.sel].id,'berserker');assert.ok(t.pick.cards[t.pick.sel].innerHTML.includes('Equipe anterior'));
  assert.match(elements.get('pickHint').textContent,/Sugestão da equipe/);
  t.selectCard(idx('pyro'));assert.match(elements.get('pickHint').textContent,/Passe para prévia/);
  assert.equal(t.heroes().length,0,'a formação anterior deve ser apenas uma sugestão');context.setTimeout=noop;
});
test('objetivos: aldeão, ninguém cai e tempo derrubam a missão',()=>{
  context.location={search:''};
  begin('ponte',['paladin','pyro']);t.game.villager.takeDamage(9999);t.updateGame(.1);
  assert.equal(t.game.over,true);assert.ok(elements.get('overlayText').textContent.includes('aldeão'));assert.equal(t.starsOf('ponte'),0);
  begin('lago-sombrio',['paladin','pyro','berserker','assassin']);t.heroes()[1].die();t.updateGame(.1);
  assert.equal(t.game.over,true);assert.ok(elements.get('overlayText').textContent.includes('caiu'));
  begin('cemiterio',['paladin','pyro','berserker','assassin']);t.game.missionT=239.95;t.updateGame(.1);
  assert.equal(t.game.over,true);assert.ok(elements.get('overlayText').textContent.includes('tempo'));
});
test('cronômetro para enquanto a vitória da última fase é exibida',()=>{
  begin('cemiterio',['paladin','pyro','berserker','assassin']);
  Object.assign(t.game,{phase:t.game.last,state:'cleared',timer:.05,missionT:239.95});
  t.updateGame(.1);
  assert.equal(t.game.over,true);
  assert.ok(elements.get('overlayText').textContent.includes('Missão cumprida'));
  assert.ok(!elements.get('overlayText').textContent.includes('tempo acabou'));
});
test('objetivos: sobreviver com ondas contínuas, totens e chefe',()=>{
  context.location={search:''};
  begin('lago',['paladin','pyro','berserker']);Object.assign(t.game,{state:'fight',toSpawn:0});t.updateGame(.1);
  assert.equal(t.game.toSpawn,3);assert.equal(t.game.state,'fight');   // 4 novos, um já surgiu
  for(const u of [...t.units])if(u.team==='skeleton')u.remove();
  Object.assign(t.game,{surviveT:.05,toSpawn:0});t.updateGame(.1);t.updateGame(.1);assert.equal(t.game.state,'cleared');
  begin('ruinas',['paladin','pyro','berserker']);t.startPhase();
  const totem=t.skeletonsAlive().find(u=>u.totem);assert.ok(totem);assert.equal(t.game.totemsPlaced,1);
  t.game.toSpawn=0;totem.spawnT=0;t.updateGame(.1);assert.ok(t.skeletonsAlive().some(u=>!u.totem));assert.equal(t.game.state,'fight');
  for(const u of t.skeletonsAlive())if(!u.totem)u.remove();
  totem.takeDamage(99999,null,t.heroes()[0]);assert.equal(t.game.totemsDown,1);t.updateGame(.1);assert.equal(t.game.state,'cleared');
  begin('fazendas',['paladin','pyro']);Object.assign(t.game,{phase:4,state:'fight',toSpawn:0,last:6});
  const mini=new t.Skeleton('Golem',4);mini.spawning=false;t.updateGame(.1);
  assert.equal(mini.boss,true);assert.equal(mini.phaseBoss,false);assert.equal(t.game.bossSeen,false);
  mini.die();t.updateGame(.1);
  assert.equal(t.game.bossDown,false,'mini-chefe não pode concluir o objetivo de chefe');assert.equal(t.game.last,6);assert.equal(t.game.over,false);
  Object.assign(t.game,{phase:6,state:'fight',toSpawn:0});
  const boss=new t.Skeleton('Warrior',6,true);boss.spawning=false;new t.Skeleton('Minion',6);t.updateGame(.1);assert.equal(t.game.bossSeen,true);
  boss.die();t.updateGame(.1);assert.equal(t.game.bossDown,true);assert.equal(t.skeletonsAlive().length,0);
  t.updateGame(.1);t.game.timer=0;t.updateGame(.1);assert.equal(t.game.over,true);assert.ok(elements.get('overlayText').textContent.startsWith('Missão cumprida'));
});
test('estrelas no fim: gravam o melhor, liberam variantes e não contam com ?fase',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('vila',['paladin']);Object.assign(t.game,{phase:3,state:'cleared',timer:0,missionT:83});t.updateGame(.1);
  assert.equal(t.starsOf('vila'),3);const stars=elements.get('overlayStars').innerHTML;
  assert.equal((stars.match(/class="on"/g)||[]).length,3);assert.ok(stars.includes('Nova variante liberada!')&&stars.includes('Guardião')&&stars.includes('Viking'));
  assert.ok(stars.includes('Concluir a missão')&&stars.includes('Terminar sem quedas (0 quedas)')&&stars.includes('atual 100%'));
  assert.ok(stars.includes('Novo recorde · Normal · 1:23'));
  assert.deepEqual(Array.from(t.missionRecords('vila'),r=>r.difficultyId),['normal']);
  assert.ok(t.variantOpen('viking'));assert.equal(elements.get('overlayBtn').textContent,'Voltar ao mapa');
  t.game.paused=false;t.startGame('map');assert.equal(t.game.paused,true);t.updateGame(.1);assert.equal(t.game.over,false);   // o mapa segura a partida
  begin('ponte',['paladin','pyro']);t.heroes()[0].die();t.heroes()[1].hp=1;Object.assign(t.game,{phase:5,state:'cleared',timer:0});t.updateGame(.1);t.updateGame(.1);
  assert.equal(t.starsOf('ponte'),1);   // venceu, mas um caiu e terminou com pouca vida
  assert.ok(elements.get('overlayStars').innerHTML.includes('Terminar sem quedas (1 queda)'));
  context.location={search:'?fase=4'};begin('ponte',['paladin','pyro']);Object.assign(t.game,{phase:5,state:'cleared',timer:0});t.updateGame(.1);
  assert.equal(t.starsOf('ponte'),1);assert.ok(elements.get('overlayStars').innerHTML.includes('não contam'));
  context.location={search:'?tudo=1'};
});
test('terceira estrela mede a vida antes da cura da última fase',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('vila',['paladin']);const h=t.heroes()[0];h.hp=h.maxHp*.4;
  Object.assign(t.game,{phase:3,state:'fight',toSpawn:0});t.updateGame(.1);
  assert.ok(h.hp/h.maxHp>.5);assert.equal(t.game.missionHpRatio,.4);
  t.game.timer=0;t.updateGame(.1);
  assert.equal(t.starsOf('vila'),2);
});
const cMath=vm.runInContext('Math',context);   // o sorteio do jogo é o Math do contexto
const foe=(type,x,z,boss=false)=>{const u=new t.Skeleton(type,6,boss);u.spawning=false;u.busy=0;u.pos.set(x,0,z);return u};
const hero=(id,x,z)=>{const h=new t.Hero(cfg(id));h.pos.set(x,0,z);h.post.copy(h.pos);return h};   // posto no lugar: não volta à formação
const tick=(dt,n=1)=>{for(let i=0;i<n;i++){for(const u of [...t.units])u.update(dt);context.updateEnemyBolts(dt)}};
test('grade espacial separa unidades grandes nas células vizinhas e mantém colisão com obstáculos',()=>{
  clear();const obstacles=t.world.obstacles;
  try{
    t.world.obstacles=[];
    const a=hero('paladin',2.99,0),b=foe('Golem',5.01,0,true);a.size=b.size=2.2;t.separate();
    assert.ok(a.pos.distanceTo(b.pos)>=2.332-.01,'o par que atravessa o limite da célula deve se separar');
    clear();t.world.obstacles=[{x:10,z:0,r:1}];const unit=foe('Minion',10,0);t.separate();
    assert.ok(Math.hypot(unit.pos.x-10,unit.pos.z)>=1.53-.01,'a unidade deve sair do centro do obstáculo');
  }finally{clear();t.world.obstacles=obstacles}
});
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
  clear();t.clearMonsterFx();const front=hero('paladin',0,2),back=hero('pyro',0,-2);  const g=foe('Ghost',0,8);g.hp=g.maxHp=1e4;for(let i=0;i<80;i++){tick(.05);t.separate()}
  assert.ok(g.hover>0.2&&g.pos.y>0.2);assert.ok(g.pos.z<front.pos.z&&g.pos.distanceTo(back.pos)<2.5);   // passou da linha da frente e briga com o de trás (os golpes empurram)
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
test('estreias de inimigos acompanham a fase inicial sem empilhar inimigos antigos',()=>{
  const rnd=cMath.random;cMath.random=()=>.99;
  try {
    t.clearMonsterFx();
    assert.equal(t.pickMonster(5,'Minion'),'Priest'); // a fase 5 ainda introduz o sacerdote
    t.clearMonsterFx();
    assert.equal(t.pickMonster(7,'Minion'),'Minion'); // fases 2–5 não reaparecem como estreias
    t.clearMonsterFx();
    assert.deepEqual([2,3,4,5].map(p=>t.pickMonster(p,'Minion')),['Shieldbearer','Bomber','Ghost','Priest']);
  } finally { cMath.random=rnd;t.clearMonsterFx(); }
});
test('arqueiros aleatórios não substituem a estreia garantida de um inimigo',()=>{
  clear();t.clearMonsterFx();
  const difficulty=t.getDifficulty(),shooters=difficulty.shooters,rnd=cMath.random;
  try {
    difficulty.shooters=1;cMath.random=()=>.99;
    Object.assign(t.game,{phase:2,toSpawn:8,bossPending:false});
    t.spawnSkeleton();
    assert.equal(t.skeletonsAlive().at(-1).enemyKind,'Shieldbearer');
  } finally { difficulty.shooters=shooters;cMath.random=rnd;clear();t.clearMonsterFx(); }
});
test('chefes e golem fecham as ondas certas; tipos novos entram aos poucos',()=>{
  assert.equal(t.waveLeader(6,true),'King');assert.equal(t.waveLeader(12,true),'Lich');assert.equal(t.waveLeader(8,false),'Golem');assert.equal(t.waveLeader(3,false),null);
  t.clearMonsterFx();for(let i=0;i<50;i++)assert.equal(t.pickMonster(1,'Minion'),'Minion');
  assert.equal(t.pickMonster(2,'Minion'),'Shieldbearer');for(let i=0;i<50;i++)assert.ok(['Minion','Shieldbearer'].includes(t.pickMonster(2,'Minion')));
  t.clearMonsterFx();const seen=new Set();for(let i=0;i<300;i++)seen.add(t.pickMonster(12,'Minion'));for(const k of ['Shieldbearer','Bomber','Ghost'])assert.ok(seen.has(k),k);
});
console.log(results.length+' verificações passaram.');
