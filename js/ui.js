/** Petites aides DOM, pour éviter une dépendance de plus. */

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === 'class') node.className = value;
    else if (name === 'dataset') Object.assign(node.dataset, value);
    else if (name === 'html') node.innerHTML = value;
    else if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(name, value === true ? '' : String(value));
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let toastTimer = null;
export function toast(message, tone = 'info') {
  const host = qs('#toast');
  if (!host) return;
  host.textContent = message;
  host.dataset.tone = tone;
  host.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.hidden = true; }, tone === 'error' ? 6000 : 3200);
}

/** Boîte de confirmation, en promesse. */
export function confirmBox(message, { confirmLabel = 'Confirmer', tone = 'danger' } = {}) {
  return new Promise((resolve) => {
    const dialog = el('div', { class: 'modal-backdrop' });
    const close = (answer) => { dialog.remove(); resolve(answer); };
    dialog.append(el('div', { class: 'modal' }, [
      el('p', { class: 'modal-message' }, message),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-ghost', onClick: () => close(false) }, 'Annuler'),
        el('button', { class: `btn btn-${tone}`, onClick: () => close(true) }, confirmLabel),
      ]),
    ]));
    dialog.addEventListener('click', (event) => { if (event.target === dialog) close(false); });
    document.body.append(dialog);
  });
}

/** Saisie d'une ligne de texte, en promesse. */
export function promptBox(message, initial = '') {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input', type: 'text', value: initial });
    const dialog = el('div', { class: 'modal-backdrop' });
    const close = (answer) => { dialog.remove(); resolve(answer); };
    const form = el('form', {
      class: 'modal',
      onSubmit: (event) => { event.preventDefault(); close(input.value.trim() || null); },
    }, [
      el('p', { class: 'modal-message' }, message),
      input,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => close(null) }, 'Annuler'),
        el('button', { class: 'btn btn-primary', type: 'submit' }, 'Valider'),
      ]),
    ]);
    dialog.append(form);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) close(null); });
    document.body.append(dialog);
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

export function setBusy(message, progress = null) {
  const host = qs('#busy');
  if (!host) return;
  if (message === false) { host.hidden = true; return; }
  host.hidden = false;
  qs('.busy-label', host).textContent = message;
  const bar = qs('.busy-bar span', host);
  if (progress === null) {
    bar.parentElement.hidden = true;
  } else {
    bar.parentElement.hidden = false;
    bar.style.width = `${Math.round(progress * 100)}%`;
  }
}
