// Campanha: missões ao longo do caminho (trechos de fases), estrelas por desempenho e o mapa para escolher.

// goal: objetivo de cada missão (o HUD mostra e a missão falha se a regra quebrar)
// win = vencer · escort = proteger o aldeão · boss = derrotar o chefe · survive = aguentar `time` s na fase `phase`
// totems = destruir `count` totens · nofall = ninguém cai · timer = vencer em até `time` s
export const MISSIONS = [
  { id: 'vila', name: 'A Vila', desc: 'Os primeiros esqueletos chegaram à praça.', icon: '⌂', from: 1, to: 3, heroes: 1, level: 1, goal: { type: 'win' } },
  { id: 'ponte', name: 'A Ponte do Rio', desc: 'Atiradores no rochedo vigiam a ponte.', icon: '≈', from: 3, to: 5, heroes: 2, level: 1, goal: { type: 'escort' } },
  { id: 'fazendas', name: 'Fazendas', desc: 'O primeiro chefe ronda os campos.', icon: '☘', from: 4, to: 6, heroes: 2, level: 2, goal: { type: 'boss' } },
  { id: 'lago', name: 'O Lago', desc: 'Eles saem da água rasa.', icon: '≋', from: 5, to: 7, heroes: 3, level: 2, goal: { type: 'survive', time: 90, phase: 5 } },
  { id: 'ruinas', name: 'Ruínas Antigas', desc: 'Entre colunas caídas, o mundo começa a morrer.', icon: '☗', from: 7, to: 9, heroes: 3, level: 2, goal: { type: 'totems', count: 3 } },
  { id: 'lago-sombrio', name: 'Lago Sombrio', desc: 'Água escura e névoa roxa.', icon: '☽', from: 9, to: 10, heroes: 4, level: 3, goal: { type: 'nofall' } },
  { id: 'cemiterio', name: 'Cemitério', desc: 'Os mortos não descansam.', icon: '✝', from: 10, to: 11, heroes: 4, level: 3, goal: { type: 'timer', time: 240 } },
  { id: 'castelo', name: 'Castelo do Necromante', desc: 'A batalha final contra o chefe.', icon: '♜', from: 11, to: 12, heroes: 4, level: 3, goal: { type: 'boss' } },
];

// texto curto do objetivo (mapa e HUD)
export function goalText(goal) {
  return {
    win: 'Vença todas as fases',
    escort: 'Proteja o aldeão',
    boss: 'Derrote o chefe',
    survive: `Aguente ${goal.time} s no lago`,
    totems: `Destrua ${goal.count} totens de ossos`,
    nofall: 'Nenhum herói pode cair',
    timer: `Vença em até ${Math.floor(goal.time / 60)} min`,
  }[goal.type];
}

const KEY = 'cavaleiros-campanha';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

// ?tudo=1 na URL libera todas as missões e variantes (para testar)
export const allOpen = () => { try { return new URLSearchParams(location.search).get('tudo') === '1'; } catch { return false; } };
export const starsOf = (id) => read()[id] || 0;
export const unlocked = (i) => i === 0 || allOpen() || starsOf(MISSIONS[i - 1].id) > 0;
export const totalStars = () => MISSIONS.reduce((s, m) => s + starsOf(m.id), 0);

// variantes: uma por classe desde o começo; as outras saem a cada 2 estrelas (1, 3, 5... 23)
export const STARTERS = ['paladin', 'berserker', 'pyro', 'assassin'];
export const UNLOCKS = ['guardian', 'viking', 'cryo', 'crossbow', 'champion', 'crusher', 'arcane', 'ninja', 'king', 'iceviking', 'necro', 'druid']
  .map((id, i) => ({ id, stars: 1 + i * 2 }));
export const starsToUnlock = (id) => UNLOCKS.find((u) => u.id === id)?.stars || 0;
export const variantOpen = (id, total = totalStars()) => STARTERS.includes(id) || allOpen() || total >= starsToUnlock(id);

