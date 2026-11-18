import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listAuditableOffices,
  getAuditableOffice,
  getBenchmarkGroups,
  defaultTargetDate,
  buildRemediationActions,
  reconcileActionsWithAssessment,
  buildAssessment,
  recordAssessment,
  getOfficeAuditHistory,
  getMeasurementHistory,
  getRemediationPlan,
  buildPrintableReport,
  buildTextSummary,
  sanitizeOwner,
  severityForStandard,
} from './accessibilityAuditService.js';
import {
  loadAuditStore,
  listAssessments,
  getLatestAssessment,
  listAuditedOffices,
  updateRemediationAction,
  deleteAssessment,
  clearAllAudits,
  ACCESSIBILITY_AUDIT_STORAGE_KEY,
} from './accessibilityAuditStorage.js';
import { evaluateAuditAnswers } from './accessibilityAuditEngine.js';
import {
  AUDIT_SCHEMA_VERSION,
  MEASUREMENT_STATUS,
  RECORDING_STATES,
  REMEDIATION_PRIORITY,
  REMEDIATION_STATUS,
} from '../data/accessibilityAuditStandards.js';

const OFFICE_ID = 'delhi-south-collectorate';

const answersWith = (overrides = {}) => ({
  door_clear_width: { state: RECORDING_STATES.RECORDED, value: '950', unit: 'mm' },
  corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
  ...overrides,
});

