#!/usr/bin/env node
/* berdi-racing.com — small server for the admin area.
   No dependencies, only what Node brings itself.

   Start:           node server.js
   Set password:    node server.js --set-password nick "long-password"
   Remove user:     node server.js --remove-user nick

   The server delivers the website and, under /api/*, accepts the login and the
   saving of data/content.js. Without it the site stays a perfectly ordinary
   static website.

   Language: code, comments, log output and the command line are English.
   Everything a person reads is German — the answers of /api/contact and the
   404 page for a visitor, and the answers to the admin area, which Nick and
   Karin work in. */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const USERS_FILE = path.join(ROOT, "data", "admin-users.json");
const CONTENT_FILE = path.join(ROOT, "data", "content.js");
const BACKUP_DIR = path.join(ROOT, "data", "backups");
const INQUIRIES_FILE = path.join(ROOT, "data", "inquiries.json");
const READ_FILE = path.join(ROOT, "data", "inquiries-read.json");
const UPLOAD_DIR = path.join(ROOT, "data", "uploads");
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_MS = 8 * 60 * 60 * 1000;

/* ------------------------------ Users ----------------------------------- */
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
  if (!user || !pass) { console.error("Usage: node server.js --set-password <user> <password>"); process.exit(1); }
  if (pass.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1); }
  const users = readUsers();
  const salt = crypto.randomBytes(16).toString("hex");
  users[user] = { salt, hash: hash(pass, salt) };
  writeUsers(users);
  console.log(`Password for "${user}" set (${USERS_FILE}).`);
}
function checkPassword(user, pass) {
  const rec = readUsers()[user];
  /* Compute even without a match, so the response time gives nothing away. */
  const salt = rec ? rec.salt : "0".repeat(32);
  const got = Buffer.from(hash(pass || "", salt), "hex");
  const want = Buffer.from(rec ? rec.hash : hash("", salt), "hex");
  const equal = got.length === want.length && crypto.timingSafeEqual(got, want);
  return !!rec && equal;
}

/* ------------------------------ Sessions -------------------------------- */
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
/* --------------------------- Slow down failed logins -------------------- */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_TRIES = 8;
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.first > LOGIN_WINDOW_MS) { attempts.delete(ip); return false; }
  return a.n >= LOGIN_MAX_TRIES;
}
function noteFailure(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > LOGIN_WINDOW_MS) attempts.set(ip, { n: 1, first: Date.now() });
  else a.n += 1;
}
/* Behind Caddy and the Cloudflare tunnel the peer address is always 127.0.0.1.
   Without looking at the forwarded headers every visitor would count as one
   single address, and eight failed attempts by anyone would lock out the admin
   for everybody.

   CF-Connecting-IP is set by Cloudflare itself and cannot be forged by the
   visitor. X-Forwarded-For is the fallback for running without Cloudflare.
   Both are only trustworthy because this server listens on 127.0.0.1 alone, so
   nothing but our own reverse proxy can reach it.

   Read X-Forwarded-For from the RIGHT. Caddy appends the peer it actually saw
   to whatever chain arrived, so the rightmost entry is the only one we put
   there ourselves — every entry left of it was supplied by the client. Reading
   the leftmost entry instead made the login lockout useless: rotating the
   header through fake addresses gave unlimited password attempts, because each
   forged value looked like a brand-new visitor.

   Which entry is authoritative depends on the setup:
     - Behind the Cloudflare tunnel, CF-Connecting-IP decides and the chain is
       never consulted. The rightmost X-Forwarded-For entry would be 127.0.0.1
       there anyway, because Caddy only ever sees cloudflared.
     - With Caddy exposed directly (operation without Cloudflare), Caddy
       appends the real visitor, so the rightmost entry is that visitor.
     - Talking to this server directly, the header is simply whatever the
       caller sent. That is acceptable because it listens on 127.0.0.1 only,
       so reaching it at all means already being on the machine. */
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const chain = String(xff).split(",");
    return chain[chain.length - 1].trim();
  }
  return req.socket.remoteAddress || "?";
}

/* --------------------------- Receiving enquiries ------------------------ */
/* Kept separate from the login counter: someone spamming the form should not
   lock the admin out, and someone guessing passwords should not block the
   form. */
