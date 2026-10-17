# Shooting Stars — 2D Arcade Survival Game

**Shooting Stars** is a browser-based arcade survival game. Guide a stickman across a fragile platform, dodge falling celestial hazards, and collect coins to restore energy and earn shields. Survive as the hazards intensify through five stages.

## Overview

Move left and right, jump between the ground and floating platforms, and crouch to avoid danger. Falling stars, hailstones, asteroids, fireballs, and meteor waves become more frequent and varied as the run progresses. In later stages, impacts can crack and collapse sections of the ground.

Coins appear on the ground and floating platforms. Each collected coin adds score, restores energy, and advances the run's shield milestones. Energy drains while playing and gradually affects movement and jump strength. A shield charge can automatically protect the player when a hazard gets close.

## Features

- Canvas-rendered stickman movement, jumping, crouching, and procedural animation.
- Falling hazards, near-miss effects, meteor-wave warnings, and progressively faster stage pacing.
- Horizontal- and vertical-moving floating platforms, plus ground sections that can crack and collapse.
- Scheduled collectible coins, energy management, and automatic shield protection.
- Survival score, persistent local high score, coin totals, and a game-over coin-per-stage chart.
- Procedural sound effects using the Web Audio API, particle effects, and responsive HUD/menu screens.
- The optional-speech Rage Bait Coin encounter described below.

## Rage Bait Coin

The Rage Bait Coin is a mischievous golden character drawn directly on the game canvas. Its animated face, arms, and legs change expression as the player approaches. Its body has a fixed collision area; the close-range visual dodge is limited to four pixels.

An encounter appears only on an existing, reachable, horizontal-moving platform—not on the base ground. The platform is checked against the player's current energy-adjusted jump and movement physics, and the coin follows it while it moves. The entrance takes 0.55 seconds; once it finishes, the player has **eight active seconds** to collect the coin. The encounter includes a countdown ring, sparkles, taunts, and reactions to a close approach.

Each stage targets one or two appearances. The first is scheduled 4–8 seconds into the stage. An optional second is scheduled 18–22 seconds into stages 1–4, or 24–32 seconds into stage 5. If no suitable reachable platform is available, the encounter retries after one second and may be skipped if the stage ends first. At most one encounter is active at a time.

- **Collected in time:** the coin gives the same reward as an ordinary coin: 50 points, 5% energy (up to the 100% cap), coin/analytics credit, and progress toward the run's shield milestones. This feature adds no bonus score by default.
- **Not collected:** the coin escapes after the timer expires, with no coin, score, energy, or shield reward. A collapsing or disappearing platform also ends the encounter without a collection reward.
- **Audio:** short dialogue uses the browser's Web Speech API when available. Synthesized Web Audio tones are the fallback. Browser voices, audio permissions, and sound output vary; mute with `M` or the HUD sound button.

## Controls

| Action | Control |
| --- | --- |
| Move left | `←` Left Arrow |
| Move right | `→` Right Arrow |
| Jump | `↑` Up Arrow |
| Crouch | `↓` Down Arrow |
| Mute / unmute | `M` or click the HUD sound button |

## Stages

Stages advance with survival time. Each stage lasts 30 seconds except stage 5, which continues indefinitely.

| Stage | Time | Hazards and changes |
| --- | --- | --- |
| 1 — Calm Sky | 0–30 seconds | Shooting stars |
| 2 — Meteor Shower | 30–60 seconds | Shooting stars and hailstones |
| 3 — Asteroid Storm | 60–90 seconds | Stars, hailstones, asteroids; ground can crack |
| 4 — Breaking World | 90–120 seconds | Adds fireballs and meteor waves; ground can collapse |
| 5 — Ultimate Survival | 120 seconds onward | All hazard types at the highest configured spawn rate |

## Technologies

