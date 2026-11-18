import { useId, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatDateTime } from './evidenceFormat.js';
import {
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LABELS,
  formatBytes,
} from '../../data/evidenceManifestContract.js';
import {
  EvidenceEmptyState,
  EvidenceErrorState,
  EvidenceProgress,
  EvidenceStatusBadge,
} from './EvidenceStates.jsx';

const STATUS_ORDER = {
  [VERIFICATION_STATUS.CHANGED]: 0,
  [VERIFICATION_STATUS.MISSING]: 1,
  [VERIFICATION_STATUS.EXTRA]: 2,
  [VERIFICATION_STATUS.VERIFIED]: 3,
};

/**
 * Verifies a chosen set of files against a manifest and shows a per-file
 * result: unchanged, changed, missing or not in the manifest.
 */
export default function EvidenceManifestVerifier({
  manifest,
  manifestSource = null,
  results = null,
  summary = null,
  verificationErrors = [],
  scanDuplicates = [],
  onImportManifestClick,
  onClearManifest,
  onVerifyFiles,
  onExportResults,
  onDownloadManifest,
  verifying = false,
  progress = null,
  error = null,
  onRetry,
  onResetResults,
}) {
  const headingId = useId();
  const filesInputId = useId();
  const emptyFilesRef = useRef(null);

  const sortedResults = results
    ? [...results].sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return String(a.manifestEntry?.fileName || a.actual?.fileName || '').localeCompare(
          String(b.manifestEntry?.fileName || b.actual?.fileName || '')
        );
      })
    : [];

  const handleVerify = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length > 0) onVerifyFiles?.(files);
  };

  return (
    <div className="ev-shell">
      <section className="ev-panel" aria-labelledby={headingId}>
        <div className="ev-panel__head">
          <div>
            <h2 className="ev-panel__title" id={headingId}>
              <ShieldCheck size={18} aria-hidden="true" /> Check files against a manifest
            </h2>
            <p className="ev-panel__text">
              Choose the manifest you exported earlier, then select the evidence files again. Each file is hashed
              in this browser and compared with the recorded digests. Files that are unchanged, changed, missing
              or newly added are listed separately.
            </p>
          </div>
        </div>

        {error && <EvidenceErrorState error={error} onRetry={onRetry} />}

        {!manifest ? (
          <EvidenceEmptyState
            title="No manifest loaded"
            message="Import the manifest JSON you exported when you built the dossier. If you saved it on this device, it will appear here automatically."
            action={
              <button type="button" className="ev-btn" onClick={onImportManifestClick}>
                <Upload size={16} aria-hidden="true" />
                Import manifest (.json)
              </button>
            }
          />
        ) : (
          <>
            <div className="ev-banner ev-banner--info">
              <FileJson size={18} aria-hidden="true" />
              <div className="ev-banner__body">
                <strong>{manifest.title}</strong>
                <p className="ev-meta">
                  <span>
                    Files: <strong>{manifest.files.length}</strong>
                  </span>
                  <span>
                    Created: <strong>{formatDateTime(manifest.createdAt)}</strong>
                  </span>
                  <span>
                    Schema: <strong>{manifest.schemaVersion}</strong>
                  </span>
                  <span>
                    Algorithm: <strong>{manifest.hashAlgorithm}</strong>
                  </span>
                  {manifestSource && (
                    <span>
                      Source: <strong>{manifestSource}</strong>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="ev-field">
              <label className="ev-field__label" htmlFor={filesInputId}>
                Evidence files to check
              </label>
              <input
                ref={emptyFilesRef}
                className="ev-file-input"
                id={filesInputId}
                type="file"
                multiple
                disabled={verifying}
                onChange={handleVerify}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,application/pdf,image/jpeg,image/png,image/webp,text/plain"
                aria-describedby={`${filesInputId}-hint`}
              />
              <p className="ev-field__hint" id={`${filesInputId}-hint`}>
                Select every file the manifest lists, plus any file you are unsure about. Files that are not
                selected are reported as missing rather than as changed.
              </p>
            </div>

            {verifying && progress && (
              <EvidenceProgress
                label="Hashing files to check"
                processed={progress.processed}
                total={progress.total}
                fileName={progress.fileName}
              />
            )}

            <div className="ev-actions">
              <button
                type="button"
                className="ev-btn"
                onClick={() => emptyFilesRef.current?.click()}
                disabled={verifying}
              >
                <FolderOpen size={16} aria-hidden="true" />
                Choose files and verify
              </button>

              <button type="button" className="ev-btn ev-btn--ghost" onClick={onImportManifestClick} disabled={verifying}>
                <RefreshCw size={16} aria-hidden="true" />
                Use a different manifest
              </button>

              <button type="button" className="ev-btn ev-btn--ghost" onClick={onDownloadManifest} disabled={verifying}>
                <Download size={16} aria-hidden="true" />
                Download manifest
              </button>

              <button type="button" className="ev-btn ev-btn--danger" onClick={onClearManifest} disabled={verifying}>
                <Trash2 size={16} aria-hidden="true" />
                Forget manifest
              </button>
            </div>
          </>
        )}

        {verificationErrors.length > 0 && (
          <div className="ev-banner ev-banner--error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <div className="ev-banner__body">
              <strong>
                {verificationErrors.length} file{verificationErrors.length === 1 ? '' : 's'} could not be checked
              </strong>
              <ul>
                {verificationErrors.map((item, index) => (
                  <li key={`${item.fileName}-${index}`}>
                    <strong>{item.fileName}:</strong> {item.error}
                  </li>
                ))}
              </ul>
              <p>These files are not counted as unchanged. Check them again after fixing the problem above.</p>
            </div>
          </div>
        )}

        {scanDuplicates.length > 0 && (
          <div className="ev-banner ev-banner--warn">
            <AlertTriangle size={18} aria-hidden="true" />
            <div className="ev-banner__body">
              <strong>Duplicate files in what you just selected</strong>
              <ul>
                {scanDuplicates.map((group) => (
                  <li key={group.reason}>
                    {group.message} {group.entries.map((entry) => entry.fileName).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {summary && (
        <section className="ev-panel" aria-labelledby={`${headingId}-results`}>
          <div className="ev-panel__head">
            <div>
              <h2 className="ev-panel__title" id={`${headingId}-results`}>
                Verification result
              </h2>
              <p className="ev-panel__text" role="status" aria-live="polite">
                {summary.isIntact
                  ? `All ${summary.total} files were found and every digest matched the manifest.`
                  : `${summary.total} files checked against the manifest: ${summary.verified} unchanged, ${summary.changed} changed, ${summary.missing} missing and ${summary.extra} not listed in the manifest.`}
              </p>
            </div>
          </div>

          <div className={`ev-banner ${summary.isIntact ? 'ev-banner--ok' : 'ev-banner--warn'}`}>
            {summary.isIntact ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <ShieldX size={18} aria-hidden="true" />
            )}
            <div className="ev-banner__body">
              <strong>{summary.isIntact ? 'No changes detected' : 'The dossier does not match the manifest'}</strong>
              <p>
                {summary.isIntact
                  ? 'The files still match the digests recorded in the manifest. This shows the bytes are identical — it does not prove the documents themselves are authentic.'
                  : 'Do not treat the dossier as verified. A changed or missing file may be innocent (a re-scan, a rename) or may mean the evidence was altered. Check the details below before sharing.'}
              </p>
            </div>
          </div>

          <div className="ev-stats">
            <div className="ev-stat">
              <p className="ev-stat__label">Unchanged</p>
              <p className="ev-stat__value">{summary.verified}</p>
            </div>
            <div className="ev-stat">
              <p className="ev-stat__label">Changed</p>
              <p className="ev-stat__value">{summary.changed}</p>
            </div>
            <div className="ev-stat">
              <p className="ev-stat__label">Missing</p>
              <p className="ev-stat__value">{summary.missing}</p>
            </div>
            <div className="ev-stat">
              <p className="ev-stat__label">Not in manifest</p>
              <p className="ev-stat__value">{summary.extra}</p>
            </div>
          </div>

          <div className="ev-table-wrap">
            <table className="ev-table">
              <caption>
                Per-file comparison. “Expected” is the digest recorded in the manifest; “Found” is the digest
                computed just now from the file you selected.
              </caption>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Status</th>
                  <th scope="col">Expected digest</th>
                  <th scope="col">Found digest</th>
                  <th scope="col">Size</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((result, index) => {
                  const fileName = result.manifestEntry?.fileName || result.actual?.fileName || 'Unknown file';
                  const expectedSize = result.manifestEntry?.sizeBytes;
                  const actualSize = result.actual?.sizeBytes;

                  return (
                    <tr key={`${fileName}-${index}`}>
                      <td>
                        <strong>{fileName}</strong>
                        <br />
                        <span className="ev-field__hint">
                          {VERIFICATION_STATUS_LABELS[result.status]} ·{' '}
                          {result.manifestEntry ? 'listed in manifest' : 'not listed in manifest'}
                        </span>
                      </td>
                      <td>
                        <EvidenceStatusBadge status={result.status} />
                      </td>
                      <td>
                        <span className="ev-digest">{result.expectedDigest || '—'}</span>
                      </td>
                      <td>
                        <span
                          className={`ev-digest ${
                            result.status === VERIFICATION_STATUS.CHANGED ? 'ev-digest--mismatch' : ''
                          }`}
                        >
                          {result.actualDigest || 'not found'}
                        </span>
                      </td>
                      <td>
                        {expectedSize !== undefined && <div>Expected: {formatBytes(expectedSize)}</div>}
                        {actualSize !== undefined && (
                          <div>
                            Found: {formatBytes(actualSize)}
                            {result.status === VERIFICATION_STATUS.CHANGED &&
                              result.sizeDelta !== 0 &&
                              ` (${result.sizeDelta > 0 ? '+' : ''}${formatBytes(Math.abs(result.sizeDelta))} ${
                                result.sizeDelta > 0 ? 'larger' : 'smaller'
                              })`}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ev-actions">
            <button type="button" className="ev-btn" onClick={() => emptyFilesRef.current?.click()} disabled={verifying}>
              <RefreshCw size={16} aria-hidden="true" />
              Check the files again
            </button>
            <button type="button" className="ev-btn ev-btn--ghost" onClick={onExportResults} disabled={verifying}>
              <Download size={16} aria-hidden="true" />
              Export result (.csv)
            </button>
            {onResetResults && (
              <button type="button" className="ev-btn ev-btn--ghost" onClick={onResetResults} disabled={verifying}>
                Clear result
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
