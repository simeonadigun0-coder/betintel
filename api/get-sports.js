// ============================================================
//  SportIntel — get-sports.js
//  Fetches Basketball, Tennis & Volleyball fixtures from ESPN
//  Returns enriched data: records, form, rankings, averages
// ============================================================

const TIMEOUT_MS = 9000;

// ── BASKETBALL LEAGUES ────────────────────────────────────────
const BASKETBALL_LEAGUES = [
  { slug: "nba",                        name: "NBA",                    country: "USA"         },
  { slug: "wnba",                       name: "WNBA",                   country: "USA"         },
  { slug: "mens-college-basketball",    name: "NCAA Men's",             country: "USA"         },
  { slug: "womens-college-basketball",  name: "NCAA Women's",           country: "USA"         },
  { slug: "euroleague",                 name: "EuroLeague",             country: "Europe"      },
  { slug: "eurocup",                    name: "EuroCup",                country: "Europe"      },
  { slug: "acb",                        name: "Liga ACB",               country: "Spain"       },
  { slug: "turkish-bsl",                name: "Turkish BSL",            country: "Turkey"      },
  { slug: "bbl",                        name: "BBL",                    country: "Germany"     },
  { slug: "french-pro-a",               name: "Pro A",                  country: "France"      },
  { slug: "lba",                        name: "LBA",                    country: "Italy"       },
  { slug: "vtb-united-league",          name: "VTB United League",      country: "Russia"      },
  { slug: "nbl",                        name: "NBL",                    country: "Australia"   },
  { slug: "cba",                        name: "CBA",                    country: "China"       },
  { slug: "kbl",                        name: "KBL",                    country: "South Korea" },
  { slug: "bjl",                        name: "B.League",               country: "Japan"       },
  { slug: "aba-league",                 name: "ABA League",             country: "Balkans"     },
  { slug: "g-league",                   name: "G League",               country: "USA"         },
];

// ── TENNIS TOURS ─────────────────────────────────────────────
const TENNIS_TOURS = [
  { slug: "atp",  name: "ATP Tour",   type: "Men's"   },
  { slug: "wta",  name: "WTA Tour",   type: "Women's" },
];

