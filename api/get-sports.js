// ============================================================
//  SportIntel — get-sports.js  (v3 — lean, timeout-safe)
//  Strategy:
//   Phase 1: Fetch ALL scoreboards in parallel (fixtures only)
//   Phase 2: ONLY fetch standings+form for leagues that have matches today
//   This reduces ESPN calls from 54 to ~6-10 total
// ============================================================

const TIMEOUT_MS = 5000;

const BASKETBALL_LEAGUES = [
  { slug: "nba",                       name: "NBA",           country: "USA"         },
  { slug: "wnba",                       name: "WNBA",          country: "USA"         },
  { slug: "mens-college-basketball",    name: "NCAA Men's",    country: "USA"         },
  { slug: "womens-college-basketball",  name: "NCAA Women's",  country: "USA"         },
  { slug: "euroleague",                 name: "EuroLeague",    country: "Europe"      },
  { slug: "eurocup",                    name: "EuroCup",       country: "Europe"      },
  { slug: "acb",                        name: "Liga ACB",      country: "Spain"       },
  { slug: "turkish-bsl",               name: "Turkish BSL",   country: "Turkey"      },
  { slug: "nbl",                        name: "NBL",           country: "Australia"   },
  { slug: "cba",                        name: "CBA",           country: "China"       },
  { slug: "kbl",                        name: "KBL",           country: "South Korea" },
  { slug: "bjl",                        name: "B.League",      country: "Japan"       },
  { slug: "g-league",                   name: "G League",      country: "USA"         },
];

const TENNIS_TOURS = [
  { slug: "atp", name: "ATP Tour",  type: "Men's"   },
  { slug: "wta", name: "WTA Tour",  type: "Women's" },
];

const VOLLEYBALL_LEAGUES = [
  { slug: "womens-college-volleyball", name: "NCAA Women's Volleyball", country: "USA",  gender: "women" },
  { slug: "mens-college-volleyball",   name: "NCAA Men's Volleyball",   country: "USA",  gender: "men"   },
  { slug: "vnl",                       name: "Nations League (W)",      country: "Intl", gender: "women" },
  { slug: "mens-vnl",                  name: "Nations League (M)",      country: "Intl", gender: "men"   },
];

// ── Quick scoreboard fetch — fixtures only, no enrichment yet ──
async function fetchScoreboard(sport, slug, dateStr) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${slug}/scoreboard?dates=${dateStr}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return { slug, events: [] };
    const data = await res.json();
    return { slug, events: data.events || [] };
  } catch { return { slug, events: [] }; }
}

// ── Standings fetch ─────────────────────────────────────────────
async function fetchStandings(sport, slug) {
  const map = {};
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${slug}/standings`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return map;
    const data = await res.json();
    const entries =
      data.standings?.entries ||
      data.children?.[0]?.standings?.entries || [];
    for (const e of entries) {
      const name = (e.team?.displayName || "").toLowerCase();
      if (!name) continue;
      const s = k => e.stats?.find(x => x.name === k || x.shortDisplayName?.toLowerCase() === k)?.value ?? null;
      map[name] = {
        position: s("rank") ?? s("playoffseed") ?? null,
        wins    : s("wins")        ?? s("w")   ?? null,
        losses  : s("losses")      ?? s("l")   ?? null,
        pct     : e.stats?.find(x => x.name === "winPercent")?.displayValue ?? null,
        ppg     : e.stats?.find(x => x.name === "avgPoints")?.displayValue  ?? null,
        oppPpg  : e.stats?.find(x => x.name === "avgPointsAllowed")?.displayValue ?? null,
        streak  : e.stats?.find(x => x.name === "streak")?.displayValue ?? "",
      };
    }
  } catch {}
  return map;
}

// ── Recent form fetch ───────────────────────────────────────────
async function fetchForm(sport, slug) {
  const map = {};
  try {
    const past = new Date(Date.now() - 21 * 86400000).toISOString().split("T")[0].replace(/-/g, "");
    const now  = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const res  = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${slug}/scoreboard?dates=${past}-${now}&limit=50`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return map;
    const data = await res.json();
    for (const ev of data.events || []) {
      if (ev.status?.type?.state !== "post") continue;
      const comps = ev.competitions?.[0]?.competitors;
      if (!comps || comps.length < 2) continue;
      const home = comps.find(c => c.homeAway === "home");
      const away = comps.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const hs = parseInt(home.score) || 0;
      const as_ = parseInt(away.score) || 0;
      const hk = (home.team?.displayName || "").toLowerCase();
      const ak = (away.team?.displayName || "").toLowerCase();
      if (!map[hk]) map[hk] = [];
      if (!map[ak]) map[ak] = [];
      map[hk].unshift({ r: hs > as_ ? "W" : hs < as_ ? "L" : "D", score: `${hs}-${as_}`, opp: away.team?.displayName || "", venue: "H" });
      map[ak].unshift({ r: as_ > hs ? "W" : as_ < hs ? "L" : "D", score: `${as_}-${hs}`, opp: home.team?.displayName || "", venue: "A" });
    }
  } catch {}
  return map;
}