- HTML5 and the Canvas 2D API
- CSS3
- Vanilla JavaScript using native ES modules; no JavaScript package manager or third-party runtime library is required
- Browser APIs: Web Audio, optional Web Speech, `requestAnimationFrame`, and `localStorage`
- Google Fonts (Orbitron, Press Start 2P, and Outfit) are linked from Google Fonts; system fallbacks are used if those fonts are unavailable

## Project structure

```text
.
├── index.html
├── style.css
├── README.md
└── js/
    ├── main.js               # Entry point and game loop startup
    ├── game.js               # Game state, input, update loop, collisions
    ├── config.js             # Physics, stages, hazards, and feature tuning
    ├── player.js             # Player movement, physics, and drawing
    ├── platform.js           # Ground segments and deterioration
    ├── floatingPlatforms.js  # Moving platforms and platform states
    ├── hazards.js            # Falling hazards and meteor warnings
    ├── coins.js              # Coin scheduling, collection, and rewards
    ├── energy.js             # Energy, shield milestones, and analytics
    ├── rageBaitCoin.js       # Timed special-coin encounter
    ├── difficulty.js         # Stage progression and hazard scheduling
    ├── particles.js          # Particle and visual effects
    ├── audio.js              # Procedural sound and optional speech
    └── ui.js                 # HUD, menus, scores, and analytics chart
```

## Prerequisites

- A modern browser with JavaScript modules and Canvas 2D support.
- Python 3 to use the built-in local web server, or Visual Studio Code with a Live Server extension.
- Internet access is optional; it is needed only to fetch the linked Google Fonts. Browser audio and speech support vary.

## Run locally

Clone the confirmed repository and start a static HTTP server from its folder:

```powershell
git clone https://github.com/AnjaliPandey2131/The-Shooting-Sky.git
cd The-Shooting-Sky
python -m http.server 8000
```

Then open <http://localhost:8000> in a browser. Keep the terminal open while playing; press `Ctrl+C` to stop the server. If `python` is not available as a command on Windows, try `py -m http.server 8000`.

Alternatively, open the project folder in VS Code and serve `index.html` with the Live Server extension. Do not open the page directly as a `file:` URL; ES modules require a local web server.

## How to play

Stay alive by moving, jumping, and crouching to avoid hazards. Use floating platforms to navigate above danger and collapsing ground. Collect coins to gain 50 points and restore 5% energy. Energy drains over time; collecting ten coins during a run earns a shield charge. Shields activate automatically near a hazard and protect the player for five seconds. Survival also contributes to the score, and later stages increase the score multiplier.

## Screenshots and demo

No screenshots, gameplay GIFs, or hosted demo are included in this repository yet. Gameplay images can be added under an `assets/` directory and linked here once committed.

## Testing and known limitations

There is no automated test suite or package-based test command configured in the repository. Browser checks performed during development covered Rage Bait platform selection/reachability, its entrance and eight-second timer, one-time reactions and rewards, expiration without rewards, collapsing-platform invalidation, and a local gameplay smoke run. The game page loaded and advanced without browser page or console errors in that smoke run. Actual audible speech output was not independently verified.

- The game has no dedicated pause state; encounter timers advance with active gameplay updates.
- The Rage Bait Coin can be skipped when no reachable horizontal-moving platform is available before the stage ends.
- Web Speech and audio behavior depend on browser support, available voices, and audio permissions.
- Google Fonts require a network connection; local fallback fonts remain available.

## Project purpose

This repository contains a personal game-development project: an arcade survival game built with browser-native technologies.

## License

No `LICENSE` file or explicit project license is present. The project should not be assumed to be MIT-licensed; no reuse permissions have been granted by this README.

## Changelog

- Added energy-scaled movement, collectible coins, shield milestones, moving platforms, stage analytics, and the animated Rage Bait Coin encounter.
- Updated the special coin to use a reachable moving-platform spawn, a 0.55-second entrance, an eight-second collection window, and speech with synthesized audio fallback.
