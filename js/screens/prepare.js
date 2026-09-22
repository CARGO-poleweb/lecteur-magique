/**
 * Écran « la page » : ce que l'app a compris, avant de lire.
 * C'est ici que l'adulte rattrape les erreurs de l'OCR et les répliques
 * mal attribuées — deux tapotements valent mieux qu'une lecture bancale.
 */

import { qs, el, clear, toast, promptBox } from '../ui.js';
import { session } from '../state.js';
import { router } from '../router.js';
import { colorForKey } from '../palette.js';
import { timbreById } from '../casting.js';
import { NARRATOR_KEY, NARRATOR_NAME } from '../dialogue.js';

export function createPrepareScreen() {
  const thumb = qs('#prepare-thumb');
  const quality = qs('#prepare-quality');
  const segmentsHost = qs('#prepare-segments');
  const textarea = qs('#prepare-textarea');
  const editButton = qs('#prepare-edit');
  const charactersHost = qs('#prepare-characters');
  let editing = false;
  let wired = false;

  /** Fait tourner le locuteur d'une réplique parmi les personnages connus. */
  function cycleSpeaker(segment) {
    const choices = [
      { key: NARRATOR_KEY, name: NARRATOR_NAME },
      ...session.characters.map((character) => ({ key: character.key, name: character.name })),
    ];
    const at = choices.findIndex((choice) => choice.key === segment.speakerKey);
    const next = choices[(at + 1) % choices.length];
    session.reassignSegment(segment.id, next.key, next.name);
    render();
  }

  function renderSegments() {
    clear(segmentsHost);
    for (const segment of session.segments) {
      const color = colorForKey(segment.speakerKey);
      segmentsHost.append(el('button', {
        class: `segment segment-${segment.kind}`,
        style: `--speaker-color:${color}`,
        title: 'Changer qui parle',
        onClick: () => cycleSpeaker(segment),
      }, [
        el('span', { class: 'segment-who' }, segment.kind === 'narration' ? NARRATOR_NAME : segment.speakerName),
        el('span', { class: 'segment-text' }, segment.text),
      ]));
    }
  }

  function renderCharacters() {
    clear(charactersHost);
    if (!session.characters.length) {
      charactersHost.append(el('p', { class: 'panel-note' },
        "Aucun dialogue repéré : toute la page sera lue par le narrateur."));
      return;
    }
    for (const character of session.characters) {
      const timbre = timbreById(session.casting[character.key]);
      charactersHost.append(el('button', {
        class: 'character-pill',
        style: `--speaker-color:${colorForKey(character.key)}`,
        title: 'Renommer ce personnage',
        onClick: async () => {
          const name = await promptBox('Comment s’appelle ce personnage ?', character.name);
          if (!name) return;
          session.renameCharacter(character.key, name);
          render();
        },
      }, [`${timbre.emoji} ${character.name}`, el('span', { class: 'cast-count' }, ` · ${character.count}`)]));
    }
  }

  function render() {
    thumb.hidden = !session.thumb;
    if (session.thumb) thumb.src = session.thumb;
    quality.textContent = session.confidence
      ? `Confiance de lecture : ${session.confidence} %. ${session.confidence < 70 ? 'Relis le texte avant de lancer.' : ''}`
      : '';
    renderSegments();
    renderCharacters();
  }

  function setEditing(on) {
    // On ne relit la zone de saisie que si on en sortait vraiment : au montage
    // elle est vide, et la prendre pour argent comptant effacerait la page.
    const wasEditing = editing;
    editing = on;
    textarea.hidden = !on;
    segmentsHost.hidden = on;
    editButton.textContent = on ? '✅ Terminé' : '✏️ Corriger';
    editButton.setAttribute('aria-pressed', String(on));

    if (on) {
      textarea.value = session.text;
      textarea.focus();
      return;
    }
    if (!wasEditing) return;
    const edited = textarea.value.trim();
    if (!edited || edited === session.text.trim()) return;
    session.setText(edited);
    render();
    toast('Texte mis à jour.', 'ok');
  }

  function wire() {
    if (wired) return;
    wired = true;
    editButton.addEventListener('click', () => setEditing(!editing));
    qs('#prepare-retake').addEventListener('click', () => router.go('scan'));
    qs('#prepare-read').addEventListener('click', async () => {
      if (editing) setEditing(false);
      if (!session.segments.length) { toast('Il n’y a rien à lire sur cette page.'); return; }
      try {
        if (!session.page) await session.persist();
      } catch {
        toast("La page n'a pas pu être rangée dans la bibliothèque, mais on peut la lire.");
      }
      await router.go('read');
    });
  }

  return {
    mount() {
      wire();
      setEditing(false);
      render();
    },
  };
}
