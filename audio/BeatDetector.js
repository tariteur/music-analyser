export default class BeatDetector {
  constructor({
    historySize = 200,
    minIntervalMs = 50,
    sensitivity = 4,
    minFluxRatio = 2.0,
    peakWindow = 8,
    energyFloor = 0.002
  } = {}) {
    this.historySize = historySize;
    this.minIntervalMs = minIntervalMs;
    this.sensitivity = sensitivity;
    this.minFluxRatio = minFluxRatio;
    this.peakWindow = peakWindow;
    this.energyFloor = energyFloor;

    this.prev = null;
    this.history = [];
    this.lastBeat = 0;
  }

  reset() {
    this.prev = null;
    this.history = [];
    this.lastBeat = 0;
  }

  process(freqData, now) {
    let flux = 0;

    if (this.prev) {
      for (let i = 0; i < freqData.length; i++) {
        const d = freqData[i] - this.prev[i];
        if (d > 0) flux += d;
      }
    }

    this.prev = new Float32Array(freqData);

    // normalisation plus stable
    flux = flux / (freqData.length * 100);

    this.history.push(flux);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    const len = this.history.length;
    if (len < this.peakWindow * 2 + 1) {
      return { beat: false, flux };
    }

    // moyenne mobile robuste
    let sum = 0;
    for (let i = 0; i < len; i++) sum += this.history[i];
    const avg = sum / len;

    // variance
    let variance = 0;
    for (let i = 0; i < len; i++) {
      const d = this.history[i] - avg;
      variance += d * d;
    }
    const std = Math.sqrt(variance / len);

    const dynamicThreshold = avg + std * this.sensitivity;
    const ratio = flux / (avg + 1e-6);

    const isPeak = this.isLocalPeak();

    // ===== FILTRE IMPORTANT =====
    const strongBeat =
      flux > dynamicThreshold &&
      ratio > this.minFluxRatio &&
      flux > this.energyFloor &&
      isPeak;

    const cooldownOk = now - this.lastBeat > this.minIntervalMs;

    if (strongBeat && cooldownOk) {
      this.lastBeat = now;
      return { beat: true, flux };
    }

    return { beat: false, flux };
  }

  isLocalPeak() {
    const h = this.history;
    const i = h.length - 1;
    const current = h[i];

    for (let j = i - this.peakWindow; j < i; j++) {
      if (j < 0) continue;
      if (h[j] >= current) return false;
    }

    return true;
  }
}