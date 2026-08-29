const BASIC_COLORS = [
  { name: "Rouge", hue: 0, hex: "#ef4444" },
  { name: "Orange", hue: 30, hex: "#f97316" },
  { name: "Jaune", hue: 60, hex: "#eab308" },
  { name: "Vert", hue: 120, hex: "#22c55e" },
  { name: "Cyan", hue: 180, hex: "#06b6d4" },
  { name: "Bleu", hue: 240, hex: "#3b82f6" },
  { name: "Rose / Violet", hue: 300, hex: "#d946ef" },
  { name: "Rouge", hue: 360, hex: "#ef4444" }
];

export default class AudioColor {
  constructor(options = {}) {
    // Paramètres de lissage
    this.historySize = options.historySize ?? 900; // ~15s à 60fps

    // Réglages de stabilité et d'impact (Mode Normal)
    this.minHoldNormal = options.minHoldNormal ?? 10000; // 10s de blocage minimum
    this.toleranceNormal = options.toleranceNormal ?? 120; // 2s (120 frames) pour valider un changement lent

    // Réglages de stabilité et d'impact (Mode Rapide)
    this.minHoldFast = options.minHoldFast ?? 2000; // 2s minimum avant un cut rapide
    this.toleranceFast = options.toleranceFast ?? 10; // 1/6s pour changer quasi-instantanément
    this.hueDiffThreshold = options.hueDiffThreshold ?? 90; // Différence requise pour un "Impact" (90°)

    this.onColor = options.onColor ?? null;

    this.reset();
  }

  reset() {
    this.bassHistory = [];
    this.midHistory = [];
    this.trebleHistory = [];

    this.lastColorChangeTime = 0;
    this.activePrimaryColor = null;
    this.candidateColorHex = null;
    this.candidateFrames = 0;

    this.currentColor = {
      primary: { name: "Aucune", hue: 0, hex: "#334155" },
      secondary: { name: "Aucune", hue: 0, hex: "#334155" }
    };
  }

  getClosestBasicColor(targetHue) {
    let minDiff = Infinity;
    let closest = BASIC_COLORS[0];
    for (let c of BASIC_COLORS) {
      let diff = Math.min(Math.abs(c.hue - targetHue), 360 - Math.abs(c.hue - targetHue));
      if (diff < minDiff) {
        minDiff = diff;
        closest = c;
      }
    }
    return closest;
  }

  applyColors(primary, secondary, now) {
    this.activePrimaryColor = primary;
    this.lastColorChangeTime = now;
    this.candidateFrames = 0;

    this.currentColor = {
      primary: primary,
      secondary: secondary
    };

    if (this.onColor) {
      this.onColor(this.currentColor.primary, this.currentColor.secondary);
    }
  }

  /**
   * Process à appeler à chaque frame dans loop() de AudioAPI
   * @param {Uint8Array} freqData - this.f8 (ByteFrequencyData)
   * @param {number} sampleRate - this.A.sampleRate
   * @param {number} fftSize - this.C.fftSize
   * @param {number} now - performance.now()
   * @returns {Object} { primary, secondary }
   */
  process(freqData, sampleRate, fftSize, now) {
    const binSize = sampleRate / fftSize;

    let bassSum = 0, bassCount = 0;
    let midSum = 0, midCount = 0;
    let trebleSum = 0, trebleCount = 0;

    // Analyse par bandes de fréquences
    for (let i = 0; i < freqData.length; i++) {
      const freq = i * binSize;
      if (freq >= 20 && freq < 250) {
        bassSum += freqData[i];
        bassCount++;
      } else if (freq >= 250 && freq < 4000) {
        midSum += freqData[i];
        midCount++;
      } else if (freq >= 4000 && freq <= 20000) {
        trebleSum += freqData[i];
        trebleCount++;
      }
    }

    // Pondération des fréquences pour correspondre au code source d'origine
    const rawBass = (bassCount ? bassSum / bassCount : 0) * 1.0;
    const rawMid = (midCount ? midSum / midCount : 0) * 1.8;
    const rawTreble = (trebleCount ? trebleSum / trebleCount : 0) * 3.5;

    this.bassHistory.push(rawBass);
    this.midHistory.push(rawMid);
    this.trebleHistory.push(rawTreble);

    // Limitation de l'historique
    if (this.bassHistory.length > this.historySize) {
      this.bassHistory.shift();
      this.midHistory.shift();
      this.trebleHistory.shift();
    }

    // Moyenne lissée
    const smoothBass = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length;
    const smoothMid = this.midHistory.reduce((a, b) => a + b, 0) / this.midHistory.length;
    const smoothTreble = this.trebleHistory.reduce((a, b) => a + b, 0) / this.trebleHistory.length;

    const total = smoothBass + smoothMid + smoothTreble || 1;

    const percentBass = Math.round((smoothBass / total) * 100);
    const percentMid = Math.round((smoothMid / total) * 100);
    const percentTreble = Math.round((smoothTreble / total) * 100);

    return this.updateHarmony(percentBass, percentMid, percentTreble, total, now);
  }

