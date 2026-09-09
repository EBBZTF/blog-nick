# berdi-racing.com — Website

Statische Website ohne Build-Schritt. `index.html` im Browser öffnen — oder den ganzen
Ordner auf einen Webspace laden. Für den Admin-Bereich gibt es zusätzlich einen kleinen
Server (`server.js`), der ebenfalls ohne Abhängigkeiten auskommt.

## Inhalt ändern, ohne Code anzufassen

Alle Texte, Zahlen, Partner, Pakete, Bilder und Resultate stehen in **einer** Datei:
`data/content.js`. Bearbeitet wird sie über `admin.html` — nie von Hand.

### Mit Server (empfohlen, Speichern direkt aus dem Browser)

```
node server.js --set-password nick "ein-langes-passwort"   # einmalig
node server.js                                             # startet auf Port 4000
```

Dann `http://127.0.0.1:4000/admin.html` öffnen, anmelden, ändern, **Speichern**.
Der Server schreibt `data/content.js` und legt vorher eine Sicherung unter
`data/backups/` ab (die letzten 30 bleiben erhalten).

| Umgebungsvariable | Standard | Zweck |
|---|---|---|
| `PORT` | `4000` | Port |
| `HOST` | `127.0.0.1` | auf `0.0.0.0` setzen, um im Netz erreichbar zu sein |

Weitere Zugänge: `node server.js --set-password emma "…"`,
entfernen mit `node server.js --remove-user emma`.
Passwörter liegen als scrypt-Hash in `data/admin-users.json` — diese Datei wird vom
Server nie ausgeliefert und gehört nicht in ein öffentliches Repository.

### Ohne Server (reiner Webspace)

`admin.html` funktioniert auch dort. Der Browser erkennt, dass kein Server antwortet;
statt „Speichern“ steht dann **„Datei herunterladen“**. Die heruntergeladene `content.js`
per FTP nach `data/content.js` laden — fertig. Die Anmeldung ist in diesem Fall nur ein
Schutz gegen Verklicken, keine echte Zugangssperre.

## Seiten

| Datei | Seite |
|---|---|
| `index.html` | Start — Hero, Datenleiste, nächster Start, letzter Einsatz |
| `das-auto.html` | Das Auto — Datenblatt, zwei Setups, Detailaufnahmen |
| `saison.html` | Saison — Kennzahlen, Resultattabelle mit Filter, Werdegang |
| `galerie.html` | Galerie — Filter nach Kategorie |
| `partner.html` | Partner — Kennzahlen, Pakete, aktuelle Partner |
| `sponsorflaechen.html` | Das Auto ohne Beschriftung, freie Werbeflächen markiert |
| `journal.html` | Journal — Einträge aus dem Admin-Bereich |
| `kontakt.html` | Kontakt — Anfrageformular |
| `impressum.html` | Impressum und Datenschutzerklärung (aus dem Footer verlinkt) |
| `admin.html` | Admin-Bereich (nicht in der Navigation, `noindex`) |

## Gemeinsame Dateien

| Datei | Inhalt |
|---|---|
| `css/base.css` | Design-Tokens (`--alpine`, `--anthracite`, `--bbs` …), Reset |
| `css/site.css` | Nav (sticky), Hero, Sektionen, Tabellen, Formular, Footer |
| `css/components.css` | Disziplin-Badges, Setup-Karten, Leer-Hinweise, Fahrzeug-Grafik |
| `css/admin.css` | nur für `admin.html` |
| `data/content.js` | **der gesamte Inhalt der Website** |
| `data/anfragen.json` | eingegangene Kontaktanfragen, wird vom Server angelegt |
| `js/content.js` | schreibt den Inhalt in die Seiten |
| `js/site.js` | Filter-Chips auf Saison und Galerie |
| `js/api.js` | alle `/api/*`-Aufrufe an einer Stelle (`window.API`) |
| `js/kontakt.js` | Kontaktformular |
| `js/admin.js` | Formular und Speicherlogik des Admin-Bereichs |
| `server.js` | optionaler Server: Anmeldung + Speichern |
| `deploy/*` | systemd-Unit, Caddyfile und Sicherungsskript für die Pi |
| `img/*.jpg` | die Fotos (max. 1800 px) |

