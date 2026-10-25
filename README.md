# 🦖 Dino Runner

A jumping-dinosaur endless runner in the style of the browser's offline game, built with plain **HTML, CSS and JavaScript** (no libraries, no build step).

**▶ Play:** https://nikhilbelwate.github.io/dino-runner/

## Controls
| Action | Keys |
|---|---|
| Start / jump | `Space`, `↑`, `Shift` or `W` (hold to jump higher) |
| Duck / fast-fall | `↓` or `S` |
| Touch screens | Tap the game |
| Sound on/off | `M` |

## Features
- Cacti in groups of 1–3, and pterodactyls at three heights after 450 points
- Speed increases over time; the score flashes and chimes every 100 points
- Day/night cycle every 700 points
- High score saved in your browser
- **Works offline**: a service worker caches the game after the first visit, and it can be installed as an app (PWA)
- Fixed 60 fps simulation, so the speed is the same on any monitor refresh rate
- Crisp pixel art on high-DPI screens; responsive down to phone width

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