const CONTACT_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_MAX_TRIES = 5;
const contactRate = new Map();
function contactTooOften(ip) {
  const a = contactRate.get(ip);
  if (!a) return false;
  if (Date.now() - a.first > CONTACT_WINDOW_MS) { contactRate.delete(ip); return false; }
  return a.n >= CONTACT_MAX_TRIES;
}
function noteContact(ip) {
  const a = contactRate.get(ip);
  if (!a || Date.now() - a.first > CONTACT_WINDOW_MS) contactRate.set(ip, { n: 1, first: Date.now() });
  else a.n += 1;
}

/* --------------------------- Housekeeping ------------------------------- */
/* All three maps are keyed by client address, so they grow with every distinct
   visitor. Sessions were swept already; the two rate-limit maps were not — an
   entry there only disappeared if that same address came back, so a caller
   walking through addresses could grow them without limit until the Pi ran out
   of memory. One timer sweeps all three, using the same windows the checks
   above apply, so nothing is dropped while it still counts. */
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) if (s.until < now) sessions.delete(token);
  for (const [ip, a] of attempts) if (now - a.first > LOGIN_WINDOW_MS) attempts.delete(ip);
  for (const [ip, a] of contactRate) if (now - a.first > CONTACT_WINDOW_MS) contactRate.delete(ip);
}, 15 * 60 * 1000).unref();

/* Only these fields are taken over. Written as a list of what is allowed, so a
   bot cannot write arbitrary keys into the file. The names match the name=
   attributes of the form in kontakt.html. */
const CONTACT_FIELDS = ["name", "company", "email", "phone", "message", "subject"];
const CONTACT_MAX = 2000;

function readInquiries() {
  try { return JSON.parse(fs.readFileSync(INQUIRIES_FILE, "utf8")); }
  catch { return []; }
}
function saveInquiry(entry) {
  fs.mkdirSync(path.dirname(INQUIRIES_FILE), { recursive: true });
  const all = readInquiries();
  all.push(entry);
  const tmp = INQUIRIES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, INQUIRIES_FILE);   /* atomic, same as for content.js */
}

/* Which enquiries have been looked at. Kept in its own file so inquiries.json
   stays append-only — an enquiry is never rewritten after it arrived. */
