/* Filter chips on the season and gallery pages.

   Each chip carries its code in data-filter, and each filterable element the
   matching code in data-tag; data-filter="all" clears the filter. Previously
   the chip's visible German text was compared against the tag, so renaming a
   label — or translating one — silently stopped the filter from matching. */
(function () {
  "use strict";

  function chipsOf(chip) { return chip.parentNode.querySelectorAll(".chip"); }

  function apply(code) {
    var all = code === "all";
    /* Gallery cells and result rows both carry data-tag. */
    var targets = document.querySelectorAll("[data-gallery] .cell[data-tag], [data-events-table] tbody tr[data-tag]");
    Array.prototype.forEach.call(targets, function (node) {
      node.style.display = (all || node.getAttribute("data-tag") === code) ? "" : "none";
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      Array.prototype.forEach.call(chipsOf(chip), function (other) { other.classList.remove("on"); });
      chip.classList.add("on");
      apply(chip.getAttribute("data-filter") || "all");
    });
  });
})();
