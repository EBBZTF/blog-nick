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
  function decode(file) {
    if (global.createImageBitmap) {
      return global.createImageBitmap(file).catch(function () { return viaImgTag(file); });
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
      return Promise.reject(new Error("\u201c" + file.name + "\u201d does not look like an image."));
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
                  h: main.h
                };
              });
          });
      });
    }, function () {
      /* Almost always HEIC from an iPhone: Safari can decode it, Chrome and
         Firefox cannot, so the message has to say what to do instead of
         reporting a generic failure. */
      throw new Error(
        "The browser cannot read this image format (usually HEIC from an iPhone). " +
        "On the iPhone go to Settings \u203a Camera \u203a Formats and pick " +
        "\u201cMost Compatible\u201d, or save the image as JPEG first.");
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

    var choose = button("Choose image", function () { picker.click(); });
    var library = button("From library", function () {
      Media.open(function (item) {
        measure(item.src).then(function (size) {
          apply({ src: item.src, thumb: item.thumb, w: size.w, h: size.h, alt: altBox.value });
        });
      });
    });
    var clear = button("Remove", function () {
      set(null); markDirty(); paint();
    });
    buttons.appendChild(choose);
    buttons.appendChild(library);
    buttons.appendChild(clear);

    var note = document.createElement("div");
    note.className = "sub";
    buttons.appendChild(note);

    /* Alt text sits with the image, because it belongs to it — the gallery
       keeps its own separate caption field. */
    var altWrap = document.createElement("div");
    altWrap.className = "imgfld-alt";
    var altLabel = document.createElement("label");
    altLabel.textContent = "Image description (for screen readers)";
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
      busy(true, "Scaling down and uploading \u2026");
      Upload.image(file).then(function (pic) {
        pic.alt = altBox.value;
        apply(pic);
        busy(false, "");
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
        preview.textContent = "no image";
        altBox.value = "";
        clear.disabled = true;
        return;
      }
      preview.classList.remove("empty");
      clear.disabled = false;
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
      title.textContent = "Media library";
      var space = document.createElement("span");
      space.className = "media-space";
      var shut = button("Close", close);
      head.appendChild(title); head.appendChild(space); head.appendChild(shut);
      box.appendChild(head);

      var grid = document.createElement("div");
      grid.className = "media-grid";
      box.appendChild(grid);

      overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
      document.addEventListener("keydown", onEsc);
      document.body.appendChild(overlay);

      grid.textContent = "Loading \u2026";
      API.get("api/uploads").then(function (res) {
        space.textContent = mb(res.bytes) + " of " + mb(res.maxBytes) + " used";
        grid.textContent = "";
        if (!res.items.length) {
          grid.textContent = "No images uploaded yet. Add the first one with \u201cChoose image\u201d.";
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
      del.textContent = "Delete";
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
          if (!confirm("This image is still in use:\n\n" + where +
                       "\n\nDelete anyway? Those places will then show no image.")) return;
          API.del("api/uploads/" + item.id + "?force=1").then(done, function (e) { alert(e.message); });
          return;
        }
        alert(err.message);
      });
      function done() {
        cell.remove();
        if (!grid.children.length) grid.textContent = "No images left.";
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
