/* The notification mail for a new enquiry — text and HTML version.

   Its own file rather than part of server.js: it is pure formatting with no
   state, which makes it the one piece that can be rendered and looked at
   without starting anything. German throughout, because Nick and Karin read it.

   Never delivered to the web — isBlocked() rejects every .js in the project
   root. */

"use strict";

/* Anything a sender wrote may contain < or &, and it is going into HTML. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* 2026-09-14T14:54:10.835Z is not something anyone wants to read at a glance. */
function localMoment(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || "");
  return d.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

/* The rows of the enquiry, empty ones left out — a line reading "Telefon: —"
   tells the reader nothing and only makes the mail longer. The name is the
   heading of the HTML version, so it is not repeated as a row there. */
function inquiryRows(entry, withName) {
  return [
    withName ? ["Name", entry.name] : null,
    ["Firma", entry.company],
    ["E-Mail", entry.email],
    ["Telefon", entry.phone],
    ["Betreff", entry.subject]
  ].filter(row => row && row[1] != null && String(row[1]).trim() !== "");
}

function mailText(entry) {
  const rows = inquiryRows(entry, true).map(([k, v]) => `${(k + ":").padEnd(10)}${v}`);
  return [
    "Neue Anfrage über berdi-racing.com",
    "",
    ...rows,
    "",
    entry.message ? entry.message : "(keine Nachricht)",
    "",
    `Eingang: ${localMoment(entry.received)}`,
    "Im Admin-Bereich unter „Anfragen“: https://berdi-racing.com/admin.html"
  ].join("\n");
}

/* Deliberately plain: one card, no images, no external files. Every style is
   inline, because mail clients strip a stylesheet, and the colours are the ones
   from the website so the mail is recognisable as coming from it. */
function mailHtml(entry) {
  const rows = inquiryRows(entry, false).map(([label, value]) => {
    const shown = label === "E-Mail"
      ? `<a href="mailto:${escapeHtml(value)}" style="color:#8A6E24;text-decoration:none">${escapeHtml(value)}</a>`
      : escapeHtml(value);
    return `<tr>
      <td style="padding:3px 14px 3px 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7C8388;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
      <td style="padding:3px 0;font-size:15px;color:#191B1D;vertical-align:top">${shown}</td>
    </tr>`;
  }).join("");

  const message = entry.message
    ? `<div style="margin:18px 0 0;padding:14px 16px;background:#F4F2ED;border-left:3px solid #C39A3F;
                  font-size:15px;line-height:1.55;color:#33383B;white-space:pre-wrap">${escapeHtml(entry.message)}</div>`
    : `<div style="margin:18px 0 0;font-size:14px;color:#9AA0A4">Keine Nachricht hinterlassen.</div>`;

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#EDEAE3;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #D9D5CC;border-top:3px solid #C39A3F">
    <tr><td style="padding:22px 24px 0">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7C8388">
        Neue Anfrage über berdi-racing.com</div>
      <div style="margin:7px 0 0;font-size:22px;font-weight:700;color:#191B1D">
        ${escapeHtml(entry.name || entry.email)}</div>
    </td></tr>
    <tr><td style="padding:16px 24px 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      ${message}
    </td></tr>
    <tr><td style="padding:20px 24px 24px">
      <a href="https://berdi-racing.com/admin.html"
         style="display:inline-block;background:#C39A3F;color:#16181A;text-decoration:none;
                font-weight:700;font-size:14px;padding:10px 18px;border-radius:2px">Im Admin-Bereich ansehen</a>
      <div style="margin:14px 0 0;font-size:12px;color:#9AA0A4">
        Eingang: ${escapeHtml(localMoment(entry.received))} · Antworten geht direkt an
        ${escapeHtml(entry.email)}</div>
    </td></tr>
  </table>
</body></html>`;
}

function subject(entry) {
  const who = entry.name || entry.email;
  return entry.subject ? `Anfrage: ${entry.subject} — ${who}` : `Neue Anfrage von ${who}`;
}

module.exports = { subject, text: mailText, html: mailHtml, localMoment, escapeHtml };