describe('auditable offices (#948)', () => {
  it('offers the civic office directory, normalised and sorted', () => {
    const offices = listAuditableOffices();
    expect(offices.length).toBeGreaterThan(5);
    offices.forEach((office) => {
      expect(office.id).toBeTruthy();
      expect(office.name).toBeTruthy();
    });
    const names = offices.map((office) => office.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('returns null for an office that does not exist', () => {
    expect(getAuditableOffice('not-an-office')).toBeNull();
    expect(getAuditableOffice(OFFICE_ID).id).toBe(OFFICE_ID);
  });

  it('groups benchmarks by facility in a stable order', () => {
    const groups = getBenchmarkGroups();
    expect(groups.length).toBeGreaterThan(4);
    groups.forEach((group) => expect(group.standards.length).toBeGreaterThan(0));
    expect(groups[0].id).toBe('ramp');
    expect(groups.flatMap((group) => group.standards).length).toBeGreaterThanOrEqual(15);
  });
});

describe('remediation planning (#948)', () => {
  const findings = [
    { standardId: 'door_clear_width', label: 'Clear entrance door width', facility: 'entrance', severity: 'critical', message: '850 mm is below 900 mm.', requirement: 'At least 900 mm', standard: { remediation: 'Widen the opening.' } },
    { standardId: 'grab_bar_height', label: 'Grab bar height', facility: 'washroom', severity: 'minor', message: '1050 mm is outside 800–900 mm.', requirement: '800–900 mm', standard: { remediation: 'Re-fix the bar.' } },
  ];

  it('turns findings into dated actions with a priority from severity', () => {
    const actions = buildRemediationActions(findings, {
      officeId: OFFICE_ID,
      assessmentId: 'audit-1',
      now: new Date('2026-11-18T00:00:00.000Z'),
    });

    expect(actions).toHaveLength(2);
    expect(actions[0].priority).toBe(REMEDIATION_PRIORITY.HIGH);
    expect(actions[0].targetDate).toBe('2026-12-18');
    expect(actions[0].status).toBe(REMEDIATION_STATUS.OPEN);
    expect(actions[1].priority).toBe(REMEDIATION_PRIORITY.LOW);
    expect(actions[1].targetDate).toBe('2027-05-17');
    expect(actions[0].suggestedFix).toBe('Widen the opening.');
  });

  it('verifies an action only when a later measurement passes', () => {
    const actions = buildRemediationActions(findings, { officeId: OFFICE_ID, assessmentId: 'a1' });
    const stillFailing = evaluateAuditAnswers({
      door_clear_width: { state: RECORDING_STATES.RECORDED, value: '860', unit: 'mm' },
    });
    const nowPassing = evaluateAuditAnswers({
      door_clear_width: { state: RECORDING_STATES.RECORDED, value: '950', unit: 'mm' },
    });

    const unchanged = reconcileActionsWithAssessment(actions, stillFailing, 'a2');
    expect(unchanged[0].status).toBe(REMEDIATION_STATUS.OPEN);

    const verified = reconcileActionsWithAssessment(actions, nowPassing, 'a2');
    expect(verified[0].status).toBe(REMEDIATION_STATUS.VERIFIED);
    expect(verified[0].verificationAssessmentId).toBe('a2');
  });

  it('leaves a cancelled action cancelled', () => {
    const actions = buildRemediationActions(findings, { officeId: OFFICE_ID, assessmentId: 'a1' });
    actions[0] = { ...actions[0], status: REMEDIATION_STATUS.CANCELLED };
    const passed = evaluateAuditAnswers({
      door_clear_width: { state: RECORDING_STATES.RECORDED, value: '950', unit: 'mm' },
    });
    expect(reconcileActionsWithAssessment(actions, passed, 'a2')[0].status).toBe(REMEDIATION_STATUS.CANCELLED);
  });

  it('suggests a default target date and sanitises the owner field', () => {
    expect(defaultTargetDate('critical', new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-31');
    expect(sanitizeOwner('  <b>Executive Engineer</b>  ')).toBe('Executive Engineer');
    expect(sanitizeOwner('x'.repeat(200))).toHaveLength(120);
    expect(severityForStandard('door_clear_width')).toBe('critical');
    expect(severityForStandard('nope')).toBe('minor');
  });
});

describe('building an assessment (#948)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to build without an office', () => {
    expect(() => buildAssessment({ officeId: '', answers: {} })).toThrow(/Choose the office/);
    expect(() => buildAssessment({ officeId: 'ghost-office', answers: {} })).toThrow(/Choose the office/);
  });

  it('records the screening disclaimer, benchmark version and a follow-up date', () => {
    const assessment = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith(),
      auditorNote: 'Ramp was clear, washroom locked.',
      followUpDays: 30,
      assessedAt: '2026-11-18T10:00:00.000Z',
    });

    expect(assessment.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
    expect(assessment.officeName).toContain('District Magistrate');
    expect(assessment.auditorNote).toBe('Ramp was clear, washroom locked.');
    expect(assessment.followUpDate).toBe('2026-12-18');
    expect(assessment.disclaimer).toMatch(/not a certified accessibility audit/);
    expect(assessment.caveat).toMatch(/State building bye-laws/);
    expect(assessment.results.length).toBeGreaterThan(10);
  });

  it('clamps a silly follow-up period instead of producing an absurd date', () => {
    const tooLong = buildAssessment({ officeId: OFFICE_ID, answers: answersWith(), followUpDays: 5000 });
    const tooShort = buildAssessment({ officeId: OFFICE_ID, answers: answersWith(), followUpDays: 0 });

    const longDays = (Date.parse(tooLong.followUpDate) - Date.parse(tooLong.assessedAt)) / 86400000;
    const shortDays = (Date.parse(tooShort.followUpDate) - Date.parse(tooShort.assessedAt)) / 86400000;

    expect(longDays).toBeLessThanOrEqual(365);
    expect(shortDays).toBeGreaterThanOrEqual(1);
  });

  it('strips markup and caps the auditor note', () => {
    const assessment = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith(),
      auditorNote: `<script>alert(1)</script>${'x'.repeat(400)}`,
    });
    expect(assessment.auditorNote).not.toContain('<');
    expect(assessment.auditorNote.length).toBeLessThanOrEqual(300);
  });

  it('saves, reloads and lists assessments by office', () => {
    const first = buildAssessment({ officeId: OFFICE_ID, answers: answersWith(), assessedAt: '2026-11-01T09:00:00.000Z' });
    const outcome = recordAssessment(first);
    expect(outcome.ok).toBe(true);

    expect(getOfficeAuditHistory(OFFICE_ID)).toHaveLength(1);
    expect(getLatestAssessment(OFFICE_ID).id).toBe(first.id);
    expect(listAssessments('other-office')).toEqual([]);

    const audited = listAuditedOffices();
    expect(audited).toHaveLength(1);
    expect(audited[0].count).toBe(1);
  });

  it('carries open actions forward into the next assessment and closes verified ones', () => {
    const first = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '850', unit: 'mm' } }),
      assessedAt: '2026-11-01T09:00:00.000Z',
    });
    recordAssessment(first);
    expect(first.remediationActions.some((action) => action.standardId === 'door_clear_width')).toBe(true);

    const second = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '960', unit: 'mm' } }),
      assessedAt: '2026-11-20T09:00:00.000Z',
    });

    expect(second.previousAssessmentId).toBe(first.id);
    const doorAction = second.remediationActions.find((action) => action.standardId === 'door_clear_width');
    expect(doorAction.status).toBe(REMEDIATION_STATUS.VERIFIED);

    const comparison = second.comparison.find((row) => row.standardId === 'door_clear_width');
    expect(comparison.change).toBe('improved');
  });

  it('keeps a measurement history per benchmark', () => {
    recordAssessment(
      buildAssessment({
        officeId: OFFICE_ID,
        answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '850', unit: 'mm' } }),
        assessedAt: '2026-11-01T09:00:00.000Z',
      })
    );
    recordAssessment(
      buildAssessment({
        officeId: OFFICE_ID,
        answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '930', unit: 'mm' } }),
        assessedAt: '2026-11-10T09:00:00.000Z',
      })
    );

    const history = getMeasurementHistory(OFFICE_ID, 'door_clear_width');
    expect(history).toHaveLength(2);
    expect(history[0].displayValue).toBe('850 mm');
    expect(history[1].displayValue).toBe('930 mm');
    expect(history[1].status).toBe(MEASUREMENT_STATUS.PASS);
  });

  it('flags overdue and due-soon actions without counting closed ones', () => {
    const assessment = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '800', unit: 'mm' } }),
      assessedAt: '2026-11-01T09:00:00.000Z',
    });
    recordAssessment(assessment);

    const overdue = getRemediationPlan(OFFICE_ID, { today: new Date('2027-06-01T00:00:00.000Z') });
    const door = overdue.find((action) => action.standardId === 'door_clear_width');
    expect(door.isOverdue).toBe(true);

    const onTime = getRemediationPlan(OFFICE_ID, { today: new Date('2026-11-20T00:00:00.000Z') });
    expect(onTime.find((action) => action.standardId === 'door_clear_width').isOverdue).toBe(false);
  });

  it('updates an action status and deletes an assessment', () => {
    const assessment = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '800', unit: 'mm' } }),
    });
    recordAssessment(assessment);
    const actionId = assessment.remediationActions[0].id;

    const updated = updateRemediationAction(OFFICE_ID, assessment.id, actionId, {
      status: REMEDIATION_STATUS.IN_PROGRESS,
    });
    expect(updated.ok).toBe(true);
    const stored = getLatestAssessment(OFFICE_ID);
    expect(stored.remediationActions[0].status).toBe(REMEDIATION_STATUS.IN_PROGRESS);

    expect(deleteAssessment(OFFICE_ID, assessment.id).ok).toBe(true);
    expect(getOfficeAuditHistory(OFFICE_ID)).toEqual([]);
    expect(loadAuditStore()).toEqual({});
  });

  it('reports a storage failure instead of losing the data silently', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
    });

    const assessment = buildAssessment({ officeId: OFFICE_ID, answers: answersWith() });
    const outcome = recordAssessment(assessment);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/could not save the audit/i);
  });

  it('drops a corrupt or outdated store instead of crashing', () => {
    store.set(ACCESSIBILITY_AUDIT_STORAGE_KEY, '{ not json');
    expect(loadAuditStore()).toEqual({});

    store.set(ACCESSIBILITY_AUDIT_STORAGE_KEY, JSON.stringify({ schemaVersion: '0.0.1', offices: { a: {} } }));
    expect(loadAuditStore()).toEqual({});
  });

  it('clears every audit on request', () => {
    recordAssessment(buildAssessment({ officeId: OFFICE_ID, answers: answersWith() }));
    expect(clearAllAudits()).toMatchObject({ ok: true, cleared: 1 });
    expect(loadAuditStore()).toEqual({});
  });
});

