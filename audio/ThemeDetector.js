export default class ThemeDetector {
  constructor(options = {}) {
    this.onTheme = options.onTheme ?? null;
    this.worker = new Worker(new URL('./detector.worker.js', import.meta.url), { type: 'module' });

    this.lastTheme = "";
    this.confirm = 0;
    this.official = "";
    this.MIN_CONFIRM = 1; // Légère confirmation pour éviter les sauts
    this.isAnalyzing = false;

    // Configuration pour 5 secondes à 16kHz
    this.TARGET_SAMPLES = 16000 * 5;

    this.worker.onmessage = (e) => {
      if (e.data.type === 'result') this.handleResult(e.data);
    };
    this.worker.postMessage({ type: 'init' });
  }

  async start() {
    // Récupération de l'ID du micro depuis le localStorage
    const storedAudioDevice = localStorage.getItem('selectedAudioDeviceId');
    
    // Configuration des contraintes audio
    const constraints = {
      audio: storedAudioDevice ? { deviceId: { exact: storedAudioDevice } } : true
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.warn("Impossible d'accéder au microphone sélectionné, tentative avec le micro par défaut...", error);
      // Fallback : si le micro du localStorage n'est plus disponible (débranché), on prend le micro par défaut
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(stream);

    // 4096 est la taille du bloc traité par le processeur
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Buffer pour stocker 5 secondes d'audio
    let buffer = new Float32Array(this.TARGET_SAMPLES);
    let pointer = 0;

    this.processor.onaudioprocess = (e) => {
      // Si on est en train d'analyser ou si on a déjà fini une séquence de 5s, on ne traite pas
      if (this.isAnalyzing) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Sécurité : ne pas dépasser le buffer
      const lengthToCopy = Math.min(inputData.length, this.TARGET_SAMPLES - pointer);
      buffer.set(inputData.subarray(0, lengthToCopy), pointer);
      pointer += lengthToCopy;

      // Si on a accumulé 5 secondes de données
      if (pointer >= this.TARGET_SAMPLES) {
        this.isAnalyzing = true;
        this.worker.postMessage({ type: 'analyze', audioData: buffer });

        // Reset du pointeur pour le prochain cycle
        pointer = 0;
      }
    };
  }

  handleResult({ theme, score }) {
    // Une fois le résultat reçu, on passe à false pour permettre une nouvelle analyse de 5s
    this.isAnalyzing = false;

    if (!theme) return;

    if (theme === this.lastTheme) {
      this.confirm++;
    } else {
      this.confirm = 1;
      this.lastTheme = theme;
    }

    if (this.confirm >= this.MIN_CONFIRM && theme !== this.official) {
      this.official = theme;
      if (this.onTheme) this.onTheme(theme, score);
    }
  }
}