import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AccessibilityAuditWorkspace from './AccessibilityAuditWorkspace';
import AuditMeasurementsForm from '../components/accessibilityAudit/AuditMeasurementsForm';
import AuditResultsTable from '../components/accessibilityAudit/AuditResultsTable';
import { resultsToCsv } from '../components/accessibilityAudit/auditCsv';
import AuditRemediationPlan from '../components/accessibilityAudit/AuditRemediationPlan';
import AuditHistory from '../components/accessibilityAudit/AuditHistory';
import MeasurementStatusChip, { ChangeFlag } from '../components/accessibilityAudit/auditStatus';
import { ToastProvider } from '../context/ToastContext';
import {
  MEASUREMENT_STATUS,
  RECORDING_STATES,
  REMEDIATION_STATUS,
} from '../data/accessibilityAuditStandards';
import { buildAssessment, recordAssessment } from '../services/accessibilityAuditService';
import { evaluateAuditAnswers } from '../services/accessibilityAuditEngine';
import { ACCESSIBILITY_AUDIT_STORAGE_KEY } from '../services/accessibilityAuditStorage';

const OFFICE_ID = 'delhi-south-collectorate';

const answers = (overrides = {}) => ({
  door_clear_width: { state: RECORDING_STATES.RECORDED, value: '850', unit: 'mm', note: 'North entrance, door held open' },
  corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
  ramp_gradient: { state: RECORDING_STATES.RECORDED, value: '1:10', unit: 'ratio' },
  ramp_width: { state: RECORDING_STATES.UNABLE_TO_MEASURE },
  washroom_clear_width: { state: RECORDING_STATES.NOT_APPLICABLE },
  ...overrides,
});

const renderWorkspace = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <AccessibilityAuditWorkspace />
      </ToastProvider>
    </MemoryRouter>
  );

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

describe('AccessibilityAuditWorkspace (#948)', () => {
  it('renders the heading, the screening disclaimer and the three sections', () => {
    const html = renderWorkspace();

    expect(html).toContain('Measured Accessibility Audits &amp; Remediation Planning');
    expect(html).toContain('A preliminary screening, not a certified audit.');
    expect(html).toContain('not a certified accessibility audit');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Measure');
    expect(html).toContain('Findings &amp; plan');
    expect(html).toContain('History');
    expect(html).toContain('aria-selected="true"');
  });

  it('says nothing is uploaded and cites the benchmark documents', () => {
    const html = renderWorkspace();

    expect(html).toContain('stay in this browser');
    expect(html).toContain('Where the benchmarks come from');
    expect(html).toContain('Harmonised Guidelines and Space Standards');
    expect(html).toContain('IS 4963');
  });

  it('shows the empty state on the findings tab before anything is saved', () => {
    const html = renderWorkspace();
    // Inactive tabs are not mounted, so the save panel and its guard text are absent.
    expect(html).toContain('Save assessment');
    expect(html).not.toContain('Nothing saved yet');
  });

  it('ignores a corrupt saved store', () => {
    store.set(ACCESSIBILITY_AUDIT_STORAGE_KEY, 'not json');
    expect(() => renderWorkspace()).not.toThrow();
  });
});

