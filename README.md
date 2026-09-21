# BPM-Finder-To-MIDI

This project is a desktop application based on [Electron](https://www.electronjs.org/).  

As a lighting enthusiast and DJ, I wanted to offer the most interactive performance possible with the music — as if a real light-jockey were managing the show live.
Not finding what I was looking for among existing solutions like Lightjams or other software specialized in light/sound synchronization, I decided to create a custom communication interface for tinkerers and enthusiasts.

The application automates 99% of DMX software control (like QLC+) via MIDI signals, inspired by how a Wolfmix works but as PC software.

Main features:
  - Sound to color conversion: A dedicated algorithm analyzes the audio signal to convert it directly into color palettes (primary and secondary) applied to the lighting fixtures.
  - Audio analysis and AI: Detects in real time the musical style (Reggae, Electro, etc.), BPM, beats, energy, RMS, and the key of the track.
  - JavaScript programming: The user writes the control logic in an integrated JS editor. Data from the AI and audio analyzer are directly accessible via global functions and variables (audio.beat, audio.theme, audio.primaryColor, etc.).
  - Automatic MIDI sending: Generates the MIDI notes and velocity values configured in the script to control moving heads, PARs, and chasers.
  - Performance Mode: Displays a live log console tracking sent MIDI signals, loop status, and calculated audio parameters.
---

<img width="1919" height="935" alt="musique analyser" src="https://github.com/user-attachments/assets/2385a143-3e64-4762-88aa-15a7af8e4752" />
<img width="1919" height="1023" alt="image" src="https://github.com/user-attachments/assets/0648724f-b59c-4acd-ad2a-d4c6c7349358" />

Local AI credit to @xenova/transformers (Hugging Face / Transformers.js)
<img width="631" height="23" alt="image" src="https://github.com/user-attachments/assets/cafa7432-c364-44bd-aad5-26715a8eaccb" />

## Download

Download the ready-to-use application for **Windows**:

[![Download for Windows](https://img.shields.io/badge/Download-Windows-brightgreen)](https://github.com/tariteur/music-analyser/releases/download/1.0.1/Musique.analyser.Setup.1.0.1.exe)

If you want to compile it manually from the source code:  

[![Source code](https://img.shields.io/badge/Source%20code-GitHub-blue)](https://github.com/tariteur/music-analyser)

---

## Windows Installation (classic)

Before starting, make sure you have installed:

- [LoopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) (required for MIDI management)

> ⚠️ **Important:** LoopMIDI must be running **at the same time as the application** for MIDI communication to work properly.

---

## Manual Installation (tinkerer)

Install dependencies:  
`npm install`

Run in development/test mode:
`npm start`

Build the application into an executable file (.exe):
`npm run build`
