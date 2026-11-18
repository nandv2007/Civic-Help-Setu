import { useId, useMemo, useState } from 'react';
import { ArrowUpDown, Download, Filter } from 'lucide-react';
import { FACILITY_GROUPS, MEASUREMENT_STATUS } from '../../data/accessibilityAuditStandards.js';
import MeasurementStatusChip, { ChangeFlag } from './auditStatus.jsx';
import { resultsToCsv } from './auditCsv.js';

const FACILITY_LABEL = Object.fromEntries(FACILITY_GROUPS.map((group) => [group.id, group.label]));

const STATUS_ORDER = {
  [MEASUREMENT_STATUS.FAIL]: 0,
  [MEASUREMENT_STATUS.AT_LIMIT]: 1,
  [MEASUREMENT_STATUS.INVALID]: 2,
  [MEASUREMENT_STATUS.UNKNOWN]: 3,
  [MEASUREMENT_STATUS.NOT_APPLICABLE]: 4,
  [MEASUREMENT_STATUS.PASS]: 5,
};

/**
 * Accessible results table: a real <table> with captions and headers, a text
 * filter, and a "only what fell short" toggle. The same data is also offered as
 * a definition list for narrow screens (see the cards below the table).
 */
export default function AuditResultsTable({ results = [], officeName = '', comparison = null, onExportCsv }) {
  const baseId = useId();
  const [filter, setFilter] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [sortBySeverity, setSortBySeverity] = useState(true);

  const comparisonById = useMemo(() => {
    const map = new Map();
    (comparison || []).forEach((item) => map.set(item.standardId, item));
    return map;
  }, [comparison]);

  const visible = useMemo(() => {
    const text = filter.trim().toLowerCase();
    let rows = results.filter((result) => {
      if (onlyProblems && result.status === MEASUREMENT_STATUS.PASS) return false;
      if (onlyProblems && result.status === MEASUREMENT_STATUS.NOT_APPLICABLE) return false;
      if (!text) return true;
      return (
        result.label.toLowerCase().includes(text) ||
        (FACILITY_LABEL[result.facility] || '').toLowerCase().includes(text) ||
        (result.requirement || '').toLowerCase().includes(text)
      );
    });

    if (sortBySeverity) {
      rows = [...rows].sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return a.label.localeCompare(b.label);
      });
    }

    return rows;
  }, [results, filter, onlyProblems, sortBySeverity]);

  const problems = results.filter(
    (result) => result.status === MEASUREMENT_STATUS.FAIL || result.status === MEASUREMENT_STATUS.AT_LIMIT
  ).length;

  return (
    <section className="audit-panel" aria-labelledby={`${baseId}-heading`}>
      <div className="audit-panel__head">
        <div>
          <h2 className="audit-panel__title" id={`${baseId}-heading`}>
            Measurements
          </h2>
          <p className="audit-panel__text">
            {results.length} benchmarks, {problems} with a gap. “Not measured” and “not present” are kept apart
            from “below benchmark”: an unmeasured item is never treated as a failure, and a missing facility is
            not the same as a badly built one.
          </p>
        </div>
        <div className="audit-actions">
          {onExportCsv && (
            <button type="button" className="audit-btn audit-btn--ghost" onClick={() => onExportCsv(resultsToCsv(results, officeName))}>
              <Download size={15} aria-hidden="true" /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="audit-filter-row">
        <div className="audit-field">
          <label className="audit-field__label" htmlFor={`${baseId}-filter`}>
            <Filter size={13} aria-hidden="true" /> Filter benchmarks
          </label>
          <input
            className="audit-input"
            id={`${baseId}-filter`}
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="ramp, door, washroom…"
          />
        </div>

        <label className="audit-check">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(event) => setOnlyProblems(event.target.checked)}
          />
          Only show gaps
        </label>

        <button
          type="button"
          className="audit-btn audit-btn--ghost audit-btn--small"
          onClick={() => setSortBySeverity((value) => !value)}
          aria-pressed={sortBySeverity}
        >
          <ArrowUpDown size={14} aria-hidden="true" /> {sortBySeverity ? 'Sorted by gap' : 'Sorted by form order'}
        </button>
      </div>

      <div className="audit-table-wrap">
        <table className="audit-table">
          <caption>
            Measurements for {officeName || 'this office'}, compared with the published benchmark for each item.
          </caption>
          <thead>
            <tr>
              <th scope="col">Benchmark</th>
              <th scope="col">Measured</th>
              <th scope="col">Result</th>
              <th scope="col">Requirement</th>
              <th scope="col">Source</th>
              {comparison && <th scope="col">Since last assessment</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((result) => (
              <tr key={result.standardId}>
                <th scope="row">
                  {result.label}
                  <br />
                  <span className="audit-field__hint">{FACILITY_LABEL[result.facility] || result.facility}</span>
                </th>
                <td>{result.displayValue}</td>
                <td>
                  <MeasurementStatusChip status={result.status} />
                </td>
                <td>{result.requirement}</td>
                <td>
                  {result.source?.id}
                  {result.source?.clause ? `, ${result.source.clause}` : ''}
                </td>
                {comparison && (
                  <td>
                    <ChangeFlag
                      change={comparisonById.get(result.standardId)?.change}
                      previousStatus={comparisonById.get(result.standardId)?.previousStatus}
                      previousDisplay={comparisonById.get(result.standardId)?.previousDisplay}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="audit-empty-inline">No benchmark matches “{filter}”.</p>
        )}
      </div>

      {results.some((result) => result.note) && (
        <div className="audit-panel__foot">
          <h3 className="audit-benchmark__label">Measurement notes</h3>
          <ul className="audit-note-list">
            {results
              .filter((result) => result.note)
              .map((result) => (
                <li key={`${result.standardId}-note`}>
                  <strong>{result.label}:</strong> {result.note}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
