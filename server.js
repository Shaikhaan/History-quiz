// History Quest - HTTP Server
// ===========================
// Serves the frontend from public/ and a JSON API backed by SQLite.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { openDatabase } = require("./db");
const { seed } = require("./seed");
const { createGame, GameError, badges, PASS_PERCENT } = require("./game");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 10 * 1024;
const PLAYER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const db = openDatabase();
if (db.prepare("SELECT COUNT(*) AS n FROM lessons").get().n === 0) {
  const counts = seed(db);
  console.log(`Empty database seeded: ${counts.lessons} lessons, ${counts.questions} questions.`);
}
const game = createGame(db);

// Helpers
// =======

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new GameError(413, "Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new GameError(400, "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function requirePlayerId(value) {
  if (typeof value !== "string" || !PLAYER_ID_PATTERN.test(value)) {
    throw new GameError(400, "Missing or invalid playerId");
  }
  return value;
}

function requireInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new GameError(400, `Invalid ${name}`);
  return n;
}

// API Routes
// ==========

const routes = [
  ["GET", /^\/api\/meta$/, () => ({ badges, passPercent: PASS_PERCENT })],

  ["GET", /^\/api\/countries$/, () => game.listCountries()],

  ["GET", /^\/api\/lessons\/([a-z]+)\/(\d+)$/, (req, [country, level]) =>
    game.getLesson(country, requireInt(level, "level"))],

  ["GET", /^\/api\/players\/([^/]+)\/progress$/, (req, [playerId]) =>
    game.getProgress(requirePlayerId(playerId))],

  ["POST", /^\/api\/quizzes$/, (req, params, body) =>
    game.startQuiz(requirePlayerId(body.playerId), String(body.country || ""), requireInt(body.level, "level"))],

  ["POST", /^\/api\/quizzes\/(\d+)\/answers$/, (req, [quizId], body) => {
    if (typeof body.choice !== "string") throw new GameError(400, "Missing choice");
    return game.answerQuestion(requireInt(quizId, "quiz id"), requirePlayerId(body.playerId),
      requireInt(body.position, "position"), body.choice);
  }],

  ["POST", /^\/api\/quizzes\/(\d+)\/finish$/, (req, [quizId], body) =>
    game.finishQuiz(requireInt(quizId, "quiz id"), requirePlayerId(body.playerId))]
];

async function handleApi(req, res, pathname) {
  for (const [method, pattern, handler] of routes) {
    const match = pathname.match(pattern);
    if (!match) continue;
    if (req.method !== method) continue;
    try {
      const body = method === "POST" ? await readJsonBody(req) : {};
      sendJson(res, 200, handler(req, match.slice(1).map(decodeURIComponent), body));
    } catch (err) {
      if (err instanceof GameError) {
        sendJson(res, err.status, { error: err.message });
      } else {
        console.error(err);
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

// Static Files
// ============

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname);
  } else {
    serveStatic(req, res, pathname);
  }
});

server.listen(PORT, () => {
  console.log(`History Quest running at http://localhost:${PORT}`);
});
