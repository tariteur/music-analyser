import AudioUtils from "./AudioUtils.js";
import PatternTracker from "./PatternTracker.js";

export default class NoteTracker {
  constructor() {
    this.history = [];
    this.tonalityHistory = [];
    this.fixedSlots = [null, null, null];
    this.patterns = new PatternTracker();
    this._prevNote = null;
    this._prevTime = null;
  }

  reset() {
    this.history = []; this.tonalityHistory = []; this.fixedSlots = [null, null, null];
    this.patterns.reset(); this._prevNote = null; this._prevTime = null;
  }

  // Renvoie la note + l'evenement rythmique (avec confiance) si c'est un onset.
  addFromPeak(now, peakHz) {
    if (!peakHz || peakHz <= 0) return null;
    const n = Math.round(12 * Math.log2(peakHz / 440) + 69);
    const noteName = AudioUtils.noteNames[(n % 12 + 12) % 12];
    const fullName = noteName + (Math.floor(n / 12) - 1);

    this.history.push({ name: fullName, time: now, num: n });
    this.tonalityHistory.push({ t: now, pc: noteName });

    // detection d'onset : note tenue a 60 fps -> un seul onset
    const isNewOnset = this._prevNote == null || fullName !== this._prevNote ||
      (now - this._prevTime) > this.patterns.onsetGap;
    this._prevNote = fullName; this._prevTime = now;

    let rhythm = null;
    if (isNewOnset) rhythm = this.patterns.feedOnset(now, fullName);

    return {
      name: fullName, num: n, pc: noteName, onset: isNewOnset,
      event: rhythm,                                   // { id, status, confidence, ... } ou null
      confidence: rhythm ? rhythm.confidence : null,   // a afficher a droite de la note
      accepted: rhythm ? rhythm.status === "confirmed" : false,
    };
  }

  // A appeler chaque frame d'affichage : renvoie comblages / confirmations / retraits.
  tick(now = performance.now()) {
    return this.patterns.reconcile(now);
  }

  getRhythm(minConf) { return this.patterns.getPatterns(minConf); }

  prune(now) {
    this.history = this.history.filter(v => now - v.time < 8000);
    this.tonalityHistory = this.tonalityHistory.filter(v => now - v.t <= 30000);
  }

  getTop3() {
    const count = {};
    for (const v of this.history) count[v.name] = (count[v.name] || 0) + 1;
    for (let i = 0; i < 3; i++) {
      if (this.fixedSlots[i]) {
        const c = count[this.fixedSlots[i].n] || 0;
        if (c === 0) this.fixedSlots[i] = null; else this.fixedSlots[i].count = c;
      }
    }
    const candidates = Object.entries(count).sort((a, b) => b[1] - a[1])
      .map(([name, freq]) => { const ref = this.history.find(v => v.name === name); return { n: name, num: ref?.num ?? null, count: freq }; });
    const THRESHOLD = 15;
    for (const candidate of candidates) {
      if (this.fixedSlots.some(s => s && s.n === candidate.n)) continue;
      const empty = this.fixedSlots.indexOf(null);
      if (empty !== -1) { this.fixedSlots[empty] = candidate; continue; }
      let wi = 0, wc = this.fixedSlots[0].count;
      for (let i = 1; i < 3; i++) if (this.fixedSlots[i].count < wc) { wc = this.fixedSlots[i].count; wi = i; }
      if (candidate.count >= wc + THRESHOLD) this.fixedSlots[wi] = candidate;
    }
    const conf = this.patterns.currentConfidence();
    return this.fixedSlots.filter(s => s !== null).map(s => ({ n: s.n, num: s.num, confidence: conf }));
  }

  computeStableKey(now = performance.now()) {
    const entries = this.tonalityHistory;
    if (entries.length < 12) return { confident: false, key: null, confidence: 0 };
    const weights = {}; let total = 0;
    for (const item of entries) {
      const age = now - item.t; const w = Math.max(0, 1 - (age / 30000));
      if (w <= 0) continue; weights[item.pc] = (weights[item.pc] || 0) + w; total += w;
    }
    if (total <= 0) return { confident: false, key: null, confidence: 0 };
    const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const [bestKey, bestWeight] = ranked[0] || [null, 0];
    const secondWeight = ranked[1]?.[1] || 0;
    const bestPct = (bestWeight / total) * 100;
    const gapPct = ((bestWeight - secondWeight) / total) * 100;
    return { confident: bestPct >= 60 && gapPct >= 15, key: bestKey, confidence: Math.round(bestPct) };
  }
}
