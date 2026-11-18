import { useId, useMemo, useState } from 'react';
import { BookOpen, Info, Ruler } from 'lucide-react';
import {
  MEASUREMENT_KINDS,
  MEASUREMENT_STATUS,
  RECORDING_STATES,
  RECORDING_STATE_LABELS,
  SCREENING_DISCLAIMER,
  BENCHMARK_CAVEAT,
} from '../../data/accessibilityAuditStandards.js';
import { evaluateAnswer } from '../../services/accessibilityAuditEngine.js';
import { getBenchmarkGroups, listAuditableOffices, getMeasurementHistory } from '../../services/accessibilityAuditService.js';
import MeasurementStatusChip from './auditStatus.jsx';

const DEFAULT_ANSWER = { state: RECORDING_STATES.UNKNOWN, value: '', unit: '', note: '' };

const unitLabel = (unit) => {
  if (unit === 'percent') return '% gradient';
  if (unit === 'ratio') return 'ratio (1:N)';
  return unit;
};

/**
 * The measuring form. Each benchmark gets a plain-language question, the
 * benchmark itself, its source, and the caveats that decide whether it applies.
 * Everything is optional at the field level: a person can measure what they can
 * and leave the rest, and the result stays "not measured" rather than passing.
 */
export default function AuditMeasurementsForm({
  officeId,
  onOfficeChange,
  answers,
  onAnswerChange,
  auditorNote,
  onAuditorNoteChange,
  followUpDays,
  onFollowUpDaysChange,
  onShowReport,
  disabled = false,
}) {
  const baseId = useId();
  const [showCaveatsFor, setShowCaveatsFor] = useState(null);
  const groups = useMemo(() => getBenchmarkGroups(), []);
  const offices = useMemo(() => listAuditableOffices(), []);
  const office = offices.find((item) => item.id === officeId) || null;

  const history = useMemo(
    () => (officeId ? new Map(groups.flatMap((group) => group.standards.map((standard) => [
      standard.id,
      getMeasurementHistory(officeId, standard.id),
    ]))) : new Map()),
    [officeId, groups]
  );

  const getAnswer = (standardId) => answers[standardId] || DEFAULT_ANSWER;

  const setAnswer = (standardId, patch) => {
    onAnswerChange?.(standardId, { ...getAnswer(standardId), ...patch });
  };

  return (
    <div className="audit-form">
      <section className="audit-panel" aria-labelledby={`${baseId}-office`}>
        <h2 className="audit-panel__title" id={`${baseId}-office`}>
          <Ruler size={18} aria-hidden="true" /> Site and follow-up
        </h2>

        <div className="audit-grid-2">
          <div className="audit-field">
            <label className="audit-field__label" htmlFor={`${baseId}-office-select`}>
              Office or facility assessed
            </label>
            <select
              className="audit-input"
              id={`${baseId}-office-select`}
              value={officeId || ''}
              onChange={(event) => onOfficeChange?.(event.target.value)}
              disabled={disabled}
              aria-describedby={`${baseId}-office-hint`}
            >
              <option value="">Choose an office…</option>
              {offices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.city ? ` — ${item.city}` : ''}
                </option>
              ))}
            </select>
            <p className="audit-field__hint" id={`${baseId}-office-hint`}>
              Only offices in the civic directory can be assessed. Measurements are saved against this office so
              the next visit can be compared with this one.
            </p>
          </div>

          <div className="audit-field">
            <label className="audit-field__label" htmlFor={`${baseId}-followup`}>
              Plan the next assessment in
            </label>
            <div className="audit-inline">
              <input
                className="audit-input audit-input--short"
                id={`${baseId}-followup`}
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                value={followUpDays}
                onChange={(event) => onFollowUpDaysChange?.(event.target.value)}
                disabled={disabled}
                aria-describedby={`${baseId}-followup-hint`}
              />
              <span>days</span>
            </div>
            <p className="audit-field__hint" id={`${baseId}-followup-hint`}>
              Used to set the re-assessment date on the report. Between 1 and 365 days.
            </p>
          </div>
        </div>

        <div className="audit-field">
          <label className="audit-field__label" htmlFor={`${baseId}-note`}>
            Overall note (optional)
          </label>
          <textarea
            className="audit-textarea"
            id={`${baseId}-note`}
            rows={2}
            maxLength={300}
            value={auditorNote}
            onChange={(event) => onAuditorNoteChange?.(event.target.value)}
            disabled={disabled}
            placeholder="What a visitor should know that the numbers do not show. Do not include names or phone numbers."
            aria-describedby={`${baseId}-note-hint`}
          />
          <p className="audit-field__hint" id={`${baseId}-note-hint`}>
            {auditorNote.length}/300. Kept on this device and printed on the report.
          </p>
        </div>

        <div className="audit-notice" role="note">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>This is a screening, not a certified audit.</strong>
            <p>{SCREENING_DISCLAIMER}</p>
            <p>{BENCHMARK_CAVEAT}</p>
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section className="audit-panel" key={group.id} aria-labelledby={`${baseId}-${group.id}`}>
          <h2 className="audit-panel__title" id={`${baseId}-${group.id}`}>
            {group.label}
          </h2>

          {group.standards.map((standard) => {
            const answer = getAnswer(standard.id);
            const preview = evaluateAnswer({ standardId: standard.id, ...answer });
            const caveatsOpen = showCaveatsFor === standard.id;
            const past = history.get(standard.id) || [];
            const inputId = `${baseId}-${standard.id}`;
            const hintId = `${inputId}-hint`;
            const canMeasure = answer.state === RECORDING_STATES.RECORDED;

            return (
              <article className="audit-benchmark" key={standard.id} aria-labelledby={`${inputId}-label`}>
                <header className="audit-benchmark__head">
                  <div>
                    <h3 className="audit-benchmark__label" id={`${inputId}-label`}>
                      {standard.label}
                      {standard.required && (
                        <span className="audit-required" title="Core benchmark">
                          core
                        </span>
                      )}
                      {standard.severity === 'critical' && <span className="audit-severity">critical</span>}
                    </h3>
                    <p className="audit-benchmark__question">{standard.question}</p>
                  </div>
                  <MeasurementStatusChip status={preview.status} />
                </header>

                <p className="audit-benchmark__rule">
                  <strong>Benchmark:</strong> {standard.benchmarkText}
                  <br />
                  <span className="audit-benchmark__source">
                    <BookOpen size={12} aria-hidden="true" /> {standard.source.id}
                    {standard.source.clause ? `, ${standard.source.clause}` : ''} ({standard.source.year})
                  </span>
                  {standard.caveats?.length > 0 && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="audit-link-btn"
                        aria-expanded={caveatsOpen}
                        aria-controls={`${inputId}-caveats`}
                        onClick={() => setShowCaveatsFor(caveatsOpen ? null : standard.id)}
                      >
                        {caveatsOpen ? 'Hide caveats' : `Caveats (${standard.caveats.length})`}
                      </button>
                    </>
                  )}
                </p>

                {caveatsOpen && (
                  <ul className="audit-caveats" id={`${inputId}-caveats`}>
                    {standard.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                )}

                <div className="audit-benchmark__inputs">
                  <div className="audit-field">
                    <label className="audit-field__label" htmlFor={`${inputId}-state`}>
                      What did you find?
                    </label>
                    <select
                      className="audit-input"
                      id={`${inputId}-state`}
                      value={answer.state}
                      disabled={disabled}
                      onChange={(event) =>
                        setAnswer(standard.id, {
                          state: event.target.value,
                        })
                      }
                      aria-describedby={hintId}
                    >
                      {Object.values(RECORDING_STATES).map((state) => (
                        <option key={state} value={state}>
                          {RECORDING_STATE_LABELS[state]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {canMeasure && (
                    <>
                      <div className="audit-field">
                        <label className="audit-field__label" htmlFor={inputId}>
                          Measurement
                        </label>
                        <input
                          className="audit-input"
                          id={inputId}
                          type="text"
                          inputMode="decimal"
                          value={answer.value}
                          disabled={disabled}
                          onChange={(event) => setAnswer(standard.id, { value: event.target.value })}
                          aria-describedby={hintId}
                          placeholder={
                            standard.kind === MEASUREMENT_KINDS.SLOPE ? 'for example 7.5 or 1:14' : 'for example 880'
                          }
                        />
                      </div>

                      <div className="audit-field">
                        <label className="audit-field__label" htmlFor={`${inputId}-unit`}>
                          Unit
                        </label>
                        <select
                          className="audit-input"
                          id={`${inputId}-unit`}
                          value={answer.unit || standard.units[0]}
                          disabled={disabled}
                          onChange={(event) => setAnswer(standard.id, { unit: event.target.value })}
                        >
                          {standard.units.map((unit) => (
                            <option key={unit} value={unit}>
                              {unitLabel(unit)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <p className="audit-field__hint" id={hintId}>
                  {canMeasure ? standard.inputHint : 'Choosing “not present” or “could not measure” is not a failure — it is recorded as such.'}
                </p>

                {preview.status === MEASUREMENT_STATUS.INVALID && (
                  <p className="audit-inline-error" role="alert">
                    {preview.message}
                  </p>
                )}

                {preview.status !== MEASUREMENT_STATUS.INVALID && preview.status !== MEASUREMENT_STATUS.UNKNOWN && (
                  <p className="audit-benchmark__result">{preview.message}</p>
                )}

                {answer.state === RECORDING_STATES.RECORDED && (
                  <div className="audit-field">
                    <label className="audit-field__label" htmlFor={`${inputId}-note`}>
                      Note for this measurement (optional)
                    </label>
                    <input
                      className="audit-input"
                      id={`${inputId}-note`}
                      type="text"
                      maxLength={300}
                      value={answer.note}
                      disabled={disabled}
                      onChange={(event) => setAnswer(standard.id, { note: event.target.value })}
                      placeholder="For example: measured at the north ramp, second handrail loose."
                    />
                  </div>
                )}

                {past.length > 0 && (
                  <p className="audit-history">
                    <strong>Earlier measurements:</strong>{' '}
                    {past
                      .slice(-3)
                      .map((entry) => `${entry.assessedAt.slice(0, 10)} — ${entry.displayValue}`)
                      .join(' · ')}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      ))}

      <div className="audit-actions">
        <button type="button" className="audit-btn audit-btn--ghost" onClick={onShowReport} disabled={!office}>
          Preview report
        </button>
      </div>
    </div>
  );
}
