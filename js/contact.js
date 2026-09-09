/* Contact form on kontakt.html.
   Sends the entries to POST /api/contact and reports the outcome in the status
   line below it. Needs js/api.js loaded first.

   Without server.js running there is no recipient — in that case the error
   message names the mail address, so nobody is left sitting in front of a red
   line with their enquiry quietly lost. */
(function () {
  "use strict";

  var FALLBACK_ADDRESS = "nick@berdi-racing.com";

  var form = document.getElementById("contactForm");
  if (!form || !window.API) return;

  var statusLine = document.getElementById("kf-status");
  var button = form.querySelector("button[type=submit]");

  /* ---- status line ---- */
  function report(text, kind) {
    statusLine.textContent = text;
    statusLine.className = "mono formstatus" + (kind ? " is-" + kind : "");
  }

  /* ---- block the button while sending ---- */
  /* Returns the function that restores the original state, so the caller
     cannot forget to apply it. */
  function lock(btn, text) {
    var before = btn.textContent;
    btn.disabled = true;
    btn.textContent = text;
    return function release() {
      btn.disabled = false;
      btn.textContent = before;
    };
  }

  /* ---- check before sending ---- */
  /* The form carries novalidate so the browser's own bubbles do not interfere.
     The rules themselves (required, type=email) still live in the HTML and are
     read from there — there is no second copy of the validation logic. */
  function firstInvalid() {
    if (form.checkValidity()) return null;
    return form.querySelector(":invalid");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var invalid = firstInvalid();
    if (invalid) {
      report(invalid.validationMessage || "Bitte die Angaben prüfen.", "error");
      invalid.focus();
      return;
    }

    var release = lock(button, "Wird gesendet …");
    report("");

    API.post("api/contact", API.formToObject(form))
      .then(function () {
        form.reset();
        report("Danke — die Anfrage ist angekommen. Antwort folgt innert zwei Tagen.", "ok");
      })
      .catch(function (err) {
        report(visitorText(err) + " Bitte direkt per Mail an " + FALLBACK_ADDRESS + ".", "error");
      })
      .then(release, release);
  });

  /* The messages in js/api.js are English, because they are written for the
     admin area. A visitor of this page reads German, so the sentence is put
     together here instead of passing err.message through: the server's own
     message where there is one — those are deliberately German for this
     endpoint — and otherwise one sentence per case. */
  function visitorText(err) {
    if (err.data && err.data.error) return err.data.error;
    if (err.offline) return "Der Server ist nicht erreichbar.";
    return "Die Anfrage konnte nicht gesendet werden.";
  }
})();
