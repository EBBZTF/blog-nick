# berdi-racing.com — website

Static website with no build step. Open `index.html` in a browser — or upload the
whole folder to a web space. For the admin area there is additionally a small
server (`server.js`), which likewise needs no dependencies.

## Changing content without touching code

All texts, figures, partners, packages, images and results live in **one** file:
`data/content.js`. It is edited through `admin.html` — never by hand.

### With the server (recommended, saving straight from the browser)

```
node server.js --set-password nick "a-long-password"   # once
node server.js                                         # starts on port 4000
```

Then open `http://127.0.0.1:4000/admin.html`, sign in, make changes, **Save**.
The server writes `data/content.js` and puts a backup under `data/backups/`
first (the last 30 are kept).

| Environment variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | port |
| `HOST` | `127.0.0.1` | set to `0.0.0.0` to be reachable on the network |

Further accounts: `node server.js --set-password emma "…"`, remove with
`node server.js --remove-user emma`. Passwords are stored as scrypt hashes in
`data/admin-users.json` — that file is never delivered by the server and does
not belong in a public repository.

### Without the server (plain web space)

`admin.html` works there too. The browser notices that no server answers;
instead of “Save” the button then reads **“Download file”**. Upload the
downloaded `content.js` to `data/content.js` by FTP — done. In this case the
sign-in is only a guard against a stray click, not a real access barrier.

## Pages

| File | Page |
|---|---|
| `index.html` | home — hero, spec bar, next start, last outing |
| `ueber-mich.html` | about me — Nick's own text: motivation, how it started, goals |
| `das-auto.html` | the car — spec sheet, two setups, detail shots |
| `saison.html` | season — key figures, results table with filter, career |
| `galerie.html` | gallery — filter by category |
| `partner.html` | partner — key figures, packages, current partners |
| `sponsorflaechen.html` | the car without livery, free advertising surfaces marked |
| `journal.html` | journal — entries from the admin area |
| `kontakt.html` | contact — enquiry form |
| `impressum.html` | imprint and privacy policy (linked from the footer) |
| `admin.html` | admin area (not in the navigation, `noindex`) |

The page file names are German on purpose — see “Language in the code” below.

## Shared files

| File | Content |
|---|---|
| `css/base.css` | design tokens (`--alpine`, `--anthracite`, `--bbs` …), reset |
| `css/site.css` | nav (sticky), hero, sections, tables, form, footer |
| `css/components.css` | discipline badges, setup cards, empty states, car diagram |
| `css/admin.css` | only for `admin.html` |
| `data/content.js` | **the entire content of the website** |
| `data/inquiries.json` | received contact enquiries, created by the server |
| `data/uploads/` | uploaded images, delivered under `/media/` |
| `js/labels.js` | German wording for the codes used in the content |
| `js/content.js` | writes the content into the pages |
| `js/site.js` | filter chips on the season and gallery pages |
| `js/api.js` | every `/api/*` call in one place (`window.API`) |
| `js/contact.js` | contact form |
| `js/upload.js` | scaling images, uploading, media library |
| `js/admin.js` | form and saving logic of the admin area |
| `server.js` | optional server: sign-in + saving |
| `deploy/*` | systemd unit, Caddyfile and backup script for the Pi |
| `img/*.jpg` | the photos (max. 1800 px) |

The order of the stylesheets is the cascade — keep `base → site → components`.
The scripts must appear in this order: `js/labels.js` → `data/content.js` →
`js/content.js` → `js/site.js`. Where `js/api.js` is needed it comes before its
users — on `kontakt.html` before `js/contact.js`, on `admin.html` before
`js/upload.js` and `js/admin.js`.

There is no JavaScript inside the HTML files. New behaviour goes into a file
under `js/`, not into a `<script>` on the page.

## How the content reaches the page

The default text sits in the HTML directly and carries a marker:

```html
<b data-cms="car.gearbox">5-Gang handgeschalten</b>
```

`js/content.js` replaces the text with the value from `data/content.js`. If the
file is missing, the text in the HTML stays — so the page is never empty. Lists
(partners, packages, gallery, results, journal, career) are filled through
containers: `[data-partners]`, `[data-packages]`, `[data-gallery]`,
`[data-events-table]`, `[data-journal]`, `[data-timeline]`.

Images work the same way with `data-cms-img`:

```html
<img data-cms-img="index.heroImage" src="img/wolken-dreiviertel.jpg" alt="…">
```

