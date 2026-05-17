// ============================================================
//  BetIntel — analyze.js
//  Groq AI analyser: takes fixtures, returns top value picks
//  Supports batching for large fixture lists
// ============================================================

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const BATCH_SIZE = 18; // max fixtures per Groq call
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Build the analysis prompt ──────────────────────────────
function buildPrompt(fixtures, targetPicks, minConfidence) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const fixturesList = fixtures
    .map((f, i) => {
      const record = f.homeRecord && f.awayRecord
        ? ` | Records: ${f.homeRecord} vs ${f.awayRecord}`
        : "";
      const kickoff = f.startTime
        ? new Date(f.startTime).toISOString().substring(11, 16) + " UTC"
        : "";
      return `${i + 1}. [${f.country}] ${f.league}: ${f.homeTeam} vs ${f.awayTeam}${record} | KO: ${kickoff}`;
    })
    .join("\n");

  return `You are BETINTEL, an elite football betting analyst with expert knowledge of all leagues worldwide. Today is ${today}.

FIXTURES TO ANALYSE (${fixtures.length} matches):
${fixturesList}

YOUR GOAL: Identify the ${targetPicks} highest-value betting opportunities from these fixtures. Focus on matches where you have strong analytical confidence based on your knowledge of team form, H2H records, and league patterns.

AVAILABLE MARKETS (use exact text):
• Match Result: "Home Win" | "Draw" | "Away Win"
• Goals: "Over 1.5 Goals" | "Over 2.5 Goals" | "Over 3.5 Goals" | "Under 2.5 Goals" | "Under 3.5 Goals"
• Both Teams Score: "Both Teams To Score - Yes" | "Both Teams To Score - No"
• Handicap: "Home -0.5 AH" | "Home -1 AH" | "Home -1.5 AH" | "Away -0.5 AH" | "Away +0.5 AH" | "Away +1 AH" | "Away +1.5 AH"
• Corners: "Over 9.5 Corners" | "Over 10.5 Corners" | "Under 9.5 Corners" | "Under 10.5 Corners"
• Cards: "Over 3.5 Cards" | "Over 4.5 Cards" | "Under 3.5 Cards"

SELECTION CRITERIA (STRICT):
✓ ONLY include picks where your estimated probability is at least ${minConfidence}%
✓ Star Pick = 88%+ probability — use sparingly, only when genuinely dominant
✓ Choose the SINGLE BEST market per match (where you have most edge)
✓ Prioritise: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, UCL, Eredivisie, Primeira Liga
✓ Goals/BTTS/Corners are often MORE predictable than 1X2 — consider these
✗ DO NOT pad with weak picks — 5 strong picks beats 15 mediocre ones
✗ SKIP matches where you are genuinely uncertain or lack sufficient knowledge

ANALYSIS QUALITY:
Each analysis MUST include:
- Both teams' recent form (last 5 matches) with specific results if known
- The specific statistical reason this market was chosen over alternatives  
- H2H context (last 3-5 meetings) if relevant
- One clear risk factor that could invalidate this pick

Return ONLY a valid JSON array. No markdown, no backticks, no text before or after the array.

[
  {
    "country": "England",
    "league": "Premier League",
    "homeTeam": "Arsenal",
    "awayTeam": "Wolves",
    "pick": "Over 2.5 Goals",
    "market": "Goals",
    "probability": "79",
    "confidence": "High",
    "starPick": false,
    "analysis": "Arsenal have scored in 9 of their last 10 home matches averaging 2.6 goals per game. Wolves have conceded 2+ in their last 4 away fixtures. H2H shows 4 of last 5 meetings went over 2.5 goals. Main risk: Arsenal squad rotation ahead of European fixture.",
    "kickoff": "15:00 UTC"
  }
]`;
}

// ── Call Groq API ──────────────────────────────────────────
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
      temperature: 0.3,
      max_tokens : 4096,
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || "";

  // Strip any accidental markdown fences
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Extract JSON array
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in Groq response");

  return JSON.parse(match[0]);
}

// ── Main handler ───────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { fixtures = [], settings = {} } = body;

    // Resolve Groq API key: env var takes priority, then client-supplied
    const apiKey       = process.env.GROQ_API_KEY || settings.groqKey || "";
    const minConf      = parseInt(settings.minConfidence) || 72;
    const maxPicks     = parseInt(settings.maxPicks)     || 15;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No Groq API key. Set GROQ_API_KEY in Netlify env vars or in Settings." }),
      };
    }

    if (!fixtures.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No fixtures provided." }),
      };
    }

    // ── Batch analysis ──────────────────────────────────────
    const allPicks = [];
    const batches  = [];
    for (let i = 0; i < fixtures.length; i += BATCH_SIZE) {
      batches.push(fixtures.slice(i, i + BATCH_SIZE));
    }

    // How many picks to request per batch
    const picksPerBatch = Math.ceil(maxPicks / batches.length);

    for (let i = 0; i < batches.length; i++) {
      const batch  = batches[i];
      const target = Math.min(picksPerBatch + 2, Math.ceil(batch.length * 0.45));

      try {
        const prompt = buildPrompt(batch, target, minConf);
        const picks  = await callGroq(prompt, apiKey);

        // Validate & sanitize each pick
        for (const pick of picks) {
          if (!pick.homeTeam || !pick.awayTeam || !pick.pick) continue;
          const prob = parseFloat(pick.probability) || 0;
          if (prob < minConf) continue;

          allPicks.push({
            country    : pick.country    || "",
            league     : pick.league     || "",
            homeTeam   : pick.homeTeam   || "",
            awayTeam   : pick.awayTeam   || "",
            pick       : pick.pick       || "",
            market     : pick.market     || "Other",
            probability: Math.min(99, Math.max(50, prob)),
            confidence : pick.confidence || "Medium",
            starPick   : pick.probability >= 88 || pick.starPick === true,
            analysis   : pick.analysis   || "",
            kickoff    : pick.kickoff    || "",
          });
        }
      } catch (batchErr) {
        console.error(`Batch ${i + 1} failed:`, batchErr.message);
      }

      // Delay between batches to respect Groq rate limits
      if (i < batches.length - 1) await sleep(1500);
    }

    // Sort: star picks first, then by probability descending
    allPicks.sort((a, b) => {
      if (a.starPick && !b.starPick) return -1;
      if (!a.starPick && b.starPick) return 1;
      return b.probability - a.probability;
    });

    // Cap at maxPicks, but ensure minimum of 5 if we have them
    const finalPicks = allPicks.slice(0, Math.max(5, maxPicks));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        picks      : finalPicks,
        total      : finalPicks.length,
        starPicks  : finalPicks.filter(p => p.starPick).length,
        scannedAt  : new Date().toISOString(),
        fixturesIn : fixtures.length,
      }),
    };
  } catch (err) {
    console.error("analyze handler error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
