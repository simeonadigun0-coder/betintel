# ⚡ BetIntel — Football Intelligence

> AI-powered value bet predictor. Scans 45+ leagues worldwide, returns 5–20 high-confidence picks daily.

---

## What It Does

- **Scans 45+ leagues** across Europe, Americas, Africa, Asia via ESPN public API (no key needed)
- **AI analysis** via Groq (Llama 3.3 70B) — uses its knowledge of team form, H2H records, and league patterns
- **Markets covered**: 1X2, Over/Under Goals, Both Teams To Score, Asian Handicap, Corners, Cards
- **Smart filtering** — only returns picks above your confidence threshold (default 72%)
- **Star Picks** — flagged at 88%+ probability
- **Bet tracker** — mark picks Won/Lost, see your running win rate
- **Mobile-first** — works perfectly on your phone, can be added to home screen

---

## Deploy to Netlify (5 minutes)

### Step 1 — Upload to GitHub
1. Create a new GitHub repo (private)
2. Upload all files from this folder

### Step 2 — Connect to Netlify
1. Go to [netlify.com](https://netlify.com) and sign in
2. Click **Add new site → Import an existing project**
3. Choose GitHub, select your repo
4. Build settings are auto-detected from `netlify.toml`
5. Click **Deploy site**

### Step 3 — Set Environment Variable (Recommended)
1. In Netlify dashboard → **Site configuration → Environment variables**
2. Add: `GROQ_API_KEY` = your Groq key from [console.groq.com](https://console.groq.com)
3. Redeploy (or it picks up on next deploy)

> **Alternative:** Enter your Groq key directly in the app Settings if you prefer not to use env vars. It's stored in your browser only.

### Step 4 — Add to Phone Home Screen
1. Open your Netlify URL in Safari (iOS) or Chrome (Android)
2. Tap Share → **Add to Home Screen**
3. Done! Works like a native app

---

## How to Use

1. **Open the app** on your phone
2. Tap **SCAN TODAY'S MATCHES**
3. Wait 20–40 seconds for AI analysis (scans 45 leagues + runs Groq)
4. Browse your picks — tap any card to expand the analysis
5. Use the **Won / Lost / Skip** buttons to track results
6. Check your **win rate** in the bottom banner

---

## Getting Your Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free — no credit card needed)
3. Click **API Keys → Create API Key**
4. Copy the key (starts with `gsk_`)
5. Paste into BetIntel Settings or your Netlify env vars

**Groq free tier**: ~14,400 tokens/min with Llama 3.3 70B — more than enough for daily scans.

---

## Architecture

```
Phone (index.html)
  │
  ├─ GET /.netlify/functions/get-fixtures
  │     └── Fetches ESPN public API (45 leagues, parallel)
  │         Returns: array of today's fixtures
  │
  └─ POST /.netlify/functions/analyze
        └── Sends fixtures to Groq (Llama 3.3 70B)
            Batches of 18 fixtures per API call
            Returns: top 5-20 ranked picks with analysis
```

---

## Tips for Profitable Betting

1. **Focus on Star Picks (⭐)** — only placed at 88%+ probability
2. **Goals markets** (Over/Under) are statistically more predictable than 1X2
3. **Bank management** — never bet more than 2-5% of your bankroll per pick
4. **Track everything** — use the built-in tracker, your real win rate matters more than the AI's estimates
5. **Value over quantity** — 5 strong picks beats 20 weak ones every time

---

## Important Note

This tool uses AI analysis based on training data — it does **not** have real-time injury news, last-minute lineup changes, or live odds. Always cross-check Star Picks against current team news before placing a bet.

---

## Local Development

```bash
npm install
netlify dev   # runs at http://localhost:8888
```