For longer text there is `data-cms-para`. It fills the container with one `<p>`
per paragraph, where a blank line in the saved value starts a new one. The
about page uses it for the three long sections, so Nick can write several
paragraphs without any markup:

```html
<div data-cms-para="about.motivation">
  <p>Fallback, stays in place if nothing is saved.</p>
</div>
```

Adding a new field: put `data-cms="…"` in the HTML, add the key to
`data/content.js`, and enter it in the `SCHEMA` catalogue at the top of
`js/admin.js` — the form builds itself from that.

## Images

Images are picked in the admin area, not copied over SSH. Every image field can
do three things: choose a file from the device, take an already uploaded image
from the **media library**, or remove the image. A file can also be dragged
straight onto the field.

**Scaling happens in the browser** before anything is uploaded (`js/upload.js`):
to at most 2000 px on the long edge, as WebP, plus a 480 px thumbnail. That way
the Pi needs no image library, has nothing to compute, and a 4 MB phone photo
becomes roughly 200 KB. Smaller images are never scaled up.

Files are stored in `data/uploads/` and delivered under `/media/`. Two reasons
for the split: `data/` is the only directory the service may write to
(`ReadWritePaths` in the systemd unit), and the rule “nothing below `/data/` is
public except `content.js`” stays intact. The file name is generated from random
bytes on the server — the name coming from the browser is never used.

On every upload the server checks the **magic bytes** (`RIFF…WEBP`) rather than
the Content-Type that was sent along, and limits to 3 MB per image and 300 MB
for the whole directory. Because an image never changes under its name, it is
delivered with `max-age=31536000, immutable`.

Where a thumbnail exists, `js/content.js` offers both sizes via `srcset`. That
counts most in the gallery: nine tiles at a third of the width each used to pull
the image at full size.

Deleting asks the server first. If the image is still referenced anywhere in the
content, it names the places and only deletes on confirmation — otherwise an
image would quietly vanish from a page.

The existing photos in `img/` are untouched and keep working; an image field
also accepts a plain path as its value.

## Journal

An entry has a date, a discipline, a title, a **lead image** and text. A blank
line in the text starts a new paragraph — there is deliberately no more
formatting than that.

## Codes instead of display text

Discipline and gallery category are stored in the content as codes (`rally`,
`hillclimb`, `build`, `car`), with the German words for them in `js/labels.js`.
Free surfaces are a `true`/`false`, not a text.

This is not for its own sake: previously the code read the German display text
back out of the page — a discipline starting with “rall” was coloured as a
rally, and a surface counted as taken if the rendered text matched “vergeben”.
A renamed label therefore silently changed the styling and broke the filters.
Now code decides on code, and a label is only ever text.

Filter chips carry their code in `data-filter`, the filtered elements in
`data-tag`.

## Language in the code

Identifiers, comments, this documentation, the keys in `data/content.js`, the log
and command-line output of the server and the whole admin area are **English**.

German is only what a visitor of the finished website reads: the page content
itself, plus the answers of `/api/contact` and the static 404 page, because those
appear on the site. `js/api.js` therefore carries English messages and
`js/contact.js` assembles the German sentence for the visitor itself, instead of
passing an English one through.

The page file names stay German (`das-auto.html`, `galerie.html`,
`sponsorflaechen.html` …) — those are public addresses, and renaming them would
break links, bookmarks and search results without improving anything inside.

Two more things stay German by necessity: the values in `js/labels.js`, which are
the words shown on the site, and the legacy keys `firma`/`telefon`/`nachricht`/
`betreff`/`eingang`, which the enquiries tab still reads because records written
before the rename carry them and an arrived enquiry is never rewritten.

## Contact form

`js/contact.js` sends the form through `API.post()` to `POST /api/contact`. The
server checks the address, discards everything but the permitted fields and
appends the entry to `data/inquiries.json` — atomically through a `.tmp` file, as
with `content.js`. An invisible field (`website`) catches bots: if it is filled
in, the server answers `ok` but stores nothing. Five enquiries per address per
hour are possible, counted separately from the failed sign-ins.

The file is read through `GET /api/inquiries` (signed in only, newest first). It
is never delivered: `isBlocked()` in `server.js` lets only `content.js` out of
`data/`. Because it lives in `data/`, it is covered by the daily backup.

Validation before sending uses `form.checkValidity()`; the rules live in the HTML
as `required` and `type="email"` and not a second time in the script. The status
line is coloured through the classes `.is-ok` and `.is-error`, whose colours are
the tokens `--ok` and `--error` in `css/base.css`.

