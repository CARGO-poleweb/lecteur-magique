# 📖 Le Lecteur Magique

Une application personnelle pour faire la lecture aux enfants : **on photographie
la page d'un livre avec le téléphone, et l'application la lit à voix haute — avec
une voix différente pour chaque personnage.**

Aucun compte, aucun serveur, rien à installer depuis un magasin d'applications.
C'est une PWA : une page web qu'on ajoute à l'écran d'accueil et qui se comporte
ensuite comme une vraie application, y compris sans réseau.

---

## Comment ça marche

Il n'y a **aucun bouton pour déclencher**. On tient le téléphone au-dessus du
livre, l'application fait le reste — et quand on tourne la page, elle enchaîne.

```
   📹 La caméra reste ouverte
        ↓
   👀 Surveillance, 6 images/seconde     l'appareil bouge-t-il ? est-ce net ?
        ↓                                y a-t-il quelque chose d'écrit ?
   ⏸️  Page immobile et nette
        ↓
   🧹 Nettoyage de l'image               redimensionnement + seuillage adaptatif
        ↓                                (encaisse l'ombre du lecteur et les reflets)
   🔤 Reconnaissance du texte             Tesseract, modèle français, dans le navigateur
        ↓
   📝 Remise en forme                     recollage des lignes, césures, numéros de page jetés
        ↓
   🎭 Qui parle ?                         incises, guillemets, tirets, pronoms, alternance
        ↓
   🗣️ Lecture                             une voix par personnage, mot surligné
        ↓
   🔄 On tourne la page → retour en haut
```

Pourquoi ce détour plutôt que de reconnaître le texte en continu : une page
entière coûte une à trois secondes de calcul. Analyser 6 images par seconde pour
répondre à trois questions bon marché — ça bouge ? c'est net ? y a-t-il de
l'encre ? — coûte mille fois moins, et permet de ne lancer la reconnaissance
qu'au bon moment. C'est aussi ce même signal de mouvement qui sert à repérer
qu'on a tourné la page.

Pendant la lecture, la caméra continue de veiller dans une petite vignette en
bas de l'écran. Tourne la page : la suivante est reconnue en fond, et la lecture
enchaîne dès que la page en cours est finie (ou tout de suite, en tapant sur
« page suivante prête »).

Si l'application n'arrive pas à se décider au bout de sept secondes, un bouton
« Lire cette page maintenant » apparaît — filet de sécurité, pas mode normal.

Tout reste corrigeable : depuis la lecture, le bouton ✏️ montre le texte reconnu
et qui dit quoi ; un tapotement sur une réplique change de locuteur, un autre
renomme un personnage.

## Les voix

Il n'existe pas vraiment de « comédiens » dans le navigateur : ce qu'on peut
régler, c'est la **hauteur** et le **débit** d'une voix de synthèse. Bien
choisis, ces deux curseurs suffisent à rendre un ogre méconnaissable d'une
petite souris. L'application propose 22 timbres prêts à l'emploi — narrateur,
petite fille, grand méchant loup, sorcière, fée, géant, robot, pirate… — et les
attribue automatiquement selon le nom et le genre du personnage : « le loup »
reçoit une grosse voix lente, « la sorcière » une voix haute et grinçante.

Tout est modifiable dans l'écran 🎭, avec écoute immédiate de chaque timbre.

### Avant de payer : les voix améliorées du téléphone

Les voix françaises livrées par défaut sont les versions « compactes », les plus
mécaniques. Les versions améliorées se téléchargent gratuitement et changent
beaucoup — l'application les préfère automatiquement dès qu'elles sont installées :

- **iPhone** : Réglages → Accessibilité → Contenu énoncé → Voix → Français →
  une voix marquée *Améliorée* ou *Premium*, puis l'icône de téléchargement.
- **Android** : Paramètres → Système → Synthèse vocale → moteur Google →
  installer les données vocales françaises de haute qualité.

Cela ne donne pas un comédien, mais cela dit si le problème vient de « la
synthèse » ou de « la mauvaise synthèse ».

