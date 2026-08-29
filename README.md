# BPM-Finder-To-MIDI

Ce projet est une application de bureau basée sur [Electron](https://www.electronjs.org/).  

Passionné par la lumière et DJ, je voulais proposer une prestation la plus interactive possible avec la musique — comme si un véritable light-jockey gérait le show en direct.
Ne trouvant pas mon bonheur parmi les solutions existantes comme Lightjams ou d'autres logiciels spécialisés dans la synchronisation lumière/son, j'ai décidé d'en créer une interface de comunication sur mesure pour les bidouilleurs et passionnér.

L'application automatise à 99% le contrôle de logiciels DMX (comme QLC+) via des signaux MIDI, en s'inspirant du fonctionnement d'un Wolfmix sous forme de logiciel PC.

Fonctionnalités principales :
  - Conversion son en couleur : Un algorithme dédié analyse le signal audio pour le convertir directement en palettes de couleurs (primaire et secondaire) appliquées aux projecteurs.
  - Analyse audio et IA : Détecte en temps réel le style musical (Reggae, Electro, etc.), le BPM, les beats, l'énergie, le RMS et la tonalité du morceau.
  - Programmation en JavaScript : L'utilisateur écrit la logique de commande dans un éditeur JS intégré. Les données de l'IA et de l'analyseur audio sont directement accessibles via des fonctions et variables globales (audio.beat, audio.theme, audio.primaryColor, etc.).
  - Envoi MIDI automatique : Génère les notes et valeurs de vélocité MIDI configurées dans le script pour piloter les lyres, PARs et chasers.
  - Mode Prestation : Affiche une console de logs en direct avec le suivi des signaux MIDI envoyés, l'état des boucles et les paramètres audio calculés.
---

<img width="1919" height="935" alt="musique analyser" src="https://github.com/user-attachments/assets/2385a143-3e64-4762-88aa-15a7af8e4752" />
<img width="1919" height="1023" alt="image" src="https://github.com/user-attachments/assets/0648724f-b59c-4acd-ad2a-d4c6c7349358" />

IA local credit a @xenova/transformers (Hugging Face / Transformers.js)
<img width="631" height="23" alt="image" src="https://github.com/user-attachments/assets/cafa7432-c364-44bd-aad5-26715a8eaccb" />

## Téléchargement

Téléchargez l'application prête à l'emploi pour **Windows** :

[![Télécharger pour Windows](https://img.shields.io/badge/Télécharger-Windows-brightgreen)](https://github.com/tariteur/music-analyser/releases/download/1.0.1/Musique.analyser.Setup.1.0.1.exe)

Si vous souhaitez compiler manuellement avec le code source :  

[![Code source](https://img.shields.io/badge/Code%20source-GitHub-blue)](https://github.com/tariteur/music-analyser)

---

## Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- [Node.js](https://nodejs.org/) (version 16 ou supérieure recommandée)
- [LoopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) (nécessaire pour la gestion MIDI)

> ⚠️ **Important :** LoopMIDI doit être lancé **en même temps que l'application** pour que la communication MIDI fonctionne correctement.

---

## Installation

Installer les dépendances :  
`npm install`

Lancer en développement/test :
`npm start`

Compiler l'application en fichier exécutable (.exe) :
`npm run build`
