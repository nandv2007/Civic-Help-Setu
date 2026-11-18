import { AlertTriangle, CheckCircle2, Info, Lock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import {
  INTEGRITY_DISCLAIMER,
  LOCAL_ONLY_NOTICE,
  MANIFEST_TAMPER_NOTE,
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LABELS,
} from '../../data/evidenceManifestContract.js';

/** Progress bar with a polite live region so screen readers hear the count. */
export function EvidenceProgress({ label = 'Working…', processed = 0, total = 0, fileName = '' }) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((processed / safeTotal) * 100));
  const message = fileName
    ? `${label} ${Math.min(processed + 1, total)} of ${total}: ${fileName}`
    : `${label} ${processed} of ${total}`;

  return (
    <div className="ev-progress">
      <p className="ev-progress__label" role="status" aria-live="polite">
        {message}
      </p>
      <div
        className="ev-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={processed}
        aria-valuetext={`${processed} of ${total} files processed`}
        aria-label={label}
      >
        <span className="ev-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Banner-style error with an optional retry action. */
export function EvidenceErrorState({ error, onRetry, id }) {
  return (
    <div className="ev-banner ev-banner--error" role="alert" id={id}>
      <AlertTriangle size={18} aria-hidden="true" />
      <div className="ev-banner__body">
        <strong>Something went wrong</strong>
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="ev-btn ev-btn--ghost" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function EvidenceEmptyState({ title, message, action }) {
  return (
    <div className="ev-empty">
      <ShieldAlert size={26} aria-hidden="true" />
      <p className="ev-empty__title">{title}</p>
      <p className="ev-empty__message">{message}</p>
      {action}
    </div>
  );
}

export function EvidenceOfflineNotice({ isOnline }) {
  if (isOnline) return null;
  return (
    <div className="ev-banner ev-banner--info" role="status">
      <Info size={16} aria-hidden="true" />
      <div className="ev-banner__body">
        <strong>You are offline.</strong>
        <p>
          Hashing and verification run entirely on this device, so they still work. Only the optional last-check
          announcement is skipped.
        </p>
      </div>
    </div>
  );
}

/** Colored chip for a verification status, with icon + text (never color alone). */
export function EvidenceStatusBadge({ status }) {
  const config = {
    [VERIFICATION_STATUS.VERIFIED]: { icon: CheckCircle2, className: 'ev-chip--ok' },
    [VERIFICATION_STATUS.CHANGED]: { icon: AlertTriangle, className: 'ev-chip--warn' },
    [VERIFICATION_STATUS.MISSING]: { icon: XCircle, className: 'ev-chip--bad' },
    [VERIFICATION_STATUS.EXTRA]: { icon: Info, className: 'ev-chip--neutral' },
  }[status] || { icon: Info, className: 'ev-chip--neutral' };

  const Icon = config.icon;

  return (
    <span className={`ev-chip ${config.className}`}>
      <Icon size={13} aria-hidden="true" />
      {VERIFICATION_STATUS_LABELS[status] || status}
    </span>
  );
}

/**
 * The "what this does and does not prove" panel. Kept beside the workspace so
 * the limits are visible before a citizen shares a dossier.
 */
export function EvidenceDisclaimers({ compact = false }) {
  return (
    <section className="ev-disclaimers" aria-labelledby="ev-disclaimers-heading">
      <h2 className="ev-disclaimers__heading" id="ev-disclaimers-heading">
        <Info size={16} aria-hidden="true" />
        What this check does — and does not — prove
      </h2>

      <div className="ev-disclaimers__grid">
        <div className="ev-disclaimers__item">
          <Lock size={16} aria-hidden="true" />
          <div>
            <h3>Stays on your device</h3>
            <p>{LOCAL_ONLY_NOTICE}</p>
          </div>
        </div>

        <div className="ev-disclaimers__item">
          <ShieldAlert size={16} aria-hidden="true" />
          <div>
            <h3>Integrity is not authenticity</h3>
            <p>{INTEGRITY_DISCLAIMER}</p>
          </div>
        </div>

        {!compact && (
          <div className="ev-disclaimers__item">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <h3>Keep your own copy of the manifest</h3>
              <p>{MANIFEST_TAMPER_NOTE}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
