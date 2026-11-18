/**
 * src/data/accessibilityAuditStandards.js
 * Benchmarks for measured accessibility audits (#948).
 *
 * Every benchmark carries the national guideline it comes from, the exact
 * threshold, a field-measurement tolerance, and the caveats that decide
 * whether it applies to the building being screened. Nothing here is a
 * certification: these are screening checks against published guidance.
 *
 * Sources used (all public Government of India documents):
 *  - CPWD / MoUD, "Harmonised Guidelines and Space Standards for Barrier Free
 *    Built Environment for Persons with Disabilities" (2016) — cited as HG2016.
 *  - CPWD, "Guidelines and Space Standards for Barrier Free Built Environment
 *    for Disabled and Elderly Persons" (1998) — cited as CPWD1998.
 *  - IS 4963:1987, "Recommendations for buildings and facilities for the
 *    physically handicapped" — cited as IS4963.
 *
 * Where a state building bye-law or a heritage exemption can change the
 * requirement, that is recorded in `caveats` and shown next to the result.
 */

export const AUDIT_SCHEMA_VERSION = '1.0.0';

/** Documents referenced by the benchmarks, so the UI can cite them once. */
export const AUDIT_SOURCES = {
  HG2016: {
    id: 'HG2016',
    title:
      'Harmonised Guidelines and Space Standards for Barrier Free Built Environment for Persons with Disabilities',
    publisher: 'CPWD, Ministry of Urban Development, Government of India',
    year: 2016,
    url: 'https://www.cpwd.gov.in/Publication/Harmonisedguidelinesdreleasedon23rdMarch2016.pdf',
  },
  CPWD1998: {
    id: 'CPWD1998',
    title:
      'Guidelines and Space Standards for Barrier Free Built Environment for Disabled and Elderly Persons',
    publisher: 'CPWD, Ministry of Urban Affairs and Employment, Government of India',
    year: 1998,
    url: 'https://cpwd.gov.in/Publication/aged&disabled.PDF',
  },
  IS4963: {
    id: 'IS4963',
    title: 'IS 4963: Recommendations for buildings and facilities for the physically handicapped',
    publisher: 'Bureau of Indian Standards',
    year: 1987,
    url: '',
  },
};

/** Facility groups used to order the measuring form and the findings table. */
export const FACILITY_GROUPS = [
  { id: 'ramp', label: 'Ramps and sloped access', order: 1 },
  { id: 'entrance', label: 'Entrance and doors', order: 2 },
  { id: 'route', label: 'Internal routes and corridors', order: 3 },
  { id: 'washroom', label: 'Accessible washroom', order: 4 },
  { id: 'counter', label: 'Service counter', order: 5 },
  { id: 'lift', label: 'Lift / elevator', order: 6 },
  { id: 'parking', label: 'Accessible parking', order: 7 },
];

export const MEASUREMENT_KINDS = Object.freeze({
  LENGTH: 'length',
  SLOPE: 'slope',
  COUNT: 'count',
});

/**
 * How a measurement is recorded. `absentValue` lets the auditor say a facility
 * does not exist, which is different from "I could not measure it".
 */
export const RECORDING_STATES = Object.freeze({
  RECORDED: 'recorded',
  UNKNOWN: 'unknown',
  NOT_APPLICABLE: 'not_applicable',
  UNABLE_TO_MEASURE: 'unable_to_measure',
});

export const RECORDING_STATE_LABELS = Object.freeze({
  recorded: 'Measured',
  unknown: 'Not measured yet',
  not_applicable: 'Not present / not applicable',
  unable_to_measure: 'Could not measure on site',
});

/**
 * Every benchmark: id, the facility it belongs to, the question asked, the
 * rule (min / max / range in canonical units), tolerance, source and caveats.
 *
 * Canonical units: lengths in millimetres, slopes in percent gradient
 * (8.33% == 1:12), counts in whole numbers.
 */
