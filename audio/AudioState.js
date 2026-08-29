export default class AudioState {
  static create() {
    return {
      beat: false,
      theme: false,
      bpm: null,
      key: "-",
      keyConfidence: 0,
      power: 0,

      // ✅ DROP
      isDrop: false,
      dropRatio: 1,
      
      // ✅ COLORS
      primaryColor: null,
      secondaryColor: null,

      notes: [
        { name: "-", num: null, active: false },
        { name: "-", num: null, active: false },
        { name: "-", num: null, active: false }
      ],

      bands: { low: 0, mid: 0, high: 0 },

      spectrum: {
        peakIndex: 0,
        peakHz: 0,
        peakValue: 0,
        avg: 0,
        rms: 0,
        flux: 0
      },

      traces: [[], [], [], []],
      timestamp: 0
    };
  }

  static clone(state) {
    return {
      beat: state.beat,
      theme: state.theme,
      bpm: state.bpm,
      key: state.key,
      keyConfidence: state.keyConfidence,
      power: state.power,

      // ✅ DROP
      isDrop: state.isDrop,
      dropRatio: state.dropRatio,

      // ✅ COLORS
      primaryColor: state.primaryColor ? { ...state.primaryColor } : null,
      secondaryColor: state.secondaryColor ? { ...state.secondaryColor } : null,

      notes: state.notes.map(n => ({ ...n })),
      bands: { ...state.bands },
      spectrum: { ...state.spectrum },
      traces: state.traces.map(arr => [...arr]),
      timestamp: state.timestamp
    };
  }

  static reset(state) {
    const fresh = AudioState.create();
    // Vide l'objet existant puis réapplique les valeurs de base
    for (const key in state) {
      delete state[key];
    }
    Object.assign(state, fresh);
  }
}