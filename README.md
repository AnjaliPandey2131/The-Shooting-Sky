# 🌌 Shooting Stars — 2D Survival Arcade Game

A fast-paced, retro-futuristic 2D survival arcade game built with vanilla HTML5 Canvas, modern JavaScript (ES6 modules), and dynamic Web Audio synthesis. Survive as long as you can while dodging falling celestial hazards and navigating crumbling ground!

---

## 🎮 Play & Gameplay Overview

In **Shooting Stars (The Shooting Sky)**, you control an agile stick-figure survivor on a fragile planetary platform. Celestial debris falls from the heavens with increasing intensity. Your goal is simple: **survive and set the highest score possible!**

### ✨ Key Features
- **Progressive Difficulty Stages**:
  - **Stage 1 (Calm Sky)**: Slow-falling shooting stars to warm up.
  - **Stage 2 (Meteor Shower)**: Increased frequency with fast hailstones.
  - **Stage 3 (Asteroid Storm)**: Massive asteroids crash down and begin cracking ground platforms.
  - **Stage 4 (Breaking World)**: Catastrophic fireballs and meteor barrages; ground segments crack and crumble!
  - **Stage 5 (Ultimate Survival)**: High-intensity apocalyptic onslaught for true arcade champions.
- **Dynamic Platform Cracking & Crumbling**: As heavier hazards impact, sections of the ground destabilize and collapse, creating dangerous gaps you must jump across.
- **Audio Synthesis**: Retro arcade sound effects generated in real-time via the browser's Web Audio API (no external MP3/WAV assets required).
- **Particle & Glow Effects**: Rich collision bursts, trails, screen shakes, and glow effects rendered at 60 FPS.
- **Persistent High Scores**: High scores are stored locally in `localStorage`.

---

## 🕹️ Controls

| Action | Keyboard Key |
| :--- | :--- |
| **Move Left** | `←` Left Arrow or `A` |
| **Move Right** | `→` Right Arrow or `D` |
| **Jump** | `↑` Up Arrow, `W`, or `Space` |
| **Crouch** | `↓` Down Arrow or `S` |
| **Mute / Unmute Sound** | `M` or click the 🔊 icon |

---

## 🚀 How to Run Locally

Because the project uses ES6 JavaScript Modules (`type="module"`), it should be served via a local web server:

### Option 1: VS Code Live Server
1. Open this directory in VS Code.
2. Right-click [index.html](file:///index.html) and select **"Open with Live Server"**.

### Option 2: Python HTTP Server
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

### Option 3: Node `npx serve`
```bash
npx serve .
```

---

## 📁 Project Structure

```
├── index.html          # Game markup, HUD overlay, and screens
├── style.css           # Modern neon arcade UI, typography, and styling
├── js/
│   ├── main.js         # Game entry point and initialization
│   ├── game.js         # Core game loop and state management
│   ├── player.js       # Player physics, animation, and controls
│   ├── platform.js     # Platform segments, cracking, and crumbling logic
│   ├── hazards.js      # Hazard types (Shooting Stars, Hailstones, Asteroids, Fireballs)
│   ├── particles.js    # Visual FX, explosion bursts, and dust particles
│   ├── difficulty.js   # Dynamic stages and spawn rate progression
│   ├── audio.js        # Web Audio API sound synthesizer
│   ├── config.js       # Game constants, physics tuning, and level definitions
│   └── ui.js           # HUD and score screen controllers
├── .gitignore          # Git ignore rules for clean repository tracking
└── README.md           # Project documentation
```

---

## 🛠️ Built With

- **HTML5 Canvas** — Hardware-accelerated 2D graphics rendering
- **Vanilla JavaScript (ES6 Modules)** — Modular, clean architecture with zero runtime dependencies
- **Web Audio API** — Procedural sound synthesis
- **CSS3** — Glassmorphism UI, glowing animations, and responsive layout

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
