/* ===========================================================================
 * 02-schema — the field registry, enums and validation
 *
 * ONE registry drives: the detail card, the editor form, the comparison table,
 * the filter panel, the completeness score, the coverage chart, the CSV export
 * and the assistant's field vocabulary. Adding a field here makes it appear in
 * all of them; there is no second list to keep in sync.
 *
 * Brief §5 (data model), §2.3 (provenance), §23 (refresh cadence), §36 (unknown
 * is never zero).
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util;
  var S = GEO.schema = {};

  S.VERSION = '1.0.0';

  /* --------------------------------------------------------------- enums */
  S.enums = {
    recordType: ['VERIFIED_SOURCE', 'DEMO'],

    // Ordinal, best first. Order is meaningful: the marker ramp and the
    // competitive-set "±1 class band" rule both index into this array.
    officeClass: ['A+', 'A', 'B+', 'B', 'C'],

    status: ['Operating', 'Under construction', 'Planned', 'Renovation'],

    confidence: ['High', 'Medium', 'Low', 'Unknown'],

    // §5.6 collection methods
    method: ['public website', 'owner/developer', 'broker', 'field visit',
             'phone verification', 'public registry', 'map service',
             'uploaded document', 'manual edit (prototype)', 'other'],

    qcStatus: ['unreviewed', 'needs_check', 'accepted', 'rejected'],

    collectionStatus: ['not_collected', 'partial', 'complete', 'confirmed_empty'],

    entityReview: ['unreviewed', 'confirmed_bc', 'suspected_non_bc', 'name_quality'],

    duplicateVerdict: ['undecided', 'same_building', 'different_buildings'],

    amenity: ['restaurant', 'cafe', 'retail', 'gym', 'conference room', 'reception',
              'security', 'underground parking', 'surface parking', 'EV charging',
              'bicycle parking', 'backup generator'],

    tenantIndustry: ['Financial services', 'IT & software', 'Professional services',
                     'Energy', 'Transport & logistics', 'Wholesale & retail',
                     'Government & public', 'Healthcare', 'Education',
                     'Manufacturing', 'Telecoms & media', 'Other']
  };

  /* ------------------------------------------------------------ registry */
  /* group        which section of the detail card / editor the field belongs to
   * type         number | integer | text | enum | enumList | tenantList | coord | year
   * unit         display unit, null when unitless
   * refresh      fast | slow | stable  (§23 — drives nextRefreshAt)
   * critical     counts toward the "missing critical data" indicator (§19)
   * filterable   the filter engine may expose it (it still disables itself at 0 coverage)
   * compare      appears as a row in the §15 comparison table
   * aiName       the token the assistant's intent parser accepts for this field
   */
  function f(key, o) { o.key = key; return o; }

  S.fields = [
    /* --- identification (§5.1) --- */
    f('name',        { group: 'identification', label: 'Property name', type: 'text', refresh: 'stable', required: true, aiName: 'name' }),
    f('altNames',    { group: 'identification', label: 'Alternative / former names', type: 'textList', refresh: 'stable' }),
    f('status',      { group: 'identification', label: 'Status', type: 'enum', enumKey: 'status', refresh: 'fast', critical: true, filterable: true, compare: true, aiName: 'status' }),
    f('address',     { group: 'identification', label: 'Address', type: 'text', refresh: 'stable' }),
    f('districtKey', { group: 'identification', label: 'District', type: 'district', refresh: 'stable', required: true, filterable: true, compare: true, aiName: 'district' }),
    f('lat',         { group: 'identification', label: 'Latitude', type: 'coord', refresh: 'stable', required: true }),
    f('lng',         { group: 'identification', label: 'Longitude', type: 'coord', refresh: 'stable', required: true }),

    /* --- property (§5.2) --- */
    f('officeClass',       { group: 'property', label: 'Office class', type: 'enum', enumKey: 'officeClass', refresh: 'slow', critical: true, filterable: true, compare: true, aiName: 'class' }),
    f('yearOpened',        { group: 'property', label: 'Year opened', type: 'year', refresh: 'slow', critical: true, compare: true, aiName: 'year' }),
    f('yearRenovated',     { group: 'property', label: 'Year renovated', type: 'year', refresh: 'slow' }),
    f('floors',            { group: 'property', label: 'Floors', type: 'integer', refresh: 'slow', critical: true, compare: true, aiName: 'floors' }),
    f('gba',               { group: 'property', label: 'GBA', type: 'number', unit: 'm²', refresh: 'slow', compare: true, aiName: 'gba' }),
    f('gla',               { group: 'property', label: 'GLA', type: 'number', unit: 'm²', refresh: 'slow', critical: true, filterable: true, compare: true, aiName: 'gla' }),
    f('typicalFloorPlate', { group: 'property', label: 'Typical floor plate', type: 'number', unit: 'm²', refresh: 'slow' }),
    f('parkingSpaces',     { group: 'property', label: 'Parking spaces', type: 'integer', refresh: 'slow', critical: true, filterable: true, compare: true, aiName: 'parking' }),
    f('parkingRatio',      { group: 'property', label: 'Parking ratio', type: 'number', unit: 'spaces/m²', refresh: 'slow' }),
    f('developer',         { group: 'property', label: 'Developer', type: 'text', refresh: 'slow' }),
    f('owner',             { group: 'property', label: 'Owner', type: 'text', refresh: 'slow' }),
    f('operator',          { group: 'property', label: 'Operator / management', type: 'text', refresh: 'slow' }),

    /* --- commercial (§5.3) --- */
    f('askingRent',    { group: 'commercial', label: 'Asking rent', type: 'number', unit: 'USD/m²/month', refresh: 'fast', critical: true, filterable: true, compare: true, aiName: 'rent' }),
    f('currency',      { group: 'commercial', label: 'Currency', type: 'text', refresh: 'fast' }),
    f('rentUnit',      { group: 'commercial', label: 'Rent unit', type: 'text', refresh: 'fast' }),
    f('serviceCharge', { group: 'commercial', label: 'Service charge', type: 'number', unit: 'USD/m²/month', refresh: 'fast', compare: true }),
    f('vatTreatment',  { group: 'commercial', label: 'VAT treatment', type: 'text', refresh: 'slow' }),
    f('occupancyPct',  { group: 'commercial', label: 'Occupancy', type: 'number', unit: '%', refresh: 'fast', filterable: true, compare: true, aiName: 'occupancy' }),
    f('vacancyPct',    { group: 'commercial', label: 'Vacancy', type: 'number', unit: '%', refresh: 'fast', critical: true, filterable: true, compare: true, aiName: 'vacancy' }),
    f('availableArea', { group: 'commercial', label: 'Available area', type: 'number', unit: 'm²', refresh: 'fast', filterable: true, compare: true, aiName: 'available' }),
    f('minUnit',       { group: 'commercial', label: 'Minimum unit', type: 'number', unit: 'm²', refresh: 'fast' }),
    f('leaseTerms',    { group: 'commercial', label: 'Lease terms', type: 'text', refresh: 'fast' }),

    /* --- tenants & amenities (§5.4, §5.5) --- */
    f('tenants',   { group: 'tenants',   label: 'Tenants', type: 'tenantList', refresh: 'fast', compare: true, statusField: 'tenantsStatus' }),
    f('amenities', { group: 'amenities', label: 'Amenities', type: 'enumList', enumKey: 'amenity', refresh: 'slow', filterable: true, compare: true, statusField: 'amenitiesStatus', aiName: 'amenities' })
  ];

  S.byKey = {};
  S.fields.forEach(function (fd) { S.byKey[fd.key] = fd; });

  S.field = function (key) { return S.byKey[key] || null; };
  S.label = function (key) { return (S.byKey[key] || {}).label || key; };

  S.criticalFields = S.fields.filter(function (fd) { return fd.critical; })
                             .map(function (fd) { return fd.key; });
  S.compareFields  = S.fields.filter(function (fd) { return fd.compare; })
                             .map(function (fd) { return fd.key; });
  S.filterFields   = S.fields.filter(function (fd) { return fd.filterable; })
                             .map(function (fd) { return fd.key; });

  S.groups = [
    { key: 'identification', label: 'Overview' },
    { key: 'property',       label: 'Building' },
    { key: 'commercial',     label: 'Commercial' },
    { key: 'tenants',        label: 'Tenants' },
    { key: 'amenities',      label: 'Amenities' }
  ];

  S.fieldsIn = function (group) {
    return S.fields.filter(function (fd) { return fd.group === group; });
  };

  /* ------------------------------------------------- district aliases */
  /* The source file, the boundary file and everyday Russian usage spell the same
     districts three different ways (Mirabad / Mirobod / Мирабад). One table, used by
     the search box, the assistant's district slot and the importer — a second,
     divergent list is how "Mirabad" ends up finding nothing while the map shows 28
     records there. Keys are canonical; values are every spelling seen in the wild. */
  S.districtAliases = {
    mirobod:        ['mirobod', 'mirabad', 'mirabadsky', 'мирабад', 'мирабадский', 'миробод'],
    'mirzo-ulugbek':['mirzo ulugbek', 'mirzo-ulugbek', 'mirzo ulug\'bek', 'мирзо-улугбек', 'мирзо улугбек', 'мирзо улуғбек'],
    yakkasaroy:     ['yakkasaroy', 'yakkasaray', 'яккасарай', 'яккасарой'],
    yunusobod:      ['yunusobod', 'yunusabad', 'юнусабад', 'юнусобод'],
    yashnobod:      ['yashnobod', 'yashnabad', 'яшнабад', 'яшнобод'],
    chilonzor:      ['chilonzor', 'chilanzar', 'чиланзар', 'чилонзор'],
    shayxontohur:   ['shayxontohur', 'shaykhantakhur', 'shaykhantahur', 'шайхантахур', 'шайҳонтохур'],
    sergeli:        ['sergeli', 'сергели'],
    olmazor:        ['olmazor', 'almazar', 'алмазар', 'алмазарский', 'олмазор'],
    uchtepa:        ['uchtepa', 'учтепа'],
    yangihayot:     ['yangihayot', 'yangihayat', 'янгихаёт', 'янгихает'],
    bektemir:       ['bektemir', 'бектемир']
  };

  S.districtKeyFor = function (text) {
    var t = String(text || '').toLowerCase().replace(/[\s-]+/g, ' ').trim();
    var keys = Object.keys(S.districtAliases);
    for (var i = 0; i < keys.length; i++) {
      var list = S.districtAliases[keys[i]];
      for (var j = 0; j < list.length; j++) {
        if (list[j].replace(/[\s-]+/g, ' ') === t) return keys[i];
      }
    }
    return null;
  };

  /* --------------------------------------------------- refresh / staleness */
  /* §23: not everything needs the same refresh cadence. These are ASSUMPTIONS,
     exposed in Settings so the product decision can be tested, not hidden. */
  S.refreshDays = { fast: 60, slow: 365, stable: 1095 };

  /* A field is "ageing" once this fraction of its interval has elapsed — it gives
     the indicator a visible middle state instead of flipping fresh→stale overnight. */
  S.AGEING_AT = 0.7;

  S.nextRefresh = function (lastVerifiedAt, fieldKey) {
    var fd = S.byKey[fieldKey];
    var cls = (fd && fd.refresh) || 'slow';
    return GEO.date.addDays(lastVerifiedAt, S.refreshDays[cls]);
  };

  /** 'fresh' | 'ageing' | 'stale' | 'unknown' — computed, never stored (D8). */
  S.freshness = function (lastVerifiedAt, fieldKey, today) {
    if (!U.isKnown(lastVerifiedAt)) return 'unknown';
    var fd = S.byKey[fieldKey];
    var span = S.refreshDays[(fd && fd.refresh) || 'slow'];
    var age = GEO.date.daysBetween(lastVerifiedAt, today || GEO.date.today());
    if (age === null) return 'unknown';
    if (age > span) return 'stale';
    if (age >= span * S.AGEING_AT) return 'ageing';
    return 'fresh';
  };

  /* ----------------------------------------------------------- validation */
  /* Bounds derived from the real data extent plus a margin, not from taste:
     the 148 observed records span lat 41.2207–41.3704, lng 69.1791–69.3623. */
  S.bounds = { latMin: 41.13, latMax: 41.42, lngMin: 69.09, lngMax: 69.45 };

  S.sanity = {
    askingRent:   { min: 1,  max: 500, unit: 'USD/m²/month' },
    serviceCharge:{ min: 0,  max: 100, unit: 'USD/m²/month' },
    occupancyPct: { min: 0,  max: 100, unit: '%' },
    vacancyPct:   { min: 0,  max: 100, unit: '%' },
    floors:       { min: 1,  max: 150, unit: 'floors' },
    gla:          { min: 50, max: 500000, unit: 'm²' },
    gba:          { min: 50, max: 800000, unit: 'm²' },
    yearOpened:   { min: 1900, max: 2100, unit: '' },
    yearRenovated:{ min: 1900, max: 2100, unit: '' }
  };

  /**
   * Validate a record. Returns { errors: [], warnings: [] }.
   * ERRORS block a save (the record would be unusable or un-mappable).
   * WARNINGS never block — a surprising-but-real value must remain enterable,
   * because the platform's job is to record the market, not to argue with it.
   */
  S.validate = function (rec, ctx) {
    var errors = [], warnings = [];
    function err(field, msg) { errors.push({ field: field, message: msg }); }
    function warn(field, msg) { warnings.push({ field: field, message: msg }); }

    if (!U.isKnown(rec.name)) err('name', 'A property name is required.');

    if (!U.isKnown(rec.recordType) || S.enums.recordType.indexOf(rec.recordType) < 0) {
      // No default. A record whose kind we cannot establish must never be
      // silently treated as observed market data (D4).
      err('recordType', 'recordType must be VERIFIED_SOURCE or DEMO.');
    }

    ['lat', 'lng'].forEach(function (k) {
      if (!U.isKnown(rec[k]) || typeof rec[k] !== 'number' || isNaN(rec[k])) {
        err(k, S.label(k) + ' is required and must be a number.');
      }
    });
    if (typeof rec.lat === 'number' && typeof rec.lng === 'number') {
      var b = S.bounds;
      if (rec.lat < b.latMin || rec.lat > b.latMax || rec.lng < b.lngMin || rec.lng > b.lngMax) {
        err('lat', 'Coordinates are outside Tashkent (expected ' + b.latMin + '–' + b.latMax +
                   ' N, ' + b.lngMin + '–' + b.lngMax + ' E). Check for swapped or mistyped values.');
      }
    }

    if (U.isKnown(rec.districtKey) && ctx && ctx.districtKeys &&
        ctx.districtKeys.indexOf(rec.districtKey) < 0) {
      err('districtKey', 'Unknown district "' + rec.districtKey + '".');
    }

    Object.keys(S.sanity).forEach(function (k) {
      var v = rec[k], s = S.sanity[k];
      if (!U.isKnown(v)) return;                       // unknown is always allowed
      if (typeof v !== 'number' || isNaN(v)) { err(k, S.label(k) + ' must be a number.'); return; }
      if (v < s.min || v > s.max) {
        warn(k, S.label(k) + ' of ' + v + ' ' + s.unit + ' is outside the expected range ' +
                s.min + '–' + s.max + '. Saved as entered — confirm the source.');
      }
    });

    if (U.isKnown(rec.gla) && U.isKnown(rec.gba) && rec.gla > rec.gba) {
      warn('gla', 'GLA (' + rec.gla + ') exceeds GBA (' + rec.gba + '). Lettable area is normally smaller than gross area.');
    }

    if (U.isKnown(rec.occupancyPct) && U.isKnown(rec.vacancyPct)) {
      var sum = rec.occupancyPct + rec.vacancyPct;
      if (Math.abs(sum - 100) > 0.5) {
        warn('vacancyPct', 'Occupancy + vacancy = ' + sum + '%, not 100%. Both saved as entered.');
      }
    }

    if (U.isKnown(rec.availableArea) && U.isKnown(rec.gla) && rec.availableArea > rec.gla) {
      warn('availableArea', 'Available area exceeds GLA.');
    }

    if (U.isKnown(rec.officeClass) && S.enums.officeClass.indexOf(rec.officeClass) < 0) {
      err('officeClass', 'Office class must be one of ' + S.enums.officeClass.join(', ') + ', or left unrecorded.');
    }
    if (U.isKnown(rec.status) && S.enums.status.indexOf(rec.status) < 0) {
      err('status', 'Status must be one of ' + S.enums.status.join(', ') + ', or left unrecorded.');
    }

    return { errors: errors, warnings: warnings, ok: errors.length === 0 };
  };

  /**
   * Coerce one editor input into the canonical stored type.
   * Returns { value, error }. An empty input is UNKNOWN (null) — never 0, never ''.
   * This is the single choke point where "" would otherwise become 0 (§36).
   */
  S.coerce = function (fieldKey, raw) {
    var fd = S.byKey[fieldKey];
    if (!fd) return { value: null, error: 'Unknown field ' + fieldKey };

    if (raw === null || raw === undefined) return { value: null };
    if (typeof raw === 'string' && raw.trim() === '') return { value: null };

    switch (fd.type) {
      case 'number':
      case 'coord': {
        // Accept "34,8" (comma decimal, common in RU/UZ input) and "$34.8 /m2".
        var t = String(raw).trim().replace(/\s/g, '').replace(/^[$€₽]/, '').replace(',', '.');
        t = t.replace(/[^0-9.\-]/g, '');
        var n = parseFloat(t);
        if (isNaN(n)) return { value: null, error: S.label(fieldKey) + ': "' + raw + '" is not a number.' };
        return { value: n };
      }
      case 'integer':
      case 'year': {
        var i = parseInt(String(raw).replace(/[^0-9\-]/g, ''), 10);
        if (isNaN(i)) return { value: null, error: S.label(fieldKey) + ': "' + raw + '" is not a whole number.' };
        return { value: i };
      }
      case 'enum': {
        var allowed = S.enums[fd.enumKey] || [];
        var hit = allowed.filter(function (a) {
          return a.toLowerCase() === String(raw).trim().toLowerCase();
        })[0];
        return hit ? { value: hit }
                   : { value: null, error: S.label(fieldKey) + ': "' + raw + '" is not one of ' + allowed.join(', ') };
      }
      case 'enumList':
      case 'textList':
        return { value: Array.isArray(raw) ? raw.slice()
                                           : String(raw).split(',').map(function (s) { return s.trim(); })
                                                        .filter(Boolean) };
      case 'tenantList':
        return { value: Array.isArray(raw) ? raw.slice() : [] };
      default:
        return { value: String(raw).trim() };
    }
  };

  /** A record with every key present and every value unknown. The full key set is
   *  always emitted so that `null` means "unknown", never "the key is missing". */
  S.blank = function () {
    var r = {
      id: null, recordType: 'VERIFIED_SOURCE',
      tenantsStatus: 'not_collected', amenitiesStatus: 'not_collected',
      _evidence: {}, _meta: {}, _history: {}
    };
    S.fields.forEach(function (fd) {
      r[fd.key] = (fd.type === 'enumList' || fd.type === 'textList' || fd.type === 'tenantList') ? [] : null;
    });
    r.currency = null;
    r.rentUnit = null;
    return r;
  };
}(window));
