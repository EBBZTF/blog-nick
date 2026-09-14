/* Minimal SMTP client — enough to hand one notification to a mail provider.

   Written by hand instead of pulling in nodemailer, for the same reason the rest
   of the project has no dependencies: this runs unattended on an SD card, and
   every package is something that has to be updated and can break.

   It speaks only what is needed: EHLO, AUTH, MAIL FROM, RCPT TO, DATA, QUIT.
   No attachments, no HTML, one recipient. That covers "tell Nick an enquiry
   arrived" and nothing more.

   Two ways in, both encrypted:
     port 465  TLS from the first byte
     port 587  plain connection, upgraded with STARTTLS before anything secret
               is sent — this is what Proton documents

   sendMail() builds the connection, converse() handles the dialogue. They are
   kept apart so the protocol can be tested over a plain socket without a
   certificate. */

"use strict";

const net = require("net");
const tls = require("tls");

/* A header may only contain ASCII. Anything else — an umlaut in a name or
   subject — has to be wrapped per RFC 2047. */
function encodeHeader(value) {
  const text = String(value == null ? "" : value);
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return "=?UTF-8?B?" + Buffer.from(text, "utf8").toString("base64") + "?=";
}

/* One or several recipients: an array, or a comma-separated string as it comes
   out of an environment variable. */
function recipientList(to) {
  const list = Array.isArray(to) ? to : String(to == null ? "" : to).split(",");
  return list.map(x => String(x).trim()).filter(Boolean);
}

/* "Nick <nick@example.com>" -> the bare address for the envelope. */
function bareAddress(value) {
  const m = String(value).match(/<([^>]+)>/);
  return (m ? m[1] : String(value)).trim();
}

function buildMessage(o) {
  const now = new Date().toUTCString();
  const id = `<${Date.now().toString(36)}.${Math.floor(Math.random() * 1e9).toString(36)}@berdi-racing.com>`;

  /* base64 for every part, so umlauts and long lines cannot break anything on
     the way. Wrapped at 76 characters as the standard requires. */
  const b64 = (text) => Buffer.from(String(text), "utf8").toString("base64")
    .replace(/(.{1,76})/g, "$1\r\n");

  const headers = [
    `From: ${/[^\x20-\x7E]/.test(o.from) ? encodeHeader(o.from) : o.from}`,
    `To: ${o.to}`,
    o.replyTo ? `Reply-To: ${o.replyTo}` : null,
    `Subject: ${encodeHeader(o.subject)}`,
    `Date: ${now}`,
    `Message-ID: ${id}`,
    "MIME-Version: 1.0"
  ].filter(Boolean);

  /* Plain text only, when that is all there is. */
  if (!o.html) {
    return headers.concat([
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64"
    ]).join("\r\n") + "\r\n\r\n" + b64(o.text);
  }

  /* Both versions in one message: the reader takes the HTML one, anything that
     cannot show it — a notification preview, a text-only client, a screen
     reader — falls back to the plain text. Sending HTML alone also reads as a
     spam signal. The boundary contains "=" and "_", neither of which base64
     produces at the start of a line, so it can never appear inside a part by
     accident. It deliberately does not begin with "--", because the delimiter
     lines are already "--" plus the boundary and the doubling makes the message
     needlessly hard to read. */
  const boundary = "=_berdi_" + Math.floor(Math.random() * 1e12).toString(36);
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(o.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(o.html),
    `--${boundary}--`
  ].join("\r\n");

  return headers.concat([
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ]).join("\r\n") + "\r\n\r\n" + body;
}

/* A line in the body that begins with a dot would end the message early, so it
   is doubled. The standard calls this dot-stuffing. */
function dotStuff(message) {
  return message.split("\r\n").map(l => (l.startsWith(".") ? "." + l : l)).join("\r\n");
}

/* Runs the dialogue over an already connected socket. Resolves when the server
   has accepted the message. */
