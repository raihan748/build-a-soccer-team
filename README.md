# FUT Draft Arena 🏆

> **Turn-Based Soccer Team Draft Game — 1 to 5 Players**
> Built with HTML5, Modular JavaScript (ES6+), Tailwind CSS & Web Audio API

## 🎮 Live Demo

👉 **[Play on Vercel →](https://your-project.vercel.app)**

---

## ✨ Features

- ⚽ **200+ Real FUT Stars & Legends** — Messi, Ronaldo, Pelé, Mbappé, Haaland, Bellingham & more
- 🤖 **Single Player vs Bot AI** — 1v1, 1v2, 1v3, 1v4 configurations
- 👥 **Local Multiplayer** — 2–5 Players Pass & Play on one device
- 🗺️ **4-3-3 Formation** — Interactive 2D pitch with 11 position slots (GK, DEF, MID, ATT)
- 🧪 **Chemistry Engine** — Club & nationality-based team chemistry (0–100%)
- 🎵 **Web Audio Synth** — Zero external audio files; pure synthesized SFX
- 🏆 **Round-Robin Tournament** — Auto-simulated with leaderboard & confetti celebration
- 🃏 **FUT Card Aesthetics** — Legend, Special, Gold, Silver card tiers with glossy glow

## 📁 Project Structure

```
fut-draft-arena/
├── index.html          # Main entry point, all screens & modals
├── css/
│   └── styles.css      # FUT card styling, pitch textures, animations
├── js/
│   ├── database.js     # 200+ player database with stats & face URLs
│   ├── audio.js        # Web Audio API synthesizer (all SFX)
│   ├── squadEngine.js  # Formation slots, chemistry calculator
│   ├── botAi.js        # Intelligent bot decision-making logic
│   ├── tournament.js   # Round-robin simulator & confetti
│   └── app.js          # Main controller, UI rendering, game loop
├── vercel.json         # Vercel deployment configuration
└── play.bat            # Local dev launcher (Windows)
```

## 🚀 Deploy to Vercel

### Option A — Vercel CLI (Fastest)

```bash
npm i -g vercel
vercel
```

### Option B — GitHub + Vercel Dashboard

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repo
4. Leave all settings as default (auto-detected as static)
5. Click **Deploy** ✅

### Option C — Drag & Drop

1. Zip the project folder
2. Go to [vercel.com/new](https://vercel.com/new)
3. Drag the zip onto the dashboard

---

## 💻 Local Development

Requires a local HTTP server (ES6 modules don't work from `file://`):

```bash
# Option 1: Python (recommended, no install needed)
python -m http.server 8765
# then open http://localhost:8765

# Option 2: Node.js
npx serve .

# Option 3: Windows — just double-click
play.bat
```

---

## 🏗️ Tech Stack

| Layer      | Technology                            |
|------------|---------------------------------------|
| Structure  | HTML5 Semantic                        |
| Styling    | Tailwind CSS CDN + Vanilla CSS        |
| Logic      | ES6+ Modules (no build step needed)   |
| Audio      | Web Audio API (synthesized, no files) |
| Icons      | Font Awesome 6                        |
| Confetti   | canvas-confetti                       |
| Fonts      | Google Fonts (Teko + Inter)           |

---

## ⚙️ How It Works

1. **Setup** — Choose Solo (vs AI) or Multiplayer (Pass & Play), set number of players/bots
2. **Draft** — Each manager takes turns spinning 4 random cards, picks 1 for their 4-3-3 squad or skips
3. **Formation** — Fill all 11 slots: `GK | LB CB CB RB | CDM CM CAM | LW ST RW`
4. **Chemistry** — Earn bonus chemistry from shared clubs (+8%) and nationalities (+6%)
5. **Tournament** — When all squads are complete, a round-robin auto-runs with OVR×0.7 + Chem×0.3 + variance
6. **Victory** — Leaderboard sorted by Points → GD → GF, champion gets confetti 🎉

---

## 🎨 Manager Colors

| Slot | Color        | Theme    |
|------|-------------|----------|
| P1   | 🔴 Red      | `#ef4444`|
| P2   | 🔵 Blue     | `#3b82f6`|
| P3   | 🟢 Emerald  | `#10b981`|
| P4   | 🟣 Purple   | `#8b5cf6`|
| P5   | 🟡 Amber    | `#f59e0b`|

---

*Built with ❤️ — No Node.js, no bundler, no build step. Pure HTML/CSS/JS.*
