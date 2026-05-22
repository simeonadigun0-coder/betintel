# 🏀🎾🏐 SportIntel — Multi-Sport Betting Intelligence

> AI-powered betting analyst for Basketball, Tennis & Volleyball.
> Built on Groq (Llama 3.3 70B) + ESPN public data. Mobile-first. Free to run.

---

## What It Does

SportIntel scans live fixtures across 3 sports every day and returns the strongest value betting picks — powered by real data and a professional analyst-grade AI prompt.

| Sport | Coverage | Key Markets |
|---|---|---|
| 🏀 Basketball | NBA, EuroLeague, NCAA, 15+ leagues | Points Totals, Match Winner, Spread, First Half |
| 🎾 Tennis | ATP Tour, WTA Tour, Grand Slams | Match Winner, Sets, Games Over/Under, First Set |
| 🏐 Volleyball | Nations League, NCAA, International | Match Winner, Sets Over/Under, Both Teams to Win a Set |

---

## How The AI Thinks

Every pick must pass the **3-Signal Rule** before it is included:

- **Signal 1** — Statistical data (records, PPG, win %, ranking gap)
- **Signal 2** — Form pattern (last 5 results with actual scores)
- **Signal 3** — Context (surface, home advantage, tournament round, table position)

If 3 independent signals cannot be found for a pick → it is skipped entirely.
This is the single most important rule that keeps the quality high.

---

## Folder Structure

```
sportintel/
│
├── index.html                        ← Full mobile web app UI
├── netlify.toml                      ← Netlify configuration
├── package.json                      ← Project config
│
└── netlify/
    └── functions/
        ├── get-sports.js             ← Fetches fixtures from ESPN (Basketball, Tennis, Volleyball)
        └── analyze-sports.js         ← Groq AI analyst — returns top picks per sport
```

---

## Deploy to Netlify (5 Minutes)

### Step 1 — GitHub
1. Create a new GitHub repository (private recommended)
2. Upload all files keeping the exact folder structure above
3. Make sure `netlify/functions/` folder contains both `.js` files

