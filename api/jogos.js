const TZ = "America/Sao_Paulo";
const MAX_DAY_OFFSET = 7;

const LIVE_STATUSES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"]);

function todayYmdInTz(timeZone) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

/** Adiciona dias a um YYYY-MM-DD interpretando meio-dia UTC para evitar virada estranha. */
function addDaysToYmdInTz(ymd, days, timeZone) {
    const [Y, M, D] = ymd.split("-").map(Number);
    const utcMs = Date.UTC(Y, M - 1, D + days, 12, 0, 0);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date(utcMs));
}

function getDayOffsetFromReq(req) {
    try {
        const u = new URL(req.url || "/", "http://localhost");
        const raw = u.searchParams.get("offset");
        const n = raw === null || raw === "" ? 0 : parseInt(raw, 10);
        if (!Number.isFinite(n)) return 0;
        return Math.min(MAX_DAY_OFFSET, Math.max(0, n));
    } catch {
        return 0;
    }
}

export default async function handler(req, res) {
    const API_KEY = process.env.API_KEY
    const dayOffset = getDayOffsetFromReq(req);
    const dateForApi = addDaysToYmdInTz(todayYmdInTz(TZ), dayOffset, TZ);
    const url = `https://v3.football.api-sports.io/fixtures?date=${dateForApi}&timezone=${encodeURIComponent(TZ)}`
    const channelMap = {
        "Copa do Brasil": "Globo, Sportv, Premiere",
        "CONMEBOL Libertadores": "Globo, ESPN, Star+, Paramount+",
        "UEFA Champions League": "SBT, TNT, Max",
        "Serie A": "Globo, Premiere",
        "CONMEBOL Sudamericana": "ESPN, Star+, Paramount+"
    };

    try {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).end();
            return;
        }

        if (req.method && req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }

        if (!API_KEY) {
            res.status(500).json({ error: "API_KEY não configurada" });
            return;
        }

        const response = await fetch(url, {
            headers: {
                "x-apisports-key": API_KEY,
                "x-rapidapi-key": API_KEY,
                "x-rapidapi-host": "v3.football.api-sports.io"
            }
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            res.status(502).json({
                error: "Falha ao chamar API externa",
                status: response.status,
                details: data
            });
            return;
        }
        
        const fixtures = Array.isArray(data.response) ? data.response : [];

        const filtered = fixtures
            .filter(f => Object.keys(channelMap).includes(f.league.name))
            .map(f => {
                const statusShort = f.fixture?.status?.short ?? "NS";
                const gh = f.goals?.home;
                const ga = f.goals?.away;
                const hasScore =
                    gh !== null &&
                    gh !== undefined &&
                    ga !== null &&
                    ga !== undefined;
                return {
                    fixtureId: f.fixture.id,
                    competition: f.league.name,
                    date: dateForApi,
                    dayOffset,
                    time: f.fixture.date.split("T")[1].substring(0, 5),
                    statusShort,
                    isLive: LIVE_STATUSES.has(statusShort),
                    homeGoals: hasScore ? gh : null,
                    awayGoals: hasScore ? ga : null,
                    homeTeam: f.teams.home.name,
                    homeLogo: f.teams.home.logo ?? null,
                    awayTeam: f.teams.away.name,
                    awayLogo: f.teams.away.logo ?? null,
                    channels: channelMap[f.league.name] || "Consultar Guia Local"
                };
            })
            .sort((a, b) => a.time.localeCompare(b.time));

        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
        res.status(200).json(filtered);
    } catch (error) {
        res.status(500).json({
            error: "Erro ao buscar jogos",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}