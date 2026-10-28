// Estatísticas de cada herói na partida, o cartão que abre ao clicar nele e o resumo do fim de jogo.
import { heroInfo } from './class-info.js';
import { cooldownForSkill, skillSetFor } from './skillbook.js';
import { aimSpec } from './skill-targeting.js';
import { SYNERGIES } from './synergies.js';

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
  const skills = skillSetFor(c);
  const synergies = SYNERGIES.filter((synergy) => synergy.variants.includes(c.id));
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
    <section class="hero-panel-main">
      <div class="hp-top">
        <div class="portrait"><img src="${portraitOf(h)}" alt=""></div>
        <div class="hp-progress">
          <div class="ribbon">${c.names ? c.names[h.level - 1] : c.name}</div>
          <div class="lvl">Nível ${h.level}${h.dead ? ' · caído' : ''}</div>
          <div class="xp"><i style="width:${xpPct}%"></i></div>
          <div class="xp-txt">${next ? `XP ${Math.round(h.xp)} / ${next}` : 'Nível máximo'}</div>
        </div>
      </div>
      <div class="hero-guide hero-role"><h4>${info.name} · ${info.role}</h4><p>${c.ranged ? 'Combate à distância' : 'Combate corpo a corpo'}</p></div>
      <div class="ability skill-list"><b>Habilidades</b>${skills.map((skill) => {
        const slot = skill.slot, timer = h.skillTimers?.[slot] ?? (slot === 0 ? h.skillTimer : 0);
        const automatic = h.autoSkills?.[slot] ?? (slot === 0 ? h.auto : true);
        const mode = automatic ? 'Automático' : slot === 0 && aimSpec(h) ? 'Manual · mira no alvo' : 'Manual · ativação pelo botão';
        const state = h.dead ? 'Indisponível enquanto caído' : timer > 0 ? `Disponível em ${Math.ceil(timer)} s` : 'Pronta para usar';
        return `<div class="skill-detail${skill.ultimate ? ' ultimate-detail' : ''}"><strong>${skill.ultimate ? '✹ Ultimate · ' : skill.slot === 1 ? '✦ Técnica · ' : '✦ '}${skill.name}</strong><span>${skill.description}</span><span class="skill-meta">${state} · Recarga: ${cooldownForSkill(c, slot, h.level, h.skillRate).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s · ${mode}</span></div>`;
      }).join('')}</div>
    </section>
    <aside class="hero-panel-side">
      <div class="hero-guide hero-tips"><h4>Como aproveitar</h4><p>${info.tip}</p></div>
      ${synergies.length ? `<div class="hero-guide hero-synergies"><h4>Sinergias de grupo</h4>${synergies.map((synergy) => `<p><b>${synergy.name}</b> · ${synergy.effect}</p>`).join('')}</div>` : ''}
      <div class="hero-panel-stats">
        <section><h4>Atributos</h4><dl class="hero-attributes">${attrs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></section>
        <section><h4>Nesta partida</h4><dl class="hero-match-stats">${LABELS.map(([k, label]) => `<dt>${label}</dt><dd>${fmt(k, s[k])}</dd>`).join('')}</dl></section>
      </div>
    </aside>`;
  el.querySelector('.close').onclick = closeHeroPanel;
}

// ---------- resumo do fim da partida ----------
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function summaryHTML(heroes, highlights = []) {
  if (!heroes.length && !highlights.length) return '';
  const best = (k) => heroes.length ? Math.max(...heroes.map((h) => h.stats[k])) : 0;
  const cols = [['dano', 'Dano'], ['abates', 'Abates'], ['recebido', 'Recebido'], ['cura', 'Cura']];
  const mvp = heroes.length ? heroes.reduce((a, b) => (b.stats.dano + b.stats.abates * 40 > a.stats.dano + a.stats.abates * 40 ? b : a)) : null;
  const rows = heroes.map((h) => `<tr>
      <td><img src="${portraitOf(h)}" alt="">${h.cfg.names ? h.cfg.names[h.level - 1] : h.cfg.name}${h === mvp ? ' <span class="mvp">♛ MVP</span>' : ''}</td>
      ${cols.map(([k]) => `<td class="${h.stats[k] === best(k) && best(k) > 0 ? 'top' : ''}">${fmt(k, h.stats[k])}</td>`).join('')}
    </tr>`).join('');
  const cards = highlights.length ? `<section class="battle-report" aria-label="Destaques da partida">${highlights.map((item) =>
    `<article class="report-item"><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.text)}</span></article>`).join('')}</section>` : '';
  const table = heroes.length ? `<table><tr><th>Herói</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr>${rows}</table>` : '';
  return cards + table;
}
