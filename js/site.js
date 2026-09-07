/* Filter-Chips auf Saison und Galerie.
   Der Text des Chips ist der Filter; „Alle …“ hebt den Filter auf. */
(function () {
  function siblings(group) { return group.parentNode.querySelectorAll(".chip"); }

  function apply(group, label) {
    var all = /^alle/i.test(label);

    /* Galerie: Kacheln tragen data-tag */
    var cells = document.querySelectorAll("[data-gallery] .cell");
    if (cells.length) {
      Array.prototype.forEach.call(cells, function (c) {
        c.style.display = (all || c.getAttribute("data-tag") === label) ? "" : "none";
      });
    }

    /* Saison: Zeilen tragen die Disziplin als Badge */
    var rows = document.querySelectorAll("[data-events-table] tbody tr");
    if (rows.length) {
      Array.prototype.forEach.call(rows, function (r) {
        var badge = r.querySelector(".disz");
        var name = badge ? badge.textContent.trim() : "";
        r.style.display = (all || name === label) ? "" : "none";
      });
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (c) {
    c.addEventListener("click", function () {
      Array.prototype.forEach.call(siblings(c), function (x) { x.classList.remove("on"); });
      c.classList.add("on");
      apply(c.parentNode, c.textContent.trim());
    });
  });
})();
