// ============================================================
//  BetIntel — analyze.js  (v2)
//  - Uses real ESPN stats (form, standings, avg goals) fed into prompt
//  - Analyst-grade prompt that sounds like a real person
//  - New markets: Away or Over 2.5, Home or Over 2.5,
//    No Team Leads By 3, Corners 7.5–10.5
//  - Aggressive batching so 100 matches → 15–20 picks reliably
// ============================================================

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const BATCH_SIZE = 15; // smaller batches = deeper per-match focus
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Format a fixture into a rich text block for the prompt ──────
function formatFixture(f, i) {
  const homeTable = `${f.homePOS}th, ${f.homePTS}pts, ${f.homeW}W-${f.homeD}D-${f.homeL}L, GF:${f.homeGF} GA:${f.homeGA} GD:${f.homeGD}, Avg scored:${f.homeAvgScored} Avg conceded:${f.homeAvgConceded}`;
  const awayTable = `${f.awayPOS}th, ${f.awayPTS}pts, ${f.awayW}W-${f.awayD}D-${f.awayL}L, GF:${f.awayGF} GA:${f.awayGA} GD:${f.awayGD}, Avg scored:${f.awayAvgScored} Avg conceded:${f.awayAvgConceded}`;

  return `
MATCH ${i + 1}: ${f.homeTeam} vs ${f.awayTeam} | ${f.country} — ${f.league} | KO: ${f.kickoff}
  HOME [${f.homeTeam}] Table: ${homeTable}
  HOME Form (last 5): ${f.homeForm5} — ${f.homeFormFull}
  AWAY [${f.awayTeam}] Table: ${awayTable}
  AWAY Form (last 5): ${f.awayForm5} — ${f.awayFormFull}`.trim();
}

// ── Master analyst prompt ────────────────────────────────────────
function buildPrompt(fixtures, targetPicks, minConfidence) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const fixtureBlocks = fixtures.map((f, i) => formatFixture(f, i)).join("\n\n");

  return `You are a professional football betting analyst with 15 years of experience. You write like a real person — sharp, direct, no fluff. Today is ${today}.

You have been given REAL live data for each fixture below — league standings, win/draw/loss record, goals scored and conceded, goals averages, and last 5 results with actual scores and opponents. Use this data as your PRIMARY source. Supplement with your broader knowledge of these teams, leagues, and tactical tendencies.

═══════════════════════════════════════════════════════
FIXTURES WITH LIVE DATA (${fixtures.length} matches)
═══════════════════════════════════════════════════════
${fixtureBlocks}
═══════════════════════════════════════════════════════

YOUR TASK: Identify exactly ${targetPicks} of the strongest value bets from the fixtures above. Every pick must be grounded in the data provided. Think like a sharp bettor, not a casual fan.

AVAILABLE MARKETS — use EXACT text shown:
┌─ Match Result
│  "Home Win" | "Draw" | "Away Win"
├─ Goals  
│  "Over 1.5 Goals" | "Over 2.5 Goals" | "Over 3.5 Goals" | "Under 2.5 Goals" | "Under 3.5 Goals"
├─ Both Teams To Score
│  "Both Teams To Score - Yes" | "Both Teams To Score - No"
├─ Double Chance Goals
│  "Home Win or Over 2.5 Goals" | "Away Win or Over 2.5 Goals"
├─ No Big Lead
│  "No Team To Lead By 3 Goals"
├─ Corners
│  "Over 7.5 Corners" | "Over 8.5 Corners" | "Over 9.5 Corners" | "Over 10.5 Corners"
│  "Under 8.5 Corners" | "Under 9.5 Corners"
└─ Cards
   "Over 3.5 Cards" | "Over 4.5 Cards" | "Under 3.5 Cards"

MARKET SELECTION GUIDE:
• Use "Over X Goals" when both teams have high avg scored OR high avg conceded — confirm with form data
• Use "BTTS - Yes" when both teams average ≥1.2 goals scored per game and both have been conceding
• Use "BTTS - No" when one team has a very mean defence (avg GA under 0.8) and the other team rarely scores
• Use "Home Win or Over 2.5 Goals" when the home team is strong but you're not 100% sure they win clean — this covers both outcomes
• Use "Away Win or Over 2.5 Goals" same logic for away side
• Use "No Team To Lead By 3 Goals" for closely matched teams, tight derbies, promotion battles, relegation fights — nearly always hits
• Use "Over 7.5/8.5 Corners" for high-possession teams, wide play, or pressing sides who win corners repeatedly. Over 9.5/10.5 only for elite pressing matches
• Use "Under 2.5 Goals" for low-scoring teams, teams in form of 0-0/1-0, or matches involving a stingy defence meeting a poor attack

PICK SELECTION RULES:
✓ Minimum ${minConfidence}% confidence — do not include anything weaker
✓ One pick per match only — choose whichever market gives you the most edge
✓ Star Pick = 88%+ only — this is rare, use it only when the data is overwhelmingly one-sided
✓ Look hard at teams with high goal averages for Goals/BTTS markets
✓ Lower league matches are valid — some of the most predictable patterns are in Série B, Championship, 2. Bundesliga
✗ If the data shows "?" for most stats, and you have zero confidence, skip that match entirely
✗ Never guess. Only pick where you genuinely see edge.

ANALYSIS REQUIREMENTS (write like a real analyst, natural tone):
Each analysis must cover:
1. What the LIVE DATA tells you specifically (mention actual numbers from the data)
2. The pattern or trend that makes this market the right call
3. Any relevant H2H knowledge you have for these teams
4. One specific risk factor a sharp bettor would consider

Return ONLY a valid JSON array. No markdown fences. No intro text. Nothing before or after the array.

[
  {
    "country": "Germany",
    "league": "Bundesliga",
    "homeTeam": "Bayer Leverkusen",
    "awayTeam": "RB Leipzig",
    "pick": "Over 2.5 Goals",
    "market": "Goals",
    "probability": "81",
    "confidence": "High",
    "starPick": false,
    "analysis": "The data tells the story clearly here. Leverkusen are averaging 2.3 goals per game at home and conceding 1.1 — so goals are in the air before Leipzig even kick off. Leipzig themselves are putting up 1.9 per game on the road, and their defence has been soft lately, conceding in each of their last four away trips. That combination — one team that scores freely and another that can't keep a clean sheet on the road — almost always opens this line. H2H backs it up too, with 3 of the last 4 meetings between these sides going over 2.5. The one risk is if Leverkusen rotate ahead of their midweek fixture, which could blunt their attacking edge in the first half.",
    "kickoff": "17:30 UTC"
  }
]`;
}

