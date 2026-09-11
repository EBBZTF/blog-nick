/* Renders data/content.js into the pages.
   Text fields:  <b data-cms="car.gearbox">Fallback</b>
   Images:       <img data-cms-img="index.heroImage" src="img/…" alt="…">
   Lists:        <div data-partners></div>, [data-packages], [data-timeline],
                 [data-gallery], [data-journal], [data-events-table]
   If no content is available the fallback left in the HTML stays in place. */
(function () {
  var C = window.SITE_CONTENT;
  if (!C) return;

  var L = window.LABELS;

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

  /* An image field is an object {src, thumb, w, h, alt}. Older content stored
     just the path as a string, and the gallery still contains entries of that
     shape — both have to keep working, so everything goes through here. */
  function image(v) {
    if (!v) return null;
    if (typeof v === "string") return { src: v };
    return typeof v.src === "string" && v.src ? v : null;
  }
  /* Setting width and height reserves the space before the file has loaded, so
     the text below it does not jump once the image arrives.

     Where a separate thumbnail exists, both sizes are offered and the browser
     picks. That matters most in the gallery: nine cells at a third of the
     width each pulled the full-size file before, several megabytes for a page
     that only ever shows small crops. */
  function applyImage(node, pic, altFallback, sizes) {
    node.src = pic.src;
    node.alt = typeof pic.alt === "string" && pic.alt ? pic.alt : (altFallback || "");
    if (pic.w && pic.h) { node.width = pic.w; node.height = pic.h; }
    if (sizes && pic.thumb && pic.thumb !== pic.src && pic.w) {
      node.srcset = pic.thumb + " 480w, " + pic.src + " " + pic.w + "w";
      node.sizes = sizes;
    }
  }

  /* ---- plain text fields ---- */
  each("[data-cms]", function (node) {
    var v = get(node.getAttribute("data-cms"));
    if (typeof v === "string" && v.length) node.textContent = v;
  });

  /* ---- images that used to be hardcoded in the HTML ---- */
  each("[data-cms-img]", function (node) {
    var pic = image(get(node.getAttribute("data-cms-img")));
    if (pic) applyImage(node, pic, node.getAttribute("alt"));
  });

  /* ---- link targets ---- */
  /* Only the address is taken from the content, never the link text: a footer
     entry keeps reading "Instagram" even if the account moves. An empty value
     leaves the address written in the HTML in place, like everywhere else. */
  each("[data-cms-href]", function (node) {
    var v = get(node.getAttribute("data-cms-href"));
    if (typeof v === "string" && v.trim()) node.href = v.trim();
  });

  /* ---- longer text, split into paragraphs ---- */
  /* Like data-cms, except a blank line starts a new paragraph. For fields where
     someone writes more than a sentence — the about page, where the fallback in
     the HTML is one <p> and the saved value can be several. */
  each("[data-cms-para]", function (box) {
    var chunks = paragraphs(get(box.getAttribute("data-cms-para")));
    if (!chunks.length) return;            /* nothing saved: keep the fallback */
    box.textContent = "";
    chunks.forEach(function (chunk) { box.appendChild(el("p", null, chunk)); });
  });

  /* ---- partner logos ---- */
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
      var pic = image(p.logo);
      if (pic) {
        var img = el("img");
        /* A logo box is 56 px high — the thumbnail is always enough. */
        applyImage(img, { src: pic.thumb || pic.src, alt: pic.alt, w: pic.w, h: pic.h }, p.name || "");
        img.style.maxWidth = "100%";
        d.appendChild(img);
      } else {
        d.textContent = p.name || "Partnerlogo";
      }
      box.appendChild(d);
    });
  });

  /* ---- sponsoring packages ---- */
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

  /* ---- career ---- */
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

  /* ---- gallery ---- */
  /* data-tag carries the code, not the label: js/site.js filters on it, and a
     renamed label must not change what a chip matches. */
  each("[data-gallery]", function (box) {
    var list = C.gallery || [];
    if (!list.length) return;
    box.textContent = "";
    list.forEach(function (g) {
      var pic = image(g.src);
      if (!pic) return;
      var cell = el("div", "cell");
      var img = el("img");
      applyImage(img, pic, g.alt, "(max-width:760px) 100vw, 33vw");
      img.loading = "lazy";
      if (g.lowCrop) img.className = "low-crop";
      cell.appendChild(img);
      cell.appendChild(el("div", "cap", g.cap || ""));
      if (g.tag) cell.setAttribute("data-tag", g.tag);
      box.appendChild(cell);
    });
  });

  /* ---- journal ---- */
  each("[data-journal]", function (box) {
    var list = C.posts || [];
    var empty = document.querySelector("[data-journal-empty]");
    if (!list.length) return;
    if (empty) empty.style.display = "none";
    box.textContent = "";
    list.forEach(function (p) {
      var art = el("article", "post");

      var pic = image(p.image);
      if (pic) {
        var img = el("img");
        applyImage(img, pic, p.title || "", "(max-width:760px) 100vw, 700px");
        img.loading = "lazy";
        art.appendChild(img);
      }

      if (p.discipline) {
        art.appendChild(el("span", "discipline " + disciplineClass(p.discipline),
          L.of("discipline", p.discipline)));
      }
      art.appendChild(el("h3", null, p.title || ""));
      art.appendChild(el("div", "dateline", p.date || ""));

      /* A blank line starts a new paragraph. Text written as one block still
         works — the split simply yields a single piece. */
      paragraphs(p.text).forEach(function (chunk) {
        art.appendChild(el("p", null, chunk));
      });

      box.appendChild(art);
    });
  });

  function paragraphs(text) {
    if (typeof text !== "string" || !text.trim()) return [];
    return text.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* The badge colour follows the code, never the label. */
  function disciplineClass(code) {
    return code === "rally" ? "rally" : "hill";
  }

  /* ---- results table (empty until a season has been driven) ---- */
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
      /* Same attribute the gallery cells carry, so js/site.js can filter both
         with one rule instead of reading the badge text back out. */
      if (e.discipline) tr.setAttribute("data-tag", e.discipline);
      function td(txt, cls) { var c = el("td", cls, txt); tr.appendChild(c); return c; }
      td(e.date || "", "n");
      td(e.name || "");
      var d = td("");
      d.appendChild(el("span", "discipline " + disciplineClass(e.discipline),
        L.of("discipline", e.discipline)));
      td(e.classRank || "—", "n" + (e.classRank === "1." ? " win" : ""));
      td(e.overallRank || "—", "n");
      td(e.bestTime || "—", "n");
      tb.appendChild(tr);
    });
  });

  /* ---- sponsor areas: grey out what is taken ---- */
  /* The state is a boolean in the content. It used to be read back out of the
     rendered German text, which meant the label and the logic could not be
     changed independently. */
  each(".spot-list li", function (li) {
    var tag = li.querySelector("[data-cms]");
    if (!tag) return;
    var key = tag.getAttribute("data-cms").split(".")[1];
    var taken = !!(C.spots && C.spots[key]);

    tag.textContent = L.of("spot", taken ? "taken" : "free");
    li.classList.toggle("is-taken", taken);

    var g = document.querySelector('[data-spot="' + key + '"]');
    if (g) g.classList.toggle("is-taken", taken);
  });
})();
