// Passivas dos heróis: uma pequena, temática, que vale em todo modo (campanha, arena, teste).
// COMO ADICIONAR: um bloco por herói em PASSIVES, chave = id do herói (cfg.id, como em VARIANTS):
//   id: { name: 'Nome curto', icon: '☠', desc: 'Até 90 caracteres.', onEnemyDeath(hero, enemy, ctx) { ... } },
// Gatilhos (todos opcionais; só rodam em instâncias de Hero, nunca em ilusões, invocações ou inimigos):
//   onEnemyDeath(hero, enemy, ctx)  um inimigo morreu (ctx.killedByHero: o herói o matou; ctx.dist: distância até ele)
//   onHit(hero, target, dmg, ctx)   o herói acertou um golpe ou habilidade (dmg = dano dado)
//   onHurt(hero, attacker, dmg, ctx) o herói levou dano de verdade (attacker pode ser null)
//   onCast(hero, slot, ctx)         o herói começou uma habilidade (slot 0..3)
//   onAllyDown(hero, ally, ctx)     outro herói do grupo caiu
//   onPhaseStart(hero, ctx)         a luta de uma fase começou
//   tick(hero, dt, ctx)             todo quadro; para bônus contínuos (só roda se o herói tem `tick`)
// `ctx` (PASSIVE_CTX em main.js) é sempre o último argumento: units, game, popText, THREE, proc e helpers; acrescente lá o que faltar.
// Recarga interna: `if (!passiveReady(hero, 'chave', segundos)) return;` retorna true e arma a recarga.
// Texto flutuante ao disparar: `ctx.proc(hero, 'Texto!')` (no máx. 1 a cada 0,6 s por herói).
// Equilíbrio: efeitos pequenos; nada que mude o papel do herói. desc com até 90 caracteres.

export const PASSIVES = {
  necro: {
    name: 'Colheita de Ossos', icon: '☠', desc: 'Cada inimigo comum que morre perto de você ergue uma caveira por 6 s.',
    onEnemyDeath(hero, enemy, ctx) {
      if (enemy.boss || enemy.totem || ctx.dist > 9 || !ctx.canSummonSkull(hero) || !passiveReady(hero, 'caveira', 2)) return;
      ctx.summonSkull(hero, enemy.pos);
      ctx.proc(hero, 'Caveira!');
    },
  },
};

export function passiveReady(hero, key, seconds) {
  const cd = hero.passiveCd ||= {};
  if (cd[key] > 0) return false;
  cd[key] = seconds;
  return true;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// linha da passiva (ícone + nome; a descrição fica na dica); vazia para heróis sem passiva definida
export function passiveHTML(id) {
  const p = PASSIVES[id];
  return p ? `<div class="hero-passive" tabindex="0" data-tip="${esc(p.desc)}" aria-label="${esc(`Passiva ${p.name}: ${p.desc}`)}"><i aria-hidden="true">${p.icon}</i><strong>${esc(p.name)}</strong></div>` : '';
}
