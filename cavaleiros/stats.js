// Estatísticas de cada herói na partida, o cartão que abre ao clicar nele e o resumo do fim de jogo.
import { heroInfo } from './class-info.js';
import { cooldownForSkill, skillSetFor } from './skillbook.js';
import { aimSpec } from './skill-targeting.js';
import { SYNERGIES } from './synergies.js';

export const newStats = () => ({ dano: 0, recebido: 0, cura: 0, abates: 0, ataques: 0, habilidades: 0, criticos: 0, esquivas: 0, distancia: 0, tempo: 0 });

// [chave, ícone, nome]: o painel mostra ícone + número; o nome fica na dica e no leitor de tela
const LABELS = [
  ['dano', '⚔', 'Dano causado'], ['recebido', '⛨', 'Dano recebido'], ['cura', '✚', 'Cura feita'], ['abates', '☠', 'Abates'],
  ['ataques', '⚒', 'Ataques'], ['habilidades', '✦', 'Habilidades usadas'], ['criticos', '✷', 'Críticos'], ['esquivas', '↯', 'Esquivas'],
  ['distancia', '⇢', 'Distância andada'],
];
const statCell = (icon, label, value) => `<span class="stat-cell" data-tip="${label}"><i aria-hidden="true">${icon}</i><b>${value}</b><span class="sr-only">${label}</span></span>`;
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
  renderHeroPanel(true);
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

// copia para o painel só o que mudou: o foco e a rolagem continuam onde o jogador deixou
function patchNode(old, next) {
  if (old.nodeType !== next.nodeType || old.nodeName !== next.nodeName || old.childNodes.length !== next.childNodes.length) return old.replaceWith(next);
  if (old.nodeType !== 1) { if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue; return; }
  for (const { name, value } of next.attributes) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
  for (const { name } of [...old.attributes]) if (!next.hasAttribute(name)) old.removeAttribute(name);
  [...next.childNodes].forEach((child, i) => patchNode(old.childNodes[i], child));
}

