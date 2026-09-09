/* Gespräche mit server.js — eine Stelle für alle /api/*-Aufrufe.
   Benutzt von js/admin.js und js/kontakt.js.

     API.get("api/session")            -> Promise mit dem geparsten Objekt
     API.post("api/kontakt", daten)    -> dito
     API.formToObject(formularElement) -> einfaches Objekt aus den Feldern

   Alles, was schiefgehen kann, kommt als Error zurück, dessen `message`
   direkt einer Person gezeigt werden kann. Zusätzlich tragen die Fehler:

     err.status  HTTP-Status (0, wenn der Server gar nicht antwortet)
     err.offline true, wenn keine Verbindung zustande kam
     err.data    der geparste Antwortkörper, sofern es JSON war

   Ohne diese Schicht wiederholt sich in jedem Aufruf dasselbe: Kopfzeilen
   setzen, Cookie mitschicken, r.ok prüfen, JSON parsen, und aus einem
   Fehlerobjekt die Meldung des Servers herausholen. */
(function (global) {
  "use strict";

  /* Nicht jede Antwort ist JSON: ein reiner Webspace liefert eine
     HTML-Fehlerseite, und Cloudflare Access schiebt bei abgelaufener
     Sitzung sein Anmeldeformular dazwischen. Beides darf nicht mit einem
     kryptischen "Unexpected token <" enden. */
  function parseBody(response) {
    return response.text().then(function (text) {
      if (!text) return {};
      try { return JSON.parse(text); }
      catch (e) { return null; }        /* null = war kein JSON */
    });
  }

  function macheFehler(text, status, data) {
    var err = new Error(text);
    err.status = status;
    err.offline = status === 0;
    err.data = data;
    return err;
  }

  function request(method, url, body) {
    var optionen = { method: method, credentials: "same-origin" };
    if (body !== undefined) {
      optionen.headers = { "Content-Type": "application/json" };
      optionen.body = JSON.stringify(body);
    }

    return fetch(url, optionen).then(function (response) {
      return parseBody(response).then(function (data) {
        if (response.ok) {
          if (data === null) {
            /* Status 200, aber kein JSON — fast immer eine
               zwischengeschaltete Anmeldeseite. */
            throw macheFehler(
              "Unerwartete Antwort — vermutlich ist die Anmeldung abgelaufen. Bitte die Seite neu laden.",
              response.status, null);
          }
          return data;
        }
        throw macheFehler(
          (data && data.error) || ("Der Server hat mit Fehler " + response.status + " geantwortet."),
          response.status, data);
      });
    }, function () {
      /* fetch selbst ist gescheitert: kein Netz, kein Server, DNS-Fehler. */
      throw macheFehler("Der Server ist nicht erreichbar.", 0, null);
    });
  }

  global.API = {
    get: function (url) {
      return request("GET", url);
    },
    post: function (url, body) {
      return request("POST", url, body === undefined ? {} : body);
    },
    /* Formularfelder als einfaches Objekt. Nur benannte Felder kommen mit —
       genau die, die der Server ohnehin als einzige akzeptiert. */
    formToObject: function (form) {
      var out = {};
      new FormData(form).forEach(function (wert, name) { out[name] = wert; });
      return out;
    }
  };
})(window);
