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

If 3 independent signals cannot be found → the pick is skipped entirely.

---

## Folder Structure

```
sportintel/
│
├── index.html                        ← Full mobile web app UI
├── vercel.json                       ← Vercel configuration
├── package.json                      ← Project config
├── README.md                         ← This file
│
└── api/
    ├── get-sports.js                 ← Fetches fixtures from ESPN (all 3 sports)
    └── analyze-sports.js             ← Groq AI analyst — returns top picks per sport
```

---

## Deploy to Vercel (5 Minutes)

### Step 1 — GitHub
1. Create a new GitHub repository
2. Upload all files keeping the exact folder structure above
3. Make sure the `api/` folder contains both `.js` files directly inside it

### Step 2 — Vercel
1. Go to [vercel.com](https://vercel.com) → Log in with GitHub
2. Click **Add New Project → Import Git Repository**
3. Select your repo → click **Deploy**
4. Vercel auto-detects everything from `vercel.json` — no build settings needed

### Step 3 — Add Groq API Key
1. Vercel dashboard → Your project → **Settings → Environment Variables**
2. Click **Add**
3. Name: `GROQ_API_KEY`
4. Value: your Groq key from [console.groq.com](https://console.groq.com)
5. Click **Save** → Go to **Deployments → Redeploy**

### Step 4 — Add to Phone Home Screen
1. Open your `.vercel.app` URL in **Safari** (iOS) or **Chrome** (Android)
2. Tap **Share → Add to Home Screen**
3. It installs like a native app — no App Store needed

---

## Getting a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up — completely free, no credit card needed
3. Click **API Keys → Create API Key**
4. Copy the key (starts with `gsk_`)
5. Paste into Vercel environment variables **or** directly in the app Settings

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

## Vercel Free Tier — What You Get

| Resource | Free Allowance |
|---|---|
| Bandwidth | 100 GB / month |
| Function Invocations | 100,000 / month |
| Function Duration | Up to 120 seconds per call |
| Deployments | Unlimited |

No credit system. No pausing. No surprise charges.
`get-sports.js` is cached at Vercel's edge for up to 6 hours — so the ESPN fetch only runs once per day regardless of how many times you scan.

---

## File Descriptions

### `api/get-sports.js`
Fetches today's fixtures from ESPN's free public API across all three sports in parallel:
- **Basketball**: standings (rank, W/L, win %, PPG, opponent PPG, streak) + last 5 results with scores
- **Tennis**: ATP/WTA rankings, win/loss records, tournament, round, surface
- **Volleyball**: team records, venue, competition details

Cached at Vercel's edge CDN for up to 6 hours using `Cache-Control: s-maxage`. First scan of the day triggers the ESPN fetch — every scan after that is served from the edge at zero function cost.

### `api/analyze-sports.js`
Sends fixture data to Groq (Llama 3.3 70B) using sport-specific analyst prompts. Each sport has its own:
- Data formatting (PPG for basketball, rankings for tennis, records for volleyball)
- Market selection logic tailored to that sport
- 3-Signal Rule enforcement
- Analysis writing style

Includes automatic retry logic for Groq rate limits — if the API returns 429, it reads the `retry-after` header, waits the correct cooldown, and retries up to twice before surfacing a clear error message.

### `index.html`
Single-file mobile-first web app. No framework, no build step. Features:
- Sport-specific colour themes (Orange = Basketball, Green = Tennis, Purple = Volleyball)
- Animated radar scanning screen per sport
- Filter tabs per sport (Totals, Match Winner, Sets, etc.)
- Per-pick expandable analysis
- Bet tracker with Won/Lost/Skip and running win rate
- 6-hour localStorage cache per sport
- Settings drawer for API key and confidence threshold

---

## Settings Explained

| Setting | Default | What It Does |
|---|---|---|
| Groq API Key | — | Required. Your key from console.groq.com |
| Min Confidence | 70% | Minimum probability for a pick to appear |
| Max Picks Per Sport | 10 | Cap on picks returned per sport per scan |

**Confidence threshold guide:**
- **68–70%** — More picks, slightly lower quality
- **70–75%** — Balanced — recommended for most users
- **75–80%** — Fewer but stronger picks — best for high-stakes decisions

---

## Understanding the Markets

### Basketball
- **Points Totals** (Over/Under 205.5–230.5) — Based on combined PPG averages and actual recent scores
- **Match Winner** — Based on win % gap, home court, and current form streak
- **Spread** (Win -5.5 / +10.5) — When one team is strong but you want insurance
- **First Half Totals** — For fast-starting, high-tempo teams

### Tennis
- **Player to Win** — Ranking gap, surface preference, current record
- **Match in 2/3 Sets** — Ranking gap and surface speed
- **Total Games** (Over/Under 19.5–22.5) — Clay + baseliners = more; Grass + servers = fewer
- **First Set Winner** — Dominant players known for fast starts

### Volleyball
- **Match Winner** — Home advantage + record gap
- **Sets Over/Under 3.5** — Large record gap = Under (sweep); Close records = Over
- **Both Teams to Win a Set** — Safest volleyball market for competitive matches
- **Win in 3/4 Sets** — For clearly dominant home teams

---

## Companion App

This app handles **Basketball, Tennis & Volleyball**.

For **Football (Soccer)** — 60+ leagues worldwide — use the companion app:
**BetIntel** → deployed separately on Vercel (repo: betintel2)

Both apps share the same AI philosophy, same 3-Signal Rule, and use the same Groq API key.

---

## Tips for Profitable Betting

1. **Track everything** — Use Won/Lost on every pick even when you do not bet. Your real win rate after 3–4 weeks is the only number that matters.
2. **Basketball Totals first** — Points Over/Under is the most statistically predictable market because PPG data is very reliable.
3. **Tennis on clay** — Over Games between two baseliners on clay is the most consistent tennis market.
4. **Volleyball sets** — "Both Teams to Win a Set" hits in ~75–80% of competitive matches.
5. **Never bet all picks** — Review the analysis, check for injury/lineup news, then decide.
6. **Bank management** — Never bet more than 2–5% of your bankroll on any single pick.

---

## Important Disclaimer

SportIntel uses AI analysis based on publicly available ESPN data. It does not have access to real-time injury reports, last-minute lineup changes, live odds, or private team information. Always check current news before placing any bet. Bet responsibly.
