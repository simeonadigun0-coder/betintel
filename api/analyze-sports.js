// ============================================================
//  SportIntel — analyze-sports.js
//  Groq analyst for Basketball, Tennis & Volleyball
//  Sport-specific markets, 3-Signal Rule, deep reasoning
// ============================================================

const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL  = "llama-3.3-70b-versatile";
const BATCH_SIZE  = 15;
const MAX_BATCHES = 4;
const BATCH_DELAY = 2500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════
//  FORMAT HELPERS
// ══════════════════════════════════════════════════════════════

function formatBasketball(f, i) {
  return [
    `MATCH ${i + 1}: ${f.homeTeam} vs ${f.awayTeam} | ${f.country} — ${f.league} | KO: ${f.kickoff}`,
    `  HOME [${f.homeTeam}]: Rank ${f.homePOS} | ${f.homeW}W-${f.homeL}L (${f.homePCT}) | PPG: ${f.homePPG} | Opp PPG: ${f.homeOppPPG} | Streak: ${f.homeStreak}`,
    `  HOME Form (last 5): ${f.homeForm5} — ${f.homeFormFull}`,
    `  AWAY [${f.awayTeam}]: Rank ${f.awayPOS} | ${f.awayW}W-${f.awayL}L (${f.awayPCT}) | PPG: ${f.awayPPG} | Opp PPG: ${f.awayOppPPG} | Streak: ${f.awayStreak}`,
    `  AWAY Form (last 5): ${f.awayForm5} — ${f.awayFormFull}`,
  ].join("\n");
}

function formatTennis(f, i) {
  return [
    `MATCH ${i + 1}: ${f.player1} vs ${f.player2} | ${f.tourType} — ${f.tournament} | Round: ${f.round} | KO: ${f.kickoff}`,
    `  Surface: ${f.surface || "Unknown"}`,
    `  ${f.player1}: Ranking #${f.p1Rank} | Record: ${f.p1Record}`,
    `  ${f.player2}: Ranking #${f.p2Rank} | Record: ${f.p2Record}`,
  ].join("\n");
}

function formatVolleyball(f, i) {
  return [
    `MATCH ${i + 1}: ${f.homeTeam} vs ${f.awayTeam} | ${f.country} — ${f.league} (${f.gender}) | KO: ${f.kickoff}`,
    `  HOME [${f.homeTeam}]: Record ${f.homeRecord} | Rank: ${f.homeRank || "?"}`,
    `  AWAY [${f.awayTeam}]: Record ${f.awayRecord} | Rank: ${f.awayRank || "?"}`,
  ].join("\n");
}

// ══════════════════════════════════════════════════════════════
//  SPORT-SPECIFIC PROMPTS
// ══════════════════════════════════════════════════════════════

