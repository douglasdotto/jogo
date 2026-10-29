// Rotas de evolução para escolhas com estilos de jogo diferentes.
// Cada herói pode escolher cada rota uma única vez.
export const EVOLUTION_BRANCHES = [
  {
    id: 'damage',
    name: 'Ofensiva',
    short: '+12% dano, +8% rapidez',
    icon: '⚔',
    desc: 'Golpes mais fortes e ataques um pouco mais rápidos.',
    bonus: { damage: 0.12, haste: 0.08 },
  },
  {
    id: 'control',
    name: 'Controle',
    short: 'Controles duram +20%',
    icon: '❄',
    desc: 'Lentidões, raízes, provocações e atordoamentos duram mais.',
    bonus: { control: 0.2 },
  },
  {
    id: 'support',
    name: 'Apoio',
    short: 'Curas e invocações +20%',
    icon: '✚',
    desc: 'Curas ficam mais fortes e aliados invocados lutam por mais tempo.',
    bonus: { support: 0.2 },
  },
];

const branchById = new Map(EVOLUTION_BRANCHES.map((branch) => [branch.id, branch]));

/** Registra uma rota na unidade e devolve os bônus desta escolha. */
export function applyEvolutionBranch(hero, id) {
  const branch = branchById.get(id);
  if (!branch || hero.evolutionBranches?.[id] > 0) return null;

  hero.evolutionBranches ||= {};
  hero.evolutionBranches[id] = 1;
  hero.evolutionPath = id;
  return branch.bonus;
}

/** Combina todos os ramos já escolhidos; campos sem bônus ficam inalterados. */
export function scaleBranchEffect(hero, category, value) {
  let scaled = value;
  for (const [id, rank] of Object.entries(hero?.evolutionBranches || {})) {
    const bonus = branchById.get(id)?.bonus?.[category] || 0;
    scaled *= (1 + bonus) ** rank;
  }
  return scaled;
}
