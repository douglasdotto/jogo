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
const progression = fs.readFileSync(path.join(dir, 'progression.js'), 'utf8');
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
  addEventListener:noop,removeEventListener:noop,hideTooltip:noop,requestAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,innerWidth:1440,innerHeight:1000,aiming:null,battleGateId:0,battleLoadingVisible:false,
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
  FX:new Proxy({},{get:(_,k)=>k==='jolt'?()=>new Vector3():k==='timeScale'?()=>1:noop}),audio:new Proxy({},{get:()=>noop}),updateSkillBar:noop});
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
vm.runInContext(progression.replaceAll('export ',''),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','scene-perf.js'),'utf8').replaceAll('export ',''),context);   // disposeSkeletons
vm.runInContext(part(source,'const ROAD','// ---------- cena'),context);
vm.runInContext(part(source,'const $','// retrato de cada'),context);
vm.runInContext(part(source,'const units =','// projéteis e áreas'),context);
vm.runInContext(part(source,'function fireBolt','// ---------- efeitos'),context);
// Carrega heróis, inimigos e separação física até o bloco de fases.
vm.runInContext(part(source,'class Hero','// ---------- fases'),context);
vm.runInContext(part(source,'// ---------- fases',"addEventListener('resize'"),context);
vm.runInContext('globalThis.t={Hero,Skeleton,Minion,Unit,HEROES,CLASSES,VARIANTS,CHARACTERS,units,heroes,game,pick,evolutions,EVOLUTION_BRANCHES,autoUpgrade,showPick,selectCard,moveGrid,confirmPick,showEvolution,confirmEvolution,arrangeParty,SKILL_MOVES,loadAuto,loadAutoSlot,saveAuto,skillSetFor,cooldownForSkill,aimSpec,validAim,damageCleave,startGame,DIFFICULTIES,showDifficulty,loadRecords,setDifficulty:i=>{difficulty=DIFFICULTIES[i]},getDifficulty:()=>difficulty,startPhase,spawnSkeleton,updateGame,updateBars,endGame,frame,frameTargetContext,MISSIONS,UNLOCKS,STARTERS,totalStars,variantOpen,starsToUnlock,showMenu,Villager,Totem,skeletonsAlive,starsOf,unlocked,saveMissionRecord,missionRecords,setMission:m=>{game.mission=m},MONSTER_TYPES,updateMonsterFx,clearMonsterFx,dangerAt,pickMonster,waveLeader,campaignThreats,separate,chooseHeroTarget,heroTargetScore,highestPriorityHeroTarget,bestSkillTarget,skillTargetScore,teamCoverage,missionRoleNeeds,fireBolt,updateBolts,bolts,SKILL_ANIMS,pressForward};',context);
vm.runInContext('t.world=world;',context);
vm.runInContext('t.setUserPause=setUserPause;t.confirmRestart=confirmRestart;',context);
const t=context.t;
vm.runInContext('t.missionProgress=missionProgress;',context);
vm.runInContext('t.makeTargetContext=makeTargetContext;',context);
vm.runInContext('t.allies=allies;t.canHeroReachTarget=canHeroReachTarget;',context);
vm.runInContext('t.Militia=Militia;t.musterMilitia=musterMilitia;t.militiaAlive=militiaAlive;t.placeParty=placeParty;t.progress=progress;',context);
const cfg=id=>t.VARIANTS.find(v=>v.id===id);
// a composição da equipe fica numa faixa fixa (pick.team) ao lado da ficha (pick.info)
const pickText=()=>t.pick.info.innerHTML+t.pick.team.innerHTML;
// papéis que faltam viram ícones (class="wanted", nome em data-role); "priority" marca os pedidos pela missão
const wantedRoles=(priority)=>[...t.pick.team.innerHTML.matchAll(/class="wanted( priority)?" data-role="([^"]+)"/g)].filter(m=>!!m[1]===priority).map(m=>m[2]);
// barra de habilidades (glifos usados também na ficha da escolha)
vm.runInContext(part(source,'let skillKey','function pressSkill'),context);
vm.runInContext('t.buildSkillBar=buildSkillBar;t.skillItems=()=>skillItems;',context);
for(const v of t.VARIANTS) v.built={scene:{},animations:[]},v.portraits=['1','2','3'];
for(const n of ['Minion','Warrior','Rogue','Mage']) context.assets['Skeleton_'+n]={scene:{},animations:[]};
context.assets.Barbarian={scene:{},animations:[]};
context.location={search:'?tudo=1'};   // os testes antigos usam todas as variantes
for(const n of ['Skeleton_Blade','Skeleton_Axe','Skeleton_Shield_Small_A','Skeleton_Staff','Skeleton_Crossbow']) context.assets[n]={scene:{clone:root}};
const results=[];
const failures=[];
function test(name,fn){try{fn();results.push(name);console.log('OK:',name)}catch(e){failures.push(name);console.log('FALHOU:',name,'-',e.message.split('\n')[0])}}
function clear(){for(const u of [...t.units])u.remove();t.evolutions.length=0;t.pick.open=false;Object.assign(t.game,{over:false,paused:false,state:'fight',guideS:10,mission:null,last:12,picksLeft:0,falls:0,fallLog:[],runTime:0,damageSources:{},missionT:0,villager:null,militia:null,test:false});}
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
test('24 variantes, receitas e animações existentes nos GLB',()=>{
  assert.equal(t.VARIANTS.length,24);
  const glb=n=>{const f=path.join(dir,'assets',n+'.glb');if(!fs.existsSync(f))return JSON.parse(fs.readFileSync(path.join(dir,'assets',n+'.gltf'),'utf8'));const b=fs.readFileSync(f);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};
  for(const v of t.VARIANTS){
    const g=glb(v.recipe?.base||v.model),clips=g.animations.map(a=>a.name);
    for(const clip of [v.idle,...v.attacks,'Death_A','Block_Hit',t.SKILL_MOVES[v.id][0],'Dualwield_Melee_Attack_Stab']) assert.ok(clips.includes(clip),v.id+': '+clip);
    if(v.recipe) for(const add of v.recipe.add) assert.ok(glb(add.from).nodes.some(n=>n.name.replaceAll('.','')===add.part));
  }
});
test('72 habilidades têm corpo próprio em SKILL_ANIMS com clipes existentes nos GLB',()=>{
  const glb=n=>{const f=path.join(dir,'assets',n+'.glb');const b=fs.readFileSync(f);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};
  let total=0;
  for(const v of t.VARIANTS){
    const anims=t.SKILL_ANIMS[v.id],clips=glb(v.recipe?.base||v.model).animations.map(a=>a.name);
    assert.ok(anims,v.id+' sem SKILL_ANIMS');assert.equal(anims.length,t.skillSetFor(v).length,v.id);
    anims.forEach((a,slot)=>{
      for(const clip of [a.clip,a.hold].filter(Boolean)) assert.ok(clips.includes(clip),v.id+'['+slot+']: '+clip);
      assert.ok(a.f>0&&a.f<1,v.id+'['+slot+']: impacto');
      if(a.arc) assert.ok(['slash','chop','ring','thrust'].includes(a.arc),v.id+'['+slot+']: '+a.arc);
      total++;
    });
    assert.equal(new Set(anims.map(a=>JSON.stringify(a))).size,3,v.id+': as três habilidades devem ter corpos diferentes');
  }
  assert.equal(total,72);
  // o corpo novo respeita o tempo de SKILL_MOVES e desfaz salto, giro e inclinação ao terminar
  clear();const h=new t.Hero(cfg('champion'));const pace=t.SKILL_MOVES.champion[1]*0.82;
  assert.ok(Math.abs(h.skillBody(2,pace,true)-1/pace)<1e-9);
  for(let i=0;i<200;i++) h.tickSkillBody(0.02);
  assert.equal(h.skillMove,null);assert.equal(h.lift,0);assert.equal(h.root.rotation.x,0);
  clear();
});
test('classes: Druida entra em Suporte e Cronomante em Mago, com os atributos de antes',()=>{
  assert.equal(t.HEROES.length,5);assert.equal(t.CLASSES.length,5);
  for(const [id,classId] of [['cleric',4],['bard',4],['angel',4],['druid',4],['chronist',2]])assert.equal(cfg(id).classId,classId,id);
  const d=cfg('druid'),c=cfg('chronist');
  assert.deepEqual([d.hp,d.dmg,d.range,d.speed,d.cooldown],[180,21,6,3,1]);
  assert.deepEqual([c.hp,c.dmg,c.range,c.speed,c.cooldown,c.splash],[165,21,6,3.5,1.05,0]);
  assert.equal(cfg('cleric').recipe.base,'Mage');assert.ok(cfg('cleric').recipe.add.some(a=>a.part==='2H_Staff'));
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
  assert.ok(a.post.distanceTo(b.post)>1);t.showPick('','');assert.equal(t.pick.options.length,24);
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
  assert.ok(pickText().includes('Sua equipe com ')&&pickText().includes('class="candidate"')
    &&pickText().includes('data-role="Controle"')&&wantedRoles(false).length>0,'fora da missão, os papéis que faltam aparecem como ícones');
  t.confirmPick(at('pyro'));assert.equal(t.pick.open,true);
  t.selectCard(at('paladin'));t.moveGrid(0,1);assert.equal(t.pick.sel,at('berserker'));
  t.moveGrid(0,1);assert.equal(t.pick.sel,at('cryo'));t.moveGrid(-1,0);assert.equal(t.pick.sel,at('chronist'));
  t.moveGrid(1,0);assert.equal(t.pick.sel,at('cryo'));
});
test('escolha na campanha mostra objetivo e papéis prioritários projetados',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data,previousMission=t.game.mission;
  clear();context.location={search:''};context.localStorage.data={};t.setMission(t.MISSIONS.find(m=>m.id==='ponte'));
  t.showPick('','');const at=id=>t.pick.options.findIndex(hero=>hero.id===id);t.selectCard(at('paladin'));
  assert.ok(pickText().includes('Proteja o aldeão'));
  assert.deepEqual(wantedRoles(true),['Controle'],'prioridade da missão ainda não coberta fica destacada');
  t.selectCard(at('pyro'));
  assert.deepEqual(wantedRoles(true),['Defesa','Cura','Controle']);
  t.setMission(t.MISSIONS.find(m=>m.id==='fazendas'));t.selectCard(at('assassin'));
  assert.ok(pickText().includes('Derrote o chefe')&&/class="covered priority" data-role="Dano a chefe"/.test(pickText()));
  clear();context.location=previousLocation;context.localStorage.data=previousStorage;t.setMission(previousMission);
});
test('evoluções simultâneas pausam em fila e oferecem três opções distintas',()=>{
  clear();const a=new t.Hero(cfg('pyro')),b=new t.Hero(cfg('arcane'));a.gainXp(350);b.gainXp(90);
  assert.equal(t.evolutions.length,3);assert.equal(a.level,3);assert.ok(Math.abs(a.dmg-22*1.1**2)<.001);
  t.showEvolution();assert.equal(t.game.paused,true);assert.equal(new Set(t.pick.upgrades.map(o=>o.id)).size,3);
  t.confirmPick(0);assert.equal(t.evolutions.length,2);assert.equal(t.game.paused,true);
  t.confirmPick(0);t.confirmPick(0);assert.equal(t.evolutions.length,0);assert.equal(t.game.paused,false);
});
test('autoevolução só liga com permissão e resolve as escolhas automaticamente',()=>{
  clear();const key='cavaleiros-auto-evoluir',saved=context.localStorage.data[key];delete context.localStorage.data[key];
  const button=elements.get('autoEvolve');assert.equal(button.textContent,'Evolução: você escolhe');
  button.onclick();assert.equal(context.localStorage.data[key],'true');
  const healer=new t.Hero(cfg('cleric')),tank=new t.Hero(cfg('guardian'));
  t.evolutions.push({hero:healer,level:2},{hero:healer,level:3},{hero:tank,level:2});t.showEvolution();
  assert.equal(t.evolutions.length,0);assert.equal(t.pick.open,false);assert.equal(t.game.paused,false);
  assert.equal(healer.evolutionBranches.support,1);assert.equal(Object.keys(healer.evolutionBranches).length,2);assert.equal(tank.evolutionBranches.control,1);
  button.onclick();assert.equal(context.localStorage.data[key],'false');assert.equal(button.textContent,'Evolução: você escolhe');
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
test('todas as rotas acumulam sem perder os ganhos anteriores',()=>{
  clear();const h=new t.Hero(cfg('paladin'));const hp=h.maxHp,dmg=h.dmg;
  for(const option of t.EVOLUTION_BRANCHES){t.evolutions.push({hero:h,level:2});t.pick.upgrades=[option];t.confirmEvolution(0)}
  assert.deepEqual(Object.keys(h.evolutionBranches).sort(),['control','damage','support']);
  assert.equal(h.maxHp,hp);assert.ok(Math.abs(h.dmg-dmg*1.12)<1e-9);assert.ok(Math.abs(h.haste-1.08)<1e-9);
  assert.ok(Math.abs(h.controlPower-1.2)<1e-9);assert.ok(Math.abs(h.supportPower-1.2)<1e-9);
  assert.equal(h.skillRate,1);assert.equal(h.skillPower,1);assert.equal(h.damageTaken,1);
  h.gainXp(90);assert.ok(h.dmg>dmg*1.12);
});
test('missão que começa em nível alto aplica as rotas de evolução, sem sorteio',()=>{
  const evolve=id=>{clear();const h=new t.Hero(cfg(id));const hp=h.maxHp,dmg=h.dmg;h.gainXp(350);t.autoUpgrade();
    assert.equal(t.evolutions.length,0);assert.equal(t.pick.open,false);assert.equal(h.maxHp>hp*1.3,false,id);
    assert.equal(Object.keys(h.evolutionBranches).length,2,id);assert.ok(h.dmg<=dmg*1.1**2*1.12+1e-9,id);return Object.keys(h.evolutionBranches).sort().join()};
  for(const id of ['guardian','paladin','pyro','angel'])assert.equal(evolve(id),evolve(id),id);
  assert.equal(evolve('guardian').includes('control'),true);assert.equal(evolve('cleric').includes('support'),true);
  clear();
});
test('provocação do guardião e cura do paladino ferem de leve quem está colado',()=>{
  clear();const g=new t.Hero(cfg('guardian')),p=new t.Hero(cfg('paladin'));
  const enemy=new t.Skeleton('Warrior',1);enemy.spawning=false;enemy.pos.set(0,0,1.5);
  for(const h of t.heroes())h.pos.set(0,0,0);
  let hp=enemy.hp;assert.equal(g.useSkill(enemy),true);g.pendingHit.effect();g.pendingHit=null;
  assert.equal(enemy.taunt,g);assert.ok(Math.abs(hp-enemy.hp-g.dmg*.6)<1e-6);
  p.hp=p.maxHp*.4;hp=enemy.hp;assert.equal(p.useSkill(enemy),true);p.pendingHit.effect();p.pendingHit=null;
  assert.ok(p.hp>p.maxHp*.4);assert.ok(Math.abs(hp-enemy.hp-p.dmg*.45)<1e-6);
  clear();
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
  assert.equal(t.pick.cards.length,4);assert.match(t.pick.cards[3].innerHTML,/Reino/);
  let next;context.setTimeout=(fn,ms)=>{if(ms===550||ms===450)next=fn};
  t.confirmPick(1);next();assert.equal(t.pick.mode,'difficulty');assert.equal(t.pick.cards.length,4);assert.equal(t.game.mission,null);
  t.confirmPick(2);assert.equal(t.getDifficulty().id,'dificil');assert.equal(elements.get('level').textContent,'♜','HUD mostra o ícone da dificuldade; o nome fica na dica');
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
  t.game.toSpawn=3;for(let k=0;k<5;k++)t.spawnSkeleton();   // onda ainda cheia: o chefe espera
  Object.assign(t.game,{toSpawn:1,spawnTimer:0,state:'fight',bossPending:true});t.updateGame(.1);
  assert.equal(t.game.toSpawn,1);assert.ok(!t.units.some(u=>u.phaseBoss));
  t.skeletonsAlive()[0].remove();t.updateGame(.1);assert.equal(t.game.toSpawn,0);assert.ok(t.units.some(u=>u.phaseBoss));
  for(const u of [...t.units])if(u.team==='skeleton')u.remove();
  Object.assign(t.game,{phase:12,state:'cleared',timer:0});t.updateGame(.1);assert.equal(t.game.over,true);
  // título grande separado; a linha de baixo diz só o motivo
  assert.equal(elements.get('overlayTitle').textContent,'Vitória!');assert.ok(elements.get('overlayText').textContent.startsWith('O grupo chegou ao castelo'));
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
    assert.equal(t.skillSetFor(v),skills,v.id+' lista fica em cache por variante');
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
  assert.equal(e.flashHeavy,true,'acerto da ultimate pisca branco no alvo');
  assert.equal(h.ultHit,false,'a marca de ultimate vale só durante o golpe');
  const after=e.hp;e.takeDamage(10,null,h);assert.ok(e.hp<after);assert.equal(e.flashHeavy,false,'golpe comum volta ao clarão vermelho');
});
test('técnicas e ultimates das 24 variantes executam seus efeitos sem erro',()=>{
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
test('Duelista: rajada alterna as lâminas, Corte em X atravessa a fila e a Dança de lâminas corta todos ao redor',()=>{
  const foe=(x,z)=>{const e=new t.Skeleton('Warrior',1);e.spawning=false;e.busy=99;e.pos.set(x,0,z);e.hp=e.maxHp=100000;return e};
  clear();let d=new t.Hero(cfg('duelist'));d.pos.set(0,0,0);
  assert.equal(cfg('duelist').classId,3);assert.deepEqual(Array.from(cfg('duelist').use),['1H_Sword','1H_Sword_Offhand']);
  assert.equal(t.skillSetFor(cfg('duelist')).length,3);
  // básica: quatro cortes no alvo à frente
  let e=foe(0,1.5);assert.equal(d.useSkill(e),true);
  let cuts=0;while(d.pendingHit?.effect&&cuts<8){const hp=e.hp,p=d.pendingHit;d.pendingHit=null;p.effect();if(e.hp<hp)cuts++;}
  assert.equal(cuts,4,"quatro cortes alternados");assert.ok(d.skillTimers[0]>0);
  assert.equal(new t.Hero(cfg('duelist')).useSkill(foe(0,6)),false,'a rajada só usa alvo colado');
  // técnica: a IA só avança com fila e atinge todos na linha, mas não quem está fora dela
  clear();d=new t.Hero(cfg('duelist'));d.pos.set(0,0,0);
  const lone=foe(0,3);assert.equal(d.useSkill(lone,false,false,1),false,'sem fila a IA guarda o Corte em X');
  const line=[lone,foe(0.2,4.5),foe(-0.2,5.5)],off=foe(4,3);
  assert.equal(d.useSkill(lone,false,false,1),true);d.pendingHit.effect();
  for(const s of line)assert.ok(s.hp<s.maxHp,'inimigo da fila atingido');
  assert.equal(off.hp,off.maxHp,'fora da linha não é atingido');assert.ok(d.pos.z>5,'atravessa a fila');
  // ultimate: precisa de vários inimigos perto; gira cortando todos ao redor
  clear();d=new t.Hero(cfg('duelist'));d.pos.set(0,0,0);
  const ring=[foe(1.5,0),foe(-1.5,0),foe(0,1.5)],far=foe(0,9);
  assert.equal(d.useSkill(null,false,false,2),true);d.pendingHit.effect();assert.ok(d.bladeDanceT>0);
  const once=ring.map(s=>s.hp);for(let i=0;i<40;i++)d.update(.1);
  for(const [i,s] of ring.entries())assert.ok(s.hp<once[i]-50,'todos ao redor levam vários cortes');
  assert.equal(far.hp,far.maxHp,'longe da dança não é atingido');assert.ok(d.bladeDanceT<=0,'a dança termina');
  clear();
});
const newFoe=(x,z,type='Warrior')=>{const e=new t.Skeleton(type,1);e.spawning=false;e.busy=99;e.pos.set(x,0,z);e.hp=e.maxHp=100000;return e};
// roda as áreas no chão (chuva, poças, frasco) por "seconds"
const runPools=(seconds)=>{for(let i=0;i<Math.round(seconds/0.1);i++)t.updateBolts(.1);};
test('Arqueira: Flecha longa atravessa a fila, Chuva de flechas cai na área marcada e a marca do caçador aumenta o dano de todos',()=>{
  clear();t.bolts.length=0;context.flames.length=0;t.frameTargetContext.skeletons.length=0;
  assert.equal(cfg('archer').classId,3);assert.equal(cfg('archer').model,'Rogue_Hooded');
  let a=new t.Hero(cfg('archer'));a.pos.set(0,0,0);
  // básica: escolhe a linha com mais inimigos e a flecha atravessa todos, até além do alcance comum
  const row=[newFoe(0,-3),newFoe(0.2,-6),newFoe(-0.2,-9.5)],side=newFoe(5,-1);
  assert.equal(a.useSkill(null),true);a.pendingHit.effect();
  assert.equal(t.bolts.at(-1).kind,'archer');
  for(let i=0;i<12;i++)t.updateBolts(.05);
  for(const s of row)assert.ok(s.hp<s.maxHp,'a flecha atravessa a fila inteira');
  assert.equal(side.hp,side.maxHp,'fora da linha não é atingido');
  // técnica: marca a área no grupo e, depois do aviso, as flechas caem só dentro dela
  clear();t.bolts.length=0;context.flames.length=0;a=new t.Hero(cfg('archer'));a.pos.set(0,0,0);
  const pack=[newFoe(0,-6),newFoe(1,-6.5),newFoe(-0.8,-6.3)],away=newFoe(6,0);
  assert.equal(a.useSkill(null,false,false,1),true);a.pendingHit.effect();
  runPools(0.4);assert.ok(pack.every(s=>s.hp===s.maxHp),'nada cai antes do aviso no chão');
  runPools(2);const volley=a.dmg*1.5/5;for(const s of pack)assert.ok(s.maxHp-s.hp>volley*4,'várias salvas de flechas no grupo marcado');
  assert.equal(away.hp,away.maxHp,'fora da área não é atingido');assert.equal(context.flames.length,0,'a chuva termina');
  // ultimate: marca o chefe (prioridade), fere e todos passam a bater mais forte nele até a marca acabar
  clear();a=new t.Hero(cfg('archer'));a.pos.set(0,0,0);
  const minion=newFoe(0,-3,'Minion'),boss=new t.Skeleton('Warrior',1,true);boss.spawning=false;boss.busy=99;boss.pos.set(2,0,-6);boss.hp=boss.maxHp=100000;
  assert.equal(a.useSkill(null,false,true,2),true);a.pendingHit.effect();
  assert.ok(boss.markT>0&&boss.markBonus>0,'o chefe é o marcado');assert.ok(boss.hp<boss.maxHp);assert.equal(minion.markT,0);
  let hp=boss.hp;boss.takeDamage(100,null,null);assert.ok(Math.abs(hp-boss.hp-100*(1+boss.markBonus))<1e-6,'marcado recebe +bônus de qualquer fonte');
  for(let i=0;i<100;i++)boss.update(.1);
  hp=boss.hp;boss.takeDamage(100,null,null);assert.ok(Math.abs(hp-boss.hp-100)<1e-6,'a marca acaba');
  clear();t.bolts.length=0;context.flames.length=0;
});
test('Monge: cem punhos terminam em chute que atordoa, Palma do vento empurra em cone e a Meditação deixa imune e cura o grupo',()=>{
  clear();
  assert.equal(cfg('monk').classId,1);assert.deepEqual(Array.from(cfg('monk').use),[]);assert.equal(cfg('monk').idle,'Unarmed_Idle');
  let m=new t.Hero(cfg('monk'));m.pos.set(0,0,0);
  let e=newFoe(0,1.4);assert.equal(m.useSkill(e),true);
  let hits=0;while(m.pendingHit?.effect&&hits<10){const hp=e.hp,p=m.pendingHit;m.pendingHit=null;p.effect();if(e.hp<hp)hits++;}
  assert.equal(hits,5,'quatro socos e um chute');assert.ok(e.stunT>0,'o chute atordoa');
  // técnica: cone à frente, quem está atrás fica de fora
  clear();m=new t.Hero(cfg('monk'));m.pos.set(0,0,0);
  const front=[newFoe(0,2),newFoe(1,3),newFoe(-1,3.2)],back=newFoe(0,-2);
  assert.equal(m.useSkill(null,false,false,1),true);m.pendingHit.effect();
  for(const s of front){assert.ok(s.hp<s.maxHp,'no cone leva dano');assert.ok(s.vel.z>4,'e é empurrado para longe');}
  assert.equal(back.hp,back.maxHp,'atrás do monge não é atingido');
  // ultimate: imune durante a meditação, cura quem está perto, não quem está longe, e acaba
  clear();m=new t.Hero(cfg('monk'));const near=new t.Hero(cfg('paladin')),far=new t.Hero(cfg('cleric'));
  m.pos.set(0,0,0);near.pos.set(2,0,0);far.pos.set(15,0,0);near.hp=far.hp=50;m.hp=m.maxHp*0.4;
  assert.equal(m.useSkill(null,false,false,2),true,'a IA medita com o grupo ferido');m.pendingHit.effect();
  assert.ok(m.immuneT>0&&m.meditateT>0);
  const before=m.hp;m.takeDamage(80,null,newFoe(0,1));assert.equal(m.hp,before,'imune enquanto medita');
  for(let i=0;i<10;i++)m.update(.1);
  assert.ok(near.hp>50,'cura o aliado próximo');assert.equal(far.hp,50,'longe não é curado');
  for(let i=0;i<50;i++)m.update(.1);
  assert.ok(m.meditateT<=0&&m.immuneT<=0,'a meditação termina');
  const after=m.hp;m.takeDamage(20,null,null);assert.ok(m.hp<after,'volta a levar dano');
  clear();
});
test('Alquimista: frasco de tônico cura na poça, veneno fere ao longo do tempo, frasco volátil explode e a transmutação vira ovelhas até acabar',()=>{
  clear();t.bolts.length=0;context.flames.length=0;t.frameTargetContext.skeletons.length=0;
  assert.equal(cfg('alchemist').classId,4);
  let al=new t.Hero(cfg('alchemist'));al.pos.set(0,0,0);
  const ally=new t.Hero(cfg('guardian'));ally.pos.set(0,0,-4);ally.hp=ally.maxHp*0.4;
  const foe=newFoe(0,-5);
  // com aliado ferido o frasco é tônico e cai nele
  assert.equal(al.useSkill(null),true);al.pendingHit.effect();assert.equal(t.bolts.at(-1).kind,'tonic');
  const hpBefore=ally.hp;for(let i=0;i<30;i++)t.updateBolts(.05);
  assert.ok(context.flames.length>0,'a poça fica no chão');
  runPools(2);assert.ok(ally.hp>hpBefore+20,'a poça de tônico cura aos poucos');assert.equal(foe.hp,foe.maxHp,'tônico não fere');
  runPools(6);assert.equal(context.flames.length,0,'a poça seca');
  // sem feridos: veneno no inimigo, dano ao longo de vários pulsos
  clear();t.bolts.length=0;al=new t.Hero(cfg('alchemist'));al.pos.set(0,0,0);const target=newFoe(0,-4);
  assert.equal(al.useSkill(null),true);al.pendingHit.effect();assert.equal(t.bolts.at(-1).kind,'flask');
  for(let i=0;i<30;i++)t.updateBolts(.05);
  const first=target.hp;runPools(1);const mid=target.hp;runPools(1);
  assert.ok(first>mid&&mid>target.hp,'o veneno continua ferindo a cada pulso');
  runPools(6);context.flames.length=0;
  // técnica: explode no grupo depois do voo, empurra e deixa veneno
  clear();t.bolts.length=0;al=new t.Hero(cfg('alchemist'));al.pos.set(0,0,0);
  const pack=[newFoe(0,-5),newFoe(0.8,-5.4),newFoe(-0.6,-5.2)];
  assert.equal(al.useSkill(null,false,false,1),true);al.pendingHit.effect();
  runPools(0.2);assert.ok(pack.every(s=>s.hp===s.maxHp),'o frasco ainda está no ar');
  runPools(0.4);for(const s of pack)assert.ok(s.hp<s.maxHp,'a explosão fere o grupo');
  assert.ok(context.flames.some(f=>f.dmg&&f.every===0.5),'deixa uma poça de veneno');
  context.flames.length=0;
  // ultimate: comuns viram ovelhas (não atacam), chefe só fica lento, e tudo volta ao normal
  clear();al=new t.Hero(cfg('alchemist'));al.pos.set(0,0,0);const tank=new t.Hero(cfg('guardian'));tank.pos.set(0,0,1);
  const herd=[newFoe(0,2,'Minion'),newFoe(1.5,2,'Minion'),newFoe(-1.5,2.5,'Minion')],boss=new t.Skeleton('Warrior',1,true);
  boss.spawning=false;boss.busy=99;boss.pos.set(0,0,-3);
  assert.equal(al.useSkill(null,false,false,2),true);al.pendingHit.effect();
  for(const s of herd)assert.ok(s.sheepT>0,'inimigo comum vira ovelha');
  assert.equal(boss.sheepT,0,'chefe não vira ovelha');assert.ok(boss.slowT>0,'chefe fica lento');
  const hp=tank.hp;for(const s of herd){s.busy=0;s.attackTimer=0;}
  for(let i=0;i<20;i++)for(const s of herd)s.update(.1);
  assert.equal(tank.hp,hp,'ovelhas não atacam');assert.ok(herd.every(s=>!s.pendingHit));
  for(let i=0;i<60;i++)for(const s of herd)s.update(.1);
  assert.ok(herd.every(s=>s.sheepT===0),'a transmutação acaba');
  clear();
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
test('17 missões com objetivo e todo o elenco liberado desde o início',()=>{
  assert.equal(t.MISSIONS.length,17);for(const m of t.MISSIONS)assert.ok(context.goalText(m.goal),m.id);
  context.location={search:''};context.localStorage.data={};
  assert.equal(t.VARIANTS.filter(v=>t.variantOpen(v.id)).length,24);assert.equal(t.UNLOCKS.length,0);
  clear();t.showPick('','');assert.ok(!t.pick.cards[idx('guardian')].innerHTML.includes('class="lock"'));
  context.saveStars('vila',3);assert.equal(t.totalStars(),3);assert.ok(t.unlocked(1)&&!t.unlocked(2));
  context.location={search:'?tudo=1'};assert.ok(t.unlocked(7));
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
  assert.ok(info.innerHTML.includes('Fase 3 · '));   // ponte 2–4: o bombardeiro estreia dentro do trecho
  assert.ok(info.innerHTML.includes('Bombardeiro'));
  assert.ok(info.innerHTML.includes('Seus melhores tempos')&&info.innerHTML.includes('1:12'));
  // painel enxuto: história, plano e descrições dos inimigos só em dicas; Batalhar continua no painel
  const visible=info.innerHTML.replace(/\s(?:data-tip|aria-label)="[^"]*"/g,'');
  for(const gone of ['Plano de batalha','Estrelas acumulativas','Inimigos especiais','Desafios opcionais','Capítulo','Bombardeiro'])assert.ok(!visible.includes(gone),`${gone} não fica à vista`);
  assert.ok(info.innerHTML.includes('data-tip="1★ Concluir a missão"'),'critério de cada estrela na dica');
  assert.ok(visible.includes('class="camp-play"'));
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
  assert.match(view.info.innerHTML,/34 estrelas restantes/);
  context.localStorage.data={'cavaleiros-campanha':JSON.stringify(Object.fromEntries(t.MISSIONS.map(m=>[m.id,3])))};
  view=render();
  assert.ok(view.map.children.at(-1).classList.contains('sel'));
  assert.match(view.info.innerHTML,/Campanha perfeita/);
  assert.match(view.info.innerHTML,/Todas as 51 estrelas foram conquistadas/);
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
  begin('ponte',['berserker','assassin']);assert.ok(t.game.villager instanceof t.Villager);assert.equal(t.game.phase,2);
  assert.deepEqual(JSON.parse(context.localStorage.getItem('cavaleiros-equipe-campanha')),['berserker','assassin']);
  clear();t.setMission(mission('lago'));t.showDifficulty();
  let next;context.setTimeout=(fn,ms)=>{if(ms===550)next=fn};t.confirmPick(1);next();
  assert.equal(t.pick.options[t.pick.sel].id,'berserker');assert.ok(t.pick.cards[t.pick.sel].innerHTML.includes('Equipe anterior'));
  const hint=elements.get('pickHint').textContent;assert.ok(hint.length<=20,'rodapé mínimo');
  t.selectCard(idx('pyro'));assert.equal(elements.get('pickHint').textContent,hint);
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
  begin('lago',['paladin','pyro','berserker']);assert.equal(t.game.phase,4);Object.assign(t.game,{phase:5,state:'fight',toSpawn:0});t.updateGame(.1);
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
test('resgate: prisioneiro longe e guardado, fora do alvo dos esqueletos e libertado só após segurar perto',()=>{
  context.location={search:''};
  begin('resgate',['paladin','pyro','berserker']);
  const v=t.game.villager;assert.equal(v.captive,true);assert.equal(v.rescued,false);
  assert.ok(t.heroes().every(h=>h.pos.distanceTo(v.pos)>10),'o prisioneiro nasce longe do grupo');
  assert.ok(!t.allies().includes(v));assert.ok(!t.makeTargetContext().alliedUnits.includes(v));
  t.startPhase();
  assert.equal(t.skeletonsAlive().filter(s=>s.pos.distanceTo(v.pos)<3).length,2,'guardas ao lado do prisioneiro');
  for(const u of t.skeletonsAlive())u.remove();t.game.toSpawn=0;
  t.updateGame(.1);assert.equal(t.game.state,'fight','a fase espera o resgate');assert.equal(elements.get('left').textContent,'Liberte o prisioneiro');
  const h=t.heroes()[0],before=h.pos.distanceTo(v.pos);h.busy=0;h.update(.2);h.update(.2);assert.ok(h.pos.distanceTo(v.pos)<before,'sem inimigos, o herói vai até o prisioneiro');
  h.pos.set(v.pos.x+1,0,v.pos.z);t.updateGame(1);
  assert.equal(v.rescued,false);assert.ok(Math.abs(t.missionProgress({type:'rescue'})-.4)<.01);assert.match(v.nameTag.textContent,/Libertando 40%/);
  t.updateGame(1.6);assert.equal(v.rescued,true);assert.equal(t.game.rescueComplete,true);assert.equal(t.game.state,'cleared');
  assert.ok(t.allies().includes(v),'depois de solto ele volta a ser protegido e alvo');
});
test('torre: segura a fase, o HUD avisa e o grupo vai até ela quando não há inimigos',()=>{
  context.location={search:''};
  begin('torre',['paladin','pyro','berserker','assassin']);t.startPhase();
  const tower=t.skeletonsAlive().find(u=>u.tower);assert.ok(tower);tower.spawning=false;tower.spawnT=99;t.game.toSpawn=0;
  const h=t.heroes()[0];h.post.copy(h.pos);tower.pos.set(h.pos.x+30,0,h.pos.z);
  const guard=new t.Skeleton('Minion',t.game.phase);guard.spawning=false;guard.pos.copy(h.pos);
  assert.equal(t.canHeroReachTarget(h,tower,t.makeTargetContext()),false,'com inimigos por perto, não persegue a torre longe');
  guard.remove();assert.equal(t.canHeroReachTarget(h,tower,t.makeTargetContext()),true);
  t.updateGame(.1);assert.equal(t.game.state,'fight');
  assert.equal(elements.get('left').textContent,'Derrube a torre');assert.equal(elements.get('banner').textContent,'Derrube a torre!');
  tower.takeDamage(99999,null,h);assert.equal(t.game.towersDown,1);t.updateGame(.1);assert.equal(t.game.state,'cleared');
});
test('estrelas no fim: gravam o melhor e não contam com ?fase',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('vila',['paladin']);Object.assign(t.game,{phase:3,state:'cleared',timer:0,missionT:83});t.updateGame(.1);
  assert.equal(t.starsOf('vila'),3);const stars=elements.get('overlayStars').innerHTML;
  assert.equal((stars.match(/class="on"/g)||[]).length,3);assert.ok(!stars.includes('Nova variante liberada!'));
  assert.ok(stars.includes('Concluir a missão')&&stars.includes('Terminar sem quedas (0 quedas)')&&stars.includes('atual 100%'));
  assert.ok(stars.includes('Novo recorde · Normal · 1:23'));
  assert.deepEqual(Array.from(t.missionRecords('vila'),r=>r.difficultyId),['normal']);
  assert.ok(t.variantOpen('viking'));assert.equal(elements.get('overlayBtn').textContent,'Mapa');
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
test('trechos da campanha variam, crescem e só missões de chefe passam pelas fases 6 e 12',()=>{
  const ranges=new Set(),icons=new Set();let from=1;
  for(const m of t.MISSIONS){
    assert.ok(m.from>=1&&m.to<=12&&m.from<=m.to,m.id);
    assert.ok(m.from>=from,`${m.id} não pode recuar o início`);from=m.from;
    assert.ok(!ranges.has(m.from+'-'+m.to),`${m.id} repete trecho`);ranges.add(m.from+'-'+m.to);
    assert.ok(!icons.has(m.icon),`${m.id} repete ícone`);icons.add(m.icon);
    const bossPhase=[6,12].some(p=>p>=m.from&&p<=m.to);assert.equal(bossPhase,['boss','duel','twin'].includes(m.goal.type),m.id);
    if(m.goal.type==='survive')assert.ok(m.goal.phase>=m.from&&m.goal.phase<=m.to);
    assert.ok(m.chapter&&m.story,m.id);
  }
  assert.equal(t.MISSIONS.at(-1).to,12);
});
test('medalha guarda a melhor dificuldade vencida e desafios de 3★ nas dificuldades altas',()=>{
  context.localStorage.data={};
  assert.equal(context.missionMedal('vila').best,null);
  assert.equal(context.saveMissionMedal('vila',{won:false,stars:0,difficultyId:'pesadelo'}).newBest,false);
  let r=context.saveMissionMedal('vila',{won:true,stars:3,difficultyId:'facil'});
  assert.equal(r.newBest,true);assert.equal(r.newChallenge,null);   // 3★ no Fácil não cumpre desafio
  r=context.saveMissionMedal('vila',{won:true,stars:2,difficultyId:'dificil'});assert.equal(r.newBest,true);assert.equal(r.newChallenge,null);
  r=context.saveMissionMedal('vila',{won:true,stars:3,difficultyId:'normal'});assert.equal(r.newBest,false);
  assert.equal(context.missionMedal('vila').best.difficultyName,'Difícil');
  r=context.saveMissionMedal('vila',{won:true,stars:3,difficultyId:'dificil'});assert.equal(r.newChallenge.label,'3★ no Difícil');
  assert.deepEqual(Array.from(context.missionMedal('vila').challenges,c=>c.done),[true,false]);
  t.saveMissionRecord('ponte',{won:true,seconds:90,difficultyId:'pesadelo'});   // recordes antigos contam como medalha
  assert.equal(context.missionMedal('ponte').best.difficultyId,'pesadelo');
  const map=el(),info=el(),root=el();map.children=[];root.isConnected=true;root.closest=()=>null;
  root.querySelector=selector=>selector==='.camp-map'?map:info;
  context.location={search:'?tudo=1'};context.renderCampaign(root,noop);context.location={search:''};
  assert.ok(map.children[0].innerHTML.includes('camp-seal seal-dificil challenge'));
  assert.ok(map.children[1].innerHTML.includes('seal-pesadelo'));assert.ok(!map.children[2].innerHTML.includes('camp-seal'));
  assert.ok(info.innerHTML.includes('Desafios opcionais')&&info.innerHTML.includes('Vencida no Difícil'));
});
test('fim da missão mostra recompensa, medalha e o botão da próxima missão',()=>{
  context.location={search:''};context.localStorage.data={};
  try{
    begin('vila',['paladin']);t.setDifficulty(2);Object.assign(t.game,{phase:2,state:'cleared',timer:0,missionT:70});t.updateGame(.1);
    const html=elements.get('overlayStars').innerHTML;
    assert.ok(html.includes('Recompensa')&&html.includes('+3 ★ na campanha · 3/51'));
    assert.ok(html.includes('Medalha Difícil conquistada!')&&html.includes('Desafio cumprido: 3★ no Difícil!'));
    // o próximo passo virou só o botão "Próxima ▸" ao lado de "Mapa"; o nome da missão fica na dica e no aria-label
    const next=elements.get('overlayNext').innerHTML;
    assert.ok(next.includes('Nova missão liberada: A Ponte do Rio')&&next.includes('Próxima missão: A Ponte do Rio')&&next.includes('Próxima ▸'));
    context.createWorld=()=>t.world;   // a próxima missão recria o cenário; aqui o duplo basta
    t.startGame(mission('ponte'));assert.equal(t.game.mission.id,'ponte');assert.equal(t.pick.mode,'difficulty');
    begin('ponte',['paladin','pyro']);t.game.villager.takeDamage(9999);t.updateGame(.1);
    assert.ok(elements.get('overlayNext').innerHTML.includes('Tentar de novo'));
    assert.ok(!elements.get('overlayStars').innerHTML.includes('Recompensa'));
  }finally{t.setDifficulty(1);}
});
test('primeira fase da missão abre com faixa curta, sem a história',()=>{
  context.location={search:''};
  begin('ponte',['paladin','pyro']);const banner=elements.get('banner');banner.children.length=0;t.startPhase();
  assert.equal(banner.textContent,'A Ponte do Rio · Fase 2');
  assert.equal(banner.children.length,0,'capítulo e história ficam no mapa, não na faixa da luta');
  banner.children.length=0;t.game.phase=3;t.startPhase();assert.equal(banner.textContent,'Fase 3');assert.equal(banner.children.length,0);
});
test('Ferrão de gigante só aparece com chefe ou golem pela frente',()=>{
  const offered=(id,phase,last)=>{
    clear();t.game.mission=mission(id);Object.assign(t.game,{phase,last});const seen=new Set();
    for(let i=0;i<120;i++){context.showRelicPick();for(const r of t.pick.options)seen.add(r.id);}
    clear();return seen.has('giant-bane');
  };
  assert.equal(offered('lago-sombrio',10,11),false);
  assert.equal(offered('cemiterio',11,11),false);
  assert.equal(offered('resgate',8,8),true);   // golem fecha a fase 8
  assert.equal(offered('fazendas',5,6),true);  // Rei na fase 6
  t.game.paused=false;context.document.getElementById('pick').classList.add('hidden');
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
  const used=['Blocking','Block_Hit','Block','Use_Item','Spellcast_Raise','Spellcast_Summon','Spellcast_Shoot','Spellcasting','Spellcast_Long','Throw','2H_Melee_Attack_Spin','1H_Melee_Attack_Stab','Death_C_Skeletons_Resurrect','Jump_Idle','Spawn_Air','1H_Melee_Attack_Stab','1H_Melee_Attack_Jump_Chop','2H_Melee_Attack_Chop','Taunt','Running_C'];
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
    assert.equal(t.pickMonster(7,'Minion'),'Skull'); // só a estreia da fase 7 (enxame) é forçada
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
test('habilidades usam a dica própria em vez do title nativo',()=>{
  clear();const hero=new t.Hero(cfg('pyro'));
  const create=context.document.createElement;
  context.document.createElement=()=>{const e=el();e.attrs={};e.setAttribute=(k,v)=>{e.attrs[k]=String(v)};return e};
  try{t.buildSkillBar([hero]);}finally{context.document.createElement=create;}
  const items=t.skillItems();assert.equal(items.length,3);
  for(const it of items){
    assert.equal(it.b.title,undefined,'o botão não deve usar title');
    assert.ok(!/\stitle=/.test(it.b.innerHTML),'nada de title no conteúdo do botão');
    assert.equal(it.b.attrs['data-tip'],'skill');assert.equal(it.b.attrs['data-hero'],'pyro');assert.equal(it.b.attrs['data-slot'],String(it.slot));
  }
  assert.ok(!/\.title\s*=|\stitle=/.test(part(source,'function buildSkillBar','function pressSkill')));
  t.showPick('','');t.selectCard(t.pick.options.findIndex(v=>v.id==='pyro'));
  assert.equal((t.pick.info.innerHTML.match(/data-tip="skill"/g)||[]).length,3,'habilidades da ficha também têm a dica');
  clear();
});
test('relatório de batalha registra golpes corpo a corpo e tiros inimigos',()=>{
  clear();t.clearMonsterFx();const h=hero('king',0,0);h.hp=h.maxHp=10000;
  const melee=foe('Warrior',0,1);melee.pendingHit={target:h,t:0};melee.update(.01);
  const total=()=>Object.values(t.game.damageSources).reduce((n,s)=>n+s.hits,0);
  assert.equal(total(),1);assert.equal(h.lastHit,melee);
  const archer=foe('Mage',0,6);context.fireEnemyBolt(archer,h);for(let i=0;i<20&&total()<2;i++)context.updateEnemyBolts(.05);
  assert.equal(total(),2);assert.equal(h.lastHit,archer);clear();
});
test('saves antigos mantêm liberada a missão que já tem estrelas',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data;
  try {
    context.location={search:''};context.localStorage.data={'cavaleiros-campanha':JSON.stringify({vila:3,ponte:3,fazendas:2,ruinas:2,'lago-sombrio':1})};
    const i=id=>t.MISSIONS.findIndex(m=>m.id===id);
    assert.equal(t.unlocked(i('lago')),true);assert.equal(t.unlocked(i('ruinas')),true);assert.equal(t.unlocked(i('lago-sombrio')),true);
    assert.equal(t.unlocked(i('cemiterio')),true);assert.equal(t.unlocked(i('castelo')),false);
  } finally { context.location=previousLocation;context.localStorage.data=previousStorage; }
});
test('primário do Necromante não desfaz o Exército dos Mortos',()=>{
  clear();const necro=hero('necro',0,0);const e=foe('Warrior',0,2);e.hp=e.maxHp=10000;
  const cast=slot=>{assert.equal(necro.useSkill(e,false,true,slot),true);necro.pendingHit.effect();necro.pendingHit=null};
  const mine=()=>t.units.filter(u=>u.summoner===necro);
  cast(2);assert.equal(mine().length,4);cast(0);assert.equal(mine().length,6);
  cast(0);assert.equal(mine().length,6);assert.equal(mine().filter(u=>u.ultimate).length,4);clear();
});
test('brado do Rei não reduz o Hino do Bardo e o bônus zera ao expirar',()=>{
  clear();const king=hero('king',0,0),bard=hero('bard',1,0);const e=foe('Warrior',0,2);e.hp=e.maxHp=10000;
  assert.equal(bard.useSkill(e,false,true,2),true);bard.pendingHit.effect();bard.pendingHit=null;
  const song=bard.royalT;assert.equal(bard.royalBonus,.3);
  assert.equal(king.useSkill(e,false,true,0),true);king.pendingHit.effect();king.pendingHit=null;
  assert.equal(bard.royalBonus,.3);assert.equal(bard.royalT,song);
  bard.update(song+1);assert.ok(bard.royalT<=0);assert.equal(bard.royalBonus,0);
  assert.equal(king.useSkill(e,false,true,0),true);king.pendingHit.effect();king.pendingHit=null;assert.equal(bard.royalBonus,.2);clear();
});
test('pausa do jogador, reinício com confirmação e cartões de menu focáveis',()=>{
  clear();const $=id=>context.document.getElementById(id);for(const id of ['resume','pause','restart','restartNo'])$(id).focus=noop;
  new t.Hero(cfg('paladin'));
  t.setUserPause(true);assert.equal(t.game.paused,true);assert.equal(t.game.userPaused,true);assert.equal($('pauseOverlay').hidden,false);
  t.setUserPause(false);assert.equal(t.game.paused,false);assert.equal($('pauseOverlay').hidden,true);
  t.pick.open=true;t.setUserPause(true);assert.equal(t.game.paused,false,'menu aberto não aceita a pausa do jogador');t.pick.open=false;
  t.game.paused=true;t.setUserPause(true);assert.notEqual(t.game.userPaused,true,'pausa de tela não vira pausa do jogador');t.game.paused=false;
  $('restart').onclick();assert.equal($('restartConfirm').hidden,false,'reiniciar no meio da partida pede confirmação');assert.equal(t.game.paused,true);
  t.confirmRestart(false);assert.equal($('restartConfirm').hidden,true);assert.equal(t.game.paused,false);assert.equal(t.units.length,1,'cancelar mantém a partida');
  t.showMenu();assert.ok(t.pick.cards.every(card=>card.tabIndex===0));
  t.showDifficulty();assert.ok(t.pick.cards.every(card=>card.tabIndex===0));
  clear();
});
test('com a onda longe, o grupo avança ao encontro dela até o limite da fase',()=>{
  clear();Object.assign(t.game,{phase:6,guideS:60});const h=hero('paladin',0,-60);
  const far=foe('Warrior',0,-80);
  for(let i=0;i<100;i++)t.pressForward(.1,[far]);
  assert.ok(t.game.guideS>60&&t.game.guideS<=67+1e-9,'avança no máximo 7 m além do ponto da fase');assert.ok(h.post.z<-60);
  t.game.guideS=60;const back=foe('Minion',0,-50);t.pressForward(1,[far,back]);assert.equal(t.game.guideS,60,'inimigo atrás segura o grupo');
  t.game.guideS=60;back.dead=true;const near=foe('Minion',0,-64);t.pressForward(1,[near]);assert.equal(t.game.guideS,60,'inimigo perto: luta no posto');
  t.game.guideS=0;clear();
});
// ---------- progressão entre partidas (ouro, maestria, oficina, conquistas) ----------
const prog=vm.runInContext('progress',context);
const withLiveGame=fn=>{   // partida "de verdade": sem ?tudo=1, storage restaurado no fim
  const previousSummary=context.summaryHTML,previousLocation=context.location,previousStorage={...context.localStorage.data};
  try{context.summaryHTML=()=>'';context.location={search:''};fn();}
  finally{context.summaryHTML=previousSummary;context.location=previousLocation;context.localStorage.data=previousStorage;clear();}
};
test('progressão: ultimates usadas entram na contagem da partida',()=>{
  clear();t.game.ultimates=0;const h=new t.Hero(cfg('champion'));h.pos.set(0,0,0);h.skillTimers[2]=0;h.skillTimers[1]=0;
  const e=new t.Skeleton('Minion',1);e.spawning=false;e.busy=99;e.pos.set(0,0,3);e.hp=e.maxHp=1000;
  assert.equal(h.useSkill(e,false,true,2),true,'lança a ultimate');assert.equal(t.game.ultimates,1,'ultimate: '+t.game.ultimates);
  h.busy=0;h.useSkill(e,false,true,1);assert.equal(t.game.ultimates,1,'técnica não conta como ultimate');
  clear();
});
test('progressão: fim de partida credita ouro, maestria e contadores e mostra a recompensa',()=>withLiveGame(()=>{
  const before=prog.snapshot();const h=new t.Hero(cfg('ninja'));h.stats.abates=40;
  Object.assign(t.game,{test:false,roster:[h],mission:null,start:1,phase:12,last:12,kills:150,relics:['keen-edge','oak-charm'],ultimates:3});
  elements.get('overlayStars').innerHTML='';
  t.endGame('Vitória',true);
  const after=prog.snapshot();
  const mult=vm.runInContext('DIFFICULTY_REWARD',context)[t.getDifficulty().id]*(1+0.08*prog.upgradeLevel('bounty'));
  assert.equal(after.gold-before.gold,Math.round((150+12*6+60)*mult),'abates + fases + vitória da Jornada, pela dificuldade');
  assert.equal(after.counters.ultimates-before.counters.ultimates,3);assert.equal(after.counters.relics-before.counters.relics,2);
  assert.equal(after.counters.wins-before.counters.wins,1);
  assert.ok(after.heroes.ninja.xp>(before.heroes.ninja?.xp||0));
  assert.match(elements.get('overlayStars').innerHTML,/progress-reward/);assert.match(elements.get('overlayStars').innerHTML,/Ouro/);
  assert.equal(JSON.parse(context.localStorage.data['cavaleiros-progresso']).version,2,'save versionado no localStorage');
}));
test('progressão: atalhos de teste não ganham nem aplicam progresso',()=>withLiveGame(()=>{
  const before=JSON.stringify(prog.snapshot());const h=new t.Hero(cfg('ninja'));
  Object.assign(t.game,{test:true,roster:[h],mission:null,start:1,phase:12,last:12,kills:150,relics:[],ultimates:3});
  elements.get('overlayStars').innerHTML='';
  t.endGame('Vitória',true);
  assert.equal(JSON.stringify(prog.snapshot()),before);assert.doesNotMatch(elements.get('overlayStars').innerHTML,/progress-reward/);
}));
test('progressão: maestria dá bônus pequeno e aura só fora do modo de teste',()=>withLiveGame(()=>{
  for(let i=0;i<25&&prog.mastery('ninja').level<5;i++)prog.recordMatch({mode:'mission',won:true,difficultyId:'normal',kills:0,phasesCleared:2,heroes:[{id:'ninja',kills:60}]});
  assert.equal(prog.mastery('ninja').level,5);
  const base=cfg('ninja'),bonus=prog.heroBonus('ninja');
  t.game.test=true;const plainHero=new t.Hero(base);assert.equal(plainHero.maxHp,base.hp);assert.equal(plainHero.dmg,base.dmg);assert.equal(plainHero.masteryAura,undefined);
  t.game.test=false;const master=new t.Hero(base);
  assert.equal(master.maxHp,Math.round(base.hp*(1+bonus.hp)));assert.equal(master.hp,master.maxHp);
  assert.ok(Math.abs(master.dmg/base.dmg-1.04)<1e-9,'+4% de dano na maestria máxima');
  assert.ok(master.maxHp/base.hp<=1.11,'vida extra somada fica perto de 10%');assert.ok(master.masteryAura,'aura dourada na maestria 5');
}));
test('progressão: ficha e cartão da escolha mostram a maestria com discrição',()=>{
  clear();t.showPick('Escolha','teste');const i=idx('ninja');
  assert.match(t.pick.cards[i].innerHTML,/mastery-badge[^>]*>✦5</);assert.ok(t.pick.cards[i].classList.contains('mastery-5'));
  t.selectCard(i);assert.match(t.pick.info.innerHTML,/Maestria 5/);assert.match(t.pick.info.innerHTML,/máxima/);
  const fresh=t.pick.options.findIndex(v=>prog.mastery(v.id).level===1);
  assert.doesNotMatch(t.pick.cards[fresh].innerHTML,/mastery-badge/);t.selectCard(fresh);assert.match(t.pick.info.innerHTML,/Maestria 1/);
  t.pick.open=false;clear();
});
test('progressão: oficina libera 4ª opção de relíquia e troca, só fora do teste',()=>withLiveGame(()=>{
  prog.recordMatch({mode:'journey',won:false,difficultyId:'normal',kills:2000,phasesCleared:0,heroes:[]});
  if(prog.upgradeLevel('relic-choice')<1)assert.equal(prog.buy('relic-choice').ok,true);
  if(prog.upgradeLevel('reroll')<1)assert.equal(prog.buy('reroll').ok,true);
  t.game.mission=mission('fazendas');vm.runInContext('placeParty(5)',context);t.game.mission=mission('fazendas');Object.assign(t.game,{phase:5,last:6});
  assert.equal(t.game.test,false);assert.equal(t.game.rerolls,prog.rerolls());
  const list=elements.get('pickList');list.children.length=0;
  context.showRelicPick();assert.equal(t.pick.options.length,4);assert.equal(t.pick.cards.length,4);
  const reroll=list.children.find(c=>c.className==='relic-reroll');assert.ok(reroll,'botão de trocar relíquias');
  const rerolls=t.game.rerolls;list.children.length=0;reroll.onclick();
  assert.equal(t.game.rerolls,rerolls-1);assert.equal(t.pick.options.length,4);
  if(!t.game.rerolls)assert.ok(!list.children.some(c=>c.className==='relic-reroll'),'sem trocas, sem botão');
  t.game.test=true;t.game.rerolls=0;context.showRelicPick();assert.equal(t.pick.options.length,3,'modo de teste mantém 3 opções');
  t.pick.open=false;
}));
test('progressão: menu leva ao acampamento e Esc volta',()=>{
  clear();t.showMenu();assert.equal(t.pick.cards.length,4);
  assert.match(t.pick.cards[2].innerHTML,/Acampamento/);assert.match(t.pick.cards[2].innerHTML,/✦ \d+\/\d+/);   // menu enxuto: conquistas viram ícone + contagem
  assert.ok(t.pick.cards.every(card=>!card.innerHTML.includes('<p>')),'menu sem frases nos cartões: a descrição fica na dica');
  let next;context.setTimeout=(fn,ms)=>{if(ms===450)next=fn};
  t.confirmPick(2);next();context.setTimeout=noop;
  const camp=elements.get('camp');assert.equal(camp.classList.contains('hidden'),false);assert.equal(t.pick.open,false);
  assert.match(camp.innerHTML,/Oficina/);assert.match(camp.innerHTML,/Treino de vigor/);assert.match(camp.innerHTML,/Conquistas \d+\/1\d/);
  t.showMenu();assert.equal(camp.classList.contains('hidden'),true);
  t.pick.open=false;clear();
});
// ---------- relíquias que mudam o jogo ----------
vm.runInContext('t.RELICS=RELICS;t.RELIC_RARITY=RELIC_RARITY;',context);
const R=id=>t.RELICS.find(r=>r.id===id);
const withRandom=(value,fn)=>{const old=cMath.random;cMath.random=()=>value;try{return fn()}finally{cMath.random=old}};
const relics=(...ids)=>{t.game.relics=[...ids]};
test('relíquias têm raridade, dez novas são únicas e a oferta respeita a equipe',()=>{
  clear();relics();
  const ids=new Set(t.RELICS.map(r=>r.id));assert.equal(ids.size,t.RELICS.length);
  for(const r of t.RELICS)assert.ok(t.RELIC_RARITY[r.rarity],r.id);
  const fresh=['ember-heart','dawn-ward','thorn-mail','bulwark-banner','first-spark','phoenix-feather','ricochet-sling','shadow-mark','archmage-prism','last-oath'];
  for(const id of fresh)assert.ok(R(id)?.unique,id);
  assert.ok(['comum','rara','epica'].every(k=>t.RELICS.some(r=>r.rarity===k)));
  t.game.mission=mission('lago-sombrio');Object.assign(t.game,{phase:10,last:11});
  hero('paladin',0,0);
  let pool=context.relicPool().map(r=>r.id);
  assert.ok(pool.includes('bulwark-banner'),'cavaleiro bloqueia: estandarte serve');
  assert.ok(!pool.includes('archmage-prism')&&!pool.includes('shadow-mark')&&!pool.includes('ricochet-sling'),'sem mago, ladino ou atirador');
  hero('pyro',1,0);hero('assassin',2,0);
  pool=context.relicPool().map(r=>r.id);
  assert.ok(pool.includes('archmage-prism')&&pool.includes('shadow-mark')&&pool.includes('ricochet-sling'));
  relics('first-spark','keen-edge');pool=context.relicPool().map(r=>r.id);
  assert.ok(!pool.includes('first-spark'),'única já pega sai da oferta');assert.ok(pool.includes('keen-edge'),'comum continua acumulável');
  // o sorteio pesa a raridade: um rolo baixo cai na primeira comum, nunca repete a mesma relíquia
  const drawn=context.drawRelics(context.relicPool(),3,()=>0);assert.equal(new Set(drawn.map(r=>r.id)).size,3);
  assert.equal(drawn[0].rarity,'comum');clear();
});
test('cartão mostra a raridade com cor e o HUD lista as relíquias ativas com dica',()=>{
  clear();relics();t.game.mission=mission('lago-sombrio');Object.assign(t.game,{phase:10,last:11});hero('pyro',0,0);hero('paladin',1,0);hero('assassin',2,0);hero('cryo',3,0);
  context.showRelicPick();
  t.pick.options=[R('archmage-prism'),R('keen-edge'),R('dawn-ward')];
  t.confirmPick(0);
  const tray=context.document.getElementById('relics');
  assert.match(tray.innerHTML,/data-tip="relic"/);assert.match(tray.innerHTML,/rarity-epica/);assert.equal(tray.classList.contains('hidden'),false);
  t.game.relics.push('keen-edge','keen-edge');context.renderRelicTray();assert.match(tray.innerHTML,/<b>2<\/b>/);
  const tip=context.relicTooltip({getAttribute:()=>'keen-edge'});assert.match(tip,/Lâmina afiada/);assert.match(tip,/×2/);
  relics();context.renderRelicTray();assert.equal(tray.classList.contains('hidden'),true);clear();
});
test('Centelha inicial zera a primeira recarga da fase e Pena da fênix cura ao usar a ultimate',()=>{
  clear();relics('first-spark','phoenix-feather');
  const necro=hero('necro',0,0),ally=hero('paladin',2,0);ally.hp=ally.maxHp*.5;const e=foe('Warrior',0,2);e.hp=e.maxHp=10000;
  context.relicPhaseStart();
  assert.equal(necro.useSkill(e,false,true,0),true);assert.equal(necro.skillTimers[0],.5,'primeira habilidade sem recarga');
  necro.pendingHit=null;necro.busy=0;
  assert.equal(necro.useSkill(e,false,true,1)||necro.useSkill(e,false,true,0),true);
  assert.ok(Math.max(...necro.skillTimers)>1,'a segunda já entra em recarga');necro.pendingHit=null;necro.busy=0;
  const before=ally.hp;assert.equal(necro.useSkill(e,false,true,2),true);
  assert.ok(Math.abs(ally.hp-before-ally.maxHp*.2)<1e-6,'ultimate cura 20% do aliado próximo');clear();
});
test('Égide da aurora absorve dano e Juramento final segura a queda uma vez por fase',()=>{
  clear();relics('dawn-ward','last-oath');t.game.runTime=10;
  const h=hero('pyro',0,0),e=foe('Warrior',0,1);
  context.relicPhaseStart();const shield=h.relicShield;assert.equal(shield,Math.round(h.maxHp*.2));
  h.takeDamage(shield/2,e.pos,e);assert.equal(h.hp,h.maxHp,'o escudo absorve');assert.ok(h.relicShield<shield);
  h.relicShield=0;h.hp=10;h.takeDamage(500,e.pos,e);assert.equal(h.hp,1);assert.equal(h.dead,false);
  h.takeDamage(500,e.pos,e);assert.equal(h.hp,1,'invulnerável por 2 s');
  t.game.runTime=13;h.takeDamage(500,e.pos,e);assert.equal(h.dead,true,'o juramento vale uma vez por fase');
  clear();
});
test('Cota de espinhos devolve dano corpo a corpo e Estandarte cura no bloqueio',()=>{
  clear();relics('thorn-mail');const h=hero('pyro',0,0),e=foe('Warrior',0,1);e.hp=e.maxHp=1000;
  h.takeDamage(40,e.pos,e);const real=h.maxHp-h.hp;assert.ok(Math.abs(e.hp-(1000-real*.35))<1e-6);
  const archer=foe('Mage',0,5);archer.hp=archer.maxHp=1000;h.takeDamage(10,archer.pos,archer);assert.equal(archer.hp,1000,'à distância não leva espinhos');
  clear();relics();const plain=hero('paladin',0,0),hit=foe('Warrior',0,1);
  withRandom(0,()=>plain.takeDamage(40,hit.pos,hit));const lostPlain=plain.maxHp-plain.hp;
  clear();relics('bulwark-banner');const p=hero('paladin',0,0),hit2=foe('Warrior',0,1);p.hp=p.maxHp*.5;const start=p.hp;
  withRandom(0,()=>p.takeDamage(40,hit2.pos,hit2));
  assert.ok(Math.abs((start-p.hp)-(lostPlain-p.maxHp*.05))<1e-6,'bloqueio recupera 5% da vida');clear();
});
test('Coração de brasa explode ao abater e Marca das sombras encurta recargas do Ladino',()=>{
  clear();relics('ember-heart','shadow-mark');
  const a=hero('assassin',0,0),victim=foe('Minion',0,2),near=foe('Warrior',0,3.5);near.hp=near.maxHp=1000;
  a.skillTimers=[5,6,7];
  withRandom(0,()=>victim.takeDamage(9999,a.pos,a));
  assert.equal(victim.dead,true);assert.ok(near.hp<1000,'a explosão fere quem estava perto');
  assert.deepEqual(a.skillTimers,[3,4,5]);
  clear();relics();const b=hero('assassin',0,0),v2=foe('Minion',0,2),n2=foe('Warrior',0,3.5);n2.hp=n2.maxHp=1000;b.skillTimers=[5,6,7];
  withRandom(0,()=>v2.takeDamage(9999,b.pos,b));assert.equal(n2.hp,1000);assert.deepEqual(b.skillTimers,[5,6,7]);clear();
});
test('Funda ricocheteante salta o tiro comum e o Prisma dá +1 alvo aos magos',()=>{
  clear();t.bolts.length=0;relics('ricochet-sling');
  const h=hero('cryo',0,0),a=foe('Warrior',0,-5),b=foe('Warrior',0,-8);a.hp=a.maxHp=b.hp=b.maxHp=1000;
  t.fireBolt(h,a,'magic');for(let i=0;i<40&&!t.bolts.some(x=>x.bounced);i++)t.updateBolts(.05);
  const bounce=t.bolts.find(x=>x.bounced);assert.ok(bounce,'o tiro ricocheteia');assert.equal(bounce.target,b);assert.ok(Math.abs(bounce.dmg-h.dmg*.6)<1e-6);
  for(let i=0;i<40&&t.bolts.length;i++)t.updateBolts(.05);assert.ok(b.hp<1000);assert.ok(!t.bolts.length,'ricocheteia só uma vez');
  clear();t.bolts.length=0;relics('archmage-prism');
  const mage=hero('pyro',0,0),knight=hero('paladin',1,0);
  assert.equal(mage.extraTargets,1);assert.ok(!knight.extraTargets,'só magos ganham alvo extra');
  const x=foe('Warrior',0,-4),y=foe('Warrior',1,-4);context.relicExtraShot(mage,x);
  assert.equal(t.bolts.length,1);assert.equal(t.bolts[0].target,y);assert.ok(Math.abs(t.bolts[0].dmg-mage.dmg*.7)<1e-6);
  for(const bolt of t.bolts)context.scene.remove(bolt.mesh);t.bolts.length=0;clear();
});
// ---------- objetivos novos da campanha ----------
const party=n=>['paladin','pyro','cryo','assassin'].slice(0,n);
test('santuário: estrutura aliada que os saqueadores atacam e que derruba a missão ao cair',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('santuario',party(2));const shrine=t.game.shrine;
  assert.ok(shrine&&shrine.team==='villager'&&shrine.structure);
  assert.equal(t.makeTargetContext().villager,shrine,'os heróis tratam o santuário como quem precisa de proteção');
  t.startPhase();t.game.toSpawn=1;withRandom(0,()=>t.spawnSkeleton());
  const raider=t.skeletonsAlive().at(-1);assert.equal(raider.raider,true);
  Object.assign(t.game,{state:'fight',toSpawn:0});for(const s of t.skeletonsAlive())s.die();t.updateGame(1);
  assert.ok(t.game.toSpawn>0,'ondas continuam enquanto o tempo corre');assert.ok(t.game.surviveT<75);
  shrine.takeDamage(99999);t.updateGame(.1);
  assert.equal(t.game.over,true);assert.match(context.document.getElementById('overlayText').textContent,/santuário caiu/i);
  const stars=context.starConditions({won:true,falls:0,goal:mission('santuario').goal,shrineRatio:.6});assert.ok(stars.every(c=>c.achieved));
  assert.equal(context.starsFor({won:true,falls:1,goal:mission('santuario').goal,shrineRatio:.6}),2);
  assert.equal(context.starsFor({won:true,falls:0,goal:mission('santuario').goal,shrineRatio:.3}),1);
  clear();
});
test('caçada: o alvo marcado foge de quem chega perto e a missão acaba ao abatê-lo',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('caca',party(3));t.startPhase();const mark=t.game.huntMark;
  assert.ok(mark&&mark.hunted&&mark.maxHp>=30*5,'alvo resistente e marcado');
  mark.spawning=false;mark.busy=0;mark.pos.copy(t.world.along(t.world.anchorS(t.game.phase)+10,0));
  const h=t.heroes()[0];h.pos.copy(mark.pos).add(new Vector3(0,0,2));
  assert.equal(context.huntThink(mark,.1),true);assert.ok(mark.vel.z<0,'corre para a frente da estrada');
  h.pos.set(50,0,50);for(const o of t.heroes())o.pos.set(50,0,50);assert.equal(context.huntThink(mark,.1),false,'sem perseguidor volta a lutar');
  const extra=foe('Warrior',0,-30);extra.hp=extra.maxHp=1000;
  mark.takeDamage(1e6);t.updateGame(.1);
  assert.equal(t.game.huntDown,true);assert.equal(t.game.last,t.game.phase);assert.equal(extra.dead,true);
  assert.equal(context.starsFor({won:true,falls:0,goal:mission('caca').goal,timeLeft:40}),3);
  assert.equal(context.starsFor({won:true,falls:0,goal:mission('caca').goal,timeLeft:10}),2);
  begin('caca',party(3));t.startPhase();t.game.surviveT=.05;t.updateGame(.1);
  assert.equal(t.game.over,true);assert.equal(t.game.huntEscaped,true);assert.match(context.document.getElementById('overlayText').textContent,/fugiu/);
  clear();
});
test('noite sem fim: a horda engrossa, estrelas por tempo e cair depois de 60 s ainda vence',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('horda',party(4));t.startPhase();Object.assign(t.game,{toSpawn:0});for(const s of t.skeletonsAlive())s.die();
  t.updateGame(.5);assert.ok(t.game.toSpawn>0,'a horda repõe esqueletos');assert.ok(t.game.endlessT>0);
  const goal=mission('horda').goal;
  assert.equal(context.starsFor({won:true,goal,endlessTime:61}),1);assert.equal(context.starsFor({won:true,goal,endlessTime:185}),3);
  t.game.endlessT=125;for(const h of t.heroes()){h.hp=0;h.dead=true;}t.updateGame(.1);
  assert.equal(t.game.over,true);assert.match(context.document.getElementById('overlayText').textContent,/contida/);assert.equal(t.starsOf('horda'),2);
  begin('horda',party(4));t.startPhase();t.game.endlessT=40;for(const h of t.heroes()){h.hp=0;h.dead=true;}t.updateGame(.1);
  assert.match(context.document.getElementById('overlayText').textContent,/A horda venceu/);assert.equal(t.starsOf('horda'),2,'derrota não apaga o melhor');
  begin('horda',party(4));t.startPhase();t.game.endlessT=goal.dawn-.01;t.updateGame(.1);
  assert.equal(t.game.last,t.game.phase,'ao amanhecer a horda recua e a fase pode terminar');assert.equal(t.game.toSpawn,0);
  clear();
});
test('missões novas entram na ordem da campanha sem travar saves antigos',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data;
  try{
    const i=id=>t.MISSIONS.findIndex(m=>m.id===id);
    assert.ok(i('ponte')<i('santuario')&&i('santuario')<i('fazendas'));assert.ok(i('lago')<i('caca')&&i('caca')<i('resgate'));assert.ok(i('cemiterio')<i('horda')&&i('horda')<i('castelo'));
    context.location={search:''};context.localStorage.data={'cavaleiros-campanha':JSON.stringify({vila:3,ponte:2})};
    assert.equal(t.unlocked(i('santuario')),true);assert.equal(t.unlocked(i('fazendas')),false,'a nova missão vem antes das fazendas');
    context.localStorage.data={'cavaleiros-campanha':JSON.stringify({vila:3,ponte:2,fazendas:1,lago:1,resgate:2})};
    assert.equal(t.unlocked(i('fazendas')),true);assert.equal(t.unlocked(i('duelo')),true);assert.equal(t.unlocked(i('caca')),false,'o duelo vem antes da caçada');assert.equal(t.unlocked(i('resgate')),true);
    for(const id of ['santuario','caca','horda']){const g=mission(id).goal;assert.ok(context.goalText(g),id);assert.equal(context.starTargetsFor(g).length,3,id);}
    const tip=m=>context.buildBattleReport({won:false,mission:m}).find(item=>item.id==='next-try').text;
    assert.match(tip({goal:mission('santuario').goal,shrineDown:true}),/santuário caiu/);
    assert.match(tip({goal:mission('caca').goal,huntDown:false,huntEscaped:true}),/fugiu/);
    assert.match(tip({goal:mission('horda').goal,endlessTime:42}),/42 s/);
  }finally{context.location=previousLocation;context.localStorage.data=previousStorage;}
});
// ---------- missões novas: Ponte em Chamas, Duelo e o capítulo final (Cripta Sombria e Trono de Ossos) ----------
const lossTip=m=>context.buildBattleReport({won:false,mission:m}).find(item=>item.id==='next-try').text;
test('ponte em chamas: corredores vão à ponte, quem cruza conta e o tempo salva a ponte',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('chamas',party(2));const gate=t.game.gate;
  assert.ok(gate&&gate.team==='villager'&&gate.structure,'a ponte é uma estrutura aliada');
  assert.equal(t.makeTargetContext().villager,gate,'os heróis interceptam quem chega perto da ponte');
  const hp=gate.hp;gate.takeDamage(9999);assert.equal(gate.hp,hp,'a ponte não leva dano: só conta quem cruza');
  t.startPhase();assert.equal(elements.get('banner').textContent,'Ponte em Chamas · Segure a ponte!');
  for(const s of t.skeletonsAlive())s.remove();
  t.game.toSpawn=2;withRandom(0,()=>t.spawnSkeleton());const runner=t.skeletonsAlive().at(-1);
  assert.equal(runner.raider,true,'corredor corpo a corpo vai direto à ponte');assert.ok(runner.pos.z<gate.pos.z,'ninguém nasce atrás da ponte');
  Object.assign(t.game,{state:'fight',toSpawn:0});
  const crosser=foe('Warrior',gate.pos.x,gate.pos.z);t.updateGame(.1);
  assert.equal(t.game.leaks,1);assert.equal(crosser.dead,true);assert.match(gate.nameTag.textContent,/♨ 5/);
  for(const s of t.skeletonsAlive())s.remove();t.game.toSpawn=0;t.updateGame(1);
  assert.ok(t.game.toSpawn>0&&t.game.refilling,'reforços chegam enquanto o tempo corre');assert.ok(t.game.surviveT<70);
  t.game.toSpawn=1;t.spawnSkeleton();assert.notEqual(t.skeletonsAlive().at(-1).enemyKind,'Golem','reforço não traz outro golem');
  assert.ok(Math.abs(t.missionProgress(mission('chamas').goal)-(1-t.game.surviveT/70))<.001);
  Object.assign(t.game,{surviveT:.05,toSpawn:0});t.updateGame(.1);assert.equal(t.game.last,t.game.phase,'o tempo acabou: a ponte está salva');
  t.updateGame(.1);t.game.timer=0;t.updateGame(.1);
  assert.equal(t.game.over,true);assert.match(elements.get('overlayText').textContent,/Missão cumprida/);assert.equal(t.starsOf('chamas'),2,'1 passou: 2 estrelas');
  begin('chamas',party(2));t.startPhase();for(const s of t.skeletonsAlive())s.remove();Object.assign(t.game,{state:'fight',toSpawn:0,leaks:5});
  foe('Warrior',t.game.gate.pos.x,t.game.gate.pos.z);t.updateGame(.1);
  assert.equal(t.game.over,true);assert.match(elements.get('overlayText').textContent,/cruzaram a ponte/);
  const goal=mission('chamas').goal;
  assert.equal(context.starsFor({won:true,goal,leaks:0}),3);assert.equal(context.starsFor({won:true,goal,leaks:2}),2);assert.equal(context.starsFor({won:true,goal,leaks:3}),1);
  assert.equal(context.starTargetsFor(goal).length,3);
  assert.match(lossTip({goal,leaks:6}),/cruzaram a ponte/);assert.match(lossTip({goal,leaks:1}),/caiu antes/);
  clear();
});
test('duelo: um herói só, ondas menores e o chefe encerra; 3★ pede vida e tempo',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('duelo',['paladin']);assert.equal(t.heroes().length,1);assert.equal(t.heroes()[0].level,3);
  assert.ok(t.heroes()[0].maxHp>600&&t.heroes()[0].hp===t.heroes()[0].maxHp,'o herói do duelo entra com vida extra');
  t.startPhase();assert.equal(elements.get('banner').textContent,'Duelo · 1 contra 1!');
  assert.ok(t.game.toSpawn<Math.round(14*t.getDifficulty().count),'ondas do duelo são menores');assert.equal(t.game.bossPending,true);
  for(const s of t.skeletonsAlive())s.remove();Object.assign(t.game,{state:'fight',toSpawn:0});
  const boss=new t.Skeleton('Warrior',6,true);boss.spawning=false;boss.busy=99;t.updateGame(.1);assert.equal(t.game.bossSeen,true);
  boss.hp=boss.maxHp/2;assert.ok(Math.abs(t.missionProgress(mission('duelo').goal)-.5)<.01,'a barra acompanha a vida do chefe');
  boss.die();t.updateGame(.1);assert.equal(t.game.bossDown,true);assert.equal(t.game.last,t.game.phase);
  t.updateGame(.1);t.game.timer=0;t.updateGame(.1);assert.equal(t.game.over,true);assert.match(elements.get('overlayText').textContent,/Missão cumprida: Duelo/);
  const goal=mission('duelo').goal;
  assert.equal(context.starsFor({won:true,goal,hpRatio:.5,seconds:60}),3);
  assert.equal(context.starsFor({won:true,goal,hpRatio:.5,seconds:100}),2);
  assert.equal(context.starsFor({won:true,goal,hpRatio:.3,seconds:60}),1);
  assert.match(context.starConditions({won:true,goal,hpRatio:.5,seconds:95})[2].label,/1:15.*1:35/);
  assert.match(lossTip({goal,bossDown:false}),/venceu o duelo/);
  assert.ok(t.progress.achievements().find(a=>a.id==='duelista').unlocked,'conquista do duelo');
  clear();
});
test('cripta sombria: três ondas de elite mais fortes antes de limpar a fase',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('cripta',party(4));t.startPhase();const goal=mission('cripta').goal;
  assert.equal(t.game.eliteWave,1);assert.ok(t.game.eliteSize<Math.round(24*t.getDifficulty().count),'cada onda é menor que a fase comum');
  assert.equal(elements.get('banner').textContent,'Cripta Sombria · Elite 1/3');
  for(const s of t.skeletonsAlive())s.remove();t.game.toSpawn=2;t.spawnSkeleton();
  const elite=t.skeletonsAlive().at(-1),plain=new t.Skeleton(elite.enemyKind,11);
  assert.equal(elite.elite,true);assert.equal(elite.maxHp,Math.round(plain.maxHp*1.45));assert.ok(elite.dmg>plain.dmg);plain.remove();
  for(const wave of [2,3]){
    for(const s of t.skeletonsAlive())s.remove();Object.assign(t.game,{state:'fight',toSpawn:0});t.updateGame(.1);
    assert.equal(t.game.eliteWave,wave);assert.equal(t.game.toSpawn,t.game.eliteSize);assert.equal(t.game.state,'fight');
  }
  assert.ok(Math.abs(t.missionProgress(goal)-2/3)<.001);
  for(const s of t.skeletonsAlive())s.remove();t.game.toSpawn=0;t.updateGame(.1);
  assert.equal(t.game.state,'cleared','depois da 3ª onda a cripta está limpa');assert.equal(t.game.eliteWave,3);
  assert.match(lossTip({goal,eliteWave:2}),/onda de elite 2\/3/);
  clear();
});
test('trono de ossos: Lich e Carrasco juntos; só termina com os dois e fecha a campanha',()=>{
  context.location={search:''};context.localStorage.data={};
  begin('trono',party(4));t.startPhase();assert.equal(t.game.bossPending,true);
  for(const s of t.skeletonsAlive())s.remove();t.game.toSpawn=1;t.spawnSkeleton();
  const bosses=t.units.filter(u=>u.phaseBoss);assert.deepEqual([...bosses.map(b=>b.enemyKind)].sort(),['Executioner','Lich']);
  const exec=bosses.find(b=>b.enemyKind==='Executioner'),alone=new t.Skeleton('Executioner',12,true);
  assert.ok(exec.maxHp<alone.maxHp,'o Carrasco do trono tem menos vida');alone.remove();
  for(const b of bosses){b.spawning=false;b.busy=99;}
  Object.assign(t.game,{state:'fight',toSpawn:0});t.updateGame(.1);assert.equal(t.game.bossSeen,true);
  bosses.find(b=>b.enemyKind==='Lich').die();t.updateGame(.1);
  assert.equal(t.game.bossDown,false,'com o Carrasco de pé a luta continua');assert.equal(t.game.over,false);
  exec.die();t.updateGame(.1);assert.equal(t.game.bossDown,true);
  t.updateGame(.1);t.game.timer=0;t.updateGame(.1);
  assert.equal(t.game.over,true);assert.equal(elements.get('overlayText').textContent.split(' · ')[0],mission('trono').ending);
  assert.ok(t.progress.achievements().find(a=>a.id==='alem-do-castelo').unlocked,'conquista do capítulo final');
  assert.ok(t.campaignThreats(12,12,mission('trono').goal).some(x=>x.id==='Executioner'),'o mapa avisa do Carrasco');
  const goal=mission('trono').goal;
  assert.match(lossTip({goal,bossDown:false,bossesLeft:1}),/Faltou um chefe/);assert.match(lossTip({goal,bossDown:false,bossesLeft:2}),/um de cada vez/);
  clear();
});
test('missões novas: ordem, capítulo final depois do castelo e nós do mapa sem sobrepor',()=>{
  const previousLocation=context.location,previousStorage=context.localStorage.data;
  try{
    const i=id=>t.MISSIONS.findIndex(m=>m.id===id);
    assert.ok(i('santuario')<i('chamas')&&i('chamas')<i('fazendas'));assert.ok(i('lago')<i('duelo')&&i('duelo')<i('caca'));
    assert.deepEqual([...t.MISSIONS.slice(-3).map(m=>m.id)],['castelo','cripta','trono']);
    for(const id of ['cripta','trono'])assert.match(mission(id).chapter,/Além do Castelo/);
    for(const id of ['chamas','duelo','cripta','trono']){
      const m=mission(id);assert.ok(m.name.length<=16&&m.desc.length<=32&&m.story.length<=80,id+': textos curtos');
      assert.ok(context.goalText(m.goal),id);assert.equal(context.starTargetsFor(m.goal).length,3,id);
    }
    context.location={search:''};context.localStorage.data={'cavaleiros-campanha':JSON.stringify({castelo:2})};
    assert.equal(t.unlocked(i('cripta')),true);assert.equal(t.unlocked(i('trono')),false,'o trono vem depois da cripta');
    context.location={search:'?tudo=1'};
    const map=el(),info=el(),root=el();map.children=[];root.isConnected=true;root.closest=()=>null;root.querySelector=s=>s==='.camp-map'?map:info;
    context.renderCampaign(root,noop);assert.equal(map.children.length,17);
    const at=k=>[parseFloat(map.children[k].style.left),parseFloat(map.children[k].style.top)];
    for(const id of ['chamas','duelo','cripta','trono'])for(let k=0;k<map.children.length;k++){
      if(k===i(id))continue;const [x,y]=at(i(id)),[x2,y2]=at(k);
      assert.ok(((x-x2)/9.4)**2+((y-y2)/7.5)**2>1,`${id} não encosta em ${t.MISSIONS[k].id}`);
    }
    const [cx,cy]=at(i('castelo'));for(const id of ['cripta','trono'])assert.ok(at(i(id))[0]>cx&&at(i(id))[1]<=cy+12,id+' fica além do castelo, no alto');
  }finally{context.location=previousLocation;context.localStorage.data=previousStorage;}
});
// ---------- inimigos novos: enxame, xamã, cavaleiro sombrio e o Carrasco (fase 9) ----------
const mFx=()=>vm.runInContext('mFx',context);
test('enxame de crânios chega em bando, marca um círculo pequeno, mergulha e não vira cova',()=>{
  clear();t.clearMonsterFx();const rnd=cMath.random;
  try{
    const h=hero('paladin',0,0);h.hp=h.maxHp=1e4;
    const lead=foe('Skull',0,8);tick(.05);
    const pack=t.skeletonsAlive().filter(u=>u.enemyKind==='Skull');
    assert.equal(pack.length,1+(t.getDifficulty().count>=1.25?3:2),'o primeiro crânio traz o bando');
    assert.ok(pack.every(u=>u.phasing&&u.size<1),'crânios voam e são pequenos');
    for(const u of pack)if(u!==lead)u.remove();
    lead.pos.set(0,0,2);lead.hp=lead.maxHp=1e4;lead.busy=0;lead.attackTimer=0;cMath.random=()=>.99;tick(.05);
    const mark=mFx().find(f=>f.warning&&f.owner===lead);
    assert.ok(mark&&!mark.harmless&&mark.radius<1,'mergulho marca um círculo pequeno');
    const hp=h.hp;tick(.1,9);assert.ok(h.hp<hp,'o mergulho acerta quem ficou no círculo');
    assert.ok(t.game.damageSources['Enxame de Crânios']?.hits>0,'relatório credita o enxame');
    clear();t.clearMonsterFx();hero('pyro',0,0);
    const p=foe('Priest',0,6),k=foe('Skull',1,6);k.pack=0;k.die();p.cd.revive=0;p.cd.heal=99;
    const before=t.skeletonsAlive().length;tick(.1,15);assert.equal(t.skeletonsAlive().length,before,'sacerdote não reergue crânios');
  }finally{cMath.random=rnd;clear();t.clearMonsterFx();}
});
test('xamã avisa, cobre um aliado com escudo de ossos e o escudo some quando o xamã cai',()=>{
  clear();t.clearMonsterFx();const rnd=cMath.random;cMath.random=()=>.99;
  try{
    const h=hero('pyro',0,0);h.hp=h.maxHp=1e4;
    const sh=foe('Shaman',0,7),w=foe('Warrior',1.5,7);sh.hp=sh.maxHp=w.hp=w.maxHp=1e4;sh.cd.ward=0;
    tick(.05);assert.ok(!w.ward,'antes do escudo vem o aviso');
    const mark=mFx().find(f=>f.warning&&f.owner===sh);assert.ok(mark&&mark.harmless,'aviso azul segue o aliado e não é perigo');
    tick(.1,12);assert.ok(w.ward?.hp>0,'aliado recebe o escudo');
    const shield=w.ward.hp;w.takeDamage(10,h.pos);assert.equal(w.hp,w.maxHp);assert.equal(w.ward.hp,shield-10);
    assert.ok(t.heroTargetScore(h,sh)<t.heroTargetScore(h,w),'heróis priorizam o xamã ao protegido');
    w.takeDamage(w.ward.hp+20,h.pos);assert.equal(w.hp,w.maxHp-20,'o que passa do escudo entra na vida');tick(.05);assert.equal(w.ward,null);
    sh.busy=0;sh.cd.ward=0;tick(.05);tick(.1,12);assert.ok(w.ward,'escudo de novo');
    sh.stunT=1;tick(.05);assert.equal(w.ward,null,'xamã atordoado desfaz o escudo');
    sh.stunT=0;sh.busy=0;sh.cd.ward=0;tick(.05);tick(.1,12);assert.ok(w.ward);sh.die();tick(.05);assert.equal(w.ward,null,'xamã caído desfaz o escudo');
    assert.equal(mFx().length,0,'nenhum efeito do xamã sobra');
  }finally{cMath.random=rnd;clear();t.clearMonsterFx();}
});
test('cavaleiro sombrio marca a linha, investe, atropela e fica exausto; quem percebe sai da linha',()=>{
  clear();t.clearMonsterFx();const rnd=cMath.random;cMath.random=()=>.99;
  try{
    const h=hero('pyro',0,6);h.hp=h.maxHp=1e4;
    const k=foe('DarkKnight',0,0);k.hp=k.maxHp=1e4;k.root.rotation.y=0;k.cd.charge=0;
    tick(.05);const mark=mFx().find(f=>f.warning&&f.owner===k);assert.ok(mark?.line,'investida marcada em linha');assert.ok(!k.dash);
    const hp=h.hp;tick(.05,20);for(let i=0;i<20&&(k.dash||!mark.alive);i++)tick(.05);
    assert.ok(h.hp<hp,'quem ficou na linha é atropelado');assert.equal(k.dash,null);
    assert.ok(t.game.damageSources['Cavaleiro Sombrio']?.hits>0);
    t.clearMonsterFx();h.pos.set(0,0,6);k.pos.set(0,0,0);k.busy=0;k.cd.charge=0;tick(.05);
    cMath.random=()=>0;const away=t.dangerAt(h);assert.ok(away&&Math.abs(away.x)>0.8,'herói que percebe foge para o lado');
  }finally{cMath.random=rnd;clear();t.clearMonsterFx();}
});
test('Carrasco fecha a fase 9 e aparece no painel da missão',()=>{
  const isBoss=vm.runInContext('isBossPhase',context);
  assert.deepEqual([5,6,8,9,10,12].map(isBoss),[false,true,false,true,false,true]);
  assert.equal(t.waveLeader(9,true),'Executioner');assert.equal(t.waveLeader(9,false),null);
  const ids=(a,b)=>t.campaignThreats(a,b).map(x=>x.id);
  assert.ok(ids(9,10).includes('Executioner'));assert.ok(!ids(10,11).includes('Executioner'));
  for(const id of ['Skull','Shaman'])assert.ok(ids(7,8).includes(id),id);assert.ok(ids(10,11).includes('DarkKnight'));
  for(const x of t.campaignThreats(1,12))assert.ok(x.icon!=='✦'&&x.detail.length>10,'toda ameaça tem ícone e dica: '+x.id);
  clear();t.game.phase=9;t.startPhase();assert.equal(t.game.bossPending,true);
  const D=t.getDifficulty(),toSpawn=t.game.toSpawn;Object.assign(t.game,{toSpawn:1});t.spawnSkeleton();
  const b=t.skeletonsAlive().at(-1);assert.equal(b.enemyKind,'Executioner');assert.ok(b.phaseBoss&&b.kind.title==='Chefe');
  assert.ok(b.maxHp>8*50*D.hp,'tem vida de chefe');clear();t.clearMonsterFx();t.game.state='fight';void toSpawn;
});
test('Carrasco: machadada em linha derruba, corrente puxa o atirador e a fúria abaixo de 50% abre o leque e o giro',()=>{
  clear();t.clearMonsterFx();const rnd=cMath.random;cMath.random=()=>.99;
  try{
    const front=hero('paladin',0,2.5);front.hp=front.maxHp=1e4;
    const b=foe('Executioner',0,0,true);b.hp=b.maxHp=1e5;b.root.rotation.y=0;b.cd={cleave:0,hook:99,whirl:99};
    tick(.05);const lines=mFx().filter(f=>f.warning&&f.owner===b);assert.equal(lines.length,1);assert.ok(lines[0].line&&lines[0].announce);
    const hp=front.hp;tick(.1,15);assert.ok(front.hp<hp,'machadada acerta a linha');assert.ok(front.busy>0,'e derruba');
    assert.ok(t.game.damageSources.Carrasco?.hits>0,'relatório credita o Carrasco');
    clear();t.clearMonsterFx();
    const archer=hero('pyro',0,9);archer.hp=archer.maxHp=1e4;
    const c=foe('Executioner',0,0,true);c.hp=c.maxHp=1e5;c.cd={cleave:99,hook:0,whirl:99};
    tick(.05);assert.ok(mFx().some(f=>f.warning&&f.line&&f.owner===c),'corrente marcada em linha');
    tick(.1,11);tick(.05,8);assert.ok(archer.pos.distanceTo(c.pos)<5,'corrente arrasta o atirador para perto');
    c.hp=c.maxHp*.45;c.busy=0;const speed=c.speed;tick(.05);assert.equal(c.enraged,true);assert.ok(c.speed>speed);
    t.clearMonsterFx();c.busy=0;c.cd={cleave:0,hook:99,whirl:99};archer.pos.set(0,0,2.5);tick(.05);
    assert.equal(mFx().filter(f=>f.warning&&f.owner===c).length,3,'em fúria a machadada vira leque de três linhas');
    t.clearMonsterFx();c.busy=0;c.cd={cleave:99,hook:99,whirl:0};tick(.05);
    const whirl=mFx().find(f=>f.warning&&f.owner===c);assert.ok(whirl&&!whirl.line&&whirl.radius>3,'giro sangrento marca um círculo em volta');
    c.die();tick(.05);assert.equal(mFx().length,0,'avisos somem com o Carrasco morto');
  }finally{cMath.random=rnd;clear();t.clearMonsterFx();}
});
test('relatório de batalha dá dica própria para enxame e Carrasco',()=>{
  const tip=name=>vm.runInContext('buildBattleReport',context)({won:false,heroes:[{name:'A',damage:10,received:100}],damageSources:[{name,damage:90,hits:9}]}).at(-1).text;
  assert.match(tip('Enxame de Crânios'),/área/);assert.match(tip('Carrasco'),/áreas marcadas/);assert.match(tip('Cavaleiro Sombrio'),/áreas marcadas/);
});
test('na escolha de herói o mouse passando não troca a ficha; só o clique',()=>{
  clear();t.showPick('Escolha','teste');const i=idx('pyro'),j=idx('cryo');t.selectCard(i);
  assert.equal(t.pick.cards[j].onmouseenter,undefined,'hover não seleciona herói');
  t.pick.cards[j].onclick();assert.equal(t.pick.sel,j,'clique seleciona');assert.equal(t.pick.open,true,'clique não confirma');
  t.pick.open=false;clear();
});
// ---------- guarda de aldeões: só onde há alguém para defender ----------
const militiaUnits=()=>t.units.filter(u=>u.militia&&!u.dead);
const guardMission=(id='ponte')=>{clear();const m=t.MISSIONS.find(x=>x.id===id);Object.assign(t.game,{mission:m,start:m.from,phase:m.from,last:m.to,test:true});t.game.villager=new t.Villager();t.game.villager.pos.set(0,0,0);return t.game.villager;};
test('guarda de aldeões só aparece quando a missão manda defender alguém',()=>{
  for(const m of t.MISSIONS){clear();Object.assign(t.game,{mission:m,start:m.from,phase:m.from,test:true});t.musterMilitia();assert.equal(militiaUnits().length,0,m.id+' sem protegido');}
  clear();Object.assign(t.game,{mission:null,start:1,phase:1,test:true});t.musterMilitia();assert.equal(militiaUnits().length,0,'Jornada sem guarda');
  const v=guardMission('ponte');t.musterMilitia();const ms=militiaUnits();
  assert.equal(ms.length,4,'escolta: quatro aldeões de guarda');
  for(const m of ms)assert.ok(Math.abs(m.pos.distanceTo(v.pos)-1.9)<0.01,'em anel em volta do protegido');
  assert.ok(ms.every(m=>m.bar.classList.contains('militia')),'barra menor própria');
  assert.ok(ms.every(m=>m.size<0.8),'menores que os heróis');
  clear();
});
test('guarda é fraca, não segue o grupo e só ataca quem chega perto do protegido',()=>{
  const v=guardMission('ponte');t.musterMilitia();const ms=militiaUnits(),knight=cfg('paladin');
  assert.ok(ms.every(m=>m.maxHp<=knight.hp*0.3&&m.dmg<=knight.dmg*0.2),'vida e dano bem abaixo de um herói');
  assert.ok(!t.heroes().includes(ms[0])&&t.allies().includes(ms[0]),'não é herói, mas os esqueletos podem atacá-lo');
  hero('paladin',0,-12);tick(.05,120);
  ms.forEach(m=>assert.ok(m.pos.distanceTo(v.pos)<2.6,'fica em volta do protegido, não vai atrás dos heróis: '+m.pos.distanceTo(v.pos).toFixed(2)+' v='+[v.pos.x,v.pos.z].map(x=>x.toFixed(1))+' m='+[m.pos.x,m.pos.z].map(x=>x.toFixed(1))));
  const far=foe('Minion',v.pos.x+8,v.pos.z);far.hp=far.maxHp=1000;far.busy=99;
  const near=foe('Minion',v.pos.x,v.pos.z-2.6);near.hp=near.maxHp=1000;near.busy=99;
  t.game.state='fight';tick(.05,60);
  assert.ok(near.hp<1000,'ataca quem chega perto do protegido');assert.equal(far.hp,1000,'não persegue quem está longe');
  assert.ok(t.game.militia.damage>0,'dano creditado à guarda');
  const report=context.buildBattleReport({won:true,heroes:[{name:'A',damage:10}],militia:{size:4,damage:123.4,kills:3,fallen:1}});
  const item=report.find(r=>r.id==='militia');assert.ok(item,'relatório tem a guarda');assert.match(item.text,/123/);
  assert.equal(report.find(r=>r.id==='top-hero').text,'A','destaque continua sendo herói');
  clear();
});
test('guarda: quem cai não volta e não pesa em derrota, quedas ou estrelas',()=>{
  guardMission('ponte');const h=hero('paladin',30,0);t.musterMilitia();const [m]=militiaUnits();
  m.takeDamage(1e5,null,null);assert.equal(m.dead,true);
  assert.equal(t.game.falls,0);assert.equal(t.game.fallLog.length,0,'não entra como queda de herói');assert.equal(t.game.militia.fallen,1);
  tick(.05,60);assert.ok(!t.units.includes(m),'corpo some e não volta');assert.equal(militiaUnits().length,3);
  h.die();t.game.state='fight';t.game.toSpawn=0;t.updateGame(.05);assert.equal(t.game.over,true,'sem heróis é derrota, mesmo com guarda de pé');
  clear();
});
test('herói à distância recua de quem encosta, sem sair da corda; corpo a corpo não recua',()=>{
  clear();t.game.state='fight';const mage=hero('cryo',0,0),e=foe('Minion',0,-1.5);e.busy=99;e.hp=e.maxHp=1e4;
  tick(.05,14);const d=Math.hypot(mage.pos.x-e.pos.x,mage.pos.z-e.pos.z);
  assert.ok(d>2.5,'abre distância: '+d.toFixed(2));assert.ok(Math.hypot(mage.pos.x,mage.pos.z)<=5.01,'fica perto do posto');
  assert.ok(mage.kiteCd>0,'recarga evita fugir sem parar');
  clear();t.game.state='fight';const knight=hero('paladin',0,0),e2=foe('Minion',0,-1.5);e2.busy=99;e2.hp=e2.maxHp=1e4;
  tick(.05,14);assert.ok(!(knight.kiteCd>0),'corpo a corpo segura a posição');clear();
});
test('chefe abaixo de metade da vida se enfurece e recupera parte dela uma vez só',()=>{
  clear();t.game.state='fight';const b=foe('Warrior',0,-6,true);b.busy=99;
  b.hp=b.maxHp*0.6;b.update(.05);assert.equal(b.hp,b.maxHp*0.6,'acima da metade: nada');
  b.hp=b.maxHp*0.4;b.update(.05);assert.ok(Math.abs(b.hp-b.maxHp*0.65)<1e-6,'recupera 25% da vida máxima');
  b.hp=b.maxHp*0.3;b.update(.05);assert.equal(b.hp,b.maxHp*0.3,'só uma vez');
  const c=foe('Warrior',0,-8);c.hp=c.maxHp*0.2;c.update(.05);assert.equal(c.hp,c.maxHp*0.2,'inimigo comum não');clear();
});
test('herói corpo a corpo não pipoca na borda do alcance do posto',()=>{
  clear();t.game.state='fight';const k=hero('champion',0,0);const e=foe('Warrior',0,-5);e.busy=99;e.hp=e.maxHp=1e5;e.speed=0;
  tick(.05,4);assert.equal(k.engagedWith,e,'engaja o alvo dentro do alcance');
  e.pos.z=k.post.z-(5+k.range+1.5);const z0=k.pos.z;tick(.05,4);   // passa um pouco do limite do posto
  assert.equal(k.engagedWith,e,'continua no alvo dentro da folga');assert.ok(k.pos.z<z0,'segue o alvo em vez de voltar ao posto');
  e.pos.z=k.post.z-(5+k.range+5);tick(.05,4);assert.equal(k.engagedWith,null,'larga quando o alvo se afasta bem');clear();
});
console.log(results.length+' verificações passaram.');
if(failures.length){console.log(failures.length+' falharam.');process.exitCode=1;}
