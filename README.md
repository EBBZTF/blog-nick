# nickberdi.ch — Website

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
| `admin.html` | Admin-Bereich (nicht in der Navigation, `noindex`) |

## Gemeinsame Dateien

| Datei | Inhalt |
|---|---|
| `css/base.css` | Design-Tokens (`--alpine`, `--anthracite`, `--bbs` …), Reset |
| `css/site.css` | Nav (sticky), Hero, Sektionen, Tabellen, Formular, Footer |
| `css/components.css` | Disziplin-Badges, Setup-Karten, Leer-Hinweise, Fahrzeug-Grafik |
| `css/admin.css` | nur für `admin.html` |
| `data/content.js` | **der gesamte Inhalt der Website** |
| `js/content.js` | schreibt den Inhalt in die Seiten |
| `js/site.js` | Filter-Chips auf Saison und Galerie |
| `js/admin.js` | Formular und Speicherlogik des Admin-Bereichs |
| `server.js` | optionaler Server: Anmeldung + Speichern |
| `deploy/*` | systemd-Unit, Caddyfile und Sicherungsskript für die Pi |
| `img/*.jpg` | die Fotos (max. 1800 px) |

Reihenfolge der Stylesheets ist die Kaskade — `base → site → components` beibehalten.
Die Skripte müssen in dieser Reihenfolge stehen: `data/content.js` → `js/content.js` → `js/site.js`.

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

## Neue Seite

Eine bestehende Seite kopieren, Inhalt zwischen Nav und Footer ersetzen, `<title>` anpassen.
Navigation und Footer sind in jeder Seite dupliziert — ein neuer Navigationspunkt muss
in allen Dateien ergänzt werden.

## Betrieb auf der Raspberry Pi

Die Website läuft auf der Pi als Dienst, davor sitzt Caddy und kümmert sich um HTTPS.
Alle Vorlagen dafür liegen in `deploy/`.

```
Internet ──► Router (Port 80 + 443) ──► Caddy ──► node server.js
                                        HTTPS     127.0.0.1:4000
```

Der Node-Server bleibt bewusst auf `127.0.0.1` und ist von aussen nie direkt erreichbar —
alles läuft über Caddy. `HOST=0.0.0.0` wäre nur ohne Reverse Proxy nötig.

### 1. Voraussetzungen

Node 18 oder neuer (`node -v`). Raspberry Pi OS Bookworm bringt das mit,
sonst über NodeSource nachinstallieren.

### 2. Dienst einrichten

Projekt nach `/home/pi/nickberdi` legen (andere Pfade in der Unit anpassen), dann:

```
node server.js --set-password nick "ein-langes-passwort"
sudo cp deploy/nickberdi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nickberdi
systemctl status nickberdi
```

`enable` sorgt dafür, dass der Dienst nach einem Stromausfall von selbst wieder
hochkommt. Logs: `journalctl -u nickberdi -f`.

### 3. Domain und Zertifikat

Der Anschluss zu Hause hat in der Regel eine wechselnde IP-Adresse. Damit
`nickberdi.ch` trotzdem immer auf die Pi zeigt, braucht es **DDNS**: einen kleinen
Dienst auf der Pi, der dem DNS-Anbieter die neue Adresse meldet, sobald sie sich
ändert. Viele Registrare bieten das an (`ddclient` ist der übliche Weg), manche
Router können es selbst. Ohne DDNS ist die Seite nach dem nächsten IP-Wechsel des
Providers nicht mehr erreichbar.

Im Router **Port 80 und 443** auf die Pi weiterleiten. Port 80 wird gebraucht,
auch wenn die Seite nur über HTTPS läuft — Let's Encrypt prüft darüber, dass die
Domain wirklich zu diesem Anschluss gehört.

```
sudo apt install caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy holt das Zertifikat beim ersten Start selbst und erneuert es danach
automatisch. Ab dann läuft das Anmeldeformular des Admin-Bereichs verschlüsselt —
vorher geht das Passwort im Klartext durchs Netz.

Im `Caddyfile` steht auskommentiert eine Variante, die `/admin.html` nur aus dem
Heimnetz erreichbar macht. Empfehlenswert, sobald die Seite öffentlich ist.

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
ExecStart=/home/pi/nickberdi/deploy/backup-content.sh pi@nas:/backups/website
```

Wiederherstellen ist ein Entpacken:

```
tar -xzf ~/backups/nickberdi/data-2027-03-14_030000.tar.gz -C /home/pi/nickberdi
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
- Das Kontaktformular hat kein `action` — es braucht noch einen Empfänger/Endpoint.
- Kennzahlen (Renntage, Instagram, Reichweite) und die Leiste „Nächster Start“ stehen
  bewusst auf `—`, bis die Zahlen feststehen. Beides ist im Admin-Bereich änderbar.
- Resultate und Journal sind leer, weil noch keine Saison gefahren ist. Sobald der erste
  Eintrag erfasst ist, erscheinen Tabelle bzw. Beitragsliste automatisch.
- Die Fahrzeug-Grafik auf `sponsorflaechen.html` ist eine Schemazeichnung (SVG), kein Foto.
  Flächen auf „vergeben“ zu setzen färbt sie in der Grafik grau.
- Für den Betrieb unter einer Domain braucht es DDNS, siehe oben — sonst ist die
  Seite nach dem nächsten IP-Wechsel des Providers nicht mehr erreichbar.
