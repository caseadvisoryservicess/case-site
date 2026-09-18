/*! CASE Plan Recognizer v1.0 — deterministic floor-plan reader for SVG and vector PDF.
    No network, no ML, no OCR. Pure geometry + text extraction + rule matching.
    Drop into a single-file build as an inline <script>. Browser only (needs DOMParser).

    Pipeline:
      readSvg(text)            -> Plan      { viewBox, texts[], shapes[] }
      readPdfPage(pdfPage)     -> Plan      (optional, needs a vendored pdf.js)
      detectUnits(plan, opt)   -> Detected  { units[], codes[], areaLabels[], diagnostics }
      calibrateScale(detected) -> { scale, r2, samples }   px^2 -> m^2
      matchToInventory(d, rows, opt) -> { matched[], unmatchedPlan[], unmatchedRows[] }
      toHotspots(matched)      -> hotspot records ready for the SVG overlay

    Every stage reports confidence and leaves gaps visible. Nothing is guessed silently.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlanRecognizer = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 0. Tunables. Override per project — never hard-code a client's plan.
   * ------------------------------------------------------------------ */
  var DEFAULTS = {
    /* A unit code as it appears on the drawing. Add project patterns here. */
    codePatterns: [
      /^[A-ZА-Я]{1,3}\d*[_\-]\d{1,4}[A-ZА-Я]?$/,   // L2_11, B1_001, TK-14
      /^\d{1,2}[.\-]\d{1,3}$/                       // 2.14
    ],
    /* An area label: "282 м", "987.7 м²", "104,8 m2", "16.3М²" */
    areaPattern: /(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:м|m|М|M|кв|sq)\s*(?:²|2)?/,
    /* Fallback when the drawing prints an area as a bare number beside the code. */
    bareNumberAreas: true,
    bareNumberRange: [3, 5000],
    /* CAD exports are often written UTF-8 then re-read as Latin-1 ("Ð¼" for "м").
       Repair before parsing, or every Cyrillic label on the plan is lost. */
    repairEncoding: true,
    /* CAD export noise to strip from text runs before parsing. */
    cadNoise: /\\[fFhHpPoOcCqQtTwWaAxX][^;]*;|\\[PLlOoKk]|\{|\}/g,
    /* Max distance (in user units, relative to plan diagonal) for pairing
       a code with its area label. 0.06 = 6% of the drawing diagonal. */
    pairRadius: 0.06,
    /* Area match tolerance against the inventory, as a fraction. */
    areaTolerance: 0.03,
    /* Shapes smaller than this share of the median candidate are dropped. */
    minShapeShare: 0.05,
    /* Treat a path as a closed region only if it ends with Z and has >= 3 pts. */
    requireClosed: true
  };

  /* ------------------------------------------------------------------ *
   * 1. Small geometry helpers
   * ------------------------------------------------------------------ */
  function shoelace(pts) {                       // signed area, user units^2
    var a = 0, n = pts.length, i, j;
    for (i = 0, j = n - 1; i < n; j = i++) a += (pts[j][0] * pts[i][1]) - (pts[i][0] * pts[j][1]);
    return Math.abs(a / 2);
  }
  function centroid(pts) {
    var x = 0, y = 0, n = pts.length, i;
    for (i = 0; i < n; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / n, y / n];
  }
  function bbox(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i][0] < x0) x0 = pts[i][0]; if (pts[i][0] > x1) x1 = pts[i][0];
      if (pts[i][1] < y0) y0 = pts[i][1]; if (pts[i][1] > y1) y1 = pts[i][1];
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function pointInPoly(px, py, pts) {
    var inside = false, i, j, xi, yi, xj, yj;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      xi = pts[i][0]; yi = pts[i][1]; xj = pts[j][0]; yj = pts[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
    }
    return inside;
  }
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }

  /* Apply an SVG transform chain to a point. Handles matrix/translate/scale/rotate. */
  function applyTransforms(chain, x, y) {
    var m = [1, 0, 0, 1, 0, 0], i;
    for (i = chain.length - 1; i >= 0; i--) m = mul(chain[i], m);
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }
  function mul(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }
  function parseTransform(s) {
    var out = [], re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g, m, p;
    while ((m = re.exec(s || ''))) {
      p = m[2].trim().split(/[\s,]+/).map(Number);
      if (m[1] === 'matrix' && p.length >= 6) out.push(p.slice(0, 6));
      else if (m[1] === 'translate') out.push([1, 0, 0, 1, p[0] || 0, p[1] || 0]);
      else if (m[1] === 'scale') out.push([p[0] || 1, 0, 0, (p.length > 1 ? p[1] : p[0]) || 1, 0, 0]);
      else if (m[1] === 'rotate') {
        var r = (p[0] || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
        out.push([c, sn, -sn, c, 0, 0]);
      }
    }
    return out;
  }
  function chainOf(el, stopAt) {
    var chain = [], n = el;
    while (n && n !== stopAt && n.getAttribute) {
      var t = n.getAttribute('transform');
      if (t) chain = chain.concat(parseTransform(t));
      n = n.parentNode;
    }
    return chain;
  }

  /* ------------------------------------------------------------------ *
   * 2. Path data -> polygons. Supports M/L/H/V/C/S/Q/T/A/Z (curves are
   *    flattened to their endpoints — enough for area and hit-testing on
   *    architectural line-work).
   * ------------------------------------------------------------------ */
  function pathToPolys(d) {
    var polys = [], cur = [], x = 0, y = 0, sx = 0, sy = 0;
    var re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g, m;
    while ((m = re.exec(d || ''))) {
      var cmd = m[1], rel = cmd === cmd.toLowerCase();
      var a = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      var k = cmd.toUpperCase(), i = 0;
      if (k === 'Z') { if (cur.length > 2) { cur.closed = true; polys.push(cur); } cur = []; x = sx; y = sy; continue; }
      while (i < a.length) {
        if (k === 'M') {
          x = rel ? x + a[i] : a[i]; y = rel ? y + a[i + 1] : a[i + 1]; i += 2;
          if (cur.length > 2) polys.push(cur);
          cur = [[x, y]]; sx = x; sy = y; k = 'L';                 // subsequent pairs are lineto
        } else if (k === 'L') { x = rel ? x + a[i] : a[i]; y = rel ? y + a[i + 1] : a[i + 1]; i += 2; cur.push([x, y]); }
        else if (k === 'H') { x = rel ? x + a[i] : a[i]; i += 1; cur.push([x, y]); }
        else if (k === 'V') { y = rel ? y + a[i] : a[i]; i += 1; cur.push([x, y]); }
        else if (k === 'C') { x = rel ? x + a[i + 4] : a[i + 4]; y = rel ? y + a[i + 5] : a[i + 5]; i += 6; cur.push([x, y]); }
        else if (k === 'S' || k === 'Q') { x = rel ? x + a[i + 2] : a[i + 2]; y = rel ? y + a[i + 3] : a[i + 3]; i += 4; cur.push([x, y]); }
        else if (k === 'T') { x = rel ? x + a[i] : a[i]; y = rel ? y + a[i + 1] : a[i + 1]; i += 2; cur.push([x, y]); }
        else if (k === 'A') { x = rel ? x + a[i + 5] : a[i + 5]; y = rel ? y + a[i + 6] : a[i + 6]; i += 7; cur.push([x, y]); }
        else break;
      }
    }
    if (cur.length > 2) polys.push(cur);
    return polys;
  }

  /* ------------------------------------------------------------------ *
   * 3. SVG reader
   * ------------------------------------------------------------------ */
  /* UTF-8 bytes that were read as Latin-1 — the classic CAD/Inkscape export bug.
     "Ð¼" -> "м". Returns the input untouched when it is not mojibake. */
  function repairMojibake(s) {
    if (!/[\u00C2-\u00D5][\u0080-\u00BF]/.test(s)) return s;
    try {
      var b = new Uint8Array(s.length), i, c;
      for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c > 255) return s; b[i] = c; }
      var out = new TextDecoder('utf-8', { fatal: true }).decode(b);
      return /\uFFFD/.test(out) ? s : out;
    } catch (e) { return s; }
  }

  function cleanText(s, opt) {
    var v = String(s || '');
    if (opt.repairEncoding) v = repairMojibake(v);
    return v
      .replace(opt.cadNoise, '')      // AutoCAD/Inkscape formatting escapes
      .replace(/ |&#160;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readSvg(svgText, options) {
    var opt = Object.assign({}, DEFAULTS, options || {});
    var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    var err = doc.querySelector('parsererror');
    if (err) throw new Error('SVG parse failed: ' + (err.textContent || '').slice(0, 120));
    var svg = doc.documentElement;

    var vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(isNaN)) {
      var w = parseFloat(svg.getAttribute('width')) || 1000, h = parseFloat(svg.getAttribute('height')) || 1000;
      vb = [0, 0, w, h];
    }
    var diag = Math.sqrt(vb[2] * vb[2] + vb[3] * vb[3]);

    /* --- text runs, in root coordinates --- */
    var texts = [], nodes = svg.querySelectorAll('text'), i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var raw = cleanText(el.textContent, opt);
      if (!raw) continue;
      var lx = parseFloat(el.getAttribute('x')) || 0, ly = parseFloat(el.getAttribute('y')) || 0;
      var sp = el.querySelector('tspan');
      if (sp && el.getAttribute('x') == null) {
        lx = parseFloat(sp.getAttribute('x')) || 0; ly = parseFloat(sp.getAttribute('y')) || 0;
      }
      var pt = applyTransforms(chainOf(el, svg), lx, ly);
      texts.push({ text: raw, x: pt[0], y: pt[1], el: el });
    }

    /* --- closed regions, in root coordinates --- */
    var shapes = [], sel = svg.querySelectorAll('path,polygon,polyline,rect'), j;
    for (j = 0; j < sel.length; j++) {
      var s = sel[j], tag = s.tagName.toLowerCase(), rings = [];
      if (tag === 'path') rings = pathToPolys(s.getAttribute('d'));
      else if (tag === 'polygon' || tag === 'polyline') {
        var nums = (s.getAttribute('points') || '').match(/-?\d*\.?\d+/g) || [], r = [], q;
        for (q = 0; q + 1 < nums.length; q += 2) r.push([+nums[q], +nums[q + 1]]);
        if (r.length > 2) { r.closed = (tag === 'polygon'); rings = [r]; }
      } else if (tag === 'rect') {
        var rx = +s.getAttribute('x') || 0, ry = +s.getAttribute('y') || 0,
            rw = +s.getAttribute('width') || 0, rh = +s.getAttribute('height') || 0;
        if (rw > 0 && rh > 0) { var rr = [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]]; rr.closed = true; rings = [rr]; }
      }
      if (!rings.length) continue;
      var ch = chainOf(s, svg);
      for (var k2 = 0; k2 < rings.length; k2++) {
        var ring = rings[k2];
        if (opt.requireClosed && !ring.closed) continue;
        if (ring.length < 3) continue;
        var pts = ring.map(function (p) { return applyTransforms(ch, p[0], p[1]); });
        var ar = shoelace(pts);
        if (!(ar > 0)) continue;
        shapes.push({
          id: s.getAttribute('id') || ('shape' + shapes.length),
          label: s.getAttribute('inkscape:label') || s.getAttribute('data-name') || '',
          dataUnit: s.getAttribute('data-unit-id') || s.getAttribute('data-unit') || '',
          points: pts, areaPx: ar, c: centroid(pts), bb: bbox(pts),
          fill: (s.getAttribute('fill') || (s.getAttribute('style') || '').match(/fill\s*:\s*([^;]+)/) || [])[1] || s.getAttribute('fill') || ''
        });
      }
    }
    return { source: 'svg', viewBox: vb, diag: diag, texts: texts, shapes: shapes, doc: doc, svg: svg };
  }


  /* ------------------------------------------------------------------ *
   * 3b. Uploaded SVG must be sanitised before it touches the DOM.
   *     Ported from CASE OS core.js sanitizePlanSvgDom() — a floor plan is a
   *     file a third party sent us, and an SVG can carry script.
   * ------------------------------------------------------------------ */
  var STRIP_TAGS = 'script,foreignObject,animate,animateTransform,animateMotion,set,handler,iframe,object,embed,use[href^="http"]';

  function sanitizeSvgDom(host) {
    if (!host || !host.querySelectorAll) return host;
    try {
      host.querySelectorAll(STRIP_TAGS).forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      [host].concat([].slice.call(host.querySelectorAll('*'))).forEach(function (el) {
        if (!el.attributes) return;
        [].slice.call(el.attributes).forEach(function (a) {
          var n = (a.name || '').toLowerCase();
          var v = (a.value || '').replace(/\s+/g, '').toLowerCase();
          if (n.indexOf('on') === 0) el.removeAttribute(a.name);
          else if ((n === 'href' || n.slice(-5) === ':href') && (v.indexOf('javascript:') === 0 || v.indexOf('data:text/html') === 0)) el.removeAttribute(a.name);
          else if (n === 'style' && /expression\(|javascript:/i.test(a.value)) el.removeAttribute(a.name);
        });
      });
    } catch (e) {}
    return host;
  }

  /* Sanitised markup, safe to inject. Returns '' when the SVG will not parse. */
  function sanitizeSvg(svgText) {
    try {
      var doc = new DOMParser().parseFromString(String(svgText || ''), 'image/svg+xml');
      if (doc.querySelector('parsererror')) return '';
      sanitizeSvgDom(doc.documentElement);
      return new XMLSerializer().serializeToString(doc.documentElement);
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------------ *
   * 3c. Live reading — the more reliable path when the SVG is in the page.
   *     Illustrator and most CAD exporters position <text> with
   *     transform="matrix(...)", so getBBox() alone returns pre-transform
   *     coordinates (~0,0 for every label at once). getBBox() combined with
   *     getCTM() is the only thing that gives the true position.
   *     Learned the hard way in CASE OS core.js parsePlanLabels().
   *     Requires the SVG to be attached to the document and laid out.
   *
   *     MEASURED TRADE-OFF (Zarafshan L2, 17 units):
   *       readSvg()     exact path geometry  -> scale R2 = 0.999982
   *       readSvgLive() bounding boxes       -> scale R2 = 0.5985
   *     So: prefer readSvg() for areas and outlines. Reach for readSvgLive()
   *     when a drawing's transforms defeat the static parser and codes come
   *     out mispositioned — then take its TEXT positions, not its shapes.
   * ------------------------------------------------------------------ */
  function readSvgLive(svgEl, options) {
    var opt = Object.assign({}, DEFAULTS, options || {});
    if (!svgEl || !svgEl.getBBox) throw new Error('readSvgLive needs an <svg> element attached to the document');

    function posOf(el) {
      try {
        var b = el.getBBox(), ctm = el.getCTM();
        if (!ctm) return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        var pt = svgEl.createSVGPoint();
        pt.x = b.x + b.width / 2; pt.y = b.y + b.height / 2;
        var tp = pt.matrixTransform(ctm);
        return { x: tp.x, y: tp.y };
      } catch (e) { return { x: 0, y: 0 }; }
    }

    var texts = [];
    svgEl.querySelectorAll('text').forEach(function (t) {
      if (t.closest && t.closest('[data-case-overlay]')) return;      // skip our own labels
      var spans = t.querySelectorAll('tspan'), gp = posOf(t);
      if (spans.length > 1) {
        spans.forEach(function (ts) {
          var v = cleanText(ts.textContent, opt); if (!v) return;
          var p = posOf(ts);
          texts.push({ text: v, x: p.x || gp.x, y: p.y || gp.y, el: ts });
        });
      } else {
        var raw = cleanText(t.textContent, opt); if (!raw) return;
        raw.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean)
          .forEach(function (v) { texts.push({ text: v, x: gp.x, y: gp.y, el: t }); });
      }
    });

    var shapes = [];
    svgEl.querySelectorAll('path,polygon,rect').forEach(function (el, i) {
      try {
        var b = el.getBBox(); if (!(b.width > 0 && b.height > 0)) return;
        var ctm = el.getCTM(), corners = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]];
        var pts = corners.map(function (c) {
          if (!ctm) return c;
          var pt = svgEl.createSVGPoint(); pt.x = c[0]; pt.y = c[1];
          var tp = pt.matrixTransform(ctm); return [tp.x, tp.y];
        });
        shapes.push({
          id: el.getAttribute('id') || ('live' + i),
          label: el.getAttribute('inkscape:label') || '',
          dataUnit: el.getAttribute('data-unit-id') || el.getAttribute('data-unit') || '',
          points: pts, areaPx: shoelace(pts), c: centroid(pts), bb: bbox(pts), live: true, el: el
        });
      } catch (e) {}
    });

    var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    var box = vb && vb.width ? [vb.x, vb.y, vb.width, vb.height] : [0, 0, svgEl.clientWidth || 1000, svgEl.clientHeight || 1000];
    return {
      source: 'svg-live', viewBox: box, diag: Math.sqrt(box[2] * box[2] + box[3] * box[3]),
      texts: texts, shapes: shapes, svg: svgEl,
      note: 'Read from the live DOM (getBBox + getCTM). Text positions are exact. ' +
            'Outlines are BOUNDING BOXES, not contours: measured on the Zarafshan plan, ' +
            'scale calibration gives R2 0.60 here against 0.9999 from readSvg(). ' +
            'Use readSvg() for geometry and this only for text positions the static parser misplaces.'
    };
  }

  /* ------------------------------------------------------------------ *
   * 4. Vector PDF reader (optional). Requires a VENDORED pdf.js — never a CDN.
   *    Give it an already-resolved PDFPageProxy.
   * ------------------------------------------------------------------ */
  async function readPdfPage(page, options) {
    var opt = Object.assign({}, DEFAULTS, options || {});
    var vpt = page.getViewport({ scale: 1 });
    var tc = await page.getTextContent();
    var texts = tc.items.map(function (it) {
      var t = cleanText(it.str, opt);
      return t ? { text: t, x: it.transform[4], y: vpt.height - it.transform[5] } : null;
    }).filter(Boolean);
    var ops = await page.getOperatorList();
    var isVector = ops.fnArray && ops.fnArray.length > 40;
    return {
      source: 'pdf', viewBox: [0, 0, vpt.width, vpt.height],
      diag: Math.sqrt(vpt.width * vpt.width + vpt.height * vpt.height),
      texts: texts, shapes: [],            // path reconstruction from an op list is out of scope
      isVector: isVector,
      note: isVector
        ? 'Vector PDF: text and coordinates read. Outlines are not reconstructed — supply SVG for polygons, or draw them once in calibration mode.'
        : 'This PDF carries no extractable text. It is a scan. Automatic reading is not possible — use calibration mode or export an SVG from the CAD file.'
    };
  }

  /* ------------------------------------------------------------------ *
   * 5. Detection — find unit codes, area labels, and pair them
   * ------------------------------------------------------------------ */
  function parseAreaLabel(s, opt) {
    var m = opt.areaPattern.exec(s);
    if (m) {
      var v = parseFloat(String(m[1]).replace(',', '.'));
      if (isFinite(v) && v > 0) return { area: v, sure: true };
    }
    if (opt.bareNumberAreas) {
      var b = /^(\d{1,6}(?:[.,]\d{1,2})?)\s*\S{0,4}$/.exec(s.trim());
      if (b) {
        var w = parseFloat(String(b[1]).replace(',', '.'));
        if (isFinite(w) && w >= opt.bareNumberRange[0] && w <= opt.bareNumberRange[1]) return { area: w, sure: false };
      }
    }
    return null;
  }
  function looksLikeCode(s, opt) {
    var t = s.replace(/\s+/g, '');
    for (var i = 0; i < opt.codePatterns.length; i++) if (opt.codePatterns[i].test(t)) return t;
    return null;
  }

  function detectUnits(plan, options) {
    var opt = Object.assign({}, DEFAULTS, options || {});
    var codes = [], areaLabels = [], other = [], i;

    for (i = 0; i < plan.texts.length; i++) {
      var tx = plan.texts[i], code = looksLikeCode(tx.text, opt);
      if (code) { codes.push({ code: code, x: tx.x, y: tx.y }); continue; }
      var ar = parseAreaLabel(tx.text, opt);
      if (ar) { areaLabels.push({ area: ar.area, sure: ar.sure, x: tx.x, y: tx.y, raw: tx.text }); continue; }
      other.push(tx);
    }

    /* Shapes that already declare their unit — the ideal export. */
    var declared = {};
    for (i = 0; i < plan.shapes.length; i++) {
      var sh = plan.shapes[i], d = sh.dataUnit || looksLikeCode(sh.label || '', opt) || looksLikeCode(sh.id || '', opt);
      if (d) declared[d] = sh;
    }

    /* Pair each code with the nearest unclaimed area label.
       A fixed fraction of the drawing diagonal breaks on very dense or very
       sparse plans, so take the median nearest-neighbour distance between
       codes as the natural spacing of this drawing and scale from that
       (CASE OS core.js parsePlanLabels does the same). Fall back to the
       fixed fraction when there are too few codes to form a median. */
    var radius = plan.diag * opt.pairRadius;
    if (codes.length >= 3) {
      var nn = [];
      codes.forEach(function (a, ia) {
        var best = Infinity;
        codes.forEach(function (b, ib) {
          if (ia === ib) return;
          var d = dist([a.x, a.y], [b.x, b.y]); if (d < best) best = d;
        });
        if (isFinite(best)) nn.push(best);
      });
      nn.sort(function (a, b) { return a - b; });
      var median = nn[Math.floor(nn.length / 2)];
      if (median > 0) radius = Math.min(radius, median * 0.9);
    }
    var used = {}, units = [];
    for (i = 0; i < codes.length; i++) {
      var c = codes[i], best = -1, bestD = Infinity, j;
      for (j = 0; j < areaLabels.length; j++) {
        if (used[j]) continue;
        var dd = dist([c.x, c.y], [areaLabels[j].x, areaLabels[j].y]);
        if (dd < bestD) { bestD = dd; best = j; }
      }
      var pair = (best >= 0 && bestD <= radius) ? areaLabels[best] : null;
      if (pair) used[best] = true;

      /* Which closed shape contains this code? Smallest containing region wins. */
      var host = declared[c.code] || null;
      if (!host) {
        var bestA = Infinity, k;
        for (k = 0; k < plan.shapes.length; k++) {
          var s2 = plan.shapes[k];
          if (s2.areaPx < bestA && pointInPoly(c.x, c.y, s2.points)) { bestA = s2.areaPx; host = s2; }
        }
      }
      units.push({
        code: c.code, x: c.x, y: c.y,
        planArea: pair ? pair.area : null,
        planAreaSure: pair ? !!pair.sure : null,
        planAreaDistance: pair ? +(bestD / plan.diag).toFixed(4) : null,
        polygon: host ? host.points : null,
        polygonAreaPx: host ? host.areaPx : null,
        source: declared[c.code] ? 'declared' : (host ? 'contained' : 'text-only'),
        confidence: declared[c.code] ? 'high' : (host && pair ? 'high' : (host || pair ? 'medium' : 'low'))
      });
    }

    var orphanAreas = areaLabels.filter(function (_, idx) { return !used[idx]; });
    return {
      units: units, codes: codes, areaLabels: areaLabels, orphanAreas: orphanAreas, otherTexts: other,
      diagnostics: {
        codesFound: codes.length,
        areaLabelsFound: areaLabels.length,
        withPolygon: units.filter(function (u) { return u.polygon; }).length,
        withPlanArea: units.filter(function (u) { return u.planArea != null; }).length,
        shapesTotal: plan.shapes.length,
        unpairedAreaLabels: orphanAreas.length
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 6. Scale calibration: user-units^2 -> m^2, from units that have BOTH a
   *    polygon and a printed area. Least squares through the origin, plus R².
   * ------------------------------------------------------------------ */
  function calibrateScale(detected) {
    var s = detected.units.filter(function (u) { return u.polygon && u.planArea > 0 && u.polygonAreaPx > 0; });
    if (!s.length) return { scale: null, r2: null, samples: 0, note: 'No unit has both a polygon and a printed area. Scale cannot be derived; ask for two known points instead.' };
    var num = 0, den = 0, i;
    for (i = 0; i < s.length; i++) { num += s[i].polygonAreaPx * s[i].planArea; den += s[i].polygonAreaPx * s[i].polygonAreaPx; }
    var k = num / den;
    var ssTot = 0, ssRes = 0, mean = s.reduce(function (a, u) { return a + u.planArea; }, 0) / s.length;
    for (i = 0; i < s.length; i++) {
      var pred = k * s[i].polygonAreaPx;
      ssRes += Math.pow(s[i].planArea - pred, 2); ssTot += Math.pow(s[i].planArea - mean, 2);
    }
    return { scale: k, r2: ssTot ? 1 - ssRes / ssTot : 1, samples: s.length };
  }

  /* Once the scale is known, units that carry an outline but no printed area
     get a DERIVED area. It is marked as derived and never shown as measured. */
  function inferAreas(detected, calibration) {
    if (!calibration || !calibration.scale) return { filled: 0, note: 'no scale' };
    var n = 0;
    detected.units.forEach(function (u) {
      if (u.planArea == null && u.polygonAreaPx > 0) {
        u.planArea = +(u.polygonAreaPx * calibration.scale).toFixed(1);
        u.planAreaSource = 'derived';
        u.planAreaSure = false;
        if (u.confidence === 'medium') u.confidence = 'medium';
        n++;
      } else if (u.planArea != null && !u.planAreaSource) {
        u.planAreaSource = u.planAreaSure ? 'printed' : 'printed-bare';
      }
    });
    return { filled: n, scale: calibration.scale, r2: calibration.r2 };
  }

  /* Problems a human must look at before trusting the overlay. */
  function auditDetection(detected) {
    var byCode = {}, byPoly = {}, issues = [];
    detected.units.forEach(function (u) {
      (byCode[u.code] = byCode[u.code] || []).push(u);
      if (u.polygonAreaPx) { var k = Math.round(u.polygonAreaPx); (byPoly[k] = byPoly[k] || []).push(u.code); }
    });
    Object.keys(byCode).forEach(function (c) {
      if (byCode[c].length > 1) issues.push({ level: 'error', code: c, msg: 'code appears ' + byCode[c].length + ' times on this plan — keep one, delete the rest' });
    });
    Object.keys(byPoly).forEach(function (k) {
      if (byPoly[k].length > 1) issues.push({ level: 'warn', code: byPoly[k].join(', '), msg: 'these codes resolved to the SAME outline — the drawing has no separate closed shape for each; draw them in calibration mode' });
    });
    detected.units.forEach(function (u) {
      if (!u.polygon) issues.push({ level: 'warn', code: u.code, msg: 'no closed outline found — draw it once in calibration mode' });
    });
    if (detected.orphanAreas.length) issues.push({ level: 'info', code: '', msg: detected.orphanAreas.length + ' printed area(s) not paired to a code (usually toilets, corridors, plant rooms): ' + detected.orphanAreas.map(function (o) { return o.area; }).join(', ') });
    return issues;
  }

  /* ------------------------------------------------------------------ *
   * 7. Match the plan against the leasing inventory (the LCR rows)
   * ------------------------------------------------------------------ */
  function norm(s) { return String(s == null ? '' : s).toUpperCase().replace(/[\s_\-.]/g, ''); }

  function matchToInventory(detected, rows, options) {
    var opt = Object.assign({}, DEFAULTS, options || {});
    var byCode = {}, i;
    for (i = 0; i < rows.length; i++) byCode[norm(rows[i].id || rows[i].code || rows[i].unit)] = rows[i];

    var matched = [], unmatchedPlan = [], claimed = {};
    for (i = 0; i < detected.units.length; i++) {
      var u = detected.units[i], row = byCode[norm(u.code)], how = 'code', conf = 'high', delta = null;

      if (!row && u.planArea != null) {
        /* No code match — try a unique area match inside the tolerance. */
        var cands = rows.filter(function (r) {
          var a = Number(r.area); if (!(a > 0)) return false;
          return Math.abs(a - u.planArea) / a <= opt.areaTolerance && !claimed[norm(r.id)];
        });
        if (cands.length === 1) { row = cands[0]; how = 'area'; conf = 'medium'; }
        else if (cands.length > 1) { how = 'area-ambiguous'; conf = 'low'; }
      }
      if (row) {
        claimed[norm(row.id)] = true;
        if (u.planArea != null && Number(row.area) > 0) delta = +(u.planArea - Number(row.area)).toFixed(2);
        matched.push({
          code: u.code, rowId: row.id, matchedBy: how, confidence: conf,
          planArea: u.planArea, inventoryArea: Number(row.area) || null, areaDelta: delta,
          areaMismatch: delta != null && Math.abs(delta) / (Number(row.area) || 1) > opt.areaTolerance,
          polygon: u.polygon, x: u.x, y: u.y
        });
      } else unmatchedPlan.push(u);
    }
    var unmatchedRows = rows.filter(function (r) { return !claimed[norm(r.id)]; });
    return {
      matched: matched, unmatchedPlan: unmatchedPlan, unmatchedRows: unmatchedRows,
      summary: {
        planUnits: detected.units.length, inventoryRows: rows.length,
        matched: matched.length, byCode: matched.filter(function (m) { return m.matchedBy === 'code'; }).length,
        byArea: matched.filter(function (m) { return m.matchedBy === 'area'; }).length,
        areaMismatches: matched.filter(function (m) { return m.areaMismatch; }).length,
        notOnPlan: unmatchedRows.length, notInInventory: unmatchedPlan.length
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 8. Output for the interactive overlay
   * ------------------------------------------------------------------ */
  function toHotspots(match, viewBox) {
    return {
      viewBox: viewBox,
      generated: new Date().toISOString(),
      hotspots: match.matched.filter(function (m) { return m.polygon; }).map(function (m) {
        return {
          unitId: m.rowId,
          points: m.polygon.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '),
          labelAt: [ +m.x.toFixed(1), +m.y.toFixed(1) ],
          origin: m.matchedBy, confidence: m.confidence
        };
      }),
      pending: match.matched.filter(function (m) { return !m.polygon; }).map(function (m) {
        return { unitId: m.rowId, labelAt: [ +m.x.toFixed(1), +m.y.toFixed(1) ], reason: 'code found, no closed outline — draw once in calibration mode' };
      })
    };
  }

  /* ------------------------------------------------------------------ *
   * 9. One-call convenience
   * ------------------------------------------------------------------ */
  function recognizeSvg(svgText, inventoryRows, options) {
    var plan = readSvg(svgText, options);
    var det = detectUnits(plan, options);
    var cal = calibrateScale(det);
    var inferred = inferAreas(det, cal);
    var audit = auditDetection(det);
    var match = inventoryRows ? matchToInventory(det, inventoryRows, options) : null;
    return {
      plan: plan, detected: det, calibration: cal, inferred: inferred, audit: audit, match: match,
      hotspots: match ? toHotspots(match, plan.viewBox) : null,
      report: buildReport(det, cal, match, inferred, audit)
    };
  }

  /* Human-readable result. Gaps are named, never hidden. */
  function buildReport(det, cal, match, inferred, audit) {
    var L = [];
    L.push('Codes on plan: ' + det.diagnostics.codesFound);
    L.push('Printed areas: ' + det.diagnostics.areaLabelsFound + ' (' + det.diagnostics.withPlanArea + ' paired to a code)');
    L.push('Closed outlines: ' + det.diagnostics.shapesTotal + ' (' + det.diagnostics.withPolygon + ' contain a code)');
    if (cal.scale) L.push('Scale: 1 unit² = ' + cal.scale.toExponential(3) + ' m², R² = ' + cal.r2.toFixed(4) + ' from ' + cal.samples + ' samples');
    else L.push('Scale: not derived — ' + cal.note);
    if (inferred && inferred.filled) L.push(inferred.filled + ' area(s) derived from the outline — marked derived, not measured');
    if (match) {
      var s = match.summary;
      L.push('Matched ' + s.matched + '/' + s.planUnits + ' plan units to inventory (' + s.byCode + ' by code, ' + s.byArea + ' by area)');
      if (s.areaMismatches) L.push('WARNING: ' + s.areaMismatches + ' unit(s) differ from the inventory area beyond tolerance');
      if (s.notOnPlan) L.push(s.notOnPlan + ' inventory row(s) are not on this plan');
      if (s.notInInventory) L.push(s.notInInventory + ' plan code(s) are not in the inventory');
    }
    if (audit && audit.length) {
      L.push('Review needed: ' + audit.filter(function (a) { return a.level === 'error'; }).length + ' error(s), ' +
             audit.filter(function (a) { return a.level === 'warn'; }).length + ' warning(s)');
    }
    return L;
  }

  return {
    DEFAULTS: DEFAULTS,
    sanitizeSvg: sanitizeSvg, sanitizeSvgDom: sanitizeSvgDom,
    readSvgLive: readSvgLive,
    inferAreas: inferAreas, auditDetection: auditDetection,
    readSvg: readSvg, readPdfPage: readPdfPage,
    detectUnits: detectUnits, calibrateScale: calibrateScale,
    matchToInventory: matchToInventory, toHotspots: toHotspots,
    recognizeSvg: recognizeSvg,
    geometry: { shoelace: shoelace, centroid: centroid, bbox: bbox, pointInPoly: pointInPoly, pathToPolys: pathToPolys }
  };
}));
