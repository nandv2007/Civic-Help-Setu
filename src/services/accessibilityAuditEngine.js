/**
 * src/services/accessibilityAuditEngine.js
 * Deterministic rules engine for measured accessibility audits (#948).
 *
 * Responsibilities:
 *  - normalise a typed measurement (value + unit) into canonical units,
 *  - reject impossible or mistyped values,
 *  - evaluate a measurement against its benchmark, keeping three states apart:
 *      unknown        — nobody measured it (or the auditor could not),
 *      not_applicable — the facility does not exist at this office,
 *      fail           — it was measured and is below the benchmark.
 *
 * No inference, no scoring heuristics: every result points at the number that
 * produced it, the benchmark and the document the benchmark comes from.
 */

import {
  AUDIT_STANDARDS,
  STANDARD_BY_ID,
  MEASUREMENT_BOUNDS,
  MEASUREMENT_KINDS,
  MEASUREMENT_STATUS,
  RECORDING_STATES,
  TARGET_DAYS_BY_SEVERITY,
} from '../data/accessibilityAuditStandards.js';

const LENGTH_FACTORS_TO_MM = {
  mm: 1,
  cm: 10,
  m: 1000,
};

/**
 * Field measurement tolerance: a reading within this distance of a threshold is
 * reported as "at the limit" instead of silently passing or failing, because a
 * hand measurement is not precise enough to decide it.
 */
const TOLERANCE = {
  length: 10, // mm
  slope: 0.5, // percentage points
  count: 0,
};

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Converts a slope ratio ("1:12") to percent gradient.
 * Returns null when the text is not a usable ratio.
 */
export function ratioToPercent(text) {
  if (typeof text !== 'string') return null;
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const rise = Number(match[1]);
  const run = Number(match[2]);
  if (!Number.isFinite(rise) || !Number.isFinite(run) || rise <= 0 || run <= 0) return null;
  return round((rise / run) * 100, 2);
}

/** Converts percent gradient back to a "1:N" ratio for display. */
export function percentToRatio(percent) {
  if (!Number.isFinite(percent) || percent <= 0) return '';
  return `1:${round(100 / percent, 1)}`;
}

/**
 * Normalises one typed measurement.
 *
 * @param {string|number} rawValue the typed value
 * @param {string} unit one of the units allowed for the standard
 * @param {object} standard a benchmark from AUDIT_STANDARDS
 * @returns {{ status: string, canonical: number|null, value: number|null, unit: string, error: string }}
 */
