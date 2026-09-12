/* Picking, scaling and uploading images for the admin area.

   Scaling happens here in the browser, not on the Pi:
     - a phone photo is 3-5 MB; scaled and converted to WebP it is ~200 KB,
       which is what actually reaches a visitor
     - the Pi never needs an image library, so the project stays free of
       dependencies and nothing has to be compiled on an ARM board
     - the SD card, the part that fails first, is written far less

   Two files are stored per image: the display version at at most 2000 px and
   a 480 px thumbnail for the grid in the gallery and the media library.

   Exposes:
     Upload.image(file)      -> promise with {src, thumb, w, h}
     ImageField.create(...)  -> the "image" field type used by js/admin.js */
(function (global) {
  "use strict";

  var MAIN_MAX = 2000;
  var THUMB_MAX = 480;
  var QUALITY = 0.82;
  /* Stay clearly under the 3 MB the server accepts, so a photo never fails on
     size — the encoder steps the quality down until it fits. */
  var MAIN_MAX_BYTES = 2 * 1024 * 1024;
  var THUMB_MAX_BYTES = 300 * 1024;

  /* ---------------------------- scaling --------------------------------- */

  /* createImageBitmap is the short path. Safari before 17 does not have it for
     files, so fall back to an <img> with an object URL. */
  /* imageOrientation matters: a phone writes the picture in sensor order and
     records "turn this" in the EXIF data. Without the option some browsers
     hand back the unrotated bitmap and portrait photos end up sideways. */
  function decode(file) {
    if (global.createImageBitmap) {
      return global.createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(function () { return global.createImageBitmap(file); })
        .catch(function () { return viaImgTag(file); });
    }
    return viaImgTag(file);
  }

  function viaImgTag(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  /* Encode as small as possible without going below a usable quality.

     The format cannot simply be requested: a browser that does not support
     WebP *encoding* — Safari, depending on version — ignores the argument and
     silently hands back a PNG instead of failing. A 2000 px photo as PNG is
     several megabytes, which then ran into the size limit of the upload and
     looked to the user like "the picture is too big". So check what actually
     came back instead of trusting the request, and fall back to JPEG, which
     every browser can encode.

     If the result is still over the limit, quality is stepped down before
     giving up — one pass is normally enough. */
  function encode(canvas, maxBytes) {
    return toBlob(canvas, "image/webp", QUALITY).then(function (first) {
      if (first && first.type === "image/webp") {
        if (first.size <= maxBytes) return { blob: first, type: "image/webp" };
        return stepDown(canvas, "image/webp", maxBytes);
      }
      /* The browser gave us something else — do not send that. */
      return stepDown(canvas, "image/jpeg", maxBytes);
    });
  }

  function stepDown(canvas, type, maxBytes) {
    var steps = [QUALITY, 0.7, 0.6, 0.5];
    var i = 0;
    function attempt() {
      return toBlob(canvas, type, steps[i]).then(function (blob) {
        if (!blob) throw new Error("encode");
        if (blob.size <= maxBytes || i === steps.length - 1) {
          return { blob: blob, type: blob.type || type };
        }
        i += 1;
        return attempt();
      });
    }
    return attempt();
  }

  function scaleTo(bitmap, max, maxBytes) {
    var w = bitmap.width || bitmap.naturalWidth;
    var h = bitmap.height || bitmap.naturalHeight;
    var factor = Math.min(1, max / Math.max(w, h));
    var outW = Math.max(1, Math.round(w * factor));
    var outH = Math.max(1, Math.round(h * factor));

    var canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, outW, outH);

    return encode(canvas, maxBytes).then(function (out) {
      return { blob: out.blob, type: out.type, w: outW, h: outH };
    });
  }

  /* ---------------------------- uploading ------------------------------- */

  function image(file) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)) {
      return Promise.reject(new Error("\u201e" + file.name + "\u201c sieht nicht wie ein Bild aus."));
    }

    return decode(file).then(function (bitmap) {
      return scaleTo(bitmap, MAIN_MAX, MAIN_MAX_BYTES).then(function (main) {
        return API.postBinary("api/upload?variant=main", main.blob, main.type)
          .then(function (res) {
            return scaleTo(bitmap, THUMB_MAX, THUMB_MAX_BYTES)
              .then(function (thumb) {
                return API.postBinary(
                  "api/upload?variant=thumb&id=" + encodeURIComponent(res.id),
                  thumb.blob, thumb.type);
              })
              /* The thumbnail is a nicety. If it fails, the main image is
                 already stored and usable — better a heavier grid than a
                 half-completed upload the user has to repeat. */
              .catch(function () { return null; })
              .then(function (thumbRes) {
                return {
                  src: res.src,
                  thumb: thumbRes ? thumbRes.src : res.src,
                  w: main.w,
                  h: main.h,
                  bytes: res.bytes,
                  format: main.type
                };
              });
          });
      });
    }, function () {
      /* Almost always HEIC from an iPhone: Safari can decode it, Chrome and
         Firefox cannot, so the message has to say what to do instead of
         reporting a generic failure. */
      throw new Error(
        "Dieses Bildformat kann der Browser nicht lesen (meist HEIC vom iPhone). " +
        "Am iPhone unter Einstellungen \u203a Kamera \u203a Formate \u201eMaximale " +
        "Kompatibilit\u00e4t\u201c w\u00e4hlen, oder das Bild vorher als JPEG speichern.");
    });
  }

  global.Upload = { image: image, MAIN_MAX: MAIN_MAX, THUMB_MAX: THUMB_MAX };

  /* ========================= the image field =========================== */

  /* Content may hold either an object or — for entries written before uploads
     existed — a bare path. Both are read; only objects are written. */
  function toPicture(v) {
    if (!v) return null;
    if (typeof v === "string") return { src: v };
    return v.src ? v : null;
  }

  /* Dimensions of an image already on the server, read from the image itself.
     This is why the upload list needs no second index of width and height
     that could drift away from the directory. */
  function measure(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = function () { resolve({ w: 0, h: 0 }); };
      img.src = src;
    });
  }

  /* Focus point of a picture, in percent. 50/50 is the middle, which is what a
     browser does by default.

     Deliberately not a crop: the same photo appears in the gallery at 4:3, in
     the journal at 16:9 and in the hero almost square. A fixed crop would suit
     one of those and ruin the others. A focus point says which part must stay
     visible, and every placement crops around it by itself. */
  function focusOf(pic) {
    if (!pic) return { x: 50, y: 50 };
    return {
      x: typeof pic.focusX === "number" ? pic.focusX : 50,
      y: typeof pic.focusY === "number" ? pic.focusY : 50
    };
  }
  function clampPercent(n) { return Math.max(0, Math.min(100, Math.round(n))); }

  function create(spec, get, set, markDirty) {
    var wrap = document.createElement("div");
    wrap.className = "fld imgfld";

    var label = document.createElement("label");
    label.textContent = spec.label;
    wrap.appendChild(label);

    var row = document.createElement("div");
    row.className = "imgfld-row";
    wrap.appendChild(row);

    var preview = document.createElement("div");
    preview.className = "imgfld-prev";
    row.appendChild(preview);

    var buttons = document.createElement("div");
    buttons.className = "imgfld-btns";
    row.appendChild(buttons);

    var picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.hidden = true;
    wrap.appendChild(picker);

    var choose = button("Bild wählen", function () { picker.click(); });
    var library = button("Aus Mediathek", function () {
      Media.open(function (item) {
        measure(item.src).then(function (size) {
          apply({ src: item.src, thumb: item.thumb, w: size.w, h: size.h, alt: altBox.value });
        });
      });
    });
    var clear = button("Entfernen", function () {
      set(null); markDirty(); paint();
    });
    buttons.appendChild(choose);
    buttons.appendChild(library);
    buttons.appendChild(clear);

    var note = document.createElement("div");
    note.className = "sub";
    buttons.appendChild(note);

    /* ---- position within the frame ---- */
    /* Works like setting a profile picture: drag the photo inside the frame
       until the right part is showing. */
    var focusWrap = document.createElement("div");
    focusWrap.className = "focus";
    var focusLabel = document.createElement("label");
    focusLabel.textContent = "Bildausschnitt — zum Verschieben ziehen";
    focusWrap.appendChild(focusLabel);

    var stage = document.createElement("div");
    stage.className = "focus-box";
    stage.tabIndex = 0;
    stage.style.aspectRatio = spec.ratio || "4 / 3";
    var stageImg = document.createElement("img");
    stageImg.alt = "";
    stageImg.draggable = false;
    stage.appendChild(stageImg);
    focusWrap.appendChild(stage);

    var focusRow = document.createElement("div");
    focusRow.className = "focus-row";
    var centreBtn = button("Mitte", function () { setFocus(50, 50); });
    var focusNote = document.createElement("span");
    focusNote.className = "sub";
    focusRow.appendChild(centreBtn);
    focusRow.appendChild(focusNote);
    focusWrap.appendChild(focusRow);
    wrap.appendChild(focusWrap);

    function setFocus(x, y) {
      var pic = toPicture(get());
      if (!pic) return;
      pic.focusX = clampPercent(x);
      pic.focusY = clampPercent(y);
      set(pic); markDirty(); paintFocus();
    }

    function paintFocus() {
      var pic = toPicture(get());
      /* Only shown where a frame actually crops the picture. A partner logo is
         scaled to fit, never cut, so a position would have no effect there —
         the field declares that by having no ratio. */
      focusWrap.hidden = !pic || !spec.ratio;
      if (!pic || !spec.ratio) return;
      var f = focusOf(pic);
      stageImg.src = pic.src;
      stageImg.style.objectPosition = f.x + "% " + f.y + "%";
      focusNote.textContent = f.x === 50 && f.y === 50
        ? "Mitte"
        : "Ausschnitt " + f.x + " / " + f.y;
    }

    /* Dragging moves the picture, so the visible section moves the other way:
       pulling the photo down brings its upper part into view. */
    (function enableDrag() {
      var active = false, lastX = 0, lastY = 0;
      stage.addEventListener("pointerdown", function (e) {
        if (!toPicture(get())) return;
        active = true; lastX = e.clientX; lastY = e.clientY;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add("dragging");
      });
      stage.addEventListener("pointermove", function (e) {
        if (!active) return;
        e.preventDefault();
        var box = stage.getBoundingClientRect();
        var f = focusOf(toPicture(get()));
        var nx = f.x - (e.clientX - lastX) / box.width * 100;
        var ny = f.y - (e.clientY - lastY) / box.height * 100;
        lastX = e.clientX; lastY = e.clientY;
        setFocus(nx, ny);
      });
      ["pointerup", "pointercancel"].forEach(function (ev) {
        stage.addEventListener(ev, function () {
          active = false; stage.classList.remove("dragging");
        });
      });
      /* Same thing from the keyboard, for fine adjustment and for anyone not
         using a mouse. */
      stage.addEventListener("keydown", function (e) {
        var f = focusOf(toPicture(get()));
        var step = e.shiftKey ? 10 : 2;
        var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        var m = moves[e.key];
        if (!m) return;
        e.preventDefault();
        setFocus(f.x + m[0], f.y + m[1]);
      });
    })();

    /* Alt text sits with the image, because it belongs to it — the gallery
       keeps its own separate caption field. */
    var altWrap = document.createElement("div");
    altWrap.className = "imgfld-alt";
    var altLabel = document.createElement("label");
    altLabel.textContent = "Bildbeschreibung (für Screenreader)";
    var altBox = document.createElement("input");
    altBox.type = "text";
    altBox.addEventListener("input", function () {
      var pic = toPicture(get());
      if (!pic) return;
      pic.alt = altBox.value;
      set(pic); markDirty();
    });
    altWrap.appendChild(altLabel); altWrap.appendChild(altBox);
    wrap.appendChild(altWrap);

    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      picker.value = "";
      if (!file) return;
      upload(file);
    });

    /* Dropping a file straight onto the field is the shortest path from the
       photo folder to the website. */
    ["dragenter", "dragover"].forEach(function (ev) {
      wrap.addEventListener(ev, function (e) { e.preventDefault(); wrap.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      wrap.addEventListener(ev, function () { wrap.classList.remove("over"); });
    });
    wrap.addEventListener("drop", function (e) {
      e.preventDefault();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) upload(file);
    });

    function upload(file) {
      busy(true, "Wird verkleinert und hochgeladen \u2026");
      Upload.image(file).then(function (pic) {
        var info = pic.w + " × " + pic.h + " px · " +
                   Math.max(1, Math.round((pic.bytes || 0) / 1024)) + " KB · " +
                   String(pic.format || "").replace("image/", "").toUpperCase();
        delete pic.bytes; delete pic.format;   /* not part of the content */
        pic.alt = altBox.value;
        apply(pic);
        busy(false, info);
      }, function (err) {
        busy(false, err.message);
        note.classList.add("bad");
      });
    }

    function apply(pic) {
      set(pic); markDirty(); paint();
    }

    function busy(on, text) {
      choose.disabled = on; library.disabled = on; clear.disabled = on;
      note.classList.remove("bad");
      note.textContent = text;
    }

    function paint() {
      preview.textContent = "";
      var pic = toPicture(get());
      if (!pic) {
        preview.classList.add("empty");
        preview.textContent = "kein Bild";
        altBox.value = "";
        clear.disabled = true;
        focusWrap.hidden = true;
        return;
      }
      preview.classList.remove("empty");
      clear.disabled = false;
      paintFocus();
      var img = document.createElement("img");
      img.src = pic.thumb || pic.src;
      img.alt = "";
      preview.appendChild(img);
      altBox.value = pic.alt || "";
      if (pic.w && pic.h) note.textContent = pic.w + " × " + pic.h + " px";
    }

    paint();
    return wrap;
  }

  function button(text, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "abtn abtn-l";
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  global.ImageField = { create: create, toPicture: toPicture, measure: measure };

  /* ========================= the media library ========================== */

  var Media = (function () {
    var overlay = null;

    function open(onPick) {
      close();
      overlay = document.createElement("div");
      overlay.className = "media";

      var box = document.createElement("div");
      box.className = "media-box";
      overlay.appendChild(box);

      var head = document.createElement("div");
      head.className = "media-head";
      var title = document.createElement("b");
      title.textContent = "Mediathek";
      var space = document.createElement("span");
      space.className = "media-space";
      var shut = button("Schliessen", close);
      head.appendChild(title); head.appendChild(space); head.appendChild(shut);
      box.appendChild(head);

      var grid = document.createElement("div");
      grid.className = "media-grid";
      box.appendChild(grid);

      overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
      document.addEventListener("keydown", onEsc);
      document.body.appendChild(overlay);

      grid.textContent = "Wird geladen \u2026";
      API.get("api/uploads").then(function (res) {
        space.textContent = mb(res.bytes) + " von " + mb(res.maxBytes) + " belegt";
        grid.textContent = "";
        if (!res.items.length) {
          grid.textContent = "Noch keine Bilder hochgeladen. \u00dcber \u201eBild w\u00e4hlen\u201c das erste hinzuf\u00fcgen.";
          return;
        }
        res.items.forEach(function (item) { grid.appendChild(tile(item, onPick, grid)); });
      }, function (err) {
        grid.textContent = err.message;
      });
    }

    function tile(item, onPick, grid) {
      var cell = document.createElement("div");
      cell.className = "media-cell";

      var img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";
      img.addEventListener("click", function () { onPick(item); close(); });
      cell.appendChild(img);

      var foot = document.createElement("div");
      foot.className = "media-foot";
      var size = document.createElement("span");
      size.textContent = kb(item.bytes);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "abtn abtn-x";
      del.textContent = "Löschen";
      del.addEventListener("click", function () { remove(item, cell, grid); });
      foot.appendChild(size); foot.appendChild(del);
      cell.appendChild(foot);
      return cell;
    }

    /* Deleting asks the server first. If the image is still referenced
       somewhere, it says where, and only then is it removed with force. */
    function remove(item, cell, grid) {
      API.del("api/uploads/" + item.id).then(done, function (err) {
        if (err.status === 409 && err.data && err.data.inUse) {
          var where = err.data.places.slice(0, 6).join("\n");
          if (!confirm("Dieses Bild wird noch verwendet:\n\n" + where +
                       "\n\nTrotzdem l\u00f6schen? Die Stelle zeigt danach kein Bild mehr.")) return;
          API.del("api/uploads/" + item.id + "?force=1").then(done, function (e) { alert(e.message); });
          return;
        }
        alert(err.message);
      });
      function done() {
        cell.remove();
        if (!grid.children.length) grid.textContent = "Keine Bilder mehr vorhanden.";
      }
    }

    function onEsc(e) { if (e.key === "Escape") close(); }

    function close() {
      document.removeEventListener("keydown", onEsc);
      if (overlay) { overlay.remove(); overlay = null; }
    }

    function kb(n) { return Math.max(1, Math.round(n / 1024)) + " KB"; }
    function mb(n) { return (n / 1024 / 1024).toFixed(1) + " MB"; }

    return { open: open, close: close };
  })();

  global.Media = Media;
})(window);