The enquiries are shown in the admin area under **Enquiries**. The tab lists them
newest first, with the address as a `mailto:` link for replying directly; the
number next to the tab is how many are still unread. Which ones have been read is
kept in `data/inquiries-read.json` — a file of its own, so that `inquiries.json`
is only ever appended to and an arrived enquiry is never overwritten.

In addition a **notification e-mail** goes out, if set up (see 3d). Order inside
the server: the enquiry is stored first, then the visitor gets their answer, and
only after that is the mail sent. A slow or failed mail service therefore cannot
affect the form — at worst the mail is missing and the enquiry is in the admin
area anyway.

Without a running server there is no recipient — on a plain web space the form
has no function; the status line then names the mail address.

## Hardening

What `server.js` does by itself — regardless of whether Caddy and Cloudflare are
configured correctly:

| Measure | Where | Effect |
|---|---|---|
| Known file types only | `isBlocked()` / `TYPES` | Anything without an extension from `TYPES` is not delivered. `README.md` and `events-schema.json` are therefore no longer retrievable — they gave away the structure, the paths and which endpoints are open. A file added later is not public by accident. |
| Security headers | `SECURITY_HEADERS` | CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` on **every** answer. Deliberately here and not in the Caddyfile: it applies to local development too and survives a mistake in the proxy configuration. Only HSTS stays in Caddy. |
| Slowing down sign-in | `clientIp()` | `X-Forwarded-For` is read **from the right**. Caddy appends the peer it actually saw; everything left of that comes from the caller. Read from the left the lockout was useless — rotating invented addresses in the header gave unlimited password attempts. Behind the tunnel `CF-Connecting-IP` decides anyway. |
| Bounding memory | sweeper | One timer clears out sessions **and** both counter maps. Previously a counter entry only disappeared when the same address came back — anyone rotating addresses could fill up the Pi's memory. |
| Oversized requests | `readBody()` | Answers **413** with a reason instead of dropping the connection. Previously a message that was too long looked like a broken website. |

The CSP allows `script-src 'self'` without exception — there is no `<script>`
with content and no `onclick` attribute anywhere in the project. For `style-src`
`'unsafe-inline'` is needed, because the pages carry `style` attributes and
`js/content.js` writes to `.style` directly.

Not in the code but set up by hand, and therefore worth checking regularly:
**Cloudflare Access** in front of `/admin.html` and the admin endpoints (see 3b),
plus the rate-limiting rule from 3a. Without Access, `/admin.html` is reachable
on the internet and protected by the password alone.

## New page

Copy an existing page, replace the content between nav and footer, adjust
`<title>`. Navigation and footer are duplicated in every page — a new navigation
item has to be added in all files.

## Running on the Raspberry Pi

The website runs on the Pi as a service. In front of it sits Caddy, and right at
the front a Cloudflare tunnel that takes care of HTTPS and reachability. All
templates are in `deploy/`.

```
Internet ──► Cloudflare ──► tunnel  ──► Caddy ──► node server.js
             edge/TLS       outbound     :8080     127.0.0.1:4000
```

The tunnel is opened **from the Pi outwards** and kept open. That means no port
forwarding, no DDNS, no certificate to manage, and the IP address of the line is
not published. Node and Caddy both listen on `127.0.0.1` only and are never
reachable directly from outside.

### 1. Requirements

Node 18 or newer (`node -v`). Raspberry Pi OS Bookworm ships it; otherwise
install it through NodeSource.

### 2. Setting up the service

Put the project in `/home/pi/nick-blog` (adjust other paths in the unit), then:

```
node server.js --set-password nick "a-long-password"
sudo cp deploy/nickberdi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nickberdi
systemctl status nickberdi
```

`enable` makes sure the service comes back up by itself after a power cut.
Logs: `journalctl -u nickberdi -f`.

### 3. Setting up the Cloudflare tunnel

The domain is at Cloudflare, so the zone and name servers already exist.

```
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

In the dashboard under **Zero Trust → Networks → Tunnels** create a tunnel
`nickberdi` and run the installation command it shows on the Pi:

```
sudo cloudflared service install <TOKEN-FROM-THE-DASHBOARD>
sudo systemctl status cloudflared
```

Then create two entries in the **Public Hostname** tab, both pointing at Caddy:

| Subdomain | Domain | Service |
|---|---|---|
| *(empty)* | berdi-racing.com | `HTTP` → `localhost:8080` |
| `www` | berdi-racing.com | `HTTP` → `localhost:8080` |