export function normalizeMeasurement(rawValue, unit, standard) {
  const kind = standard?.kind || MEASUREMENT_KINDS.LENGTH;
  const allowedUnits = standard?.units || ['mm'];

  if (unit && !allowedUnits.includes(unit)) {
    return {
      status: MEASUREMENT_STATUS.INVALID,
      canonical: null,
      value: null,
      unit: unit || '',
      error: `Unit "${unit}" is not used for this measurement.`,
    };
  }

  const effectiveUnit = unit || allowedUnits[0];
  const text = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

  if (text === '' || text === null || text === undefined) {
    return {
      status: MEASUREMENT_STATUS.INVALID,
      canonical: null,
      value: null,
      unit: effectiveUnit,
      error: 'Enter a number, or mark the facility as not present.',
    };
  }

  let value;

  if (kind === MEASUREMENT_KINDS.SLOPE && effectiveUnit === 'ratio') {
    const percent = ratioToPercent(String(text));
    if (percent === null) {
      return {
        status: MEASUREMENT_STATUS.INVALID,
        canonical: null,
        value: null,
        unit: effectiveUnit,
        error: 'Write a ratio like 1:12 (rise : run).',
      };
    }
    value = percent;
  } else {
    // Accept "900", "900 mm" and " 900 " but nothing else.
    const cleaned = String(text)
      .replace(/\s*(mm|cm|m|%)\s*$/i, '')
      .trim();
    if (!/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) {
      return {
        status: MEASUREMENT_STATUS.INVALID,
        canonical: null,
        value: null,
        unit: effectiveUnit,
        error: 'Enter a number only, for example 900.',
      };
    }
    value = Number(cleaned.replace(',', '.'));
  }

  if (!Number.isFinite(value)) {
    return {
      status: MEASUREMENT_STATUS.INVALID,
      canonical: null,
      value: null,
      unit: effectiveUnit,
      error: 'That is not a number I can read.',
    };
  }

  if (value < 0) {
    return {
      status: MEASUREMENT_STATUS.INVALID,
      canonical: null,
      value: null,
      unit: effectiveUnit,
      error: 'A measurement cannot be negative.',
    };
  }

  let canonical = value;

  if (kind === MEASUREMENT_KINDS.LENGTH && effectiveUnit !== 'mm') {
    canonical = value * LENGTH_FACTORS_TO_MM[effectiveUnit];
  }

  if (kind === MEASUREMENT_KINDS.LENGTH && effectiveUnit === 'mm') {
    canonical = value;
  }

  if (kind === MEASUREMENT_KINDS.SLOPE && effectiveUnit === 'ratio') {
    // already converted above
    canonical = value;
  }

  const bounds = MEASUREMENT_BOUNDS[kind] || MEASUREMENT_BOUNDS.length;

  if (canonical < bounds.min || canonical > bounds.max) {
    return {
      status: MEASUREMENT_STATUS.INVALID,
      canonical: null,
      value: null,
      unit: effectiveUnit,
      error:
        kind === MEASUREMENT_KINDS.LENGTH
          ? 'That is outside the range this form accepts (0–100,000 mm). Check the unit — metres entered as millimetres is the usual mistake.'
          : 'That is outside the range this form accepts. Check the value and the unit.',
    };
  }

  return {
    status: MEASUREMENT_STATUS.RECORDED,
    canonical: round(canonical, 2),
    value: round(value, 2),
    unit: effectiveUnit,
    error: '',
  };
}

/** Human formatting of a canonical measurement. */
export function formatMeasurement(standard, canonical) {
  if (!Number.isFinite(canonical)) return '—';
  const kind = standard?.kind || MEASUREMENT_KINDS.LENGTH;

  if (kind === MEASUREMENT_KINDS.SLOPE) {
    return `${round(canonical, 2)}% (${percentToRatio(canonical)})`;
  }
  if (kind === MEASUREMENT_KINDS.COUNT) {
    return `${canonical}`;
  }
  if (canonical >= 1000) return `${round(canonical / 1000, 2)} m (${round(canonical, 0)} mm)`;
  return `${round(canonical, 0)} mm`;
}

/**
 * Evaluates a recorded measurement against a standard's rule.
 *
 * @param {object} standard benchmark
 * @param {number} canonical measurement in canonical units
 * @returns {{ status: string, message: string }}
 */
