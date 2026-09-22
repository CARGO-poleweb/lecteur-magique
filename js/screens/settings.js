/** Réglages : vitesse, confort de lecture, et voix (appareil ou premium). */

import { qs, el, clear, toast, confirmBox, setBusy } from '../ui.js';
import { settings } from '../settings.js';
import { TIMBRES } from '../casting.js';
import { loadVoices, frenchVoices, describeVoices } from '../voices.js';
import { previewTimbre } from '../player.js';
import * as premium from '../premium.js';
import { router } from '../router.js';
import { store } from '../store.js';
import { getWorker } from '../ocr.js';

const APP_VERSION = '1.0.0';

function switchRow(title, note, name) {
  const input = el('input', {
    type: 'checkbox',
    checked: Boolean(settings.get(name)),
    onChange: (event) => settings.set(name, event.target.checked),
  });
  return el('div', { class: 'setting' }, [
    el('div', { class: 'setting-head' }, [
      el('span', { class: 'setting-title' }, title),
      el('label', { class: 'switch' }, [input, el('span', {})]),
    ]),
    note ? el('p', { class: 'setting-note' }, note) : null,
  ]);
}

function sliderRow(title, note, name, { min, max, step, format }) {
  const value = el('span', { class: 'cast-count' }, format(settings.get(name)));
  const input = el('input', {
    class: 'slider', type: 'range', min, max, step,
    value: settings.get(name),
    onInput: (event) => {
      const next = Number(event.target.value);
      settings.set(name, next);
      value.textContent = format(next);
    },
  });
  return el('div', { class: 'setting' }, [
    el('div', { class: 'setting-head' }, [el('span', { class: 'setting-title' }, title), value]),
    input,
    note ? el('p', { class: 'setting-note' }, note) : null,
  ]);
}