export const AUDIT_STANDARDS = [
  {
    id: 'ramp_gradient',
    facility: 'ramp',
    label: 'Ramp gradient',
    question: 'What is the steepest gradient along the ramp run?',
    kind: MEASUREMENT_KINDS.SLOPE,
    units: ['percent', 'ratio'],
    inputHint: 'Enter 8.3% or 1:12 — measure the steepest one-metre section, not the average.',
    required: true,
    severity: 'critical',
    rule: { type: 'max', target: 8.33, ideal: 6.67 },
    benchmarkText: 'Not steeper than 1:12 (8.33%). 1:15 (6.67%) or gentler is preferred.',
    source: { ...AUDIT_SOURCES.HG2016, clause: 'Ch. 4 — Internal ramps' },
    caveats: [
      'Temporary ramps and heritage buildings may be approved steeper by the local authority.',
      'Measure with a digital level or a spirit level on a straight edge; a phone inclinometer is only a screening estimate.',
    ],
    remediation:
      'Re-grade to 1:12 or gentler, or lengthen the ramp so the same rise is spread over more run. A compliant ramp is building work — raise it with the office head or the owning department.',
  },
  {
    id: 'ramp_width',
    facility: 'ramp',
    label: 'Clear ramp width',
    question: 'What is the narrowest clear width between the handrails or kerbs?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Narrowest point, measured between obstructions.',
    required: true,
    severity: 'major',
    rule: { type: 'min', target: 1800 },
    benchmarkText: 'At least 1800 mm for a ramped approach to an entrance.',
    source: { ...AUDIT_SOURCES.CPWD1998, clause: 'Ramped approach' },
    caveats: [
      'Internal retrofitted ramps are sometimes accepted at 1200 mm where the site cannot take 1800 mm; check the local bye-law.',
      'A 900 mm route is the absolute single-wheelchair minimum, not the requirement for a public entrance ramp.',
    ],
    remediation:
      'Free the ramp of stored goods and signage first; widening usually means structural work, so bundle it with any planned repair.',
  },
  {
    id: 'ramp_handrail_height',
    facility: 'ramp',
    label: 'Upper handrail height',
    question: 'What is the height of the upper handrail above the ramp surface?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Measure at the middle of the run, floor to top of the rail.',
    required: false,
    severity: 'minor',
    rule: { type: 'range', min: 900, max: 1000 },
    benchmarkText: 'Upper rail 900–1000 mm above the surface; a second rail at 650–750 mm.',
    source: { ...AUDIT_SOURCES.HG2016, clause: 'Ch. 4 — Handrails' },
    caveats: [
      'Older CPWD guidance specified a single rail at 800 mm, so an existing 800 mm rail is common and still grip-able.',
      'Both-sides handrails are required where the rise is over 150 mm or the run exceeds 1800 mm.',
    ],
    remediation: 'Add a second rail at the correct height rather than moving the existing one if both are needed.',
  },
  {
    id: 'ramp_handrail_extension',
    facility: 'ramp',
    label: 'Handrail extension past the ramp',
    question: 'How far does the handrail extend beyond the top and bottom of the ramp?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Use the shorter of the two ends.',
    required: false,
    severity: 'minor',
    rule: { type: 'min', target: 300 },
    benchmarkText: 'Extend at least 300 mm beyond the top and bottom of the ramp.',
    source: { ...AUDIT_SOURCES.HG2016, clause: 'Ch. 4 — Handrails' },
    caveats: ['A rail that stops flush with the ramp is still usable; the extension is a safety margin.'],
    remediation: 'Extend the rail by 300 mm at each end, turned down or returned to the wall.',
  },
  {
    id: 'door_clear_width',
    facility: 'entrance',
    label: 'Clear entrance door width',
    question: 'What is the clear opening of the accessible entrance door, fully open?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Measure between the door face and the stop, with the door open at 90°.',
    required: true,
    severity: 'critical',
    rule: { type: 'min', target: 900, ideal: 1000 },
    benchmarkText: 'At least 900 mm clear; 1000 mm or more preferred for public buildings.',
    source: { ...AUDIT_SOURCES.HG2016, clause: '4.10.2 — Clear width of doorways' },
    caveats: [
      'Measure the clear opening, not the frame width: a 1000 mm frame can give a 850 mm clear opening.',
      'Revolving doors and turnstiles need an adjacent side-hung door of at least 900 mm clear.',
    ],
    remediation:
      'Widen the opening or fit a leaf that gives 900 mm clear. Until then, ask the office for an alternative accessible entry and record who confirmed it.',
  },
  {
    id: 'door_threshold_height',
    facility: 'entrance',
    label: 'Door threshold height',
    question: 'What is the height of the threshold or step at the accessible entrance?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm'],
    inputHint: 'Measure the step at the door line; enter 0 if flush.',
    required: true,
    severity: 'major',
    rule: { type: 'max', target: 12 },
    benchmarkText: 'Thresholds, where unavoidable, must not exceed 12 mm.',
    source: { ...AUDIT_SOURCES.HG2016, clause: '5.7.3 — Thresholds' },
    caveats: ['A bevelled threshold up to 12 mm is passable; anything higher needs a ramp or a level change.'],
    remediation: 'Replace the threshold with a flush or bevelled strip no higher than 12 mm.',
  },
  {
    id: 'corridor_width',
    facility: 'route',
    label: 'Corridor clear width',
    question: 'What is the narrowest clear width on the route from the entrance to the service counter?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Narrowest point on the route the public actually uses.',
    required: true,
    severity: 'major',
    rule: { type: 'min', target: 1500 },
    benchmarkText: 'At least 1500 mm on an accessible route where a wheelchair and a walking person pass.',
    source: { ...AUDIT_SOURCES.HG2016, clause: '5.5.1 — Accessible route width' },
    caveats: [
      'Within a staff work area 900 mm is the minimum; that does not apply to the public route.',
      'Temporary obstructions (chairs, queue barriers, photocopiers) are the usual cause — record what blocked it.',
    ],
    remediation: 'Clear the route of furniture and queue barriers; if the corridor itself is narrow, ask for a wider alternative route.',
  },
  {
    id: 'manoeuvring_space',
    facility: 'route',
    label: 'Wheelchair turning space',
    question: 'What is the smallest clear turning circle a wheelchair can complete (for example at the counter or at a dead end)?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Diameter of the clear circle, ignoring furniture that can be moved.',
    required: false,
    severity: 'major',
    rule: { type: 'min', target: 1500, ideal: 2000 },
    benchmarkText: '1500 mm diameter minimum; 2000 mm is the comfortable size.',
    source: { ...AUDIT_SOURCES.HG2016, clause: '3.1.1.2 — Circulation dimensions' },
    caveats: ['A 1500 mm circle counts only if nothing (including a door swing) intrudes into it.'],
    remediation: 'Move furniture or open a queuing area to free a 1500 mm circle.',
  },
  {
    id: 'washroom_clear_width',
    facility: 'washroom',
    label: 'Accessible washroom width',
    question: 'What is the clear internal width of the accessible washroom?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Wall to wall inside the cubicle or room, widest clear span.',
    required: true,
    severity: 'major',
    rule: { type: 'min', target: 1500 },
    benchmarkText: 'At least 1500 mm across, in a cubicle of at least 1500 × 1750 mm.',
    source: { ...AUDIT_SOURCES.CPWD1998, clause: 'Toilets' },
    caveats: [
      'Some state bye-laws accept 1500 × 1500 mm where the layout cannot take 1750 mm.',
      'A converted staff toilet is rarely compliant even when it is offered as "accessible".',
    ],
    remediation: 'Re-plan the cubicle so the clear span reaches 1500 mm; a folding door often recovers 100 mm.',
  },
  {
    id: 'washroom_clear_depth',
    facility: 'washroom',
    label: 'Accessible washroom depth',
    question: 'What is the clear internal depth of the accessible washroom?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Measure front to back, clear of the cistern and basin.',
    required: true,
    severity: 'major',
    rule: { type: 'min', target: 1750 },
    benchmarkText: 'At least 1750 mm deep, alongside the 1500 mm width.',
    source: { ...AUDIT_SOURCES.CPWD1998, clause: 'Toilets' },
    caveats: ['Check the local bye-law: 1500 × 1500 mm is accepted in some jurisdictions.'],
    remediation: 'Relocate the basin outside the cubicle to recover the depth.',
  },
  {
    id: 'washroom_door_width',
    facility: 'washroom',
    label: 'Accessible washroom door width',
    question: 'What is the clear opening of the washroom door, fully open?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Measure the clear opening, not the frame.',
    required: true,
    severity: 'major',
    rule: { type: 'min', target: 900 },
    benchmarkText: 'At least 900 mm clear, with the door swinging out or sliding.',
    source: { ...AUDIT_SOURCES.CPWD1998, clause: 'Toilets' },
    caveats: ['An inward-opening door can trap a wheelchair user; note the swing direction alongside the width.'],
    remediation: 'Re-hang the door to swing out, or fit a sliding door that gives 900 mm clear.',
  },
  {
    id: 'grab_bar_height',
    facility: 'washroom',
    label: 'Grab bar height',
    question: 'What is the height of the horizontal grab bar above the floor?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm'],
    inputHint: 'Floor to centre of the bar.',
    required: false,
    severity: 'minor',
    rule: { type: 'range', min: 800, max: 900 },
    benchmarkText: 'Horizontal grab bar at 800–900 mm above the finished floor.',
    source: { ...AUDIT_SOURCES.IS4963 },
    caveats: [
      'Bars must also take weight: a bar that pulls out of the wall is a hazard at any height.',
      'IS 4963 has been revised; confirm the edition your local authority cites.',
    ],
    remediation: 'Re-fix the bar at 800–900 mm into a solid backing, not plasterboard.',
  },
  {
    id: 'basin_knee_height',
    facility: 'washroom',
    label: 'Wash basin knee clearance',
    question: 'What is the height of the underside of the basin (knee space)?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm'],
    inputHint: 'Floor to the lowest underside of the basin or its trap cover.',
    required: false,
    severity: 'minor',
    rule: { type: 'min', target: 650 },
    benchmarkText: 'Knee space at least 650 mm high, 480 mm deep and 900 mm wide.',
    source: { ...AUDIT_SOURCES.HG2016, clause: '3.1.1.2 — Circulation dimensions' },
    caveats: ['An exposed hot-water trap under the basin defeats the knee space even when the height is correct.'],
    remediation: 'Replace the basin with a wall-hung or semi-recessed model that leaves 650 mm clear underneath.',
  },
  {
    id: 'counter_knee_height',
    facility: 'counter',
    label: 'Counter knee clearance',
    question: 'What is the height of the clear space under the service counter?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm'],
    inputHint: 'Floor to the underside of the counter, at the accessible position.',
    required: false,
    severity: 'major',
    rule: { type: 'min', target: 650 },
    benchmarkText: 'Clear knee space at least 650 mm high and 900 mm wide at one counter position.',
    source: { ...AUDIT_SOURCES.HG2016, clause: '3.1.1.2 — Circulation dimensions' },
    caveats: [
      'The national guidelines fix the knee clearance but not the worktop height; 750–800 mm is usual in practice.',
      'A lowered counter with a fixed stool in front of it is not usable.',
    ],
    remediation: 'Identify one counter bay, remove the modesty panel and the stool, and keep it free for wheelchair users.',
  },
  {
    id: 'lift_door_width',
    facility: 'lift',
    label: 'Lift door clear width',
    question: 'What is the clear opening of the lift door?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Measure the clear opening with the doors fully open.',
    required: false,
    severity: 'major',
    rule: { type: 'min', target: 900 },
    benchmarkText: 'Lift entrance at least 900 mm clear.',
    source: { ...AUDIT_SOURCES.HG2016, clause: 'Ch. 4 — Elevators and lifts' },
    caveats: [
      'State bye-laws and the lift licence conditions also apply; check with the building authority.',
      'A lift that stops between floors, or has no audible announcement, fails in practice even with a wide door.',
    ],
    remediation: 'Raise the door width with the lift maintenance contractor — it is rarely fixable by the office alone.',
  },
  {
    id: 'parking_bay_width',
    facility: 'parking',
    label: 'Accessible parking bay width',
    question: 'What is the clear width of the designated accessible parking bay?',
    kind: MEASUREMENT_KINDS.LENGTH,
    units: ['mm', 'cm', 'm'],
    inputHint: 'Measure the marked bay, excluding any adjacent hatch marking used for transfer.',
    required: false,
    severity: 'minor',
    rule: { type: 'min', target: 3600 },
    benchmarkText: 'About 3600 mm wide, so a door can open fully beside the vehicle.',
    source: { ...AUDIT_SOURCES.HG2016, clause: 'Ch. 5 — Parking' },
    caveats: [
      'Requirements differ between municipal bye-laws; verify the figure your local authority uses.',
      'A bay that exists only as paint, without a sign, is usually occupied by other vehicles.',
    ],
    remediation: 'Re-mark the bay to the local requirement and add a sign and a hatch transfer strip.',
  },
];

