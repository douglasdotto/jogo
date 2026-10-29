// Reuses short-lived battle labels instead of allocating a node and timer per hit.
export function createPopTextPool(container, { createElement = () => container.ownerDocument.createElement('div'), maxRetained = 96, lifetime = 900 } = {}) {
  const free = [];
  const active = [];
  const expires = [];
  const capacity = Math.max(0, Math.trunc(Number(maxRetained) || 0));

  function releaseAt(index) {
    const element = active[index];
    const last = active.length - 1;
    if (index !== last) {
      active[index] = active[last];
      expires[index] = expires[last];
    }
    active.pop();
    expires.pop();
    element.remove();
    element.className = '';
    element.textContent = '';
    element.style.left = '';
    element.style.top = '';
    if (free.length < capacity) free.push(element);
  }

  return {
    show(text, className, left, top, now) {
      const element = free.pop() || createElement();
      element.className = `pop ${className}`;
      element.textContent = String(text);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      container.appendChild(element);
      active.push(element);
      expires.push(now + lifetime);
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
