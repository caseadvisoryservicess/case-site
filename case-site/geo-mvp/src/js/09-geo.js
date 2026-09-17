/* ===========================================================================
 * 09-geo — distance, radius bands, competitive sets, point-in-polygon
 *
 * Brief §16 (location analysis) and §17 (competitive set).
 *
 * Two rules that decide whether these numbers mean anything:
 *   - Radius bands are CUMULATIVE. "Within 3 km" includes everything within
 *     1 km. Exclusive rings would make the three numbers non-comparable with
 *     how a CRE analyst actually speaks about catchments.
 *   - The subject property is EXCLUDED from its own counts. A building is not
 *     its own competitor.
 * Both are stated in the UI, because either convention is defensible and a
 * reader cannot tell which one produced a number.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema, A = GEO.analytics, F = GEO.fmt;
  var G = GEO.geo = {};

  G.EARTH_R_M = 6371008.8;           // IUGG mean radius; stated in the panel

  var RAD = Math.PI / 180;

  G.distanceM = function (aLat, aLng, bLat, bLng) {
    var p1 = aLat * RAD, p2 = bLat * RAD;
    var dp = (bLat - aLat) * RAD, dl = (bLng - aLng) * RAD;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * G.EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  G.between = function (a, b) { return G.distanceM(a.lat, a.lng, b.lat, b.lng); };

  /* ------------------------------------------------------- point in polygon */
  function inRing(x, y, ring) {
    var inside = false, n = ring.length, j = n - 1;
    for (var i = 0; i < n; i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      j = i;
    }
    return inside;
  }

  function inPolygon(x, y, rings) {
    if (!inRing(x, y, rings[0])) return false;
    for (var i = 1; i < rings.length; i++) if (inRing(x, y, rings[i])) return false;  // holes
    return true;
  }

  G.inGeometry = function (lat, lng, geometry) {
    if (!geometry) return false;
    var polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (var i = 0; i < polys.length; i++) if (inPolygon(lng, lat, polys[i])) return true;
    return false;
  };

  /** Which district actually contains this point — the basis of D1 (geometry is
   *  authoritative), and of the editor's live district check when a user drags a pin. */
  G.districtAt = function (lat, lng) {
    var ds = GEO.data.districts();
    for (var i = 0; i < ds.length; i++) {
      if (ds[i].geometry && G.inGeometry(lat, lng, ds[i].geometry)) return ds[i].key;
    }
    return null;
  };

  /* -------------------------------------------------------------- distance */
  G.withinM = function (rows, origin, metres, excludeId) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (excludeId && r.id === excludeId) continue;
      if (!U.isKnown(r.lat) || !U.isKnown(r.lng)) continue;
      var d = G.distanceM(origin.lat, origin.lng, r.lat, r.lng);
      if (d <= metres) out.push({ record: r, distanceM: d });
    }
    out.sort(function (a, b) { return a.distanceM - b.distanceM; });
    return out;
  };

  G.nearest = function (rows, origin, limit, excludeId) {
    return G.withinM(rows, origin, Infinity, excludeId).slice(0, limit || 10);
  };

  /* ------------------------------------------------------ location analysis */
  G.DEFAULT_BANDS_KM = [1, 3, 5];

  /* The competitive set is drawn from ONE band, not from the widest one. 3 km is the
     default because it is the radius §63's own worked example names ("show its
     competitors within 3 km") and because at 5 km in Tashkent a "competitor" set
     spans most of the central office market, which is a catchment, not a peer group.
     The band is a parameter, and the panel states which one produced the list. */
  G.COMPETITIVE_BAND_KM = 3;

  /**
   * §16. Returns the full analysis for one subject property.
   * Every number carries its own coverage, and anything that cannot be computed
   * says so rather than being omitted (an omitted row reads as "zero").
   */
  G.locationAnalysis = function (subject, rows, opts) {
    opts = opts || {};
    var bandsKm = opts.bandsKm || G.DEFAULT_BANDS_KM;
    var origin = { lat: subject.lat, lng: subject.lng };

    var bands = bandsKm.map(function (km) {
      var hits = G.withinM(rows, origin, km * 1000, subject.id);   // cumulative
      var inRows = hits.map(function (h) { return h.record; });
      return {
        km: km,
        count: hits.length,
        hits: hits,
        rows: inRows,
        rent: A.metric(inRows, 'askingRent', 'mean', { label: 'Average known rent', coverageLabel: 'asking rent' }),
        gla: A.metric(inRows, 'gla', 'sum', { label: 'Total known GLA', coverageLabel: 'GLA' }),
        classMix: A.byClass(inRows)
      };
    });

    var widest = bands[bands.length - 1];
    var compKm = opts.competitiveBandKm || G.COMPETITIVE_BAND_KM;
    var compBand = bands.filter(function (b) { return b.km === compKm; })[0] || widest;

    return {
      subject: subject,
      bandsKm: bandsKm,
      bands: bands,
      cumulative: true,
      subjectExcluded: true,
      earthRadiusM: G.EARTH_R_M,
      // Stated in the panel so a reader knows which convention produced the numbers.
      method: 'Great-circle (haversine) distance on a sphere of radius ' +
              F.int(G.EARTH_R_M) + ' m. Bands are cumulative – the 3 km figure includes ' +
              'everything within 1 km. The selected property is excluded from its own counts.',
      widest: widest,
      competitiveBandKm: compBand.km,
      competitiveSet: G.competitiveSet(subject, compBand.rows,
        Object.assign({}, opts, { bandKm: compBand.km }))
    };
  };

  /* ------------------------------------------------------- competitive set */
  G.CLASS_BAND = 1;              // ±1 step on the ordinal class ladder

  /**
   * §17. Proximity + class band + (where known) size band.
   *
   * Records whose class is unknown are neither silently included nor silently
   * dropped: they come back in `proximityOnly` and are counted in the label.
   * With 89% of the observed dataset missing a class, that distinction is the
   * difference between an honest suggestion and a fabricated peer group.
   */
  G.competitiveSet = function (subject, nearbyRows, opts) {
    opts = opts || {};
    var order = S.enums.officeClass;
    var subjIdx = order.indexOf(subject.officeClass);
    var haveSubjectClass = subjIdx >= 0;
    var subjGla = U.isKnown(subject.gla) ? subject.gla : null;

    var qualified = [], proximityOnly = [], excluded = [];

    nearbyRows.forEach(function (r) {
      var reasons = [];
      var dist = G.between(subject, r);
      reasons.push('within ' + (dist / 1000).toFixed(1) + ' km');

      if (!U.isKnown(r.officeClass)) {
        proximityOnly.push({ record: r, distanceM: dist,
                             reasons: reasons.concat(['office class not recorded – cannot be qualified']) });
        return;
      }
      if (!haveSubjectClass) {
        proximityOnly.push({ record: r, distanceM: dist,
                             reasons: reasons.concat(['the selected property has no recorded class to compare against']) });
        return;
      }
      var gap = Math.abs(order.indexOf(r.officeClass) - subjIdx);
      if (gap > G.CLASS_BAND) {
        excluded.push({ record: r, distanceM: dist,
                        reasons: ['class ' + r.officeClass + ' is more than one band from ' + subject.officeClass] });
        return;
      }
      reasons.push(gap === 0 ? 'same class (' + r.officeClass + ')'
                             : 'class ' + r.officeClass + ', one band from ' + subject.officeClass);

      if (subjGla !== null && U.isKnown(r.gla)) {
        var ratio = r.gla / subjGla;
        if (ratio < 0.5 || ratio > 2) {
          excluded.push({ record: r, distanceM: dist,
                          reasons: ['GLA ' + F.int(r.gla) + ' m² is outside 0.5–2× the selected property'] });
          return;
        }
        reasons.push('GLA within 0.5–2× of the selected property');
      } else if (subjGla !== null || U.isKnown(r.gla)) {
        reasons.push('size not compared – GLA not recorded for both');
      }

      qualified.push({ record: r, distanceM: dist, reasons: reasons });
    });

    qualified.sort(function (a, b) { return a.distanceM - b.distanceM; });
    proximityOnly.sort(function (a, b) { return a.distanceM - b.distanceM; });

    var manual = opts.manualAdd || [], removed = opts.manualRemove || [];
    qualified = qualified.filter(function (q) { return removed.indexOf(q.record.id) < 0; });
    manual.forEach(function (id) {
      if (qualified.some(function (q) { return q.record.id === id; })) return;
      var rec = GEO.data.get(id);
      if (!rec) return;
      qualified.push({ record: rec, distanceM: G.between(subject, rec),
                       reasons: ['added manually'], manual: true });
    });

    return {
      // §17: "Never pretend the automated competitive set is definitive."
      title: 'Suggested competitive set',
      qualified: qualified,
      proximityOnly: proximityOnly,
      excluded: excluded,
      caveat: (function () {
        var bits = [];
        if (!haveSubjectClass) {
          bits.push('The selected property has no recorded office class, so no peer could be qualified by class.');
        }
        if (proximityOnly.length) {
          bits.push(F.int(proximityOnly.length) + ' nearby ' +
                    F.plural(proximityOnly.length, 'property has', 'properties have') +
                    ' no recorded class and could not be qualified – they are listed separately, not counted as peers.');
        }
        if (subjGla === null) {
          bits.push('Building size is not recorded for the selected property, so size was not used.');
        }
        if (opts.bandKm) {
          bits.push('Drawn from properties within ' + opts.bandKm + ' km of the selected property.');
        }
        bits.push('This is a suggestion based on the data held, not a definitive peer group. Add or remove properties to reflect market knowledge.');
        return bits.join(' ');
      }())
    };
  };

  /* ------------------------------------------------------------- clusters */
  /** Simple grid clustering for "where are the office clusters?" — no invented
   *  density surface, just counts of real records per cell. */
  G.clusters = function (rows, cellKm) {
    var km = cellKm || 1;
    var dLat = km / 111.32;
    var dLng = km / (111.32 * Math.cos(41.31 * RAD));
    var cells = {};
    rows.forEach(function (r) {
      if (!U.isKnown(r.lat)) return;
      var key = Math.floor(r.lat / dLat) + ':' + Math.floor(r.lng / dLng);
      (cells[key] = cells[key] || []).push(r);
    });
    return Object.keys(cells).map(function (k) {
      var group = cells[k];
      return {
        key: k, count: group.length, rows: group,
        centre: [A.mean(group.map(function (r) { return r.lat; })),
                 A.mean(group.map(function (r) { return r.lng; }))]
      };
    }).sort(function (a, b) { return b.count - a.count; });
  };

  G.bounds = function (rows) {
    var pts = rows.filter(function (r) { return U.isKnown(r.lat) && U.isKnown(r.lng); });
    if (!pts.length) return null;
    var lats = pts.map(function (r) { return r.lat; });
    var lngs = pts.map(function (r) { return r.lng; });
    return [[Math.min.apply(null, lats), Math.min.apply(null, lngs)],
            [Math.max.apply(null, lats), Math.max.apply(null, lngs)]];
  };
}(window));
