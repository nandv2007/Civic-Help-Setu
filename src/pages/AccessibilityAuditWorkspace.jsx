/**
 * src/pages/AccessibilityAuditWorkspace.jsx
 * Measured accessibility audits with remediation planning (#948).
 *
 * Three views over the same record:
 *   Measure — record measurements against published benchmarks, facility by facility.
 *   Report  — what fell short, the remediation plan with target dates, print/export.
 *   History — every earlier assessment, so a follow-up visit can be compared.
 *
 * Everything is stored in this browser. The results are labelled everywhere as a
 * preliminary screening, never as a certified accessibility audit.
 */

import { useCallback, useId, useMemo, useState } from 'react';
import { ClipboardList, FileText, History, Printer, Ruler, Save, ShieldCheck, Download } from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader.jsx';
import { useToast } from '../context/ToastContext';
import {
  DEFAULT_FOLLOW_UP_DAYS,
  LOCAL_ONLY_NOTICE,
  MEASUREMENT_STATUS,
  RECORDING_STATES,
  SCREENING_DISCLAIMER,
} from '../data/accessibilityAuditStandards.js';
import {
  buildAssessment,
  buildPrintableReport,
  buildTextSummary,
  getOfficeAuditHistory,
  getRemediationPlan,
  listAuditableOffices,
  recordAssessment,
} from '../services/accessibilityAuditService.js';
import { summarizeAuditResults } from '../services/accessibilityAuditEngine.js';
import AuditMeasurementsForm from '../components/accessibilityAudit/AuditMeasurementsForm.jsx';
import AuditResultsTable from '../components/accessibilityAudit/AuditResultsTable.jsx';
import AuditRemediationPlan from '../components/accessibilityAudit/AuditRemediationPlan.jsx';
import AuditHistory from '../components/accessibilityAudit/AuditHistory.jsx';
import '../components/accessibilityAudit/audit.css';

