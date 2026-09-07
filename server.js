#!/usr/bin/env node
/* nickberdi.ch — kleiner Server fuer den Admin-Bereich.
   Ohne Abhaengigkeiten, nur Node-Bordmittel.

   Starten:          node server.js
   Passwort setzen:  node server.js --set-password nick "langes-passwort"
   Benutzer loeschen: node server.js --remove-user nick

   Der Server liefert die Website aus und nimmt unter /api/* die Anmeldung
   und das Speichern von data/content.js entgegen. Ohne ihn bleibt die Seite
   eine ganz normale statische Website. */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const USERS_FILE = path.join(ROOT, "data", "admin-users.json");
const CONTENT_FILE = path.join(ROOT, "data", "content.js");
const BACKUP_DIR = path.join(ROOT, "data", "backups");
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_MS = 8 * 60 * 60 * 1000;

/* ------------------------------ Benutzer -------------------------------- */
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); }
  catch { return {}; }
}
function writeUsers(u) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2) + "\n", { mode: 0o600 });
}
function hash(pass, salt) {
  return crypto.scryptSync(pass, salt, 64).toString("hex");
}
function setPassword(user, pass) {
  if (!user || !pass) { console.error("Aufruf: node server.js --set-password <benutzer> <passwort>"); process.exit(1); }
  if (pass.length < 8) { console.error("Passwort muss mindestens 8 Zeichen haben."); process.exit(1); }
  const users = readUsers();
  const salt = crypto.randomBytes(16).toString("hex");
  users[user] = { salt, hash: hash(pass, salt) };
  writeUsers(users);
  console.log(`Passwort für "${user}" gesetzt (${USERS_FILE}).`);
}
function checkPassword(user, pass) {
  const rec = readUsers()[user];
  /* Auch ohne Treffer rechnen, damit die Antwortzeit nichts verraet. */
  const salt = rec ? rec.salt : "0".repeat(32);
  const got = Buffer.from(hash(pass || "", salt), "hex");
  const want = Buffer.from(rec ? rec.hash : hash("", salt), "hex");
  const equal = got.length === want.length && crypto.timingSafeEqual(got, want);
  return !!rec && equal;
}

/* ------------------------------ Sitzungen ------------------------------- */
const sessions = new Map();
function newSession(user) {
  const token = crypto.randomBytes(24).toString("base64url");
  sessions.set(token, { user, until: Date.now() + SESSION_MS });
  return token;
}
function sessionOf(req) {
  const raw = req.headers.cookie || "";
  const m = raw.match(/(?:^|;\s*)nb_sess=([^;]+)/);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s) return null;
  if (s.until < Date.now()) { sessions.delete(m[1]); return null; }
  return { token: m[1], user: s.user };
}
setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (s.until < now) sessions.delete(t);
}, 15 * 60 * 1000).unref();

/* --------------------------- Fehlversuche bremsen ----------------------- */
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.first > 15 * 60 * 1000) { attempts.delete(ip); return false; }
  return a.n >= 8;
}
function noteFailure(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > 15 * 60 * 1000) attempts.set(ip, { n: 1, first: Date.now() });
  else a.n += 1;
}

/* ------------------------------ Hilfsmittel ----------------------------- */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".pdf": "application/pdf", ".zip": "application/zip"
};
function json(res, code, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  }, extra || {}));
  res.end(body);
}
function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(new Error("zu gross")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/* ------------------------------ Inhalt lesen/schreiben ------------------ */
function loadContent() {
  const src = fs.readFileSync(CONTENT_FILE, "utf8");
  const i = src.indexOf("window.SITE_CONTENT");
  const start = src.indexOf("{", i);
  const end = src.lastIndexOf("}");
  return JSON.parse(src.slice(start, end + 1));
}
function saveContent(obj) {
  const text =
    "/* Inhalt der Website — einzige Quelle der Wahrheit.\n" +
    "   Wird vom Admin-Bereich (admin.html) geschrieben, nicht von Hand.\n" +
    "   Bewusst eine .js-Datei: so laesst sich die Seite auch ohne Server\n" +
    "   direkt per Doppelklick oeffnen (fetch() waere hier durch CORS blockiert). */\n" +
    "window.SITE_CONTENT = " + JSON.stringify(obj, null, 2) + ";\n";

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (fs.existsSync(CONTENT_FILE)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(CONTENT_FILE, path.join(BACKUP_DIR, `content-${stamp}.js`));
    /* Nur die letzten 30 Sicherungen behalten. */
    const old = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("content-")).sort();
    old.slice(0, Math.max(0, old.length - 30))
       .forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  }
  const tmp = CONTENT_FILE + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, CONTENT_FILE);   /* atomar: nie eine halb geschriebene Datei */
}