Reihenfolge der Stylesheets ist die Kaskade — `base → site → components` beibehalten.
Die Skripte müssen in dieser Reihenfolge stehen: `data/content.js` → `js/content.js` →
`js/site.js`. Wo `js/api.js` gebraucht wird, steht es vor seinen Nutzern — auf
`kontakt.html` vor `js/kontakt.js`, auf `admin.html` vor `js/admin.js`.

Es steht kein JavaScript in den HTML-Dateien. Neues Verhalten kommt in eine Datei
unter `js/`, nicht in ein `<script>` auf der Seite.

## Wie der Inhalt in die Seite kommt

Im HTML steht der Standardtext direkt drin und trägt eine Markierung:

```html
<b data-cms="car.getriebe">5-Gang handgeschalten</b>
```

`js/content.js` ersetzt den Text durch den Wert aus `data/content.js`. Fehlt die Datei,
bleibt der Text im HTML stehen — die Seite ist also nie leer. Listen (Partner, Pakete,
Galerie, Resultate, Journal, Werdegang) werden über Container gefüllt:
`[data-partners]`, `[data-packages]`, `[data-gallery]`, `[data-events-table]`,
`[data-journal]`, `[data-timeline]`.

Ein neues Feld anlegen: `data-cms="…"` ins HTML setzen, den Schlüssel in `data/content.js`
ergänzen und ihn im Katalog `SCHEMA` oben in `js/admin.js` eintragen — das Formular baut
sich daraus selbst.

## Kontaktformular

`js/kontakt.js` schickt das Formular über `API.post()` an `POST /api/kontakt`. Der
Server prüft die Adresse, verwirft alles außer den erlaubten Feldern und hängt
den Eintrag an `data/anfragen.json` an — atomar über eine `.tmp`-Datei, wie bei
`content.js`. Ein unsichtbares Feld (`website`) fängt Bots ab: ist es gefüllt,
antwortet der Server `ok`, speichert aber nichts. Pro Adresse sind fünf
Anfragen je Stunde möglich, gezählt getrennt von den Login-Fehlversuchen.

Gelesen wird die Datei über `GET /api/anfragen` (nur angemeldet, neueste
zuerst). Ausgeliefert wird sie nie: `isBlocked()` in `server.js` lässt aus
`data/` einzig `content.js` durch. Da sie in `data/` liegt, ist sie von der
täglichen Sicherung mit abgedeckt.

Geprüft wird vor dem Absenden mit `form.checkValidity()`; die Regeln stehen als
`required` und `type="email"` im HTML und nicht ein zweites Mal im Skript. Die
Statuszeile färbt sich über die Klassen `.is-ok` und `.is-fehler`, deren Farben
als Tokens `--ok` und `--fehler` in `css/base.css` liegen.

Ohne laufenden Server gibt es keinen Empfänger — auf einem reinen Webspace
bleibt das Formular ohne Funktion; die Statuszeile nennt dann die Mailadresse.

Noch offen: es geht **keine Benachrichtigung** raus, jemand muss die Anfragen
im Admin-Bereich abholen. Und `admin.html` zeigt sie noch nicht an, obwohl
`/api/anfragen` die Daten schon liefert.

## Neue Seite

Eine bestehende Seite kopieren, Inhalt zwischen Nav und Footer ersetzen, `<title>` anpassen.
Navigation und Footer sind in jeder Seite dupliziert — ein neuer Navigationspunkt muss
in allen Dateien ergänzt werden.

## Betrieb auf der Raspberry Pi

Die Website läuft auf der Pi als Dienst. Davor sitzt Caddy, und ganz vorne ein
Cloudflare Tunnel, der HTTPS und die Erreichbarkeit übernimmt. Alle Vorlagen
liegen in `deploy/`.

```
Internet ──► Cloudflare ──► Tunnel ──► Caddy ──► node server.js
             Edge/TLS       ausgehend  :8080     127.0.0.1:4000
```

