import { useId, useMemo, useState } from 'react';
import { History, TrendingDown, TrendingUp } from 'lucide-react';
import { MEASUREMENT_STATUS } from '../../data/accessibilityAuditStandards.js';
import { compareAssessments } from '../../services/accessibilityAuditEngine.js';
import MeasurementStatusChip, { ChangeFlag } from './auditStatus.jsx';

const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * Reassessment history for one office. The previous assessment is never
 * rewritten, so this view is a record of what was measured and when.
 */
export default function AuditHistory({ officeId, assessments = [] }) {
  const baseId = useId();
  const [selectedId, setSelectedId] = useState(() => assessments.at(-1)?.id || '');

  const selectedIndex = useMemo(() => {
    const index = assessments.findIndex((assessment) => assessment.id === selectedId);
    return index === -1 ? assessments.length - 1 : index;
  }, [assessments, selectedId]);

  const selected = assessments[selectedIndex] || null;

  /**
   * The comparison is derived here from the two assessments being shown rather
   * than read from the saved record: that keeps the table correct if an earlier
   * assessment was deleted, and it is the same deterministic rule the report uses.
   */
  const comparisonRows = useMemo(() => {
    if (!selected) return [];
    const previous = assessments[selectedIndex - 1];
    if (!previous) {
      return (selected.results || []).map((row) => ({ ...row, change: 'first_measurement', previousStatus: null, previousDisplay: '—' }));
    }
    return compareAssessments(previous.results || [], selected.results || []);
  }, [assessments, selected, selectedIndex]);

  if (!officeId || assessments.length === 0) {
    return (
      <section className="audit-panel" aria-labelledby={`${baseId}-empty`}>
        <h2 className="audit-panel__title" id={`${baseId}-empty`}>
          <History size={18} aria-hidden="true" /> Assessment history
        </h2>
        <p className="audit-panel__text">
          No assessment has been saved for this office yet. Record one on the Measure tab; after the second visit
          this tab shows what improved, what stayed the same and what got worse.
        </p>
      </section>
    );
  }

  const current = assessments.at(-1);
  const previous = assessments.length > 1 ? assessments.at(-2) : null;

  const trend = (() => {
    if (!previous) return null;
    const before = previous.summary || {};
    const after = current.summary || {};
    return {
      deltaPass: (after.pass || 0) - (before.pass || 0),
      deltaFail: (after.fail || 0) - (before.fail || 0),
    };
  })();

  const describeDelta = (value, noun) =>
    value === 0 ? `no change in ${noun}` : `${value > 0 ? '+' : '−'}${Math.abs(value)} ${noun}`;

  return (
    <section className="audit-panel" aria-labelledby={`${baseId}-heading`}>
      <h2 className="audit-panel__title" id={`${baseId}-heading`}>
        <History size={18} aria-hidden="true" /> Assessment history
      </h2>

      {trend && (
        <p className={`audit-trend ${trend.deltaFail > 0 ? 'audit-trend--worse' : trend.deltaFail < 0 ? 'audit-trend--better' : ''}`}>
          {trend.deltaFail < 0 ? <TrendingUp size={15} aria-hidden="true" /> : trend.deltaFail > 0 ? <TrendingDown size={15} aria-hidden="true" /> : null}
          Since the previous assessment, benchmarks that meet the benchmark: {describeDelta(trend.deltaPass, 'benchmarks')}.
          Below the benchmark: {describeDelta(trend.deltaFail, 'benchmarks')}.
        </p>
      )}

      <div className="audit-history-list" role="list">
        {assessments
          .slice()
          .reverse()
          .map((assessment) => {
            const summary = assessment.summary || {};
            const isSelected = selected?.id === assessment.id;
            return (
              <div className="audit-history-item" role="listitem" key={assessment.id}>
                <button
                  type="button"
                  className={`audit-history-btn ${isSelected ? 'is-selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(assessment.id)}
                >
                  <strong>{formatDateTime(assessment.assessedAt)}</strong>
                  <span>
                    {summary.measured || 0}/{summary.total || 0} measured · {summary.pass || 0} meet ·{' '}
                    {summary.fail || 0} below · {summary.unknown || 0} not measured
                  </span>
                </button>
              </div>
            );
          })}
      </div>

      {selected && (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <caption>
              Comparison for the assessment on {formatDateTime(selected.assessedAt)}, against the one before it.
            </caption>
            <thead>
              <tr>
                <th scope="col">Benchmark</th>
                <th scope="col">Then</th>
                <th scope="col">Now</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.standardId}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.previousStatus ? (
                      <MeasurementStatusChip status={row.previousStatus} />
                    ) : (
                      <span className="audit-field__hint">—</span>
                    )}
                  </td>
                  <td>
                    <MeasurementStatusChip status={row.status} />
                    {row.status !== MEASUREMENT_STATUS.UNKNOWN && (
                      <span className="audit-field__hint"> {row.displayValue}</span>
                    )}
                  </td>
                  <td>
                    <ChangeFlag
                      change={row.change}
                      previousStatus={row.previousStatus}
                      previousDisplay={row.previousDisplay}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