function converse(socket, o, opts) {
  const skipGreeting = !!(opts && opts.skipGreeting);
  return new Promise((resolve, reject) => {
    let buffer = "";
    /* Replies that have arrived but nothing is waiting for yet. Needed because
       attaching the data listener already starts the socket flowing, while the
       first expect() is only registered a tick later — over TLS the greeting
       lands in exactly that gap, and dropping it made the client wait forever. */
    const replies = [];
    let waiting = null;
    let done = false;

    function finish(err) {
      if (done) return;
      done = true;
      socket.removeAllListeners("data");
      if (err) reject(err); else resolve();
    }

    /* Hands the oldest reply to whoever is waiting, if both exist. */
    function pump() {
      if (!waiting || !replies.length) return;
      const reply = replies.shift();
      const w = waiting; waiting = null;
      if (w.expect.includes(reply.code)) w.resolve(reply.text);
      else w.reject(new Error(`SMTP ${w.what}: ${reply.text.split("\n").pop()}`));
    }

    socket.setEncoding("utf8");
    socket.on("data", chunk => {
      buffer += chunk;
      let lines = [];
      let idx;
      while ((idx = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        lines.push(line);
        /* A reply may span several lines: "250-SIZE" continues, "250 SIZE" ends. */
        if (/^\d{3}-/.test(line)) continue;
        replies.push({ code: parseInt(line.slice(0, 3), 10), text: lines.join("\n") });
        lines = [];
        pump();
      }
    });
    socket.on("error", finish);
    socket.on("close", () => finish(done ? null : new Error("SMTP connection closed early")));

    function expect(codes, what) {
      return new Promise((res, rej) => {
        waiting = { expect: codes, what, resolve: res, reject: rej };
        pump();
      });
    }
    function say(command, codes, what) {
      const p = expect(codes, what);
      socket.write(command + "\r\n");
      return p;
    }

    (async () => {
      /* After STARTTLS the server sends no new greeting — the dialogue simply
         starts again with EHLO on the encrypted channel. */
      if (!skipGreeting) await expect([220], "greeting");
      const greeting = await say(`EHLO ${o.helo || "localhost"}`, [250], "EHLO");

      /* AUTH PLAIN is one round trip, AUTH LOGIN two. Pick whatever the server
         offers, preferring the shorter one. */
      const offersPlain = /AUTH[^\n]*PLAIN/i.test(greeting);
      if (offersPlain) {
        const token = Buffer.from(`\0${o.user}\0${o.pass}`, "utf8").toString("base64");
        await say(`AUTH PLAIN ${token}`, [235], "AUTH PLAIN");
      } else {
        await say("AUTH LOGIN", [334], "AUTH LOGIN");
        await say(Buffer.from(o.user, "utf8").toString("base64"), [334], "user name");
        await say(Buffer.from(o.pass, "utf8").toString("base64"), [235], "password");
      }

      await say(`MAIL FROM:<${bareAddress(o.from)}>`, [250], "MAIL FROM");
      /* One RCPT TO per recipient; the To: header lists them all. */
      const rcpts = recipientList(o.to);
      if (!rcpts.length) throw new Error("SMTP: no recipient given");
      for (const rcpt of rcpts) {
        await say(`RCPT TO:<${bareAddress(rcpt)}>`, [250, 251], "RCPT TO");
      }
      await say("DATA", [354], "DATA");
      const message = buildMessage(Object.assign({}, o, { to: rcpts.join(", ") }));
      socket.write(dotStuff(message) + "\r\n.\r\n");
      await expect([250], "message");
      socket.write("QUIT\r\n");
      finish(null);
      socket.end();
    })().catch(err => { finish(err); try { socket.destroy(); } catch { /* already gone */ } });
  });
}

/* Node reports a refused connection as an AggregateError whose own message is
   empty — logging err.message alone produced a line that said nothing at all.
   This digs out something usable. */
function describe(err) {
  if (!err) return "unknown error";
  if (err.message) return err.message;
  if (Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map(e => (e && (e.message || e.code)) || "?").join("; ");
  }
  return err.code || String(err);
}

/* Opens the connection and sends. Rejects on any problem — the caller decides
   what that means; here it must never affect the visitor. */
function sendMail(o) {
  const port = Number(o.port) || 587;
  const timeoutMs = Number(o.timeoutMs) || 15000;
  /* Port 465 means TLS from the first byte, 587 means upgrade with STARTTLS.
     Stated explicitly rather than only inferred, so the mode does not depend on
     a port number a provider might choose differently. */
  const secure = o.secure === undefined ? port === 465 : !!o.secure;

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      if (!err) return resolve();
      /* Always name host and port: "connection refused" is only useful if it
         says what could not be reached. */
      reject(err.message ? err : new Error(`${o.host}:${port} — ${describe(err)}`));
    };

    const guard = setTimeout(() => {
      done(new Error(`SMTP timeout after ${timeoutMs} ms`));
    }, timeoutMs);
    guard.unref();

    const run = (socket, opts) => converse(socket, o, opts)
      .then(() => { clearTimeout(guard); done(null); })
      .catch(err => { clearTimeout(guard); done(err); });

    /* SNI carries a host name; Node refuses it for a bare IP address, which is
       what a local test setup uses. */
    const sni = net.isIP(o.host) === 0 ? { servername: o.host } : {};

    if (secure) {
      /* Encrypted from the first byte. */
      const socket = tls.connect(Object.assign({ host: o.host, port }, sni), () => run(socket));
      socket.on("error", err => { clearTimeout(guard); done(err); });
      return;
    }

    /* Plain first, then STARTTLS before any credential is written. */
    const plain = net.connect({ host: o.host, port });
    plain.on("error", err => { clearTimeout(guard); done(err); });
    plain.setEncoding("utf8");

    let greeted = false;
    plain.on("data", function onData(chunk) {
      if (greeted) return;
      if (!/^220[ -]/.test(chunk)) return;
      greeted = true;
      plain.removeListener("data", onData);
      plain.write("EHLO " + (o.helo || "localhost") + "\r\n");

      let seen = "";
      plain.on("data", function afterEhlo(more) {
        seen += more;
        if (!/^250 /m.test(seen)) return;
        plain.removeListener("data", afterEhlo);
        if (!/STARTTLS/i.test(seen)) {
          clearTimeout(guard);
          done(new Error("SMTP server offers no STARTTLS — refusing to send unencrypted"));
          plain.destroy();
          return;
        }
        plain.write("STARTTLS\r\n");
        plain.once("data", function (reply) {
          if (!/^220[ -]/.test(reply)) {
            clearTimeout(guard);
            done(new Error("SMTP STARTTLS refused: " + String(reply).trim()));
            plain.destroy();
            return;
          }
          plain.removeAllListeners("data");
          const secure = tls.connect(Object.assign({ socket: plain }, sni), () => {
            run(secure, { skipGreeting: true });
          });
          secure.on("error", err => { clearTimeout(guard); done(err); });
        });
      });
    });
  });
}

module.exports = { sendMail, converse, buildMessage, encodeHeader, dotStuff, bareAddress, recipientList };