Der Tunnel wird **von der Pi nach aussen** aufgebaut und offen gehalten. Es gibt
damit keine Portweiterleitung, kein DDNS, kein Zertifikat zu verwalten, und die
IP-Adresse des Anschlusses steht nicht im Netz. Node und Caddy lauschen beide nur
auf `127.0.0.1` und sind von aussen nie direkt erreichbar.

### 1. Voraussetzungen

Node 18 oder neuer (`node -v`). Raspberry Pi OS Bookworm bringt das mit,
sonst über NodeSource nachinstallieren.

### 2. Dienst einrichten

Projekt nach `/home/pi/nick-blog` legen (andere Pfade in der Unit anpassen), dann:

```
node server.js --set-password nick "ein-langes-passwort"
sudo cp deploy/nickberdi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nickberdi
systemctl status nickberdi
```

`enable` sorgt dafür, dass der Dienst nach einem Stromausfall von selbst wieder
hochkommt. Logs: `journalctl -u nickberdi -f`.

### 3. Cloudflare Tunnel einrichten

Die Domain liegt bei Cloudflare, Zone und Nameserver bestehen also schon.

```
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

Im Dashboard unter **Zero Trust → Networks → Tunnels** einen Tunnel `nickberdi`
anlegen, den angezeigten Installationsbefehl auf der Pi ausführen:

```
sudo cloudflared service install <TOKEN-AUS-DEM-DASHBOARD>
sudo systemctl status cloudflared
```

Dann im Reiter **Public Hostname** zwei Einträge anlegen, beide auf Caddy:

| Subdomain | Domain | Service |
|---|---|---|
| *(leer)* | berdi-racing.com | `HTTP` → `localhost:8080` |
| `www` | berdi-racing.com | `HTTP` → `localhost:8080` |

Cloudflare legt die DNS-Einträge selbst an (proxied `CNAME` auf
`<tunnel-id>.cfargotunnel.com`). **Alte `A`-Einträge für `@` und `www`, die auf
die Heim-IP zeigen, vorher löschen** — bleiben sie stehen, gibt es sporadische
Ausfälle, die schwer zu finden sind. Portweiterleitung im Router und DDNS können
jetzt weg.

```
sudo apt install caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -sI -H "Host: berdi-racing.com" http://127.0.0.1:8080/ | head -1   # 200
```

### 3a. Einstellungen in der Cloudflare-Oberfläche

| Bereich | Einstellung | Wert |
|---|---|---|
| SSL/TLS | Encryption mode | Full (strict) |
| SSL/TLS → Edge Certificates | Always Use HTTPS | An |
| SSL/TLS → Edge Certificates | Minimum TLS Version | 1.2 |
| Security | WAF Managed Ruleset | An |
| Security | Rate-Limiting-Regel | `/api/login`, 5 pro Minute je IP |
| Caching → Cache Rules | Pfad beginnt mit `/img/` | Edge TTL 1 Monat |
| Caching → Cache Rules | `/admin.html`, `/data/content.js`, `/api/*` | Bypass cache |

Die Bilder aus dem Edge-Cache auszuliefern nimmt der SD-Karte die Arbeit ab —
genau dem Bauteil, das als erstes ausfällt.

### 3b. Admin-Bereich absichern

Unter **Zero Trust → Access → Applications** eine *Self-hosted* Anwendung
anlegen, Policy *Allow* mit den eigenen Mailadressen und Einmal-PIN. Die
Anmeldung von `server.js` bleibt als zweite Hürde dahinter bestehen.

Als Pfade **einzeln** eintragen — nicht `/api` pauschal:

```
berdi-racing.com/admin.html
berdi-racing.com/api/content
berdi-racing.com/api/anfragen
```

`/api/kontakt` muss öffentlich bleiben, sonst landet das Kontaktformular für
jeden Besucher auf der Access-Anmeldung statt beim Empfänger. `/api/login`,
`/api/session` und `/api/logout` bleiben ebenfalls offen; sie sind durch das
Passwort geschützt und durch die Rate-Limiting-Regel aus 3a gebremst.

Sitzungsdauer auf 24 Stunden setzen: läuft die Access-Sitzung mitten im
Bearbeiten ab, bekommt `js/admin.js` beim Speichern die Anmeldeseite von
Cloudflare statt JSON zurück und meldet einen unverständlichen Fehler.

### 3c. Nutzung auswerten

Zwei verschiedene Dinge, beide kostenlos:

- **Analytics & Logs → Traffic** ist automatisch da, sobald der Verkehr über
  Cloudflare läuft: Anfragen, Datenmenge, Cache-Quote, Statuscodes, Länder,
  abgewehrte Angriffe. Zählt auch Suchmaschinen und Bots.
- **Analytics & Logs → Web Analytics** ist die Besucherzahl, die man einem
  Partner zeigt: Seitenaufrufe, Besuche, meistbesuchte Seiten, Verweise, Geräte.
  Bei **Add a site** die Domain aus der Liste wählen — weil die Zone proxied
  ist, spielt Cloudflare das Zählpixel selbst ein, es ist nichts am Code zu
  ändern. Ohne Cookies und ohne Fingerprinting, ein Cookie-Banner braucht es
  darum nicht; im Impressum erwähnen sollte man es trotzdem.

Die Aufbewahrungsdauer im kostenlosen Tarif ist begrenzt — für einen
Saisonrückblick die Monatszahlen unterwegs exportieren.

Zum Schluss unter **Notifications** eine Meldung für **Tunnel Health** auf die
eigene Mailadresse legen. Ohne offene Ports von aussen ist das der einzige Weg
zu erfahren, dass die Pi steht.

### 4. Sicherungen

`data/backups/` schützt vor einer verunglückten Änderung, liegt aber auf derselben
SD-Karte wie alles andere. SD-Karten fallen irgendwann aus — deshalb zusätzlich:

```
sudo cp deploy/nickberdi-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nickberdi-backup.timer
```

Das legt täglich einen datierten Schnappschuss unter `~/backups/nickberdi` ab und
behält die letzten 30. Um zusätzlich auf ein anderes Gerät zu kopieren, in
`nickberdi-backup.service` ein Ziel ergänzen:

```
ExecStart=/home/pi/nick-blog/deploy/backup-content.sh pi@nas:/backups/website
```

Wiederherstellen ist ein Entpacken:

```
tar -xzf ~/backups/nickberdi/data-2027-03-14_030000.tar.gz -C /home/pi/nick-blog
sudo systemctl restart nickberdi
```

### 5. Warum eine Datei und keine Datenbank

Der gesamte Inhalt ist ein einziges Dokument von wenigen Kilobyte, das ein- bis
zweimal im Monat geändert wird. Postgres würde auf einer Pi dauerhaft Arbeitsspeicher
belegen und durch sein Write-Ahead-Log ständig auf die SD-Karte schreiben — genau das
Bauteil, das als erstes ausfällt. Eine Datei kostet nichts, ist über Caddy zwischen-
speicherbar, lässt sich mit `cat` lesen und mit `tar` sichern. Eine Datenbank lohnt
sich erst, wenn wirklich abgefragt werden muss (viele Journal-Beiträge mit Suche,
Zeiten über viele Veranstaltungen hinweg) — und dann wäre SQLite der nächste Schritt,
nicht Postgres.

## Offene Punkte

- Noch ohne Ziel (`href="#"`): Impressum, „Unterlagen (PDF)“, „Medienpaket (ZIP)“.
- Kennzahlen (Renntage, Instagram, Reichweite) und die Leiste „Nächster Start“ stehen
  bewusst auf `—`, bis die Zahlen feststehen. Beides ist im Admin-Bereich änderbar.
- Resultate und Journal sind leer, weil noch keine Saison gefahren ist. Sobald der erste
  Eintrag erfasst ist, erscheinen Tabelle bzw. Beitragsliste automatisch.
- Die Fahrzeug-Grafik auf `sponsorflaechen.html` ist eine Schemazeichnung (SVG), kein Foto.
  Flächen auf „vergeben“ zu setzen färbt sie in der Grafik grau.
- Eingegangene Anfragen lösen keine Mail aus — sie müssen im Admin-Bereich
  abgeholt werden, und `admin.html` zeigt sie noch nicht an.
