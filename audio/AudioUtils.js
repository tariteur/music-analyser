export default class AudioUtils {
  static noteNames = [
    "Do", "Do#", "Ré", "Ré#", "Mi", "Fa",
    "Fa#", "Sol", "Sol#", "La", "La#", "Si"
  ];

  static hz(audioContext, analyser) {
    return audioContext.sampleRate / analyser.fftSize;
  }

  static rmsFromTimeDomain(timeData) {
    let sum = 0;

    for (let i = 0; i < timeData.length; i++) {
      let v = (timeData[i] - 128) / 128;
      sum += v * v;
    }

    return Math.sqrt(sum / timeData.length);
  }

  static bandAverage(freqData, audioContext, analyser, minHz, maxHz) {
    const binHz = this.hz(audioContext, analyser);

    let sum = 0;
    let count = 0;

    const start = Math.floor(minHz / binHz);
    const end = Math.ceil(maxHz / binHz);

    for (let i = start; i <= end; i++) {
      sum += freqData[i] || 0;
      count++;
    }

    return count ? sum / count : 0;
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}