/* Admin area: edits data/content.js without touching code.
   Two modes of operation:
     server  — server.js is running, login and saving go through /api/*
     offline — page opened directly: login is local, saving = download a file */
(function () {
  "use strict";

  var L = window.LABELS;

  /* Options for the two coded lists. The value that ends up in the content is
     the code; the visible word comes from js/labels.js. */
  var DISCIPLINE_REQUIRED = L.options("discipline", ["hillclimb", "rally"]);
  var DISCIPLINE_OPTIONAL = L.options("discipline", ["", "hillclimb", "rally"]);
  var GALLERY_TAGS = L.options("galleryTag", ["car", "build", "rally", "hillclimb"]);

  /* ============================ Field catalogue ========================== */
  /* Add new fields here — the form builds itself from this.               */
  var SCHEMA = [
    { id: "site", title: "Allgemein", hint: "Erscheint in der Navigation und im Fuss jeder Seite.", key: "site", fields: [
      { k: "name",        label: "Name in der Navigation" },
      { k: "tag",         label: "Kürzel neben dem Namen" },
      { k: "footerBrand", label: "Name im Seitenfuss" },
      { k: "footerText",  label: "Text im Seitenfuss", type: "area" },
      { k: "instagram",   label: "Instagram-Adresse", half: true, sub: "Link im Seitenfuss" },
      { k: "youtube",     label: "YouTube-Adresse", half: true, sub: "Link im Seitenfuss" }
    ]},

    { id: "index", title: "Startseite", hint: "Titel, Einstiegstext und die Leiste \u201eN\u00e4chster Start\u201c. Leer lassen heisst: noch nicht festgelegt.", key: "index", fields: [
      { k: "heroTitle", label: "Titel" },
      { k: "heroSub",   label: "Untertitel" },
      { k: "heroText",  label: "Einstiegstext", type: "area" },
      { k: "heroImage", label: "Grosses Bild oben", type: "image" },
      { k: "heroBtn1",  label: "Knopf 1", half: true },
      { k: "heroBtn2",  label: "Knopf 2", half: true },
      { k: "nextEvent",      label: "N\u00e4chster Start — Veranstaltung", half: true, sub: "\u2014 bedeutet: noch offen" },
      { k: "nextDate",       label: "Nächster Start — Datum", half: true },
      { k: "nextDiscipline", label: "Nächster Start — Disziplin", half: true },
      { k: "nextSeries",     label: "Nächster Start — Serie", half: true },
      { k: "nextStanding",   label: "Nächster Start — Zwischenstand" },
      { k: "lastTitle", label: "Letzter Einsatz — Titel" },
      { k: "lastText",  label: "Letzter Einsatz — Text", type: "area" },
      { k: "partnersTitle", label: "Partner-Abschnitt — Titel" },
      { k: "partnersIntro", label: "Partner-Abschnitt — Text", type: "area" }
    ]},

    /* The three long texts are plain textareas: a blank line becomes a new
       paragraph when the page is rendered (data-cms-para in js/content.js), so
       there is nothing to learn and no markup to get wrong. */
    { id: "about", title: "\u00dcber mich", hint: "Die Seite ueber-mich.html — hier schreibt Nick selbst. Eine Leerzeile in den langen Texten beginnt einen neuen Absatz.", key: "about", fields: [
      { k: "title",     label: "Name / Titel" },
      { k: "sub",       label: "Zeile unter dem Namen" },
      { k: "intro",     label: "Kurzer Einstieg neben dem Foto", type: "area" },
      { k: "heroImage", label: "Foto", type: "image" },
      { k: "factBorn",        label: "Jahrgang", half: true },
      { k: "factHome",        label: "Wohnort", half: true },
      { k: "factDisciplines", label: "Disziplinen", half: true },
      { k: "factLicence",     label: "Lizenz", half: true, sub: "— bedeutet: noch offen" },
      { k: "motivationTitle", label: "Abschnitt 1 — Titel" },
      { k: "motivation",      label: "Abschnitt 1 — Text", type: "area", rows: 8, sub: "Leerzeile = neuer Absatz" },
      { k: "startTitle",      label: "Abschnitt 2 — Titel" },
      { k: "start",           label: "Abschnitt 2 — Text", type: "area", rows: 8, sub: "Leerzeile = neuer Absatz" },
      { k: "goalsTitle",      label: "Abschnitt 3 — Titel" },
      { k: "goals",           label: "Abschnitt 3 — Text", type: "area", rows: 8, sub: "Leerzeile = neuer Absatz" },
      { k: "ctaTitle",   label: "Schlussbox — Titel" },
      { k: "ctaText",    label: "Schlussbox — Text", type: "area" },
      { k: "ctaBtn1",    label: "Schlussbox — Knopf 1", half: true },
      { k: "ctaBtn2",    label: "Schlussbox — Knopf 2", half: true }
    ]},

    { id: "car", title: "Datenblatt", hint: "Die technischen Werte. Gewicht und Disziplinen erscheinen auch auf der Startseite.", key: "car", fields: [
      { k: "engine",      label: "Motor (Startseite)", half: true },
      { k: "drivetrain",  label: "Antrieb", half: true },
      { k: "weight",      label: "Gewicht (Startseite)", half: true },
      { k: "disciplines", label: "Disziplinen", half: true },
      { k: "chassis",     label: "Fahrgestell", half: true },
      { k: "engineLong",  label: "Motor (Datenblatt)", half: true },
      { k: "power",       label: "Leistung", half: true },
      { k: "gearbox",     label: "Getriebe", half: true },
      { k: "weightLong",  label: "Gewicht (Datenblatt)", half: true },
      { k: "wheels",      label: "Räder", half: true },
      { k: "safety",      label: "Sicherheit", half: true },
      { k: "paint",       label: "Lack", half: true }
    ]},

    { id: "carPage", title: "Seite \u201eDas Auto\u201c", key: "carPage", fields: [
      { k: "title",       label: "Titel" },
      { k: "intro",       label: "Einstiegstext", type: "area" },
      { k: "heroImage",   label: "Grosses Bild oben", type: "image" },
      { k: "setupsTitle", label: "Titel des Abschnitts mit den zwei Kacheln" },
      { k: "rallyTitle",  label: "Kachel Rallye — Titel" },
      { k: "rallyText",   label: "Kachel Rallye — Text", type: "area" },
      { k: "hillTitle",   label: "Kachel Bergrennen — Titel" },
      { k: "hillText",    label: "Kachel Bergrennen — Text", type: "area" },
      { k: "image1",      label: "Bild 1 der drei Kacheln", type: "image" },
      { k: "caption1",    label: "Bildunterschrift 1" },
      { k: "image2",      label: "Bild 2 der drei Kacheln", type: "image" },
      { k: "caption2",    label: "Bildunterschrift 2" },
      { k: "image3",      label: "Bild 3 der drei Kacheln", type: "image" },
      { k: "caption3",    label: "Bildunterschrift 3" }
    ]},

    { id: "season", title: "Saison", hint: "Solange keine Resultate erfasst sind, zeigt die Seite einen Hinweis statt einer Tabelle.", key: "season", fields: [
      { k: "intro",        label: "Einstiegstext", type: "area" },
      { k: "statStarts",   label: "Kennzahl Starts", half: true },
      { k: "statPodiums",  label: "Kennzahl Klassenpodeste", half: true },
      { k: "statWins",     label: "Kennzahl Klassensiege", half: true },
      { k: "historyIntro", label: "Werdegang — Einstiegstext", type: "area" }
    ]},

    { id: "events", title: "Resultate", hint: "Ein Eintrag pro Veranstaltung. Sobald der erste erfasst ist, erscheint auf der Saison-Seite die Tabelle.", list: "events",
      label: function (o) { return (o.date || "") + " " + (o.name || "Neue Veranstaltung"); },
      item: [
        { k: "date",        label: "Datum", half: true, sub: "z. B. 07.06." },
        { k: "name",        label: "Veranstaltung", half: true },
        { k: "discipline",  label: "Disziplin", type: "select", options: DISCIPLINE_REQUIRED, half: true },
        { k: "classRank",   label: "Rang Klasse", half: true, sub: "z. B. 1." },
        { k: "overallRank", label: "Rang gesamt", half: true },
        { k: "bestTime",    label: "Bestzeit", half: true }
      ]},

    { id: "timeline", title: "Werdegang", hint: "Erscheint auf der Saison-Seite, neuestes Jahr zuoberst.", list: "timeline",
      label: function (o) { return (o.year || "") + " — " + (o.title || "Neuer Eintrag"); },
      item: [
        { k: "year",  label: "Jahr", half: true },
        { k: "title", label: "Titel", half: true },
        { k: "text",  label: "Text", type: "area" }
      ]},

    { id: "partner", title: "Seite \u201ePartner\u201c", key: "partner", fields: [
      { k: "heroTitle", label: "Titel" },
      { k: "heroText",  label: "Einstiegstext", type: "area" },
      { k: "heroImage", label: "Bild oben rechts", type: "image" },
      { k: "kpiRaceDays",    label: "Renntage pro Saison", half: true, sub: "\u2014 bedeutet: noch offen" },
      { k: "kpiDisciplines", label: "Disziplinen", half: true },
      { k: "kpiInstagram",   label: "Instagram", half: true },
      { k: "kpiReels",       label: "Ø Reel-Aufrufe", half: true },
      { k: "kpiPress",       label: "Pressebeiträge", half: true },
      { k: "pkgTitle",     label: "Pakete — Titel" },
      { k: "pkgIntro",     label: "Pakete — Einstiegstext", type: "area" },
      { k: "pkgNote",      label: "Pakete — Hinweis darunter", type: "area" },
      { k: "currentIntro", label: "Aktuelle Partner — Text", type: "area" }
    ]},

    { id: "packages", title: "Sponsoring-Pakete", hint: "Reihenfolge = Reihenfolge auf der Seite. Das hervorgehobene Paket steht optisch im Vordergrund.", list: "packages",
      label: function (o) { return o.title || "Neues Paket"; },
      item: [
        { k: "title", label: "Titel", half: true },
        { k: "kind",  label: "Art", half: true, sub: "z. B. Sachleistung" },
        { k: "price", label: "Preis" },
        { k: "items", label: "Leistungen", type: "lines", sub: "Eine Zeile pro Punkt" },
        { k: "lead",  label: "Hervorgehoben darstellen", type: "check" }
      ]},

    { id: "partners", title: "Partner-Logos", hint: "\u201eFl\u00e4che noch frei\u201c zeichnet das Feld gold statt grau.", list: "partners",
      label: function (o) { return o.name || "Neuer Partner"; },
      item: [
        { k: "name", label: "Name" },
        { k: "logo", label: "Logo", type: "image" },
        { k: "free", label: "Fläche noch frei", type: "check" }
      ]},

    { id: "spots", title: "Freie Fl\u00e4chen", hint: "Angekreuzt heisst: die Fl\u00e4che ist vergeben und wird auf der Grafik grau statt gold gezeichnet.", key: "spots", fields: [
      { k: "intro", label: "Einstiegstext", type: "area" },
      { k: "s1", label: "1 · Vorderer Kotflügel ist vergeben", type: "check" },
      { k: "s2", label: "2 · Vordertür ist vergeben", type: "check" },
      { k: "s3", label: "3 · Seitenteil hinten ist vergeben", type: "check" },
      { k: "s4", label: "4 · Schweller ist vergeben", type: "check" },
      { k: "s5", label: "5 · Seitenscheibe hinten ist vergeben", type: "check" },
      { k: "t1", label: "6 · Motorhaube ist vergeben", type: "check" },
      { k: "t2", label: "7 · Dach ist vergeben", type: "check" },
      { k: "t3", label: "8 · Kofferraumdeckel ist vergeben", type: "check" }
    ]},

    /* No separate alt field here — the image field carries the description
       with the picture. The caption is something else and stays its own. */
    { id: "gallery", title: "Galerie", hint: "Bild ausw\u00e4hlen, Kategorie setzen — die Kategorie steuert die Filter auf der Galerie-Seite.", list: "gallery",
      label: function (o) { return o.cap || "Neues Bild"; },
      item: [
        { k: "src",     label: "Bild", type: "image" },
        { k: "cap",     label: "Bildunterschrift" },
        { k: "tag",     label: "Kategorie", type: "select", options: GALLERY_TAGS, half: true },
        { k: "lowCrop", label: "Auto sitzt tief im Bild (anderer Beschnitt)", type: "check", half: true }
      ]},

    { id: "journalTexts", title: "Seite \u201eJournal\u201c", key: "journal", fields: [
      { k: "intro", label: "Einstiegstext", type: "area" }
    ]},

    { id: "posts", title: "Journal-Eintr\u00e4ge", hint: "Solange kein Eintrag erfasst ist, zeigt die Seite einen Hinweis. Eine Leerzeile im Text beginnt einen neuen Absatz.", list: "posts",
      label: function (o) { return o.title || "Neuer Eintrag"; },
      item: [
        { k: "date",       label: "Date", half: true, sub: "z. B. 9. Juni 2027" },
        { k: "discipline", label: "Disziplin", type: "select", options: DISCIPLINE_OPTIONAL, half: true },
        { k: "title",      label: "Titel" },
        { k: "image",      label: "Titelbild", type: "image" },
        { k: "text",       label: "Text", type: "area", rows: 8, sub: "Leerzeile = neuer Absatz" }
      ]},

    { id: "galleryTexts", title: "Galerie-Text", key: "galleryPage", fields: [
      { k: "intro", label: "Einstiegstext", type: "area" }
    ]},

    /* Read-only: enquiries are not content, they arrive from the form. Hence
       neither "key" nor "list" but its own panel. */
    { id: "inquiries", title: "Anfragen", custom: "inquiries",
      hint: "Eingegangene Anfragen \u00fcber das Kontaktformular. Neueste zuoberst." },

    { id: "contact", title: "Kontakt", key: "contact", fields: [
      { k: "intro",     label: "Einstiegstext", type: "area" },
      { k: "asideText", label: "Ansprechperson — Text", type: "area" },
      { k: "mail",      label: "E-Mail", half: true },
      { k: "phone",     label: "Telefon", half: true },
      { k: "city",      label: "Ort" },
      { k: "pdfText",   label: "Text zum Unterlagen-Download", type: "area" }
    ]}
  ];

  /* ============================ State =================================== */
  var data = JSON.parse(JSON.stringify(window.SITE_CONTENT || {}));
  var dirty = false;
  var mode = "offline";           /* "server" as soon as /api/session answers */
  var $ = function (id) { return document.getElementById(id); };

  function markDirty() { dirty = true; $("bar").classList.add("is-dirty"); }
  function markClean() { dirty = false; $("bar").classList.remove("is-dirty"); }

  var toastTimer;
  function toast(msg, bad) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2600);
  }

  /* ============================ Building the form ======================== */
  function field(spec, get, set) {
    var wrap = document.createElement("div");
    var id = "f_" + Math.random().toString(36).slice(2, 9);

    if (spec.type === "check") {
      wrap.className = "fld check";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = id; cb.checked = !!get();
      cb.addEventListener("change", function () { set(cb.checked); markDirty(); });
      var lb = document.createElement("label");
      lb.htmlFor = id; lb.textContent = spec.label;
      wrap.appendChild(cb); wrap.appendChild(lb);
      return wrap;
    }

    if (spec.type === "image") {
      return imageField(spec, get, set);
    }

    wrap.className = "fld";
    var lab = document.createElement("label");
    lab.htmlFor = id; lab.textContent = spec.label;
    wrap.appendChild(lab);

    var input;
    if (spec.type === "select") {
      input = document.createElement("select");
      /* Options are {value, label} pairs: the code is stored, the word is
         shown. Plain strings are still accepted for simple lists. */
      spec.options.forEach(function (o) {
        var opt = typeof o === "string" ? { value: o, label: o } : o;
        var op = document.createElement("option");
        op.value = opt.value;
        op.textContent = opt.label === "" ? "— keine —" : opt.label;
        input.appendChild(op);
      });
      var current = get();
      input.value = current == null ? firstOptionValue(spec.options) : current;
    } else if (spec.type === "area" || spec.type === "lines") {
      input = document.createElement("textarea");
      input.rows = spec.rows || (spec.type === "lines" ? 6 : 3);
      var v = get();
      input.value = spec.type === "lines" ? (Array.isArray(v) ? v.join("\n") : "") : (v || "");
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = get() == null ? "" : String(get());
    }
    input.id = id;
    input.addEventListener("input", onChange);
    input.addEventListener("change", onChange);
    function onChange() {
      if (spec.type === "lines") {
        set(input.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean));
      } else {
        set(input.value);
      }
      markDirty();
    }
    wrap.appendChild(input);

    if (spec.sub) {
      var s = document.createElement("div");
      s.className = "sub"; s.textContent = spec.sub;
      wrap.appendChild(s);
    }
    return wrap;
  }

  function firstOptionValue(options) {
    var first = options[0];
    return typeof first === "string" ? first : first.value;
  }

  /* Lays out fields with half:true side by side in pairs. */
  function fieldsInto(host, specs, obj) {
    var i = 0;
    while (i < specs.length) {
      var s = specs[i];
      if (s.half && specs[i + 1] && specs[i + 1].half) {
        var row = document.createElement("div");
        row.className = "row2";
        row.appendChild(mk(s)); row.appendChild(mk(specs[i + 1]));
        host.appendChild(row); i += 2;
      } else {
        host.appendChild(mk(s)); i += 1;
      }
    }
    function mk(spec) {
      return field(spec,
        function () { return obj[spec.k]; },
        function (v) { obj[spec.k] = v; });
    }
  }

  function listPanel(host, group) {
    var arr = data[group.list] || (data[group.list] = []);

    var box = document.createElement("div");
    host.appendChild(box);

    var add = document.createElement("button");
    add.className = "abtn abtn-l";
    add.textContent = "+ Eintrag hinzufügen";
    add.addEventListener("click", function () {
      var blank = {};
      group.item.forEach(function (f) {
        if (f.type === "check") blank[f.k] = false;
        else if (f.type === "lines") blank[f.k] = [];
        else if (f.type === "image") blank[f.k] = null;
        else if (f.type === "select") blank[f.k] = firstOptionValue(f.options);
        else blank[f.k] = "";
      });
      arr.push(blank); markDirty(); render();
    });
    host.appendChild(add);

    function render() {
      box.textContent = "";
      if (!arr.length) {
        var e = document.createElement("div");
        e.className = "listempty";
        e.textContent = "Noch kein Eintrag erfasst.";
        box.appendChild(e);
        return;
      }
      arr.forEach(function (obj, idx) {
        var card = document.createElement("div");
        card.className = "card";

        var head = document.createElement("div");
        head.className = "card-head";
        var name = document.createElement("b");
        name.textContent = group.label(obj);
        var ord = document.createElement("span");
        ord.className = "ord";
        ord.textContent = (idx + 1) + " / " + arr.length;
        head.appendChild(name); head.appendChild(ord);

        head.appendChild(btn("↑", idx === 0, function () { swap(idx, idx - 1); }));
        head.appendChild(btn("↓", idx === arr.length - 1, function () { swap(idx, idx + 1); }));

        var del = document.createElement("button");
        del.className = "abtn abtn-x";
        del.textContent = "Löschen";
        del.addEventListener("click", function () {
          if (!confirm("Eintrag \u201e" + group.label(obj) + "\u201c wirklich l\u00f6schen?")) return;
          arr.splice(idx, 1); markDirty(); render();
        });
        head.appendChild(del);
        card.appendChild(head);

        fieldsInto(card, group.item, obj);
        card.addEventListener("input", function () { name.textContent = group.label(obj); });
        box.appendChild(card);
      });
    }
    function btn(txt, disabled, fn) {
      var b = document.createElement("button");
      b.className = "abtn abtn-l";
      b.style.padding = "5px 10px";
      b.textContent = txt;
      b.disabled = disabled;
      b.addEventListener("click", fn);
      return b;
    }
    function swap(a, b) {
      var t = arr[a]; arr[a] = arr[b]; arr[b] = t; markDirty(); render();
    }
    render();
  }

  function buildUI() {
    var tabs = $("tabs"), panels = $("panels");
    tabs.textContent = ""; panels.textContent = "";

    SCHEMA.forEach(function (group, i) {
      var tab = document.createElement("button");
      tab.textContent = group.title;
      tab.className = i === 0 ? "on" : "";
      tabs.appendChild(tab);

      var panel = document.createElement("section");
      panel.className = "panel" + (i === 0 ? " on" : "");
      var h = document.createElement("h2");
      h.textContent = group.title;
      panel.appendChild(h);
      if (group.hint) {
        var p = document.createElement("p");
        p.className = "hint"; p.textContent = group.hint;
        panel.appendChild(p);
      }

      if (group.custom === "inquiries") {
        inquiriesPanel(panel, tab);
      } else if (group.list) {
        listPanel(panel, group);
      } else {
        if (!data[group.key]) data[group.key] = {};
        fieldsInto(panel, group.fields, data[group.key]);
      }
      panels.appendChild(panel);

      tab.addEventListener("click", function () {
        Array.prototype.forEach.call(tabs.children, function (t) { t.classList.remove("on"); });
        Array.prototype.forEach.call(panels.children, function (p) { p.classList.remove("on"); });
        tab.classList.add("on"); panel.classList.add("on");
        window.scrollTo(0, 0);
      });
    });
  }

  /* ============================ Saving =================================== */
  /* Must stay character for character identical to CONTENT_HEADER in
     server.js, or the header of data/content.js flips back and forth
     depending on whether it was written here or there. */
  var CONTENT_HEADER =
    "/* Content of the website — the single source of truth.\n" +
    "   Written by the admin area (admin.html), never by hand.\n" +
    "   Deliberately a .js file: that way the site can also be opened by simply\n" +
    "   double-clicking it, where fetch() would be blocked by CORS. */\n";

  function fileText() {
    return CONTENT_HEADER + "window.SITE_CONTENT = " + JSON.stringify(data, null, 2) + ";\n";
  }

  function download() {
    var blob = new Blob([fileText()], { type: "text/javascript" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content.js";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast("Datei heruntergeladen — als data/content.js auf den Webspace laden.");
  }

  function save() {
    if (mode !== "server") { download(); return; }
    $("btnSave").disabled = true;
    API.post("api/content", data)
      .then(function () {
        markClean();
        toast("Gespeichert. Die Website zeigt die Änderungen sofort.");
      })
      .catch(function (err) {
        /* Session expired — reloading leads back to the login form. */
        if (err.status === 401) { location.reload(); return; }
        toast(err.message + " Notfalls die Datei herunterladen.", true);
      })
      .then(function () { $("btnSave").disabled = false; });
  }

  /* Fetch the saved state and then carry on. If loading fails, the state from
     data/content.js stays in place — the interface should open even then.
     Used by boot() and by the login. */
  function loadContentThen(done) {
    API.get("api/content")
      .then(function (c) { if (c) data = c; })
      .catch(function () {})
      .then(done);
  }

  /* ============================ Login =================================== */
  function showApp(user) {
    $("login").hidden = true;
    $("app").hidden = false;
    $("who").textContent = user
      ? user + " · " + (mode === "server" ? "\u00c4nderungen werden gespeichert" : "ohne Server — Datei herunterladen")
      : "";
    $("btnSave").textContent = mode === "server" ? "Speichern" : "Datei herunterladen";
    $("btnDownload").hidden = mode !== "server";
    buildUI();
    markClean();
  }

  function boot() {
    /* Two callbacks instead of .catch(): that way the offline branch really
       only catches the session request and not errors from withServer(). */
    API.get("api/session").then(withServer, withoutServer);

    function withServer(s) {
      mode = "server";
      $("loginNote").textContent =
        "Zugang bekommt man von Karin oder Emma. Nach dem Speichern ist die \u00c4nderung sofort online.";
      /* Already logged in on the server side — straight on. */
      if (s && s.user) loadContentThen(function () { showApp(s.user); });
    }

    function withoutServer() {
      /* A plain web space has no /api — not an error, but operation without a
         server. */
      mode = "offline";
      $("loginNote").textContent =
        "Kein Server erkannt. Die Anmeldung ist hier nur ein Schutz gegen Verklicken; " +
        "gespeichert wird, indem die Datei heruntergeladen und als data/content.js hochgeladen wird.";
    }
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var user = $("u").value.trim(), pass = $("p").value;
    $("loginErr").textContent = "";

    if (mode !== "server") {
      if (pass.length < 4) { $("loginErr").textContent = "Passwort eingeben."; return; }
      showApp(user || "offline");
      return;
    }
    API.post("api/login", { user: user, pass: pass })
      .then(function (res) {
        loadContentThen(function () { showApp(res.user); });
      })
      .catch(function (err) {
        /* Covers both: a rejected login (message comes from the server) and no
           connection at all. */
        $("loginErr").textContent = err.message;
      });
  });

  $("btnSave").addEventListener("click", save);
  $("btnDownload").addEventListener("click", download);
  $("btnLogout").addEventListener("click", function () {
    if (dirty && !confirm("Es gibt ungespeicherte \u00c4nderungen. Trotzdem abmelden?")) return;
    if (mode !== "server") { location.reload(); return; }
    /* Reload even if logging out fails: the session in the browser is gone
       either way. */
    API.post("api/logout").then(reload, reload);
    function reload() { location.reload(); }
  });

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ============================ Enquiries =============================== */
  /* Every enquiry used to land in a file with nobody being told. This panel is
     the place where they can actually be read; the counter in the navigation
     makes it visible that something is waiting.

     Records written before the fields were renamed carry the German keys, and
     an enquiry is never rewritten once it arrived, so both spellings are read
     here. */
  function inquiryValue(entry, name) {
    var older = { company: "firma", phone: "telefon", message: "nachricht", subject: "betreff", received: "eingang" };
    if (entry[name] != null && entry[name] !== "") return entry[name];
    var fallback = older[name];
    return fallback && entry[fallback] != null ? entry[fallback] : "";
  }

  function formatMoment(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || "");
    return d.toLocaleString("de-CH", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function inquiriesPanel(panel, tab) {
    if (mode !== "server") {
      var offline = document.createElement("div");
      offline.className = "listempty";
      offline.textContent = "Anfragen gibt es nur mit laufendem Server.";
      panel.appendChild(offline);
      return;
    }

    var actions = document.createElement("div");
    actions.className = "inq-actions";
    var markRead = document.createElement("button");
    markRead.className = "abtn abtn-l";
    markRead.textContent = "Alle als gelesen markieren";
    markRead.disabled = true;
    actions.appendChild(markRead);
    panel.appendChild(actions);

    var box = document.createElement("div");
    panel.appendChild(box);

    var badge = document.createElement("span");
    badge.className = "badge";
    badge.hidden = true;
    tab.appendChild(badge);

    load();

    function load() {
      box.textContent = "Wird geladen …";
      API.get("api/inquiries").then(function (res) {
        render(res.items || []);
        setBadge(res.unread || 0);
      }, function (err) {
        box.textContent = err.message;
      });
    }

    function setBadge(n) {
      badge.hidden = n === 0;
      badge.textContent = String(n);
      markRead.disabled = n === 0;
    }

    markRead.addEventListener("click", function () {
      var ids = currentIds;
      markRead.disabled = true;
      API.post("api/inquiries/read", { ids: ids }).then(load, function (err) {
        toast(err.message, true);
        markRead.disabled = false;
      });
    });

    var currentIds = [];

    function render(items) {
      currentIds = items.map(function (e) { return e.id; });
      box.textContent = "";
      if (!items.length) {
        var empty = document.createElement("div");
        empty.className = "listempty";
        empty.textContent = "Noch keine Anfrage eingegangen.";
        box.appendChild(empty);
        return;
      }
      items.forEach(function (entry) {
        box.appendChild(inquiryCard(entry));
      });
    }

    function inquiryCard(entry) {
      var card = document.createElement("div");
      card.className = "card inq" + (entry.seen ? "" : " unseen");

      var head = document.createElement("div");
      head.className = "card-head";
      var who = document.createElement("b");
      who.textContent = entry.name || inquiryValue(entry, "company") || entry.email;
      var when = document.createElement("span");
      when.className = "ord";
      when.textContent = formatMoment(inquiryValue(entry, "received"));
      head.appendChild(who); head.appendChild(when);
      card.appendChild(head);

      var subject = inquiryValue(entry, "subject");
      if (subject) card.appendChild(line("Betreff", subject));

      var company = inquiryValue(entry, "company");
      if (company) card.appendChild(line("Firma", company));

      /* The address as a mailto link, so answering is one click and not a
         copy-and-paste exercise. */
      var mailRow = document.createElement("div");
      mailRow.className = "inq-line";
      mailRow.appendChild(tagOf("E-Mail"));
      var link = document.createElement("a");
      /* The subject stays German although the rest of this area is English:
         this mail is read by the person who sent the enquiry, not by us. */
      link.href = "mailto:" + entry.email +
        "?subject=" + encodeURIComponent("Re: " + (subject || "Ihre Anfrage"));
      link.textContent = entry.email;
      mailRow.appendChild(link);
      card.appendChild(mailRow);

      var phone = inquiryValue(entry, "phone");
      if (phone) card.appendChild(line("Telefon", phone));

      var message = inquiryValue(entry, "message");
      if (message) {
        var msg = document.createElement("p");
        msg.className = "inq-msg";
        msg.textContent = message;
        card.appendChild(msg);
      }
      return card;
    }

    function line(name, value) {
      var row = document.createElement("div");
      row.className = "inq-line";
      row.appendChild(tagOf(name));
      var v = document.createElement("span");
      v.textContent = value;
      row.appendChild(v);
      return row;
    }
    function tagOf(name) {
      var t = document.createElement("i");
      t.textContent = name;
      return t;
    }
  }

  /* ============================ Image field ============================= */
  /* Filled in by js/upload.js in the next step. Until then an image field is
     a plain path input, so the catalogue above is already the final one. */
  function imageField(spec, get, set) {
    if (window.ImageField) return window.ImageField.create(spec, get, set, markDirty);

    var wrap = document.createElement("div");
    wrap.className = "fld";
    var lab = document.createElement("label");
    lab.textContent = spec.label;
    wrap.appendChild(lab);
    var input = document.createElement("input");
    input.type = "text";
    var v = get();
    input.value = !v ? "" : (typeof v === "string" ? v : (v.src || ""));
    input.addEventListener("input", function () {
      set(input.value ? { src: input.value } : null);
      markDirty();
    });
    wrap.appendChild(input);
    var s = document.createElement("div");
    s.className = "sub"; s.textContent = "z. B. img/front-pass.jpg";
    wrap.appendChild(s);
    return wrap;
  }

  boot();
})();
