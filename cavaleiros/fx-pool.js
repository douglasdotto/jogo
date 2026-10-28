// Reaproveita os materiais das partículas: criar e descartar um material por faísca, a 60 Hz, pesa no navegador.
// create() faz um material novo; take() devolve um livre já com cor e opacidade; give() o guarda de volta (até max).
export function materialPool(create, max = 300) {
  const free = [];
  const pool = {
    take(color, opacity = 1) {
      const m = free.pop() || create();
      m.userData.pool = pool;
      m.color.setHex(color);
      m.opacity = opacity;
      return m;
    },
    give(m) {
      if (free.includes(m)) return;   // devolvido duas vezes: ignora para não entregar o mesmo material a dois efeitos
      if (free.length < max) free.push(m);
      else { m.userData.pool = null; m.dispose(); }
    },
    get free() { return free.length; },
  };
  return pool;
}
