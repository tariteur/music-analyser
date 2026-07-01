export default class RMSMeter {
  constructor(windowMs = 1000) {
    this.windowMs = windowMs;

    this.sumSquares = 0;
    this.count = 0;

    this.buffer = [];

    this.lastInstant = 0;
  }

  push(value, now = performance.now()) {
    const v = value;
    const squared = v * v;

    // 🔴 instantané brut (0 → 1 direct)
    this.lastInstant = v;

    this.buffer.push({ squared, time: now });
    this.sumSquares += squared;
    this.count++;

    while (
      this.buffer.length &&
      now - this.buffer[0].time > this.windowMs
    ) {
      const old = this.buffer.shift();
      this.sumSquares -= old.squared;
      this.count--;
    }
  }

  // RMS 1 seconde
  getRMS() {
    if (this.count === 0) return 0;
    return Math.sqrt(this.sumSquares / this.count);
  }

  // niveau moyen (UI)
  getLevel() {
    const rms = Math.min(this.getRMS() * 3.5, 1);
    
    // seuil : si puissance moyenne trop faible -> 0
    if (rms < 0.05) return 0;
    
    return rms;
  }
  
  // 🔴 PUISSANCE INSTANTANÉE (direct live)
  getInstant() {
    const rmsInstant = Math.min(Math.abs(this.lastInstant) * 3.5, 1);
  
    // seuil : si signal trop faible -> 0
    if (rmsInstant < 0.05) return 0;
  
    return rmsInstant;
  }

  // compat ancien code (ne casse rien)
  get() {
    return this.getLevel();
  }

  reset() {
    this.sumSquares = 0;
    this.count = 0;
    this.buffer = [];
    this.lastInstant = 0;
  }
}