// Logo do jogo no estilo dos jogos de celular: letras gordas douradas com contorno grosso,
// faixa azul com "AGE OF" e o mascote — uma caveira gargalhando, vesga, com dente de ouro e coroa escorregando.
// SVG embutido (não <img>) para usar a fonte Lilita One que a página já carrega.
export function logoSVG() {
  const outline = '#2a1606';
  return `<svg class="game-logo" viewBox="-30 -26 740 296" role="img" aria-label="Age of Popozitos" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#f08a1a"/>
    </linearGradient>
    <linearGradient id="lg-ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2a6fd6"/>
    </linearGradient>
    <radialGradient id="lg-bone" cx=".4" cy=".3" r=".85">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3ead6"/><stop offset="1" stop-color="#cdbf9e"/>
    </radialGradient>
  </defs>

  <!-- faixa azul com "AGE OF" -->
  <g transform="translate(400 62)">
    <path d="M-170 -26 L170 -26 L150 0 L170 26 L-170 26 L-150 0 Z" fill="#1b3f86" stroke="${outline}" stroke-width="7" stroke-linejoin="round" transform="translate(0 6)"/>
    <path d="M-150 -30 L150 -30 L150 26 L-150 26 Z" fill="url(#lg-ribbon)" stroke="${outline}" stroke-width="7" stroke-linejoin="round"/>
    <rect x="-140" y="-24" width="280" height="12" rx="6" fill="#ffffff" opacity=".28"/>
    <text x="0" y="13" text-anchor="middle" font-family="'Lilita One', sans-serif" font-size="40" letter-spacing="6"
      fill="#ffffff" stroke="${outline}" stroke-width="8" paint-order="stroke" stroke-linejoin="round">AGE OF</text>
    <!-- coroa em cima da faixa -->
    <g transform="translate(0 -52)">
      <path d="M-30 14 L-36 -12 L-16 2 L0 -20 L16 2 L36 -12 L30 14 Z" fill="url(#lg-gold)" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="0" cy="-20" r="5" fill="#ff5d7a" stroke="${outline}" stroke-width="3"/>
      <circle cx="-36" cy="-12" r="4" fill="#7fd0ff" stroke="${outline}" stroke-width="3"/>
      <circle cx="36" cy="-12" r="4" fill="#7fd0ff" stroke="${outline}" stroke-width="3"/>
    </g>
  </g>

  <!-- POPOZITOS: contorno grosso, dourado e brilho na metade de cima -->
  <g transform="translate(412 190) rotate(-4)" font-family="'Lilita One', sans-serif" font-size="98" text-anchor="middle" letter-spacing="2">
    <text x="0" y="10" fill="${outline}" stroke="${outline}" stroke-width="22" stroke-linejoin="round">POPOZITOS</text>
    <text x="0" y="0" fill="url(#lg-gold)" stroke="${outline}" stroke-width="9" stroke-linejoin="round" paint-order="stroke">POPOZITOS</text>
    <rect x="-250" y="-74" width="500" height="16" rx="8" fill="#ffffff" opacity=".22"/>
  </g>

  <!-- mascote: caveira gargalhando, vesga, com dente de ouro e coroa escorregando -->
  <g transform="translate(58 170) rotate(-12)">
    <ellipse cx="4" cy="66" rx="54" ry="11" fill="#000" opacity=".22"/>
    <!-- crânio -->
    <path d="M2 -52 C-38 -52 -58 -24 -56 4 C-55 18 -48 26 -40 30 L-34 34 L36 34 L42 30 C50 26 58 16 58 2 C60 -26 40 -52 2 -52 Z"
      fill="url(#lg-bone)" stroke="${outline}" stroke-width="7" stroke-linejoin="round"/>
    <rect x="-34" y="-42" width="36" height="9" rx="4.5" fill="#ffffff" opacity=".7" transform="rotate(-14)"/>
    <!-- sobrancelha de osso arqueada (cara de deboche) -->
    <path d="M-40 -18 Q-26 -32 -8 -22" fill="none" stroke="${outline}" stroke-width="6" stroke-linecap="round"/>
    <!-- órbitas desiguais, pupilas vesgas -->
    <ellipse cx="-22" cy="0" rx="15" ry="16" fill="${outline}"/>
    <ellipse cx="22" cy="4" rx="10" ry="11" fill="${outline}"/>
    <circle cx="-17" cy="-3" r="5.5" fill="#ffe27a"/><circle cx="18" cy="8" r="3.5" fill="#ffe27a"/>
    <!-- nariz -->
    <path d="M0 14 L-6 24 L6 24 Z" fill="${outline}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/>
    <!-- maxilar de cima com dentes (um de ouro, um faltando) -->
    <path d="M-30 30 L30 30" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
    <g stroke="${outline}" stroke-width="3" stroke-linejoin="round">
      <rect x="-26" y="30" width="10" height="11" rx="2" fill="#fff8e6"/>
      <rect x="-15" y="30" width="10" height="12" rx="2" fill="#fff8e6"/>
      <rect x="6" y="30" width="10" height="11" rx="2" fill="url(#lg-gold)"/>
      <rect x="17" y="30" width="9" height="9" rx="2" fill="#fff8e6"/>
    </g>
    <!-- queixo caído: boca aberta na gargalhada -->
    <path d="M-30 42 C-28 62 28 64 32 42 L22 46 C12 50 -12 50 -22 46 Z" fill="${outline}"/>
    <path d="M-36 40 C-34 72 34 74 38 40 C34 46 30 48 26 48 C14 54 -14 54 -26 48 C-30 48 -34 46 -36 40 Z"
      fill="url(#lg-bone)" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
    <g stroke="${outline}" stroke-width="3" stroke-linejoin="round" fill="#fff8e6">
      <rect x="-20" y="45" width="9" height="8" rx="2"/><rect x="-6" y="47" width="9" height="8" rx="2"/><rect x="9" y="45" width="9" height="8" rx="2"/>
    </g>
    <!-- rachadura -->
    <path d="M24 -48 L16 -36 L24 -30 L18 -22" fill="none" stroke="${outline}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- coroa escorregando -->
    <g transform="translate(-20 -56) rotate(-28)">
      <path d="M-22 9 L-26 -10 L-11 0 L0 -16 L11 0 L26 -10 L22 9 Z" fill="url(#lg-gold)" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="0" cy="-16" r="3.8" fill="#ff5d7a" stroke="${outline}" stroke-width="2"/>
    </g>
    <!-- "HA!" saindo da gargalhada -->
    <text x="62" y="-34" transform="rotate(14 62 -34)" font-family="'Lilita One', sans-serif" font-size="26" fill="#ffffff"
      stroke="${outline}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">HA!</text>
  </g>

  <!-- brilhos -->
  <g fill="#fff6b0" stroke="${outline}" stroke-width="3" stroke-linejoin="round">
    <path d="M672 92 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6 Z"/>
    <path d="M200 70 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z"/>
    <path d="M688 214 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z"/>
  </g>
</svg>`;
}
