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

  /* A browser submits a form as soon as Enter is pressed in a single-line
     field. On this form that is a trap: one keystroke while filling in the
     name sends a half-written enquiry and clears everything.

     So Enter is blocked in the input fields — but deliberately not on the
     button itself, and not in the message box, where it makes a new line.
     Submitting from the keyboard therefore still works: tab to the button and
     press Enter. Taking that away too would lock out anyone who fills in forms
     without a mouse. */
  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toUpperCase();
    if (tag === "TEXTAREA") return;                       /* newline */
    if (tag === "BUTTON" || el.type === "submit") return; /* meant it */
    e.preventDefault();
  });

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

  /* The server's own message is preferred where there is one, because it says
     what is actually wrong with this enquiry. err.message from js/api.js is the
     fallback for the cases the server never got to answer at all. */
  function visitorText(err) {
    if (err.data && err.data.error) return err.data.error;
    if (err.offline) return "Der Server ist nicht erreichbar.";
    return "Die Anfrage konnte nicht gesendet werden.";
  }
})();
