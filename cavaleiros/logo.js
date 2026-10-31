// Logo do jogo no estilo dos jogos de celular: um brasão (escudo azul com espadas cruzadas e o mascote,
// a caveira gargalhando, vesga, com dente de ouro e coroa torta), a fita vermelha com "AGE OF" e "POPOZITOS"
// em arco, com letras gordas chanfradas (filtro de luz), extrusão laranja, contorno grosso e um brilho que passa.
// SVG embutido (não <img>) para usar a fonte Lilita One que a página já carrega. Todo id começa com "lg-":
// a tela de carregamento troca o prefixo para ter cópia própria (loading.js).
const O = '#10162c';   // contorno: o azul-marinho quase preto da UI
const FONT = "'Lilita One', sans-serif";

// mascote: caveira gargalhando, vesga, com dente de ouro e coroa escorregando
const skull = `<g>
    <path d="M2 -52 C-38 -52 -58 -24 -56 4 C-55 18 -48 26 -40 30 L-34 34 L36 34 L42 30 C50 26 58 16 58 2 C60 -26 40 -52 2 -52 Z" fill="url(#lg-bone)" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M-36 -26 C-30 -40 -14 -46 2 -46" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>
    <path d="M-40 -18 Q-26 -32 -8 -22" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="-22" cy="0" rx="15" ry="16" fill="${O}"/><ellipse cx="22" cy="4" rx="11" ry="12" fill="${O}"/>
    <circle cx="-17" cy="-3" r="5.5" fill="#ffe27a"/><circle cx="18" cy="8" r="3.8" fill="#ffe27a"/>
    <path d="M0 14 L-6 24 L6 24 Z" fill="${O}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-30 30 L30 30" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
    <g stroke="${O}" stroke-width="3" stroke-linejoin="round">
      <rect x="-26" y="30" width="10" height="11" rx="2" fill="#fff8e6"/><rect x="-15" y="30" width="10" height="12" rx="2" fill="#fff8e6"/>
      <rect x="6" y="30" width="10" height="11" rx="2" fill="url(#lg-gold)"/><rect x="17" y="30" width="9" height="9" rx="2" fill="#fff8e6"/>
    </g>
    <path d="M-30 42 C-28 62 28 64 32 42 L22 46 C12 50 -12 50 -22 46 Z" fill="${O}"/>
    <path d="M-36 40 C-34 72 34 74 38 40 C34 46 30 48 26 48 C14 54 -14 54 -26 48 C-30 48 -34 46 -36 40 Z" fill="url(#lg-bone)" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <g stroke="${O}" stroke-width="3" stroke-linejoin="round" fill="#fff8e6"><rect x="-20" y="45" width="9" height="8" rx="2"/><rect x="-6" y="47" width="9" height="8" rx="2"/><rect x="9" y="45" width="9" height="8" rx="2"/></g>
    <path d="M24 -48 L16 -36 L24 -30 L18 -22" fill="none" stroke="${O}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(-14 -54) rotate(-22)">
      <path d="M-26 11 L-31 -12 L-13 0 L0 -19 L13 0 L31 -12 L26 11 Z" fill="url(#lg-gold)" stroke="${O}" stroke-width="5.5" stroke-linejoin="round"/>
      <path d="M-24 4 L24 4" stroke="#c2560f" stroke-width="3"/>
      <circle cx="0" cy="-19" r="4.5" fill="#ff5d6e" stroke="${O}" stroke-width="2.5"/>
      <circle cx="-31" cy="-12" r="3.5" fill="#7fd0ff" stroke="${O}" stroke-width="2.5"/><circle cx="31" cy="-12" r="3.5" fill="#7fd0ff" stroke="${O}" stroke-width="2.5"/>
    </g>
  </g>`;