Cloudflare creates the DNS records itself (proxied `CNAME` to
`<tunnel-id>.cfargotunnel.com`). **Delete the old `A` records for `@` and `www`
that point at the home IP first** — if they stay, there are sporadic outages that
are hard to track down. Port forwarding in the router and DDNS can go now.

```
sudo apt install caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -sI -H "Host: berdi-racing.com" http://127.0.0.1:8080/ | head -1   # 200
```

### 3a. Settings in the Cloudflare interface

| Area | Setting | Value |
|---|---|---|
| SSL/TLS | Encryption mode | Full (strict) |
| SSL/TLS → Edge Certificates | Always Use HTTPS | on |
| SSL/TLS → Edge Certificates | Minimum TLS Version | 1.2 |
| Security | WAF Managed Ruleset | on |
| Security | rate-limiting rule | `/api/login`, 5 per minute per IP |
| Security → WAF | **one skip rule for the admin API** | see below — without it the admin area is answered with 403 |
| Caching → Cache Rules | path starts with `/img/` | edge TTL 1 month |
| Caching → Cache Rules | path starts with `/media/` | edge TTL 1 month |
| Caching → Cache Rules | `/admin.html`, `/data/content.js`, `/api/*` | bypass cache |

Serving the images from the edge cache takes the work off the SD card — exactly
the part that fails first.

**The WAF needs one exception for the admin area.** Requests from the admin
area are answered with **403** before they ever reach the Pi: an upload is a
`POST` with a binary body, and saving content is a `POST` whose text may contain
quotes or angle brackets. The Managed Ruleset reads both as an attack. The admin
area then reports “The server answered with error 403.”

One rule covers all of it — not one rule per action. Under **Security → WAF →
Custom rules → Create rule**, press *Edit expression* and paste:

```
(starts_with(http.request.uri.path, "/api/") and not http.request.uri.path eq "/api/contact")
```

| Form field | Value |
|---|---|
| Rule name | `Admin API — skip managed rules` |
| Then take action | **Skip** |
| Status | **Active** |

After choosing **Skip** the form expands with checkboxes for what to skip. Tick
**Managed rules** — that is the ruleset doing the blocking — and **All remaining
custom rules**.

**Do not tick “Rate limiting rules.”** That is what keeps the `/api/login` brake
from the table above alive. If Skip offers no Managed-rules checkbox in this
zone, use **Security → WAF → Managed rules → Cloudflare Managed Ruleset → Add
exception** with the same expression instead.

`/api/contact` is deliberately left out: it is the only endpoint a stranger can
reach, so it keeps the full ruleset. Everything else under `/api/` is admin-only,
and writing the rule by prefix means an endpoint added later is covered without
touching Cloudflare again.

Skipping the ruleset there is a deliberate decision, not a hole. Those endpoints
already sit behind Cloudflare Access and the password login, every one of them
requires a session, uploads are checked by magic bytes rather than the declared
type, sizes are capped at 3 MB per image and 300 MB per directory, file names are
generated on the server, and the accepted form fields are an allow-list. There is
also nothing for SQL-injection or code-execution patterns to reach: no database,
no SQL, no `eval`, no shell calls and no dependencies. On the public pages, where
the ruleset actually earns its keep, it stays on.

**Diagnosing a 403:** the upload endpoint itself can only answer 200, 400, 401,
415, 429, 500 or 507, and the other admin endpoints never answer 403 at all — so
a 403 always comes from in front of the server. **Security → Events** shows which
rule fired and separates a WAF block (Managed rule, action Block) from an Access
denial (add the paths from 3b).

### 3b. Securing the admin area

Under **Zero Trust → Access → Applications** create a *Self-hosted* application,
policy *Allow* with your own mail addresses and one-time PIN. The sign-in of
`server.js` remains behind it as a second hurdle.

Enter the paths **individually** — not `/api` wholesale:

```
berdi-racing.com/admin.html
berdi-racing.com/api/content
berdi-racing.com/api/inquiries
berdi-racing.com/api/upload
berdi-racing.com/api/uploads
```

`/api/contact` has to stay public, otherwise every visitor's contact form ends up
at the Access sign-in instead of at the recipient. `/api/login`, `/api/session`
and `/api/logout` stay open as well; they are protected by the password and
slowed down by the rate-limiting rule from 3a.

Set the session length to 24 hours: if the Access session expires in the middle
of editing, `js/admin.js` gets Cloudflare's sign-in page instead of JSON when
saving and reports a confusing error.