export const STANDARD_BY_ID = AUDIT_STANDARDS.reduce((acc, standard) => {
  acc[standard.id] = standard;
  return acc;
}, {});

export const REQUIRED_STANDARDS = AUDIT_STANDARDS.filter((standard) => standard.required);

/** Plausible measurement bounds, to reject typos and unit mistakes. */
export const MEASUREMENT_BOUNDS = Object.freeze({
  length: { min: 0, max: 100000 }, // mm
  slope: { min: 0, max: 100 }, // percent
  count: { min: 0, max: 10000 },
});

export const MEASUREMENT_STATUS = Object.freeze({
  PASS: 'pass',
  AT_LIMIT: 'at_limit',
  FAIL: 'fail',
  UNKNOWN: 'unknown',
  NOT_APPLICABLE: 'not_applicable',
  INVALID: 'invalid',
});

export const MEASUREMENT_STATUS_LABELS = Object.freeze({
  pass: 'Meets benchmark',
  at_limit: 'At the limit — re-measure',
  fail: 'Below benchmark',
  unknown: 'Not measured',
  not_applicable: 'Not present',
  invalid: 'Invalid entry',
});

export const REMEDIATION_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
});

export const REMEDIATION_STATUS_LABELS = Object.freeze({
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Marked done',
  verified: 'Verified by re-assessment',
  cancelled: 'Cancelled',
});

