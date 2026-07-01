export default class BpmDetector {
  constructor(rate) {
    this.rate = rate;
    this.history = [];
    this.currentBpm = null;

    // --- Paramètres de tolérance et de stabilisation ---
    this.jitterTolerance = 2;          // Ignore les petites variations de ±2 BPM
    this.harmonicTolerance = 0.08;     // Fenêtre de tolérance de 8% autour du double/moitié
    this.pendingBpm = null;            // Stocke le BPM suspecté d'être un saut harmonique
    this.harmonicConfirmationCount = 0; // Compteur de frames stables pour valider le saut
    this.requiredConfirmations = 5;    // Nombre de détections requises avant d'accepter le saut
  }

  reset() {
    this.history = [];
    this.currentBpm = null;
    this.pendingBpm = null;
    this.harmonicConfirmationCount = 0;
  }

  process(fFloat, analyser, currentTime, tempoFn, harmonicsFn) {
    const mag = new Float32Array(fFloat.length);
    let flux = 0;

    for (let i = 0; i < fFloat.length; i++) {
      mag[i] = Math.pow(10, fFloat[i] / 20);
      flux += Math.max(0, mag[i] - (this.prevMag?.[i] ?? 0));
    }

    flux /= fFloat.length;
    this.history.push(flux);

    if (this.history.length > this.rate * 8) this.history.shift();

    const result = {
      bpm: null,
      changed: false
    };

    if (this.history.length > this.rate * 2) {
      const tBpm = tempoFn(this.history, this.rate);
      if (tBpm) {
        // Utilisation de la méthode interne "harmonics" mise à jour
        let bpm = Math.round(this.harmonics(tBpm));

        // --- Logique anti-clignotement (Hystérésis) ---
        if (this.currentBpm !== null) {
          const ratio = bpm / this.currentBpm;
          const isClose = Math.abs(bpm - this.currentBpm) <= this.jitterTolerance;
          const isHarmonicJump = Math.abs(ratio - 0.5) <= this.harmonicTolerance || Math.abs(ratio - 2.0) <= this.harmonicTolerance;

          if (isClose) {
            bpm = this.currentBpm;
            this.harmonicConfirmationCount = 0;
            this.pendingBpm = null;
          } else if (isHarmonicJump) {
            if (bpm === this.pendingBpm) {
              this.harmonicConfirmationCount++;
            } else {
              this.pendingBpm = bpm;
              this.harmonicConfirmationCount = 1;
            }

            if (this.harmonicConfirmationCount >= this.requiredConfirmations) {
              this.currentBpm = bpm;
              this.harmonicConfirmationCount = 0;
              this.pendingBpm = null;
            } else {
              bpm = this.currentBpm;
            }
          } else {
            this.harmonicConfirmationCount = 0;
            this.pendingBpm = null;
          }
        }
        // -----------------------------------------------

        result.bpm = bpm;

        if (this.currentBpm !== bpm) {
          this.currentBpm = bpm;
          result.changed = true;
        }
      }
    }

    this.prevMag = mag;
    return result;
  }

  tempo(e, r) {
    const N = e.length;
    const m = e.reduce((a, b) => a + b, 0) / N;
    const x = e.map(v => v - m);
    let best = 0;
    let lag = 0;

    for (let l = 10; l < r * 60 / 40; l++) {
      let s = 0;
      for (let i = 0; i + l < N; i++) s += x[i] * x[i + l];
      if (s > best) {
        best = s;
        lag = l;
      }
    }

    return lag ? 60 * r / lag : null;
  }

  harmonics(b) {
    // AJUSTEMENT : On remonte le plancher minimal. 
    // Si la musique est majoritairement au-dessus de 80-90 BPM, on force le doublement.
    // Idéal pour éviter qu'un morceau à 130 BPM soit détecté à 65 BPM.
    while (b < 85) { 
      b *= 2;
    }
    while (b > 170) { 
      b /= 2;
    }
    return b;
  }
}