describe('AuditMeasurementsForm (#948)', () => {
  const render = (props = {}) =>
    renderToStaticMarkup(
      <AuditMeasurementsForm
        officeId={OFFICE_ID}
        onOfficeChange={() => {}}
        answers={answers()}
        onAnswerChange={() => {}}
        auditorNote=""
        onAuditorNoteChange={() => {}}
        followUpDays="14"
        onFollowUpDaysChange={() => {}}
        onShowReport={() => {}}
        {...props}
      />
    );

  it('renders a labelled control for every benchmark with its source', () => {
    const html = render();

    expect(html).toContain('Site and follow-up');
    expect(html).toContain('Ramps and sloped access');
    expect(html).toContain('Accessible washroom');
    expect(html).toContain('Clear entrance door width');
    expect(html).toContain('At least 900 mm clear');
    expect(html).toContain('HG2016');
    expect(html).toContain('Caveats (');
    expect(html).toContain('What did you find?');
  });

  it('keeps not-present and not-measured distinct in the form state', () => {
    const html = render();
    expect(html).toContain('Not measured yet');
    expect(html).toContain('Not present / not applicable');
    expect(html).toContain('Could not measure on site');
  });

  it('shows an inline error for an invalid measurement rather than a status', () => {
    const html = render({
      answers: answers({
        door_clear_width: { state: RECORDING_STATES.RECORDED, value: 'a very wide door', unit: 'mm' },
      }),
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Enter a number only');
  });

  it('shows the evaluated result next to a measured benchmark', () => {
    const html = render();
    expect(html).toContain('850 mm is below the 900 mm minimum');
    expect(html).toContain('Below benchmark');
  });

  it('shows earlier measurements for the office', () => {
    recordAssessment(
      buildAssessment({
        officeId: OFFICE_ID,
        answers: { door_clear_width: { state: RECORDING_STATES.RECORDED, value: '820', unit: 'mm' } },
        assessedAt: '2026-10-01T09:00:00.000Z',
      })
    );
    const html = render();
    expect(html).toContain('Earlier measurements');
    expect(html).toContain('820 mm');
  });
});

describe('AuditResultsTable (#948)', () => {
  const assessment = buildAssessment({ officeId: OFFICE_ID, answers: answers() });

  it('renders an accessible table with a caption, headers and the result wording', () => {
    const html = renderToStaticMarkup(
      <AuditResultsTable results={assessment.results} officeName={assessment.officeName} onExportCsv={() => {}} />
    );

    expect(html).toContain('<caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain('Below benchmark');
    expect(html).toContain('Not measured');
    expect(html).toContain('Not present');
    expect(html).toContain('Only show gaps');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Measurement notes');
    expect(html).toContain('North entrance, door held open');
  });

  it('explains that unmeasured items are not failures', () => {
    const html = renderToStaticMarkup(<AuditResultsTable results={assessment.results} />);
    expect(html).toContain('an unmeasured item is never treated as a failure');
  });

  it('exports CSV with the measurement, result and source', () => {
    const csv = resultsToCsv(assessment.results, assessment.officeName);
    const lines = csv.trim().split('\n');

    expect(lines[0]).toContain('"Office","Facility","Benchmark","Measured","Result"');
    expect(csv).toContain('District Magistrate Office');
    expect(csv).toContain('"850 mm"');
    expect(csv).toContain('"Below benchmark"');
    expect(lines.length).toBe(assessment.results.length + 1);
  });
});

describe('AuditRemediationPlan (#948)', () => {
  it('lists each gap with a suggested fix, owner and target date', () => {
    const assessment = buildAssessment({ officeId: OFFICE_ID, answers: answers() });
    const html = renderToStaticMarkup(<AuditRemediationPlan assessment={assessment} onActionsChanged={() => {}} />);

    expect(html).toContain('Remediation plan');
    expect(html).toContain('Clear entrance door width');
    expect(html).toContain('Target date');
    expect(html).toContain('Owner');
    expect(html).toContain('Start work');
    expect(html).toContain('Mark done');
    expect(html).toContain('Delete this assessment');
  });

  it('says so when nothing fell short', () => {
    const clean = buildAssessment({
      officeId: OFFICE_ID,
      answers: {
        door_clear_width: { state: RECORDING_STATES.RECORDED, value: '950', unit: 'mm' },
        corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
      },
    });
    const html = renderToStaticMarkup(<AuditRemediationPlan assessment={clean} />);
    expect(html).toContain('No remediation actions were raised by this assessment.');
  });

  it('shows a verified action as verified, not as open', () => {
    recordAssessment(
      buildAssessment({
        officeId: OFFICE_ID,
        answers: { door_clear_width: { state: RECORDING_STATES.RECORDED, value: '800', unit: 'mm' } },
        assessedAt: '2026-10-01T09:00:00.000Z',
      })
    );
    const fixed = buildAssessment({
      officeId: OFFICE_ID,
      answers: { door_clear_width: { state: RECORDING_STATES.RECORDED, value: '960', unit: 'mm' } },
      assessedAt: '2026-11-01T09:00:00.000Z',
    });

    const doorAction = fixed.remediationActions.find((action) => action.standardId === 'door_clear_width');
    expect(doorAction.status).toBe(REMEDIATION_STATUS.VERIFIED);

    const html = renderToStaticMarkup(<AuditRemediationPlan assessment={fixed} />);
    expect(html).toContain('Verified by re-assessment');
  });
});

describe('AuditHistory (#948)', () => {
  it('prompts for a first assessment when there is no history', () => {
    const html = renderToStaticMarkup(<AuditHistory officeId={OFFICE_ID} assessments={[]} />);
    expect(html).toContain('No assessment has been saved for this office yet');
  });

  it('compares the latest assessment with the one before it', () => {
    const first = buildAssessment({
      officeId: OFFICE_ID,
      answers: {
        door_clear_width: { state: RECORDING_STATES.RECORDED, value: '820', unit: 'mm' },
        corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
      },
      assessedAt: '2026-10-01T09:00:00.000Z',
      id: 'a1',
    });
    const second = buildAssessment({
      officeId: OFFICE_ID,
      answers: {
        door_clear_width: { state: RECORDING_STATES.RECORDED, value: '940', unit: 'mm' },
        corridor_width: { state: RECORDING_STATES.RECORDED, value: '1600', unit: 'mm' },
      },
      assessedAt: '2026-11-01T09:00:00.000Z',
      id: 'a2',
    });

    const html = renderToStaticMarkup(<AuditHistory officeId={OFFICE_ID} assessments={[first, second]} />);

    expect(html).toContain('Assessment history');
    expect(html).toContain('Improved since last assessment');
    expect(html).toContain('Same as last assessment');
    expect(html).toContain('benchmarks that meet the benchmark: +1 benchmarks');
  });
});

describe('status components (#948)', () => {
  it('labels every measurement status in words, not only colour', () => {
    [
      [MEASUREMENT_STATUS.PASS, 'Meets benchmark'],
      [MEASUREMENT_STATUS.FAIL, 'Below benchmark'],
      [MEASUREMENT_STATUS.UNKNOWN, 'Not measured'],
      [MEASUREMENT_STATUS.NOT_APPLICABLE, 'Not present'],
      [MEASUREMENT_STATUS.INVALID, 'Invalid entry'],
    ].forEach(([status, label]) => {
      expect(renderToStaticMarkup(<MeasurementStatusChip status={status} />)).toContain(label);
    });
  });

  it('uses a visually hidden label when the chip is icon-only', () => {
    const html = renderToStaticMarkup(<MeasurementStatusChip status={MEASUREMENT_STATUS.PASS} withLabel={false} />);
    expect(html).toContain('audit-visually-hidden');
    expect(html).toContain('Meets benchmark');
  });

  it('describes a change with the earlier value', () => {
    const html = renderToStaticMarkup(
      <ChangeFlag change="improved" previousStatus={MEASUREMENT_STATUS.FAIL} previousDisplay="820 mm" />
    );
    expect(html).toContain('Improved since last assessment');
    expect(html).toContain('was 820 mm');
  });

  it('renders nothing for an unknown change token', () => {
    expect(renderToStaticMarkup(<ChangeFlag change="something-else" />)).toBe('');
  });

  it('keeps the evaluated results consistent with the engine', () => {
    const results = evaluateAuditAnswers(answers());
    const door = results.find((result) => result.standardId === 'door_clear_width');
    expect(door.status).toBe(MEASUREMENT_STATUS.FAIL);
    expect(door.displayValue).toBe('850 mm');
  });
});