describe('printable and text reports (#948)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const assessment = () =>
    buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith({ door_clear_width: { state: RECORDING_STATES.RECORDED, value: '800', unit: 'mm' } }),
      auditorNote: 'Washroom key is held at counter 3.',
      followUpDays: 30,
      assessedAt: '2026-11-18T10:00:00.000Z',
    });

  it('produces a self-contained printable HTML report with the disclaimer and plan', () => {
    const html = buildPrintableReport(assessment());

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Accessibility screening report');
    expect(html).toContain('not a certified accessibility audit');
    expect(html).toContain('Remediation plan');
    expect(html).toContain('Washroom key is held at counter 3.');
    expect(html).toContain('Below benchmark');
    // The benchmark source is cited, so a reader can check it.
    expect(html).toContain('HG2016');
  });

  it('escapes every user-supplied value in the report', () => {
    const hostile = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith(),
      auditorNote: '<img src=x onerror="alert(1)"> wires & "quoted" name',
    });

    // Markup is stripped when the note is saved...
    expect(hostile.auditorNote).not.toContain('<');
    expect(hostile.auditorNote).toContain('wires & "quoted" name');

    // ...and whatever survives is escaped when it goes into the report.
    const html = buildPrintableReport(hostile);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror=');
    expect(html).toContain('wires &amp; &quot;quoted&quot; name');
  });

  it('sanitises a measurement note once and escapes it once in the report', () => {
    const withNote = buildAssessment({
      officeId: OFFICE_ID,
      answers: answersWith({
        corridor_width: {
          state: RECORDING_STATES.RECORDED,
          value: '1600',
          unit: 'mm',
          note: 'blocked by a <b>chair</b> & a bin',
        },
      }),
    });

    // Markup is stripped where the note is captured, so the stored note is plain text.
    const stored = withNote.results.find((result) => result.standardId === 'corridor_width').note;
    expect(stored).toBe('blocked by a chair & a bin');

    // The report escapes that plain text exactly once (no &amp;amp; double encoding).
    const html = buildPrintableReport(withNote);
    expect(html).toContain('Measurement notes');
    expect(html).toContain('blocked by a chair &amp; a bin');
    expect(html).not.toContain('&amp;amp;');
    expect(html).not.toContain('<b>chair</b>');
  });

  it('returns an empty string rather than throwing for a missing assessment', () => {
    expect(buildPrintableReport(null)).toBe('');
    expect(buildTextSummary(null)).toBe('');
  });

  it('builds a plain-text summary fit for a complaint', () => {
    const text = buildTextSummary(assessment());
    expect(text).toContain('Accessibility screening — District Magistrate Office');
    expect(text).toContain('Points that fell short:');
    expect(text).toContain('Requested fixes:');
    expect(text).toContain('not a certified accessibility audit');
  });
});