function renderHeroPanel(full = false) {
  const h = current, c = h.cfg, s = h.stats;
  const info = heroInfo(c);
  const skills = skillSetFor(c);
  const synergies = SYNERGIES.filter((synergy) => synergy.variants.includes(c.id));
  const next = xpLevels[h.level];
  const xpPct = next ? Math.min(100, ((h.xp - xpLevels[h.level - 1]) / (next - xpLevels[h.level - 1])) * 100) : 100;
  const attrs = [
    ['♥', 'Vida', `${Math.max(0, Math.round(h.hp))}/${Math.round(h.maxHp)}`],
    ['⚔', 'Dano por golpe', Math.round(h.dmg)],
    ['⏱', 'Golpes por segundo', (1 / h.cooldown).toFixed(2)],
    ['➶', 'Alcance', `${h.range.toFixed(1)} m`],
    ['»', 'Velocidade', h.speed.toFixed(1)],
    ['✹', 'Dano por segundo', Math.round(dps(s))],
  ];
  const el = panel();
  el.style.setProperty('--c', c.color[0]);
  el.style.setProperty('--cd', c.color[1]);
  const html = `
    <button class="close" aria-label="Fechar">✕</button>
    <section class="hero-panel-main">
      <div class="hp-top">
        <div class="portrait"><img src="${portraitOf(h)}" alt=""></div>
        <div class="hp-progress">
          <div class="ribbon">${c.names ? c.names[h.level - 1] : c.name}</div>
          <div class="lvl">Nv ${h.level}${h.dead ? ' · caído' : ''}</div>
          <div class="xp" data-tip="${next ? `XP ${Math.round(h.xp)} / ${next}` : 'Nível máximo'}"><i style="width:${xpPct}%"></i></div>
        </div>
      </div>
      <div class="hero-guide hero-role"><h4>${info.name} · ${info.role}</h4><p data-tip="${c.ranged ? 'Combate à distância' : 'Combate corpo a corpo'}" aria-label="${c.ranged ? 'Combate à distância' : 'Combate corpo a corpo'}">${c.ranged ? '➶' : '⚔'}</p></div>
      <div class="ability skill-list">${skills.map((skill) => {
        const slot = skill.slot, timer = h.skillTimers?.[slot] ?? (slot === 0 ? h.skillTimer : 0);
        const automatic = h.autoSkills?.[slot] ?? (slot === 0 ? h.auto : true);
        const mode = automatic ? '↻ auto' : slot === 0 && aimSpec(h) ? '☝ mira' : '☝ manual';
        const state = h.dead ? '✖' : timer > 0 ? `${Math.ceil(timer)} s` : '✓';
        const cd = cooldownForSkill(c, slot, h.level, h.skillRate).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
        return `<div class="skill-detail${skill.ultimate ? ' ultimate-detail' : ''}"><strong>${skill.ultimate ? '✹ ' : '✦ '}${skill.name}</strong><span>${skill.description}</span><span class="skill-meta" aria-label="${h.dead ? 'Indisponível' : timer > 0 ? `Disponível em ${Math.ceil(timer)} s` : 'Pronta'} · recarga ${cd} s · ${automatic ? 'automático' : 'manual'}">${state} · ⏱ ${cd} s · ${mode}</span></div>`;
      }).join('')}</div>
    </section>
    <aside class="hero-panel-side">
      <div class="hero-guide hero-tips"><h4>Como aproveitar</h4><p>${info.tip}</p></div>
      ${synergies.length ? `<div class="hero-guide hero-synergies"><h4>Sinergias de grupo</h4>${synergies.map((synergy) => `<p><b>${synergy.name}</b> · ${synergy.effect}</p>`).join('')}</div>` : ''}
      <div class="hero-panel-stats">
        <section class="hero-attributes" aria-label="Atributos">${attrs.map(([icon, label, v]) => statCell(icon, label, v)).join('')}</section>
        <section class="hero-match-stats" aria-label="Nesta partida">${LABELS.map(([k, icon, label]) => statCell(icon, label, fmt(k, s[k]))).join('')}</section>
      </div>
    </aside>`;
  const fresh = document.createElement('template');
  fresh.innerHTML = html;
  const nodes = [...fresh.content.childNodes];
  if (full || nodes.length !== el.childNodes.length) el.innerHTML = html;
  else nodes.forEach((child, i) => patchNode(el.childNodes[i], child));
  el.querySelector('.close').onclick = closeHeroPanel;
}

// ---------- resumo do fim da partida ----------
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// fim da partida: três números à vista (dano, abates, quedas), dica de 1 linha (derrota ou progresso da vitória) e o resto em "Detalhes"
export function summaryHTML(heroes, highlights = [], totals = {}) {
  if (!heroes.length && !highlights.length) return '';
  const total = (k) => heroes.reduce((sum, h) => sum + h.stats[k], 0);
  const keys = [['⚔', 'Dano', fmt('dano', total('dano'))], ['☠', 'Abates', fmt('abates', totals.kills ?? total('abates'))], ['✝', 'Quedas', totals.falls ?? 0]];
  const numbers = `<div class="end-keys">${keys.map(([icon, label, v]) =>
    `<span class="end-key" tabindex="0" data-tip="${label}" aria-label="${label}: ${v}"><i aria-hidden="true">${icon}</i><b>${v}</b></span>`).join('')}</div>`;
  const tip = highlights.find((item) => item.id === 'next-try');
  const tipLine = tip ? `<p class="end-tip${totals.won ? ' won' : ''}">${escapeHTML(tip.text)}</p>` : '';
  highlights = highlights.filter((item) => item.id !== 'next-try');   // a dica já aparece acima, fora dos detalhes
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
  const details = cards || table ? `<details class="end-details"><summary>Detalhes</summary><div class="end-details-body">${cards}${table}</div></details>` : '';
  return numbers + tipLine + details;
}
