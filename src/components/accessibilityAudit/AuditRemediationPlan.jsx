import { useId, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, Printer, Trash2 } from 'lucide-react';
import {
  REMEDIATION_PRIORITY,
  REMEDIATION_STATUS,
  REMEDIATION_STATUS_LABELS,
} from '../../data/accessibilityAuditStandards.js';
import { sanitizeOwner } from '../../services/accessibilityAuditService.js';
import { updateRemediationAction, deleteAssessment } from '../../services/accessibilityAuditStorage.js';

const PRIORITY_LABEL = {
  [REMEDIATION_PRIORITY.HIGH]: 'High — blocks access',
  [REMEDIATION_PRIORITY.MEDIUM]: 'Medium',
  [REMEDIATION_PRIORITY.LOW]: 'Low',
};

/**
 * Remediation plan for one assessment. Each action carries the measurement that
 * raised it, a suggested fix, an owner and a target date. Closing an action only
 * becomes "verified" after a re-assessment measures it again.
 */
export default function AuditRemediationPlan({ assessment, onActionsChanged, readOnly = false }) {
  const baseId = useId();
  const [draftOwners, setDraftOwners] = useState({});
  const [error, setError] = useState('');
  const actions = assessment?.remediationActions || [];

  if (!assessment) return null;

  const applyPatch = (actionId, patch) => {
    const outcome = updateRemediationAction(assessment.officeId, assessment.id, actionId, patch);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setError('');
    onActionsChanged?.();
  };

  const commitOwner = (action) => {
    const draft = draftOwners[action.id];
    if (draft === undefined) return;
    applyPatch(action.id, { owner: sanitizeOwner(draft) });
    setDraftOwners((current) => {
      const next = { ...current };
      delete next[action.id];
      return next;
    });
  };

  return (
    <section className="audit-panel" aria-labelledby={`${baseId}-heading`}>
      <h2 className="audit-panel__title" id={`${baseId}-heading`}>
        <ClipboardList size={18} aria-hidden="true" /> Remediation plan
      </h2>
      <p className="audit-panel__text">
        One action per benchmark that fell short, carried forward to the next assessment until it is measured
        again and passes. An action marked done by the office stays “marked done” until a re-assessment measures
        it again — that is what makes the claim checkable.
      </p>

      {error && (
        <p className="audit-inline-error" role="alert">
          {error}
        </p>
      )}

      {actions.length === 0 ? (
        <p className="audit-empty-inline">
          <CheckCircle2 size={16} aria-hidden="true" /> No remediation actions were raised by this assessment.
        </p>
      ) : (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <caption>
              {actions.length} action{actions.length === 1 ? '' : 's'} for {assessment.officeName}. Target dates are
              suggestions from the severity of the gap, not a legal deadline.
            </caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">What fell short</th>
                <th scope="col">Suggested fix</th>
                <th scope="col">Owner</th>
                <th scope="col">Target date</th>
                <th scope="col">Status</th>
                {!readOnly && <th scope="col">Action</th>}
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td>
                    <strong>{action.label}</strong>
                    <br />
                    <span className={`audit-priority audit-priority--${action.priority}`}>
                      {PRIORITY_LABEL[action.priority] || action.priority}
                    </span>
                  </td>
                  <td>{action.finding}</td>
                  <td>{action.suggestedFix || '—'}</td>
                  <td>
                    {readOnly ? (
                      action.owner || 'Not assigned'
                    ) : (
                      <>
                        <label className="audit-visually-hidden" htmlFor={`${baseId}-owner-${action.id}`}>
                          Owner for {action.label}
                        </label>
                        <input
                          className="audit-input"
                          id={`${baseId}-owner-${action.id}`}
                          type="text"
                          maxLength={120}
                          value={draftOwners[action.id] ?? action.owner ?? ''}
                          onChange={(event) =>
                            setDraftOwners((current) => ({ ...current, [action.id]: event.target.value }))
                          }
                          onBlur={() => commitOwner(action)}
                          placeholder="Office head, engineer…"
                        />
                      </>
                    )}
                  </td>
                  <td>
                    <CalendarClock size={13} aria-hidden="true" /> {action.targetDate}
                  </td>
                  <td>
                    <span className={`audit-status-badge audit-status-badge--${action.status}`}>
                      {action.statusLabel || REMEDIATION_STATUS_LABELS[action.status] || action.status}
                    </span>
                  </td>
                  {!readOnly && (
                    <td>
                      <div className="audit-row-actions">
                        {action.status === REMEDIATION_STATUS.OPEN && (
                          <button
                            type="button"
                            className="audit-btn audit-btn--small"
                            onClick={() => applyPatch(action.id, { status: REMEDIATION_STATUS.IN_PROGRESS })}
                          >
                            Start work
                          </button>
                        )}
                        {action.status === REMEDIATION_STATUS.IN_PROGRESS && (
                          <button
                            type="button"
                            className="audit-btn audit-btn--small audit-btn--ghost"
                            onClick={() => applyPatch(action.id, { status: REMEDIATION_STATUS.OPEN })}
                          >
                            Reopen
                          </button>
                        )}
                        {action.status !== REMEDIATION_STATUS.VERIFIED &&
                          action.status !== REMEDIATION_STATUS.CANCELLED && (
                            <button
                              type="button"
                              className="audit-btn audit-btn--small audit-btn--ghost"
                              onClick={() =>
                                applyPatch(action.id, {
                                  status: REMEDIATION_STATUS.RESOLVED,
                                  statusLabel: REMEDIATION_STATUS_LABELS[REMEDIATION_STATUS.RESOLVED],
                                })
                              }
                            >
                              Mark done
                            </button>
                          )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && (
        <div className="audit-actions">
          <button
            type="button"
            className="audit-btn audit-btn--danger"
            onClick={() => {
              const outcome = deleteAssessment(assessment.officeId, assessment.id);
              if (!outcome.ok) setError(outcome.error);
              else onActionsChanged?.();
            }}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete this assessment
          </button>
          <button type="button" className="audit-btn audit-btn--ghost" onClick={() => window.print()}>
            <Printer size={15} aria-hidden="true" /> Print this plan
          </button>
        </div>
      )}
    </section>
  );
}
