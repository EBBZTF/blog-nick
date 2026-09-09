/* Conversations with server.js — one place for all /api/* calls.
   Used by js/admin.js and js/contact.js.

     API.get("api/session")           -> promise with the parsed object
     API.post("api/contact", data)    -> same
     API.formToObject(formElement)    -> plain object from the fields

   Anything that can go wrong comes back as an Error. Its `message` is English
   and meant for the admin area; a page shown to visitors builds its own German
   text from the fields below instead of passing `message` through — see
   js/contact.js. In addition the errors carry:

     err.status  HTTP status (0 if the server did not answer at all)
     err.offline true if no connection could be established
     err.data    the parsed response body, if it was JSON

   Without this layer the same thing repeats in every call: set headers, send
   the cookie along, check r.ok, parse JSON, and dig the server's message out
   of an error object. */
(function (global) {
  "use strict";

  /* Not every answer is JSON: a plain web space returns an HTML error page,
     and Cloudflare Access pushes its own login form in front once a session
     has expired. Neither may end in a cryptic "Unexpected token <". */
  function parseBody(response) {
    return response.text().then(function (text) {
      if (!text) return {};
      try { return JSON.parse(text); }
      catch (e) { return null; }        /* null = was not JSON */
    });
  }

  function makeError(text, status, data) {
    var err = new Error(text);
    err.status = status;
    err.offline = status === 0;
    err.data = data;
    return err;
  }

  function handle(response) {
    return parseBody(response).then(function (data) {
      if (response.ok) {
        if (data === null) {
          /* Status 200 but no JSON — almost always a login page that got in
             between. */
          throw makeError(
            "Unexpected answer — the sign-in has probably expired. Please reload the page.",
            response.status, null);
        }
        return data;
      }
      throw makeError(
        (data && data.error) || ("The server answered with error " + response.status + "."),
        response.status, data);
    });
  }

  function unreachable() {
    /* fetch itself failed: no network, no server, DNS error. */
    throw makeError("The server cannot be reached.", 0, null);
  }

  function request(method, url, body) {
    var options = { method: method, credentials: "same-origin" };
    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    return fetch(url, options).then(handle, unreachable);
  }

  global.API = {
    get: function (url) {
      return request("GET", url);
    },
    post: function (url, body) {
      return request("POST", url, body === undefined ? {} : body);
    },
    del: function (url) {
      return request("DELETE", url);
    },
    /* Raw bytes instead of JSON — used for image uploads, which would grow by
       a third if they had to be encoded as base64 inside a JSON body. Goes
       through the same error handling as everything else, so an expired
       session reports the same message here as elsewhere. */
    postBinary: function (url, blob, type) {
      return fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": type },
        body: blob
      }).then(handle, unreachable);
    },
    /* Form fields as a plain object. Only named fields come along — exactly
       the ones the server accepts as the only ones anyway. */
    formToObject: function (form) {
      var out = {};
      new FormData(form).forEach(function (value, name) { out[name] = value; });
      return out;
    }
  };
})(window);