function shortForm(arr) { return (arr||[]).slice(0,5).map(f=>f.r).join("") || "?????"; }
function detailedForm(arr) {
  if (!arr?.length) return "No data";
  return arr.slice(0,5).map(f=>`${f.r} ${f.score} vs ${f.opp} (${f.venue})`).join(" | ");
}

// ══════════════════════════════════════════════════════════════
//  BASKETBALL
// ══════════════════════════════════════════════════════════════
async function getBasketball(dateStr) {
  // Phase 1: all scoreboards in parallel
  const boards = await Promise.all(
    BASKETBALL_LEAGUES.map(l => fetchScoreboard("basketball", l.slug, dateStr))
  );

  // Only enrich leagues that actually have games today
  const active = boards.filter(b => b.events.some(e => e.status?.type?.state !== "post"));
  if (!active.length) return [];

  // Phase 2: standings + form only for active leagues
  const enriched = await Promise.all(
    active.map(async b => {
      const league = BASKETBALL_LEAGUES.find(l => l.slug === b.slug);
      const [standings, form] = await Promise.all([
        fetchStandings("basketball", b.slug),
        fetchForm("basketball", b.slug),
      ]);
      return { league, events: b.events, standings, form };
    })
  );

  const fixtures = [];
  for (const { league, events, standings, form } of enriched) {
    for (const event of events) {
      if (event.status?.type?.state === "post") continue;
      const comps = event.competitions?.[0]?.competitors;
      if (!comps || comps.length < 2) continue;
      const home = comps.find(c => c.homeAway === "home");
      const away = comps.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const hn = home.team?.displayName || "";
      const an = away.team?.displayName || "";
      const hSt = standings[hn.toLowerCase()] || {};
      const aSt = standings[an.toLowerCase()] || {};
      const hFm = form[hn.toLowerCase()] || [];
      const aFm = form[an.toLowerCase()] || [];
      fixtures.push({
        sport: "basketball", country: league.country, league: league.name,
        homeTeam: hn, awayTeam: an,
        kickoff: event.date ? new Date(event.date).toISOString().substring(11,16) + " UTC" : "",
        homePOS: hSt.position??"?", homeW: hSt.wins??"?", homeL: hSt.losses??"?",
        homePCT: hSt.pct??"?", homePPG: hSt.ppg??"?", homeOppPPG: hSt.oppPpg??"?",
        homeStreak: hSt.streak??"?", homeForm5: shortForm(hFm), homeFormFull: detailedForm(hFm),
        awayPOS: aSt.position??"?", awayW: aSt.wins??"?", awayL: aSt.losses??"?",
        awayPCT: aSt.pct??"?", awayPPG: aSt.ppg??"?", awayOppPPG: aSt.oppPpg??"?",
        awayStreak: aSt.streak??"?", awayForm5: shortForm(aFm), awayFormFull: detailedForm(aFm),
      });
    }
  }
  return fixtures;
}

