/**
 * Écran « les vraies voix » : brancher un compte ElevenLabs et donner une voix
 * de comédien à chaque personnage.
 *
 * Les extraits de démonstration viennent d'ElevenLabs et ne coûtent rien à
 * écouter : on peut essayer toutes les voix sans consommer un seul caractère.
 */

import { qs, el, clear, toast, setBusy, confirmBox } from '../ui.js';
import { settings } from '../settings.js';
import { TIMBRES, timbreById, suggestPremiumVoices } from '../casting.js';
import { session } from '../state.js';
import * as premium from '../premium.js';

export function createPremiumScreen() {
  const host = qs('#premium-list');
  let voices = [];
  let models = [];
  let sample = null;
  let wired = false;

  function playSample(url) {
    if (!url) { toast("Cette voix n'a pas d'extrait à écouter."); return; }
    sample?.pause();
    sample = new Audio(url);
    sample.play().catch(() => toast("L'extrait n'a pas pu être joué."));
  }

  async function loadAccount({ silent = false } = {}) {
    if (!premium.isConfigured()) return false;
    if (!silent) setBusy('Connexion à ElevenLabs…');
    try {
      const account = await premium.checkKey();
      voices = account.voices;
      models = account.models;
      if (!silent) setBusy(false);
      return true;
    } catch (error) {
      if (!silent) setBusy(false);
      toast(error.message, 'error');
      return false;
    }
  }

  /** Écran d'accueil quand aucune clé n'est enregistrée. */
  function renderSetup() {
    const input = el('input', {
      class: 'input', type: 'password', placeholder: 'Colle ta clé ElevenLabs ici',
      autocomplete: 'off', spellcheck: 'false',
    });

    host.append(el('div', { class: 'setting' }, [
      el('p', { class: 'setting-title' }, '✨ Des voix de comédiens'),
      el('p', { class: 'setting-note' },
        "Les voix du téléphone sont de la synthèse : on peut les monter ou les descendre, "
        + "elles restent mécaniques. Pour de vraies voix de personnages, l'application peut "
        + "utiliser un compte ElevenLabs."),
      el('p', { class: 'setting-note' },
        "C'est facturé au caractère lu. Une page de livre jeunesse en fait 500 à 1500, et "
        + "chaque extrait est gardé sur l'appareil : relire une page déjà lue ne coûte plus rien."),
      el('p', { class: 'setting-note' },
        "En échange, le texte des pages lues est envoyé à ElevenLabs. Tout le reste — les photos, "
        + "la bibliothèque — ne quitte toujours pas le téléphone."),
      input,
      el('p', { class: 'setting-note' },
        "La clé reste dans ce navigateur. Comme toute clé conservée sur un appareil, elle est "
        + "lisible par qui a le téléphone en main : prends-en une dédiée, que tu peux révoquer."),
      el('button', {
        class: 'btn btn-primary btn-large',
        onClick: async () => {
          const key = input.value.trim();
          if (!key) { toast('Il manque la clé.'); return; }
          settings.set('premiumKey', key);
          setBusy('Vérification…');
          try {
            const account = await premium.checkKey();
            voices = account.voices;
            models = account.models;
            settings.update({
              voiceProvider: 'premium',
              premiumVoices: suggestPremiumVoices(voices, settings.get('premiumVoices')),
            });
            setBusy(false);
            toast(`${voices.length} voix disponibles, distribuées automatiquement.`, 'ok');
            render();
          } catch (error) {
            setBusy(false);
            settings.set('premiumKey', '');
            toast(error.message, 'error');
          }
        },
      }, 'Activer les vraies voix'),
    ]));
  }

  function modelRow() {
    if (!models.length) return null;
    const current = settings.get('premiumModel');
    const select = el('select', {
      class: 'input',
      onChange: (event) => settings.set('premiumModel', event.target.value),
    });
    for (const model of models) {
      select.append(el('option', { value: model.id, selected: model.id === current }, model.name));
    }
    if (!models.some((model) => model.id === current)) {
      // Le modèle enregistré n'est pas ouvert sur ce compte : on prend le premier.
      settings.set('premiumModel', models[0].id);
      select.value = models[0].id;
    }
    return el('div', { class: 'setting' }, [
      el('div', { class: 'setting-head' }, [el('span', { class: 'setting-title' }, 'Modèle de voix')]),
      select,
      el('p', { class: 'setting-note' }, 'Les modèles « multilingues » rendent le mieux le français.'),
    ]);
  }

  function timbreRow(timbre) {
    const assigned = settings.get('premiumVoices')?.[timbre.id] || '';
    const voice = voices.find((entry) => entry.id === assigned);

    const select = el('select', {
      class: 'input',
      onChange: (event) => {
        settings.update({ premiumVoices: { ...settings.get('premiumVoices'), [timbre.id]: event.target.value } });
        const picked = voices.find((entry) => entry.id === event.target.value);
        if (picked) playSample(picked.preview);
        render();
      },
    }, [el('option', { value: '' }, '— voix de l’appareil —')]);
    for (const entry of voices) {
      select.append(el('option', { value: entry.id, selected: entry.id === assigned }, entry.name));
    }

    return el('div', { class: 'cast-row' }, [
      el('div', { class: 'cast-head' }, [
        el('span', { class: 'timbre-emoji', 'aria-hidden': 'true' }, timbre.emoji),
        el('span', { class: 'cast-name' }, timbre.name),
        el('span', { class: 'cast-count' }, voice ? voice.name : 'non attribuée'),
        el('button', {
          class: 'round-button',
          'aria-label': `Écouter ${voice?.name || 'cette voix'}`,
          onClick: () => playSample(voice?.preview),
        }, '🔊'),
      ]),
      select,
    ]);
  }

  function render() {
    clear(host);
    if (!premium.isConfigured()) { renderSetup(); return; }

    host.append(el('p', { class: 'setting-note' },
      voices.length
        ? `${voices.length} voix sur ton compte. Les extraits s'écoutent gratuitement.`
        : 'Voix non chargées — vérifie la connexion.'));

    const model = modelRow();
    if (model) host.append(model);

    // Les personnages du livre en cours d'abord : c'est ce qu'on veut régler.
    const inUse = new Set(Object.values(session.casting || {}));
    const ordered = [...TIMBRES].sort((a, b) => Number(inUse.has(b.id)) - Number(inUse.has(a.id)));

    if (inUse.size) {
      host.append(el('p', { class: 'setting-group-title' }, 'Dans le livre en cours'));
    }
    let separated = false;
    for (const timbre of ordered) {
      if (inUse.size && !separated && !inUse.has(timbre.id)) {
        host.append(el('p', { class: 'setting-group-title' }, 'Les autres personnages'));
        separated = true;
      }
      host.append(timbreRow(timbre));
    }

    host.append(el('div', { class: 'setting' }, [
      el('div', { class: 'modal-actions' }, [
        el('button', {
          class: 'chip',
          onClick: async () => {
            const size = await premium.cacheSize().catch(() => 0);
            const sure = await confirmBox(`Vider les extraits gardés sur l'appareil (${Math.round(size / 1024)} ko) ? Ils seront regénérés, donc refacturés.`, { confirmLabel: 'Vider' });
            if (!sure) return;
            await premium.clearCache();
            toast('Cache audio vidé.');
          },
        }, '🧹 Vider le cache audio'),
        el('button', {
          class: 'chip',
          onClick: async () => {
            const sure = await confirmBox('Revenir aux voix de l’appareil et oublier la clé ?', { confirmLabel: 'Désactiver' });
            if (!sure) return;
            settings.update({ premiumKey: '', voiceProvider: 'local' });
            voices = [];
            toast('Vraies voix désactivées.');
            render();
          },
        }, '🚪 Désactiver'),
      ]),
    ]));
  }

  function wire() {
    if (wired) return;
    wired = true;
    qs('#premium-auto').addEventListener('click', () => {
      if (!voices.length) { toast('Aucune voix chargée.'); return; }
      settings.update({ premiumVoices: suggestPremiumVoices(voices, {}) });
      toast('Voix redistribuées.', 'ok');
      render();
    });
  }

  return {
    async mount() {
      wire();
      render();
      if (premium.isConfigured() && !voices.length) {
        if (await loadAccount()) render();
      }
    },
    unmount() { sample?.pause(); sample = null; },
  };
}
