// Dica flutuante única e reutilizável. Qualquer elemento com data-tip entra:
//   data-tip="texto simples"  ou  data-tip="skill" + um resolvedor registrado em registerTooltip.
// Abre no hover e no foco do teclado; fecha com Esc, blur, saída do ponteiro ou rolagem. Nunca captura cliques (pointer-events: none).
const resolvers = new Map();
let tip = null, current = null, openTimer = 0;
const TIP_ID = 'game-tooltip';

export function registerTooltip(kind, resolve) { resolvers.set(kind, resolve); }

function ensure() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = TIP_ID;
  tip.className = 'game-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = '<div class="game-tooltip-body"></div><span class="game-tooltip-arrow" aria-hidden="true"></span>';
  document.body.appendChild(tip);
  return tip;
}

function contentFor(el) {
  const kind = el.getAttribute('data-tip');
  const resolve = resolvers.get(kind);
  if (resolve) return resolve(el);
  const text = document.createElement('span');
  text.textContent = kind;
  return text.outerHTML;
}

function place(el) {
  const r = el.getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  const margin = 8, gap = 10;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const below = r.top - box.height - gap < margin && r.bottom + box.height + gap <= vh - margin;
  let top = below ? r.bottom + gap : r.top - box.height - gap;
  top = Math.max(margin, Math.min(top, vh - box.height - margin));
  const center = r.left + r.width / 2;
  const left = Math.max(margin, Math.min(center - box.width / 2, vw - box.width - margin));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.style.setProperty('--arrow-x', `${Math.round(Math.max(14, Math.min(center - left, box.width - 14)))}px`);
  tip.dataset.side = below ? 'below' : 'above';
}

export function showTooltip(el) {
  const html = contentFor(el);
  if (!html) return;
  ensure();
  if (current && current !== el) current.removeAttribute('aria-describedby');
  current = el;
  tip.firstChild.innerHTML = html;
  el.setAttribute('aria-describedby', TIP_ID);
  tip.classList.add('measuring');
  tip.classList.remove('show');
  place(el);
  tip.classList.remove('measuring');
  void tip.offsetWidth;   // reinicia a transição curta
  tip.classList.add('show');
}

export function hideTooltip() {
  clearTimeout(openTimer);
  if (current) current.removeAttribute('aria-describedby');
  current = null;
  tip?.classList.remove('show');
}

const target = (e) => e.target instanceof Element ? e.target.closest('[data-tip]') : null;

export function initTooltips() {
  if (initTooltips.done) return;
  initTooltips.done = true;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    if (current && !current.isConnected) hideTooltip();   // o alvo foi redesenhado por baixo da dica
    const el = target(e);
    if (!el || el === current) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => showTooltip(el), 120);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const el = target(e);
    if (!el || el.contains(e.relatedTarget)) return;
    if (el === current) hideTooltip(); else clearTimeout(openTimer);
  });
  document.addEventListener('focusin', (e) => {
    const el = target(e);
    if (el && el.matches(':focus-visible')) showTooltip(el);
  });
  document.addEventListener('focusout', (e) => { if (target(e) === current) hideTooltip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) hideTooltip(); });
  addEventListener('scroll', () => current && hideTooltip(), true);
  addEventListener('resize', () => current && hideTooltip());
}