export const REMEDIATION_PRIORITY = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const MAX_NOTE_LENGTH = 300;
export const MAX_OWNER_LENGTH = 120;
export const MAX_AUDITS_PER_OFFICE = 50;
export const DEFAULT_FOLLOW_UP_DAYS = 14;
export const DUE_SOON_DAYS = 14;

/** Days allowed before a finding should be fixed, by severity. */
export const TARGET_DAYS_BY_SEVERITY = Object.freeze({
  critical: 30,
  major: 90,
  minor: 180,
});

/**
 * Shown with every result. The wording matters: this is a screening tool, not
 * a certified accessibility audit.
 */
export const SCREENING_DISCLAIMER =
  'These results are a preliminary screening by a citizen or volunteer against published national guidance. They are not a certified accessibility audit, they do not bind the office or the municipality, and they are not a legal opinion. Field measurements carry error, so a result at the limit should be re-measured before anyone relies on it.';

export const BENCHMARK_CAVEAT =
  'Benchmarks come from central government guidelines. State building bye-laws, heritage exemptions and the building’s approval conditions can be stricter or looser, and the local authority’s rule prevails.';

export const LOCAL_ONLY_NOTICE =
  'Measurements, notes and remediation plans stay in this browser. Nothing is uploaded, and no personal details are stored with an audit.';
