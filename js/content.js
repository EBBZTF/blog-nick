/* Rendert data/content.js in die Seiten.
   Textfelder:  <b data-cms="car.getriebe">Fallback</b>
   Listen:      <div data-partners></div>, [data-packages], [data-timeline],
                [data-gallery], [data-journal], [data-events-table]
   Steht kein Inhalt bereit, bleibt der im HTML hinterlegte Fallback stehen. */
(function () {
  var C = window.SITE_CONTENT;
  if (!C) return;

  function get(path) {
    return path.split(".").reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, C);
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  /* ---- einfache Textfelder ---- */
  each("[data-cms]", function (node) {
    var v = get(node.getAttribute("data-cms"));
    if (typeof v === "string" && v.length) node.textContent = v;
  });

  /* ---- Partnerlogos ---- */
  each("[data-partners]", function (box) {
    var list = C.partners || [];
    if (!list.length) return;
    box.textContent = "";
    list.forEach(function (p) {
      var d = el("div", "logo");
      if (p.free) {
        d.style.borderStyle = "solid";
        d.style.borderColor = "var(--bbs)";
        d.style.color = "#8A6E24";
      }
      if (p.logo) {
        var img = el("img");
        img.src = p.logo; img.alt = p.name || ""; img.style.maxWidth = "100%";
        d.appendChild(img);
      } else {
        d.textContent = p.name || "Partnerlogo";
      }
      box.appendChild(d);
    });
  });

  /* ---- Sponsoring-Pakete ---- */
  each("[data-packages]", function (box) {
    var list = C.packages || [];
    if (!list.length) return;
    box.textContent = "";
    list.forEach(function (p) {
      var card = el("div", "pkg" + (p.lead ? " lead" : ""));
      if (p.kind) card.appendChild(el("span", "kind", p.kind));
      card.appendChild(el("h3", null, p.title || ""));
      card.appendChild(el("div", "price", p.price || ""));
      var ul = el("ul");
      (p.items || []).forEach(function (i) { ul.appendChild(el("li", null, i)); });
      card.appendChild(ul);
      var a = el("a", "btn " + (p.lead ? "btn-g" : "btn-l"), "Anfragen");
      a.href = "kontakt.html";
      card.appendChild(a);
      box.appendChild(card);
    });
  });

  /* ---- Werdegang ---- */
  each("[data-timeline]", function (box) {
    var list = C.timeline || [];
    if (!list.length) return;
    box.textContent = "";
    list.forEach(function (t) {
      var li = el("li");
      var mk = el("span", "mk");
      mk.style.background = "var(--anthracite)";
      mk.style.borderColor = "var(--bbs)";
      var yr = el("span", "yr", t.year || "");
      yr.style.color = "#98A0A4";
      var p = el("p", null, t.text || "");
      p.style.color = "#A9B0B4";
      li.appendChild(mk); li.appendChild(yr);
      li.appendChild(el("b", null, t.title || "")); li.appendChild(p);
      box.appendChild(li);
    });
  });

  /* ---- Galerie ---- */
  each("[data-gallery]", function (box) {
    var list = C.gallery || [];
    if (!list.length) return;
    box.textContent = "";
    list.forEach(function (g) {
      var cell = el("div", "cell");
      var img = el("img");
      img.src = g.src; img.alt = g.alt || ""; img.loading = "lazy";
      if (g.tief) img.className = "tief";
      cell.appendChild(img);
      cell.appendChild(el("div", "cap", g.cap || ""));
      if (g.tag) cell.setAttribute("data-tag", g.tag);
      box.appendChild(cell);
    });
  });

  /* ---- Journal ---- */
  each("[data-journal]", function (box) {
    var list = C.posts || [];
    var empty = document.querySelector("[data-journal-empty]");
    if (!list.length) return;
    if (empty) empty.style.display = "none";
    box.textContent = "";
    list.forEach(function (p) {
      var art = el("article", "post");
      if (p.disziplin) {
        art.appendChild(el("span", "disz " + (p.disziplin.toLowerCase().indexOf("rall") === 0 ? "rallye" : "berg"), p.disziplin));
      }
      art.appendChild(el("h3", null, p.titel || ""));
      art.appendChild(el("div", "dateline", p.datum || ""));
      art.appendChild(el("p", null, p.text || ""));
      box.appendChild(art);
    });
  });

  /* ---- Resultattabelle (leer, solange keine Saison gefahren ist) ---- */
  each("[data-events-table]", function (table) {
    var list = C.events || [];
    var empty = document.querySelector("[data-events-empty]");
    if (!list.length) { table.style.display = "none"; return; }
    if (empty) empty.style.display = "none";
    table.style.display = "";
    var tb = table.querySelector("tbody");
    tb.textContent = "";
    list.forEach(function (e) {
      var tr = el("tr");
      function td(txt, cls) { var c = el("td", cls, txt); tr.appendChild(c); return c; }
      td(e.datum || "", "n");
      td(e.name || "");
      var d = td("");
      d.appendChild(el("span", "disz " + (String(e.disziplin).toLowerCase().indexOf("rall") === 0 ? "rallye" : "berg"), e.disziplin || ""));
      td(e.klasse || "—", "n" + (e.klasse === "1." ? " win" : ""));
      td(e.gesamt || "—", "n");
      td(e.bestzeit || "—", "n");
      tb.appendChild(tr);
    });
  });

  /* ---- Sponsorenflaechen: vergebene Flaechen ausgrauen ---- */
  each(".spotlist li", function (li, i) {
    var tag = li.querySelector("[data-cms]");
    if (!tag) return;
    var taken = /vergeben/i.test(tag.textContent);
    li.classList.toggle("taken", taken);
    var key = tag.getAttribute("data-cms").split(".")[1];
    var g = document.querySelector('[data-spot="' + key + '"]');
    if (g) g.classList.toggle("taken", taken);
  });
})();