function readSeen() {
  try {
    const v = JSON.parse(fs.readFileSync(READ_FILE, "utf8"));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function writeSeen(ids) {
  fs.mkdirSync(path.dirname(READ_FILE), { recursive: true });
  const tmp = READ_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(ids, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, READ_FILE);
}

/* --------------------------- Notification by mail ----------------------- */
/* The Pi cannot send mail itself — a residential address has no reputation and
   the message would land in spam or be refused outright. So it goes through a
   sending service. Without the environment variables nothing is sent and
   nothing breaks; a fresh clone and local development behave as before.

     RESEND_API_KEY   API key of the service
     MAIL_TO          who gets the notification
     MAIL_FROM        sender, must be on a domain verified at Resend

   Deliberately fire and forget: the visitor already has their confirmation
   before this runs. A contact form must never fail because a third party is
   down. */
const https = require("https");

/* Which of the three variables are missing — empty array means mail is set up. */
function mailConfigMissing() {
  return ["RESEND_API_KEY", "MAIL_TO", "MAIL_FROM"].filter(n => !process.env[n]);
}

function notifyByMail(entry) {
  const missing = mailConfigMissing();
  if (missing.length) {
    /* Used to return silently, which looked exactly like a mail that had been
       sent and lost on the way. Now it says so. */
    console.warn(`[mail] not sent, configuration missing: ${missing.join(", ")}`);
    return;
  }
  const key = process.env.RESEND_API_KEY;
  const to = process.env.MAIL_TO;
  const from = process.env.MAIL_FROM;

  /* English, like the rest of the admin side: this mail goes to whoever runs
     the site, not to a visitor. The enquiry text inside it is of course
     whatever the sender wrote. */
  const lines = [
    `Name:     ${entry.name || "—"}`,
    `Company:  ${entry.company || "—"}`,
    `E-mail:   ${entry.email}`,
    `Phone:    ${entry.phone || "—"}`,
    `Subject:  ${entry.subject || "—"}`,
    "",
    entry.message || "(no message)",
    "",
    `Received: ${entry.received}`,
    "In the admin area under “Enquiries”."
  ].join("\n");

  const body = JSON.stringify({
    from,
    to: [to],
    reply_to: entry.email,
    subject: `New enquiry from ${entry.name || entry.email}`,
    text: lines
  });

  const req = https.request({
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    },
    timeout: 5000
  }, res => {
    res.resume();          /* drain, we only care about the status */
    if (res.statusCode >= 300) {
      console.error(`[mail] Resend answered ${res.statusCode}`);
    }
  });
  req.on("timeout", () => req.destroy(new Error("timeout")));
  req.on("error", err => console.error("[mail] not sent:", err.message));
  req.end(body);
}

/* ------------------------------ Uploads --------------------------------- */
/* Images live in data/uploads/, because data/ is the only directory the
   systemd unit may write to (ReadWritePaths). They are served under /media/,
   which keeps the simple rule "nothing below /data/ is public except
   content.js" intact and gives a clean path for the Cloudflare cache rule.

   The browser scales and converts to WebP before uploading (js/upload.js), so
   there is no image library on the Pi and no CPU work per upload. The server
   only checks that what arrives really is a WebP file. */
const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const UPLOAD_DIR_MAX_BYTES = 300 * 1024 * 1024;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const UPLOAD_MAX_PER_WINDOW = 60;
const NAME_RE = /^[a-f0-9]{16}(-480)?\.(webp|jpg)$/;
const ID_RE = /^[a-f0-9]{16}$/;

const uploadRate = new Map();
function uploadTooOften(user) {
  const a = uploadRate.get(user);
  if (!a) return false;
  if (Date.now() - a.first > UPLOAD_WINDOW_MS) { uploadRate.delete(user); return false; }
  return a.n >= UPLOAD_MAX_PER_WINDOW;
}
function noteUpload(user) {
  const a = uploadRate.get(user);
  if (!a || Date.now() - a.first > UPLOAD_WINDOW_MS) uploadRate.set(user, { n: 1, first: Date.now() });
  else a.n += 1;
}

/* Which format actually arrived, decided by the first bytes of the file and
   not by Content-Type, which the caller picks freely.

   WebP is what the browser produces where it can encode it — it is the
   smallest. JPEG is the fallback: Safari, depending on version, cannot encode
   WebP from a canvas and silently returns something else instead, so insisting
   on WebP would leave those uploads broken. Both formats are ones a browser
   displays without help, and neither is executable. */
function detectFormat(buf) {
  if (buf.length > 12 &&
      buf.toString("latin1", 0, 4) === "RIFF" &&
      buf.toString("latin1", 8, 12) === "WEBP") {
    return { ext: "webp", type: "image/webp" };
  }
  if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return { ext: "jpg", type: "image/jpeg" };
  }
  return null;
}

/* Both sizes of one image, whatever extension they were stored under. */
function uploadNames(id) {
  return uploadFiles().filter(f => f.slice(0, 16) === id);
}

function uploadFiles() {
  try { return fs.readdirSync(UPLOAD_DIR).filter(f => NAME_RE.test(f)); }
  catch { return []; }
}
function uploadDirBytes() {
  return uploadFiles().reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(UPLOAD_DIR, f)).size; }
    catch { return sum; }
  }, 0);
}
/* One entry per image, the -480 variant folded in as its thumbnail. Width and
   height are not stored here — the admin area reads them off the image itself
   when it is picked, which keeps this endpoint free of a second index that
   could fall out of step with the directory. */
function uploadList() {
  const files = uploadFiles();
  return files.filter(f => !f.includes("-480")).map(f => {
    const id = f.slice(0, 16);
    /* The thumbnail may carry a different extension than the main image only
       if the two were produced by different browsers; look it up rather than
       assuming one. */
    const thumbName = files.find(x => x.startsWith(`${id}-480.`));
    let bytes = 0, mtime = 0;
    try {
      const st = fs.statSync(path.join(UPLOAD_DIR, f));
      bytes = st.size; mtime = st.mtimeMs;
    } catch { /* disappeared between listing and stat */ }
    return {
      id,
      src: `/media/${f}`,
      thumb: thumbName ? `/media/${thumbName}` : `/media/${f}`,
      bytes,
      mtime
    };
  }).sort((a, b) => b.mtime - a.mtime);
}

/* Which content fields point at an upload. Used before deleting, so nobody
   silently removes a picture that is still on a page. */
