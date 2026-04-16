import Redis from "ioredis";

let redis;

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
    const API_KEY = process.env.API_KEY;
    if (!redis && process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, {
            tls: process.env.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined
        });
    }
    const dayOffset = getDayOffsetFromReq(req);
    const dateForApi = addDaysToYmdInTz(todayYmdInTz(TZ), dayOffset, TZ);
    const url = `https://v3.football.api-sports.io/fixtures?date=${dateForApi}&timezone=${encodeURIComponent(TZ)}`;

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

        if (req.method === "OPTIONS") return res.status(204).end();
        if (req.method && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        if (!API_KEY) return res.status(500).json({ error: "API_KEY não configurada" });
        if (!process.env.REDIS_URL) return res.status(500).json({ error: "REDIS_URL não configurada" });

        // --- 1. LÊ DO REDIS ---
        const cacheKey = `jogos_${dateForApi}`;
        const cachedString = await redis.get(cacheKey);

        if (cachedString) {
            console.log(`[REDIS HIT] Dados recuperados do cache para: ${dateForApi}`);
            res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
            // Transforma a string salva de volta em JSON
            return res.status(200).json(JSON.parse(cachedString));
        }

        // --- 2. BUSCA NA API (SE NÃO TIVER NO CACHE) ---
        console.log(`[REDIS MISS] Buscando na API externa para: ${dateForApi}`);
        const response = await fetch(url, {
            headers: {
                "x-apisports-key": API_KEY,
                "x-rapidapi-key": API_KEY,
                "x-rapidapi-host": "v3.football.api-sports.io"
            }
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            return res.status(502).json({ error: "Falha ao chamar API", details: data });
        }

        const fixtures = Array.isArray(data.response) ? data.response : [];
        const filtered = fixtures
            .filter(f => Object.keys(channelMap).includes(f.league.name))
            .map(f => {
                const statusShort = f.fixture?.status?.short ?? "NS";
                const gh = f.goals?.home;
                const ga = f.goals?.away;
                const hasScore = gh !== null && gh !== undefined && ga !== null && ga !== undefined;
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

        // --- 3. SALVA NO REDIS ---
        const hasLiveGames = filtered.some(f => f.isLive);
        const ttlSeconds = hasLiveGames ? 120 : 3600;

        // Salva transformando em String. O "EX" diz que o próximo número é o tempo de expiração em segundos
        await redis.set(cacheKey, JSON.stringify(filtered), "EX", ttlSeconds);

        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
        res.status(200).json(filtered);

    } catch (error) {
        res.status(500).json({
            error: "Erro ao buscar jogos",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}