/* ------------------------------ Statische Dateien ----------------------- */
const BLOCKED = new Set(["/data/admin-users.json", "/server.js"]);
function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url.split("?")[0]) || "/");
  if (urlPath.endsWith("/")) urlPath += "index.html";
  if (BLOCKED.has(urlPath) || urlPath.includes("/backups/") || path.basename(urlPath).startsWith(".")) {
    res.writeHead(404); res.end("Not found"); return;
  }
  const file = path.join(ROOT, path.normalize(urlPath));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end("Forbidden"); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>404</h1><p>Seite nicht gefunden.</p>"); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const isContent = file === CONTENT_FILE;
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": st.size,
      /* content.js darf nie aus dem Cache kommen, sonst sieht man alte Texte. */
      "Cache-Control": isContent || type.startsWith("text/html") ? "no-cache" : "public, max-age=3600"
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ------------------------------ Server ---------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (!url.startsWith("/api/")) return serveStatic(req, res);

  const ip = req.socket.remoteAddress || "?";
  const sess = sessionOf(req);

  try {
    if (url === "/api/session" && req.method === "GET") {
      return json(res, 200, sess ? { user: sess.user } : {});
    }

    if (url === "/api/login" && req.method === "POST") {
      if (tooManyAttempts(ip)) return json(res, 429, { error: "Zu viele Versuche. Bitte später erneut." });
      const { user, pass } = JSON.parse(await readBody(req, 4096) || "{}");
      if (!checkPassword(user, pass)) {
        noteFailure(ip);
        return json(res, 401, { error: "Benutzername oder Passwort stimmt nicht." });
      }
      attempts.delete(ip);
      const token = newSession(user);
      const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      return json(res, 200, { user }, {
        "Set-Cookie": `nb_sess=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`
      });
    }

    if (url === "/api/logout" && req.method === "POST") {
      if (sess) sessions.delete(sess.token);
      return json(res, 200, { ok: true }, { "Set-Cookie": "nb_sess=; HttpOnly; Path=/; Max-Age=0" });
    }

    if (url === "/api/content" && req.method === "GET") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      return json(res, 200, loadContent());
    }

    if (url === "/api/content" && req.method === "POST") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      const obj = JSON.parse(await readBody(req));
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return json(res, 400, { error: "Ungültiger Inhalt." });
      }
      saveContent(obj);
      console.log(`[${new Date().toISOString()}] ${sess.user} hat content.js gespeichert`);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Unbekannter Endpunkt." });
  } catch (e) {
    return json(res, 400, { error: "Anfrage konnte nicht verarbeitet werden." });
  }
});

/* ------------------------------ Start ----------------------------------- */
const argv = process.argv.slice(2);
if (argv[0] === "--set-password") { setPassword(argv[1], argv[2]); process.exit(0); }
if (argv[0] === "--remove-user") {
  const u = readUsers(); delete u[argv[1]]; writeUsers(u);
  console.log(`Benutzer "${argv[1]}" entfernt.`); process.exit(0);
}

if (!Object.keys(readUsers()).length) {
  console.log("\n  Noch kein Zugang eingerichtet. Zuerst:\n");
  console.log('    node server.js --set-password nick "ein-langes-passwort"\n');
}
server.listen(PORT, HOST, () => {
  console.log(`  Website:      http://${HOST}:${PORT}/`);
  console.log(`  Admin:        http://${HOST}:${PORT}/admin.html\n`);
});