export function createSettingsScreen() {
  const host = qs('#settings-list');

  function providerRow() {
    const make = (id, label, note) => el('button', {
      class: 'chip',
      'aria-pressed': String(settings.get('voiceProvider') === id),
      onClick: () => { settings.set('voiceProvider', id); render(); },
      title: note,
    }, label);
    return el('div', { class: 'setting' }, [
      el('div', { class: 'setting-head' }, [el('span', { class: 'setting-title' }, 'Voix utilisées')]),
      el('div', { class: 'character-pills' }, [
        make('local', "🔒 Voix de l'appareil"),
        make('premium', '✨ Voix premium'),
      ]),
      el('p', { class: 'setting-note' }, settings.get('voiceProvider') === 'premium'
        ? "Le texte des pages est envoyé à ElevenLabs pour être joué. Chaque extrait est ensuite gardé sur l'appareil."
        : "Tout reste sur le téléphone : aucune page, aucun texte n'est envoyé nulle part."),
      el('button', {
        class: 'btn btn-primary btn-large',
        onClick: () => router.go('premium'),
      }, premium.isConfigured() ? '✨ Régler les vraies voix' : '✨ Mettre de vraies voix'),
    ]);
  }

  async function systemVoicesBlock() {
    const voices = frenchVoices(await loadVoices());
    const block = el('details', { class: 'setting' }, [
      el('summary', { class: 'setting-title' }, 'Voix de l’appareil, personnage par personnage'),
      el('p', { class: 'setting-note' }, describeVoices(await loadVoices())),
    ]);
    for (const timbre of TIMBRES) {
      const select = el('select', {
        class: 'input',
        onChange: (event) => settings.update({
          systemVoices: { ...settings.get('systemVoices'), [timbre.id]: event.target.value },
        }),
      }, [el('option', { value: '' }, '— choix automatique —')]);
      for (const voice of voices) {
        select.append(el('option', {
          value: voice.name,
          selected: settings.get('systemVoices')?.[timbre.id] === voice.name,
        }, voice.name));
      }
      block.append(el('div', { class: 'setting-head', style: 'margin:10px 0 6px' }, [
        el('span', { class: 'setting-title' }, `${timbre.emoji} ${timbre.name}`),
        el('button', { class: 'round-button', 'aria-label': 'Écouter', onClick: () => previewTimbre(timbre) }, '🔊'),
      ]), select);
    }
    return block;
  }

  async function render() {
    clear(host);

    host.append(el('p', { class: 'setting-group-title' }, 'Lecture'));
    host.append(sliderRow('Vitesse', 'S’applique à toutes les voix.', 'rate', {
      min: 0.6, max: 1.4, step: 0.05, format: (value) => `${Number(value).toFixed(2).replace('.', ',')}×`,
    }));
    host.append(switchRow('Surligner le mot lu', 'Aide à suivre du doigt. Tous les téléphones ne le permettent pas.', 'highlightWords'));
    host.append(switchRow('Défilement automatique', 'Garde la phrase en cours au centre de l’écran.', 'autoScroll'));
    host.append(switchRow('Écriture très espacée', 'Lettres et lignes plus aérées, plus faciles à déchiffrer.', 'easyFont'));

    host.append(el('p', { class: 'setting-group-title' }, 'Photo'));
    host.append(switchRow('Nettoyer la photo avant lecture',
      'Recommandé. À désactiver si la page est un texte clair sur fond coloré.', 'enhanceImage'));

    host.append(el('p', { class: 'setting-group-title' }, 'Voix'));
    host.append(providerRow());
    host.append(await systemVoicesBlock());

    host.append(el('p', { class: 'setting-group-title' }, 'Hors-ligne'));
    host.append(el('div', { class: 'setting' }, [
      el('div', { class: 'setting-head' }, [el('span', { class: 'setting-title' }, 'Lire sans réseau')]),
      el('p', { class: 'setting-note' },
        "Le moteur de reconnaissance et le modèle français pèsent une dizaine de mégaoctets. "
        + "Une fois chargés, l'application marche entièrement hors connexion — en voiture, en vacances, au lit."),
      el('div', { class: 'modal-actions' }, [
        el('button', {
          class: 'chip',
          onClick: async () => {
            setBusy('Préparation…', 0);
            try {
              await getWorker((label, progress) => setBusy(label, progress));
              setBusy(false);
              toast('Prêt : la lecture fonctionne maintenant sans réseau.', 'ok');
            } catch (error) {
              setBusy(false);
              toast(error.message, 'error');
            }
          },
        }, '⬇️ Préparer le mode hors-ligne'),
      ]),
    ]));

    host.append(el('p', { class: 'setting-group-title' }, 'Données'));
    host.append(el('div', { class: 'setting' }, [
      el('div', { class: 'setting-head' }, [el('span', { class: 'setting-title' }, 'Bibliothèque')]),
      el('p', { class: 'setting-note' }, 'Les pages scannées ne quittent jamais cet appareil.'),
      el('div', { class: 'modal-actions' }, [
        el('button', {
          class: 'chip',
          onClick: async () => {
            const sure = await confirmBox('Effacer tous les livres scannés ?', { confirmLabel: 'Tout effacer' });
            if (!sure) return;
            await Promise.all([store.clear('books'), store.clear('pages'), store.clear('audio')]);
            toast('Bibliothèque vidée.');
          },
        }, '🗑️ Effacer la bibliothèque'),
        el('button', {
          class: 'chip',
          onClick: async () => {
            const sure = await confirmBox('Remettre tous les réglages par défaut ?', { confirmLabel: 'Réinitialiser' });
            if (!sure) return;
            settings.reset();
            render();
          },
        }, '↩️ Réglages par défaut'),
      ]),
    ]));

    host.append(el('p', { class: 'setting-note', style: 'text-align:center;margin:24px 0' },
      `Le Lecteur Magique · version ${APP_VERSION}`));
  }

  return { mount: render };
}
