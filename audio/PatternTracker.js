// PatternTracker.js  (v2.1 — grille a temps absolu + auto-completion + nettoyage)
// -----------------------------------------------------------------------------
// Chaque piste etablie devient une GRILLE a phase : creneaux = phaseRef + k*interval.
// Les motifs etablis sont matches sur le TEMPS ABSOLU du creneau (pas sur l'IOI
// depuis la note precedente) -> une note parasite intercalee ne casse plus la chaine.
//   - COMBLER   un creneau predit mais vide  -> note "filled" (fantome)
//   - RETIRER   une note pending dont la piste n'a jamais pris -> "artifact"
//   - CONFIRMER une note pending quand sa piste franchit le seuil
// Chaque piste garde un historique ; chaque note a un id stable.
//   event = { id, status, time, confidence, trackId, label, slot, fills? }
//   status : "pending" | "confirmed" | "filled" | "artifact" | "rejected"
//   feedOnset(now,label?) -> event ;  reconcile(now) -> [event,...]
// -----------------------------------------------------------------------------
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export default class PatternTracker {
  constructor(opts = {}) {
    this.minInterval = opts.minInterval ?? 45;
    this.maxInterval = opts.maxInterval ?? 4000;
    this.onsetGap    = opts.onsetGap    ?? 35;
    this.gainPerHit   = opts.gainPerHit   ?? 14;
    this.gainDegraded = opts.gainDegraded ?? 6;
    this.fillPenalty  = opts.fillPenalty  ?? 0.5;
    this.decayBase    = opts.decayBase    ?? 0.6;
    this.emitFloor    = opts.emitFloor    ?? 22;
    this.trust        = opts.trust        ?? 50;
    this.prune        = opts.prune        ?? 4;
    this.alpha     = opts.alpha     ?? 0.22;
    this.phaseAlpha= opts.phaseAlpha?? 0.15;
    this.baseTol   = opts.baseTol   ?? 0.15;
    this.minTol    = opts.minTol    ?? 0.06;
    this.maxTol    = opts.maxTol    ?? 0.25;
    this.artifactTimeout = opts.artifactTimeout ?? 1200;
    this.maxFillRun      = opts.maxFillRun      ?? 4;
    this.histLen         = opts.histLen         ?? 24;
    this.reset();
  }
  reset() {
    this.tracks = []; this.pending = []; this.lastOnset = null;
    this._tid = 1; this._eid = 1; this.run = { trackId: null, length: 0 };
  }

  feedOnset(now, label = null) {
    if (this.lastOnset == null) { this.lastOnset = now; return this._event("rejected", now, 0, null, label, { reason: "first" }); }
    const ioi = now - this.lastOnset; this.lastOnset = now; this._decayAll(now);
    if (ioi < this.minInterval || ioi > this.maxInterval) return this._event("rejected", now, 0, null, label, { reason: "out-of-range" });

    // --- 1) MATCH GRILLE (temps absolu) sur les motifs etablis ---
    let g = null, gK = null, gErr = Infinity;
    for (const tr of this.tracks) {
      if (!tr.hasGrid || tr.confidence < this.emitFloor) continue;
      const k = Math.round((now - tr.phaseRef) / tr.interval);
      if (k <= tr.lastK) continue;                       // creneau deja consomme
      const err = Math.abs(now - (tr.phaseRef + k * tr.interval));
      if (err <= tr.interval * tr.tolerance && err < gErr) { g = tr; gK = k; gErr = err; }
    }
    if (g) {
      const fills = this._confirmOnGrid(g, now, gK, label);
      this._updateRun(g);
      const ev = this._event("confirmed", now, Math.round(g.confidence), g, label, { slot: gK });
      g.history.push({ id: ev.id, time: now, status: "confirmed" }); this._trim(g);
      ev.fills = fills; return ev;
    }

    // --- 2) MATCH CLUSTER (IOI) : alimente / cree les pistes ---
    let best = null, bestErr = Infinity, degraded = false;
    for (const tr of this.tracks) {
      const tolAbs = tr.interval * tr.tolerance;
      const eD = Math.abs(ioi - tr.interval), eX = Math.abs(ioi - 2 * tr.interval);
      if (eD <= tolAbs && eD < bestErr) { best = tr; bestErr = eD; degraded = false; }
      else if (eX <= 2 * tolAbs && eX < bestErr) { best = tr; bestErr = eX; degraded = true; }
    }
    if (best) {
      this._validateCluster(best, ioi, now, degraded, label);
      this._updateRun(best);
      const conf = Math.round(best.confidence);
      const established = best.hasGrid && best.confidence >= this.trust;
      const status = established ? "confirmed" : "pending";
      const ev = this._event(status, now, conf, best, label, { degraded });
      best.history.push({ id: ev.id, time: now, status }); this._trim(best);
      if (!established) this.pending.push({ id: ev.id, time: now, trackId: best.id, label });
      return ev;
    }

    // --- 3) nouvelle candidate (pending) ---
    const tr = this._spawn(ioi, now, label); this._updateRun(tr);
    const ev = this._event("pending", now, Math.round(tr.confidence), tr, label, { reason: "new-candidate" });
    tr.history.push({ id: ev.id, time: now, status: "pending" });
    this.pending.push({ id: ev.id, time: now, trackId: tr.id, label });
    return ev;
  }

  reconcile(now) {
    const events = []; this._decayAll(now);
    // 1) comblage des creneaux vides sur pistes etablies
    for (const tr of this.tracks) {
      if (!tr.hasGrid || tr.confidence < this.trust) continue;
      let safety = this.maxFillRun;
      let nextSlot = tr.phaseRef + (tr.lastK + 1) * tr.interval;
      while (now > nextSlot + tr.interval * tr.tolerance && safety-- > 0) {
        tr.lastK += 1;
        tr.confidence = clamp(tr.confidence - this.gainPerHit * this.fillPenalty, 0, 100);
        const ev = this._event("filled", nextSlot, Math.round(tr.confidence), tr, tr.lastLabel, { slot: tr.lastK, inferred: true });
        tr.history.push({ id: ev.id, time: nextSlot, status: "filled" }); this._trim(tr);
        events.push(ev);
        if (tr.confidence < this.trust) break;
        nextSlot += tr.interval;
      }
    }
    // 2) resolution des pending : confirmes ou artefacts
    const still = [];
    for (const p of this.pending) {
      const tr = this.tracks.find(t => t.id === p.trackId);
      if (!tr) { events.push(this._event("artifact", p.time, 0, null, p.label, { id: p.id, remove: true })); continue; }
      if (tr.confidence >= this.emitFloor) { events.push(this._event("confirmed", p.time, Math.round(tr.confidence), tr, p.label, { id: p.id })); continue; }
      if (now - p.time > this.artifactTimeout) { events.push(this._event("artifact", p.time, 0, tr, p.label, { id: p.id, remove: true })); continue; }
      still.push(p);
    }
    this.pending = still;
    this.tracks = this.tracks.filter(tr => tr.confidence >= this.prune);
    return events;
  }

  _spawn(ioi, now, label) {
    const tr = { id: this._tid++, interval: ioi, tolerance: this.baseTol, spread: this.baseTol, hits: 1,
      confidence: this.gainPerHit * 0.6, created: now, lastSeen: now, lastUpdate: now, motif: "forming",
      hasGrid: false, phaseRef: now, lastK: 0, lastLabel: label, history: [] };
    this.tracks.push(tr); return tr;
  }

  _validateCluster(tr, ioi, now, degraded, label) {
    const unit = degraded ? ioi / 2 : ioi;
    tr.interval = tr.interval * (1 - this.alpha) + unit * this.alpha;
    const dev = Math.abs(unit - tr.interval) / tr.interval;
    tr.spread = tr.spread * (1 - this.alpha) + dev * this.alpha;
    tr.tolerance = clamp(2.5 * tr.spread, this.minTol, this.maxTol);
    tr.hits++; tr.lastSeen = now; tr.lastLabel = label ?? tr.lastLabel;
    tr.confidence = clamp(tr.confidence + (degraded ? this.gainDegraded : this.gainPerHit), 0, 100);
    if (!tr.hasGrid && tr.confidence >= this.trust) { tr.hasGrid = true; tr.phaseRef = now; tr.lastK = 0; }
  }

  // confirme une note sur la grille au creneau k, comble les trous lastK+1..k-1
  _confirmOnGrid(tr, now, k, label) {
    const fills = [];
    const gap = k - tr.lastK - 1;
    if (gap > 0 && gap <= this.maxFillRun) {
      for (let s = tr.lastK + 1; s < k; s++) {
        const slotTime = tr.phaseRef + s * tr.interval;
        const ev = this._event("filled", slotTime, Math.round(tr.confidence), tr, tr.lastLabel, { slot: s, inferred: true });
        tr.history.push({ id: ev.id, time: slotTime, status: "filled" }); fills.push(ev);
      }
    }
    const err = now - (tr.phaseRef + k * tr.interval);
    tr.phaseRef += this.phaseAlpha * err;            // suivi de derive
    const relErr = Math.abs(err) / tr.interval;
    tr.spread = tr.spread * (1 - this.alpha) + relErr * this.alpha;
    tr.tolerance = clamp(2.5 * tr.spread, this.minTol, this.maxTol);
    tr.lastK = k; tr.hits++; tr.lastSeen = now; tr.lastLabel = label ?? tr.lastLabel;
    tr.confidence = clamp(tr.confidence + this.gainPerHit, 0, 100);
    return fills;
  }

  _decayAll(now) {
    for (const tr of this.tracks) {
      const dt = (now - tr.lastUpdate) / 1000;
      if (dt > 0) { tr.confidence *= Math.pow(this.decayBase, dt); tr.lastUpdate = now; }
    }
  }
  _updateRun(tr) {
    if (this.run.trackId === tr.id) this.run.length++; else this.run = { trackId: tr.id, length: 1 };
    tr.motif = this.run.length >= 2 ? "confirmed" : "forming";
  }
  _trim(tr) { if (tr.history.length > this.histLen) tr.history.splice(0, tr.history.length - this.histLen); }
  _event(status, time, confidence, tr, label, extra = {}) {
    return { id: extra.id ?? this._eid++, status, time, confidence, trackId: tr ? tr.id : null,
      label: label ?? null, interval: tr ? Math.round(tr.interval) : null, bpm: tr ? Math.round(60000 / tr.interval) : null, ...extra };
  }
  getPatterns(minConf = this.emitFloor) {
    return this.tracks.filter(t => t.confidence >= minConf).sort((a, b) => a.interval - b.interval)
      .map((t, i) => ({ label: i === 0 ? "t1" : i === 1 ? "t2" : `t${i + 1}`, interval: Math.round(t.interval),
        bpm: Math.round(60000 / t.interval), tolerancePct: +(t.tolerance * 100).toFixed(1), confidence: Math.round(t.confidence),
        established: t.confidence >= this.trust, gridded: t.hasGrid, hits: t.hits, motif: t.motif, history: t.history.slice(-8) }));
  }
  currentConfidence() { return this.tracks.length ? Math.round(Math.max(...this.tracks.map(t => t.confidence))) : 0; }
}