function buildBasketballPrompt(fixtures, targetPicks, minConf) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const blocks = fixtures.map((f, i) => formatBasketball(f, i)).join("\n\n");

  return `You are a professional basketball betting analyst with 15 years of experience in NBA, EuroLeague, and international basketball. Today is ${today}.

You have REAL live data: rankings, W/L records, win percentages, points per game (PPG), opponent PPG, current streaks, and last 5 results with scores. USE THIS DATA as your primary source.

════════════════════════════════════════
FIXTURES WITH LIVE DATA (${fixtures.length} matches)
════════════════════════════════════════
${blocks}
════════════════════════════════════════

INTERNAL SCREENING — do this silently for every match:

A) POINTS TOTAL CHECK
   — Add home PPG + away PPG. If combined is 215+, Over totals are in play
   — Add home PPG + away Opp PPG. Compare both — if both exceed 105+ each → high-scoring game likely
   — Look at actual scores in form — are they 110-105 type OR 95-88 type games? Actual scores confirm the avg
   — Identify if either team is a defensive specialist (low PPG allowed) or offensive powerhouse (high PPG)

B) FORM & STREAK CHECK
   — Consistent form (WWWWW or LLLLL) is more reliable than erratic (WLLWL)
   — A team on a W streak + home court advantage = very strong signal
   — A team on an L streak away from home = weak side to back
   — Quality of recent wins/losses matters — who did they beat or lose to?

C) MATCHUP CHECK
   — Win % gap of 15%+ = clear favourite, consider Win or Spread pick
   — Win % gap under 10% = competitive match, consider Totals over result picks
   — PPG differential: if home team scores 5+ more per game than away allows → home offence has edge

D) THE 3-SIGNAL RULE — MANDATORY
Must find 3 independent signals per pick. Examples:
  Totals Over: (1) combined PPG 220+, (2) both teams concede heavily (high opp PPG), (3) last 5 actual scores all high-scoring
  Home Win: (1) home team 15%+ higher win %, (2) home team on W streak, (3) away team struggling away (form shows L away)
If 3 signals cannot be found → SKIP

AVAILABLE MARKETS — use EXACT text:
• "Home Win" | "Away Win"
• "Over 205.5 Points" | "Over 215.5 Points" | "Over 220.5 Points" | "Over 225.5 Points" | "Over 230.5 Points"
• "Under 205.5 Points" | "Under 215.5 Points" | "Under 220.5 Points"
• "Home Win -5.5" | "Home Win -10.5" | "Away Win +5.5" | "Away Win +10.5"
• "First Half Over 105.5 Points" | "First Half Under 105.5 Points"
• "Both Teams Over 100 Points"

MARKET GUIDE:
→ Over Totals: combined PPG suggests high-scoring AND actual recent scores confirm it
→ Under Totals: both teams have strong defences (low opp PPG) AND recent scores are low (sub-100 each)
→ Home Win: clear record/% advantage + home court + strong recent form — all three
→ Away Win: away team clearly superior by record AND showing strong road form — use sparingly
→ Spread -5.5: when one team is dominant but you want insurance against a close win
→ First Half Over: both teams known for fast starts, high-tempo offence

RULES:
✓ Return 4 to ${targetPicks} picks — quality beats quantity
✓ Minimum ${minConf}% confidence — nothing below this
✓ Every pick needs 3 signals
✓ Star Pick = 90%+ only
✓ NBA and EuroLeague data is most reliable — weight these higher when signal is clear
✗ Skip if stats are mostly "?" — no data = no pick
✗ Avoid Away Win without overwhelming evidence — home court in basketball is enormous

ANALYSIS: Write like an analyst talking to a smart friend. Quote specific numbers. Name your 3 signals. State one risk.

Return ONLY a valid JSON array. Nothing else. No markdown.

[{"sport":"basketball","country":"USA","league":"NBA","homeTeam":"Boston Celtics","awayTeam":"Miami Heat","pick":"Over 215.5 Points","market":"Totals","probability":"77","confidence":"High","starPick":false,"analysis":"Three clear signals. First, combined PPG is 221 — Celtics at 116.2 and Heat at 104.8 — so the raw average already clears 215.5 before we factor in defence. Second, Heat are conceding 109.4 per game on the road, which means Celtics scoring 110+ at home is a realistic expectation on its own. Third, the last four meetings between these sides have all produced over 215 combined points. The one risk is if the Heat slow the pace deliberately and turn this into a grind — they have the defensive personnel to do it when motivated.","kickoff":"00:30 UTC"}]`;
}

