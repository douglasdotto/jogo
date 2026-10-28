// Estatísticas de cada herói na partida, o cartão que abre ao clicar nele e o resumo do fim de jogo.
import { heroInfo, skillCooldown } from './class-info.js';
import { aimSpec } from './skill-targeting.js';

export const newStats = () => ({ dano: 0, recebido: 0, cura: 0, abates: 0, ataques: 0, habilidades: 0, criticos: 0, esquivas: 0, distancia: 0, tempo: 0 });

const LABELS = [
  ['dano', 'Dano causado'], ['recebido', 'Dano recebido'], ['cura', 'Cura feita'], ['abates', 'Abates'],
  ['ataques', 'Ataques'], ['habilidades', 'Habilidades usadas'], ['criticos', 'Críticos'], ['esquivas', 'Esquivas'],
  ['distancia', 'Distância andada'],
];
const fmt = (k, v) => (k === 'distancia' ? `${Math.round(v)} m` : Math.round(v).toLocaleString('pt-BR'));
const dps = (s) => (s.tempo > 1 ? s.dano / s.tempo : 0);
const portraitOf = (h) => h.cfg.portraits?.[h.level - 1] || h.cfg.portrait;   // retrato do nível atual

// ---------- cartão do herói ----------
const panel = () => document.getElementById('heroPanel');
let current = null, xpLevels = [0], refresh = 0;

export function openHeroPanel(hero, levels) {
  current = hero;
  xpLevels = levels;
  panel().classList.remove('hidden');
  renderHeroPanel();
}

export function closeHeroPanel() {
  current = null;
  panel().classList.add('hidden');
}

export const panelHero = () => current;

// chamado a cada quadro; redesenha algumas vezes por segundo
export function tickHeroPanel(real) {
  if (!current) return;
  refresh -= real;
  if (refresh > 0) return;
  refresh = 0.25;
  renderHeroPanel();
}

function renderHeroPanel() {
  const h = current, c = h.cfg, s = h.stats;
  const info = heroInfo(c);
  const next = xpLevels[h.level];
  const xpPct = next ? Math.min(100, ((h.xp - xpLevels[h.level - 1]) / (next - xpLevels[h.level - 1])) * 100) : 100;
  const attrs = [
    ['Vida', `${Math.max(0, Math.round(h.hp))} / ${Math.round(h.maxHp)}`],
    ['Dano por golpe', Math.round(h.dmg)],
    ['Golpes por segundo', (1 / h.cooldown).toFixed(2)],
    ['Alcance', `${h.range.toFixed(1)} m`],
    ['Velocidade', h.speed.toFixed(1)],
    ['Dano por segundo', Math.round(dps(s))],
  ];
  const el = panel();
  el.style.setProperty('--c', c.color[0]);
  el.style.setProperty('--cd', c.color[1]);
  el.innerHTML = `
    <button class="close" aria-label="Fechar">✕</button>
    <div class="hp-top">
      <div class="portrait"><img src="${portraitOf(h)}" alt=""></div>
      <div>
        <div class="ribbon">${c.names ? c.names[h.level - 1] : c.name}</div>
        <div class="lvl">Nível ${h.level}${h.dead ? ' · caído' : ''}</div>
        <div class="xp"><i style="width:${xpPct}%"></i></div>
        <div class="xp-txt">${next ? `XP ${Math.round(h.xp)} / ${next}` : 'Nível máximo'}</div>
      </div>
    </div>
    <div class="hero-guide"><h4>${info.name} · ${info.role}</h4><p>${c.ranged ? 'Combate à distância' : 'Combate corpo a corpo'}</p></div>
    <div class="ability"><b>${c.ability}</b>${info.skill}
      <span class="skill-meta">${h.dead ? 'Indisponível enquanto caído' : h.skillTimer > 0 ? `Disponível em ${Math.ceil(h.skillTimer)} s` : 'Pronta para usar'} · Recarga: ${skillCooldown(c.id, h.level, h.skillRate).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s</span>
      <span class="skill-meta">${h.auto ? 'Automático: usa quando houver uma oportunidade.' : aimSpec(h) ? 'Manual: ative pela barra ou pelas teclas 1–4 e clique no alvo. Esc cancela.' : 'Manual: ative pela barra ou pelas teclas 1–4. Efeito centrado no herói.'}</span></div>
    <div class="hero-guide"><h4>Como aproveitar</h4><p>${info.tip}</p></div>
    <h4>Atributos</h4>
    <dl>${attrs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <h4>Nesta partida</h4>
    <dl>${LABELS.map(([k, label]) => `<dt>${label}</dt><dd>${fmt(k, s[k])}</dd>`).join('')}</dl>`;
  el.querySelector('.close').onclick = closeHeroPanel;
}

// ---------- resumo do fim da partida ----------
export function summaryHTML(heroes) {
  if (!heroes.length) return '';
  const best = (k) => Math.max(...heroes.map((h) => h.stats[k]));
  const cols = [['dano', 'Dano'], ['abates', 'Abates'], ['recebido', 'Recebido'], ['cura', 'Cura']];
  const mvp = heroes.reduce((a, b) => (b.stats.dano + b.stats.abates * 40 > a.stats.dano + a.stats.abates * 40 ? b : a));
  const rows = heroes.map((h) => `<tr>
      <td><img src="${portraitOf(h)}" alt="">${h.cfg.names ? h.cfg.names[h.level - 1] : h.cfg.name}${h === mvp ? ' <span class="mvp">♛ MVP</span>' : ''}</td>
      ${cols.map(([k]) => `<td class="${h.stats[k] === best(k) && best(k) > 0 ? 'top' : ''}">${fmt(k, h.stats[k])}</td>`).join('')}
    </tr>`).join('');
  return `<table><tr><th>Herói</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr>${rows}</table>`;
}