### 3c. Measuring usage

Two different things, both free:

- **Analytics & Logs → Traffic** is there automatically as soon as the traffic
  goes through Cloudflare: requests, data volume, cache ratio, status codes,
  countries, blocked attacks. It counts search engines and bots too.
- **Analytics & Logs → Web Analytics** is the visitor count you show a partner:
  page views, visits, most visited pages, referrers, devices. Under **Add a
  site** pick the domain from the list — because the zone is proxied, Cloudflare
  injects the counting pixel itself and there is nothing to change in the code.
  Without cookies and without fingerprinting, so no cookie banner is needed; it
  should still be mentioned in the imprint.

Retention on the free plan is limited — for a season review, export the monthly
figures as you go.

Finally, under **Notifications**, set an alert for **Tunnel Health** to your own
mail address. Without open ports from outside that is the only way to find out
that the Pi is down.

### 3d. Notification for new enquiries

Optional. Without this setup simply no mail is sent; the enquiry still lands in
`data/inquiries.json` and in the admin area.

The Pi cannot send mail itself — a residential line has no reputation, so the
message lands in spam or is refused outright. Hence a sending service; here
[Resend](https://resend.com), whose free tier is enough for a few enquiries a
month.

1. Create an account, add `berdi-racing.com` under **Domains** and enter the
   **SPF and DKIM records** it shows at Cloudflare under DNS. Without this step
   Resend refuses to send.
2. Under **API Keys** create a key with sending permission.
3. Store it on the Pi — in a file of its own, **not** in the systemd unit, since
   that one is in the repository:

```
sudo install -m 600 /dev/null /etc/nickberdi.env
sudo tee /etc/nickberdi.env >/dev/null <<'ENV'
RESEND_API_KEY=re_...
MAIL_TO=nick@berdi-racing.com
MAIL_FROM=website@berdi-racing.com
ENV
sudo systemctl restart nickberdi
```

`MAIL_FROM` has to be on the domain verified at Resend. `MAIL_TO` is who gets
notified. The sender address of the enquiry is set as `Reply-To` — a reply
therefore goes straight to the interested party.

To check: send an enquiry through the form and look at
`journalctl -u nickberdi -n 20`. If `[mail] Resend answered 401` appears there,
the key is wrong; with `422` the domain verification is missing. In both cases
the enquiry is stored anyway.

### 4. Backups

`data/backups/` protects against a botched change, but it sits on the same SD
card as everything else. SD cards fail eventually — hence additionally:

```
sudo cp deploy/nickberdi-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nickberdi-backup.timer
```

That puts a dated snapshot under `~/backups/nickberdi` every day and keeps the
last 30. Uploaded images are excluded from the archive on purpose — they would
sit in all 30 copies. To additionally copy to another machine, add a target in
`nickberdi-backup.service`:

```
ExecStart=/home/pi/nick-blog/deploy/backup-content.sh pi@nas:/backups/website
```

With a target given, `data/uploads/` is synced there separately and
incrementally, so only new images go over the wire.

Restoring is an unpacking:

```
tar -xzf ~/backups/nickberdi/data-2027-03-14_030000.tar.gz -C /home/pi/nick-blog
sudo systemctl restart nickberdi
```

### 5. Why a file and not a database

The entire content is a single document of a few kilobytes, changed once or twice
a month. Postgres would permanently occupy memory on a Pi and, through its
write-ahead log, constantly write to the SD card — exactly the part that fails
first. A file costs nothing, can be cached through Caddy, can be read with `cat`
and backed up with `tar`. A database only pays off once there is really something
to query (many journal posts with search, times across many events) — and then
SQLite would be the next step, not Postgres.

## Open points

- Still without a target (`href="#"`): imprint, “Unterlagen (PDF)”, “Medienpaket (ZIP)”.
- The key figures (race days, Instagram, reach) and the “next start” strip are
  deliberately set to `—` until the numbers are settled. Both are editable in the
  admin area.
- Results and journal are empty because no season has been driven yet. As soon as
  the first entry exists, the table and the post list appear automatically.
- The car diagram on `sponsorflaechen.html` is a schematic drawing (SVG), not a
  photo. Ticking a surface as taken colours it grey in the diagram.
- The photos in `img/` are still the original JPEGs. Re-uploaded through the admin
  area they become WebP with a thumbnail, which makes the gallery in particular
  lighter. It is not necessary — old paths keep working.