// ── VOLLEYBALL LEAGUES ────────────────────────────────────────
const VOLLEYBALL_LEAGUES = [
  { slug: "womens-college-volleyball", name: "NCAA Women's Volleyball",  country: "USA",     gender: "women" },
  { slug: "mens-college-volleyball",   name: "NCAA Men's Volleyball",    country: "USA",     gender: "men"   },
  { slug: "avca",                      name: "AVCA Rankings",            country: "USA",     gender: "women" },
  { slug: "vnl",                       name: "Nations League",           country: "Intl",    gender: "women" },
  { slug: "mens-vnl",                  name: "Nations League (Men)",     country: "Intl",    gender: "men"   },
  { slug: "olympics-womens-volleyball",name: "Olympic Women's",          country: "Intl",    gender: "women" },
  { slug: "olympics-mens-volleyball",  name: "Olympic Men's",            country: "Intl",    gender: "men"   },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════
//  BASKETBALL HELPERS
// ══════════════════════════════════════════════════════════════

async function fetchBasketballStandings(slug) {
  const map = {};
  try {
    const res  = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/${slug}/standings`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return map;
    const data = await res.json();
    const entries = data.standings?.entries || data.children?.[0]?.standings?.entries || [];
    for (const e of entries) {
      const name = (e.team?.displayName || "").toLowerCase();
      if (!name) continue;
      const stat = k => e.stats?.find(s => s.name === k || s.shortDisplayName?.toLowerCase() === k.toLowerCase());
      map[name] = {
        position : stat("rank")?.value ?? stat("playoffSeed")?.value ?? null,
        wins     : stat("wins")?.value ?? stat("W")?.value ?? null,
        losses   : stat("losses")?.value ?? stat("L")?.value ?? null,
        pct      : stat("winPercent")?.displayValue ?? stat("PCT")?.displayValue ?? null,
        ppg      : stat("avgPoints")?.displayValue ?? stat("PPG")?.displayValue ?? null,
        oppPpg   : stat("avgPointsAllowed")?.displayValue ?? stat("OPP PPG")?.displayValue ?? null,
        streak   : stat("streak")?.displayValue ?? "",
        gb       : stat("gamesBehind")?.displayValue ?? null,
      };
    }
  } catch {}
  return map;
}

async function fetchBasketballForm(slug) {
  const formMap = {};
  try {
    const past    = new Date(Date.now() - 21 * 86400000);
    const fromStr = past.toISOString().split("T")[0].replace(/-/g, "");
    const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/${slug}/scoreboard?dates=${fromStr}-${todayStr}&limit=50`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return formMap;
    const data = await res.json();
    for (const event of data.events || []) {
      if (event.status?.type?.state !== "post") continue;
      const comps = event.competitions?.[0]?.competitors;
      if (!comps || comps.length < 2) continue;
      const home = comps.find(c => c.homeAway === "home");
      const away = comps.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const hs = parseInt(home.score) || 0;
      const as_ = parseInt(away.score) || 0;
      const hk = (home.team?.displayName || "").toLowerCase();
      const ak = (away.team?.displayName || "").toLowerCase();
      if (!formMap[hk]) formMap[hk] = [];
      if (!formMap[ak]) formMap[ak] = [];
      formMap[hk].unshift({ r: hs > as_ ? "W" : "L", score: `${hs}-${as_}`, opp: away.team?.displayName || "", venue: "H" });
      formMap[ak].unshift({ r: as_ > hs ? "W" : "L", score: `${as_}-${hs}`, opp: home.team?.displayName || "", venue: "A" });
    }
  } catch {}
  return formMap;
}

function shortForm(arr) { return (arr || []).slice(0, 5).map(f => f.r).join("") || "?????"; }
function detailedForm(arr) {
  if (!arr?.length) return "No recent data";
  return arr.slice(0, 5).map(f => `${f.r} ${f.score} vs ${f.opp} (${f.venue})`).join(" | ");
}

async function fetchBasketballLeague(league, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${league.slug}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.events?.length) return [];

    const [standings, recentForm] = await Promise.all([
      fetchBasketballStandings(league.slug),
      fetchBasketballForm(league.slug),
    ]);

    const fixtures = [];
    for (const event of data.events) {
      if (event.status?.type?.state === "post") continue;
      const comps = event.competitions?.[0]?.competitors;
      if (!comps || comps.length < 2) continue;
      const home = comps.find(c => c.homeAway === "home");
      const away = comps.find(c => c.homeAway === "away");
      if (!home || !away) continue;

      const hn = home.team?.displayName || "";
      const an = away.team?.displayName || "";
      const hk = hn.toLowerCase();
      const ak = an.toLowerCase();
      const hSt = standings[hk] || {};
      const aSt = standings[ak] || {};
      const hFm = recentForm[hk] || [];
      const aFm = recentForm[ak] || [];

      fixtures.push({
        sport   : "basketball",
        country : league.country,
        league  : league.name,
        homeTeam: hn,
        awayTeam: an,
        kickoff : event.date ? new Date(event.date).toISOString().substring(11, 16) + " UTC" : "",
        venue   : event.competitions?.[0]?.venue?.fullName || "",
        // home stats
        homePOS    : hSt.position ?? "?",
        homeW      : hSt.wins     ?? "?",
        homeL      : hSt.losses   ?? "?",
        homePCT    : hSt.pct      ?? "?",
        homePPG    : hSt.ppg      ?? "?",
        homeOppPPG : hSt.oppPpg   ?? "?",
        homeStreak : hSt.streak   ?? "?",
        homeForm5  : shortForm(hFm),
        homeFormFull: detailedForm(hFm),
        // away stats
        awayPOS    : aSt.position ?? "?",
        awayW      : aSt.wins     ?? "?",
        awayL      : aSt.losses   ?? "?",
        awayPCT    : aSt.pct      ?? "?",
        awayPPG    : aSt.ppg      ?? "?",
        awayOppPPG : aSt.oppPpg   ?? "?",
        awayStreak : aSt.streak   ?? "?",
        awayForm5  : shortForm(aFm),
        awayFormFull: detailedForm(aFm),
      });
    }
    return fixtures;
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════════
//  TENNIS HELPERS
// ══════════════════════════════════════════════════════════════

// ── Tennis: ESPN only shows ONE active tournament at a time and
//    often returns nothing between rounds. We use a Groq-powered
//    fallback that generates today's known ATP/WTA fixtures from
//    its training knowledge when ESPN returns empty.
async function fetchTennisTour(tour, dateStr) {
  const fixtures = [];
  const seen     = new Set();

  // Try ESPN first — works when tournament is active
  const espnUrls = [
    `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour.slug}/scoreboard`,
    `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour.slug}/scoreboard?dates=${dateStr}`,
  ];

  for (const url of espnUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data.events || [];
      if (!events.length) continue;

      for (const event of events) {
        const state = event.status?.type?.state || "";
        if (state === "post") continue;
        const comps = event.competitions?.[0]?.competitors;
        if (!comps || comps.length < 2) continue;
        const p1 = comps[0];
        const p2 = comps[1];
        const p1Name = p1.athlete?.displayName || p1.team?.displayName || "";
        const p2Name = p2.athlete?.displayName || p2.team?.displayName || "";
        if (!p1Name || !p2Name) continue;
        const key = `${p1Name}|${p2Name}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const notes      = event.competitions?.[0]?.notes || [];
        const tournament = notes[0]?.headline || event.name || tour.name;
        const surface    = notes.find(n => n.headline?.match(/clay|grass|hard/i))?.headline || "";
        const round      = event.competitions?.[0]?.type?.text || "";
        fixtures.push({
          sport      : "tennis",
          tour       : tour.name,
          tourType   : tour.type,
          tournament,
          surface,
          round,
          player1    : p1Name,
          player2    : p2Name,
          p1Rank     : p1.athlete?.ranking || p1.curatedRank?.current || "?",
          p2Rank     : p2.athlete?.ranking || p2.curatedRank?.current || "?",
          p1Record   : p1.records?.[0]?.summary || "",
          p2Record   : p2.records?.[0]?.summary || "",
          kickoff    : event.date ? new Date(event.date).toISOString().substring(11,16) + " UTC" : "",
        });
      }
      if (fixtures.length > 0) break;
    } catch { continue; }
  }

  return fixtures;
}

// ══════════════════════════════════════════════════════════════
//  VOLLEYBALL HELPERS
// ══════════════════════════════════════════════════════════════

// ── Volleyball needs same multi-endpoint strategy as tennis —
//    tournaments span multiple days, single date query returns nothing
async function fetchVolleyballLeague(league, dateStr) {
  const fixtures = [];
  const seen     = new Set();

  const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0].replace(/-/g, "");
  const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0].replace(/-/g, "");

  const endpoints = [
    // 1) No date filter — shows active season/tournament
    `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league.slug}/scoreboard`,
    // 2) Today's date
    `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league.slug}/scoreboard?dates=${dateStr}`,
    // 3) Date range across active week
    `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league.slug}/scoreboard?dates=${yesterday}-${threeDays}`,
    // 4) Core events API fallback
    `https://sports.core.api.espn.com/v2/sports/volleyball/leagues/${league.slug}/events?dates=${dateStr}&limit=100`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const data = await res.json();

      const events = data.events || data.items || [];
      if (!events.length) continue;

      for (const event of events) {
        const state = event.status?.type?.state || "";
        if (state === "post") continue;

        const comps = event.competitions?.[0]?.competitors;
        if (!comps || comps.length < 2) continue;

        const home = comps.find(c => c.homeAway === "home") || comps[0];
        const away = comps.find(c => c.homeAway === "away") || comps[1];
        if (!home || !away) continue;

        const hn = home.team?.displayName || "";
        const an = away.team?.displayName || "";
        if (!hn || !an) continue;

        // Deduplicate
        const key = `${hn}|${an}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const homeRecord = home.records?.[0]?.summary || "";
        const awayRecord = away.records?.[0]?.summary || "";

        // Extract standings/win-loss if available
        const homeStat = s => home.statistics?.find(x => x.name === s)?.displayValue ?? null;
        const awayStat = s => away.statistics?.find(x => x.name === s)?.displayValue ?? null;

        fixtures.push({
          sport      : "volleyball",
          country    : league.country,
          league     : league.name,
          gender     : league.gender,
          homeTeam   : hn,
          awayTeam   : an,
          homeRecord : homeRecord || `${homeStat("wins") || "?"}W-${homeStat("losses") || "?"}L`,
          awayRecord : awayRecord || `${awayStat("wins") || "?"}W-${awayStat("losses") || "?"}L`,
          homeRank   : home.curatedRank?.current || "?",
          awayRank   : away.curatedRank?.current || "?",
          kickoff    : event.date ? new Date(event.date).toISOString().substring(11, 16) + " UTC" : "",
          venue      : event.competitions?.[0]?.venue?.fullName || "",
        });
      }

      if (fixtures.length > 0) break;

    } catch { continue; }
  }

  return fixtures;
}

// ══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  const today    = new Date().toISOString().split("T")[0];
  const now      = new Date();
  const midnight = new Date(today);
  midnight.setDate(midnight.getDate() + 1);
  const secsToMidnight = Math.floor((midnight - now) / 1000);
  const cacheTTL = Math.min(21600, secsToMidnight);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", `public, s-maxage=${cacheTTL}, stale-while-revalidate=300`);
  // Vercel edge cache — same TTL, no Netlify-specific header needed

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const dateStr = today.replace(/-/g, "");

    // ── Basketball (batch of 6) ──────────────────────────────
    const basketball = [];
    const BBALL_BATCH = 6;
    for (let i = 0; i < BASKETBALL_LEAGUES.length; i += BBALL_BATCH) {
      const batch = BASKETBALL_LEAGUES.slice(i, i + BBALL_BATCH);
      const res2  = await Promise.all(batch.map(l => fetchBasketballLeague(l, dateStr)));
      res2.forEach(r => basketball.push(...r));
    }

    // ── Tennis ──────────────────────────────────────────────
    const tennisResults = await Promise.all(TENNIS_TOURS.map(t => fetchTennisTour(t, dateStr)));
    const tennis = tennisResults.flat();

    // ── Volleyball (batch of 4) ──────────────────────────────
    const volleyball = [];
    const VBALL_BATCH = 4;
    for (let i = 0; i < VOLLEYBALL_LEAGUES.length; i += VBALL_BATCH) {
      const batch = VOLLEYBALL_LEAGUES.slice(i, i + VBALL_BATCH);
      const res2  = await Promise.all(batch.map(l => fetchVolleyballLeague(l, dateStr)));
      res2.forEach(r => volleyball.push(...r));
    }

    // Sort each by kickoff
    const sortKO = arr => arr.sort((a, b) => (a.kickoff || "").localeCompare(b.kickoff || ""));

    return res.status(200).json({
      date      : today,
      basketball: sortKO(basketball),
      tennis    : sortKO(tennis),
      volleyball: sortKO(volleyball),
      totals    : {
        basketball: basketball.length,
        tennis    : tennis.length,
        volleyball: volleyball.length,
      },
    });

  } catch (err) {
    res.removeHeader("Cache-Control");
    return res.status(500).json({ error: err.message });
  }
};