### Les vraies voix (ElevenLabs)

Pour des voix de comédiens, il n'y a pas d'échappatoire : il faut une synthèse
neuronale en ligne. L'application sait utiliser **ElevenLabs**.

|  | Voix de l'appareil | Vraies voix |
|---|---|---|
| Qualité | synthèse, mécanique | comédiens, expressive |
| Coût | gratuit | facturé au caractère lu |
| Réseau | aucun | obligatoire |
| Vie privée | **rien ne sort du téléphone** | le texte des pages est envoyé à ElevenLabs |

Mise en route : Réglages → **« ✨ Mettre de vraies voix »** (ou le même bouton
depuis l'écran 🎭). On colle une clé, et c'est tout : l'application charge les
voix du compte, les attribue aux personnages d'après leurs étiquettes (genre,
âge, description — un ogre hérite d'une voix grave et rauque, une mamie d'une
voix âgée et chaude) et propose les modèles réellement ouverts sur le compte.
Chaque voix s'écoute d'un tapotement : les extraits de démonstration viennent
d'ElevenLabs et **ne consomment rien**.

Deux précautions comptent, parce qu'elles touchent au portefeuille :

- tout extrait généré est **gardé sur l'appareil** — relire une page déjà lue ne
  coûte plus rien ;
- deux demandes simultanées du même extrait **partagent un seul appel**, et les
  phrases suivantes sont préchargées pendant que la phrase en cours est lue (sans
  quoi chaque phrase marquerait un temps d'arrêt).

Ordre de grandeur : une page de livre jeunesse fait 500 à 1500 caractères. La
facturation étant au caractère, une soirée de lecture se compte en quelques
milliers — vérifie le tarif courant sur le site d'ElevenLabs.

> La clé est stockée dans le navigateur de l'appareil et n'est envoyée qu'à
> ElevenLabs. Comme toute clé conservée côté navigateur, elle est lisible par
> quiconque a accès au téléphone déverrouillé ou à ses outils de développement :
> utilise une clé dédiée, limitée à la synthèse vocale, et révocable.

> ElevenLabs permet aussi de **cloner une voix** à partir de quelques minutes
> d'enregistrement. Une voix clonée apparaît dans la liste comme les autres :
> l'application peut donc lire les histoires avec la voix d'un parent ou d'un
> grand-parent.

## Installer sur le téléphone

L'application doit être servie en **https** (la caméra n'est accessible que
depuis une origine sécurisée). Une fois l'adresse ouverte :

- **iPhone / iPad** — Safari → bouton Partager → « Sur l'écran d'accueil ».
- **Android** — Chrome → menu ⋮ → « Installer l'application ».

Puis, dans Réglages → Hors-ligne → **« Préparer le mode hors-ligne »** : cela
télécharge une fois pour toutes le moteur de reconnaissance et le modèle
français (une dizaine de mégaoctets). Ensuite, tout fonctionne sans connexion.

## Mettre en ligne

C'est un site statique : aucun serveur, aucune compilation.

| Hébergeur | Marche à suivre |
|---|---|
| **Vercel** | Importer le dépôt, framework « Other », aucune commande de build, dossier racine `.` |
| **Netlify** | Glisser-déposer le dossier, ou connecter le dépôt sans build |
| **GitHub Pages** | Settings → Pages → servir la branche depuis `/` |
| **Serveur perso** | Copier le dossier derrière n'importe quel serveur web en https |

Seule contrainte : servir les fichiers tels quels, sans réécrire les chemins.

## Développer en local

```sh
npm start     # http://localhost:4321 — la caméra marche sur localhost
npm test      # les tests du moteur de texte et de dialogues
```

Aucune dépendance à installer : `npm start` et `npm test` n'utilisent que Node.
Les seuls fichiers tiers sont dans `vendor/`, recopiés depuis npm (voir
[`vendor/README.md`](vendor/README.md)).

## Ce que ça sait faire, et ce que ça rate

