# Fichiers embarqués

Ces fichiers ne sont pas écrits ici : ils sont recopiés tels quels depuis npm,
pour que l'application fonctionne sans dépendre d'un CDN et sans réseau.

| Fichier | Origine | Licence |
|---|---|---|
| `tesseract/tesseract.min.js`, `tesseract/worker.min.js` | `tesseract.js@5.1.1` | Apache-2.0 |
| `tesseract/tesseract-core-simd-lstm.wasm.js`, `tesseract/tesseract-core-lstm.wasm.js` | `tesseract.js-core@5.1.1` | Apache-2.0 |
| `tessdata/fra.traineddata.gz` | `@tesseract.js-data/fra` (modèle 4.0.0) | Apache-2.0 |

Les deux variantes du moteur sont nécessaires : `simd` sur les appareils récents,
l'autre en repli. Seule la variante `lstm` est embarquée, c'est celle qu'utilise
l'application (`oem: 1`).

Pour les mettre à jour :

```sh
npm pack tesseract.js@5 tesseract.js-core@5 @tesseract.js-data/fra
```

puis recopier les mêmes fichiers.
