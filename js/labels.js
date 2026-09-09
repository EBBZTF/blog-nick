/* German labels for the coded values in data/content.js.

   The content stores codes ("rally", "hillclimb", "build", "car"), not the
   words a visitor reads. Everything that has to make a decision — which badge
   colour a discipline gets, which gallery cells a filter chip shows — compares
   codes, and the label is only looked up at the moment of rendering.

   Before this split the code read German display text back out of the page:
   a discipline starting with "rall" was styled as a rally, and a sponsor area
   counted as taken if the rendered text matched /vergeben/. Renaming a label
   in the admin area silently changed styling and broke the filters. Now a
   label is only ever text, and a code is only ever a decision.

   Loaded by every page before js/content.js, and by admin.html before
   js/admin.js, so both sides show the same words. */
(function (global) {
  "use strict";

  global.LABELS = {
    /* Used for journal entries and results. The empty code means "not stated";
       the admin area offers it as "— none —". On the website an empty
       discipline renders no badge at all, so this label never appears there. */
    discipline: {
      "": "",
      rally: "Rallye",
      hillclimb: "Bergrennen"
    },

    /* Categories of the gallery, also the filter chips on galerie.html. */
    galleryTag: {
      rally: "Rallye",
      hillclimb: "Bergrennen",
      build: "Aufbau",
      car: "Das Auto"
    },

    /* Sponsor areas are a boolean in the content; these are the two words. */
    spot: {
      free: "frei",
      taken: "vergeben"
    },

    /* Looks up a label and falls back to the raw value, so content written
       before a code existed still shows something instead of nothing. */
    of: function (map, code) {
      var table = global.LABELS[map] || {};
      if (Object.prototype.hasOwnProperty.call(table, code)) return table[code];
      return code == null ? "" : String(code);
    },

    /* Options for a select field in the admin area, in display order. */
    options: function (map, codes) {
      var table = global.LABELS[map] || {};
      return codes.map(function (code) {
        return { value: code, label: table[code] === "" ? "— none —" : table[code] };
      });
    }
  };
})(window);
