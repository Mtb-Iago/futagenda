function getFixtureIdFromReq(req) {
    try {
        const u = new URL(req.url || "/", "http://localhost");
        const raw = u.searchParams.get("fixture");
        const id = raw === null || raw === "" ? NaN : parseInt(raw, 10);
        return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
        return null;
    }
}

function minuteLabel(ev) {
    const e = ev.time?.elapsed;
    if (e == null) return "—";
    const x = ev.time?.extra;
    return x ? `${e}+${x}'` : `${e}'`;
}

function mapGoal(ev) {
    return {
        minute: minuteLabel(ev),
        team: ev.team?.name ?? "",
        player: ev.player?.name ?? "—",
        assistName: ev.assist?.name ?? null,
        detail: ev.detail ?? ""
    };
}

function mapCard(ev) {
    return {
        minute: minuteLabel(ev),
        team: ev.team?.name ?? "",
        player: ev.player?.name ?? "—",
        detail: ev.detail ?? ""
    };
}

function apiErrors(data) {
    const err = data?.errors;
    if (err == null) return null;
    if (typeof err === "object" && Object.keys(err).length > 0) return err;
    return null;
}

function buildHeaders(API_KEY) {
    return {
        "x-apisports-key": API_KEY,
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io"
    };
}

async function fetchJson(url, headers) {
    const response = await fetch(url, { headers });
    const data = await response.json().catch(() => null);
    return { response, data };
}

export default async function handler(req, res) {
    const API_KEY = process.env.API_KEY;

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

        const fixtureId = getFixtureIdFromReq(req);
        if (!fixtureId) {
            res.status(400).json({ error: "Parâmetro fixture inválido" });
            return;
        }

        if (!API_KEY) {
            res.status(500).json({ error: "API_KEY não configurada" });
            return;
        }

        const headers = buildHeaders(API_KEY);

        /** Documentação: GET /fixtures?id= também embute eventos (às vezes mais confiável que /fixtures/events). */
        const detailUrl = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
        const { response: rDetail, data: dDetail } = await fetchJson(detailUrl, headers);

        if (apiErrors(dDetail)) {
            res.status(502).json({
                error: "API externa retornou erro",
                details: dDetail.errors
            });
            return;
        }

        if (!rDetail.ok) {
            res.status(502).json({
                error: "Falha ao buscar partida",
                status: rDetail.status,
                details: dDetail
            });
            return;
        }

        const row = Array.isArray(dDetail?.response) ? dDetail.response[0] : null;
        if (!row) {
            res.status(404).json({ error: "Partida não encontrada", fixtureId });
            return;
        }

        let events = [];
        if (Array.isArray(row.events)) {
            events = row.events;
        } else {
            const evUrl = `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`;
            const { response: rEv, data: dEv } = await fetchJson(evUrl, headers);
            if (rEv.ok && Array.isArray(dEv?.response) && !apiErrors(dEv)) {
                events = dEv.response;
            }
        }

        const goals = [];
        const cards = [];

        for (const ev of events) {
            if (ev.type === "Goal") goals.push(mapGoal(ev));
            else if (ev.type === "Card") cards.push(mapCard(ev));
        }

        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
        res.status(200).json({ fixtureId, goals, cards });
    } catch (error) {
        res.status(500).json({
            error: "Erro ao buscar eventos",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