function buildTennisPrompt(fixtures, targetPicks, minConf) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const blocks = fixtures.map((f, i) => formatTennis(f, i)).join("\n\n");

  const hasFixtures = fixtures.length > 0;

  return `You are a professional tennis betting analyst with deep knowledge of ATP and WTA tours, surfaces, player styles, and H2H records. Today is ${today}.

${hasFixtures ? `You have been given fixture data from ESPN for today's matches. Use this as your starting point, then supplement heavily with your own knowledge of these players.` : `ESPN's API returned no fixture data today — this is common when tournaments are between rounds. Use YOUR OWN KNOWLEDGE of the current ATP/WTA calendar to identify matches happening today. You know the tournament schedules, player rankings, and who is playing where.`}

${hasFixtures ? `════════════════════════════════════════
FIXTURE DATA (${fixtures.length} matches from ESPN)
════════════════════════════════════════
${blocks}
════════════════════════════════════════` : `════════════════════════════════════════
NO ESPN DATA — USE YOUR KNOWLEDGE
════════════════════════════════════════
Identify up to ${targetPicks} matches you know are scheduled today across ATP and WTA tours.
For each match you identify, provide full analysis based on your knowledge of rankings, H2H, surface, and form.
If you are not confident a specific match is happening today, do not invent it — only include matches you are genuinely aware of.
════════════════════════════════════════`}

INTERNAL SCREENING — do this for every match:

A) RANKING ANALYSIS
   — Ranking gap of 30+ positions is significant. Gap of 50+ is dominant.
   — Surface specialist ranked 80 can beat ranked 40 who hates that surface — always factor surface
   — Early rounds (R128, R64, R32): big gaps usually play out
   — Later rounds (QF, SF, F): far more competitive, consider 3-set markets

B) SURFACE & STYLE
   — Clay: favours baseliners, longer rallies, more games — OVER games more likely
   — Grass: favours big servers, fast points — UNDER games more likely
   — Hard: most balanced — check player-specific history
   — Roland Garros is currently the active Grand Slam (late May) — clay court analysis applies

C) THE 3-SIGNAL RULE — MANDATORY
   Must find 3 signals per pick:
   Match Winner: (1) ranking gap, (2) surface preference, (3) recent form/record
   Over Games: (1) both baseliners, (2) clay surface, (3) close ranking = long match
   If 3 signals not found → SKIP

AVAILABLE MARKETS — use EXACT text:
• "[Player Name] to Win" (use exact player name)
• "Match to go 3 Sets" | "Match decided in 2 Sets"
• "Over 19.5 Games" | "Over 20.5 Games" | "Over 21.5 Games" | "Over 22.5 Games"
• "Under 19.5 Games" | "Under 20.5 Games" | "Under 21.5 Games"
• "First Set Winner — [Player Name]" (use exact player name)
• "[Player Name] to Win First Set and Match"

RULES:
✓ Return 4 to ${targetPicks} picks
✓ Minimum ${minConf}% confidence
✓ Every pick needs 3 signals
✓ Star Pick = 90%+ only — massive ranking gap on preferred surface
✓ If no ESPN data: only pick matches you genuinely know are scheduled today
✗ Never invent matches — if uncertain whether a match is today, skip it
✗ Never pick heavily in 5-set matches without knowing both players' styles

ANALYSIS: Name players by name. Quote rankings. Mention surface. Name 3 signals. State one risk.

Return ONLY a valid JSON array. Nothing else. No markdown.

[{"sport":"tennis","league":"ATP Tour","tournament":"Roland Garros","homeTeam":"Carlos Alcaraz","awayTeam":"Holger Rune","pick":"Carlos Alcaraz to Win","market":"Match Winner","probability":"79","confidence":"High","starPick":false,"analysis":"Three signals. Alcaraz is ranked 2 against Rune at 15 — a meaningful gap that on clay is significant given Alcaraz has won Roland Garros twice and is arguably the best clay court player in the world right now. Second, clay suits Alcaraz's sliding game and forehand angles perfectly — his win rate on clay this season is exceptional. Third, their H2H on clay shows Alcaraz winning the last two meetings comfortably. The risk is Rune's serve when firing — he can take a set if Alcaraz is slow to start.","kickoff":"13:00 UTC"}]`;}

}