// ══════════════════════════════════════════════════════════════
//  TENNIS
// ══════════════════════════════════════════════════════════════
async function getTennis(dateStr) {
  const fixtures = [];
  const seen     = new Set();

  for (const tour of TENNIS_TOURS) {
    const urls = [
      `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour.slug}/scoreboard`,
      `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour.slug}/scoreboard?dates=${dateStr}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.events?.length) continue;
        for (const event of data.events) {
          if (event.status?.type?.state === "post") continue;
          const comps = event.competitions?.[0]?.competitors;
          if (!comps || comps.length < 2) continue;
          const p1 = comps[0], p2 = comps[1];
          const p1n = p1.athlete?.displayName || p1.team?.displayName || "";
          const p2n = p2.athlete?.displayName || p2.team?.displayName || "";
          if (!p1n || !p2n) continue;
          const key = `${p1n}|${p2n}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const notes = event.competitions?.[0]?.notes || [];
          fixtures.push({
            sport: "tennis", tour: tour.name, tourType: tour.type,
            tournament: notes[0]?.headline || event.name || tour.name,
            surface: notes.find(n => n.headline?.match(/clay|grass|hard/i))?.headline || "",
            round: event.competitions?.[0]?.type?.text || "",
            player1: p1n, player2: p2n,
            p1Rank: p1.athlete?.ranking || p1.curatedRank?.current || "?",
            p2Rank: p2.athlete?.ranking || p2.curatedRank?.current || "?",
            p1Record: p1.records?.[0]?.summary || "",
            p2Record: p2.records?.[0]?.summary || "",
            kickoff: event.date ? new Date(event.date).toISOString().substring(11,16) + " UTC" : "",
          });
        }
        if (fixtures.filter(f => f.tour === tour.name).length > 0) break;
      } catch { continue; }
    }
  }
  return fixtures;
}

// ══════════════════════════════════════════════════════════════
//  VOLLEYBALL
// ══════════════════════════════════════════════════════════════
async function getVolleyball(dateStr) {
  const fixtures = [];
  const seen = new Set();

  await Promise.all(VOLLEYBALL_LEAGUES.map(async league => {
    const urls = [
      `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league.slug}/scoreboard`,
      `https://site.api.espn.com/apis/site/v2/sports/volleyball/${league.slug}/scoreboard?dates=${dateStr}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.events?.length) continue;
        for (const event of data.events) {
          if (event.status?.type?.state === "post") continue;
          const comps = event.competitions?.[0]?.competitors;
          if (!comps || comps.length < 2) continue;
          const home = comps.find(c => c.homeAway === "home") || comps[0];
          const away = comps.find(c => c.homeAway === "away") || comps[1];
          if (!home || !away) continue;
          const hn = home.team?.displayName || "";
          const an = away.team?.displayName || "";
          if (!hn || !an) continue;
          const key = `${hn}|${an}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          fixtures.push({
            sport: "volleyball", country: league.country, league: league.name, gender: league.gender,
            homeTeam: hn, awayTeam: an,
            homeRecord: home.records?.[0]?.summary || "",
            awayRecord: away.records?.[0]?.summary || "",
            homeRank: home.curatedRank?.current || "?",
            awayRank: away.curatedRank?.current || "?",
            kickoff: event.date ? new Date(event.date).toISOString().substring(11,16) + " UTC" : "",
          });
        }
        if (fixtures.filter(f => f.league === league.name).length > 0) break;
      } catch { continue; }
    }
  }));
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
  const cacheTTL = Math.min(21600, Math.floor((midnight - now) / 1000));

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", `public, s-maxage=${cacheTTL}, stale-while-revalidate=300`);

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const dateStr = today.replace(/-/g, "");

    // Run all 3 sports in parallel — each has its own internal timeout safety
    const [basketball, tennis, volleyball] = await Promise.all([
      getBasketball(dateStr).catch(() => []),
      getTennis(dateStr).catch(() => []),
      getVolleyball(dateStr).catch(() => []),
    ]);

    const sortKO = arr => [...arr].sort((a,b) => (a.kickoff||"").localeCompare(b.kickoff||""));

    return res.status(200).json({
      date      : today,
      basketball: sortKO(basketball),
      tennis    : sortKO(tennis),
      volleyball: sortKO(volleyball),
      totals    : { basketball: basketball.length, tennis: tennis.length, volleyball: volleyball.length },
    });

  } catch (err) {
    res.removeHeader("Cache-Control");
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
