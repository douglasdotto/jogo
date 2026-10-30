// Tela de carregamento: logo, caveirinha correndo sobre a barra e uma dica curta que troca sozinha.
// show() devolve uma promessa que resolve depois que a tela foi pintada (o trabalho pesado vem em seguida);
// hide() espera o mínimo de MIN_MS na tela, para não piscar, e some com um esmaecer curto.
import { logoSVG } from './logo.js';

export const LOADING_TIPS = [
  'Saia das marcas no chão',
  'Derrube o sacerdote primeiro',
  'Habilidades nas teclas 1–4',
  'Escudeiros só bloqueiam de frente',
  'Fantasmas furam a formação',
  'Golpes em área limpam os crânios',
  'Chefe furioso? Cuidado com o anel',
];
export const LOADING_MIN_MS = 400;
const TIP_MS = 2600, FADE_MS = 240;

export function createLoadingScreen(root, {
  now = () => performance.now(),
  nextFrame = (fn) => requestAnimationFrame(fn),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const logo = root.querySelector('.ld-logo'), tip = root.querySelector('.ld-tip');
  // ids próprios: o logo do menu usa os mesmos gradientes e pode estar escondido
  if (logo && !logo.firstChild) logo.innerHTML = logoSVG().replace(/lg-/g, 'ld-lg-');
  let shown = !root.classList.contains('hidden'), shownAt = now(), value = 0, gen = 0, tipTimer = null, tipIndex = Math.floor(Math.random() * LOADING_TIPS.length);
  const paint = () => root.style.setProperty('--p', value.toFixed(3));
  const nextTip = () => {
    if (!tip) return;
    tip.textContent = LOADING_TIPS[tipIndex++ % LOADING_TIPS.length];
    tip.classList.remove('swap');
    void tip.offsetWidth;   // reinicia a animação de entrada
    tip.classList.add('swap');
  };
  const startTips = () => { clearInterval(tipTimer); nextTip(); tipTimer = setInterval(nextTip, TIP_MS); };
  const painted = () => new Promise((resolve) => nextFrame(() => nextFrame(resolve)));   // dois quadros: a tela já está na frente
  if (shown) startTips();

  const api = {
    get visible() { return shown; },
    show() {
      gen++;
      if (!shown) {
        shown = true;
        shownAt = now();
        value = 0;
        paint();
        root.classList.remove('hidden', 'out');
        startTips();
      }
      return painted();
    },
    // f de 0 a 1; nunca volta
    progress(f) {
      value = Math.max(value, Math.min(1, Math.max(0, +f || 0)));
      paint();
    },
    async hide({ immediate = false } = {}) {
      if (!shown) return;
      const mine = ++gen;
      api.progress(1);
      const rest = LOADING_MIN_MS - (now() - shownAt);
      if (rest > 0 && !immediate) await wait(rest);
      if (mine !== gen) return;   // outro carregamento começou enquanto esperava
      shown = false;
      clearInterval(tipTimer);
      root.classList.add('out');
      wait(FADE_MS).then(() => { if (!shown) root.classList.add('hidden'); });
    },
  };
  paint();
  return api;
}
