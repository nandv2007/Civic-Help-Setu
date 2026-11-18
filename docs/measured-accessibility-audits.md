# Measured Accessibility Audits & Remediation Tracking (#948)

An office accessibility checklist usually produces a page of tick marks: *ramp present — yes*. That
does not tell a wheelchair user whether the ramp is usable, and it does not tell the office whether
last quarter's problem was ever fixed.

This workspace replaces the tick box with a **measurement**: a number, a unit and a benchmark, so a
result can be read as **meets**, **at the limit** or **below** the benchmark — and, just as
importantly, as **not measured** when nobody actually measured it. Every assessment is kept, so a
later visit can show whether the ramp got better, stayed the same or got worse, and every finding can
carry a remediation action with an owner, a target date and a follow-up assessment.

> **This is preliminary screening, not a certified accessibility audit.** It compares a handful of
> measurements against published guideline benchmarks. It does not certify an office, does not
> replace an accessibility audit by a qualified professional, and cannot see anything that was not
> measured. See [Not a certified audit](#not-a-certified-audit).

Route: `/accessibility-audit` (also `/accessibility-audits`, `/services/accessibility-audit`)

Code:

| File | Purpose |
| --- | --- |
| `src/data/accessibilityAuditStandards.js` | Benchmark catalogue, sources, units, bounds, statuses, limits, wording |
| `src/services/accessibilityAuditEngine.js` | Unit normalisation, benchmark evaluation, summaries, findings, reassessment comparison |
| `src/services/accessibilityAuditService.js` | Assessment building, remediation actions, history, printable/text exports |
| `src/services/accessibilityAuditStorage.js` | Local-only store of assessments per office (cap, pruning, corrupt-payload handling) |
| `src/components/accessibilityAudit/*` | Measurement form, results table, remediation plan, history, status chips, CSV, styles |
| `src/pages/AccessibilityAuditWorkspace.jsx` | The three-tab workspace (Measure / Findings & plan / History) |

---

## 1. What gets measured

Sixteen benchmarks across seven facility groups. Each benchmark asks one question, has one unit, one
binding clause and its own caveats:

| Group | Benchmarks |
| --- | --- |
| Ramp | gradient, clear width, upper handrail height, handrail extension past the ramp |
| Entrance | clear door width, threshold height |
| Accessible route | corridor clear width, wheelchair turning space |
| Accessible washroom | width, depth, door clear width, grab bar height, wash basin knee clearance |
| Counter | counter knee clearance |
| Lift | door clear width |
| Parking | accessible bay width |

The benchmark panel in the workspace shows, for each one: the required threshold, the source and
clause, and the caveats that decide whether it applies to *this* office at all.

## 2. Units and validation

Values are entered in millimetres, metres, or — for ramp gradient — as a ratio (`1:12`) or a
percentage (`8.33%`). `normalizeMeasurement` converts to a single canonical form (mm, or gradient as
a rise/run ratio) before anything is compared, so `1500`, `1.5 m` and `1.5m` are the same
measurement, and `1:12` and `8.33%` are the same gradient.

A value is rejected as **invalid** — and never silently treated as a pass — when it is:

- non-numeric, or not a real measurement (`1.5.0`, `--12`);
- outside `MEASUREMENT_BOUNDS` for that kind (e.g. a 14000 mm door, a gradient steeper than 1:1);
- zero or negative where only a positive length makes sense;
- in the wrong unit for the field (`1.5 mm` for a width when metres were meant is caught by the bounds
  check, not by guessing).

Invalid input blocks the save with a per-field message. It is never rounded into a result.

## 3. What a result means

Five outcomes, deliberately distinct:

| Status | Meaning |
| --- | --- |
| `pass` | The measurement meets the benchmark, outside the tolerance band |
| `at_limit` | Within ±10 mm (±0.5 gradient points) of a minimum or maximum — usable, but with no margin |
| `fail` | The measurement is on the wrong side of the benchmark |
| `unknown` | Relevant, but **nobody measured it** |
| `not_applicable` | The office does not have this feature (no lift, no parking) |
| `invalid` | A value was entered but cannot be read as a measurement |

`unknown` is the key distinction the issue asked for. "We did not measure the washroom" and "the
washroom is too small" are different problems with different fixes, so they are never collapsed into
one "not accessible" bucket. `not_applicable` likewise never counts as a pass: a building with no
lift does not get credit for lift door width, and the summary reports it separately.

```
measured   = pass + at_limit + fail
assessed   = measured + not_applicable
total      = assessed + unknown
```

The tolerance band exists because a tape measure read by hand is not a CAD drawing: 1495 mm against a
1500 mm benchmark is recorded as `at_limit`, not as a fail.

## 4. Benchmarks, sources and applicability

Benchmarks are transcribed from published Indian guidance:

| Id | Source |
| --- | --- |
| `HG2016` | *Harmonised Guidelines and Space Standards for Barrier Free Built Environment for Persons with Disabilities and Elderly Persons*, CPWD / Ministry of Urban Development, 2016 |
| `CPWD1998` | CPWD *Guidelines and Space Standards for Barrier Free Built Environment for Disabled and Elderly Persons*, 1998 |
| `IS4963` | IS 4963:1987, *Recommendations for buildings and facilities for the physically handicapped* |

Examples of what the catalogue encodes: ramp gradient maximum 1:12 (1:15 preferred), ramp width
1800 mm, clear entrance door 900 mm, threshold ≤ 12 mm, corridor 1500 mm, wheelchair turning space
1500 mm (2000 mm preferred), accessible toilet 1500 × 1750 mm, grab bar 800–900 mm, lift door
900 mm.

Honesty about the sources is part of the feature:

- The benchmark text is **transcribed and paraphrased**, not quoted clause by clause; the source and
  clause id are shown next to every benchmark so a reader can check the original.
- These are guidelines/standards, not a statute that this app can enforce, and local by-laws or a
  state's own rules may be stricter. A measurement that meets these benchmarks is not thereby
  "compliant" in law.
- Each benchmark carries its own applicable caveats — e.g. the gradient limit applies to the ramp
  that is the accessible route, not to a service ramp; grab bar height is checked in the accessible
  cubicle, not in every cubicle.
- Where a guideline states a preferred value as well as a binding minimum, only the minimum is used
  for pass/fail, and the preferred value is shown as guidance.
- The catalogue is versioned (`AUDIT_SCHEMA_VERSION` 1.0.0, shown as "benchmarks v1.0.0"). Stored
  assessments record that version, so an assessment made under older benchmarks is not silently
  compared against new ones.

Nothing here is fetched at runtime: the catalogue is a static local file, and the source links are
opened only when the user clicks them.

## 5. Findings and the remediation plan

Every failing or at-limit measurement becomes a finding with a severity (from the benchmark), a
suggested remediation (from the benchmark's own `remediation` text) and a suggested target date
(30 / 90 / 180 days by severity; the user can override it, clamped to 1–365 days).

A remediation action carries:

- the benchmark it fixes, the measured value at the time it was raised, and its priority;
- an owner (free text, capped at 120 characters) and a target date;
- a status: `open`, `in_progress`, `blocked`, `resolved` (the office says the work is done) or
  `verified` (a **later assessment measured a pass**);
- the note field (capped at 300 characters).

Actions are carried forward between assessments and de-duplicated by benchmark, so the plan is a
live register rather than a per-visit list. `verified` can only be set by a measurement — not by the
office marking its own work done. That is the whole point of tracking resolution with measurements.

The plan view sorts overdue → due soon (14 days) → later → done, and shows counts by status.

## 6. Reassessment history

Every save appends an assessment; up to 50 per office are kept (`MAX_AUDITS_PER_OFFICE`), and the
oldest is pruned with a message rather than silently. The History tab lists assessments newest
first and compares any selected one with the one before it, per benchmark:

| Change | Meaning |
| --- | --- |
| `improved` | The benchmark's status moved up a rank (fail → at_limit → pass) |
| `worse` | It moved down |
| `unchanged` | Same rank as before |
| `first_measurement` | This benchmark was not measured in the earlier assessment |
| `not_measured` | It is not measured now (and previously was, or the benchmark itself is unknown) |

A benchmark that was never measured in either assessment is never reported as "unchanged" — that
would imply it was checked. Comparison uses a status rank (fail 0, at_limit 1, pass 2), so a
measurement that got worse but is still in the same band (1050 mm → 1000 mm, both fails) shows as
`unchanged` in status while the "then" and "now" columns keep both values.

## 7. Accessibility of the workspace itself

- The measurement form uses real `<label>` elements tied to inputs, `aria-describedby` for hints and
  errors, `aria-invalid` on invalid fields, and `<fieldset>/<legend>` per facility group.
- The results table has a `<caption>`, `scope="col"` headers and `scope="row"` benchmark names; the
  status is text ("Meets benchmark", "Not measured"), never colour alone.
- Tabs are real `role="tab"` / `role="tabpanel"` with arrow-key-free explicit buttons (`aria-selected`,
  `aria-controls`).
- The sticky action bar keeps Save, Print, text summary and CSV reachable while scrolling.
- Status chips pair an icon, a word and a colour, and the styles honour
  `prefers-reduced-motion` and the light theme.
- A printable report is generated from the same data (`buildPrintableReport`), with a print
  stylesheet (`@media print`) that drops the navigation, buttons and hints.
- Exports: a plain-text summary and a CSV of every measurement with its result, benchmark and source
  id — both generated locally, in the browser.

## 8. Local-only, and what is stored

Assessments are saved in `localStorage` under `civicbridge_accessibility_audits_v1`, keyed by office,
with a payload schema version. Nothing is uploaded; there is no API route, no Firebase write and no
third-party call — the same rule as the rest of the civic workspaces.

- A corrupt or outdated payload is dropped rather than partially rendered, and the workspace says so.
- If `localStorage` is unavailable (private mode, quota), the workspace keeps working in memory for
  the session and the save message says the assessment was not persisted.
- Deleting an assessment removes it from the local store only. There is no server copy to delete.

## 9. Not a certified audit

The screen and the printable report say the same thing, in the same words:

> This is a preliminary screening, not a certified accessibility audit. It records what was measured
> against published benchmarks on the date shown. It is not a compliance certificate, and it does not
> cover barriers that were not measured.

What that means in practice:

- **It cannot pass an office.** Only the benchmarks in the catalogue are checked; door handles,
  signage, lighting, acoustics, staff training, path of travel from the street and everything else
  that makes a building usable are outside it.
- **Unknown is not a pass.** An office with twenty unmeasured benchmarks is not "accessible"; it is
  "not measured yet", and the summary says so.
- **Benchmarks are guidance.** See §4 — the guidelines are not law, and local rules may differ.
- **The plan is a register, not a work order.** It records what the office intends to do and what a
  later measurement showed.

## 10. Tests

```bash
npm test -- --run src/services/accessibilityAuditEngine.test.js    # 28: units, bounds, tolerance, statuses, comparison
npm test -- --run src/services/accessibilityAuditService.test.js   # 24: assessment building, plan, history, exports, escaping
npm test -- --run src/pages/AccessibilityAuditWorkspace.test.jsx   # 22: tabs, form, table, plan, history, report
```

They cover, specifically:

- measurement boundaries: exactly on the benchmark, exactly at the tolerance edge, one unit past it,
  and out-of-range values that must be rejected rather than rounded;
- incomplete input: `unknown` vs `not_applicable` vs `invalid`, and a summary that never counts them
  as a pass;
- reassessments: improvement, regression, no change, a benchmark newly measured, a benchmark that
  stopped being measured, and a carried-forward remediation action becoming `verified` only after a
  later pass;
- escaping: user text in the printable report and the text summary appears escaped exactly once
  (`&amp;`, not `&amp;amp;`).