// ── Groq API call ────────────────────────────────────────────────
async function callGroq(prompt, apiKey) {
  const res = await fetch(GROQ_URL, {
    method : "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type" : "application/json",
    },
    body: JSON.stringify({
      model      : GROQ_MODEL,
      messages   : [{ role: "user", content: prompt }],
      temperature: 0.25, // lower = more consistent, data-driven
      max_tokens : 6000,
    }),
    signal: AbortSignal.timeout(58000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || "";
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Find the JSON array
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Groq returned no JSON array");
  return JSON.parse(match[0]);
}

// ── Main handler ─────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    "Content-Type"               : "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const { fixtures = [], settings = {} } = body;

    const apiKey   = process.env.GROQ_API_KEY || settings.groqKey || "";
    const minConf  = parseInt(settings.minConfidence) || 70;
    const maxPicks = parseInt(settings.maxPicks)      || 15;

    if (!apiKey)        return { statusCode: 400, headers, body: JSON.stringify({ error: "No Groq API key. Set GROQ_API_KEY in Netlify env vars or in app Settings." }) };
    if (!fixtures.length) return { statusCode: 400, headers, body: JSON.stringify({ error: "No fixtures provided." }) };

    const allPicks = [];

    // ── Split into batches ───────────────────────────────────────
    const batches = [];
    for (let i = 0; i < fixtures.length; i += BATCH_SIZE) {
      batches.push(fixtures.slice(i, i + BATCH_SIZE));
    }

    // Picks to request per batch — generous so we get enough total
    // e.g. 100 fixtures / 15 per batch = 7 batches, ask 3-4 per batch = 21-28 raw, filter to maxPicks
    const picksPerBatch = Math.max(3, Math.ceil(maxPicks / batches.length) + 2);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const prompt = buildPrompt(batch, picksPerBatch, minConf);
        const picks  = await callGroq(prompt, apiKey);

        for (const p of picks) {
          if (!p.homeTeam || !p.awayTeam || !p.pick) continue;
          const prob = parseFloat(p.probability) || 0;
          if (prob < minConf) continue;

          allPicks.push({
            country    : p.country    || "",
            league     : p.league     || "",
            homeTeam   : p.homeTeam   || "",
            awayTeam   : p.awayTeam   || "",
            pick       : p.pick       || "",
            market     : p.market     || "Other",
            probability: Math.min(99, Math.max(50, prob)),
            confidence : p.confidence || "Medium",
            starPick   : prob >= 88 || p.starPick === true,
            analysis   : p.analysis   || "",
            kickoff    : p.kickoff    || "",
          });
        }
      } catch (e) {
        console.error(`Batch ${i + 1} error:`, e.message);
      }

      // Respect Groq rate limits between batches
      if (i < batches.length - 1) await sleep(1200);
    }

    // Sort: stars first → probability desc
    allPicks.sort((a, b) => {
      if (a.starPick && !b.starPick) return -1;
      if (!a.starPick && b.starPick) return 1;
      return b.probability - a.probability;
    });

    // Deduplicate (same match showing up from multiple batches, unlikely but safe)
    const seen   = new Set();
    const unique = [];
    for (const p of allPicks) {
      const key = `${p.homeTeam}|${p.awayTeam}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(p); }
    }

    const final = unique.slice(0, Math.max(5, maxPicks));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        picks      : final,
        total      : final.length,
        starPicks  : final.filter(p => p.starPick).length,
        scannedAt  : new Date().toISOString(),
        fixturesIn : fixtures.length,
      }),
    };
  } catch (err) {
    console.error("analyze handler:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
