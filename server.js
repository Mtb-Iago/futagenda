import http from "node:http";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import handler from "./api/jogos.js";
import fixtureEventos from "./api/fixture-eventos.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env (root) and api/.env (legacy location)
for (const envPath of [
  path.join(__dirname, ".env"),
  path.join(__dirname, "api", ".env")
]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function createResAdapter(nodeRes) {
  const adapter = {
    setHeader(name, value) {
      nodeRes.setHeader(name, value);
      return adapter;
    },
    status(code) {
      nodeRes.statusCode = code;
      return adapter;
    },
    end(chunk) {
      if (chunk !== undefined) nodeRes.end(chunk);
      else nodeRes.end();
    },
    json(payload) {
      setCorsHeaders(nodeRes);
      if (!nodeRes.getHeader("Content-Type")) {
        nodeRes.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      nodeRes.end(JSON.stringify(payload));
    }
  };
  return adapter;
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/jogos") {
    await handler(req, createResAdapter(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/fixture-eventos") {
    await fixtureEventos(req, createResAdapter(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    try {
      const html = await readFile(path.join(__dirname, "index.html"), "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    } catch {
      res.statusCode = 404;
      res.end("index.html não encontrado");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/styles.css") {
    try {
      const css = await readFile(path.join(__dirname, "styles.css"), "utf8");
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end(css);
    } catch {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "styles.css não encontrado. Rode: npm run build"
      );
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/manifest.json") {
    try {
      const json = await readFile(path.join(__dirname, "manifest.json"), "utf8");
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end(json);
    } catch {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("manifest.json não encontrado");
    }
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Not found" }));
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log(`API: http://localhost:${port}/api/jogos`);
});

