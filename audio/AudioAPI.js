import AudioState from "./AudioState.js";
import AudioUtils from "./AudioUtils.js";
import NoteTracker from "./NoteTracker.js";
import BeatDetector from "./BeatDetector.js";
import BpmDetector from "./BpmDetector.js";
import RMSMeter from "./RMSMeter.js";
import EnergyAnalyzer from "./EnergyAnalyzer.js";
import ThemeDetector from "./ThemeDetector.js";

export default class AudioAPI {

  constructor(options = {}) {
    this.rate = options.rate ?? 50;
    this.hop = 1000 / this.rate;
    this.fftSize = options.fftSize ?? 2048;

    this.onFrame = options.onFrame ?? null;
    this.onBpm = options.onBpm ?? null;
    this.onTheme = options.onTheme ?? null;
    this.onStop = options.onStop ?? null;

    this.A = null;
    this.C = null;
    this.src = null;
    this.stream = null;
    this.timerBpm = null;
    this.rafId = null;
    this.running = false;

    this.f8 = null;
    this.fFloat = null;
    this.t = null;

    this.noteTracker = new NoteTracker();
    this.beatDetector = new BeatDetector();
    this.bpmDetector = new BpmDetector(this.rate);
    this.rmsMeter = new RMSMeter(1000);
    this.energyAnalyzer = new EnergyAnalyzer();
    this.state = AudioState.create();

    this.themeDetector = new ThemeDetector({
      onTheme: (theme, score) => {
        this.state.theme = theme;
        this.state.themeScore = score;
        if(this.onTheme) this.onTheme(theme, score);
      }
    });
  }

  async start(options = {}) {
    // On récupère le deviceId depuis le localStorage si non fourni
    const savedDeviceId = localStorage.getItem("selectedAudioDeviceId");
    const deviceId = options.deviceId ?? savedDeviceId;

    if(this.running) return this.getState();

    try {
      const constraints = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true };
      
      this.stream = options.stream ?? await navigator.mediaDevices.getUserMedia(constraints);

      // --- AFFICHAGE DU MICRO UTILISÉ ---
      const audioTrack = this.stream.getAudioTracks()[0];
      const micName = audioTrack.label || "Microphone par défaut";
      console.log("Microphone utilisé :", micName);
      if (window.printToConsole) {
        window.printToConsole("Microphone utilisé : " + micName);
      }
      // -----------------------------------

      this.A = new (window.AudioContext || window.webkitAudioContext)();
      this.src = this.A.createMediaStreamSource(this.stream);

      this.C = this.A.createAnalyser();
      this.C.fftSize = this.fftSize;
      this.C.smoothingTimeConstant = 0.0;

      this.src.connect(this.C);

      this.t = new Uint8Array(this.C.fftSize);
      this.f8 = new Uint8Array(this.C.frequencyBinCount);
      this.fFloat = new Float32Array(this.C.frequencyBinCount);

      this.noteTracker.reset();
      this.rmsMeter.reset();
      AudioState.reset(this.state);

      this.themeDetector.start();
      this.running = true;
      this.timerBpm = setInterval(() => this.processBpm(), this.hop);
      this.loop();

      return this.getState();
    } catch (e) {
      console.error("Erreur démarrage audio :", e);
      if (window.printToConsole) {
        window.printToConsole("ERREUR : Impossible de démarrer le micro.");
      }
      throw e;
    }
  }

  stop() {
    this.running = false;
    if(this.timerBpm) clearInterval(this.timerBpm);
    if(this.rafId) cancelAnimationFrame(this.rafId);
    if(this.stream) this.stream.getTracks().forEach(t=>t.stop());
    if(this.A) this.A.close();
    if(this.onStop) this.onStop(this.getState());
  }

  getState() {
    return AudioState.clone(this.state);
  }

  loop() {
    if(!this.running || !this.C) return;
    const now = performance.now();
    this.C.getByteFrequencyData(this.f8);
    this.C.getByteTimeDomainData(this.t);

    const rms = AudioUtils.rmsFromTimeDomain(this.t);
    this.rmsMeter.push(rms, now);
    const smoothRms = this.rmsMeter.get();
    let sum = 0;
    let max = 0;
    let idx = 0;

    for(let i=0;i<this.f8.length;i++){
      sum += this.f8[i];
      if(this.f8[i] > max){
        max = this.f8[i];
        idx = i;
      }
    }

    const avg = sum / this.f8.length;
    this.state.power = Math.min(100, Math.round(smoothRms * 140));
    const energy = this.energyAnalyzer.analyze(avg / 255);
    this.state.isDrop = energy.isDrop;
    this.state.dropRatio = energy.ratio;

    if(max > 120 && max > avg * 3){
      this.noteTracker.addFromPeak(now, idx * AudioUtils.hz(this.A, this.C));
    }
    this.noteTracker.prune(now);

    const top = this.noteTracker.getTop3();
    const last = this.noteTracker.history.at(-1)?.name;
    const active = [0,0,0];

    for(let i=0;i<3;i++){
      this.state.notes[i] = top[i]
        ? { name: top[i].n, num: top[i].num, active: top[i].n === last }
        : { name:"-", active:false };
      if(this.state.notes[i].active) active[i] = 1;
    }

    const beatRes = this.beatDetector.process(this.f8, now);
    this.state.beat = beatRes.beat;

    for(let i=0;i<3;i++){
      this.state.traces[i] = this.state.traces[i] || [];
      this.state.traces[i].push(active[i]);
      if(this.state.traces[i].length > 200) this.state.traces[i].shift();
    }
    this.state.traces[3] = this.state.traces[3] || [];
    this.state.traces[3].push(beatRes.beat ? 1 : 0);
    if(this.state.traces[3].length > 200) this.state.traces[3].shift();

    if(this.onFrame) this.onFrame(this.getState());
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  processBpm() {
    if(!this.running || !this.C) return;
    this.C.getFloatFrequencyData(this.fFloat);
    const now = performance.now();
    const bpmInfo = this.bpmDetector.process(
      this.fFloat, this.C, now,
      this.bpmDetector.tempo.bind(this.bpmDetector),
      this.bpmDetector.harmonics.bind(this.bpmDetector)
    );
    if(bpmInfo && bpmInfo.bpm){
      this.state.bpm = bpmInfo.bpm;
      if(bpmInfo.changed && this.onBpm) this.onBpm(bpmInfo.bpm, this.getState());
    }
  }
}