### Step 2 — Netlify
1. Go to [netlify.com](https://netlify.com) → Log in
2. Click **Add new site → Import an existing project**
3. Connect GitHub → Select your repo
4. Build settings are auto-detected from `netlify.toml`
5. Click **Deploy site**

### Step 3 — Add Groq API Key
1. Netlify dashboard → Your site → **Site configuration → Environment variables**
2. Click **Add variable**
3. Key: `GROQ_API_KEY`
4. Value: your Groq key from [console.groq.com](https://console.groq.com)
5. Click **Save** → Go to **Deploys → Trigger deploy**

### Step 4 — Add to Phone Home Screen
1. Open your Netlify URL in **Safari** (iOS) or **Chrome** (Android)
2. Tap **Share → Add to Home Screen**
3. It installs like a native app — no App Store needed

---

## Getting a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up — completely free, no credit card needed
3. Click **API Keys → Create API Key**
4. Copy the key (starts with `gsk_`)
5. Paste into Netlify environment variables **or** directly in the app Settings

**Groq free tier limits:**
- 14,400 tokens per minute
- 30 API requests per minute
- More than enough for daily sports scanning

---

## How to Use the App

1. Open SportIntel on your phone
2. Tap the sport you want — **Basketball**, **Tennis**, or **Volleyball**
3. Wait 20–60 seconds for AI analysis
4. Browse your picks — tap any card to read the full analysis
5. Use **Won / Lost / Skip** buttons to track your results
6. Check your running **Win %** in the bottom banner

**Important:** Results are cached for 6 hours. Tapping a sport again within 6 hours loads the saved picks instantly — no API calls, no waiting. Use the **↺ Rescan** button to force a fresh analysis.

---

## File Descriptions

### `get-sports.js`
Fetches today's fixtures from ESPN's free public API across all three sports in parallel:
- **Basketball**: standings (rank, W/L, win %, PPG, opponent PPG, streak) + last 5 results with scores
- **Tennis**: ATP/WTA rankings, win/loss records, tournament, round, surface
- **Volleyball**: team records, venue, competition details

Results are cached at the CDN level for up to 6 hours — so the first scan of the day runs the full fetch, every scan after that is served instantly from Netlify's edge network at zero function cost.

### `analyze-sports.js`
Sends the fixture data to Groq (Llama 3.3 70B) using sport-specific analyst prompts. Each sport has its own:
- Data formatting (PPG for basketball, rankings for tennis, records for volleyball)
- Market selection logic tailored to that sport
- Analysis writing style appropriate to the sport
- 3-Signal Rule enforcement

Includes retry logic for Groq rate limits — if the API returns 429, it waits the required cooldown period and retries automatically.

### `index.html`
Single-file mobile-first web app. No framework, no dependencies, no build step needed. Features:
- Sport-specific colour themes (Orange for basketball, Green for tennis, Purple for volleyball)
- Animated radar scanning screen per sport
- Filter tabs per sport (Totals, Match Winner, Sets, etc.)
- Per-pick analysis toggle
- Bet tracker with Won/Lost/Skip and running win rate
- 6-hour localStorage cache per sport
- Settings drawer for API key + confidence threshold

---

## Settings Explained

| Setting | Default | What It Does |
|---|---|---|
| Groq API Key | — | Required. Your key from console.groq.com |
| Min Confidence | 70% | Minimum probability for a pick to be included |
| Max Picks Per Sport | 10 | Cap on picks returned per sport per day |

**Confidence threshold guide:**
- **68–70%** — More picks, slightly lower quality. Good for exploring markets.
- **70–75%** — Balanced. Recommended for most users.
- **75–80%** — Fewer but stronger picks. Best for high-stakes decisions.

---

## Understanding the Markets

### Basketball
- **Points Totals** (Over/Under 205.5–230.5) — Based on combined PPG averages and actual recent scores
- **Match Winner** — Based on win % gap, home court, and current form streak
- **Spread** (Win -5.5 / +10.5) — When one team is strong but you want insurance
- **First Half Totals** — For fast-starting, high-tempo teams

### Tennis
- **Player to Win** — Based on ranking gap, surface preference, and current record
- **Match in 2/3 Sets** — Based on ranking gap and surface speed
- **Total Games** (Over/Under 19.5–22.5) — Clay + baseliners = more games; Grass + servers = fewer
- **First Set Winner** — For dominant players known for fast starts

### Volleyball
- **Match Winner** — Home advantage + record gap
- **Sets Over/Under 3.5** — Large record gap = Under (sweep); Close records = Over
- **Both Teams to Win a Set** — Safest volleyball market for competitive matches
- **Win in 3/4 Sets** — For clearly dominant home teams

---

## Companion App

This app handles **Basketball, Tennis & Volleyball**.

For **Football (Soccer)** — 60+ leagues worldwide — use the companion app:
**BetIntel** → deployed separately on Vercel

Both apps share the same AI philosophy:
- 3-Signal Rule
- Real ESPN data
- Deep analyst prompts
- No padding with weak picks

---

## Tips for Profitable Betting

1. **Track everything** — Use the Won/Lost buttons on every pick, even when you do not bet. Your real win rate after 3–4 weeks is the only number that matters.
2. **Start with Basketball Totals** — Points Over/Under markets are the most statistically predictable in SportIntel because PPG data is very reliable.
3. **Tennis on clay** — Over Games markets on clay between two baseliners are the most consistent tennis picks.
4. **Volleyball sets** — "Both Teams to Win a Set" hits in roughly 75–80% of competitive matches. Reliable baseline market.
5. **Never bet all picks** — Review each analysis, check for any late injury/lineup news, then decide. The AI does not have last-minute team news.
6. **Bank management** — Never bet more than 2–5% of your bankroll on any single pick, regardless of confidence level.

---

## Important Disclaimer

SportIntel uses AI analysis based on publicly available data. It does not have access to:
- Real-time injury reports
- Last-minute lineup changes
- Live odds or line movements
- Private team information

Always check current team/player news before placing any bet. Past performance of any prediction tool does not guarantee future results. Bet responsibly.