  updateHarmony(bass, mid, treble, totalEnergy, now) {
    let targetPrimary, targetSecondary;
    let rawHue = 0, mappedHue = 0;

    // Détermination de la couleur cible
    if (totalEnergy < 1) {
      targetPrimary = { name: "Aucune", hue: 0, hex: "#334155" };
      targetSecondary = { name: "Aucune", hue: 0, hex: "#334155" };
    } else {
      // Conversion trigonométrique des pourcentages en angle (Hue)
      const x = (bass * 1) + (mid * -0.5) + (treble * -0.5);
      const y = (bass * 0) + (mid * 0.866) + (treble * -0.866);

      rawHue = Math.atan2(y, x) * (180 / Math.PI);
      if (rawHue < 0) rawHue += 360;

      // Remappage de la zone [30, 220] sur tout le spectre [0, 360]
      const minRaw = 30;
      const maxRaw = 220;
      mappedHue = ((rawHue - minRaw) / (maxRaw - minRaw)) * 360;
      
      if (mappedHue < 0) mappedHue = 0;
      if (mappedHue > 360) mappedHue = 360;

      targetPrimary = this.getClosestBasicColor(mappedHue);
      const exactCompHue = (targetPrimary.hue + 180) % 360;
      targetSecondary = this.getClosestBasicColor(exactCompHue);
    }

    // Initialisation au premier son
    if (!this.activePrimaryColor) {
      this.applyColors(targetPrimary, targetSecondary, now);
      return this.currentColor;
    }

    // Calcul de la différence de teinte (pour différencier mode Normal et Mode Rapide/Impact)
    let hueDiff = Math.abs(targetPrimary.hue - this.activePrimaryColor.hue);
    if (hueDiff > 180) hueDiff = 360 - hueDiff; // Plus court chemin

    const isHugeDifference = hueDiff >= this.hueDiffThreshold;
    const currentMinHold = isHugeDifference ? this.minHoldFast : this.minHoldNormal;
    const currentTolerance = isHugeDifference ? this.toleranceFast : this.toleranceNormal;

    // Si on pointe sur la même couleur que l'active, on réinitialise l'accumulation (candidateFrames)
    if (targetPrimary.hex === this.activePrimaryColor.hex) {
      this.candidateFrames = 0;
      return this.currentColor;
    }

    // Application des règles de changement de couleur
    if (now - this.lastColorChangeTime >= currentMinHold) {
      if (targetPrimary.hex === this.candidateColorHex) {
        this.candidateFrames++;
        if (this.candidateFrames >= currentTolerance) {
          this.applyColors(targetPrimary, targetSecondary, now);
        }
      } else {
        this.candidateColorHex = targetPrimary.hex;
        this.candidateFrames = 1;
      }
    }

    return this.currentColor;
  }
}