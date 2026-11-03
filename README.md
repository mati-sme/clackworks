# Clackworks

**A cozy paper-craft marble machine idle game.** The machine runs by itself from the first second: marbles clack down cardboard ramps into the jar, and you grow it from a single funnel into a Dream Engine by buying upgrades on the fly.

▶ Play: https://mati-sme.github.io/clackworks/ (installable as an app, works offline)

## How to play (v2)
- **It runs itself.** Marbles flow automatically, and every gadget you buy shows up on the machine and speeds up the flow.
- **One screen, no scrolling.** The 12-tile shop has two tabs, Gadgets and Upgrades. Tiles glow when you can afford them, and the **BEST** badge (and the BEST bar) marks the buy that pays back fastest.
- **Multi-touch.** Every finger counts: tap tiles as fast as you like, or **press and hold** to keep buying faster and faster. Tap or swipe marbles on the machine to **pop** them for bonus sparkles, with as many fingers as you want.
- **Golden marbles** roll by. Tap one for a **Frenzy** (×5), a **Marble Shower** or **Golden Rain**.
- **Turbo** charges by itself. Tap it when full for ×3 for 15s.
- **Auto-Builder** is an upgrade that buys the BEST buy for you, and tapping AUTO pauses it. **Speedy Builder** makes it 4× faster.
- **Rebuild** for **Gears** (the ⚙ chip). Every gear ever earned gives +10% forever, and you spend them on the **Gear Tree**. Trophies give +2% each. It keeps earning while you're away.

Kid-safe: no ads, no purchases, no gambling, no violence.

Old v1 saves migrate automatically. Upgrades for the removed PRESS crank are refunded as sparkles and gears.

## Tech
A static HTML/JS/CSS site with Canvas 2D and WebAudio-synthesized sounds. Everything is drawn in code. Pointer events give multi-touch, and `touch-action: none` removes double-tap zoom and the tap delay. It saves to localStorage, with versioned migration (save v4) and a backup copy. It's a PWA whose versioned service worker (`clackworks-v2`) fetches the page network-first.

- `js/econ.js`: the pure economy. The game and the simulator share it.
- `node tools/sim.mjs [all|idle|goldonly|leveronly|active|tappy] [runs]`: simulates players buying the best-payback item. It reports rebuild times and the longest gap between purchases. Results are in `test/sim-results.txt`.
- `npm i puppeteer-core && python3 -m http.server 8765 & node test/play.mjs`: the headless test at 390×844, 375×667 and 360×740. It covers the no-scroll assertions, CDP multi-touch, hold-to-buy, auto-play through a rebuild, the auto-builder, v1 save migration and offline earnings. Screenshots go in `test/shots/v2-*.png`.

## Licenses
Code is MIT. Fonts are Lilita One and Nunito under the SIL Open Font License (see `fonts/`).
