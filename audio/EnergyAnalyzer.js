export default class EnergyAnalyzer {
  constructor({
    fastTauMs = 100,
    slowTauMs = 4500,
    noiseTauMs = 12000,

    startRatio = 150,
    holdRatio = 230,

    beatDropRatio = 0.92,
    minHoldMs = 180,
    cooldownMs = 300,

    minPower = 1e-8
  } = {}) {
    this.fastTauMs = fastTauMs;
    this.slowTauMs = slowTauMs;
    this.noiseTauMs = noiseTauMs;

    this.startRatio = startRatio;
    this.holdRatio = holdRatio;
    this.beatDropRatio = beatDropRatio;

    this.minHoldMs = minHoldMs;
    this.cooldownMs = cooldownMs;

    this.minPower = minPower;

    this.reset();
  }

  reset() {
    this.fastEma = 0;
    this.slowEma = 0;
    this.noiseFloor = 0;

    this.lastTime = null;

    this.isDrop = false;

    this.lastTriggerTime = -Infinity;
    this.dropStart = null;
  }

  _now() {
    return (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();
  }

  _alpha(dt, tau) {
    const t = Math.max(1, tau);
    return 1 - Math.exp(-dt / t);
  }

  analyze(avgMag, isSilent = false) {
    const now = this._now();

    if (avgMag == null || !Number.isFinite(avgMag) || avgMag < 0) {
      return { isDrop: this.isDrop, ratio: 100 };
    }

    const power = avgMag * avgMag;

    if (this.lastTime === null) {
      this.lastTime = now;
      this.fastEma = power;
      this.slowEma = power;
      this.noiseFloor = power;
      return { isDrop: false, ratio: 100 };
    }

    const dt = Math.max(1, now - this.lastTime);
    this.lastTime = now;

    const aFast = this._alpha(dt, this.fastTauMs);
    const aSlow = this._alpha(dt, this.slowTauMs);
    const aNoise = this._alpha(dt, this.noiseTauMs);

    this.fastEma += aFast * (power - this.fastEma);
    this.slowEma += aSlow * (power - this.slowEma);

    const noiseInput = Math.min(power, this.slowEma);
    this.noiseFloor += aNoise * (noiseInput - this.noiseFloor);

    const baseline = Math.max(this.slowEma, this.noiseFloor, this.minPower);

    // 🔥 clamp visuel ici
    const ratioRaw = (this.fastEma / baseline) * 100;
    const ratio = Math.min(300, Math.max(0, ratioRaw));

    const momentum = this.fastEma - (this.lastFast ?? this.fastEma);
    this.lastFast = this.fastEma;

    if (isSilent) {
      this.isDrop = false;
      this.dropStart = null;
      return { isDrop: false, ratio };
    }

    // HOLD PRIORITAIRE
    if (ratio >= this.holdRatio) {
      this.isDrop = true;
      this.dropStart = now;
      this.lastTriggerTime = now;
      return { isDrop: true, ratio };
    }

    const beatLike = ratio >= this.startRatio;
    const beatFall = ratio < this.startRatio * this.beatDropRatio;

    if (!this.isDrop) {
      if (now - this.lastTriggerTime < this.cooldownMs) {
        return { isDrop: false, ratio };
      }

      if (beatLike && momentum > 0) {
        this.isDrop = true;
        this.dropStart = now;
        this.lastTriggerTime = now;
      }

      return { isDrop: this.isDrop, ratio };
    }

    const heldLongEnough = (now - this.dropStart) >= this.minHoldMs;

    if (heldLongEnough && beatFall) {
      this.isDrop = false;
      this.dropStart = null;
    }

    return { isDrop: this.isDrop, ratio };
  }
}