// ★ vencer · ★★ sem nenhum herói cair · ★★★ terminar com o grupo com pelo menos metade da vida
export function starsFor({ won, falls, hpRatio }) {
  if (!won) return 0;
  return 1 + (falls === 0 ? 1 : 0) + (hpRatio >= 0.5 ? 1 : 0);
}

// guarda o melhor resultado; devolve true se melhorou
export function saveStars(id, stars) {
  const all = read();
  if (stars <= (all[id] || 0)) return false;
  all[id] = stars;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  return true;
}

const starRow = (n, size = '') => `<span class="stars ${size}">${[1, 2, 3].map((k) => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

// desenha o mapa dentro de `root`; onPlay(missão) quando o jogador confirma
export function renderCampaign(root, onPlay) {
  let sel = MISSIONS.findIndex((_, i) => unlocked(i) && starsOf(MISSIONS[i].id) === 0);
  if (sel < 0) sel = 0;
  const total = totalStars();
  root.innerHTML = `
    <div class="camp-head"><span class="camp-title">Campanha</span><span class="camp-total">${starRow(1)} ${total} / ${MISSIONS.length * 3}</span></div>
    <div class="camp-body">
      <div class="camp-map"><svg class="camp-trail" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M 50 96 C 15 86, 85 74, 50 62 S 15 40, 50 30 S 85 12, 50 4" /></svg></div>
      <aside class="camp-info"></aside>
    </div>`;
  const map = root.querySelector('.camp-map'), info = root.querySelector('.camp-info');
  // posições dos medalhões ao longo da trilha (de baixo para cima, em zigue-zague)
  const spots = [[50, 92], [28, 80], [68, 70], [36, 58], [66, 46], [34, 34], [64, 22], [50, 8]];
  const nodes = MISSIONS.map((m, i) => {
    const b = document.createElement('button');
    const open = unlocked(i), stars = starsOf(m.id);
    b.className = `camp-node${open ? '' : ' locked'}${stars ? ' done' : ''}`;
    b.style.left = spots[i][0] + '%';
    b.style.top = spots[i][1] + '%';
    b.innerHTML = `<span class="medal">${open ? m.icon : '\u{1F512}︎'}</span><span class="num">${i + 1}</span>${open ? starRow(stars, 'small') : ''}`;
    b.onclick = () => select(i);
    b.ondblclick = () => play();
    map.appendChild(b);
    return b;
  });
  function select(i) {
    sel = i;
    nodes.forEach((n, k) => n.classList.toggle('sel', k === i));
    const m = MISSIONS[i], open = unlocked(i);
    info.innerHTML = `
      <div class="medal big">${open ? m.icon : '\u{1F512}︎'}</div>
      <div class="camp-name">${i + 1}. ${m.name}</div>
      ${starRow(starsOf(m.id), 'big')}
      <p>${m.desc}</p>
      <div class="camp-goal"><b>Objetivo</b>${goalText(m.goal)}</div>
      <ul><li>Fases ${m.from}–${m.to}</li><li>Começa com ${m.heroes} herói${m.heroes > 1 ? 's' : ''} no nível ${m.level}</li></ul>
      <div class="camp-goals"><b>Estrelas</b><span>★ Vencer</span><span>★ Nenhum herói cair</span><span>★ Terminar com metade da vida</span></div>
      <button class="camp-play" ${open ? '' : 'disabled'}>${open ? 'Jogar' : 'Bloqueada'}</button>`;
    info.querySelector('.camp-play').onclick = play;
  }
  function play() { if (unlocked(sel)) onPlay(MISSIONS[sel]); }
  function key(e) {
    if (!root.isConnected || root.closest('.hidden')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') select(Math.min(MISSIONS.length - 1, sel + 1));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') select(Math.max(0, sel - 1));
    else if (e.key === 'Enter') play();
    else return;
    e.preventDefault();
  }
  removeEventListener('keydown', renderCampaign.key || (() => {}));
  renderCampaign.key = key;
  addEventListener('keydown', key);
  select(sel);
}
