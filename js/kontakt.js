/* Kontaktformular auf kontakt.html.
   Schickt die Eingaben an POST /api/kontakt und meldet das Ergebnis in
   der Statuszeile darunter. Braucht js/api.js davor.

   Ohne laufenden server.js gibt es keinen Empfänger — dann nennt die
   Fehlermeldung die Mailadresse, damit niemand vor einer roten Zeile
   sitzenbleibt und die Anfrage einfach verloren geht. */
(function () {
  "use strict";

  var ERSATZWEG = "nick@berdi-racing.com";

  var form = document.getElementById("kontaktForm");
  if (!form || !window.API) return;

  var statusZeile = document.getElementById("kf-status");
  var knopf = form.querySelector("button[type=submit]");

  /* ---- Statuszeile ---- */
  function melde(text, art) {
    statusZeile.textContent = text;
    statusZeile.className = "mono formstatus" + (art ? " is-" + art : "");
  }

  /* ---- Knopf während des Sendens sperren ---- */
  /* Gibt die Funktion zurück, die den Ursprungszustand wiederherstellt —
     so kann der Aufrufer sie nicht vergessen anzuwenden. */
  function sperre(button, text) {
    var vorher = button.textContent;
    button.disabled = true;
    button.textContent = text;
    return function frei() {
      button.disabled = false;
      button.textContent = vorher;
    };
  }

  /* ---- Prüfung vor dem Absenden ---- */
  /* Das Formular trägt novalidate, damit die Browser-Sprechblasen nicht
     dazwischenfunken. Die Regeln selbst (required, type=email) stehen
     trotzdem im HTML und werden hier ausgelesen — doppelt gepflegte
     Prüflogik gibt es damit nicht. */
  function ersterFehler() {
    if (form.checkValidity()) return null;
    return form.querySelector(":invalid");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var fehlerhaft = ersterFehler();
    if (fehlerhaft) {
      melde(fehlerhaft.validationMessage || "Bitte die Angaben prüfen.", "fehler");
      fehlerhaft.focus();
      return;
    }

    var frei = sperre(knopf, "Wird gesendet …");
    melde("");

    API.post("api/kontakt", API.formToObject(form))
      .then(function () {
        form.reset();
        melde("Danke — die Anfrage ist angekommen. Antwort folgt innert zwei Tagen.", "ok");
      })
      .catch(function (err) {
        melde(err.message + " Bitte direkt per Mail an " + ERSATZWEG + ".", "fehler");
      })
      .then(frei, frei);
  });
})();
