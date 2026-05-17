// ============================================================
//  BetIntel — get-fixtures.js
//  Fetches today's football fixtures from ESPN public API
//  Runs server-side to avoid CORS, no API key needed
// ============================================================

const FOOTBALL_LEAGUES = [
  { slug: "eng.1",           name: "Premier League",              country: "England"      },
  { slug: "eng.2",           name: "Championship",                country: "England"      },
  { slug: "esp.1",           name: "La Liga",                     country: "Spain"        },
  { slug: "esp.2",           name: "Segunda Division",            country: "Spain"        },
  { slug: "ger.1",           name: "Bundesliga",                  country: "Germany"      },
  { slug: "ger.2",           name: "2. Bundesliga",               country: "Germany"      },
  { slug: "ita.1",           name: "Serie A",                     country: "Italy"        },
  { slug: "ita.2",           name: "Serie B",                     country: "Italy"        },
  { slug: "fra.1",           name: "Ligue 1",                     country: "France"       },
  { slug: "fra.2",           name: "Ligue 2",                     country: "France"       },
  { slug: "ned.1",           name: "Eredivisie",                  country: "Netherlands"  },
  { slug: "por.1",           name: "Primeira Liga",               country: "Portugal"     },
  { slug: "sco.1",           name: "Scottish Premiership",        country: "Scotland"     },
  { slug: "bel.1",           name: "Belgian Pro League",          country: "Belgium"      },
  { slug: "tur.1",           name: "Turkish Süper Lig",           country: "Turkey"       },
  { slug: "mex.1",           name: "Liga MX",                     country: "Mexico"       },
  { slug: "usa.1",           name: "MLS",                         country: "USA"          },
  { slug: "bra.1",           name: "Brasileirao",                 country: "Brazil"       },
  { slug: "arg.1",           name: "Argentine Primera",           country: "Argentina"    },
  { slug: "jpn.1",           name: "J1 League",                   country: "Japan"        },
  { slug: "pol.1",           name: "Ekstraklasa",                 country: "Poland"       },
  { slug: "gre.1",           name: "Greek Super League",          country: "Greece"       },
  { slug: "aus.1",           name: "A-League",                    country: "Australia"    },
  { slug: "sau.1",           name: "Saudi Pro League",            country: "Saudi Arabia" },
  { slug: "chn.1",           name: "Chinese Super League",        country: "China"        },
  { slug: "kor.1",           name: "K League 1",                  country: "South Korea"  },
  { slug: "rus.1",           name: "Russian Premier League",      country: "Russia"       },
  { slug: "ukr.1",           name: "Ukrainian Premier League",    country: "Ukraine"      },
  { slug: "den.1",           name: "Danish Superliga",            country: "Denmark"      },
  { slug: "swe.1",           name: "Allsvenskan",                 country: "Sweden"       },
  { slug: "nor.1",           name: "Eliteserien",                 country: "Norway"       },
  { slug: "sui.1",           name: "Swiss Super League",          country: "Switzerland"  },
  { slug: "aut.1",           name: "Austrian Bundesliga",         country: "Austria"      },
  { slug: "cze.1",           name: "Czech First League",          country: "Czech Rep"    },
  { slug: "rou.1",           name: "Romanian Liga 1",             country: "Romania"      },
  { slug: "srb.1",           name: "Serbian SuperLiga",           country: "Serbia"       },
  { slug: "cro.1",           name: "Croatian HNL",                country: "Croatia"      },
  { slug: "nga.1",           name: "Nigerian NPFL",               country: "Nigeria"      },
  { slug: "zaf.1",           name: "South African PSL",           country: "South Africa" },
  { slug: "egy.1",           name: "Egyptian Premier League",     country: "Egypt"        },
  { slug: "col.1",           name: "Colombian Primera A",         country: "Colombia"     },
  { slug: "chl.1",           name: "Chilean Primera",             country: "Chile"        },
  { slug: "uefa.champions",  name: "UEFA Champions League",       country: "Europe"       },
  { slug: "uefa.europa",     name: "UEFA Europa League",          country: "Europe"       },
  { slug: "uefa.conference", name: "UEFA Conference League",      country: "Europe"       },
];

async function fetchLeague(league, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard?dates=${dateStr}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.events?.length) return [];

    const fixtures = [];
    for (const event of data.events) {
      const state = event.status?.type?.state || "";
      // Skip in-progress or finished matches
      if (state === "post" || state === "in") continue;

      const competitors = event.competitions?.[0]?.competitors;
      if (!competitors || competitors.length < 2) continue;

      const home = competitors.find(c => c.homeAway === "home");
      const away = competitors.find(c => c.homeAway === "away");
      if (!home || !away) continue;

      // Grab records if available (e.g. "12-5-4")
      const homeRecord = home.records?.[0]?.summary || "";
      const awayRecord = away.records?.[0]?.summary || "";
      const homeWins   = home.records?.[0]?.stats?.find(s => s.name === "wins")?.value;
      const awayWins   = away.records?.[0]?.stats?.find(s => s.name === "wins")?.value;

      fixtures.push({
        id         : event.id,
        country    : league.country,
        league     : league.name,
        homeTeam   : home.team.displayName,
        awayTeam   : away.team.displayName,
        homeRecord : homeRecord,
        awayRecord : awayRecord,
        homeRank   : home.curatedRank?.current || null,
        awayRank   : away.curatedRank?.current || null,
        startTime  : event.date,
        venue      : event.competitions?.[0]?.venue?.fullName || "",
      });
    }
    return fixtures;
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Get today's date in yyyyMMdd format (UTC)
    const now     = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");

    // Fetch all leagues in parallel (batches of 10 to be polite)
    const BATCH = 10;
    const allFixtures = [];

    for (let i = 0; i < FOOTBALL_LEAGUES.length; i += BATCH) {
      const batch   = FOOTBALL_LEAGUES.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(l => fetchLeague(l, dateStr)));
      results.forEach(r => allFixtures.push(...r));
    }

    // Sort by kick-off time
    allFixtures.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        date    : now.toISOString().split("T")[0],
        total   : allFixtures.length,
        fixtures: allFixtures,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
