/* Admin-Bereich: bearbeitet data/content.js ohne Code anzufassen.
   Zwei Betriebsarten:
     server  — server.js laeuft, Anmeldung und Speichern laufen ueber /api/*
     offline — Seite direkt geoeffnet: Anmeldung lokal, Speichern = Datei herunterladen */
(function () {
  "use strict";

  /* ============================ Feldkatalog ============================== */
  /* Neue Felder hier ergaenzen — das Formular baut sich daraus selbst auf.  */
  var SCHEMA = [
    { id: "site", title: "Allgemein", hint: "Erscheint in der Navigation und im Fuss jeder Seite.", key: "site", fields: [
      { k: "name",        label: "Name in der Navigation" },
      { k: "tag",         label: "Kürzel neben dem Namen" },
      { k: "footerBrand", label: "Name im Seitenfuss" },
      { k: "footerText",  label: "Text im Seitenfuss", type: "area" }
    ]},

    { id: "index", title: "Startseite", hint: "Titel, Einstiegstext und die Leiste „Nächster Start“. Leer lassen heisst: noch nicht festgelegt.", key: "index", fields: [
      { k: "heroTitle", label: "Titel" },
      { k: "heroSub",   label: "Untertitel" },
      { k: "heroText",  label: "Einstiegstext", type: "area" },
      { k: "heroBtn1",  label: "Knopf 1", half: true },
      { k: "heroBtn2",  label: "Knopf 2", half: true },
      { k: "nextEvent",      label: "Nächster Start — Veranstaltung", half: true, sub: "— bedeutet: noch offen" },
      { k: "nextDate",       label: "Nächster Start — Datum", half: true },
      { k: "nextDiscipline", label: "Nächster Start — Disziplin", half: true },
      { k: "nextSeries",     label: "Nächster Start — Serie", half: true },
      { k: "nextStanding",   label: "Nächster Start — Zwischenstand" },
      { k: "lastTitle", label: "Letzter Einsatz — Titel" },
      { k: "lastText",  label: "Letzter Einsatz — Text", type: "area" },
      { k: "partnersTitle", label: "Partner-Abschnitt — Titel" },
      { k: "partnersLede",  label: "Partner-Abschnitt — Text", type: "area" }
    ]},

    { id: "car", title: "Datenblatt", hint: "Die technischen Werte. Gewicht und Disziplinen erscheinen auch auf der Startseite.", key: "car", fields: [
      { k: "motor",       label: "Motor (Startseite)", half: true },
      { k: "antrieb",     label: "Antrieb", half: true },
      { k: "gewicht",     label: "Gewicht (Startseite)", half: true },
      { k: "disziplinen", label: "Disziplinen", half: true },
      { k: "fahrgestell", label: "Fahrgestell", half: true },
      { k: "motorLang",   label: "Motor (Datenblatt)", half: true },
      { k: "leistung",    label: "Leistung", half: true },
      { k: "getriebe",    label: "Getriebe", half: true },
      { k: "gewichtLang", label: "Gewicht (Datenblatt)", half: true },
      { k: "raeder",      label: "Räder", half: true },
      { k: "sicherheit",  label: "Sicherheit", half: true },
      { k: "lack",        label: "Lack", half: true }
    ]},

    { id: "auto", title: "Seite „Das Auto“", key: "auto", fields: [
      { k: "title",       label: "Titel" },
      { k: "lede",        label: "Einstiegstext", type: "area" },
      { k: "setupsTitle", label: "Titel des Abschnitts mit den zwei Kacheln" },
      { k: "rallyeTitle", label: "Kachel Rallye — Titel" },
      { k: "rallyeText",  label: "Kachel Rallye — Text", type: "area" },
      { k: "bergTitle",   label: "Kachel Bergrennen — Titel" },
      { k: "bergText",    label: "Kachel Bergrennen — Text", type: "area" }
    ]},

    { id: "saison", title: "Saison", hint: "Solange keine Resultate erfasst sind, zeigt die Seite einen Hinweis statt einer Tabelle.", key: "saison", fields: [
      { k: "lede",        label: "Einstiegstext", type: "area" },
      { k: "statStarts",  label: "Kennzahl Starts", half: true },
      { k: "statPodeste", label: "Kennzahl Klassenpodeste", half: true },
      { k: "statSiege",   label: "Kennzahl Klassensiege", half: true },
      { k: "wegLede",     label: "Werdegang — Einstiegstext", type: "area" }
    ]},

    { id: "events", title: "Resultate", hint: "Ein Eintrag pro Veranstaltung. Sobald der erste erfasst ist, erscheint auf der Saison-Seite die Tabelle.", list: "events",
      label: function (o) { return (o.datum || "") + " " + (o.name || "Neue Veranstaltung"); },
      item: [
        { k: "datum",    label: "Datum", half: true, sub: "z. B. 07.06." },
        { k: "name",     label: "Veranstaltung", half: true },
        { k: "disziplin", label: "Disziplin", type: "select", options: ["Bergrennen", "Rallye"], half: true },
        { k: "klasse",   label: "Rang Klasse", half: true, sub: "z. B. 1." },
        { k: "gesamt",   label: "Rang gesamt", half: true },
        { k: "bestzeit", label: "Bestzeit", half: true }
      ]},

    { id: "timeline", title: "Werdegang", hint: "Erscheint auf der Saison-Seite, neuestes Jahr zuoberst.", list: "timeline",
      label: function (o) { return (o.year || "") + " — " + (o.title || "Neuer Eintrag"); },
      item: [
        { k: "year",  label: "Jahr", half: true },
        { k: "title", label: "Titel", half: true },
        { k: "text",  label: "Text", type: "area" }
      ]},

    { id: "partner", title: "Seite „Partner“", key: "partner", fields: [
      { k: "heroTitle", label: "Titel" },
      { k: "heroText",  label: "Einstiegstext", type: "area" },
      { k: "kpiRenntage",    label: "Renntage pro Saison", half: true, sub: "— bedeutet: noch offen" },
      { k: "kpiDisziplinen", label: "Disziplinen", half: true },
      { k: "kpiInstagram",   label: "Instagram", half: true },
      { k: "kpiReels",       label: "Ø Reel-Aufrufe", half: true },
      { k: "kpiPresse",      label: "Pressebeiträge", half: true },
      { k: "pkgTitle",    label: "Pakete — Titel" },
      { k: "pkgLede",     label: "Pakete — Einstiegstext", type: "area" },
      { k: "pkgNote",     label: "Pakete — Hinweis darunter", type: "area" },
      { k: "currentLede", label: "Aktuelle Partner — Text", type: "area" }
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

    { id: "partners", title: "Partner-Logos", hint: "„Fläche noch frei“ zeichnet das Feld gold statt grau.", list: "partners",
      label: function (o) { return o.name || "Neuer Partner"; },
      item: [
        { k: "name", label: "Name", half: true },
        { k: "logo", label: "Bildpfad (optional)", half: true, sub: "z. B. img/logo-meier.png" },
        { k: "free", label: "Fläche noch frei", type: "check" }
      ]},

    { id: "spots", title: "Freie Flächen", hint: "Steht „vergeben“ im Feld, wird die Fläche auf der Grafik grau statt gold.", key: "spots", fields: [
      { k: "lede", label: "Einstiegstext", type: "area" },
      { k: "s1", label: "1 · Vorderer Kotflügel", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "s2", label: "2 · Vordertür", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "s3", label: "3 · Seitenteil hinten", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "s4", label: "4 · Schweller", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "s5", label: "5 · Seitenscheibe hinten", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "t1", label: "6 · Motorhaube", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "t2", label: "7 · Dach", type: "select", options: ["frei", "vergeben"], half: true },
      { k: "t3", label: "8 · Kofferraumdeckel", type: "select", options: ["frei", "vergeben"], half: true }
    ]},

    { id: "gallery", title: "Galerie", hint: "Bild zuerst in den Ordner img/ legen, dann hier den Pfad eintragen.", list: "gallery",
      label: function (o) { return o.cap || o.src || "Neues Bild"; },
      item: [
        { k: "src",  label: "Bildpfad", half: true, sub: "z. B. img/front-pass.jpg" },
        { k: "tag",  label: "Kategorie", half: true, sub: "Rallye, Bergrennen, Aufbau, Das Auto" },
        { k: "alt",  label: "Bildbeschreibung (für Screenreader)" },
        { k: "cap",  label: "Bildunterschrift" },
        { k: "tief", label: "Auto sitzt tief im Bild (anderer Beschnitt)", type: "check" }
      ]},

    { id: "journalTexts", title: "Seite „Journal“", key: "journal", fields: [
      { k: "lede", label: "Einstiegstext", type: "area" }
    ]},

    { id: "posts", title: "Journal-Einträge", hint: "Solange kein Eintrag erfasst ist, zeigt die Seite einen Hinweis.", list: "posts",
      label: function (o) { return o.titel || "Neuer Eintrag"; },
      item: [
        { k: "datum",     label: "Datum", half: true, sub: "z. B. 9. Juni 2027" },
        { k: "disziplin", label: "Disziplin", type: "select", options: ["", "Bergrennen", "Rallye"], half: true },
        { k: "titel",     label: "Titel" },
        { k: "text",      label: "Text", type: "area", rows: 8 }
      ]},

    { id: "galerieTexts", title: "Galerie-Text", key: "galerie", fields: [
      { k: "lede", label: "Einstiegstext", type: "area" }
    ]},

    { id: "kontakt", title: "Kontakt", key: "kontakt", fields: [
      { k: "lede",      label: "Einstiegstext", type: "area" },
      { k: "asideText", label: "Ansprechperson — Text", type: "area" },
      { k: "mail",      label: "E-Mail", half: true },
      { k: "tel",       label: "Telefon", half: true },
      { k: "ort",       label: "Ort" },
      { k: "pdfText",   label: "Text zum Unterlagen-Download", type: "area" }
    ]}
  ];

  /* ============================ Zustand ================================== */
  var data = JSON.parse(JSON.stringify(window.SITE_CONTENT || {}));
  var dirty = false;
  var mode = "offline";           /* "server" sobald /api/session antwortet */
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

  /* ============================ Formularbau ============================== */
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

    wrap.className = "fld";
    var lab = document.createElement("label");
    lab.htmlFor = id; lab.textContent = spec.label;
    wrap.appendChild(lab);

    var input;
    if (spec.type === "select") {
      input = document.createElement("select");
      spec.options.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o; op.textContent = o === "" ? "— keine —" : o;
        input.appendChild(op);
      });
      input.value = get() || spec.options[0];
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

  /* Legt Felder mit half:true paarweise nebeneinander. */
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
        blank[f.k] = f.type === "check" ? false : (f.type === "lines" ? [] : "");
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
          if (!confirm("Eintrag „" + group.label(obj) + "“ wirklich löschen?")) return;
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

      if (group.list) {
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

  /* ============================ Speichern ================================ */
  function fileText() {
    return "/* Inhalt der Website — einzige Quelle der Wahrheit.\n" +
           "   Wird vom Admin-Bereich (admin.html) geschrieben, nicht von Hand.\n" +
           "   Bewusst eine .js-Datei: so laesst sich die Seite auch ohne Server\n" +
           "   direkt per Doppelklick oeffnen (fetch() waere hier durch CORS blockiert). */\n" +
           "window.SITE_CONTENT = " + JSON.stringify(data, null, 2) + ";\n";
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
    fetch("api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data)
    }).then(function (r) {
      if (r.status === 401) { location.reload(); return null; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (res) {
      if (!res) return;
      markClean();
      toast("Gespeichert. Die Website zeigt die Änderungen sofort.");
    }).catch(function () {
      toast("Speichern fehlgeschlagen — bitte Datei herunterladen.", true);
    }).then(function () {
      $("btnSave").disabled = false;
    });
  }

  /* ============================ Anmeldung ================================ */
  function showApp(user) {
    $("login").hidden = true;
    $("app").hidden = false;
    $("who").textContent = user
      ? user + " · " + (mode === "server" ? "Änderungen werden gespeichert" : "ohne Server — Datei herunterladen")
      : "";
    $("btnSave").textContent = mode === "server" ? "Speichern" : "Datei herunterladen";
    $("btnDownload").hidden = mode !== "server";
    buildUI();
    markClean();
  }

  function boot() {
    fetch("api/session", { credentials: "same-origin" })
      .then(function (r) {
        /* Ein statischer Webspace antwortet hier mit 404 — das ist kein Server-Betrieb. */
        if (!r.ok) throw new Error("kein Server");
        return r.json();
      })
      .then(function (s) {
        mode = "server";
        $("loginNote").textContent =
          "Zugang bekommt man von Karin oder Emma. Nach dem Speichern ist die Änderung sofort online.";
        if (s && s.user) {
          // Serverseitig bereits angemeldet — direkt weiter, gespeicherten Stand laden.
          fetch("api/content", { credentials: "same-origin" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (c) { if (c) data = c; showApp(s.user); });
        }
      })
      .catch(function () {
        mode = "offline";
        $("loginNote").textContent =
          "Kein Server erkannt. Die Anmeldung ist hier nur ein Schutz gegen Verklicken; " +
          "gespeichert wird, indem die Datei heruntergeladen und als data/content.js hochgeladen wird.";
      });
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
    fetch("api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ user: user, pass: pass })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { $("loginErr").textContent = res.j.error || "Anmeldung fehlgeschlagen."; return; }
        return fetch("api/content", { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (c) { if (c) data = c; showApp(res.j.user); });
      })
      .catch(function () { $("loginErr").textContent = "Server nicht erreichbar."; });
  });

  $("btnSave").addEventListener("click", save);
  $("btnDownload").addEventListener("click", download);
  $("btnLogout").addEventListener("click", function () {
    if (dirty && !confirm("Es gibt ungespeicherte Änderungen. Trotzdem abmelden?")) return;
    if (mode === "server") {
      fetch("api/logout", { method: "POST", credentials: "same-origin" })
        .then(function () { location.reload(); });
    } else { location.reload(); }
  });

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  boot();
})();
