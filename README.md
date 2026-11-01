# 🦖 Dino Runner

A jumping-dinosaur endless runner in the style of the browser's offline game, built with plain **HTML, CSS and JavaScript** (no libraries, no build step).

**▶ Play:** https://nikhilbelwate.github.io/dino-runner/

## Controls
| Action | Keys |
|---|---|
| Start / jump | `Space`, `↑`, `Shift` or `W` (hold to jump higher) |
| Duck / fast-fall | `↓` or `S` |
| Pause / resume | `P` or `Esc`, or the **Start / Pause** button |
| Touch: jump | Tap the game (hold for a higher jump) |
| Touch: duck | Swipe down on the game |
| Sound on/off | `M` |

The **Start / Pause** button under the game shows *Start*, *Pause*, *Resume* or *Restart* depending on the game state. The game also pauses by itself when you switch tabs or apps.

## Features
- Cacti in groups of 1–3, and pterodactyls at three heights after 450 points
- Speed increases over time; the score flashes and chimes every 100 points
- Day/night cycle every 700 points
- High score saved in your browser
- **Works offline**: a service worker caches the game after the first visit, and it can be installed as an app (PWA)
- Fixed 60 fps simulation, so the speed is the same on any monitor refresh rate
- Crisp pixel art on high-DPI screens; responsive down to phone width, with a compact layout for phones in landscape
- Touch controls: tap to jump, swipe down to duck; no accidental scrolling or zooming while playing

## Run locally
Open `index.html` in a browser, or serve the folder (needed for the offline service worker):
```bash
python -m http.server 8000   # then open http://localhost:8000
```

## Files
| File | Purpose |
|---|---|
| `index.html` | Page and canvas |
| `style.css` | Layout and day/night theme |
| `game.js` | Game loop, physics, sprites, collisions, input, sound |
| `sw.js` | Service worker for offline play |
| `manifest.json`, `icon.svg` | Installable web-app metadata |

Sprites are original pixel art drawn in code.
