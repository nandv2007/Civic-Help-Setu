/**
 * src/services/accessibilityAuditService.js
 * Measured accessibility audits with remediation planning (#948).
 *
 * This service builds an *assessment* from the audit form: it evaluates every
 * measurement, lists what fell short, turns those into a remediation plan with
 * target dates, and compares the result with the previous assessment for the
 * same office. It deliberately stops short of a "score": the output is a list of
 * measured facts and named gaps, which is what a citizen can act on.
 */

import { CIVIC_OFFICES } from '../data/locationOffices.js';
import {
  AUDIT_SCHEMA_VERSION,
  AUDIT_STANDARDS,
  DEFAULT_FOLLOW_UP_DAYS,
  DUE_SOON_DAYS,
  FACILITY_GROUPS,
  MAX_NOTE_LENGTH,
  MAX_OWNER_LENGTH,
  MEASUREMENT_STATUS,
  REMEDIATION_PRIORITY,
  REMEDIATION_STATUS,
  REMEDIATION_STATUS_LABELS,
  SCREENING_DISCLAIMER,
  BENCHMARK_CAVEAT,
  RECORDING_STATES,
  STANDARD_BY_ID,
} from '../data/accessibilityAuditStandards.js';
import {
  buildFindings,
  compareAssessments,
  evaluateAuditAnswers,
  summarizeAuditResults,
  suggestTargetDate,
} from './accessibilityAuditEngine.js';
import { getLatestAssessment, listAssessments, saveAssessment } from './accessibilityAuditStorage.js';

const SEVERITY_TO_PRIORITY = {
  critical: REMEDIATION_PRIORITY.HIGH,
  major: REMEDIATION_PRIORITY.MEDIUM,
  minor: REMEDIATION_PRIORITY.LOW,
};

const sanitizeText = (value, maxLength) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const isoDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

/**
 * Offices that can be audited. The civic office directory is the base list;
 * it is normalised so the picker never renders a half-filled option.
 */
