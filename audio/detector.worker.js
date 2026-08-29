import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1";

env.allowLocalModels = false;

let classifier = null;
let lastTheme = null;
let lastThemeTime = 0;
const THEME_HOLD_TIME = 2000; // garde le thème min. 2s avant de changer
const MIN_CONFIDENCE = 0.0;   // score minimal accepté (0 = pas de filtre)

async function init() {
  classifier = await pipeline(
    'audio-classification',
    'Xenova/ast-finetuned-audioset-10-10-0.4593'
  );
  self.postMessage({ type: 'ready' });
}

/* -------------------------------------------------------------------------
   Genres reconnus. Chaque entrée = { key: mots à chercher, genre: sortie }
   - key à un seul mot  -> match sur MOT ENTIER  ("rock" oui, "rapping" non)
   - key à plusieurs mots -> match sur sous-chaîne ("hip hop", "drum and bass")
   La SORTIE est capitalisée pour le cerveau Blockly (get_theme).
   L'ordre compte : le premier de la liste qui matche gagne.
   Les sous-genres (heavy metal, progressive rock...) tombent sur le genre
   de base grâce au mot-clé simple.
-------------------------------------------------------------------------- */
const GENRE_TABLE = [
  { key: "hip hop",            genre: "Hip hop" },
  { key: "hip-hop",            genre: "Hip hop" },
  { key: "drum and bass",      genre: "Electronic" },
  { key: "rhythm and blues",   genre: "Soul" },
  { key: "electronic",         genre: "Electronic" },
  { key: "techno",             genre: "Techno" },
  { key: "house",              genre: "House" },
  { key: "trance",             genre: "Trance" },
  { key: "dubstep",            genre: "Dubstep" },
  { key: "disco",              genre: "Disco" },
  { key: "ambient",            genre: "Ambient" },
  { key: "rap",                genre: "Rap" },
  { key: "metal",              genre: "Metal" },   // heavy metal, death metal... -> Metal
  { key: "punk",               genre: "Punk" },
  { key: "rock",               genre: "Rock" },    // progressive rock, rock and roll... -> Rock
  { key: "pop",                genre: "Pop" },
  { key: "jazz",               genre: "Jazz" },
  { key: "blues",              genre: "Blues" },
  { key: "classical",          genre: "Classical" },
  { key: "reggae",             genre: "Reggae" },
  { key: "country",            genre: "Country" },
  { key: "folk",               genre: "Folk" },
  { key: "soul",               genre: "Soul" },
  { key: "funk",               genre: "Funk" },
  { key: "indie",              genre: "Indie" },
  { key: "gospel",             genre: "Gospel" },
];

// Renvoie le genre normalisé (capitalisé) trouvé dans le label, ou null
function labelToGenre(label) {
  const clean = label.toLowerCase();
  const words = clean.split(/[\s\-]+/);
  for (const { key, genre } of GENRE_TABLE) {
    if (key.includes(" ")) {
      // genre composé -> sous-chaîne
      if (clean.includes(key)) return genre;
    } else {
      // mot simple -> mot entier uniquement
      if (words.includes(key)) return genre;
    }
  }
  return null;
}

self.onmessage = async (e) => {
  if (e.data.type === 'init') {
    await init();
    return;
  }

  if (e.data.type !== 'analyze') return;

  if (!classifier) {
    self.postMessage({ type: 'error', message: 'classifier pas initialisé' });
    return;
  }

  const audioData = e.data.audioData; // Float32Array mono @ 16kHz
  const results = await classifier(audioData, { topk: 20 });

  // Log de contrôle : voir tout ce que l'IA propose, dans l'ordre
  console.log("Résultats IA (ordre décroissant) :");
  results.forEach((item, i) => {
    const g = labelToGenre(item.label);
    console.log(
      `  ${i}: ${item.label} (${(item.score * 100).toFixed(1)}%) ` +
      (g ? `✅ -> ${g}` : "❌ ignoré")
    );
  });

  // Traverse les résultats du + confiant au - confiant,
  // s'arrête au 1er label qui correspond à un genre de la table
  let bestGenre = null;
  let bestScore = 0;
  for (const item of results) {
    const g = labelToGenre(item.label);
    if (g && item.score >= MIN_CONFIDENCE) {
      bestGenre = g;
      bestScore = item.score;
      break;
    }
  }

  if (bestGenre === null) {
    console.log("❌ Aucun genre valide trouvé");
    self.postMessage({ type: 'result', theme: lastTheme, score: 0 });
    return;
  }

  // Hold : évite les changements de thème trop rapides
  const now = Date.now();
  if (bestGenre !== lastTheme) {
    if (now - lastThemeTime > THEME_HOLD_TIME) {
      lastTheme = bestGenre;
      lastThemeTime = now;
      console.log(`✓✓ NOUVEAU THÈME: ${bestGenre} (${(bestScore * 100).toFixed(0)}%)`);
    } else {
      console.log(`⏱ Hold: reste sur ${lastTheme}`);
      self.postMessage({ type: 'result', theme: lastTheme, score: bestScore });
      return;
    }
  } else {
    lastThemeTime = now;
  }

  self.postMessage({
    type: 'result',
    theme: bestGenre,
    score: bestScore,
  });
};