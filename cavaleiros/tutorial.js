// Camada visual independente: não altera o relógio nem os controles do jogo.
export function createTutorial() {
  const key = 'cavaleiros-tutorial';
  const query = new URLSearchParams(location.search);
  let done = query.get('tudo') === '1' || query.has('fase');
  try { done ||= localStorage.getItem(key) === 'feito'; } catch {}
  let active = false, layer = null;
  const seen = new Set(), notices = new Set();
  const wants = event => active && !done && !seen.has(event);

  function clear() {
    active = false;
    for (const notice of [...notices]) notice.close(false);
    layer?.remove();
    layer = null;
  }
  function finish() {
    done = true;
    try { localStorage.setItem(key, 'feito'); } catch {}
    clear();
  }
  function mount() {
    if (layer) return;
    layer = document.createElement('div');
    layer.className = 'tutorial-layer';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'tutorial-skip';
    skip.textContent = 'Pular';
    skip.setAttribute('aria-label', 'Pular tutorial');
    skip.onclick = finish;
    layer.append(skip);
    document.body.append(layer);
  }
  const anchor = value => typeof value === 'function' ? value() : value;
  function enemyRect({ enemy, camera, fighting }) {
    if (enemy.dead || !fighting()) return null;
    const point = enemy.pos.clone().setY(enemy.pos.y + (enemy.barHeight ?? 2.6 * enemy.size)).project(camera);
    if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return null;
    const x = (point.x + 1) * innerWidth / 2, y = (1 - point.y) * innerHeight / 2;
    return { left: x - 1, top: y, bottom: y + 2, width: 2, height: 2 };
  }
  function rect(value) {
    const target = anchor(value);
    if (!target || target.isConnected === false) return null;
    const box = target.getBoundingClientRect ? target.getBoundingClientRect() : target;
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight ? box : null;
  }

  function show(text, target, { pulse = [], below = false, after } = {}) {
    if (!active) return;
    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'tutorial-bubble';
    bubble.textContent = text;
    bubble.style.visibility = 'hidden';
    bubble.setAttribute('aria-label', `${text}. Fechar dica`);
    const rings = pulse.map(() => {
      const ring = document.createElement('div');
      ring.className = 'tutorial-pulse';
      ring.style.visibility = 'hidden';
      ring.setAttribute('aria-hidden', 'true');
      return ring;
    });
    let timer, frame;
    const notice = { close(advance = true) {
      if (!notices.delete(notice)) return;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      bubble.remove();
      rings.forEach(ring => ring.remove());
      if (advance && active) after?.();
    } };
    notices.add(notice);
    bubble.onclick = () => notice.close();
    layer.append(...rings, bubble);
    function position() {
      const box = rect(target);
      if (!box) { notice.close(); return; }
      const size = bubble.getBoundingClientRect();
      bubble.style.visibility = '';
      const x = box.left + box.width / 2;
      const left = Math.max(12, Math.min(innerWidth - size.width - 12, x - size.width / 2));
      const down = below || box.top < size.height + 24;
      const top = down ? box.bottom + 14 : box.top - size.height - 14;
      bubble.style.left = `${left}px`;
      bubble.style.top = `${Math.max(12, Math.min(innerHeight - size.height - 12, top))}px`;
      bubble.style.setProperty('--arrow-x', `${Math.max(16, Math.min(size.width - 16, x - left))}px`);
      bubble.setAttribute('data-side', down ? 'below' : 'above');
      rings.forEach((ring, i) => {
        const r = rect(pulse[i]);
        ring.style.display = r ? '' : 'none';
        ring.style.visibility = '';
        if (r) Object.assign(ring.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
      });
      frame = requestAnimationFrame(position);
    }
    timer = setTimeout(() => notice.close(), 4000);
    // O HUD é montado no fim do quadro que inicia a batalha.
    frame = requestAnimationFrame(position);
  }

  function on(event, ctx = {}) {
    if (event === 'leave') { clear(); return; }
    if (done) return;
    if (event === 'pick') {
      if (ctx.missionId !== 'vila') { clear(); return; }
      active = true;
      mount();
    }
    if (!wants(event)) return;
    if (event === 'skillReady' && ctx.auto !== false) return;
    if (event === 'phaseCleared' && ctx.phase !== 1) return;
    if (event === 'enemyNear' && ctx.enemy) {
      ctx = { ...ctx, target: () => enemyRect(ctx) };
      if (!ctx.target()) return;
    }
    seen.add(event);
    switch (event) {
      case 'pick':
        // ancorado no botão: a bolha não cobre as abas nem repete o título em cima do cartão
        show('Escolha seu herói', ctx.button || ctx.card, { pulse: [ctx.card, ctx.button] });
        break;
      case 'battleStart':
        for (const notice of [...notices]) notice.close(false);
        show('Habilidades disparam sozinhas', () => document.querySelector('#skills'), {
          after: () => show('Desligue para controlar', () => document.querySelector('#skills .auto'), {
            pulse: [() => document.querySelector('#skills .auto')],
          }),
        });
        break;
      case 'enemyNear':
        show('Seu herói ataca sozinho', ctx.target);
        break;
      case 'skillReady':
        show('Clique para usar', ctx.target, { pulse: [ctx.target] });
        break;
      case 'phaseCleared':
        show('⚑ Avance pelas fases', () => document.querySelector('#wave'), { below: true });
        break;
      case 'relic':
        // A relíquia encerra o tutorial mesmo quando o jogador mantém AUTO ligado.
        for (const notice of [...notices]) notice.close(false);
        show('Escolha uma relíquia', ctx.target, { pulse: [ctx.target], after: finish });
        break;
    }
  }
  return { on, wants };
}

export const tutorial = createTutorial();