// espada com a ponta para cima a partir do punho (0,0); o brasão as gira para cruzar atrás do escudo
const sword = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M-9 -20 L-9 -168 L0 -190 L9 -168 L9 -20 Z" fill="url(#lg-steel)" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M0 -28 L0 -166" stroke="#8d9cbb" stroke-width="2.5"/>
    <rect x="-34" y="-24" width="68" height="13" rx="6.5" fill="url(#lg-gold)" stroke="${O}" stroke-width="5.5"/>
    <circle cx="0" cy="-17.5" r="4" fill="#ff5d6e" stroke="${O}" stroke-width="2"/>
    <rect x="-7" y="-11" width="14" height="32" rx="4" fill="#7a3a16" stroke="${O}" stroke-width="5"/>
    <circle cx="0" cy="26" r="9" fill="url(#lg-gold)" stroke="${O}" stroke-width="5"/>
  </g>`;

const SHIELD = 'M-80 -74 Q0 -100 80 -74 L80 0 Q80 66 0 92 Q-80 66 -80 0 Z';

const glint = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="lg-glint">
    <path d="M0 -22 C2 -6 6 -2 22 0 C6 2 2 6 0 22 C-2 6 -6 2 -22 0 C-6 -2 -2 -6 0 -22 Z" fill="#fff"/><circle r="5" fill="#fff"/></g></g>`;

export function logoSVG() {
  // título: contorno grosso (cópias descendo), extrusão laranja, aro escuro, face dourada chanfrada
  let outline = '', depth = '';
  for (let y = 0; y <= 16; y += 4) outline += `<use href="#lg-word" y="${y}" fill="${O}" stroke="${O}" stroke-width="24" stroke-linejoin="round"/>`;
  for (let y = 2; y <= 14; y += 2) depth += `<use href="#lg-word" y="${y}" fill="url(#lg-ext)" stroke="url(#lg-ext)" stroke-width="9" stroke-linejoin="round"/>`;
  return `<svg class="game-logo" viewBox="0 0 740 430" role="img" aria-label="Age of Popozitos" xmlns="http://www.w3.org/2000/svg">
  <style>
    .game-logo .lg-sweep { animation: lg-sweep 5s ease-in-out infinite; }
    .game-logo .lg-glint { transform-box: fill-box; transform-origin: center; animation: lg-twinkle 2.4s ease-in-out infinite; }
    @keyframes lg-sweep { 0%, 60% { transform: translateX(-140px) skewX(-22deg); } 100% { transform: translateX(1000px) skewX(-22deg); } }
    @keyframes lg-twinkle { 0%, 100% { transform: scale(.55) rotate(0deg); opacity: .65; } 50% { transform: scale(1) rotate(45deg); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .game-logo .lg-sweep, .game-logo .lg-glint { animation: none; } .game-logo .lg-sweep { visibility: hidden; } }
  </style>
  <defs>
    <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8c8"/><stop offset=".36" stop-color="#ffe04f"/><stop offset=".6" stop-color="#ffb526"/><stop offset="1" stop-color="#ee7a14"/>
    </linearGradient>
    <linearGradient id="lg-ext" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2560f"/><stop offset="1" stop-color="#6e2a07"/></linearGradient>
    <linearGradient id="lg-navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d66b8"/><stop offset=".55" stop-color="#21397d"/><stop offset="1" stop-color="#14224d"/></linearGradient>
    <linearGradient id="lg-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a55"/><stop offset=".5" stop-color="#e2333a"/><stop offset="1" stop-color="#a81c2a"/></linearGradient>
    <linearGradient id="lg-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d3dcec"/><stop offset=".51" stop-color="#93a3c0"/><stop offset="1" stop-color="#6d7fa3"/></linearGradient>
    <radialGradient id="lg-bone" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3ead6"/><stop offset="1" stop-color="#c9b994"/></radialGradient>
    <linearGradient id="lg-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <!-- chanfro: relevo do alfa iluminado de cima-esquerda (luz difusa escurece a borda de baixo, especular acende a de cima) -->
    <filter id="lg-bevel" x="-5%" y="-15%" width="110%" height="130%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b"/>
      <feDiffuseLighting in="b" surfaceScale="6" diffuseConstant="1.3" lighting-color="#fff" result="d"><feDistantLight azimuth="240" elevation="45"/></feDiffuseLighting>
      <feSpecularLighting in="b" surfaceScale="6" specularConstant="1.1" specularExponent="24" lighting-color="#fff" result="s"><feDistantLight azimuth="240" elevation="45"/></feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
      <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.1" result="lit"/>
      <feComposite in="lit" in2="s2" operator="arithmetic" k2="1" k3=".8"/>
      <feComposite in2="SourceAlpha" operator="in"/>
    </filter>
    <path id="lg-arc" d="M40 392 Q370 312 700 392"/>
    <text id="lg-word" font-family="${FONT}" font-size="122" letter-spacing="3" text-anchor="middle"><textPath href="#lg-arc" startOffset="50%">POPOZITOS</textPath></text>
    <clipPath id="lg-clip"><use href="#lg-word"/></clipPath>
    <path id="lg-rib" d="M-120 12 Q0 -2 120 12"/>
  </defs>

  <!-- brasão: espadas cruzadas atrás do escudo, caveira coroada na frente -->
  <g transform="translate(370 122)">
    ${sword(-104, -94, 143)}${sword(104, -94, -143)}
    <path d="${SHIELD}" fill="${O}" stroke="${O}" stroke-width="22" stroke-linejoin="round"/>
    <path d="${SHIELD}" fill="url(#lg-navy)" stroke="url(#lg-gold)" stroke-width="10" stroke-linejoin="round"/>
    <path d="${SHIELD}" fill="none" stroke="${O}" stroke-width="3" stroke-linejoin="round" transform="scale(.85)" opacity=".45"/>
    <path d="M-62 -58 Q0 -80 62 -58 L62 -30 Q0 -46 -62 -30 Z" fill="#fff" opacity=".14"/>
    <g transform="translate(0 -20) scale(.9)">${skull}</g>
  </g>

  <!-- fita vermelha com "AGE OF", presa entre o brasão e o título -->
  <g transform="translate(370 246)">
    <path d="M-116 -8 L-170 -10 L-154 12 L-170 34 L-116 30 Z" fill="#8f1724" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M116 -8 L170 -10 L154 12 L170 34 L116 30 Z" fill="#8f1724" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M-124 -24 Q0 -38 124 -24 L124 22 Q0 8 -124 22 Z" fill="url(#lg-red)" stroke="${O}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M-116 -17 Q0 -30 116 -17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>
    <text font-family="${FONT}" font-size="34" letter-spacing="5" text-anchor="middle" fill="#fff" stroke="${O}" stroke-width="7" stroke-linejoin="round" paint-order="stroke"><textPath href="#lg-rib" startOffset="50%">AGE OF</textPath></text>
  </g>

  <g>
    ${outline}${depth}
    <use href="#lg-word" fill="#7a2f08" stroke="#7a2f08" stroke-width="8" stroke-linejoin="round"/>
    <use href="#lg-word" fill="url(#lg-gold)" filter="url(#lg-bevel)"/>
    <g clip-path="url(#lg-clip)">
      <path d="M0 322 Q370 252 740 322 V100 H0 Z" fill="#fff" opacity=".28"/>
      <rect class="lg-sweep" x="-160" y="-40" width="90" height="520" fill="url(#lg-shine)" transform="skewX(-22)" opacity=".8"/>
    </g>
  </g>

  ${glint(676, 302, .9)}${glint(246, 34, .62)}
</svg>`;
}