export function evaluateAgainstStandard(standard, canonical) {
  if (!standard || !Number.isFinite(canonical)) {
    return { status: MEASUREMENT_STATUS.UNKNOWN, message: 'No measurement recorded.' };
  }

  const rule = standard.rule || {};
  const tolerance = TOLERANCE[standard.kind] ?? 0;

  if (rule.type === 'min') {
    if (canonical < rule.target - tolerance) {
      return {
        status: MEASUREMENT_STATUS.FAIL,
        message: `${formatMeasurement(standard, canonical)} is below the ${formatMeasurement(standard, rule.target)} minimum.`,
      };
    }
    if (canonical < rule.target) {
      return {
        status: MEASUREMENT_STATUS.AT_LIMIT,
        message: `${formatMeasurement(standard, canonical)} is within measurement error of the ${formatMeasurement(standard, rule.target)} minimum — re-measure with a better tool before relying on it.`,
      };
    }
    return {
      status: MEASUREMENT_STATUS.PASS,
      message: `${formatMeasurement(standard, canonical)} meets the ${formatMeasurement(standard, rule.target)} minimum.`,
    };
  }

  if (rule.type === 'max') {
    if (canonical > rule.target + tolerance) {
      return {
        status: MEASUREMENT_STATUS.FAIL,
        message: `${formatMeasurement(standard, canonical)} is above the ${formatMeasurement(standard, rule.target)} maximum.`,
      };
    }
    if (canonical > rule.target) {
      return {
        status: MEASUREMENT_STATUS.AT_LIMIT,
        message: `${formatMeasurement(standard, canonical)} is within measurement error of the ${formatMeasurement(standard, rule.target)} maximum — re-measure before relying on it.`,
      };
    }
    return {
      status: MEASUREMENT_STATUS.PASS,
      message: `${formatMeasurement(standard, canonical)} is within the ${formatMeasurement(standard, rule.target)} maximum.`,
    };
  }

  if (rule.type === 'range') {
    if (canonical < rule.min - tolerance || canonical > rule.max + tolerance) {
      return {
        status: MEASUREMENT_STATUS.FAIL,
        message: `${formatMeasurement(standard, canonical)} is outside the ${formatMeasurement(standard, rule.min)}–${formatMeasurement(standard, rule.max)} range.`,
      };
    }
    if (canonical < rule.min || canonical > rule.max) {
      return {
        status: MEASUREMENT_STATUS.AT_LIMIT,
        message: `${formatMeasurement(standard, canonical)} sits on the edge of the ${formatMeasurement(standard, rule.min)}–${formatMeasurement(standard, rule.max)} range — re-measure.`,
      };
    }
    return {
      status: MEASUREMENT_STATUS.PASS,
      message: `${formatMeasurement(standard, canonical)} is inside the ${formatMeasurement(standard, rule.min)}–${formatMeasurement(standard, rule.max)} range.`,
    };
  }

  return { status: MEASUREMENT_STATUS.UNKNOWN, message: 'This benchmark has no threshold to compare against.' };
}

/**
 * Evaluates one answer from the audit form.
 *
 * An answer is { standardId, state, value, unit, note }. `state` is one of
 * RECORDING_STATES. Everything is resolved to a single result object so the
 * UI, the report and the remediation planner read the same thing.
 */
export function evaluateAnswer({ standardId, state = RECORDING_STATES.UNKNOWN, value = '', unit = '', note = '' }) {
  const standard = STANDARD_BY_ID[standardId];

  if (!standard) {
    return {
      standardId,
      standard: null,
      label: standardId,
      status: MEASUREMENT_STATUS.INVALID,
      message: 'Unknown benchmark.',
      canonical: null,
      recorded: false,
    };
  }

  const base = {
    standardId,
    standard,
    label: standard.label,
    facility: standard.facility,
    requirement: standard.benchmarkText,
    source: standard.source,
    caveats: standard.caveats || [],
    note: typeof note === 'string' ? note : '',
    canonical: null,
    displayValue: '—',
    required: Boolean(standard.required),
    severity: standard.severity,
  };

  if (state === RECORDING_STATES.NOT_APPLICABLE) {
    return {
      ...base,
      status: MEASUREMENT_STATUS.NOT_APPLICABLE,
      message: 'Marked as not present at this office. This is not a compliance finding.',
    };
  }

  if (state !== RECORDING_STATES.RECORDED) {
    return {
      ...base,
      status: MEASUREMENT_STATUS.UNKNOWN,
      message:
        state === RECORDING_STATES.UNABLE_TO_MEASURE
          ? 'The auditor could not measure this on site. It stays unknown rather than passing or failing.'
          : 'Not measured yet.',
    };
  }

  const normalised = normalizeMeasurement(value, unit, standard);

  if (normalised.status === MEASUREMENT_STATUS.INVALID) {
    return {
      ...base,
      status: MEASUREMENT_STATUS.INVALID,
      message: normalised.error,
      displayValue: String(value ?? ''),
    };
  }

  const evaluation = evaluateAgainstStandard(standard, normalised.canonical);

  return {
    ...base,
    status: evaluation.status,
    message: evaluation.message,
    canonical: normalised.canonical,
    displayValue: formatMeasurement(standard, normalised.canonical),
    enteredValue: normalised.value,
    enteredUnit: normalised.unit,
  };
}

