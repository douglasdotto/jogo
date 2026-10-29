// Logo do jogo no estilo dos jogos de celular: letras gordas douradas com contorno grosso,
// faixa azul com "AGE OF" e o mascote — um pêssego de coroa (o "popozito"), piscando.
// SVG embutido (não <img>) para usar a fonte Lilita One que a página já carrega.
export function logoSVG() {
  const outline = '#2a1606';
  return `<svg class="game-logo" viewBox="-30 0 740 270" role="img" aria-label="Age of Popozitos" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#f08a1a"/>
    </linearGradient>
    <linearGradient id="lg-ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2a6fd6"/>
    </linearGradient>
    <radialGradient id="lg-peach" cx=".38" cy=".32" r=".8">
      <stop offset="0" stop-color="#ffd2b0"/><stop offset=".55" stop-color="#ff9a6a"/><stop offset="1" stop-color="#e5584a"/>
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

  <!-- mascote: pêssego de coroa, piscando -->
  <g transform="translate(56 178) rotate(-10)">
    <ellipse cx="0" cy="40" rx="58" ry="12" fill="#000" opacity=".22"/>
    <path d="M0 -40 C-36 -48 -64 -14 -58 16 C-52 44 -22 50 0 34 C22 50 52 44 58 16 C64 -14 36 -48 0 -40 Z"
      fill="url(#lg-peach)" stroke="${outline}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M0 -36 C-6 -10 -6 14 0 32" fill="none" stroke="#c94a3e" stroke-width="5" stroke-linecap="round"/>
    <path d="M6 -42 C14 -60 34 -62 42 -52 C30 -46 18 -44 6 -42 Z" fill="#6fcf5a" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>
    <!-- carinha -->
    <circle cx="-22" cy="2" r="7" fill="${outline}"/><circle cx="-24" cy="-1" r="2.4" fill="#fff"/>
    <path d="M14 2 Q22 -6 30 2" fill="none" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="-34" cy="16" rx="8" ry="5" fill="#ff5d7a" opacity=".55"/><ellipse cx="34" cy="16" rx="8" ry="5" fill="#ff5d7a" opacity=".55"/>
    <path d="M-10 16 Q0 26 12 16" fill="#7a1f2a" stroke="${outline}" stroke-width="4" stroke-linejoin="round"/>
    <!-- coroinha torta -->
    <g transform="translate(-14 -52) rotate(-18)">
      <path d="M-18 8 L-22 -10 L-9 0 L0 -14 L9 0 L22 -10 L18 8 Z" fill="url(#lg-gold)" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>
    </g>
  </g>

  <!-- brilhos -->
  <g fill="#fff6b0" stroke="${outline}" stroke-width="3" stroke-linejoin="round">
    <path d="M672 92 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6 Z"/>
    <path d="M200 70 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z"/>
    <path d="M688 214 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z"/>
  </g>
</svg>`;
}