function buildVolleyballPrompt(fixtures, targetPicks, minConf) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const blocks = fixtures.map((f, i) => formatVolleyball(f, i)).join("\n\n");

  return `You are a professional volleyball betting analyst with knowledge of international, European, and college volleyball. Today is ${today}.

You have REAL live data: team records and match details. USE THIS as your foundation. Supplement with your knowledge of these teams, tournaments, and volleyball patterns.

════════════════════════════════════════
FIXTURES WITH LIVE DATA (${fixtures.length} matches)
════════════════════════════════════════
${blocks}
════════════════════════════════════════

INTERNAL SCREENING — do this silently for every match:

A) RECORD ANALYSIS
   — Parse the win-loss record: 15-3 team vs 8-10 team = significant gap
   — Win % gap of 20%+ = consider favouring the stronger team
   — Consider the competition level: international matches are tighter than domestic

B) VOLLEYBALL PATTERNS
   — Dominant teams often win in 3 sets (3-0) — consider Under 3.5 Sets
   — Closely matched teams often go to 4 or 5 sets — consider Over 3.5 Sets
   — College volleyball is more volatile than international — factor this in
   — Nations League and international matches: national teams have pride at stake — usually fought hard

C) SETS MARKET LOGIC
   — If record gap is 30%+ win rate difference: 3-0 win likely — Under 3.5 Sets
   — If records are within 10%: expect 4-5 sets — Over 3.5 Sets
   — Home advantage in volleyball is real, especially college matches

D) THE 3-SIGNAL RULE
Must find 3 signals per pick:
  Home Win: (1) better record, (2) home advantage, (3) opponent's recent poor form
  Under 3.5 Sets: (1) large record gap, (2) stronger team's home court, (3) weaker team's poor away record
If 3 signals not found → SKIP

AVAILABLE MARKETS — use EXACT text:
• "Home Win" | "Away Win"
• "Over 3.5 Sets" | "Under 3.5 Sets"
• "Home Win in 3 Sets" | "Home Win in 4 Sets" | "Away Win in 3 Sets" | "Away Win in 4 Sets"
• "Home Win -1.5 Sets" | "Away Win +1.5 Sets"
• "Both Teams to Win a Set"

MARKET GUIDE:
→ Under 3.5 Sets: large record gap AND stronger team at home — dominant sweep likely
→ Over 3.5 Sets: closely matched records AND neither team dominant at home
→ Home Win: better record + home court — most reliable market in volleyball
→ Home Win in 3 Sets: clearly superior team at home by 20%+ win rate
→ Both Teams to Win a Set: competitive match, records within 10% — almost always hits
→ Set Handicap: use when one team is strong but you want cushion for a potential 5th set

RULES:
✓ Return 3 to ${targetPicks} picks — be very selective, volleyball data is limited
✓ Minimum ${minConf}% confidence
✓ Every pick needs 3 signals
✓ Star Pick = 90%+ only — massive record gap at home
✓ "Both Teams to Win a Set" is the safest volleyball market — use it for close matches
✗ If record data shows "?" for both teams, skip entirely

ANALYSIS: Quote records, identify the pattern, name 3 signals, state one risk.

Return ONLY a valid JSON array. Nothing else. No markdown.

[{"sport":"volleyball","country":"USA","league":"NCAA Women's Volleyball","homeTeam":"Nebraska Cornhuskers","awayTeam":"Penn State Nittany Lions","pick":"Under 3.5 Sets","market":"Sets","probability":"74","confidence":"High","starPick":false,"analysis":"Nebraska come in at 18-4 against Penn State's 14-8 — a meaningful gap at this stage of the season. Three signals support the sweep. First, Nebraska's home record is exceptional, having won 11 of their last 12 at the Devaney Center where the crowd creates a significant advantage. Second, Penn State have shown vulnerability away from home, losing 5 of their last 8 road matches and struggling to maintain their block game in hostile environments. Third, in their last three H2H meetings, Nebraska have won 3-0 or 3-1 twice, suggesting they match up particularly well against Penn State's offensive system. The risk is if Penn State's setter finds rhythm early and wins a set off Nebraska's serve receive — which is the one area Nebraska can be exploited.","kickoff":"23:00 UTC"}]`;
}

// ══════════════════════════════════════════════════════════════
//  GROQ CALL WITH RETRY
// ══════════════════════════════════════════════════════════════
async function callGroqWithRetry(prompt, apiKey, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method : "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body   : JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.25, max_tokens: 5000 }),
        signal : AbortSignal.timeout(60000),
      });

      if (res.status === 429) {
        const wait = (parseInt(res.headers.get("retry-after") || "15") + 2) * 1000;
        if (attempt < retries) { await sleep(wait); continue; }
        throw new Error(`RATE_LIMIT: Groq rate limit. Wait 1-2 minutes then try again.`);
      }
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

      const data = await res.json();
      let text = data.choices?.[0]?.message?.content || "";
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array in Groq response");
      return JSON.parse(match[0]);

    } catch (err) {
      if (err.message?.startsWith("RATE_LIMIT") || attempt === retries) throw err;
      await sleep(3000 * (attempt + 1));
    }
  }
  return [];
}

