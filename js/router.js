/**
 * Navigation entre écrans, avec prise en charge du bouton « retour » d'Android.
 * Chaque écran s'enregistre avec un mount/unmount ; l'historique du navigateur
 * suit la pile, pour que le geste de retour fasse ce qu'on attend.
 */

const screens = new Map();
let stack = [];

function show(name) {
  for (const section of document.querySelectorAll('.screen')) {
    section.hidden = section.id !== `screen-${name}`;
  }
  document.querySelector(`#screen-${name} .scroll`)?.scrollTo({ top: 0 });
}

async function enter(entry, options = {}) {
  show(entry.name);
  await screens.get(entry.name)?.mount?.(entry.params || {}, options);
}

async function leave(entry) {
  await screens.get(entry.name)?.unmount?.();
}

export const router = {
  register(name, handlers) { screens.set(name, handlers); },

  get current() { return stack[stack.length - 1]?.name || null; },

  /** Ouvre un écran et l'empile. */
  async go(name, params = {}) {
    const currentEntry = stack[stack.length - 1];
    if (currentEntry?.name === name) { await enter(currentEntry, { refresh: true }); return; }
    if (currentEntry) await leave(currentEntry);
    const entry = { name, params };
    stack.push(entry);
    history.pushState({ depth: stack.length }, '');
    await enter(entry);
  },

  /** Remplace toute la pile : sert pour revenir à l'accueil. */
  async reset(name, params = {}) {
    const currentEntry = stack[stack.length - 1];
    if (currentEntry) await leave(currentEntry);
    stack = [{ name, params }];
    await enter(stack[0]);
  },

  back() {
    if (stack.length <= 1) return;
    history.back();
  },

  async start(name, params = {}) {
    stack = [{ name, params }];
    history.replaceState({ depth: 1 }, '');
    await enter(stack[0]);
  },
};

window.addEventListener('popstate', async () => {
  if (stack.length <= 1) {
    // On est déjà à l'accueil : on réarme l'entrée pour ne pas quitter l'app par erreur.
    history.pushState({ depth: 1 }, '');
    return;
  }
  const leaving = stack.pop();
  await leave(leaving);
  await enter(stack[stack.length - 1], { restored: true });
});
