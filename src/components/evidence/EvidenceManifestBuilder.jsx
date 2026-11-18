import { useId, useRef } from 'react';
import {
  Download,
  FileCheck2,
  FileJson,
  FolderOpen,
  Info,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ALLOWED_TYPES_HINT,
  MAX_DESCRIPTION_LENGTH,
  MAX_FILES_PER_MANIFEST,
  MAX_FILE_SIZE_BYTES,
  MAX_MANIFEST_TITLE_LENGTH,
  formatBytes,
  sanitizeDescription,
} from '../../data/evidenceManifestContract.js';
import { EvidenceEmptyState, EvidenceProgress } from './EvidenceStates.jsx';
import { formatDateTime } from './evidenceFormat.js';

/**
 * Builds a manifest from files the citizen picks. Only metadata and digests
 * are shown; the files themselves stay in the browser.
 */
export default function EvidenceManifestBuilder({
  manifest,
  title,
  onTitleChange,
  entries = [],
  onFilesChosen,
  onDescriptionChange,
  onRemoveEntry,
  onExport,
  onSaveLocal,
  onClear,
  onImportClick,
  importing = false,
  hashing = false,
  progress = null,
  fileErrors = [],
  onDismissFileErrors,
  duplicateGroups = [],
  statusMessage = null,
  storageWarning = null,
}) {
  const titleId = useId();
  const fileInputId = useId();
  const hintId = useId();
  const fileInputRef = useRef(null);
  const atLimit = entries.length >= MAX_FILES_PER_MANIFEST;

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) onFilesChosen?.(files);
    // Reset so choosing the same file again still fires a change event.
    event.target.value = '';
  };

  return (
    <div className="ev-shell">
      <section className="ev-panel" aria-labelledby={`${titleId}-heading`}>
        <div className="ev-panel__head">
          <div>
            <h2 className="ev-panel__title" id={`${titleId}-heading`}>
              <FileCheck2 size={18} aria-hidden="true" /> Build an evidence manifest
            </h2>
            <p className="ev-panel__text">
              Pick the evidence files for your complaint dossier. Each file is read once in this browser to
              compute its SHA-256 digest, then you can add a short note about what it shows. The manifest keeps
              the file name, size, format, digest and the time you added it — never the file contents.
            </p>
          </div>
        </div>

        <div className="ev-field">
          <label className="ev-field__label" htmlFor={`${titleId}-title`}>
            Dossier name
          </label>
          <input
            className="ev-input"
            id={`${titleId}-title`}
            type="text"
            value={title}
            maxLength={MAX_MANIFEST_TITLE_LENGTH}
            onChange={(event) => onTitleChange?.(event.target.value)}
            placeholder="For example: Streetlight complaint — Ward 42"
            aria-describedby={`${titleId}-title-hint`}
          />
          <p className="ev-field__hint" id={`${titleId}-title-hint`}>
            Shown on the exported manifest so you can tell dossiers apart. Up to {MAX_MANIFEST_TITLE_LENGTH}{' '}
            characters. Do not put ID numbers or phone numbers here — the manifest may be shared.
          </p>
        </div>

        <div className="ev-field">
          <label className="ev-field__label" htmlFor={fileInputId}>
            Add evidence files
          </label>
          <input
            ref={fileInputRef}
            className="ev-file-input"
            id={fileInputId}
            type="file"
            multiple
            disabled={hashing || atLimit}
            onChange={handleFiles}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,application/pdf,image/jpeg,image/png,image/webp,text/plain"
            aria-describedby={hintId}
          />
          <p className="ev-field__hint" id={hintId}>
            {ALLOWED_TYPES_HINT} {entries.length}/{MAX_FILES_PER_MANIFEST} files added.
            {atLimit ? ' Remove a file before adding more.' : ''}
          </p>
        </div>

        {hashing && progress && (
          <EvidenceProgress
            label="Hashing files"
            processed={progress.processed}
            total={progress.total}
            fileName={progress.fileName}
          />
        )}

        {fileErrors.length > 0 && (
          <div className="ev-banner ev-banner--error" role="alert">
            <ShieldAlert size={18} aria-hidden="true" />
            <div className="ev-banner__body">
              <strong>
                {fileErrors.length} file{fileErrors.length === 1 ? '' : 's'} could not be added
              </strong>
              <ul>
                {fileErrors.map((item, index) => (
                  <li key={`${item.fileName}-${index}`}>
                    <strong>{item.fileName || 'Unknown file'}:</strong> {item.error}
                  </li>
                ))}
              </ul>
              {onDismissFileErrors && (
                <button type="button" className="ev-btn ev-btn--ghost" onClick={onDismissFileErrors}>
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {duplicateGroups.length > 0 && (
          <div className="ev-banner ev-banner--warn">
            <ShieldAlert size={18} aria-hidden="true" />
            <div className="ev-banner__body">
              <strong>Possible duplicate files</strong>
              <ul>
                {duplicateGroups.map((group) => (
                  <li key={`${group.reason}-${group.entries[0].id}`}>
                    {group.message} {group.entries.map((entry) => entry.fileName).join(', ')}
                  </li>
                ))}
              </ul>
              <p>Duplicates are allowed, but a dossier is easier to review without them.</p>
            </div>
          </div>
        )}

        {statusMessage && (
          <p className="ev-banner ev-banner--ok" role="status" aria-live="polite">
            {statusMessage}
          </p>
        )}

        {storageWarning && (
          <div className="ev-banner ev-banner--warn" role="alert">
            <Info size={16} aria-hidden="true" />
            <div className="ev-banner__body">
              <p>{storageWarning}</p>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <EvidenceEmptyState
            title="No files in this manifest yet"
            message={`Choose up to ${MAX_FILES_PER_MANIFEST} files (${formatBytes(MAX_FILE_SIZE_BYTES)} each). Nothing leaves your device while the manifest is built.`}
          />
        ) : (
          <div className="ev-table-wrap">
            <table className="ev-table">
              <caption>
                {entries.length} file{entries.length === 1 ? '' : 's'} recorded in this manifest. Descriptions are
                saved in the manifest, so keep them factual and free of personal identifiers.
              </caption>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Size</th>
                  <th scope="col">SHA-256 digest</th>
                  <th scope="col">Added</th>
                  <th scope="col">Description</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.id}-${index}`}>
                    <td>
                      <strong>{entry.fileName}</strong>
                      <br />
                      <span className="ev-field__hint">{entry.mimeType || entry.extension || 'Unknown format'}</span>
                    </td>
                    <td>{formatBytes(entry.sizeBytes)}</td>
                    <td>
                      <span className="ev-digest" title={entry.digest}>
                        {entry.digest}
                      </span>
                    </td>
                    <td>{formatDateTime(entry.addedAt)}</td>
                    <td>
                      <label className="ev-visually-hidden" htmlFor={`${entry.id}-desc`}>
                        Description for {entry.fileName}
                      </label>
                      <textarea
                        className="ev-textarea"
                        id={`${entry.id}-desc`}
                        value={entry.description}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        rows={2}
                        placeholder="What does this file show?"
                        onChange={(event) => onDescriptionChange?.(entry.id, event.target.value)}
                      />
                      <span className="ev-field__hint">
                        {sanitizeDescription(entry.description).length}/{MAX_DESCRIPTION_LENGTH}
                      </span>
                    </td>
                    <td>
                      <div className="ev-row-actions">
                        <button
                          type="button"
                          className="ev-btn ev-btn--danger"
                          onClick={() => onRemoveEntry?.(entry.id)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ev-actions">
          <button
            type="button"
            className="ev-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={hashing || atLimit}
          >
            <Plus size={16} aria-hidden="true" />
            Add files
          </button>

          <button type="button" className="ev-btn ev-btn--ghost" onClick={onSaveLocal} disabled={!manifest || hashing}>
            <Save size={16} aria-hidden="true" />
            Save on this device
          </button>

          <button type="button" className="ev-btn ev-btn--ghost" onClick={onExport} disabled={!manifest || hashing}>
            <Download size={16} aria-hidden="true" />
            Export manifest (.json)
          </button>

          <button type="button" className="ev-btn ev-btn--ghost" onClick={onImportClick} disabled={importing || hashing}>
            <Upload size={16} aria-hidden="true" />
            Import manifest
          </button>

          {entries.length > 0 && (
            <button type="button" className="ev-btn ev-btn--danger" onClick={onClear} disabled={hashing}>
              <Trash2 size={16} aria-hidden="true" />
              Clear manifest
            </button>
          )}
        </div>

        <p className="ev-field__hint">
          <FolderOpen size={13} aria-hidden="true" /> Saving on this device keeps only the manifest, so it is still
          there next time you open this page. The exported <FileJson size={13} aria-hidden="true" /> JSON file is the
          copy you can move to another device or attach to your complaint.
        </p>
      </section>
    </div>
  );
}
