/* ===========================================================================
 * 01-i18n — the string table and the accessor
 *
 * Build contract D14: this build ships English only, but 100% of the strings a
 * user can read live in ONE table. That is the whole point — adding Russian or
 * Uzbek later is data entry into `GEO.i18n.ru` / `.uz`, not a hunt through
 * twenty modules for literals.
 *
 * Flat dot-path keys, not nested objects, because the coverage check, the
 * missing-key lint and a translator's spreadsheet are then each one line, and
 * there is no question of how a half-filled nested branch merges with its
 * fallback (03-information-architecture.md §9.1).
 *
 * Two rules the copy itself obeys, and they are why several strings are longer
 * than a designer would like:
 *   - an empty state names the CAUSE and offers the ESCAPE (IA §7);
 *   - a disabled control states WHY it is disabled (§29), so the reason string
 *     lives next to the label here rather than being improvised at the call site.
 *
 * Scope, stated honestly: this covers UI chrome only. Property names and
 * addresses are data, are largely Cyrillic, and are never machine-translated.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO;
  var I = GEO.i18n = {};

  I.DEFAULT_LOCALE = 'en';
  I.locale = 'en';

  /* A locale is offered to the user only once it is essentially complete.
     Below that the menu entry renders disabled with the live percentage: a
     language button that silently produces English is a fake control (§29). */
  I.MIN_COVERAGE = 0.95;

  /* Per-key fallback, not per-locale. A half-translated table never produces a
     blank string — it produces the English one for the keys it is missing. */
  I.fallbackChain = { en: [], ru: ['en'], uz: ['ru', 'en'] };

  I.localeNames = { en: 'English', ru: 'Русский', uz: 'Oʻzbekcha' };

  /* =========================================================================
   * THE TABLE
   * Key convention: <area>.<component>.<element>[.<state>]
   * `field.*` and `value.*` are reserved for schema field labels and shared
   * enum values so one label is never defined in two places.
   * ======================================================================= */

  I.en = {

    /* ------------------------------------------------------------ common */
    'common.ok': 'OK',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.close': 'Close',
    'common.apply': 'Apply',
    'common.clear': 'Clear',
    'common.reset': 'Reset',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.undo': 'Undo',
    'common.redo': 'Redo',
    'common.restore': 'Restore',
    'common.retry': 'Retry',
    'common.dismiss': 'Dismiss',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.print': 'Print',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.search': 'Search',
    'common.select': 'Select',
    'common.selected': 'Selected',
    'common.expand': 'Expand',
    'common.collapse': 'Collapse',
    'common.showMore': 'Show more',
    'common.showLess': 'Show less',
    'common.more': 'More',
    'common.back': 'Back',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.min': 'Minimum',
    'common.max': 'Maximum',
    'common.from': 'From',
    'common.to': 'To',
    'common.range': '{from} to {to}',
    'common.of': '{n} of {m}',
    'common.notRecorded': 'Not recorded',
    'common.unknown': 'Unknown',
    'common.none': 'None',
    'common.all': 'All',
    'common.error': 'Error',
    'common.warning': 'Warning',
    'common.note': 'Note',
    'common.source': 'Source',
    'common.sources': 'Sources',
    'common.updated': 'Updated {date}',
    'common.daysAgo': '{n} days ago',
    'common.count.properties.one': '{n} property',
    'common.count.properties.other': '{n} properties',
    'common.count.records.one': '{n} record',
    'common.count.records.other': '{n} records',
    'common.count.results.one': '{n} result',
    'common.count.results.other': '{n} results',
    'common.count.sources.one': '{n} source',
    'common.count.sources.other': '{n} sources',
    'common.coverage': 'Based on {n} of {m} properties with verified {field}.',
    'common.coverage.one': 'Based on {n} of {m} property with verified {field}.',
    'common.coverage.zero': 'No properties in the current selection have verified {field}.',
    'common.coverage.empty': 'No properties in the current selection.',
    'common.coverage.all': 'All {m} properties in the current selection.',
    'common.insufficient': 'Insufficient verified data',
    'common.insufficient.body': 'A mean or median needs at least {min} recorded values. This selection has {n}.',
    'common.unweighted': 'per property, unweighted',
    'common.assumedUnit': 'Unit assumed USD/m²/month — not stated by the source.',
    'common.notInThisVersion': 'Not in this version',
    'common.notInPrototype': 'Not available in this prototype',
    'common.requiresBackend': 'Requires confirmation and a backend — not available in the prototype',
    'common.appliedByAssistant': 'Applied by the assistant',
    'common.demo.badge': 'DEMO',
    'common.demo.banner.title': 'DEMO DATA ACTIVE',
    'common.demo.banner.body': 'Figures on screen may include synthetic records and are not market evidence.',
    'common.demo.banner.off': 'Turn off demo records',
    'common.demo.included': 'Includes {n} demo records.',
    'common.nav.map': 'Map',
    'common.nav.list': 'List',
    'common.nav.analytics': 'Analytics',
    'common.nav.ai': 'Assistant',
    'common.nav.data': 'Data',

    /* ------------------------------------------------------------- units */
    'unit.sqm': 'm²',
    'unit.usdSqmMonth': 'USD/m²/month',
    'unit.usdSqmMonth.short': '$/m²/mo',
    'unit.pct': '%',
    'unit.km': 'km',
    'unit.m': 'm',
    'unit.metres': '{n} m',
    'unit.kilometres': '{n} km',
    'unit.floors': 'floors',
    'unit.spaces': 'spaces',
    'unit.spacesPerSqm': 'spaces/m²',
    'unit.year': 'year',

    /* ----------------------------------------------- schema field labels */
    'field.name': 'Property name',
    'field.altNames': 'Alternative or former names',
    'field.status': 'Status',
    'field.address': 'Address',
    'field.districtKey': 'District',
    'field.lat': 'Latitude',
    'field.lng': 'Longitude',
    'field.coordinates': 'Coordinates',
    'field.officeClass': 'Office class',
    'field.yearOpened': 'Year opened',
    'field.yearRenovated': 'Year renovated',
    'field.floors': 'Floors',
    'field.gba': 'GBA',
    'field.gla': 'GLA',
    'field.typicalFloorPlate': 'Typical floor plate',
    'field.parkingSpaces': 'Parking spaces',
    'field.parkingRatio': 'Parking ratio',
    'field.developer': 'Developer',
    'field.owner': 'Owner',
    'field.operator': 'Operator or management',
    'field.askingRent': 'Asking rent',
    'field.currency': 'Currency',
    'field.rentUnit': 'Rent unit',
    'field.serviceCharge': 'Service charge',
    'field.vatTreatment': 'VAT treatment',
    'field.occupancyPct': 'Occupancy',
    'field.vacancyPct': 'Vacancy',
    'field.availableArea': 'Available area',
    'field.minUnit': 'Minimum unit',
    'field.leaseTerms': 'Lease terms',
    'field.tenants': 'Tenants',
    'field.amenities': 'Amenities',
    'field.tenantsStatus': 'Tenant data status',
    'field.amenitiesStatus': 'Amenity data status',
    'field.confidence': 'Data confidence',
    'field.lastVerifiedAt': 'Last verified',
    'field.collectedAt': 'Collected',
    'field.sourceUrl': 'Source URL',
    'field.sourceName': 'Source',
    'field.method': 'Collection method',
    'field.notes': 'Notes',
    'field.recordId': 'Record ID',
    'field.recordType': 'Record type',
    'field.gla.help': 'Gross lettable area — the area a tenant pays for.',
    'field.gba.help': 'Gross building area — the total constructed area.',
    'field.askingRent.help': 'Headline asking rent. The source does not state the unit; USD/m²/month is assumed.',
    'field.parkingRatio.help': 'Parking spaces divided by lettable area.',

    /* ------------------------------------------------------ enum values */
    'value.class.aPlus': 'A+',
    'value.class.a': 'A',
    'value.class.bPlus': 'B+',
    'value.class.b': 'B',
    'value.class.c': 'C',
    'value.class.unknown': 'Class not recorded',
    'value.status.operating': 'Operating',
    'value.status.construction': 'Under construction',
    'value.status.planned': 'Planned',
    'value.status.renovation': 'Renovation',
    'value.status.unknown': 'Status not recorded',
    'value.confidence.high': 'High',
    'value.confidence.medium': 'Medium',
    'value.confidence.low': 'Low',
    'value.confidence.unknown': 'Not verified',
    'value.completeness.good': 'Good',
    'value.completeness.partial': 'Partial',
    'value.completeness.minimal': 'Minimal',
    'value.completeness.none': 'None',
    'value.freshness.fresh': 'Fresh',
    'value.freshness.ageing': 'Ageing',
    'value.freshness.stale': 'Stale',
    'value.freshness.unknown': 'Never verified',
    'value.collection.notCollected': 'Not collected',
    'value.collection.partial': 'Partly collected',
    'value.collection.complete': 'Complete',
    'value.collection.confirmedEmpty': 'Confirmed empty',
    'value.entity.unreviewed': 'Unreviewed',
    'value.entity.confirmedBc': 'Confirmed business centre',
    'value.entity.suspectedNonBc': 'Suspected non-office entity',
    'value.entity.nameQuality': 'Name needs checking',
    'value.verdict.undecided': 'Undecided',
    'value.verdict.same': 'Same building',
    'value.verdict.different': 'Different buildings',
    'value.recordType.verified': 'Observed record',
    'value.recordType.demo': 'Demo record',
    'value.method.website': 'Public website',
    'value.method.owner': 'Owner or developer',
    'value.method.broker': 'Broker',
    'value.method.fieldVisit': 'Field visit',
    'value.method.phone': 'Phone verification',
    'value.method.registry': 'Public registry',
    'value.method.mapService': 'Map service',
    'value.method.document': 'Uploaded document',
    'value.method.manualEdit': 'Manual edit (prototype)',
    'value.method.other': 'Other',
    'value.amenity.restaurant': 'Restaurant',
    'value.amenity.cafe': 'Cafe',
    'value.amenity.retail': 'Retail',
    'value.amenity.gym': 'Gym',
    'value.amenity.conference': 'Conference room',
    'value.amenity.reception': 'Reception',
    'value.amenity.security': 'Security',
    'value.amenity.undergroundParking': 'Underground parking',
    'value.amenity.surfaceParking': 'Surface parking',
    'value.amenity.evCharging': 'EV charging',
    'value.amenity.bicycleParking': 'Bicycle parking',
    'value.amenity.generator': 'Backup generator',
    'value.industry.financial': 'Financial services',
    'value.industry.it': 'IT and software',
    'value.industry.professional': 'Professional services',
    'value.industry.energy': 'Energy',
    'value.industry.transport': 'Transport and logistics',
    'value.industry.retail': 'Wholesale and retail',
    'value.industry.government': 'Government and public',
    'value.industry.healthcare': 'Healthcare',
    'value.industry.education': 'Education',
    'value.industry.manufacturing': 'Manufacturing',
    'value.industry.telecoms': 'Telecoms and media',
    'value.industry.other': 'Other',

    /* ------------------------------------------------------ header (R1) */
    'hdr.skip': 'Skip to the results list',
    'hdr.brand.workingTitle': 'WORKING TITLE',
    'hdr.brand.workingTitle.reason': 'Product name not final',
    'hdr.city.label': 'City',
    'hdr.city.menu': 'Choose a city',
    'hdr.city.tashkent': 'Tashkent',
    'hdr.city.samarkand': 'Samarkand',
    'hdr.city.bukhara': 'Bukhara',
    'hdr.city.fergana': 'Fergana',
    'hdr.city.andijan': 'Andijan',
    'hdr.city.namangan': 'Namangan',
    'hdr.city.note': 'Additional cities are supported by the data model but are not loaded in this prototype.',
    'hdr.type.label': 'Property type',
    'hdr.type.menu': 'Choose a property type',
    'hdr.type.businessCentres': 'Business Centres',
    'hdr.type.shoppingCentres': 'Shopping Centres',
    'hdr.type.streetRetail': 'Street Retail',
    'hdr.type.warehouse': 'Warehouse',
    'hdr.type.hotel': 'Hotel',
    'hdr.type.land': 'Land',
    'hdr.type.mixedUse': 'Mixed-use',
    'hdr.type.note': 'Other asset types are supported by the data model but are not loaded in this prototype.',
    'hdr.search.label': 'Search properties, districts and tenants',
    'hdr.search.placeholder': 'Search name, address, district…',
    'hdr.search.clear': 'Clear search',
    'hdr.search.group.properties': 'Properties',
    'hdr.search.group.districts': 'Districts',
    'hdr.search.seeAll': 'See all {n} results',
    'hdr.search.hint': 'Search covers property name, address, district and tenant.',
    'hdr.search.scripts': 'Cyrillic and Latin spellings both match.',
    'hdr.search.resultDistrict': '{name} — {n} properties',
    'hdr.data.aria': 'Dataset coverage summary. Opens the data workspace.',
    'hdr.data.summary': '{records} records · {sources} · updated {date} · {verified} field-verified',
    'hdr.data.edited': ' · {n} locally edited',
    'hdr.data.tooltip': 'Records: rows in the dataset. Sources: distinct collection sources. Updated: the most recent collection date. Field-verified: fields re-checked against a second source.',
    'hdr.analytics': 'Analytics',
    'hdr.ai': 'Assistant',
    'hdr.ai.unread': 'New assistant response',
    'hdr.data': 'Data',
    'hdr.data.hiddenExternal': 'The data workspace is hidden in the External role.',
    'hdr.settings': 'Settings',
    'hdr.lang.code': 'EN',
    'hdr.lang.menu': 'Language',
    'hdr.lang.disabled': 'Translation {pct}% — English only in this build',
    'hdr.lang.partial': 'Translation {pct}% — a locale is offered at {min}%',
    'hdr.lang.note': 'Interface text only. Property names and addresses are shown in their source script and are never machine-translated.',

    /* ------------------------------------------------ settings popover */
    'hdr.settings.title': 'Settings',
    'hdr.settings.language': 'Language',
    'hdr.settings.role': 'Role',
    'hdr.settings.role.internal': 'Internal',
    'hdr.settings.role.external': 'External',
    'hdr.settings.role.note': 'A product model, not a permission system. It hides internal fields and tools in the interface; it does not secure them.',
    'hdr.settings.role.banner': 'External (client preview) — internal data hidden',
    'hdr.settings.motion': 'Motion',
    'hdr.settings.motion.system': 'Match system',
    'hdr.settings.motion.reduce': 'Reduce',
    'hdr.settings.motion.full': 'Full',
    'hdr.settings.marker': 'Map marker encoding',
    'hdr.settings.marker.class': 'Office class',
    'hdr.settings.marker.confidence': 'Data confidence',
    'hdr.settings.marker.completeness': 'Completeness',
    'hdr.settings.refresh': 'Refresh intervals',
    'hdr.settings.refresh.note': 'Assumptions, not policy: fast fields {fast} days, slow fields {slow} days, stable fields {stable} days.',
    'hdr.settings.demo': 'Demo records',
    'hdr.settings.shortcuts': 'Keyboard shortcuts',
    'hdr.settings.about': 'About',
    'hdr.settings.about.prototype': 'Prototype — not a production system.',
    'hdr.settings.about.version': 'Version {version}',
    'hdr.settings.about.schema': 'Schema version {version}',
    'hdr.settings.about.build': 'Build {build}',
    'hdr.settings.about.dataset': 'Dataset: {records} records from {sources}, collected {date}.',

    /* ------------------------------------------------ shortcuts dialog */
    'hdr.shortcuts.title': 'Keyboard shortcuts',
    'hdr.shortcuts.search': 'Focus the search field',
    'hdr.shortcuts.esc': 'Close the topmost panel, dialog or selection',
    'hdr.shortcuts.leftRail': 'Show or hide the filter panel',
    'hdr.shortcuts.view': 'Switch between map and map with list',
    'hdr.shortcuts.rightTabs': 'Property, Analytics, Assistant, Layers',
    'hdr.shortcuts.compare': 'Open the comparison',
    'hdr.shortcuts.dataWorkspace': 'Open the data workspace',
    'hdr.shortcuts.resetView': 'Reset the map view',
    'hdr.shortcuts.help': 'Show this list',
    'hdr.shortcuts.undo': 'Undo the last data edit',
    'hdr.shortcuts.redo': 'Redo the last data edit',
    'hdr.shortcuts.send': 'Send the assistant prompt',
    'hdr.shortcuts.listMove': 'Move through the results list',
    'hdr.shortcuts.mapPan': 'Pan the map, plus and minus zoom',
    'hdr.shortcuts.note': 'Single-letter shortcuts are ignored while you are typing in a field.',

    /* -------------------------------------------------- filters (R2) */
    'filter.tab': 'Filters',
    'filter.tab.aiChanged': 'Changed by the assistant',
    'filter.title': 'Filters',
    'filter.collapse': 'Collapse the filter panel',
    'filter.expand': 'Expand the filter panel',
    'filter.results.count.one': '{n} property found',
    'filter.results.count.other': '{n} properties found',
    'filter.results.ofTotal': '{n} of {m} properties',
    'filter.excluded.class': '{n} properties excluded — office class not recorded',
    'filter.excluded.rent': '{n} properties excluded — asking rent not recorded',
    'filter.excluded.nonBc': '{n} records hidden — suspected non-office entity',
    'filter.excluded.demo': 'Demo records are excluded. Turn them on in Settings to include them.',
    'filter.disabled.coverage': '{n} of {m} records have a recorded {field}',
    'filter.disabled.zero': '0 of {m} records have a recorded {field}. This filter enables itself as soon as one does.',
    'filter.name.label': 'Property name',
    'filter.name.placeholder': 'Name or former name',
    'filter.district.label': 'District',
    'filter.district.option': '{name} ({n})',
    'filter.district.zero': 'A recorded zero — the district is in the dataset and holds no records.',
    'filter.district.note': 'District is computed from the official 2024 boundary, not from the source label.',
    'filter.class.label': 'Office class',
    'filter.class.unknown': 'Class not recorded ({n})',
    'filter.class.note': 'The five graded options exclude records with no recorded class. Use the sixth option to find them.',
    'filter.status.label': 'Building status',
    'filter.rent.label': 'Asking rent',
    'filter.rent.note': 'Asking rent is recorded for {n} of {m} properties. The {excluded} without a recorded rent are excluded by this filter.',
    'filter.rent.min': 'Minimum rent',
    'filter.rent.max': 'Maximum rent',
    'filter.rent.unit': 'USD/m²/month (assumed)',
    'filter.gla.label': 'GLA',
    'filter.gla.min': 'Minimum GLA',
    'filter.gla.max': 'Maximum GLA',
    'filter.occupancy.label': 'Occupancy and vacancy',
    'filter.parking.label': 'Minimum parking spaces',
    'filter.amenities.label': 'Amenities',
    'filter.confidence.label': 'Data confidence',
    'filter.confidence.note': 'Confidence is held per field. This filters on the confidence of the record’s identifying fields.',
    'filter.completeness.label': 'Record completeness',
    'filter.completeness.good': 'Good — 6 to 8 critical fields ({n})',
    'filter.completeness.partial': 'Partial — 3 to 5 critical fields ({n})',
    'filter.completeness.minimal': 'Minimal — 1 or 2 critical fields ({n})',
    'filter.completeness.none': 'None — no critical fields ({n})',
    'filter.completeness.note': 'Counted over the {m} critical fields, not as a percentage: at this coverage a percentage puts every record in one bucket.',
    'filter.freshness.label': 'Data freshness',
    'filter.freshness.note': 'Every observed record shares one collection date, so this cannot separate them yet.',
    'filter.dupes.label': 'Only possible duplicates',
    'filter.dupes.note': '{n} records sit in {g} coordinate-collision groups. Nothing is merged automatically.',
    'filter.dupes.review': 'Review duplicates',
    'filter.conflict.label': 'Only district-label conflicts',
    'filter.conflict.note': '{n} records where the source label disagrees with the official boundary.',
    'filter.nonBc.label': 'Exclude suspected non-office records',
    'filter.nonBc.note': 'Off by default: {n} records are flagged, and hiding them would change every headline count without saying so.',
    'filter.edited.label': 'Only locally edited records',
    'filter.demo.label': 'Include demo records',
    'filter.demo.note': '{n} synthetic records. They are excluded from every market statistic while this is off.',
    'filter.more': 'More filters',
    'filter.less': 'Fewer filters',
    'filter.reset': 'Reset filters',
    'filter.reset.disabled': 'No filter is active',
    'filter.reset.done': 'Filters reset — {n} properties',
    'filter.active.title': 'Active filters',
    'filter.chip.remove': 'Remove the {name} filter',
    'filter.chip.ai': 'Applied by the assistant',
    'filter.exportCsv': 'Export CSV',
    'filter.exportCsv.disabled': 'No properties in the current selection',
    'filter.showResults': 'Show {n} results',

    /* --------------------------------------------- results list (R2) */
    'list.tab': 'List',
    'list.title': 'Results',
    'list.sort.label': 'Sort',
    'list.sort.name': 'Name A to Z',
    'list.sort.rentDesc': 'Asking rent, high to low',
    'list.sort.rentAsc': 'Asking rent, low to high',
    'list.sort.confidence': 'Data confidence',
    'list.sort.completeness': 'Completeness',
    'list.sort.district': 'District',
    'list.sort.distance': 'Distance from the selected property',
    'list.sort.distance.disabled': 'Select a property to sort by distance',
    'list.group.noValue': 'No recorded {field} ({n})',
    'list.group.noValue.note': 'These records are listed last because the value is unknown, not because it is low.',
    'list.card.open': 'Open {name}',
    'list.card.compare': 'Add to the comparison',
    'list.card.compare.remove': 'Remove from the comparison',
    'list.card.compare.limit': 'Compare supports 2 to 4 properties',
    'list.card.zoom': 'Zoom to this property on the map',
    'list.card.demo': 'Demo record',
    'list.card.duplicate': 'Possible duplicate',
    'list.card.conflict': 'District label conflict',
    'list.card.edited': 'Edited locally',
    'list.card.added': 'Added locally',
    'list.showing': 'Showing {n} of {m}',
    'list.dupePair': 'Possible duplicate pair',
    'list.action.clearFilter': 'Clear the {name} filter',
    'list.action.resetAll': 'Reset all filters',

    /* ------------------------------------------- property tab (R5) */
    'detail.tab': 'Property',
    'detail.close': 'Close the property panel',
    'detail.section.overview': 'Overview',
    'detail.section.metrics': 'Key metrics',
    'detail.section.building': 'Building',
    'detail.section.commercial': 'Commercial',
    'detail.section.tenants': 'Tenants',
    'detail.section.amenities': 'Amenities',
    'detail.section.location': 'Location',
    'detail.section.quality': 'Data quality',
    'detail.section.count': '{label} ({n})',
    'detail.action.compare': 'Compare',
    'detail.action.inCompare': 'In comparison',
    'detail.action.compare.limit': 'Compare supports 2 to 4 properties',
    'detail.action.analyze': 'Analyze location',
    'detail.action.reanalyze': 'Recalculate location analysis',
    'detail.action.ask': 'Ask the assistant about this property',
    'detail.action.copyCoords': 'Copy coordinates',
    'detail.action.copyId': 'Copy record ID',
    'detail.action.openSource': 'Open source',
    'detail.action.openSource.disabled': 'No source URL recorded',
    'detail.action.edit': 'Edit',
    'detail.action.zoom': 'Zoom to this property on the map',
    'detail.coords': '{lat}, {lng}',
    'detail.coords.hint': 'Latitude, longitude to four decimal places.',
    'detail.class.badge': 'Class {class}',
    'detail.district': 'District: {name}',
    'detail.districtSource': 'Source label: {label}',
    'detail.provenance.open': 'Where this value came from',
    'detail.provenance.title': 'Field provenance — {field}',
    'detail.provenance.value': 'Value',
    'detail.provenance.source': 'Source',
    'detail.provenance.sourceUrl': 'Source URL',
    'detail.provenance.collected': 'Collected',
    'detail.provenance.verified': 'Last verified',
    'detail.provenance.method': 'Method',
    'detail.provenance.confidence': 'Confidence',
    'detail.provenance.note': 'Note',
    'detail.provenance.nextRefresh': 'Next refresh due',
    'detail.provenance.edited': 'Edited in this prototype on {date}',
    'detail.provenance.none': 'No provenance is recorded for this field.',
    'detail.quality.sourceGrade': 'Source grade: {grade} (2GIS collection grade)',
    'detail.quality.confidence': 'Field confidence',
    'detail.quality.completeness': 'Completeness: {band} — {n} of {m} critical fields',
    'detail.quality.collected': 'Collected {date}, {age} days ago',
    'detail.quality.verified': 'Last verified {date}',
    'detail.quality.neverVerified': 'Never re-verified since collection',
    'detail.quality.recordType': 'Record type',
    'detail.quality.recordId': 'Record ID',
    'detail.quality.noPhotos': 'No photographs collected.',
    'detail.quality.sourceLine': '{source} · {method} · {date}',
    'detail.demo.badge': 'DEMO RECORD',
    'detail.demo.note': 'A synthetic record. It exists so that parts of the interface with no observed data can be exercised, and it is excluded from every market statistic unless demo mode is on.',
    'detail.dupe.badge': 'Possible duplicate',
    'detail.dupe.note': 'This record sits within {m} m of {n} other records. Nothing is merged automatically — record a verdict in the data workspace.',
    'detail.dupe.review': 'Review this duplicate group',
    'detail.conflict.badge': 'District label conflict',
    'detail.conflict.note': 'The source lists {label}. The official 2024 boundary places these coordinates in {computed}, and the boundary is what the map and the charts use.',
    'detail.entity.badge': 'Entity under review',
    'detail.entity.note': 'This record may not be a business centre. It is kept and counted; flagging it is not deleting it.',
    'detail.addedLocally': 'Added locally — not verified',
    'detail.editedLocally': '{n} fields edited locally',
    'detail.tenants.status': 'Tenant data: {status}',
    'detail.amenities.status': 'Amenity data: {status}',
    'detail.rentUnitNote': 'The source does not state a rent unit. USD/m²/month is assumed and is shown everywhere with this note.',

    /* ------------------------------------- location analysis (§16/§17) */
    'location.title': 'Location analysis',
    'location.run': 'Analyze location',
    'location.rerun': 'Recalculate',
    'location.radius.label': 'Radius',
    'location.radius.option': '{km} km',
    'location.band.count.one': '{n} property within {km} km',
    'location.band.count.other': '{n} properties within {km} km',
    'location.cumulative': 'Bands are cumulative — the 3 km figure includes everything within 1 km.',
    'location.subjectExcluded': 'The selected property is excluded from its own counts.',
    'location.method': 'Great-circle (haversine) distance on a sphere of radius {r} m.',
    'location.rent': 'Average known rent within {km} km',
    'location.gla': 'Total known GLA within {km} km',
    'location.classMix': 'Class mix within {km} km',
    'location.district': 'District: {name}',
    'location.nearest': 'Nearest recorded business centre: {name}, {distance}',
    'location.distance': '{km} km away',
    'location.distanceM': '{m} m away',
    'location.circles': 'Radius rings',
    'location.competitive.title': 'Suggested competitive set',
    'location.competitive.note': 'A suggestion based on the data held, not a definitive peer group. Add or remove properties to reflect market knowledge.',
    'location.competitive.rule': 'Within {km} km and within one class band of {class}.',
    'location.competitive.qualified': 'Qualified ({n})',
    'location.competitive.proximity': 'Proximity only — class not recorded ({n})',
    'location.competitive.excluded': 'Excluded by class or size ({n})',
    'location.competitive.reasons': 'Why this property is here',
    'location.competitive.remove': 'Remove {name} from the set',
    'location.competitive.add': 'Add {name} to the set',
    'location.competitive.addBack': 'Add back',
    'location.competitive.save': 'Save as layer',
    'location.competitive.save.disabled': 'The competitive set is empty',
    'location.competitive.empty': 'No nearby property could be qualified as a peer.',
    'location.competitive.noClass': 'The selected property has no recorded office class, so no peer could be qualified by class.',
    'location.competitive.manual': 'Added manually',

    /* ------------------------------------------ analytics tab (§14) */
    'analytics.tab': 'Analytics',
    'analytics.title': 'Analytics',
    'analytics.scope': 'Analytics reflect the current filters — {n} of {m} properties.',
    'analytics.scope.clear': 'Clear filters',
    'analytics.scope.selection': 'Selection is not a filter: these figures cover the filtered set, not the selected property.',
    'analytics.metric.count': 'Business centres',
    'analytics.metric.glaSum': 'Total known GLA',
    'analytics.metric.rentMean': 'Average asking rent',
    'analytics.metric.rentMean.long': 'Average asking rent (per property, unweighted)',
    'analytics.metric.rentMedian': 'Median asking rent',
    'analytics.metric.availableSum': 'Known available area',
    'analytics.metric.occupancyMean': 'Average occupancy',
    'analytics.metric.vacancyMean': 'Average vacancy',
    'analytics.metric.statusSplit': 'Operating versus pipeline',
    'analytics.metric.split': '{operating} operating · {pipeline} pipeline',
    'analytics.metric.open': 'How this number was calculated',
    'analytics.metric.formula': 'Formula',
    'analytics.metric.excluded': 'Excluded for missing data ({n})',
    'analytics.metric.excluded.note': 'These records hold no value for this field. They are excluded from the calculation, not counted as zero.',
    'analytics.metric.weighting': 'Weighting: {how}. GLA weighting is impossible here — GLA is recorded for {n} of {m} properties.',
    'analytics.chart.district': 'Business centres by district',
    'analytics.chart.class': 'Business centres by class',
    'analytics.chart.rent': 'Asking-rent distribution',
    'analytics.chart.gla': 'GLA distribution',
    'analytics.chart.coverage': 'Data coverage by field',
    'analytics.chart.asTable': 'Show as a table',
    'analytics.chart.asChart': 'Show as a chart',
    'analytics.chart.table': 'Table',
    'analytics.chart.chart': 'Chart',
    'analytics.chart.tooltip': '{category}: {n} of {m} ({pct})',
    'analytics.chart.filterAction': 'Filter the results to {category}',
    'analytics.chart.unknownBar': 'Unknown · {n}',
    'analytics.chart.unknownNote': 'The unknown bar is shown, never dropped: hiding it would misrepresent coverage.',
    'analytics.axis.count': 'Properties',
    'analytics.axis.rent': 'Asking rent (USD/m²/month)',
    'analytics.axis.gla': 'GLA (m²)',
    'analytics.axis.district': 'District',
    'analytics.axis.class': 'Office class',
    'analytics.axis.field': 'Field',
    'analytics.bin.under': 'Under {max}',
    'analytics.bin.range': '{min} to {max}',
    'analytics.bin.over': '{min} and above',
    'analytics.strip.note': 'Individual values are plotted: {n} recorded values are too few to imply a distribution.',
    'analytics.byDistrict.suppressed': 'Suppressed — {n} recorded values, fewer than the {min} required',
    'analytics.coverage.row': '{field} · {n} of {m}',
    'analytics.coverage.action': 'Show the records missing this field',
    'analytics.coverage.note': 'This chart is the honest centre of the dataset: it shows what is known, not what is claimed.',
    'analytics.export': 'Export CSV',
    'analytics.export.disabled': 'No properties in the current selection',
    'analytics.export.note': 'The export carries the active filters, the record count, the collection date and the assumed rent unit in a header block.',
    'analytics.print': 'Print',
    'analytics.demo': 'These figures include {n} demo records.',

    /* ---------------------------------------------- compare (R6/R7) */
    'compare.tray.label': 'Staged for comparison',
    'compare.tray.open': 'Compare ({n})',
    'compare.tray.needMore': 'Add one more to compare',
    'compare.tray.clear': 'Clear',
    'compare.tray.clear.confirm': 'Clear the comparison?',
    'compare.tray.clear.body': '{n} staged properties are removed. The properties themselves are not changed.',
    'compare.tray.remove': 'Remove {name} from the comparison',
    'compare.title': 'Compare properties',
    'compare.close': 'Close the comparison',
    'compare.limit': 'Compare supports 2 to 4 properties',
    'compare.min': 'Select at least 2 properties to compare',
    'compare.add': 'Add property',
    'compare.add.placeholder': 'Search by name',
    'compare.removeColumn': 'Remove {name} from the comparison',
    'compare.differing': 'Show only differing rows',
    'compare.hiddenRows': '{n} rows hidden — no recorded data for any selected property',
    'compare.noWinner': 'No property is ranked or marked as best. The values are shown side by side; the judgement is yours.',
    'compare.export': 'Export CSV',
    'compare.print': 'Print',
    'compare.open': 'Open {name}',
    'compare.row.distance': 'Distance apart',
    'compare.row.confidence': 'Data confidence',
    'compare.row.completeness': 'Completeness',
    'compare.pager': '{n} of {m}',
    'compare.pager.prev': 'Previous property',
    'compare.pager.next': 'Next property',

    /* -------------------------------------------------- map (R3/R4) */
    'map.aria': 'Map of Tashkent business centres',
    'map.zoomIn': 'Zoom in',
    'map.zoomOut': 'Zoom out',
    'map.zoomIn.disabled': 'Maximum zoom reached',
    'map.zoomOut.disabled': 'Minimum zoom reached',
    'map.fit': 'Fit results to the map',
    'map.fit.disabled': 'No results to fit',
    'map.reset': 'Reset the map view',
    'map.fullscreen': 'Full screen map',
    'map.fullscreen.exit': 'Exit full screen',
    'map.layers': 'Map layers',
    'map.legend.title': 'Legend',
    'map.legend.collapse': 'Collapse the legend',
    'map.legend.expand': 'Show the legend',
    'map.legend.class': 'Office class',
    'map.legend.confidence': 'Data confidence',
    'map.legend.completeness': 'Completeness',
    'map.legend.unknown': 'Not recorded',
    'map.legend.unknown.note': 'Hatched marks mean the value is unknown, not zero.',
    'map.legend.demo': 'Demo record',
    'map.legend.duplicate': 'Possible duplicate',
    'map.legend.selected': 'Selected',
    'map.attribution': '© OpenStreetMap contributors',
    'map.attribution.offline': 'Requires an internet connection',
    'map.tooltip': '{name} · {class} · {district}',
    'map.tooltip.confidence': 'Confidence: {level}',
    'map.kbdNote': 'Arrow keys pan the map and plus and minus zoom. Every property on the map is also in the results list.',
    'map.cluster': '{n} properties — click to zoom in',
    'map.district.tooltip': '{name} — {n} properties',
    'map.district.filter': 'Filter the results to {name}',
    'map.pick.title': 'Pick coordinates on the map',
    'map.pick.hint': 'Click the map to set the coordinates. Press Escape to cancel.',
    'map.pick.cancel': 'Cancel picking',
    'map.tiles.offline': 'Map tiles unavailable — you appear to be offline.',
    'map.tiles.fallback': 'The background grid replaces the tiles. Markers, districts, radii and every figure still work.',
    'map.empty': 'No properties to show with these filters.',

    /* ----------------------------------------------- layers tab (R5) */
    'map.layers.tab': 'Layers',
    'map.layers.base': 'Base layers',
    'map.layers.properties': 'Business centres ({n})',
    'map.layers.districts': 'Tashkent districts',
    'map.layers.labels': 'District labels',
    'map.layers.radius': 'Radius rings',
    'map.layers.radius.disabled': 'Run Analyze location on a property first',
    'map.layers.context': 'Context layers',
    'map.layers.metro': 'Metro stations',
    'map.layers.roads': 'Major roads',
    'map.layers.landmarks': 'Landmarks',
    'map.layers.context.disabled': 'No verified dataset loaded',
    'map.layers.context.note': 'Context layers need a licensed or field-collected source. This prototype does not approximate them from memory. Import a GeoJSON file and the layer enables itself.',
    'map.layers.analysis': 'Analysis layers',
    'map.layer.rename': 'Rename this layer',
    'map.layer.rename.hint': 'Enter commits, Escape cancels.',
    'map.layer.remove': 'Remove this layer',
    'map.layer.zoom': 'Zoom to this layer',
    'map.layer.zoom.disabled': 'This layer holds no properties',
    'map.layer.visible': 'Show this layer',
    'map.layer.criteria': 'Inspect criteria',
    'map.layer.criteria.human': 'Rule',
    'map.layer.criteria.machine': 'Criteria as stored',
    'map.layer.createdBy': 'Created by {who}, {date}',
    'map.layer.by.assistant': 'the assistant',
    'map.layer.by.manual': 'you',
    'map.layer.count.one': '{n} property',
    'map.layer.count.other': '{n} properties',
    'map.layer.clearAll': 'Clear all analysis layers',
    'map.layer.clearAll.disabled': 'There are no analysis layers',
    'map.layer.derived.disabled': 'Needs a field this dataset does not hold',
    'map.layer.note': 'A layer is a saved result set. A filter is a live rule. Removing a layer removes its markers and circles.',

    /* ------------------------------------------- assistant (R5 · AI) */
    'ai.tab': 'Assistant',
    'ai.title': 'Assistant',
    'ai.input.label': 'Ask the assistant',
    'ai.input.placeholder': 'Ask about the data — for example, Show Class A business centres',
    'ai.send': 'Ask',
    'ai.send.disabled': 'Type a question first',
    'ai.context': 'Context: {name}',
    'ai.context.clear': 'Clear the assistant context',
    'ai.context.none': 'No property is selected.',
    'ai.suggest.title': 'Try one of these',
    'ai.block.answer': 'Answer',
    'ai.block.analysis': 'Analysis',
    'ai.block.map': 'Map actions',
    'ai.block.coverage': 'Data coverage',
    'ai.block.limitations': 'Limitations',
    'ai.block.sources': 'Sources',
    'ai.block.empty.map': 'No map change was needed for this answer.',
    'ai.block.empty.analysis': 'No further analysis applies to this answer.',
    'ai.block.empty.limitations': 'No limitation beyond the coverage stated above.',
    'ai.block.empty.sources': 'The loaded dataset only. Nothing external was consulted.',
    'ai.tag.platform': 'PLATFORM DATA',
    'ai.tag.calculated': 'CALCULATED',
    'ai.tag.external': 'EXTERNAL',
    'ai.tag.inference': 'AI INFERENCE',
    'ai.tag.assumption': 'ASSUMPTION',
    'ai.tag.unavailable': 'UNAVAILABLE',
    'ai.how': 'How this was answered',
    'ai.how.intent': 'Matched intent',
    'ai.how.slots': 'Values read from your question',
    'ai.how.tools': 'Tools called',
    'ai.how.toolArgs': '{tool}({args})',
    'ai.how.records': '{in} records in, {out} records out',
    'ai.how.elapsed': 'Completed in {ms} ms',
    'ai.how.engine': 'Engine: {name}',
    'ai.provider.local': 'Local intent engine',
    'ai.provider.note': 'Answers come from a deterministic local engine, not a language model. Nothing leaves this page.',
    'ai.apply': 'Apply to map',
    'ai.applied': 'Applied',
    'ai.undo': 'Undo this',
    'ai.undo.cascade': 'Later steps depended on this and were reverted too.',
    'ai.createLayer': 'Create layer',
    'ai.createLayer.disabled': 'No matching properties',
    'ai.compare': 'Compare these',
    'ai.compare.disabled': 'Fewer than 2 results',
    'ai.copy': 'Copy answer',
    'ai.newSession': 'New session',
    'ai.newSession.confirm': 'Start a new session?',
    'ai.newSession.body': 'The conversation, the assistant context and the analysis layers created in it are removed. The dataset and the session log are kept.',
    'ai.exportLog': 'Export session log',
    'ai.mutating.confirm': 'This would change the dataset. Continue?',
    'ai.mutating.blocked': 'Requires confirmation and a backend — not available in the prototype',
    'ai.unavailable.title': 'The current dataset is insufficient to answer this reliably.',
    'ai.unavailable.field': '{field} is recorded for {n} of {m} properties in scope.',
    'ai.unavailable.required': 'Answering this would require {field} to be collected for those properties.',
    'ai.unavailable.kept': 'Nothing on the map or in the filters was changed.',
    'ai.unavailable.alternative': 'What can be answered now',
    'ai.unresolvedContext': 'No property is selected, so "it" could not be resolved. Select a property, or name one in the question.',
    'ai.notUnderstood': 'That question was not recognised.',
    'ai.notUnderstood.body': 'This prototype matches a fixed catalogue of questions. One of the suggestions below will work.',
    'ai.layerCreated': 'Layer "{name}" created with {n} properties',
    'ai.turn.you': 'You',
    'ai.turn.assistant': 'Assistant',
    'ai.session.count': '{n} questions in this session',

    /* --------------------------------------- data quality vocabulary */
    'quality.title': 'Data quality',
    'quality.confidence.legend': 'Confidence is recorded per field, not per record — a name and an asking rent from the same listing are not equally reliable.',
    'quality.confidence.identity': 'Name, coordinates and address: Medium — a single map-service listing.',
    'quality.confidence.claims': 'Office class and asking rent: Low — unverified commercial claims from a directory.',
    'quality.confidence.district': 'District: High — computed from the official 2024 boundary.',
    'quality.confidence.dotLabel': '{level} confidence',
    'quality.freshness.stale': 'Stale — last verified {date}',
    'quality.freshness.due': 'Next refresh due {date}',
    'quality.freshness.dueIn': 'Due in {n} days',
    'quality.freshness.overdue': 'Overdue by {n} days',
    'quality.freshness.note': 'Every observed record shares one collection date ({date}, {age} days ago), so staleness cannot yet separate them. The calculation becomes meaningful as soon as a second date exists.',
    'quality.freshness.intervals': 'Refresh intervals: {fast} days for fast-moving fields, {slow} for slow, {stable} for stable.',
    'quality.completeness.explain': 'Completeness counts how many of the {m} critical fields hold a value. It is a count, not a percentage, because at this coverage a percentage puts every record in one bucket.',
    'quality.completeness.band': '{band} — {n} of {m} critical fields',
    'quality.dupes.title': 'Possible duplicates',
    'quality.dupes.summary': '{records} records in {groups} groups',
    'quality.dupes.distance': '{d} m apart',
    'quality.dupes.flagged': 'Flagged by the source',
    'quality.dupes.unflagged': 'Found by coordinate proximity',
    'quality.dupes.sameName': 'Same name',
    'quality.dupes.verdict': 'Verdict',
    'quality.dupes.note': 'Records are never merged automatically. Merging destroys data on an unverified judgement; ignoring the pair double-counts the building. A verdict is recorded with its date instead.',
    'quality.dupes.disclosure': '{n} records ({g} possible duplicate pairs unresolved)',
    'quality.conflict.title': 'District label conflicts',
    'quality.conflict.summary': '{n} records where the source label disagrees with the official boundary',
    'quality.conflict.row': '{name}: the source says {label}, the boundary says {computed}',
    'quality.conflict.rule': 'The boundary is authoritative and drives every map, filter and chart. The source label is kept for reference and never silently corrected.',
    'quality.entity.title': 'Entity review',
    'quality.entity.summary': '{n} records flagged as possibly not business centres',
    'quality.entity.note': 'A keyword collection pulls in tenant firms and associations. These records are flagged and kept, never deleted on suspicion.',
    'quality.queue.title': 'Verification queue',
    'quality.queue.reason': 'Why this is queued',
    'quality.queue.missing': 'Missing {n} of {m} critical fields',
    'quality.queue.lowConfidence': 'Low confidence on {field}',
    'quality.queue.stale': 'Not verified since {date}',
    'quality.queue.duplicate': 'Possible duplicate, no verdict recorded',
    'quality.queue.empty': 'Nothing is queued for verification.',
    'quality.queue.createTasks': 'Create field tasks',
    'quality.queue.createTasks.disabled': 'Requires confirmation and a backend — not available in the prototype',
    'quality.coverage.title': 'Coverage by field',
    'quality.coverage.row': '{field} · {n} of {m}',
    'quality.coverage.zero': 'Not recorded for any property in the dataset',
    'quality.coverage.critical': 'Critical field',

    /* ---------------------------------------- data workspace (R8) */
    'admin.title': 'Data workspace',
    'admin.close': 'Close the data workspace',
    'admin.tab.records': 'Records',
    'admin.tab.coverage': 'Coverage',
    'admin.tab.quality': 'Quality',
    'admin.tab.dupes': 'Duplicates',
    'admin.tab.changes': 'Local changes',
    'admin.tab.io': 'Import / Export',
    'admin.records.count': '{n} records',
    'admin.records.add': 'Add property',
    'admin.records.filter': 'Filter records',
    'admin.records.open': 'Edit {name}',
    'admin.form.title.new': 'New property',
    'admin.form.title.edit': 'Edit {name}',
    'admin.form.required': 'Required',
    'admin.form.optional': 'Optional',
    'admin.form.unknownHint': 'Leave a field empty for unknown. An empty field is stored as unknown, never as zero.',
    'admin.form.pickOnMap': 'Pick on map',
    'admin.form.addSource': 'Add source',
    'admin.form.removeSource': 'Remove this source',
    'admin.form.source.name': 'Source name',
    'admin.form.source.url': 'Source URL',
    'admin.form.source.method': 'Collection method',
    'admin.form.source.date': 'Collection date',
    'admin.form.source.confidence': 'Confidence',
    'admin.form.source.note': 'Note',
    'admin.form.lastVerified': 'Last verified',
    'admin.form.lastVerified.hint': 'Changing this date changes the freshness calculation for every field in this record.',
    'admin.form.save': 'Save',
    'admin.form.save.invalid': 'Fix the errors above before saving',
    'admin.form.save.unchanged': 'Nothing has changed',
    'admin.form.cancel': 'Cancel',
    'admin.form.cancel.confirm': 'Discard unsaved changes?',
    'admin.form.cancel.body': 'The edits to "{name}" are lost. The record keeps its saved values.',
    'admin.form.delete': 'Delete',
    'admin.form.delete.confirm': 'Delete "{name}"?',
    'admin.form.delete.body': 'The record leaves every count, chart and map layer. It stays in Recently deleted for this session and can be restored.',
    'admin.form.saved': 'Saved "{name}"',
    'admin.deleted.title': 'Recently deleted',
    'admin.deleted.restore': 'Restore "{name}"',
    'admin.undo': 'Undo',
    'admin.redo': 'Redo',
    'admin.undo.disabled': 'Nothing to undo',
    'admin.redo.disabled': 'Nothing to redo',
    'admin.undo.depth': 'Undo keeps the last {n} changes.',
    'admin.changes.title': 'Local changes',
    'admin.changes.summary': '{records} records changed, {fields} fields',
    'admin.changes.revert': 'Revert',
    'admin.changes.revert.confirm': 'Revert {field} on "{name}"?',
    'admin.changes.revert.body': 'The field returns to the value shipped with the prototype: {before}.',
    'admin.changes.beforeAfter': '{before} → {after}',
    'admin.changes.export': 'Export change-set',
    'admin.changes.export.disabled': 'There are no local changes',
    'admin.changes.note': 'Only the difference from the shipped dataset is saved in this browser, so storage stays small and a reset is always clean.',
    'admin.io.exportJson': 'Export JSON',
    'admin.io.exportJson.note': 'Every record with its provenance. Re-importing the file restores the same dataset exactly.',
    'admin.io.exportCsv': 'Export CSV',
    'admin.io.importJson': 'Import JSON',
    'admin.io.importJson.hint': 'The file is validated before anything changes.',
    'admin.io.importing': 'Validating {n} of {m} records…',
    'admin.io.report.title': 'Import report',
    'admin.io.report.ok': '{n} of {m} records are valid.',
    'admin.io.report.rejected': '{n} rejected',
    'admin.io.report.row': 'Row {row}: {reason}',
    'admin.io.commit': 'Import valid records only',
    'admin.io.cancel': 'Cancel — change nothing',
    'admin.io.allOrNothing': 'A partial import is never applied silently. Either the valid records are imported as a set, or nothing changes.',
    'admin.io.demo.title': 'Demo records',
    'admin.io.demo.on': 'Turn on demo records',
    'admin.io.demo.off': 'Turn off demo records',
    'admin.io.demo.note': '{n} synthetic records exist so that the parts of the interface with no observed data can be exercised. While they are off they are excluded from every market statistic; while they are on, every figure that includes one says so.',
    'admin.reset.restore': 'Restore original dataset',
    'admin.reset.restore.confirm': 'Restore the original dataset?',
    'admin.reset.restore.body': 'Every local edit, addition and deletion is discarded. The assistant session and any analysis layers are kept.',
    'admin.reset.full': 'Full reset',
    'admin.reset.full.confirm': 'Reset everything?',
    'admin.reset.full.body': 'Every saved setting, edit and assistant session is cleared and the page reloads. This cannot be undone.',
    'admin.reset.done': 'Local data cleared. The prototype restarted with the shipped dataset.',
    'admin.storage.usage': 'Local storage in use: {used}',
    'admin.storage.unavailable': 'Storage is unavailable, so changes last only until you reload.',
    'admin.tenants.arch': 'Tenant records can only be supplied through JSON import in this prototype.',
    'admin.photos.arch': 'Photograph upload is not built. Each record keeps an empty photo slot.',

    /* ------------------------------------------------- empty states */
    'empty.results.title': 'No properties match these filters.',
    'empty.results.body': 'The narrowest filter is {name}. {m} properties are in the dataset.',
    'empty.results.clear': 'Clear the {name} filter',
    'empty.results.resetAll': 'Reset all filters',
    'empty.district.title': 'No business centres recorded in {name}.',
    'empty.district.body': 'This is a recorded zero, not missing data — the district is in the dataset and holds no records.',
    'empty.district.action': 'Choose another district',
    'empty.search.title': 'No match for "{q}".',
    'empty.search.body': 'Search covers property name, address and district, in Cyrillic and in Latin.',
    'empty.search.action': 'Clear the search',
    'empty.property.title': 'No property selected.',
    'empty.property.body': 'Choose a building on the map or in the results list.',
    'empty.property.action': 'Open the results list',
    'empty.compare.title': 'Select at least 2 properties to compare.',
    'empty.compare.body': 'Add properties from the results list or from a property panel.',
    'empty.compare.action': 'Open the results list',
    'empty.layer.title': 'This layer holds no properties.',
    'empty.layer.body': 'Nothing in the dataset matches {criteria}.',
    'empty.layer.action': 'Remove layer',
    'empty.layers.title': 'No analysis layers.',
    'empty.layers.body': 'Layers are created by the assistant, or by saving a competitive set.',
    'empty.tenants.title': 'No tenant records.',
    'empty.tenants.body': 'Tenants have not been collected for this property. That is different from a building with no tenants.',
    'empty.tenants.confirmed': 'Confirmed empty — this building has no tenants recorded, and that is a verified fact rather than a gap.',
    'empty.amenities.title': 'No amenities recorded.',
    'empty.amenities.body': 'Amenities have not been collected for this property.',
    'empty.photos': 'No photographs collected.',
    'empty.deleted': 'Nothing deleted in this session.',
    'empty.changes': 'No local changes. The dataset matches the version shipped with this prototype.',
    'empty.quality': 'Nothing is flagged for review.',
    'empty.ai.title': 'Ask a question about the data.',
    'empty.ai.body': 'The suggestions below are the questions this dataset can answer, plus one it cannot — so you can see what a refusal looks like.',
    'empty.metric.title': 'Insufficient verified data',
    'empty.metric.body': 'A mean or median needs at least {min} recorded values; this selection has {n}.',
    'empty.metric.zero': 'No property in the current selection has a recorded {field}.',
    'empty.map': 'No properties to show on the map with these filters.',
    'empty.list.title': 'Nothing to list.',
    'empty.list.body': 'Adjust the filters to bring properties back.',

    /* ------------------------------------------------ error states */
    'error.title': 'Something went wrong',
    'error.tiles.title': 'Map tiles unavailable — you appear to be offline.',
    'error.tiles.body': 'All data, filters, analytics, comparison and the assistant still work.',
    'error.tiles.retry': 'Retry tiles',
    'error.storage.title': 'Local saving is unavailable in this browser.',
    'error.storage.body': 'Your edits work in this session but will be lost when you reload. Export JSON to keep them.',
    'error.storage.action': 'Export JSON',
    'error.quota.title': 'Could not save — browser storage is full.',
    'error.quota.body': 'Your change is applied in this session but is not saved.',
    'error.quota.export': 'Export JSON',
    'error.quota.clearEdits': 'Remove local edits',
    'error.quota.continue': 'Continue without saving',
    'error.schema.title': 'Saved data was created by an earlier version of this prototype.',
    'error.schema.body': 'It cannot be read safely, and it will not be migrated silently. Export it first if you need it.',
    'error.schema.export': 'Export my old data (JSON)',
    'error.schema.discard': 'Discard and start clean',
    'error.import.json': 'Import failed: the file is not valid JSON.',
    'error.import.schema': 'Import failed: the file declares schema v{found}; this prototype expects v{expected}.',
    'error.import.records': '{ok} of {m} records are valid. {n} were rejected.',
    'error.import.empty': 'Import failed: the file holds no records.',
    'error.import.unchanged': 'Nothing was changed.',
    'error.validation.number': 'Enter a number. "{value}" was not understood — use a full stop for decimals.',
    'error.validation.integer': 'Enter a whole number. "{value}" was not understood.',
    'error.validation.required': '{field} is required.',
    'error.validation.enum': '{field} must be one of: {allowed}.',
    'error.validation.coords': 'Coordinates are outside Tashkent. Check for swapped or mistyped values.',
    'error.validation.range': '{field} of {value} is outside the expected range {min} to {max}. It will be saved as entered — confirm the source.',
    'error.validation.date': 'Enter a date as YYYY-MM-DD.',
    'error.validation.district': '"{value}" is not one of the {n} Tashkent districts.',
    'error.validation.recordType': 'A record must declare whether it is observed or demo data.',
    'error.clipboard': 'Copy is blocked in this browser. Select the text and press Ctrl or Cmd and C.',
    'error.clipboard.hint': 'Press Ctrl or Cmd and C to copy',
    'error.hash': 'The link state could not be read — the prototype opened with default settings.',
    'error.runtime': 'Something went wrong in {module}. The rest of the prototype still works.',
    'error.runtime.copy': 'Copy error details',
    'error.fullscreen': 'Full screen is not available in this browser, so the map was expanded within the page instead.',
    'error.notFound': 'That record is no longer in the dataset.',
    'error.noSelection': 'Select a property first.',
    'error.print': 'Printing was blocked by the browser. Use the browser print command instead.',
    'error.export.blocked': 'The download was blocked by the browser. Allow downloads from this page and try again.',

    /* --------------------------------------- boot / recovery (R13) */
    'boot.title': 'Could not start',
    'boot.body.schema': 'Saved data from an earlier version of this prototype is in the way.',
    'boot.body.corrupt': 'The saved state could not be read.',
    'boot.action.export': 'Export my old data (JSON)',
    'boot.action.discard': 'Discard and start clean',
    'boot.action.reload': 'Reload',
    'boot.hashReset': 'Opening the file with #reset clears everything and starts from the shipped dataset.',

    /* --------------------------------------------- toasts / notices */
    'toast.undo': 'Undo',
    'toast.dismiss': 'Dismiss',
    'toast.copied': 'Copied to the clipboard',
    'toast.coordsCopied': 'Coordinates copied',
    'toast.idCopied': 'Record ID copied',
    'toast.filtersAi': 'Filters updated by the assistant',
    'toast.filtersAi.view': 'View filters',
    'toast.filtersReset': 'Filters reset — {n} properties',
    'toast.saved': 'Saved "{name}"',
    'toast.deleted': 'Deleted "{name}"',
    'toast.restored': 'Restored "{name}"',
    'toast.reverted': 'Reverted {field} on "{name}"',
    'toast.layerCreated': 'Layer "{name}" created',
    'toast.layerRemoved': 'Layer "{name}" removed',
    'toast.layersCleared': '{n} analysis layers removed',
    'toast.exported': 'File prepared — check your downloads',
    'toast.imported': '{n} records imported',
    'toast.compareNeedsTwo': 'Add one more property to compare',
    'toast.compareFull': 'Compare supports 2 to 4 properties',
    'toast.demoOn': 'Demo records are on — figures may include synthetic values',
    'toast.demoOff': 'Demo records are off',
    'toast.roleExternal': 'External role — internal fields and tools are hidden',
    'toast.roleInternal': 'Internal role — everything is shown',
    'toast.verdictSaved': 'Verdict recorded for this duplicate group',

    /* ----------------------------------------------- accessibility */
    'a11y.leftRail': 'Filters and results',
    'a11y.rightRail': 'Detail panel',
    'a11y.leftTabs': 'Left panel',
    'a11y.rightTabs': 'Right panel',
    'a11y.sections': 'Sections',
    'a11y.close': 'Close',
    'a11y.closePanel': 'Close panel',
    'a11y.collapsePanel': 'Collapse the filter panel',
    'a11y.expandPanel': 'Expand the filter panel',
    'a11y.resultsUpdated': '{n} properties found',
    'a11y.selected': '{name} selected',
    'a11y.deselected': 'Selection cleared',
    'a11y.newResponse': 'New assistant response',
    'a11y.demoActive': 'Demo data active',
    'a11y.sortedBy': 'Sorted by {name}',
    'a11y.required': 'required',
    'a11y.invalid': 'invalid',
    'a11y.loading': 'Working',
    'a11y.chartTable': 'Chart data as a table',
    'a11y.confidenceDot': '{level} confidence',
    'a11y.dialogOpened': '{name} dialog opened',
    'a11y.menuButton': 'Opens a menu',

    /* -----------------------------------------------------------------------
     * Data-quality workspace (§19, §37, §50).
     *
     * These strings do most of the product's honesty work, so they are written
     * to say what was measured, why it matters commercially, and what to do —
     * not just to name a category. A queue heading that reads "District label
     * conflicts" tells a user nothing; one that says which value was used and
     * why tells them whether to trust the chart.
     * --------------------------------------------------------------------- */
    'quality.issue.missingCritical.title': 'No commercial data recorded',
    'quality.issue.missingCritical.detail':
      '{n} properties hold none of the fields a commercial decision needs — class, status, GLA, floors, asking rent, vacancy, parking or year opened. They are real buildings with real locations; nothing has been collected about them yet. {examples}',
    'quality.issue.missingCritical.action': 'Show these on the map',

    'quality.issue.duplicateCoordinate.title': 'Exact coordinate collisions',
    'quality.issue.duplicateCoordinate.detail':
      '{n} records share a coordinate with another record, in {groups} groups. Each pair is either one building listed twice or two businesses at one address — the source does not say which. Until they are adjudicated, every district count and radius count may overstate supply. {examples}',
    'quality.issue.duplicateCoordinate.action': 'Review these pairs',

    'quality.issue.duplicateProximity.title': 'Unflagged near-duplicates',
    'quality.issue.duplicateProximity.detail':
      '{n} records sit within {m} m of another record without the source having flagged them. Found by recomputing the distances rather than trusting the flag. {examples}',
    'quality.issue.duplicateProximity.action': 'Review these pairs',

    'quality.issue.duplicateName.title': 'Similar names at similar addresses',
    'quality.issue.duplicateName.detail':
      '{n} records carry a name close to another record that is also close by. Name similarity alone is not evidence — two buildings can share a word — so only pairs that are near each other as well are listed. {examples}',
    'quality.issue.duplicateName.action': 'Review these pairs',

    'quality.issue.districtConflict.detail':
      "{n} records carry a district label that disagrees with the boundary polygon containing their coordinates. The polygon is used, because it can be reproduced from the coordinates while a label cannot; the source's label is kept on the record. One of these is the highest asking rent in the dataset. {examples}",
    'quality.issue.districtConflict.action': 'Show these on the map',

    'quality.issue.suspectedNonBc.title': 'Probably not office buildings',
    'quality.issue.suspectedNonBc.detail':
      '{n} records have a name that describes a company, an association or an office of a firm rather than a building. They are counted in every figure until someone confirms or rejects them — they are flagged, never deleted, because deletion would be an unverified judgement. {examples}',
    'quality.issue.suspectedNonBc.action': 'Review these records',

    'quality.issue.nameQuality.title': 'Placeholder names',
    'quality.issue.nameQuality.detail':
      '{n} records carry a generic name that identifies no particular building — including one named after a district. They are probably real buildings that need a proper name, not records to remove. {examples}',
    'quality.issue.nameQuality.action': 'Review these records',

    'quality.issue.outOfBounds.title': 'Coordinates outside Tashkent',
    'quality.issue.outOfBounds.detail':
      '{n} records sit outside the expected coordinate envelope for the city. Usually a swapped latitude and longitude, or a typing error. {examples}',
    'quality.issue.outOfBounds.action': 'Review these records',

    'quality.issue.valueConflict.title': 'Values that contradict each other',
    'quality.issue.valueConflict.detail':
      '{n} records hold values that cannot all be true at once. They are stored exactly as entered — the platform records the market rather than arguing with it — but one of the values is wrong. {examples}',
    'quality.issue.valueConflict.action': 'Review these records',

    'quality.issue.examples.more': 'and {n} more',
    'quality.issue.item.missingCritical': '{name} — {district}',
    'quality.issue.item.dupeGroup': '{names} share one coordinate',
    'quality.issue.item.dupePair': '{a} and {b}, {m} m apart',
    'quality.issue.item.namePair': '{a} and {b} — {why}',
    'quality.issue.item.outOfBounds': '{name} at {lat}, {lng}',
    'quality.issue.item.valueConflict': '{name} — {reason}',

    'quality.issue.name.why.identical': 'the same name after normalisation',
    'quality.issue.name.why.edit': 'names differ by {n} characters or fewer',
    'quality.issue.name.why.contains': 'one name contains the other',

    'quality.value.occupancyVacancy': 'occupancy and vacancy do not sum to 100%',
    'quality.value.areaMismatch': 'GLA exceeds GBA — lettable area cannot be larger than gross area',
    'quality.value.availableExceedsGla': 'available area exceeds GLA',

    'quality.confidence.summary':
      'High {high} · Medium {medium} · Low {low} · Not verified {unknown}, across {n} properties.',
    'quality.freshness.nothingToVerify': 'Nothing recorded, so there is nothing to re-verify yet.',
    'quality.summary.stalenessDiscriminates':
      'Every record shares one collection date ({date}), so age cannot separate them yet. The ranking below is driven by missing fields and flagged issues instead; staleness starts to discriminate as soon as a second verification date exists.',
    'quality.summary.noDates': 'No verification dates are recorded.',
    'quality.summary.fieldVerified.none':
      'No record has been verified in the field. Every value is desk-collected from a single source.',

    'quality.queue.field.verify': 'Re-verify {field}',
    'quality.queue.field.confirm': 'Confirm {field}',
    'quality.queue.field.collect': 'Collect {field}',
    'quality.queue.reason.ageing': '{field} is approaching its re-verification date',
    'quality.queue.reason.bounds': 'coordinates fall outside the city envelope',
    'quality.queue.reason.commercial': 'carries commercial data a client would quote, so it must stay current',
    'quality.queue.reason.conflict': 'district label disagrees with the boundary',
    'quality.queue.reason.entity': 'may not be an office building',
    'quality.queue.reason.nameQuality': 'name does not identify a specific building',

    /* --- property detail (§13, §19) --- */
    'detail.action.copyCoords.disabled': 'No coordinates recorded for this property',
    'detail.ask.prefill': 'Tell me about {name}',
    'detail.provenance.profile': 'Source profile',
    'detail.provenance.qc': 'Quality-control status',
    'detail.quality.freshness': 'Verification status',
    'detail.quality.missingFields': 'Not yet recorded: {fields}',
    'detail.quality.sourceNote': "Collector's note",
    'detail.quality.sourceNote.origin':
      'Written by whoever collected this record, and kept verbatim. It is their own instruction about what still needs checking.',
    'detail.tenants.count': '{n} of {total} tenants recorded',
    'detail.tenants.floor': 'Floor {floor}',

    /* --- filter rail (§11) --- */
    'filter.excluded.field': '{n} properties excluded — {field} not recorded',
    'filter.flags.label': 'Data flags',
    'filter.flags.note': 'Filter by what the data-quality checks found, rather than by a property attribute.',
    'filter.option.count': '{label} ({n})',
    'filter.range.observed': 'Recorded values run {min} to {max}',
    'filter.flags.suspected': 'Probably not an office building',
    'filter.flags.demo': 'Demo record (synthetic)',

    /* --- results list (§12) --- */
    'common.open': 'Open',
    'common.compare': 'Compare',
    'list.showMore': 'Show {n} more',
    'list.card.completeness': '{n} of {total} key fields recorded',
    // Rather than printing five "Not recorded" rows per card, name the absence once.
    'list.card.missing': 'No {fields} recorded',
    'list.card.duplicate.why': 'Shares a coordinate with another record — one of them may be a duplicate.',
    'list.card.edited.why': 'Changed in this browser. Not saved to any shared source.',
    'list.sort.nameDesc': 'Name Z to A',
    'list.sort.glaDesc': 'GLA, large to small',
    'list.sort.glaAsc': 'GLA, small to large',
    'list.sort.verified': 'Last verified, oldest first',
    'empty.property.action.map': 'Pick one on the map'
  };

  /* -------------------------------------------------------------------------
   * RU / UZ are declared and deliberately empty.
   *
   * They exist so that adding a language is data entry, not a refactor: fill a
   * table, and `coverage()` flips the language menu on by itself. They are NOT
   * partially filled with guesses — a half-translated interface that silently
   * mixes scripts is worse than an honest English-only one (D14), and the
   * per-key fallback below means a partial table degrades to English per
   * string rather than per screen.
   * ---------------------------------------------------------------------- */
  I.ru = {};
  I.uz = {};

  I.tables = { en: I.en, ru: I.ru, uz: I.uz };
  I.locales = ['en', 'ru', 'uz'];

  /* ----------------------------------------------------------- accessor */

  var missingSeen = {};      // key -> true; the warning fires once per key, not once per render

  function lookup(key, locale) {
    var chain = [locale].concat(I.fallbackChain[locale] || []);
    for (var i = 0; i < chain.length; i++) {
      var table = I.tables[chain[i]];
      if (table && typeof table[key] === 'string' && table[key] !== '') return table[key];
    }
    return null;
  }

  function interpolate(str, vars, key) {
    return str.replace(/\{(\w+)\}/g, function (token, name) {
      if (vars && vars[name] !== undefined && vars[name] !== null) return String(vars[name]);
      // A missing variable must never collapse to an empty string: "Based on
      // of 148 properties" reads as a rendering bug nobody can diagnose from
      // the screen. Leave the token visible and say so in the log.
      GEO.log.warn('i18n: no value for {' + name + '} in "' + key + '"');
      return token;
    });
  }

  /**
   * t('common.coverage', {n:16, m:148, field:'asking rent'})
   *   -> 'Based on 16 of 148 properties with verified asking rent.'
   *
   * A missing key returns the key itself and logs once. It is never blank and
   * never a placeholder dash: a gap has to be visible on screen to be fixed.
   */
  I.t = function (key, vars) {
    var s = lookup(key, I.locale);
    if (s === null) {
      if (!missingSeen[key]) {
        missingSeen[key] = true;
        GEO.log.warn('i18n: missing key "' + key + '" for locale "' + I.locale + '"');
      }
      return key;
    }
    return s.indexOf('{') < 0 ? s : interpolate(s, vars, key);
  };

  /** Is this key defined in `locale` itself (no fallback)? Used by the lint. */
  I.has = function (key, locale) {
    var table = I.tables[locale || I.locale];
    return !!(table && typeof table[key] === 'string' && table[key] !== '');
  };

  /**
   * Plural pairs are stored as `<key>.one` / `<key>.other`. English needs two
   * forms; Russian needs three, which is why the count is passed in rather
   * than the caller picking the key — a locale that adds `.few` then changes
   * nothing at the call sites.
   */
  I.plural = function (key, n, vars) {
    var v = {};
    Object.keys(vars || {}).forEach(function (k) { v[k] = vars[k]; });
    if (v.n === undefined) v.n = GEO.fmt.int(n);
    return I.t(key + (n === 1 ? '.one' : '.other'), v);
  };

  /* Formatting lives in 00-core so there is one implementation of the rounding
     and thousands rules; these are aliases so call sites never reach for
     `toLocaleString()` on their own. */
  I.num = function (v, dp) { return GEO.fmt.num(v, dp); };
  I.date = function (iso) { return GEO.fmt.date(iso); };

  /**
   * The §14/§36 denominator sentence. It is the most repeated and the most
   * safety-critical string in the product, so it has its own accessor and must
   * never be assembled by hand at a call site.
   */
  I.coverageLine = function (n, N, fieldLabel) {
    if (!N) return I.t('common.coverage.empty');
    if (!n) return I.t('common.coverage.zero', { field: fieldLabel });
    return I.t(N === 1 ? 'common.coverage.one' : 'common.coverage',
               { n: GEO.fmt.int(n), m: GEO.fmt.int(N), field: fieldLabel });
  };

  /* ------------------------------------------------------------ locales */

  /** Share of the English keys that `code` actually defines, 0..1. */
  I.coverage = function (code) {
    var target = I.tables[code];
    if (!target) return 0;
    var keys = Object.keys(I.en);
    if (!keys.length) return 0;
    var have = 0;
    keys.forEach(function (k) {
      if (typeof target[k] === 'string' && target[k] !== '') have++;
    });
    return have / keys.length;
  };

  /**
   * What the header language menu and the settings popover render. The reason
   * a locale is unavailable travels with the option, so neither panel has to
   * invent a disabled string of its own (§29 — every control acts, or is
   * disabled with a visible reason).
   */
  I.localeOptions = function () {
    var min = Math.round(I.MIN_COVERAGE * 100);
    return I.locales.map(function (code) {
      var cov = I.coverage(code);
      var pct = Math.round(cov * 100);
      var enabled = cov >= I.MIN_COVERAGE;
      return {
        code: code,
        label: I.localeNames[code],
        coverage: cov,
        pct: pct,
        enabled: enabled,
        current: code === I.locale,
        reasonKey: enabled ? null : (pct === 0 ? 'hdr.lang.disabled' : 'hdr.lang.partial'),
        reasonVars: { pct: pct, min: min }
      };
    });
  };

  /**
   * Switch locale. Per-key fallback means a partially filled table shows
   * English for the keys it lacks rather than a blank. Returns true if the
   * locale changed. No reload: listeners re-render from GEO.state.
   */
  I.setLocale = function (code) {
    if (!I.tables[code]) {
      GEO.log.warn('i18n: unknown locale "' + code + '" — staying on "' + I.locale + '"');
      return false;
    }
    if (code === I.locale) return true;
    I.locale = code;
    GEO.storage.set('locale', code);
    GEO.emit('i18n:locale', { locale: code, coverage: I.coverage(code) });
    return true;
  };

  /** Keys the running app asked for and did not find — the §29 gap list. */
  I.missing = function () { return Object.keys(missingSeen); };

  /** Every key in the table, sorted. Feeds the translator export and selftest. */
  I.keys = function () { return Object.keys(I.en).sort(); };

  /**
   * Resolve `data-i18n="key"` and `data-i18n-attr="aria-label:key;title:key"`
   * on static markup. Boot calls it once, and again on a locale change; it is
   * the bridge for any shell markup that carries a key instead of a literal.
   */
  I.applyStatic = function (root) {
    var scope = root || document;
    GEO.dom.$$('[data-i18n]', scope).forEach(function (node) {
      node.textContent = I.t(node.getAttribute('data-i18n'));
    });
    GEO.dom.$$('[data-i18n-attr]', scope).forEach(function (node) {
      node.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length === 2) node.setAttribute(bits[0].trim(), I.t(bits[1].trim()));
      });
    });
  };

  /**
   * Restore a previously chosen locale. A stored locale that is no longer
   * offered (because its table is empty) is ignored rather than silently
   * producing an English interface labelled "RU".
   */
  I.restore = function () {
    var stored = GEO.storage.get('locale', null);
    if (!stored || stored === I.locale) return I.locale;
    if (!I.tables[stored] || I.coverage(stored) < I.MIN_COVERAGE) {
      GEO.log.info('i18n: stored locale "' + stored + '" is not available — using "' + I.locale + '"');
      return I.locale;
    }
    I.locale = stored;
    return I.locale;
  };

  /* The IA names some of these accessors on the function itself (t.has,
     t.plural…). Both spellings point at one implementation so neither
     document's call sites are wrong. */
  I.t.has = I.has;
  I.t.plural = I.plural;
  I.t.num = I.num;
  I.t.date = I.date;
  I.t.coverageLine = I.coverageLine;
  I.t.coverageOf = I.coverage;
  I.t.setLocale = I.setLocale;

  I.restore();
}(window));
