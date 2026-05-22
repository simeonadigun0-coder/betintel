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

async function fetchTennisTour(tour, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour.slug}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.events?.length) return [];

    const fixtures = [];
    for (const event of data.events) {
      if (event.status?.type?.state === "post") continue;
      const comps = event.competitions?.[0]?.competitors;
      if (!comps || comps.length < 2) continue;

      const p1 = comps[0];
      const p2 = comps[1];
      if (!p1 || !p2) continue;

      const p1Name = p1.athlete?.displayName || p1.team?.displayName || "Player 1";
      const p2Name = p2.athlete?.displayName || p2.team?.displayName || "Player 2";

      // Ranking from athlete object
      const p1Rank = p1.athlete?.ranking || p1.curatedRank?.current || "?";
      const p2Rank = p2.athlete?.ranking || p2.curatedRank?.current || "?";

      // Win/loss records
      const p1Record = p1.records?.[0]?.summary || p1.athlete?.record || "";
      const p2Record = p2.records?.[0]?.summary || p2.athlete?.record || "";

      const round      = event.competitions?.[0]?.type?.text || event.name || "";
      const tournament = event.competitions?.[0]?.notes?.[0]?.headline || event.league?.name || tour.name;
      const surface    = event.competitions?.[0]?.notes?.find(n => n.type === "surface")?.headline || "";

      fixtures.push({
        sport      : "tennis",
        tour       : tour.name,
        tourType   : tour.type,
        tournament,
        surface,
        round,
        player1    : p1Name,
        player2    : p2Name,
        p1Rank,
        p2Rank,
        p1Record,
        p2Record,
        kickoff    : event.date ? new Date(event.date).toISOString().substring(11, 16) + " UTC" : "",
      });
    }
    return fixtures;
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════════
//  VOLLEYBALL HELPERS
// ══════════════════════════════════════════════════════════════

async function fetchVolleyballLeague(league, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league.slug}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.events?.length) return [];

    const fixtures = [];
    for (const event of data.events) {
      if (event.status?.type?.state === "post") continue;
      const comps = event.competitions?.[0]?.competitors;
      if (!comps || comps.length < 2) continue;
      const home = comps.find(c => c.homeAway === "home") || comps[0];
      const away = comps.find(c => c.homeAway === "away") || comps[1];
      if (!home || !away) continue;

      const hn = home.team?.displayName || "";
      const an = away.team?.displayName || "";

      const homeRecord = home.records?.[0]?.summary || "";
      const awayRecord = away.records?.[0]?.summary || "";

      fixtures.push({
        sport      : "volleyball",
        country    : league.country,
        league     : league.name,
        gender     : league.gender,
        homeTeam   : hn,
        awayTeam   : an,
        homeRecord,
        awayRecord,
        kickoff    : event.date ? new Date(event.date).toISOString().substring(11, 16) + " UTC" : "",
        venue      : event.competitions?.[0]?.venue?.fullName || "",
      });
    }
    return fixtures;
  } catch { return []; }
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