const downloadText = (text, filename, mimeType) => {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

export default function AccessibilityAuditWorkspace() {
  const { toast } = useToast();
  const baseId = useId();

  const [tab, setTab] = useState('measure');
  const [officeId, setOfficeId] = useState('');
  const [answers, setAnswers] = useState({});
  const [auditorNote, setAuditorNote] = useState('');
  const [followUpDays, setFollowUpDays] = useState(String(DEFAULT_FOLLOW_UP_DAYS));
  const [version, setVersion] = useState(0);
  const [saveError, setSaveError] = useState('');

  const offices = useMemo(() => listAuditableOffices(), []);
  const office = offices.find((item) => item.id === officeId) || null;

  // `version` is bumped after every write, so these re-read storage after a save
  // or after an action changes status.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => (officeId ? getOfficeAuditHistory(officeId) : []), [officeId, version]);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => (officeId ? getRemediationPlan(officeId) : []), [officeId, version]);

  // Live preview of the form, so the person sees gaps as they measure.
  const draft = useMemo(() => {
    if (!officeId) return null;
    try {
      return buildAssessment({
        officeId,
        answers,
        auditorNote,
        followUpDays: Number(followUpDays) || DEFAULT_FOLLOW_UP_DAYS,
        id: `draft-${officeId}`,
      });
    } catch {
      return null;
    }
  }, [officeId, answers, auditorNote, followUpDays]);

  const handleAnswerChange = useCallback((standardId, next) => {
    setAnswers((current) => ({ ...current, [standardId]: next }));
  }, []);

  const handleSave = useCallback(() => {
    if (!officeId) {
      setSaveError('Choose the office first.');
      return;
    }

    const measured = Object.values(answers).filter((answer) => answer.state === RECORDING_STATES.RECORDED);
    if (measured.length === 0) {
      setSaveError('Record at least one measurement before saving — a report with no numbers is not useful as evidence.');
      return;
    }

    try {
      const assessment = buildAssessment({
        officeId,
        answers,
        auditorNote,
        followUpDays: Number(followUpDays) || DEFAULT_FOLLOW_UP_DAYS,
      });
      const outcome = recordAssessment(assessment);

      setSaveError(outcome.error || '');
      setVersion((value) => value + 1);

      if (outcome.ok) {
        toast.success('Assessment saved on this device.', 'Accessibility screening');
        setTab('report');
      } else {
        toast.error(outcome.error, 'Could not save the assessment');
      }
    } catch (error) {
      setSaveError(error.message);
      toast.error(error.message, 'Could not build the assessment');
    }
  }, [answers, auditorNote, followUpDays, officeId, toast]);

  /**
   * The printable report is opened as a blob: URL instead of being written into a
   * blank window with document.write. The markup is generated from escaped text, but
   * going through a Blob keeps the browser's HTML parser out of this page entirely,
   * which is also what the repo's "no document.write" security check expects.
   */
  const openPrintReport = useCallback(
    (assessment) => {
      if (!assessment) return;
      if (typeof window === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;

      let url = '';
      try {
        url = URL.createObjectURL(new Blob([buildPrintableReport(assessment)], { type: 'text/html;charset=utf-8' }));
      } catch {
        toast.error('This browser blocked the printable report.', 'Print blocked');
        return;
      }

      const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (!printWindow) {
        URL.revokeObjectURL(url);
        toast.error('Allow pop-ups for this site to open the printable report.', 'Print blocked');
        return;
      }
      printWindow.focus();
      // Give the new tab time to load the blob before the object URL is released.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    [toast]
  );

  const handleTextSummary = useCallback(() => {
    if (!draft) return;
    const done = downloadText(
      `${buildTextSummary(draft)}\n`,
      `accessibility-screening-${officeId}-${new Date().toISOString().slice(0, 10)}.txt`,
      'text/plain;charset=utf-8'
    );
    if (!done) toast.error('This browser blocked the download.', 'Export failed');
  }, [draft, officeId, toast]);

  const handleCsv = useCallback(
    (csv) => {
      const done = downloadText(
        csv,
        `accessibility-measurements-${officeId}-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8'
      );
      if (!done) toast.error('This browser blocked the download.', 'Export failed');
    },
    [officeId, toast]
  );

  const tabButton = (id, label, Icon) => (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      className="audit-tab"
      aria-selected={tab === id}
      aria-controls={`${baseId}-panel-${id}`}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
      {id === 'history' && history.length > 0 ? ` (${history.length})` : ''}
    </button>
  );

  const draftSummary = draft ? summarizeAuditResults(draft.results) : null;
  const latestSummary = latest?.summary || null;

  return (
    <div className="section animate-fade-in audit-page">
      <div className="container audit-shell" style={{ maxWidth: '1150px' }}>
        <StandardPageHeader
          eyebrow="Accessibility"
          eyebrowIcon={<Ruler size={16} />}
          title="Measured Accessibility Audits & Remediation Planning"
          subtitle="Measure ramps, doorways, corridors, washrooms and counters against published national benchmarks, see exactly where an office falls short, plan the fix with a target date, and compare the next visit with this one."
          align="left"
          maxWidth="58rem"
        />

        <div className="audit-notice" role="note">
          <ShieldCheck size={16} aria-hidden="true" />
          <div>
            <strong>A preliminary screening, not a certified audit.</strong>
            <p>{SCREENING_DISCLAIMER}</p>
          </div>
        </div>

        <p className="audit-local-note">{LOCAL_ONLY_NOTICE}</p>

        <div className="audit-tabs" role="tablist" aria-label="Accessibility audit sections">
          {tabButton('measure', 'Measure', Ruler)}
          {tabButton('report', 'Findings & plan', ClipboardList)}
          {tabButton('history', 'History', History)}
        </div>

        <div role="tabpanel" id={`${baseId}-panel-measure`} aria-labelledby={`${baseId}-tab-measure`} hidden={tab !== 'measure'}>
          {tab === 'measure' && (
            <>
              <div className="audit-summary-row">
                <div className="audit-stat">
                  <p className="audit-stat__label">Measured</p>
                  <p className="audit-stat__value">{draftSummary ? `${draftSummary.measured}/${draftSummary.total}` : '0/16'}</p>
                </div>
                <div className="audit-stat">
                  <p className="audit-stat__label">Meet benchmark</p>
                  <p className="audit-stat__value">{draftSummary?.pass ?? 0}</p>
                </div>
                <div className="audit-stat">
                  <p className="audit-stat__label">At the limit</p>
                  <p className="audit-stat__value">{draftSummary?.at_limit ?? 0}</p>
                </div>
                <div className="audit-stat">
                  <p className="audit-stat__label">Below benchmark</p>
                  <p className="audit-stat__value">{draftSummary?.fail ?? 0}</p>
                </div>
                <div className="audit-stat">
                  <p className="audit-stat__label">Not measured</p>
                  <p className="audit-stat__value">{draftSummary?.unknown ?? 0}</p>
                </div>
              </div>

              <AuditMeasurementsForm
                officeId={officeId}
                onOfficeChange={(next) => {
                  setOfficeId(next);
                  setSaveError('');
                }}
                answers={answers}
                onAnswerChange={handleAnswerChange}
                auditorNote={auditorNote}
                onAuditorNoteChange={setAuditorNote}
                followUpDays={followUpDays}
                onFollowUpDaysChange={setFollowUpDays}
                onShowReport={() => setTab('report')}
              />

              {saveError && (
                <p className="audit-inline-error" role="alert">
                  {saveError}
                </p>
              )}

              <div className="audit-actions audit-actions--sticky">
                <button type="button" className="audit-btn" onClick={handleSave} disabled={!office}>
                  <Save size={16} aria-hidden="true" /> Save assessment
                </button>
                <button type="button" className="audit-btn audit-btn--ghost" onClick={handleTextSummary} disabled={!office}>
                  <Download size={16} aria-hidden="true" /> Download text summary
                </button>
                <button
                  type="button"
                  className="audit-btn audit-btn--ghost"
                  onClick={() => openPrintReport(draft)}
                  disabled={!office}
                >
                  <Printer size={16} aria-hidden="true" /> Print report
                </button>
              </div>

              {latest && (
                <p className="audit-field__hint">
                  Previous assessment for this office: {latest.assessedAt.slice(0, 10)} — {latest.summary.pass} met,{' '}
                  {latest.summary.fail} below benchmark, {latest.summary.unknown} not measured.
                </p>
              )}
            </>
          )}
        </div>

        <div role="tabpanel" id={`${baseId}-panel-report`} aria-labelledby={`${baseId}-tab-report`} hidden={tab !== 'report'}>
          {tab === 'report' && (
            <>
              {!latest ? (
                <section className="audit-panel">
                  <h2 className="audit-panel__title">
                    <FileText size={18} aria-hidden="true" /> Nothing saved yet
                  </h2>
                  <p className="audit-panel__text">
                    Record and save an assessment on the Measure tab. The findings, remediation plan and printable
                    report appear here, and stay here for the next visit.
                  </p>
                  <div className="audit-actions">
                    <button type="button" className="audit-btn" onClick={() => setTab('measure')}>
                      <Ruler size={16} aria-hidden="true" /> Go to measuring
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="audit-panel" aria-labelledby={`${baseId}-latest`}>
                    <div className="audit-panel__head">
                      <div>
                        <h2 className="audit-panel__title" id={`${baseId}-latest`}>
                          {latest.officeName}
                        </h2>
                        <p className="audit-panel__text">
                          Assessed {new Date(latest.assessedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          {latest.previousAssessmentId ? ' · follow-up assessment' : ' · first assessment'} · next
                          assessment suggested by {latest.followUpDate}.
                        </p>
                      </div>
                      <div className="audit-actions">
                        <button type="button" className="audit-btn" onClick={() => openPrintReport(latest)}>
                          <Printer size={15} aria-hidden="true" /> Print report
                        </button>
                        <button type="button" className="audit-btn audit-btn--ghost" onClick={() => setTab('measure')}>
                          <Ruler size={15} aria-hidden="true" /> Measure again
                        </button>
                      </div>
                    </div>

                    <div className="audit-summary-row">
                      <div className="audit-stat">
                        <p className="audit-stat__label">Measured</p>
                        <p className="audit-stat__value">
                          {latestSummary.measured}/{latestSummary.total}
                        </p>
                      </div>
                      <div className="audit-stat">
                        <p className="audit-stat__label">Meet benchmark</p>
                        <p className="audit-stat__value">{latestSummary.pass}</p>
                      </div>
                      <div className="audit-stat">
                        <p className="audit-stat__label">At the limit</p>
                        <p className="audit-stat__value">{latestSummary.at_limit}</p>
                      </div>
                      <div className="audit-stat">
                        <p className="audit-stat__label">Below benchmark</p>
                        <p className="audit-stat__value">{latestSummary.fail}</p>
                      </div>
                      <div className="audit-stat">
                        <p className="audit-stat__label">Not measured</p>
                        <p className="audit-stat__value">{latestSummary.unknown}</p>
                      </div>
                    </div>

                    {latest.auditorNote && (
                      <p className="audit-panel__text">
                        <strong>Note:</strong> {latest.auditorNote}
                      </p>
                    )}

                    {plan.length > 0 && (
                      <div className="audit-plan-summary">
                        <h3 className="audit-benchmark__label">Open actions ({plan.filter((a) => a.status !== 'verified' && a.status !== 'cancelled').length})</h3>
                        <ul className="audit-note-list">
                          {plan
                            .filter((action) => action.status !== 'verified' && action.status !== 'cancelled')
                            .slice(0, 6)
                            .map((action) => (
                              <li key={action.id}>
                                <strong>{action.label}</strong> — target {action.targetDate}
                                {action.isOverdue ? ' (overdue)' : action.isDueSoon ? ' (due soon)' : ''}
                                {action.owner ? `, ${action.owner}` : ''}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  <AuditResultsTable
                    results={latest.results}
                    officeName={latest.officeName}
                    comparison={latest.comparison}
                    onExportCsv={handleCsv}
                  />

                  <AuditRemediationPlan
                    assessment={latest}
                    onActionsChanged={() => setVersion((value) => value + 1)}
                  />
                </>
              )}
            </>
          )}
        </div>

        <div role="tabpanel" id={`${baseId}-panel-history`} aria-labelledby={`${baseId}-tab-history`} hidden={tab !== 'history'}>
          {tab === 'history' && (
            <>
              <div className="audit-field audit-field--inline">
                <label className="audit-field__label" htmlFor={`${baseId}-history-office`}>
                  Office
                </label>
                <select
                  className="audit-input"
                  id={`${baseId}-history-office`}
                  value={officeId}
                  onChange={(event) => setOfficeId(event.target.value)}
                >
                  <option value="">Choose an office…</option>
                  {offices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.city ? ` — ${item.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <AuditHistory officeId={officeId} assessments={history} />

              {latest?.results?.some((result) => result.status === MEASUREMENT_STATUS.FAIL) && (
                <p className="audit-field__hint">
                  Reminder: a benchmark can be missed and the office can still be usable, and a benchmark can be met
                  while the visit is hard in practice. Record both the number and what you saw.
                </p>
              )}
            </>
          )}
        </div>

        <section className="audit-panel" aria-labelledby={`${baseId}-benchmarks`}>
          <h2 className="audit-panel__title" id={`${baseId}-benchmarks`}>
            Where the benchmarks come from
          </h2>
          <ul className="audit-note-list">
            <li>
              CPWD / Ministry of Urban Development, <em>Harmonised Guidelines and Space Standards for Barrier Free
              Built Environment for Persons with Disabilities</em> (2016) — ramps, handrails, door clear width,
              thresholds, accessible routes, turning space, knee clearance.
            </li>
            <li>
              CPWD, <em>Guidelines and Space Standards for Barrier Free Built Environment for Disabled and Elderly
              Persons</em> (1998) — ramped approach width, accessible toilet size and door.
            </li>
            <li>
              Bureau of Indian Standards, <em>IS 4963</em> — grab bar heights (confirm the edition your local
              authority cites).
            </li>
          </ul>
          <p className="audit-field__hint">
            State building bye-laws, heritage exemptions and a building’s own approval conditions can change what is
            required. Where they do, the local authority’s requirement prevails and the caveat is shown next to the
            affected benchmark.
          </p>
        </section>
      </div>
    </div>
  );
}
