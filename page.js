import AudioAPI from "./audio/AudioAPI.js";

let audio = null;
let currentBpm = null;
let ledTimer = null;

const g = document.getElementById("g");
const x = g.getContext("2d");

const S = (id) => document.getElementById(id);

// ---------------- UI HELPERS ----------------

function flash(el, className, duration = 80) {
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function draw(traces) {
  x.clearRect(0, 0, g.width, g.height);

  const colors = ["#f66", "#6f9", "#6cf", "#fff"];

  colors.forEach((color, i) => {
    const line = traces?.[i] || [];

    x.beginPath();
    x.strokeStyle = color;

    for (let j = 0; j < line.length; j++) {
      const px = (j / (line.length || 1)) * g.width;
      const py = 50 * (i + 1) - (line[j] ? 20 : 0);

      if (j === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }

    x.stroke();
  });
}

function startLed(bpm) {
  if (currentBpm === bpm) return;

  currentBpm = bpm;

  clearInterval(ledTimer);

  ledTimer = setInterval(() => {
    const led = S("bpmLed");

    led.classList.add("r");
    led.textContent = "●";

    setTimeout(() => {
      led.classList.remove("r");
      led.textContent = "○";
    }, 120);

  }, 60000 / bpm);
}

function resetUi() {
  S("start").style.display = "inline-block";
  S("notes").style.display = "none";

  S("bpmVal").textContent = "—";
  if (S("themeVal")) S("themeVal").textContent = "—"; 

  S("rmsVal").textContent = "—";
  S("dropVal").textContent = "1.0x";

  S("dropLed").classList.remove("drop-active");

  S("c1Led").style.backgroundColor = "#222";
  S("c1Led").style.boxShadow = "none";
  S("c1Text").textContent = "—";

  S("c2Led").style.backgroundColor = "#222";
  S("c2Led").style.boxShadow = "none";
  S("c2Text").textContent = "—";

  clearInterval(ledTimer);
  x.clearRect(0, 0, g.width, g.height);
}

// ---------------- RENDER ----------------

function render(state) {
  if (!state) return;

  // ---------------- NOTES ----------------

  for (let i = 0; i < 3; i++) {
    S("n" + i).textContent = state.notes[i].name;

    if (state.notes[i].active) {
      S("l" + i).classList.add("a");
    } else {
      S("l" + i).classList.remove("a");
    }
  }

  // ---------------- BEAT ----------------

  if (state.beat) flash(S("beat"), "b");

  // ---------------- THEME (REMPLACE KEY) ----------------

  if (state.theme) {
    S("theme").classList.add("t");
    S("theme").textContent = "●";
    
    S("themeText").textContent = state.theme;
  } else {
    S("theme").classList.remove("t");
    S("theme").textContent = "●";
  
    S("themeText").textContent = "—";
  }

  // ---------------- ENERGY / DROP ----------------
  if (state.isDrop) {
    S("dropLed").classList.add("drop-active");
    S("dropLed").textContent = "🔥";
    S("dropVal").textContent = "MAX!";
  } else {
    S("dropLed").classList.remove("drop-active");
    S("dropLed").textContent = "●";

    S("dropVal").textContent =
      typeof state.dropRatio === "number"
        ? state.dropRatio.toFixed(0) + "%"
        : "?";
  }

  // ---------------- RMS ----------------

  S("rmsVal").textContent = state.power + "%";

  if (state.power > 0) {
    S("powerLed").classList.add("p");
  } else {
    S("powerLed").classList.remove("p");
  }

  // ---------------- BPM ----------------

  if (state.bpm) {
    S("bpmVal").textContent = Math.round(state.bpm);
    startLed(state.bpm);
  }

  // ---------------- COLORS ----------------
  console.log("Primary Color:", state.primaryColor);
  console.log("Secondary Color:", state.secondaryColor);
  if (state.primaryColor && state.primaryColor.hex) {
    S("c1Led").style.backgroundColor = state.primaryColor.hex;
    S("c1Led").style.boxShadow = `0 0 20px ${state.primaryColor.hex}`;
    S("c1Text").textContent = state.primaryColor.name;
  }

  if (state.secondaryColor && state.secondaryColor.hex) {
    S("c2Led").style.backgroundColor = state.secondaryColor.hex;
    S("c2Led").style.boxShadow = `0 0 20px ${state.secondaryColor.hex}`;
    S("c2Text").textContent = state.secondaryColor.name;
  }

  draw(state.traces);
}

// ---------------- AUDIO API ----------------

audio = new AudioAPI({
  onFrame: render
});

// ---------------- START ----------------

S("start").onclick = async () => {
  S("start").style.display = "none";
  S("notes").style.display = "flex";

  await audio.start();
};

// ---------------- STOP ----------------

S("stop").onclick = () => {
  audio.stop();
  resetUi();
};