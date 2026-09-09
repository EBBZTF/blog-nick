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
    { id: "site", title: "General", hint: "Appears in the navigation and in the footer of every page.", key: "site", fields: [
      { k: "name",        label: "Name in the navigation" },
      { k: "tag",         label: "Short tag next to the name" },
      { k: "footerBrand", label: "Name in the footer" },
      { k: "footerText",  label: "Footer text", type: "area" }
    ]},

    { id: "index", title: "Home page", hint: "Title, intro text and the \u201cnext start\u201d strip. Leaving a field empty means: not decided yet.", key: "index", fields: [
      { k: "heroTitle", label: "Title" },
      { k: "heroSub",   label: "Subtitle" },
      { k: "heroText",  label: "Intro text", type: "area" },
      { k: "heroImage", label: "Large image at the top", type: "image" },
      { k: "heroBtn1",  label: "Button 1", half: true },
      { k: "heroBtn2",  label: "Button 2", half: true },
      { k: "nextEvent",      label: "Next start — event", half: true, sub: "\u2014 means: still open" },
      { k: "nextDate",       label: "Next start — date", half: true },
      { k: "nextDiscipline", label: "Next start — discipline", half: true },
      { k: "nextSeries",     label: "Next start — series", half: true },
      { k: "nextStanding",   label: "Next start — standing" },
      { k: "lastTitle", label: "Last outing — title" },
      { k: "lastText",  label: "Last outing — text", type: "area" },
      { k: "partnersTitle", label: "Partner section — title" },
      { k: "partnersIntro", label: "Partner section — text", type: "area" }
    ]},

    /* The three long texts are plain textareas: a blank line becomes a new
       paragraph when the page is rendered (data-cms-para in js/content.js), so
       there is nothing to learn and no markup to get wrong. */
    { id: "about", title: "About me", hint: "The page ueber-mich.html — Nick writes here himself. A blank line in the long texts starts a new paragraph.", key: "about", fields: [
      { k: "title",     label: "Name / title" },
      { k: "sub",       label: "Line under the name" },
      { k: "intro",     label: "Short intro next to the photo", type: "area" },
      { k: "heroImage", label: "Photo", type: "image" },
      { k: "factBorn",        label: "Year of birth", half: true },
      { k: "factHome",        label: "Home", half: true },
      { k: "factDisciplines", label: "Disciplines", half: true },
      { k: "factLicence",     label: "Licence", half: true, sub: "— means: still open" },
      { k: "motivationTitle", label: "Section 1 — heading" },
      { k: "motivation",      label: "Section 1 — text", type: "area", rows: 8, sub: "Blank line = new paragraph" },
      { k: "startTitle",      label: "Section 2 — heading" },
      { k: "start",           label: "Section 2 — text", type: "area", rows: 8, sub: "Blank line = new paragraph" },
      { k: "goalsTitle",      label: "Section 3 — heading" },
      { k: "goals",           label: "Section 3 — text", type: "area", rows: 8, sub: "Blank line = new paragraph" },
      { k: "ctaTitle",   label: "Closing box — heading" },
      { k: "ctaText",    label: "Closing box — text", type: "area" },
      { k: "ctaBtn1",    label: "Closing box — button 1", half: true },
      { k: "ctaBtn2",    label: "Closing box — button 2", half: true }
    ]},

    { id: "car", title: "Spec sheet", hint: "The technical figures. Weight and disciplines also appear on the home page.", key: "car", fields: [
      { k: "engine",      label: "Engine (home page)", half: true },
      { k: "drivetrain",  label: "Drivetrain", half: true },
      { k: "weight",      label: "Weight (home page)", half: true },
      { k: "disciplines", label: "Disciplines", half: true },
      { k: "chassis",     label: "Chassis", half: true },
      { k: "engineLong",  label: "Engine (spec sheet)", half: true },
      { k: "power",       label: "Power", half: true },
      { k: "gearbox",     label: "Gearbox", half: true },
      { k: "weightLong",  label: "Weight (spec sheet)", half: true },
      { k: "wheels",      label: "Wheels", half: true },
      { k: "safety",      label: "Safety", half: true },
      { k: "paint",       label: "Paint", half: true }
    ]},

    { id: "carPage", title: "\u201cThe car\u201d page", key: "carPage", fields: [
      { k: "title",       label: "Title" },
      { k: "intro",       label: "Intro text", type: "area" },
      { k: "heroImage",   label: "Large image at the top", type: "image" },
      { k: "setupsTitle", label: "Title of the section with the two tiles" },
      { k: "rallyTitle",  label: "Rally tile — title" },
      { k: "rallyText",   label: "Rally tile — text", type: "area" },
      { k: "hillTitle",   label: "Hillclimb tile — title" },
      { k: "hillText",    label: "Hillclimb tile — text", type: "area" },
      { k: "image1",      label: "Image 1 of the three tiles", type: "image" },
      { k: "caption1",    label: "Caption 1" },
      { k: "image2",      label: "Image 2 of the three tiles", type: "image" },
      { k: "caption2",    label: "Caption 2" },
      { k: "image3",      label: "Image 3 of the three tiles", type: "image" },
      { k: "caption3",    label: "Caption 3" }
    ]},

    { id: "season", title: "Season", hint: "As long as no results are entered, the page shows a note instead of a table.", key: "season", fields: [
      { k: "intro",        label: "Intro text", type: "area" },
      { k: "statStarts",   label: "Figure: starts", half: true },
      { k: "statPodiums",  label: "Figure: class podiums", half: true },
      { k: "statWins",     label: "Figure: class wins", half: true },
      { k: "historyIntro", label: "Career — intro text", type: "area" }
    ]},

    { id: "events", title: "Results", hint: "One entry per event. As soon as the first one exists, the table appears on the season page.", list: "events",
      label: function (o) { return (o.date || "") + " " + (o.name || "New event"); },
      item: [
        { k: "date",        label: "Date", half: true, sub: "e.g. 07.06." },
        { k: "name",        label: "Event", half: true },
        { k: "discipline",  label: "Discipline", type: "select", options: DISCIPLINE_REQUIRED, half: true },
        { k: "classRank",   label: "Class position", half: true, sub: "e.g. 1." },
        { k: "overallRank", label: "Overall position", half: true },
        { k: "bestTime",    label: "Best time", half: true }
      ]},

    { id: "timeline", title: "Career", hint: "Appears on the season page, most recent year at the top.", list: "timeline",
      label: function (o) { return (o.year || "") + " — " + (o.title || "New entry"); },
      item: [
        { k: "year",  label: "Year", half: true },
        { k: "title", label: "Title", half: true },
        { k: "text",  label: "Text", type: "area" }
      ]},

    { id: "partner", title: "\u201cPartner\u201d page", key: "partner", fields: [
      { k: "heroTitle", label: "Title" },
      { k: "heroText",  label: "Intro text", type: "area" },
      { k: "heroImage", label: "Image at the top right", type: "image" },
      { k: "kpiRaceDays",    label: "Race days per season", half: true, sub: "\u2014 means: still open" },
      { k: "kpiDisciplines", label: "Disciplines", half: true },
      { k: "kpiInstagram",   label: "Instagram", half: true },
      { k: "kpiReels",       label: "Avg. reel views", half: true },
      { k: "kpiPress",       label: "Press mentions", half: true },
      { k: "pkgTitle",     label: "Packages — title" },
      { k: "pkgIntro",     label: "Packages — intro text", type: "area" },
      { k: "pkgNote",      label: "Packages — note below", type: "area" },
      { k: "currentIntro", label: "Current partners — text", type: "area" }
    ]},

    { id: "packages", title: "Sponsoring packages", hint: "Order here = order on the page. The highlighted package stands out visually.", list: "packages",
      label: function (o) { return o.title || "New package"; },
      item: [
        { k: "title", label: "Title", half: true },
        { k: "kind",  label: "Kind", half: true, sub: "e.g. goods or services" },
        { k: "price", label: "Price" },
        { k: "items", label: "What is included", type: "lines", sub: "One line per point" },
        { k: "lead",  label: "Show as highlighted", type: "check" }
      ]},

    { id: "partners", title: "Partner logos", hint: "\u201cSurface still free\u201d draws the box in gold instead of grey.", list: "partners",
      label: function (o) { return o.name || "New partner"; },
      item: [
        { k: "name", label: "Name" },
        { k: "logo", label: "Logo", type: "image" },
        { k: "free", label: "Surface still free", type: "check" }
      ]},

    { id: "spots", title: "Free surfaces", hint: "Ticked means: the surface is taken and is drawn grey instead of gold in the diagram.", key: "spots", fields: [
      { k: "intro", label: "Intro text", type: "area" },
      { k: "s1", label: "1 · Front wing is taken", type: "check" },
      { k: "s2", label: "2 · Front door is taken", type: "check" },
      { k: "s3", label: "3 · Rear quarter panel is taken", type: "check" },
      { k: "s4", label: "4 · Sill is taken", type: "check" },
      { k: "s5", label: "5 · Rear side window is taken", type: "check" },
      { k: "t1", label: "6 · Bonnet is taken", type: "check" },
      { k: "t2", label: "7 · Roof is taken", type: "check" },
      { k: "t3", label: "8 · Boot lid is taken", type: "check" }
    ]},

    /* No separate alt field here — the image field carries the description
       with the picture. The caption is something else and stays its own. */
    { id: "gallery", title: "Gallery", hint: "Pick an image, set a category — the category drives the filters on the gallery page.", list: "gallery",
      label: function (o) { return o.cap || "New image"; },
      item: [
        { k: "src",     label: "Image", type: "image" },
        { k: "cap",     label: "Caption" },
        { k: "tag",     label: "Category", type: "select", options: GALLERY_TAGS, half: true },
        { k: "lowCrop", label: "Car sits low in the frame (different crop)", type: "check", half: true }
      ]},

    { id: "journalTexts", title: "\u201cJournal\u201d page", key: "journal", fields: [
      { k: "intro", label: "Intro text", type: "area" }
    ]},

    { id: "posts", title: "Journal entries", hint: "As long as no entry exists, the page shows a note. A blank line in the text starts a new paragraph.", list: "posts",
      label: function (o) { return o.title || "New entry"; },
      item: [
        { k: "date",       label: "Date", half: true, sub: "e.g. 9. Juni 2027" },
        { k: "discipline", label: "Disziplin", type: "select", options: DISCIPLINE_OPTIONAL, half: true },
        { k: "title",      label: "Title" },
        { k: "image",      label: "Lead image", type: "image" },
        { k: "text",       label: "Text", type: "area", rows: 8, sub: "Blank line = new paragraph" }
      ]},

    { id: "galleryTexts", title: "Gallery text", key: "galleryPage", fields: [
      { k: "intro", label: "Intro text", type: "area" }
    ]},

    /* Read-only: enquiries are not content, they arrive from the form. Hence
       neither "key" nor "list" but its own panel. */
    { id: "inquiries", title: "Enquiries", custom: "inquiries",
      hint: "Enquiries received through the contact form. Most recent at the top." },

    { id: "contact", title: "Contact", key: "contact", fields: [
      { k: "intro",     label: "Intro text", type: "area" },
      { k: "asideText", label: "Contact person — text", type: "area" },
      { k: "mail",      label: "E-mail", half: true },
      { k: "phone",     label: "Phone", half: true },
      { k: "city",      label: "Town" },
      { k: "pdfText",   label: "Text for the document download", type: "area" }
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
        op.textContent = opt.label === "" ? "— none —" : opt.label;
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
    add.textContent = "+ Add entry";
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
        e.textContent = "No entry yet.";
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
        del.textContent = "Delete";
        del.addEventListener("click", function () {
          if (!confirm("Really delete the entry \u201c" + group.label(obj) + "\u201d?")) return;
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
    toast("File downloaded — upload it to the web space as data/content.js.");
  }

  function save() {
    if (mode !== "server") { download(); return; }
    $("btnSave").disabled = true;
    API.post("api/content", data)
      .then(function () {
        markClean();
        toast("Saved. The website shows the changes right away.");
      })
      .catch(function (err) {
        /* Session expired — reloading leads back to the login form. */
        if (err.status === 401) { location.reload(); return; }
        toast(err.message + " If needed, download the file instead.", true);
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
      ? user + " · " + (mode === "server" ? "changes are saved" : "no server — download the file")
      : "";
    $("btnSave").textContent = mode === "server" ? "Save" : "Download file";
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
        "Access is handed out by Karin or Emma. Once saved, the change is online immediately.";
      /* Already logged in on the server side — straight on. */
      if (s && s.user) loadContentThen(function () { showApp(s.user); });
    }

    function withoutServer() {
      /* A plain web space has no /api — not an error, but operation without a
         server. */
      mode = "offline";
      $("loginNote").textContent =
        "No server detected. The sign-in here only guards against a stray click; " +
        "saving means downloading the file and uploading it as data/content.js.";
    }
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var user = $("u").value.trim(), pass = $("p").value;
    $("loginErr").textContent = "";

    if (mode !== "server") {
      if (pass.length < 4) { $("loginErr").textContent = "Enter a password."; return; }
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
    if (dirty && !confirm("There are unsaved changes. Sign out anyway?")) return;
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
      offline.textContent = "Enquiries are only available with the server running.";
      panel.appendChild(offline);
      return;
    }

    var actions = document.createElement("div");
    actions.className = "inq-actions";
    var markRead = document.createElement("button");
    markRead.className = "abtn abtn-l";
    markRead.textContent = "Mark all as read";
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
      box.textContent = "Loading …";
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
        empty.textContent = "No enquiry received yet.";
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
      if (subject) card.appendChild(line("Subject", subject));

      var company = inquiryValue(entry, "company");
      if (company) card.appendChild(line("Company", company));

      /* The address as a mailto link, so answering is one click and not a
         copy-and-paste exercise. */
      var mailRow = document.createElement("div");
      mailRow.className = "inq-line";
      mailRow.appendChild(tagOf("E-mail"));
      var link = document.createElement("a");
      /* The subject stays German although the rest of this area is English:
         this mail is read by the person who sent the enquiry, not by us. */
      link.href = "mailto:" + entry.email +
        "?subject=" + encodeURIComponent("Re: " + (subject || "Ihre Anfrage"));
      link.textContent = entry.email;
      mailRow.appendChild(link);
      card.appendChild(mailRow);

      var phone = inquiryValue(entry, "phone");
      if (phone) card.appendChild(line("Phone", phone));

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
    s.className = "sub"; s.textContent = "e.g. img/front-pass.jpg";
    wrap.appendChild(s);
    return wrap;
  }

  boot();
})();