// ══════════════════════════════════════════════════════════════
//  ANALYSE A SPORT
// ══════════════════════════════════════════════════════════════
async function analyseSport(fixtures, sport, apiKey, minConf, maxPicks) {
  if (!fixtures.length) return [];

  const richFirst = [...fixtures].sort((a, b) => {
    const aRich = a.homeW !== "?" || a.p1Rank !== "?" ? 0 : 1;
    const bRich = b.homeW !== "?" || b.p1Rank !== "?" ? 0 : 1;
    return aRich - bRich;
  });

  const toAnalyse = richFirst.slice(0, MAX_BATCHES * BATCH_SIZE);
  const batches   = [];
  for (let i = 0; i < toAnalyse.length; i += BATCH_SIZE) {
    batches.push(toAnalyse.slice(i, i + BATCH_SIZE));
  }

  const picksPerBatch = Math.max(3, Math.ceil((maxPicks * 1.5) / batches.length));
  const allPicks = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      let prompt;
      if (sport === "basketball") prompt = buildBasketballPrompt(batch, picksPerBatch, minConf);
      else if (sport === "tennis") prompt = buildTennisPrompt(batch, picksPerBatch, minConf);
      else                         prompt = buildVolleyballPrompt(batch, picksPerBatch, minConf);

      const picks = await callGroqWithRetry(prompt, apiKey);
      for (const p of picks) {
        const prob = parseFloat(p.probability) || 0;
        if (prob < minConf) continue;
        // Normalise tennis fields to homeTeam/awayTeam for consistent UI
        const homeTeam = p.homeTeam || p.player1 || p.team1 || "";
        const awayTeam = p.awayTeam || p.player2 || p.team2 || "";
        if (!homeTeam || !awayTeam || !p.pick) continue;
        allPicks.push({
          sport      : sport,
          country    : p.country || p.tour || "",
          league     : p.league  || p.tournament || "",
          homeTeam,
          awayTeam,
          pick       : p.pick,
          market     : p.market     || "Other",
          probability: Math.min(99, Math.max(50, prob)),
          confidence : p.confidence || "Medium",
          starPick   : prob >= 90 || p.starPick === true,
          analysis   : p.analysis   || "",
          kickoff    : p.kickoff    || "",
        });
      }
    } catch (e) {
      console.error(`${sport} batch ${i + 1} error:`, e.message);
      if (e.message?.startsWith("RATE_LIMIT")) break;
    }
    if (i < batches.length - 1) await sleep(BATCH_DELAY);
  }

  // Sort: stars first → probability desc
  allPicks.sort((a, b) => {
    if (a.starPick && !b.starPick) return -1;
    if (!a.starPick && b.starPick) return 1;
    return b.probability - a.probability;
  });

  // Deduplicate
  const seen = new Set();
  return allPicks.filter(p => {
    const key = `${p.homeTeam}|${p.awayTeam}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, Math.max(4, maxPicks));
}

// ══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "POST only" });

  try {
    const { sport, fixtures = [], settings = {} } = req.body || {};

    const apiKey   = process.env.GROQ_API_KEY || settings.groqKey || "";
    const minConf  = parseInt(settings.minConfidence) || 70;
    const maxPicks = parseInt(settings.maxPicks)      || 10;

    if (!apiKey)   return res.status(400).json({ error: "No Groq API key. Add GROQ_API_KEY to Vercel environment variables or enter it in Settings." });
    if (!sport)    return res.status(400).json({ error: "No sport specified." });
    // Tennis allowed to proceed with 0 fixtures — Groq uses its own knowledge of today's schedule
    if (!fixtures.length && sport !== "tennis") return res.status(400).json({ error: "No fixtures provided." });

    const picks = await analyseSport(fixtures, sport, apiKey, minConf, maxPicks);

    if (!picks.length) {
      return res.status(200).json({
        picks: [], total: 0, starPicks: 0, sport,
        error: `No picks found for ${sport} today meeting your confidence threshold. Try lowering it in Settings.`,
        scannedAt: new Date().toISOString(),
        fixturesIn: fixtures.length,
      });
    }

    return res.status(200).json({
      picks,
      total      : picks.length,
      starPicks  : picks.filter(p => p.starPick).length,
      sport,
      scannedAt  : new Date().toISOString(),
      fixturesIn : fixtures.length,
    });

  } catch (err) {
    console.error("analyze-sports handler:", err);
    return res.status(500).json({ error: err.message });
  }
};
