# Clackworks

**A cozy paper-craft marble machine idle game.** Smash the big red PRESS button, watch marbles clack down cardboard ramps into the jar, and grow a whimsical machine from a single funnel into a Dream Engine.

▶ Play: https://mati-sme.github.io/clackworks/ (installable as an app, works offline)

## How to play
- **PRESS** drops marbles. Fast taps build a **combo** (up to ×5, ×8 with the Combo Drum).
- **Gadgets** make marbles on their own. Every 10/25/50/100… of one gadget **doubles** it.
- **Golden marbles** sometimes roll by. Tap one for a **Frenzy** (×7), a **Marble Shower** or a **Tap Storm**.
- **Turbo lever** charges as you play. Pull it for ×3 for 15s.
- **Rebuild** your machine for **Gears**. Every gear you ever earn gives +10% forever. Spend gears on the **Gear Tree**.
- **Trophies** each give +2% forever. The machine keeps clacking while you're away.

Kid-safe: no ads, no purchases, no gambling, no violence.

## Tech
A static HTML/JS/CSS site with Canvas 2D and WebAudio-synthesized sounds. Everything is drawn in code. It saves to localStorage, with versioned migration and a backup copy. It's a PWA with a versioned service worker that fetches the page network-first.

- `js/econ.js`: the pure economy. The game and the simulator share it.
- `node tools/sim.mjs [tapsPerSec] [runs]`: simulates a greedy player and reports prestige times and the longest gap between purchases. Results are in `test/sim-results.txt`.
- `npm i && python3 -m http.server 8765 & node test/play.mjs`: headless auto-play test at 390×844. Screenshots go in `test/shots/`.

## Licenses
Code is MIT. Fonts are Lilita One and Nunito under the SIL Open Font License (see `fonts/`).
