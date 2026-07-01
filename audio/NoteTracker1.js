import AudioUtils from "./AudioUtils.js";

export default class NoteTracker {
  constructor() {
    this.history = [];
    this.tonalityHistory = [];
    // NOUVEAU : On mémorise les 3 emplacements fixes
    this.fixedSlots = [null, null, null]; 
  }

  reset() {
    this.history = [];
    this.tonalityHistory = [];
    this.fixedSlots = [null, null, null];
  }

  addFromPeak(now, peakHz) {
    if (!peakHz || peakHz <= 0) return null;

    const n = Math.round(12 * Math.log2(peakHz / 440) + 69);
    const noteName = AudioUtils.noteNames[(n % 12 + 12) % 12];
    const fullName = noteName + (Math.floor(n / 12) - 1);

    this.history.push({ name: fullName, time: now, num: n });
    this.tonalityHistory.push({ t: now, pc: noteName });

    return { name: fullName, num: n, pc: noteName };
  }

  prune(now) {
    this.history = this.history.filter(v => now - v.time < 8000);
    this.tonalityHistory = this.tonalityHistory.filter(v => now - v.t <= 30000);
  }

  getTop3() {
    const count = {};
    for (const v of this.history) {
      count[v.name] = (count[v.name] || 0) + 1;
    }

    // 1. Mettre à jour les notes actuellement verrouillées dans nos 3 places
    for (let i = 0; i < 3; i++) {
      if (this.fixedSlots[i]) {
        const currentCount = count[this.fixedSlots[i].n] || 0;
        if (currentCount === 0) {
          // CONDITION : "ou que ya rien" -> La note n'est plus dans l'historique, on vide la place.
          this.fixedSlots[i] = null;
        } else {
          // On met à jour son score actuel
          this.fixedSlots[i].count = currentCount;
        }
      }
    }

    // 2. Extraire toutes les notes présentes, de la plus fréquente à la moins fréquente
    const candidates = Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .map(([name, freq]) => {
        const ref = this.history.find(v => v.name === name);
        return { n: name, num: ref?.num ?? null, count: freq };
      });

    // CONDITION : "seulement si c'est très élevé"
    // Règle l'écart nécessaire pour qu'une nouvelle note vole la place d'une ancienne.
    // Si tu appelles addFromPeak 60 fois par seconde, une valeur de 15 ou 20 est un bon début.
    const THRESHOLD = 15; 

    // 3. Essayer de placer les candidats dans les slots
    for (const candidate of candidates) {
      // Si la note est déjà affichée dans un de nos 3 emplacements, on n'y touche pas.
      if (this.fixedSlots.some(slot => slot && slot.n === candidate.n)) {
        continue;
      }

      // Y a-t-il un emplacement complètement vide ?
      const emptyIndex = this.fixedSlots.indexOf(null);
      if (emptyIndex !== -1) {
        this.fixedSlots[emptyIndex] = candidate; // On s'installe directement !
        continue;
      }

      // Si c'est plein, on identifie le slot actuel le plus "faible" pour le remplacer
      let weakestIndex = 0;
      let weakestCount = this.fixedSlots[0].count;
      for (let i = 1; i < 3; i++) {
        if (this.fixedSlots[i].count < weakestCount) {
          weakestCount = this.fixedSlots[i].count;
          weakestIndex = i;
        }
      }

      // Remplacement autorisé UNIQUEMENT si le candidat dépasse l'ancien d'une bonne marge (THRESHOLD)
      if (candidate.count >= weakestCount + THRESHOLD) {
        this.fixedSlots[weakestIndex] = candidate;
      }
    }

    // 4. On renvoie l'état final. 
    // J'ai retiré le `.sort()` par numéro (num) à la fin : c'est indispensable pour que
    // les notes restent visuellement DANS L'ORDRE de leurs slots sans s'inverser sans cesse.
    return this.fixedSlots
      .filter(slot => slot !== null)
      .map(slot => ({ n: slot.n, num: slot.num }));
  }

  computeStableKey(now = performance.now()) {
    const entries = this.tonalityHistory;

    if (entries.length < 12) {
      return { confident: false, key: null, confidence: 0 };
    }

    const weights = {};
    let total = 0;

    for (const item of entries) {
      const age = now - item.t;
      const w = Math.max(0, 1 - (age / 30000));
      if (w <= 0) continue;

      weights[item.pc] = (weights[item.pc] || 0) + w;
      total += w;
    }

    if (total <= 0) {
      return { confident: false, key: null, confidence: 0 };
    }

    const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const [bestKey, bestWeight] = ranked[0] || [null, 0];
    const secondWeight = ranked[1]?.[1] || 0;

    const bestPct = (bestWeight / total) * 100;
    const gapPct = ((bestWeight - secondWeight) / total) * 100;
    const confident = bestPct >= 60 && gapPct >= 15;

    return {
      confident,
      key: bestKey,
      confidence: Math.round(bestPct)
    };
  }
}