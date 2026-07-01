/**
 * Settings.js - Gestionnaire automatique avec application DIRECTE des sources Audio/MIDI
 */

const styleTemplate = `
  .modal-overlay-custom {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.85); z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
    font-family: sans-serif; color: #fff;
  }
  .modal-overlay-custom.open { opacity: 1; pointer-events: auto; }
  .modal-container-custom {
    background: #111; border: 1px solid #333; width: 400px;
    border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
    overflow: hidden; display: flex; flex-direction: column; text-align: left;
  }
  .modal-header-custom {
    padding: 12px 16px; background: #1a1a1a; border-bottom: 1px solid #222;
    display: flex; justify-content: space-between; align-items: center;
  }
  .modal-header-custom h3 { margin: 0; font-size: 14px; letter-spacing: 0.5px; color: #fff; }
  .modal-close-custom {
    background: none; border: none; color: #888; cursor: pointer;
    font-size: 20px; font-weight: bold; line-height: 1;
  }
  .modal-close-custom:hover { color: #ff0055; }
  .modal-body-custom { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .setting-group-custom { display: flex; flex-direction: column; gap: 6px; }
  .setting-group-custom label { font-size: 11px; text-transform: uppercase; color: #888; font-weight: bold; }
  .setting-group-custom select {
    background: #000; border: 1px solid #333; color: #fff;
    padding: 8px; border-radius: 4px; font-size: 13px; outline: none; cursor: pointer;
  }
  .setting-group-custom select:focus { border-color: #00ff88; }
`;

class SettingsManager {
  constructor() {
    this.init();
  }

  init() {
    // 1. Injection du CSS
    const styleEl = document.createElement("style");
    styleEl.innerHTML = styleTemplate;
    document.head.appendChild(styleEl);

    // 2. Injection HTML de la Popup
    const modalHTML = `
      <div class="modal-container-custom">
        <div class="modal-header-custom">
          <h3>RÉGLAGES DES SOURCES</h3>
          <button class="modal-close-custom" id="closeSettingsBtnCustom">&times;</button>
        </div>
        <div class="modal-body-custom">
          <div class="setting-group-custom">
            <label for="audioSelectCustom">Source Entrée Audio</label>
            <select id="audioSelectCustom"><option value="default">Par défaut</option></select>
          </div>
          <div class="setting-group-custom">
            <label for="midiSelectCustom">Périphérique Entrée MIDI</label>
            <select id="midiSelectCustom"><option value="none">Aucun</option></select>
          </div>
        </div>
      </div>
    `;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay-custom";
    overlay.id = "settingsModalCustom";
    overlay.innerHTML = modalHTML;
    document.body.appendChild(overlay);

    // 3. Bouton automatique
    this.injectButton();

    // 4. Événements fermeture
    document.getElementById("closeSettingsBtnCustom").onclick = () => overlay.classList.remove("open");
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove("open"); };

    // 5. APPLICATION DIRECTE DU CHANGEMENT AUDIO
    document.getElementById("audioSelectCustom").onchange = async (e) => {
      const deviceId = e.target.value;
      localStorage.setItem("selectedAudioDeviceId", deviceId);
      
      console.log(`[Settings] Changement direct de la source audio : ${deviceId}`);

      // Si l'instance globale d'AudioAPI existe (dans editor.html ou page.js)
      if (window.currentAudioInstance) {
        try {
          // On coupe l'ancien flux si une méthode stop existe
          if (typeof window.currentAudioInstance.stop === 'function') {
            window.currentAudioInstance.stop();
          }

          // Récupération du constructeur stocké globalement
          if (window.AudioAPIConstructor) {
            window.currentAudioInstance = new window.AudioAPIConstructor({
              deviceId: deviceId,
              onFrame: window.audioOnFrameCallback || (() => {})
            });
            window.currentAudioInstance.start();
          }
        } catch (err) {
          console.error("Erreur lors du hot-swap de l'AudioAPI :", err);
        }
      }
      
      // On dispatch quand même l'événement au cas où
      window.dispatchEvent(new CustomEvent('audioDeviceChanged', { detail: deviceId }));
    };

    // 6. APPLICATION DIRECTE DU CHANGEMENT MIDI
    document.getElementById("midiSelectCustom").onchange = (e) => {
      const midiId = e.target.value;
      localStorage.setItem("selectedMidiInputId", midiId);
      
      console.log(`[Settings] Changement direct de la source MIDI : ${midiId}`);

      // Si l'accès WebMIDI est disponible et qu'on a stocké la fonction de bind
      if (typeof window.rebindMidiInputs === 'function') {
        window.rebindMidiInputs();
      }

      window.dispatchEvent(new CustomEvent('midiDeviceChanged', { detail: midiId }));
    };
  }

  injectButton() {
    const target = document.getElementById("header") || document.querySelector(".d") || document.body;
    const btn = document.createElement("button");
    btn.id = "settingsBtnCustom";
    btn.innerHTML = "SETTINGS ⚙️";
    btn.style.padding = "8px 12px";
    btn.style.fontWeight = "bold";
    btn.style.margin = "0 4px";
    btn.style.cursor = "pointer";
    btn.style.background = "#222";
    btn.style.color = "#fff";
    btn.style.border = "1px solid #444";
    btn.style.borderRadius = "3px";

    btn.onclick = () => {
      document.getElementById("settingsModalCustom").classList.add("open");
      this.updateAudioDevices();
      this.updateMidiDevices();
    };

    const stats = document.getElementById("stats");
    if (stats && target.id === "header") {
      target.insertBefore(btn, stats);
    } else {
      target.appendChild(btn);
    }
  }

  async updateAudioDevices() {
    const audioSelect = document.getElementById("audioSelectCustom");
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      audioSelect.innerHTML = "";
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const saved = localStorage.getItem("selectedAudioDeviceId");

      audioInputs.forEach(device => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.text = device.label || `Entrée Audio [${device.deviceId.slice(0, 5)}]`;
        if (saved === device.deviceId) option.selected = true;
        audioSelect.appendChild(option);
      });
    } catch (err) { console.error(err); }
  }

  async updateMidiDevices() {
    const midiSelect = document.getElementById("midiSelectCustom");
    const saved = localStorage.getItem("selectedMidiInputId");
    
    // Si la page parente possède déjà l'accès MIDI, on l'utilise
    if (window.midiAccessInstance) {
      midiSelect.innerHTML = "";
      if (window.midiAccessInstance.inputs.size === 0) {
        midiSelect.innerHTML = '<option value="none">Aucun périphérique</option>';
        return;
      }
      window.midiAccessInstance.inputs.forEach((input) => {
        const option = document.createElement("option");
        option.value = input.id;
        option.text = input.name || `Périphérique [${input.id}]`;
        if (saved === input.id) option.selected = true;
        midiSelect.appendChild(option);
      });
    } else if (navigator.requestMIDIAccess) {
      // Sinon on fait une requête rapide pour remplir le select
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });
        midiSelect.innerHTML = "";
        access.inputs.forEach((input) => {
          const option = document.createElement("option");
          option.value = input.id;
          option.text = input.name || `Périphérique [${input.id}]`;
          if (saved === input.id) option.selected = true;
          midiSelect.appendChild(option);
        });
      } catch (e) { midiSelect.innerHTML = '<option value="none">Aucun</option>'; }
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new SettingsManager());
} else {
  new SettingsManager();
}