Une application honnête sur ses limites vaut mieux qu'une surprise au coucher.

**Ça marche bien** sur du texte imprimé ordinaire, bien éclairé, page à plat :
romans premières lectures, albums au texte classique, documentaires jeunesse.

**Ça peine** sur :

- les **polices fantaisie** (lettres dessinées, manuscrites, ombrées) — c'est la
  limite de la reconnaissance de caractères, pas un réglage à trouver ;
- le **texte posé sur l'illustration**, surtout en couleurs claires ; essaie de
  désactiver « Nettoyer la photo » dans les réglages, cela aide parfois ;
- les **pages très bombées** près de la reliure ;
- les **bulles de bande dessinée**, lues dans un ordre incertain.

**La détection automatique de page** suppose que le téléphone s'immobilise une
demi-seconde au-dessus d'une page écrite. Dans une voiture qui roule ou dans les
mains d'un enfant de trois ans, elle hésitera ; c'est à cela que sert le bouton
de secours.

**L'attribution des répliques est une heuristique**, pas une compréhension du
récit. Elle vise juste la plupart du temps grâce aux incises (« dit le loup »),
aux pronoms et à l'alternance des tirets ; elle se trompe sur les dialogues à
trois personnages ou sans aucune indication. D'où l'écran de relecture : un
tapotement sur une réplique change celui qui la dit.

**Le surlignage mot à mot** dépend du navigateur (événement `boundary` de la
synthèse vocale). Là où il manque, la phrase entière reste surlignée — la
lecture, elle, fonctionne partout.

**Les voix de l'appareil restent de la synthèse.** Jouer sur la hauteur et le
débit distingue nettement les personnages, mais ne fabrique pas un comédien —
et les voix compactes installées par défaut sonnent franchement robotiques.
C'est une limite de la synthèse embarquée, pas un réglage à trouver : les voix
améliorées du téléphone puis, si cela ne suffit pas, les vraies voix en ligne
sont les deux seules réponses. S'il n'y a aucune voix française installée,
l'application le dit au lieu de rester muette.

## Vie privée

En mode normal, **rien ne quitte l'appareil** : la photo, le texte reconnu, les
pages rangées dans la bibliothèque et les réglages restent dans le navigateur
(IndexedDB et stockage local). Il n'y a ni compte, ni serveur, ni statistique.
La seule exception est le mode « voix premium », décrit plus haut, qui envoie le
texte des pages à ElevenLabs.

## Organisation du code

```
index.html              les écrans, en HTML statique
styles/app.css          toute la mise en forme
js/
  main.js               démarrage, navigation, écran d'accueil
  router.js             pile d'écrans + bouton retour d'Android
  camera.js             caméra arrière, torche, capture d'image
  live.js               netteté, mouvement, encre : quand faut-il lire ?
  live-reader.js        la boucle caméra → détection → reconnaissance → page
  imaging.js            redimensionnement et seuillage adaptatif
  ocr.js                Tesseract, en local
  text.js               nettoyage du texte OCR, découpage en phrases
  dialogue.js           découpage en répliques et « qui parle »
  casting.js            les 22 timbres et leur attribution automatique
  voices.js             voix installées sur l'appareil
  player.js             enchaînement des répliques, pause, surlignage
  premium.js            ElevenLabs : voix, modèles, cache audio, anti-doublon
  store.js              bibliothèque locale (IndexedDB)
  state.js              la page en cours de lecture
  screens/              un module par écran
tests/                  tests du moteur de texte et de dialogues
vendor/                 Tesseract et le modèle français, recopiés depuis npm
```

Les deux modules qui décident de la qualité du résultat — `text.js` et
`dialogue.js` — ne dépendent pas du navigateur et sont couverts par les tests :
c'est là qu'il faut aller pour améliorer la détection.

## Licence

Code de l'application : usage personnel et familial libre.
Fichiers de `vendor/` : Apache-2.0, voir [`vendor/README.md`](vendor/README.md).