/** Evaluates the whole answer set, in the order the benchmarks are declared. */
export function evaluateAuditAnswers(answers = {}) {
  return AUDIT_STANDARDS.map((standard) => {
    const answer = answers[standard.id] || {};
    return evaluateAnswer({ standardId: standard.id, ...answer });
  });
}

/**
 * Counts results per status. `assessed` excludes everything that was not
 * measured, so the UI can say "12 of 16 measured" instead of implying a score.
 */
export function summarizeAuditResults(results = []) {
  const counts = {
    total: results.length,
    pass: 0,
    at_limit: 0,
    fail: 0,
    unknown: 0,
    not_applicable: 0,
    invalid: 0,
  };

  results.forEach((result) => {
    if (Object.prototype.hasOwnProperty.call(counts, result.status)) counts[result.status] += 1;
  });

  counts.measured = counts.pass + counts.at_limit + counts.fail;
  counts.assessed = counts.measured + counts.not_applicable;
  counts.outstanding = counts.unknown;
  counts.hasFailures = counts.fail > 0;
  counts.isComplete = results.every(
    (result) => result.status !== MEASUREMENT_STATUS.UNKNOWN || !result.required
  );

  return counts;
}

/** Findings that need a remediation action, worst first. */
export function buildFindings(results = []) {
  const severityRank = { critical: 0, major: 1, minor: 2 };

  return results
    .filter(
      (result) =>
        result.status === MEASUREMENT_STATUS.FAIL || result.status === MEASUREMENT_STATUS.AT_LIMIT
    )
    .sort((a, b) => {
      const rank = (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9);
      if (rank !== 0) return rank;
      return a.label.localeCompare(b.label);
    });
}

/** Suggested target date for a finding, from its severity. */
export function suggestTargetDate(finding, from = new Date()) {
  const days = TARGET_DAYS_BY_SEVERITY[finding?.severity] ?? 90;
  const date = new Date(from.getTime());
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Ranks a measured status so two assessments can be compared without heuristics.
 * Only measured statuses get a rank: "not measured" and "not present" are not
 * positions on this scale.
 */
const MEASURED_RANK = {
  [MEASUREMENT_STATUS.FAIL]: 0,
  [MEASUREMENT_STATUS.AT_LIMIT]: 1,
  [MEASUREMENT_STATUS.PASS]: 2,
};

/**
 * Compares a follow-up assessment with an earlier one, per benchmark.
 *
 * Four outcomes, and none of them is a guess:
 *   first_measurement — the earlier assessment had no usable reading
 *   not_measured      — this visit has no usable reading, so nothing to compare
 *   improved / worse  — both visits were measured and the rank moved
 *   unchanged         — both visits were measured and the rank did not move
 *
 * "Improved" therefore needs a pass where there was a failure, not merely a
 * benchmark that has stopped being measured.
 */
export function compareAssessments(previousResults = [], currentResults = []) {
  const previousById = new Map(previousResults.map((result) => [result.standardId, result]));

  return currentResults.map((current) => {
    const previous = previousById.get(current.standardId);
    const previousRank = previous ? MEASURED_RANK[previous.status] : undefined;
    const currentRank = MEASURED_RANK[current.status];

    const shared = {
      ...current,
      previousStatus: previous?.status ?? null,
      previousDisplay: previous?.displayValue ?? '—',
    };

    if (previousRank === undefined) {
      return { ...shared, change: 'first_measurement' };
    }

    if (currentRank === undefined) {
      return { ...shared, change: 'not_measured' };
    }

    if (currentRank > previousRank) return { ...shared, change: 'improved' };
    if (currentRank < previousRank) return { ...shared, change: 'worse' };
    return { ...shared, change: 'unchanged' };
  });
}
