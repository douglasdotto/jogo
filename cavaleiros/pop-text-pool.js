// Reuses short-lived battle labels instead of allocating a node and timer per hit.
// Números com a mesma chave (o mesmo alvo) dentro de mergeWindow somam num só rótulo; maxActive limita os rótulos na tela.
export function createPopTextPool(container, { createElement = () => container.ownerDocument.createElement('div'), maxRetained = 96, maxActive = 48, lifetime = 900, mergeWindow = 700 } = {}) {
  const free = [];
  const active = [];
  const expires = [];
  const keys = [];
  const values = [];
  const shownAt = [];
  const capacity = Math.max(0, Math.trunc(Number(maxRetained) || 0));
  const activeLimit = Math.max(1, Math.trunc(Number(maxActive) || 1));

  function releaseAt(index) {
    const element = active[index];
    const last = active.length - 1;
    if (index !== last) {
      active[index] = active[last];
      expires[index] = expires[last];
      keys[index] = keys[last];
      values[index] = values[last];
      shownAt[index] = shownAt[last];
    }
    active.pop();
    expires.pop();
    keys.pop();
    values.pop();
    shownAt.pop();
    element.remove();
    element.className = '';
    element.textContent = '';
    element.style.left = '';
    element.style.top = '';
    if (free.length < capacity) free.push(element);
  }

  return {
    show(text, className, left, top, now, key = null) {
      const merge = key != null && typeof text === 'number';
      if (merge) {
        for (let i = 0; i < active.length; i++) {
          if (keys[i] !== key || now - shownAt[i] > mergeWindow || active[i].className !== `pop ${className}`) continue;
          const element = active[i];
          values[i] += text;
          shownAt[i] = now;
          expires[i] = now + lifetime;
          element.textContent = String(Math.round(values[i]));
          element.style.left = `${left}px`;
          element.style.top = `${top}px`;
          for (const animation of element.getAnimations?.() || []) animation.currentTime = 0;   // salta de novo sem forçar layout
          return element;
        }
      }
      if (active.length >= activeLimit) {   // tela cheia: some o rótulo mais antigo
        let oldest = 0;
        for (let i = 1; i < expires.length; i++) if (expires[i] < expires[oldest]) oldest = i;
        releaseAt(oldest);
      }
      const element = free.pop() || createElement();
      element.className = `pop ${className}`;
      element.textContent = String(merge ? Math.round(text) : text);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      container.appendChild(element);
      active.push(element);
      expires.push(now + lifetime);
      keys.push(merge ? key : null);
      values.push(merge ? text : 0);
      shownAt.push(now);
      return element;
    },
    update(now) {
      for (let i = active.length - 1; i >= 0; i--) if (now >= expires[i]) releaseAt(i);
    },
    clear() {
      while (active.length) releaseAt(active.length - 1);
    },
    get activeCount() { return active.length; },
    get pooledCount() { return free.length; },
  };
}