function uploadUsedIn(id) {
  let content;
  try { content = loadContent(); } catch { return []; }
  const places = [];
  (function walk(node, trail) {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${trail}[${i + 1}]`));
    if (node && typeof node === "object") {
      return Object.keys(node).forEach(k => walk(node[k], trail ? `${trail}.${k}` : k));
    }
    if (typeof node === "string" && node.includes(id)) places.push(trail);
  })(content, "");
  return places;
}

/* ------------------------------ Helpers --------------------------------- */
/* Doubles as the allow-list of what may be served at all: isBlocked() rejects
   any extension that is not a key here. Deliberately no ".json" — nothing on
   the site fetches JSON (the content is a .js file, uploads are images, the
   enquiries are only reachable through the API), and leaving it in meant
   events-schema.json was downloadable by anyone. Formulated as an allow-list so
   a file dropped into the project root later is not public by accident.
   ".pdf" and ".zip" stay for the planned Unterlagen and Medienpaket. */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".pdf": "application/pdf", ".zip": "application/zip"
};

/* Set on every response, not only in the Caddyfile: this way the local server
   behaves like production, and a mistake in the proxy configuration cannot
   silently drop them. Strict-Transport-Security is the one exception — it
   belongs at the TLS edge and stays in Caddy.

   style-src needs 'unsafe-inline' because the pages carry inline style
   attributes and both js/content.js and js/admin.js assign to .style directly.
   script-src does not: there is no inline <script> anywhere in the project.
   blob: is for the image preview in the admin area, which reads a freshly
   selected file before it is uploaded. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'"
].join("; ");
const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()"
};
function headers(own, extra) {
  return Object.assign({}, SECURITY_HEADERS, own, extra || {});
}

function json(res, code, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(code, headers({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  }, extra));
  res.end(body);
}
/* Rejects with err.tooLarge once the limit is passed, so the caller can answer
   413 instead of a generic error. Important: do NOT destroy the socket here.
   Tearing it down before anything was written meant the client saw a connection
   reset and never the explanation — a visitor writing a long message got
   "site is broken" instead of "message too long". Draining the rest with
   resume() throws the remaining bytes away while keeping the connection alive
   long enough to answer. */
function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; let over = false; const chunks = [];
    req.on("data", c => {
      if (over) return;
      size += c.length;
      if (size > limit) {
        over = true;
        chunks.length = 0;
        req.resume();
        const err = new Error("Body over the limit");
        err.tooLarge = true;
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => { if (!over) resolve(Buffer.concat(chunks)); });
    req.on("error", err => { if (!over) reject(err); });
  });
}
/* Most callers want text; uploads want the raw bytes, which is why readBody
   itself resolves a Buffer. */
function readText(req, limit) {
  return readBody(req, limit).then(buf => buf.toString("utf8"));
}

/* ------------------------------ Reading/writing content ---------------- */
function loadContent() {
  const src = fs.readFileSync(CONTENT_FILE, "utf8");
  const i = src.indexOf("window.SITE_CONTENT");
  const start = src.indexOf("{", i);
  const end = src.lastIndexOf("}");
  return JSON.parse(src.slice(start, end + 1));
}
/* Must stay character for character identical to fileText() in js/admin.js and
   to the header of data/content.js — otherwise the header flips back and forth
   with every save depending on who wrote the file last. */
const CONTENT_HEADER =
  "/* Content of the website — the single source of truth.\n" +
  "   Written by the admin area (admin.html), never by hand.\n" +
  "   Deliberately a .js file: that way the site can also be opened by simply\n" +
  "   double-clicking it, where fetch() would be blocked by CORS. */\n";

function saveContent(obj) {
  const text = CONTENT_HEADER + "window.SITE_CONTENT = " + JSON.stringify(obj, null, 2) + ";\n";

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (fs.existsSync(CONTENT_FILE)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(CONTENT_FILE, path.join(BACKUP_DIR, `content-${stamp}.js`));
    /* Keep only the last 30 backups. */
    const old = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("content-")).sort();
    old.slice(0, Math.max(0, old.length - 30))
       .forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  }
  const tmp = CONTENT_FILE + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, CONTENT_FILE);   /* atomic: never a half-written file */
}

/* ------------------------------ Static files ---------------------------- */
/* Never delivered: credentials, backups, the server itself and the deployment
   templates. Out of data/ only content.js is public — written as a list of what
   is allowed, so a file added there later is not on the net by accident. */
function isBlocked(urlPath) {
  if (urlPath === "/server.js" || urlPath.startsWith("/deploy/")) return true;
  if (urlPath.startsWith("/data/") && urlPath !== "/data/content.js") return true;
  if (path.basename(urlPath).startsWith(".")) return true;
  /* Only known file types. Without this, README.md was downloadable and handed
     out the whole deployment: the admin URL, the path on the Pi, which
     endpoints are deliberately open, and that data/admin-users.json exists. */
  return !Object.prototype.hasOwnProperty.call(TYPES, path.extname(urlPath).toLowerCase());
}
function serveStatic(req, res) {
  let urlPath;
  /* A broken percent sign (/%zz) throws here — left unhandled it ends the
     whole process, so a single request took the site down. */
  try { urlPath = decodeURIComponent((req.url.split("?")[0]) || "/"); }
  catch { res.writeHead(400, headers({})); res.end("Bad request"); return; }

  /* Normalise first, then block. The other way round a path like
     /data/../data/admin-users.json slips past the block, because it still sees
     the raw ".." and path.join only resolves it afterwards. */
  urlPath = path.posix.normalize(urlPath);
  if (!urlPath.startsWith("/")) { res.writeHead(403, headers({})); res.end("Forbidden"); return; }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  /* Uploaded images. The name is checked against NAME_RE before a path is
     built from it, so only files this server generated itself can be
     addressed — no directory part of the URL ever reaches the filesystem. */
  if (urlPath.startsWith("/media/")) {
    const name = urlPath.slice("/media/".length);
    if (!NAME_RE.test(name)) { res.writeHead(404, headers({})); res.end("Not found"); return; }
    return sendFile(req, res, path.join(UPLOAD_DIR, name));
  }

  if (isBlocked(urlPath)) { res.writeHead(404, headers({})); res.end("Not found"); return; }

  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403, headers({})); res.end("Forbidden"); return; }

  sendFile(req, res, file);
}

function sendFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, headers({ "Content-Type": "text/html; charset=utf-8" }));
      res.end("<h1>404</h1><p>Seite nicht gefunden.</p>"); return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const isContent = file === CONTENT_FILE;
    /* An uploaded image never changes — its name is derived from random bytes
       at upload time, and a replacement gets a new name. So it can be cached
       for a long time and immutably. */
    const isUpload = file.startsWith(UPLOAD_DIR + path.sep);

    /* Everything else is served under a name that stays the same while the
       content behind it changes — there is no build step putting a hash in the
       file name. A plain max-age was therefore wrong: after a deploy a browser
       kept the old script for up to an hour and there was no way to ask. It
       cost real debugging time, because a fixed upload still failed with the
       previous code.

       "no-cache" does not mean "do not store": the copy is kept and revalidated
       on each use. With an ETag that costs one 304 with no body, so it stays
       nearly as cheap as a cache hit while never being stale. */
    const etag = '"' + st.size.toString(16) + "-" + Math.floor(st.mtimeMs).toString(16) + '"';

    let cache;
    if (isContent) cache = "no-store, must-revalidate";
    else if (isUpload) cache = "public, max-age=31536000, immutable";
    else cache = "no-cache";

    const base = {
      "Content-Type": type,
      "Cache-Control": cache,
      "Last-Modified": new Date(st.mtimeMs).toUTCString()
    };
    if (!isContent) base.ETag = etag;

    /* Unchanged since the browser last asked: answer without a body. */
    const known = req.headers["if-none-match"];
    if (!isContent && known && known === etag) {
      res.writeHead(304, headers(base));
      res.end();
      return;
    }

    res.writeHead(200, headers(Object.assign({ "Content-Length": st.size }, base)));
    fs.createReadStream(file).pipe(res);
  });
}

/* ------------------------------ Server ---------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (!url.startsWith("/api/")) return serveStatic(req, res);

  const ip = clientIp(req);
  const sess = sessionOf(req);

  try {
    if (url === "/api/session" && req.method === "GET") {
      return json(res, 200, sess ? { user: sess.user } : {});
    }

    if (url === "/api/login" && req.method === "POST") {
      if (tooManyAttempts(ip)) return json(res, 429, { error: "Zu viele Versuche. Bitte später erneut." });
      const { user, pass } = JSON.parse(await readText(req, 4096) || "{}");
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

    if (url === "/api/contact" && req.method === "POST") {
      if (contactTooOften(ip)) {
        return json(res, 429, { error: "Zu viele Anfragen. Bitte später erneut." });
      }

      let data;
      try { data = JSON.parse(await readText(req, 32768) || "{}"); }
      catch (e) {
        /* A body over the limit is something other than broken JSON and has to
           reach the outer catch, so the answer is 413. */
        if (e && e.tooLarge) throw e;
        return json(res, 400, { error: "Anfrage konnte nicht gelesen werden." });
      }

      /* Honeypot: a field invisible to people. Bots fill in everything. We
         answer ok so the bot does not try again. */
      if (typeof data.website === "string" && data.website.trim()) {
        return json(res, 200, { ok: true });
      }

      const clean = {};
      for (const fieldName of CONTACT_FIELDS) {
        const v = data[fieldName];
        if (typeof v === "string" && v.trim()) clean[fieldName] = v.trim().slice(0, CONTACT_MAX);
      }

      if (!clean.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) {
        return json(res, 400, { error: "Bitte eine gültige E-Mail-Adresse angeben." });
      }
      if (!clean.message && !clean.name) {
        return json(res, 400, { error: "Bitte Name oder Nachricht ausfüllen." });
      }

      const entry = {
        id: crypto.randomBytes(8).toString("hex"),
        received: new Date().toISOString(),
        ip,
        ...clean
      };
      saveInquiry(entry);
      noteContact(ip);
      console.log(`[${new Date().toISOString()}] New enquiry from ${clean.email}`);

      /* Answer first, notify afterwards. The enquiry is safely on disk at this
         point, so a mail service that is slow or down can no longer affect
         what the visitor sees. */
      json(res, 200, { ok: true });
      try { notifyByMail(entry); }
      catch (err) { console.error("[mail] not sent:", err.message); }
      return;
    }

    if (url === "/api/upload" && req.method === "POST") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      if (uploadTooOften(sess.user)) {
        return json(res, 429, { error: "Zu viele Uploads. Bitte später erneut." });
      }

      const q = new URL(req.url, "http://x").searchParams;
      const variant = q.get("variant") === "thumb" ? "thumb" : "main";

      /* The thumbnail belongs to an image uploaded a moment ago, so its id is
         given; the main image gets a fresh one. The client's file name is
         never used — it would be the one place an attacker could steer where
         we write. */
      let id;
      if (variant === "thumb") {
        id = q.get("id") || "";
        if (!ID_RE.test(id)) return json(res, 400, { error: "Ungültige Bild-Kennung." });
        if (!uploadNames(id).some(f => !f.includes("-480"))) {
          return json(res, 400, { error: "Zum Vorschaubild fehlt das Hauptbild." });
        }
      } else {
        id = crypto.randomBytes(8).toString("hex");
      }

      if (uploadDirBytes() > UPLOAD_DIR_MAX_BYTES) {
        return json(res, 507, { error: "Der Bildspeicher ist voll. Bitte alte Bilder löschen." });
      }

      /* Caught here rather than in the generic handler, so the answer names
         the real limit instead of a bare "request too large". */
      let buf;
      try {
        buf = await readBody(req, UPLOAD_MAX_BYTES);
      } catch (err) {
        if (err && err.tooLarge) {
          return json(res, 413, {
            error: `Das Bild ist nach der Umwandlung immer noch gr\u00f6sser als ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB. ` +
                   "Normalerweise verkleinert der Browser es vorher — wenn das immer wieder " +
                   "vorkommt, konnte der Browser die Datei nicht umwandeln und hat das Original geschickt."
          });
        }
        throw err;
      }

      const format = detectFormat(buf);
      if (!format) {
        return json(res, 415, {
          error: "Nur WebP- oder JPEG-Bilder. Das Hochladen wandelt die Datei selbst um — " +
                 "erscheint das hier, hat der Browser etwas anderes geschickt."
        });
      }

      const name = variant === "thumb" ? `${id}-480.${format.ext}` : `${id}.${format.ext}`;
      const dest = path.join(UPLOAD_DIR, name);
      const tmp = dest + ".tmp";
      /* Writing is the one step that fails for reasons outside this process:
         data/ not writable by the service user, or the card full. Caught here
         so the answer names the cause — otherwise it fell through to the
         generic catch at the bottom and reported an unrelated 400. */
      try {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, dest);    /* atomic, as everywhere else */
      } catch (err) {
        console.error(`[upload] writing ${name} failed: ${err.code} ${err.message}`);
        try { fs.unlinkSync(tmp); } catch { /* nothing left over */ }
        const why = err.code === "EACCES" || err.code === "EPERM"
          ? "der Dienst darf nicht nach data/ schreiben (ReadWritePaths in der systemd-Unit und der Besitzer des Ordners)"
          : err.code === "ENOSPC" ? "die Platte ist voll"
          : `Fehlercode ${err.code}`;
        return json(res, 500, { error: `Das Bild konnte nicht gespeichert werden: ${why}.` });
      }
      noteUpload(sess.user);

      console.log(`[${new Date().toISOString()}] ${sess.user} uploaded ${name} (${buf.length} bytes)`);
      return json(res, 200, { id, name, src: `/media/${name}`, bytes: buf.length });
    }

    if (url === "/api/uploads" && req.method === "GET") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      return json(res, 200, {
        items: uploadList(),
        bytes: uploadDirBytes(),
        maxBytes: UPLOAD_DIR_MAX_BYTES
      });
    }

    if (url.startsWith("/api/uploads/") && req.method === "DELETE") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      const id = url.slice("/api/uploads/".length);
      if (!ID_RE.test(id)) return json(res, 400, { error: "Ungültige Bild-Kennung." });

      /* Only refuse when the caller has not been warned yet: the admin area
         asks once and then repeats the request with ?force=1. */
      const force = new URL(req.url, "http://x").searchParams.get("force") === "1";
      const places = uploadUsedIn(id);
      if (places.length && !force) {
        return json(res, 409, { inUse: true, places });
      }

      let removed = 0;
      for (const name of [`${id}.webp`, `${id}-480.webp`]) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); removed++; }
        catch { /* was not there, nothing to do */ }
      }
      if (!removed) return json(res, 404, { error: "Bild nicht gefunden." });
      console.log(`[${new Date().toISOString()}] ${sess.user} deleted image ${id}`);
      return json(res, 200, { ok: true, places });
    }

    if (url === "/api/inquiries/read" && req.method === "POST") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      const body = JSON.parse(await readText(req, 65536) || "{}");
      const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === "string") : [];
      /* Only ids that actually exist, so the file cannot be filled with
         arbitrary content. */
      const known = new Set(readInquiries().map(e => e.id));
      const merged = [...new Set([...readSeen(), ...ids.filter(x => known.has(x))])];
      writeSeen(merged);
      return json(res, 200, { read: merged.length });
    }

    if (url === "/api/inquiries" && req.method === "GET") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      const seen = new Set(readSeen());
      const items = readInquiries().slice().reverse()
        .map(e => Object.assign({}, e, { seen: seen.has(e.id) }));
      return json(res, 200, { items, unread: items.filter(e => !e.seen).length });
    }

    if (url === "/api/content" && req.method === "GET") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      return json(res, 200, loadContent());
    }

    if (url === "/api/content" && req.method === "POST") {
      if (!sess) return json(res, 401, { error: "Nicht angemeldet." });
      const obj = JSON.parse(await readText(req));
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return json(res, 400, { error: "Ungültiger Inhalt." });
      }
      saveContent(obj);
      console.log(`[${new Date().toISOString()}] ${sess.user} saved content.js`);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Unbekannter Endpunkt." });
  } catch (e) {
    if (e && e.tooLarge) {
      return json(res, 413, { error: "Die Anfrage ist zu gross." });
    }
    return json(res, 400, { error: "Anfrage konnte nicht verarbeitet werden." });
  }
});

/* ------------------------------ Startup --------------------------------- */
const argv = process.argv.slice(2);
if (argv[0] === "--set-password") { setPassword(argv[1], argv[2]); process.exit(0); }
if (argv[0] === "--remove-user") {
  const u = readUsers(); delete u[argv[1]]; writeUsers(u);
  console.log(`User "${argv[1]}" removed.`); process.exit(0);
}

if (!Object.keys(readUsers()).length) {
  console.log("\n  No access set up yet. First run:\n");
  console.log('    node server.js --set-password nick "a-long-password"\n');
}
server.listen(PORT, HOST, () => {
  console.log(`  Website:      http://${HOST}:${PORT}/`);
  console.log(`  Admin:        http://${HOST}:${PORT}/admin.html`);
  /* Stated at start-up, so it is visible in the log whether an enquiry will
     trigger a mail — without having to send a test enquiry to find out. */
  const missing = mailConfigMissing();
  console.log(missing.length
    ? `  Mail:         off (missing: ${missing.join(", ")}) — see README 3d`
    : `  Mail:         on, to ${process.env.MAIL_TO}`);
  console.log("");
});
