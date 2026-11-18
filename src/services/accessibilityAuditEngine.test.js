import { describe, it, expect } from 'vitest';
import {
  ratioToPercent,
  percentToRatio,
  normalizeMeasurement,
  formatMeasurement,
  evaluateAgainstStandard,
  evaluateAnswer,
  evaluateAuditAnswers,
  summarizeAuditResults,
  buildFindings,
  suggestTargetDate,
  compareAssessments,
} from './accessibilityAuditEngine.js';
import {
  AUDIT_STANDARDS,
  AUDIT_SOURCES,
  MEASUREMENT_KINDS,
  MEASUREMENT_STATUS,
  RECORDING_STATES,
  REMEDIATION_STATUS,
  STANDARD_BY_ID,
  TARGET_DAYS_BY_SEVERITY,
  MAX_NOTE_LENGTH,
} from '../data/accessibilityAuditStandards.js';

const length = (standardId) => STANDARD_BY_ID[standardId];

describe('benchmark catalogue integrity (#948)', () => {
  it('gives every benchmark a source document, clause and caveats', () => {
    expect(AUDIT_STANDARDS.length).toBeGreaterThanOrEqual(15);

    AUDIT_STANDARDS.forEach((standard) => {
      expect(standard.id, 'id').toMatch(/^[a-z0-9_]+$/);
      expect(standard.label.length).toBeGreaterThan(0);
      expect(standard.benchmarkText.length).toBeGreaterThan(0);
      expect(AUDIT_SOURCES[standard.source.id], `${standard.id} source`).toBeTruthy();
      expect(standard.caveats.length, `${standard.id} caveats`).toBeGreaterThan(0);
      expect(standard.remediation.length, `${standard.id} remediation`).toBeGreaterThan(0);
      expect(['critical', 'major', 'minor']).toContain(standard.severity);
      expect(['min', 'max', 'range']).toContain(standard.rule.type);
    });
  });

  it('has unique standard ids', () => {
    const ids = AUDIT_STANDARDS.map((standard) => standard.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('unit handling (#948)', () => {
  it('converts a slope ratio to percent gradient and back', () => {
    expect(ratioToPercent('1:12')).toBe(8.33);
    expect(ratioToPercent('1 : 10')).toBe(10);
    expect(ratioToPercent('1:15')).toBe(6.67);
    expect(ratioToPercent('12')).toBeNull();
    expect(ratioToPercent('1:0')).toBeNull();
    expect(ratioToPercent('ramp')).toBeNull();

    expect(percentToRatio(8.33)).toBe('1:12');
    expect(percentToRatio(10)).toBe('1:10');
    expect(percentToRatio(0)).toBe('');
  });

  it('normalises metres, centimetres and millimetres to millimetres', () => {
    const standard = length('door_clear_width');
    expect(normalizeMeasurement('900', 'mm', standard).canonical).toBe(900);
    expect(normalizeMeasurement('90', 'cm', standard).canonical).toBe(900);
    expect(normalizeMeasurement('0.9', 'm', standard).canonical).toBe(900);
    expect(normalizeMeasurement('0,9', 'm', standard).canonical).toBe(900);
  });

  it('accepts a value with the unit typed in by mistake', () => {
    const standard = length('corridor_width');
    expect(normalizeMeasurement('1500 mm', 'mm', standard).canonical).toBe(1500);
  });

  it('rejects text, negatives and implausible values', () => {
    const standard = length('door_clear_width');

    expect(normalizeMeasurement('wide', 'mm', standard).status).toBe(MEASUREMENT_STATUS.INVALID);
    expect(normalizeMeasurement('', 'mm', standard).status).toBe(MEASUREMENT_STATUS.INVALID);
    expect(normalizeMeasurement('-10', 'mm', standard).status).toBe(MEASUREMENT_STATUS.INVALID);

    // 900 typed as metres is 900,000 mm: a unit mistake, not a door.
    const unitMistake = normalizeMeasurement('900', 'm', standard);
    expect(unitMistake.status).toBe(MEASUREMENT_STATUS.INVALID);
    expect(unitMistake.error).toMatch(/unit/i);
  });

  it('rejects a unit that does not belong to the benchmark', () => {
    const result = normalizeMeasurement('12', 'm', length('ramp_gradient'));
    expect(result.status).toBe(MEASUREMENT_STATUS.INVALID);
    expect(result.error).toMatch(/not used for this measurement/);
  });

  it('formats measurements for people, not machines', () => {
    expect(formatMeasurement(length('corridor_width'), 1500)).toBe('1.5 m (1500 mm)');
    expect(formatMeasurement(length('door_clear_width'), 850)).toBe('850 mm');
    expect(formatMeasurement(length('ramp_gradient'), 8.33)).toBe('8.33% (1:12)');
  });
});

describe('threshold evaluation, including boundary values (#948)', () => {
  it('passes, hesitates and fails a minimum rule at the right boundaries', () => {
    const standard = length('door_clear_width'); // min 900 mm, tolerance 10 mm

    expect(evaluateAgainstStandard(standard, 900).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(standard, 1200).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(standard, 895).status).toBe(MEASUREMENT_STATUS.AT_LIMIT);
    expect(evaluateAgainstStandard(standard, 899).status).toBe(MEASUREMENT_STATUS.AT_LIMIT);
    expect(evaluateAgainstStandard(standard, 889).status).toBe(MEASUREMENT_STATUS.FAIL);
    expect(evaluateAgainstStandard(standard, 700).status).toBe(MEASUREMENT_STATUS.FAIL);
  });

  it('passes, hesitates and fails a maximum rule at the right boundaries', () => {
    const slope = length('ramp_gradient'); // max 8.33 %, tolerance 0.5
    expect(evaluateAgainstStandard(slope, 6.67).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(slope, 8.33).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(slope, 8.6).status).toBe(MEASUREMENT_STATUS.AT_LIMIT);
    expect(evaluateAgainstStandard(slope, 8.9).status).toBe(MEASUREMENT_STATUS.FAIL);

    const threshold = length('door_threshold_height'); // max 12 mm, tolerance 10
    expect(evaluateAgainstStandard(threshold, 0).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(threshold, 12).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(threshold, 20).status).toBe(MEASUREMENT_STATUS.AT_LIMIT);
    expect(evaluateAgainstStandard(threshold, 25).status).toBe(MEASUREMENT_STATUS.FAIL);
  });

  it('handles a range rule at both edges', () => {
    const handrail = length('ramp_handrail_height'); // 900–1000 mm, tolerance 10
    expect(evaluateAgainstStandard(handrail, 950).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(handrail, 900).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(handrail, 1000).status).toBe(MEASUREMENT_STATUS.PASS);
    expect(evaluateAgainstStandard(handrail, 895).status).toBe(MEASUREMENT_STATUS.AT_LIMIT);
    expect(evaluateAgainstStandard(handrail, 1008).status).toBe(MEASUREMENT_STATUS.AT_LIMIT);
    expect(evaluateAgainstStandard(handrail, 800).status).toBe(MEASUREMENT_STATUS.FAIL);
    expect(evaluateAgainstStandard(handrail, 1100).status).toBe(MEASUREMENT_STATUS.FAIL);
  });

  it('never reports a missing measurement as failing', () => {
    expect(evaluateAgainstStandard(length('door_clear_width'), null).status).toBe(MEASUREMENT_STATUS.UNKNOWN);
    expect(evaluateAgainstStandard(null, 900).status).toBe(MEASUREMENT_STATUS.UNKNOWN);
  });

  it('explains the result with the numbers it used', () => {
    const result = evaluateAgainstStandard(length('door_clear_width'), 850);
    expect(result.message).toContain('850 mm');
    expect(result.message).toContain('900 mm');
  });
});

describe('distinguishing unknown from non-compliant (#948)', () => {
  it('keeps "not present" separate from "fails the benchmark"', () => {
    const notPresent = evaluateAnswer({
      standardId: 'washroom_clear_width',
      state: RECORDING_STATES.NOT_APPLICABLE,
    });
    expect(notPresent.status).toBe(MEASUREMENT_STATUS.NOT_APPLICABLE);
    expect(notPresent.message).toMatch(/not a compliance finding/);

    const failed = evaluateAnswer({
      standardId: 'washroom_clear_width',
      state: RECORDING_STATES.RECORDED,
      value: '1200',
      unit: 'mm',
    });
    expect(failed.status).toBe(MEASUREMENT_STATUS.FAIL);
  });

  it('keeps "could not measure on site" unknown', () => {
    const result = evaluateAnswer({
      standardId: 'corridor_width',
      state: RECORDING_STATES.UNABLE_TO_MEASURE,
    });
    expect(result.status).toBe(MEASUREMENT_STATUS.UNKNOWN);
    expect(result.message).toMatch(/stays unknown/);
  });

  it('treats a blank answer as unknown rather than a pass', () => {
    const result = evaluateAnswer({ standardId: 'corridor_width' });
    expect(result.status).toBe(MEASUREMENT_STATUS.UNKNOWN);
  });

  it('surfaces an invalid entry with a readable message, not a status', () => {
    const result = evaluateAnswer({
      standardId: 'corridor_width',
      state: RECORDING_STATES.RECORDED,
      value: 'about a metre',
      unit: 'mm',
    });
    expect(result.status).toBe(MEASUREMENT_STATUS.INVALID);
    expect(result.message).toMatch(/number/i);
  });

  it('rejects an unknown benchmark id', () => {
    const result = evaluateAnswer({ standardId: 'not_a_thing', state: RECORDING_STATES.RECORDED, value: '1' });
    expect(result.status).toBe(MEASUREMENT_STATUS.INVALID);
  });

  it('caps a note but keeps it', () => {
    const result = evaluateAnswer({
      standardId: 'door_clear_width',
      state: RECORDING_STATES.RECORDED,
      value: '900',
      unit: 'mm',
      note: 'x'.repeat(MAX_NOTE_LENGTH + 50),
    });
    expect(result.note.length).toBe(MAX_NOTE_LENGTH + 50); // evaluation preserves; sanitising happens on save
  });
});

describe('summaries and findings (#948)', () => {
  const results = evaluateAuditAnswers({
    door_clear_width: { state: RECORDING_STATES.RECORDED, value: '850', unit: 'mm' },
    corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
    ramp_gradient: { state: RECORDING_STATES.RECORDED, value: '1:14', unit: 'ratio' },
    washroom_clear_width: { state: RECORDING_STATES.NOT_APPLICABLE },
    ramp_width: { state: RECORDING_STATES.UNABLE_TO_MEASURE },
  });

  it('counts every state and never folds unknown into fail', () => {
    const summary = summarizeAuditResults(results);
    expect(summary.total).toBe(AUDIT_STANDARDS.length);
    expect(summary.pass).toBe(2); // corridor width + ramp gradient
    expect(summary.fail).toBe(1); // door width
    expect(summary.not_applicable).toBe(1);
    expect(summary.measured).toBe(3);
    expect(summary.outstanding).toBeGreaterThan(0);
    expect(summary.hasFailures).toBe(true);
    expect(summary.isComplete).toBe(false);
  });

  it('lists gaps worst first and skips unknowns', () => {
    const findings = buildFindings(results);
    expect(findings[0].severity).toBe('critical');
    expect(findings.every((finding) => finding.status !== MEASUREMENT_STATUS.UNKNOWN)).toBe(true);
  });

  it('suggests a target date from severity, not from a guess', () => {
    const from = new Date('2026-11-18T00:00:00.000Z');
    expect(suggestTargetDate({ severity: 'critical' }, from)).toBe('2026-12-18');
    expect(suggestTargetDate({ severity: 'major' }, from)).toBe('2027-02-16');
    expect(suggestTargetDate({ severity: 'minor' }, from)).toBe('2027-05-17');
    expect(TARGET_DAYS_BY_SEVERITY.critical).toBe(30);
  });
});

describe('comparing a reassessment (#948)', () => {
  const previous = evaluateAuditAnswers({
    door_clear_width: { state: RECORDING_STATES.RECORDED, value: '850', unit: 'mm' },
    ramp_gradient: { state: RECORDING_STATES.RECORDED, value: '1:10', unit: 'ratio' },
    corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
  });

  const current = evaluateAuditAnswers({
    door_clear_width: { state: RECORDING_STATES.RECORDED, value: '950', unit: 'mm' },
    ramp_gradient: { state: RECORDING_STATES.RECORDED, value: '1:13', unit: 'ratio' },
    corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
    washroom_clear_width: { state: RECORDING_STATES.RECORDED, value: '1500', unit: 'mm' },
  });

  it('reports improvements, unchanged results and first measurements', () => {
    const compared = compareAssessments(previous, current);
    const byId = Object.fromEntries(compared.map((row) => [row.standardId, row]));

    expect(byId.door_clear_width.change).toBe('improved');
    expect(byId.door_clear_width.previousDisplay).toBe('850 mm');
    expect(byId.corridor_width.change).toBe('unchanged');
    // The earlier assessment never measured the washroom, so there is nothing to compare against.
    expect(byId.washroom_clear_width.change).toBe('first_measurement');
  });

  it('reports a regression as worse', () => {
    const worse = evaluateAuditAnswers({
      corridor_width: { state: RECORDING_STATES.RECORDED, value: '1000', unit: 'mm' },
    });
    const compared = compareAssessments(previous, worse);
    expect(compared.find((row) => row.standardId === 'corridor_width').change).toBe('worse');
  });

  it('does not call a now-unknown benchmark improved', () => {
    const reverted = evaluateAuditAnswers({
      door_clear_width: { state: RECORDING_STATES.UNABLE_TO_MEASURE },
    });
    const compared = compareAssessments(previous, reverted);
    const door = compared.find((row) => row.standardId === 'door_clear_width');
    expect(door.change).toBe('not_measured');
    expect(door.status).toBe(MEASUREMENT_STATUS.UNKNOWN);
  });

  it('handles an empty previous assessment', () => {
    const compared = compareAssessments([], current);
    expect(compared.every((row) => row.change === 'first_measurement')).toBe(true);
  });
});

describe('measurement kinds (#948)', () => {
  it('keeps the three kinds distinct so the form can render the right input', () => {
    expect(MEASUREMENT_KINDS.LENGTH).toBe('length');
    expect(MEASUREMENT_KINDS.SLOPE).toBe('slope');
    expect(STANDARD_BY_ID.parking_bay_width.kind).toBe(MEASUREMENT_KINDS.LENGTH);
    expect(STANDARD_BY_ID.ramp_gradient.kind).toBe(MEASUREMENT_KINDS.SLOPE);
  });

  it('marks an action cancelled state as not requiring verification', () => {
    expect(REMEDIATION_STATUS.CANCELLED).toBe('cancelled');
  });
});