export function listAuditableOffices() {
  return CIVIC_OFFICES.map((office) => ({
    id: office.id,
    name: office.name,
    city: office.city || '',
    district: office.district || '',
    state: office.state || '',
    category: office.category || '',
    type: office.type || '',
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAuditableOffice(officeId) {
  return listAuditableOffices().find((office) => office.id === officeId) || null;
}

/**
 * The benchmark list grouped for the form, with the caveats attached so they
 * can be shown next to the input rather than buried in a help page.
 */
export function getBenchmarkGroups() {
  return FACILITY_GROUPS.map((group) => ({
    ...group,
    standards: AUDIT_STANDARDS.filter((standard) => standard.facility === group.id),
  })).filter((group) => group.standards.length > 0);
}

/** Target date for a remediation action, from the finding's severity. */
export function defaultTargetDate(severity, from = new Date()) {
  return suggestTargetDate({ severity }, from);
}

/** Builds the remediation actions raised by a set of findings. */
export function buildRemediationActions(findings = [], { officeId, assessmentId, now = new Date() } = {}) {
  return findings.map((finding, index) => ({
    id: `action-${assessmentId || 'draft'}-${finding.standardId}-${index}`,
    standardId: finding.standardId,
    label: finding.label,
    facility: finding.facility,
    severity: finding.severity,
    priority: SEVERITY_TO_PRIORITY[finding.severity] || REMEDIATION_PRIORITY.MEDIUM,
    finding: finding.message,
    requirement: finding.requirement,
    suggestedFix: finding.standard?.remediation || '',
    owner: '',
    targetDate: defaultTargetDate(finding.severity, now),
    status: REMEDIATION_STATUS.OPEN,
    statusLabel: REMEDIATION_STATUS_LABELS[REMEDIATION_STATUS.OPEN],
    verificationAssessmentId: '',
    note: '',
    officeId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
}

/**
 * Resolves which remediation actions are proven fixed by a later assessment.
 * Only a re-measurement that now passes closes an action as verified; the
 * office saying "done" without a re-measurement leaves it at "marked done".
 */
export function reconcileActionsWithAssessment(actions = [], results = [], assessmentId = '') {
  const passing = new Set(
    results.filter((result) => result.status === MEASUREMENT_STATUS.PASS).map((result) => result.standardId)
  );

  return actions.map((action) => {
    if (action.status === REMEDIATION_STATUS.CANCELLED) return action;

    if (passing.has(action.standardId) && action.status !== REMEDIATION_STATUS.VERIFIED) {
      return {
        ...action,
        status: REMEDIATION_STATUS.VERIFIED,
        statusLabel: REMEDIATION_STATUS_LABELS[REMEDIATION_STATUS.VERIFIED],
        verificationAssessmentId: assessmentId,
        updatedAt: new Date().toISOString(),
      };
    }

    return action;
  });
}

/**
 * Builds a complete assessment object from the form state, without saving it.
 *
 * @param {object} input { officeId, answers, auditorNote, followUpDays, assessedAt }
 */
export function buildAssessment({
  officeId,
  answers = {},
  auditorNote = '',
  followUpDays = DEFAULT_FOLLOW_UP_DAYS,
  assessedAt = new Date().toISOString(),
  id,
} = {}) {
  const office = getAuditableOffice(officeId);

  if (!office) {
    throw new Error('Choose the office or facility you are assessing.');
  }

  // Notes typed next to a measurement are sanitised once here, so every consumer
  // (table, CSV, report) shows the same text and nothing has to escape twice.
  const cleanAnswers = Object.fromEntries(
    Object.entries(answers || {}).map(([standardId, answer]) => [
      standardId,
      { ...answer, note: sanitizeText(answer?.note, MAX_NOTE_LENGTH) },
    ])
  );

  const results = evaluateAuditAnswers(cleanAnswers);
  const summary = summarizeAuditResults(results);
  const findings = buildFindings(results);
  const assessmentId = id || `audit-${officeId}-${Date.parse(assessedAt) || Date.now()}`;

  // Carry open actions forward from the previous assessment so nothing is lost
  // between visits, then close the ones this assessment proves fixed.
  const previous = getLatestAssessment(officeId);
  const inherited = (previous?.remediationActions || []).filter(
    (action) => action.status !== REMEDIATION_STATUS.VERIFIED && action.status !== REMEDIATION_STATUS.CANCELLED
  );

  const fresh = buildRemediationActions(findings, { officeId, assessmentId, now: new Date(assessedAt) });
  const freshIds = new Set(fresh.map((action) => action.standardId));
  const carried = inherited.filter((action) => !freshIds.has(action.standardId));

  const remediationActions = reconcileActionsWithAssessment(
    [...carried, ...fresh],
    results,
    assessmentId
  );

  const comparison = previous
    ? compareAssessments(previous.results || [], results)
    : results.map((result) => ({ ...result, change: 'first_measurement', previousStatus: null }));

  const followUp = new Date(assessedAt);
  followUp.setDate(followUp.getDate() + Math.max(1, Math.min(365, Number(followUpDays) || DEFAULT_FOLLOW_UP_DAYS)));

  return {
    id: assessmentId,
    schemaVersion: AUDIT_SCHEMA_VERSION,
    officeId: office.id,
    officeName: office.name,
    officeCity: office.city,
    assessedAt: new Date(assessedAt).toISOString(),
    auditorNote: sanitizeText(auditorNote, MAX_NOTE_LENGTH),
    answers: cleanAnswers,
    results,
    summary,
    findings,
    comparison,
    remediationActions,
    previousAssessmentId: previous?.id || '',
    followUpDate: followUp.toISOString().slice(0, 10),
    benchmarksVersion: AUDIT_SCHEMA_VERSION,
    disclaimer: SCREENING_DISCLAIMER,
    caveat: BENCHMARK_CAVEAT,
  };
}

/** Saves a built assessment. */
export function recordAssessment(assessment) {
  return saveAssessment(assessment);
}

/** All assessments for one office, oldest first. */
export function getOfficeAuditHistory(officeId) {
  return listAssessments(officeId);
}

/** Prior measurements for one benchmark, for the "history" column in the form. */
export function getMeasurementHistory(officeId, standardId) {
  return listAssessments(officeId)
    .map((assessment) => {
      const result = (assessment.results || []).find((item) => item.standardId === standardId);
      return result
        ? {
            assessmentId: assessment.id,
            assessedAt: assessment.assessedAt,
            status: result.status,
            displayValue: result.displayValue,
          }
        : null;
    })
    .filter(Boolean);
}

/**
 * Remediation actions across every assessment for an office, with overdue flags.
 * A verified action is only "overdue" if it was still open after its target date.
 */
export function getRemediationPlan(officeId, { today = new Date() } = {}) {
  const assessments = listAssessments(officeId);
  const latestByStandard = new Map();

  assessments.forEach((assessment) => {
    (assessment.remediationActions || []).forEach((action) => {
      // Later assessments supersede earlier ones for the same benchmark.
      latestByStandard.set(action.standardId, { ...action, assessmentId: assessment.id });
    });
  });

  const todayIso = isoDate(today);
  const todayTime = Date.parse(`${todayIso}T00:00:00Z`);

  return [...latestByStandard.values()]
    .map((action) => {
      const targetTime = Date.parse(`${action.targetDate}T00:00:00Z`);
      const daysRemaining = Number.isFinite(targetTime)
        ? Math.round((targetTime - todayTime) / 86400000)
        : null;
      const isClosed =
        action.status === REMEDIATION_STATUS.VERIFIED || action.status === REMEDIATION_STATUS.CANCELLED;

      return {
        ...action,
        daysRemaining,
        isOverdue: !isClosed && daysRemaining !== null && daysRemaining < 0,
        isDueSoon:
          !isClosed && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= DUE_SOON_DAYS,
      };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      const byPriority = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (byPriority !== 0) return byPriority;
      return String(a.targetDate).localeCompare(String(b.targetDate));
    });
}

/** Severity of the row's finding, for colour-coding without a score. */
export function severityForStandard(standardId) {
  const standard = STANDARD_BY_ID[standardId];
  return standard?.severity || 'minor';
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const statusLabel = {
  [MEASUREMENT_STATUS.PASS]: 'Meets benchmark',
  [MEASUREMENT_STATUS.AT_LIMIT]: 'At the limit — re-measure',
  [MEASUREMENT_STATUS.FAIL]: 'Below benchmark',
  [MEASUREMENT_STATUS.UNKNOWN]: 'Not measured',
  [MEASUREMENT_STATUS.NOT_APPLICABLE]: 'Not present',
  [MEASUREMENT_STATUS.INVALID]: 'Invalid entry',
};

/**
 * Printable report. Returned as escaped HTML so it can be opened in a print
 * window; every user-supplied value goes through escapeHtml.
 */
export function buildPrintableReport(assessment) {
  if (!assessment) return '';

  const summary = assessment.summary || summarizeAuditResults(assessment.results || []);
  const results = assessment.results || [];
  const actions = assessment.remediationActions || [];

  const row = (result) => `
      <tr>
        <td>${escapeHtml(result.label)}</td>
        <td>${escapeHtml(result.displayValue)}</td>
        <td>${escapeHtml(statusLabel[result.status] || result.status)}</td>
        <td>${escapeHtml(result.requirement || '')}</td>
        <td>${escapeHtml(result.source?.clause || '')} — ${escapeHtml(result.source?.id || '')}</td>
      </tr>`;

  const actionRow = (action) => `
      <tr>
        <td>${escapeHtml(action.label)}</td>
        <td>${escapeHtml(action.finding)}</td>
        <td>${escapeHtml(action.suggestedFix)}</td>
        <td>${escapeHtml(action.owner || 'Not assigned')}</td>
        <td>${escapeHtml(action.targetDate)}</td>
        <td>${escapeHtml(action.statusLabel || action.status)}</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Accessibility screening — ${escapeHtml(assessment.officeName)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 32px; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.2rem; }
  h2 { font-size: 1.1rem; margin-top: 1.6rem; border-bottom: 1px solid #999; padding-bottom: 0.2rem; }
  .meta { color: #444; font-size: 0.9rem; margin-bottom: 1rem; }
  .notice { border: 1px solid #999; background: #f6f6f6; padding: 0.75rem 1rem; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.5rem; }
  th, td { border: 1px solid #bbb; padding: 0.35rem 0.45rem; text-align: left; vertical-align: top; }
  th { background: #eee; }
  .counts { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem; margin: 0.5rem 0; }
  .counts span { border: 1px solid #bbb; padding: 0.25rem 0.6rem; }
  footer { margin-top: 2rem; font-size: 0.75rem; color: #444; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>Accessibility screening report</h1>
  <p class="meta">
    ${escapeHtml(assessment.officeName)}${assessment.officeCity ? `, ${escapeHtml(assessment.officeCity)}` : ''}<br>
    Assessed on ${escapeHtml(isoDate(assessment.assessedAt))} · Benchmarks v${escapeHtml(assessment.benchmarksVersion || AUDIT_SCHEMA_VERSION)}
    ${assessment.previousAssessmentId ? ' · Follow-up assessment' : ' · First assessment'}
  </p>

  <p class="notice">${escapeHtml(SCREENING_DISCLAIMER)}</p>

  <h2>Summary</h2>
  <div class="counts">
    <span>Meets benchmark: ${summary.pass}</span>
    <span>At the limit: ${summary.at_limit}</span>
    <span>Below benchmark: ${summary.fail}</span>
    <span>Not measured: ${summary.unknown}</span>
    <span>Not present: ${summary.not_applicable}</span>
  </div>
  <p class="meta">${escapeHtml(
    `${summary.measured} of ${summary.total} benchmarks were measured. ${
      assessment.auditorNote ? `Notes: ${assessment.auditorNote}` : 'No overall note was added.'
    }`
  )}</p>

  <h2>Measurements</h2>
  <table>
    <thead><tr><th>Benchmark</th><th>Measured</th><th>Result</th><th>Requirement</th><th>Source</th></tr></thead>
    <tbody>${results.map(row).join('')}</tbody>
  </table>

  <h2>Remediation plan</h2>
  ${
    actions.length === 0
      ? '<p>No remediation actions were raised by this assessment.</p>'
      : `<table>
    <thead><tr><th>Item</th><th>What fell short</th><th>Suggested fix</th><th>Owner</th><th>Target date</th><th>Status</th></tr></thead>
    <tbody>${actions.map(actionRow).join('')}</tbody>
  </table>`
  }

  ${
    results.some((result) => result.note)
      ? `<h2>Measurement notes</h2>
  <ul>${results
    .filter((result) => result.note)
    .map((result) => `<li><strong>${escapeHtml(result.label)}:</strong> ${escapeHtml(result.note)}</li>`)
    .join('')}</ul>`
      : ''
  }

  <h2>How to use this report</h2>
  <p class="meta">${escapeHtml(BENCHMARK_CAVEAT)} Attach it to a written complaint to the office head or the
  municipal engineer, quote the target date for each item, and ask for the next assessment date in writing.
  Bring the report to the follow-up assessment so the same points are measured the same way.</p>

  <footer>Generated with Civic Help Setu. Measurements recorded on this device; nothing was uploaded.</footer>
</body>
</html>`;
}

/** Short plain-text summary, for pasting into a complaint or a message. */
export function buildTextSummary(assessment) {
  if (!assessment) return '';
  const summary = assessment.summary || summarizeAuditResults(assessment.results || []);
  const findings = assessment.findings || [];

  const lines = [
    `Accessibility screening — ${assessment.officeName}${assessment.officeCity ? `, ${assessment.officeCity}` : ''}`,
    `Assessed: ${isoDate(assessment.assessedAt)}`,
    `Measured: ${summary.measured}/${summary.total} benchmarks (meets ${summary.pass}, at limit ${summary.at_limit}, below ${summary.fail})`,
  ];

  if (findings.length > 0) {
    lines.push('', 'Points that fell short:');
    findings.forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding.label}: ${finding.message} (${finding.requirement})`);
    });
  }

  const openActions = (assessment.remediationActions || []).filter(
    (action) => action.status !== REMEDIATION_STATUS.VERIFIED && action.status !== REMEDIATION_STATUS.CANCELLED
  );

  if (openActions.length > 0) {
    lines.push('', 'Requested fixes:');
    openActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action.label} — target ${action.targetDate}${action.owner ? `, owner ${action.owner}` : ''}`);
    });
  }

  lines.push('', SCREENING_DISCLAIMER);
  return lines.join('\n');
}

/** Sanitises an owner field typed by the auditor. */
export function sanitizeOwner(value) {
  return sanitizeText(value, MAX_OWNER_LENGTH);
}

export { RECORDING_STATES };
