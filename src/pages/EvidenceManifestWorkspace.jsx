/**
 * src/pages/EvidenceManifestWorkspace.jsx
 * Local Evidence Dossier Integrity Verification (#947).
 *
 * Two local-only jobs:
 *  1. Build a manifest of evidence files (metadata + SHA-256 digests), saving
 *     it on this device and exporting it as JSON.
 *  2. Re-check a set of files against an exported manifest later and report
 *     changed, missing, unchanged and newly added files.
 *
 * No upload happens at any point: file bytes are read only to compute the
 * digest, and only metadata leaves the File object.
 */

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { FileCheck2, Info, ShieldCheck, ShieldAlert } from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader.jsx';
import AccessibleModal from '../components/common/AccessibleModal.jsx';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';
import {
  DEFAULT_MANIFEST_TITLE,
  INTEGRITY_DISCLAIMER,
  MAX_FILES_PER_MANIFEST,
  MAX_MANIFEST_JSON_BYTES,
  MAX_MANIFEST_TITLE_LENGTH,
  formatBytes,
  sanitizeDescription,
  validateEvidenceFile,
} from '../data/evidenceManifestContract.js';
import {
  buildManifest,
  createManifestEntries,
  findDuplicateEntries,
  manifestFileName,
  parseManifest,
  serializeManifest,
  verificationToCsv,
  verifyManifestAgainstFiles,
} from '../services/evidenceManifestService.js';
import {
  clearSavedManifest,
  loadSavedManifest,
  saveLastCheck,
  saveManifest,
} from '../services/evidenceManifestStorage.js';
import EvidenceManifestBuilder from '../components/evidence/EvidenceManifestBuilder.jsx';
import EvidenceManifestVerifier from '../components/evidence/EvidenceManifestVerifier.jsx';
import { formatDateTime } from '../components/evidence/evidenceFormat.js';
import { EvidenceDisclaimers, EvidenceOfflineNotice } from '../components/evidence/EvidenceStates.jsx';
import '../components/evidence/evidence.css';

const downloadText = (text, filename, mimeType) => {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
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

export default function EvidenceManifestWorkspace() {
  const { isOnline } = useNetwork();
  const { toast } = useToast();
  const baseId = useId();
  const importInputRef = useRef(null);

  const [tab, setTab] = useState('build');

  // Manifest state, hydrated from local storage so a check is possible later.
  const [manifest, setManifest] = useState(() => loadSavedManifest());
  const [manifestSource, setManifestSource] = useState(() => (loadSavedManifest() ? 'saved on this device' : null));
  const [title, setTitle] = useState(() => loadSavedManifest()?.title || DEFAULT_MANIFEST_TITLE);
  const [entries, setEntries] = useState(() => loadSavedManifest()?.files || []);

  // Builder state
  const [hashing, setHashing] = useState(false);
  const [builderProgress, setBuilderProgress] = useState(null);
  const [fileErrors, setFileErrors] = useState([]);
  const [builderStatus, setBuilderStatus] = useState(null);
  const [storageWarning, setStorageWarning] = useState(null);

  // Verifier state
  const [verifying, setVerifying] = useState(false);
  const [verifierProgress, setVerifierProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [verificationErrors, setVerificationErrors] = useState([]);
  const [scanDuplicates, setScanDuplicates] = useState([]);
  const [verifyError, setVerifyError] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importNotice, setImportNotice] = useState(null);

  const duplicateGroups = useMemo(() => findDuplicateEntries(entries), [entries]);

  const resetVerification = useCallback(() => {
    setResults(null);
    setSummary(null);
    setVerificationErrors([]);
    setScanDuplicates([]);
    setVerifyError(null);
    setVerifierProgress(null);
  }, []);

  const applyManifest = useCallback(
    (nextManifest, source, { notice, duplicates = [] } = {}) => {
      setManifest(nextManifest);
      setManifestSource(source);
      setTitle(nextManifest.title);
      setEntries(nextManifest.files);
      setImportError(null);
      setFileErrors([]);
      setBuilderStatus(notice || null);
      setImportNotice(
        duplicates.length > 0
          ? 'The imported manifest itself contains duplicate files. Verification will still work, but review the dossier before sharing it.'
          : null
      );
      resetVerification();
    },
    [resetVerification]
  );

  const handleFilesChosen = useCallback(
    async (files) => {
      setFileErrors([]);
      setBuilderStatus(null);

      const room = MAX_FILES_PER_MANIFEST - entries.length;
      const accepted = [];
      const rejected = [];

      files.forEach((file) => {
        const check = validateEvidenceFile(file);
        if (!check.valid) {
          rejected.push({ fileName: file?.name || 'Unknown file', error: check.error });
        } else if (accepted.length >= room) {
          rejected.push({
            fileName: file?.name || 'Unknown file',
            error: `A manifest can hold at most ${MAX_FILES_PER_MANIFEST} files. Remove a file before adding this one.`,
          });
        } else {
          accepted.push(file);
        }
      });

      if (rejected.length > 0) setFileErrors(rejected);
      if (accepted.length === 0) return;

      setHashing(true);
      setBuilderProgress({ processed: 0, total: accepted.length, fileName: accepted[0].name });

      try {
        const { entries: created, errors } = await createManifestEntries(accepted, {
          onProgress: setBuilderProgress,
        });

        // Skip files that are already recorded with the same digest and name.
        const fresh = created.filter(
          (entry) =>
            !entries.some((existing) => existing.fileName === entry.fileName && existing.digest === entry.digest)
        );
        const repeats = created.length - fresh.length;

        if (errors.length > 0) setFileErrors((current) => [...current, ...errors]);

        if (fresh.length > 0) {
          const nextEntries = [...entries, ...fresh];
          setEntries(nextEntries);
          setBuilderStatus(
            `${fresh.length} file${fresh.length === 1 ? '' : 's'} hashed and added.${
              repeats > 0 ? ` ${repeats} file${repeats === 1 ? ' was' : 's were'} already in the manifest.` : ''
            }`
          );
          toast.success(
            `${fresh.length} file${fresh.length === 1 ? '' : 's'} added to the manifest.`,
            'Evidence manifest'
          );
        } else if (errors.length === 0) {
          setBuilderStatus('Every file you chose is already in the manifest with the same digest.');
        }
      } catch (error) {
        setFileErrors((current) => [
          ...current,
          { fileName: accepted[0]?.name || 'File', error: error.message },
        ]);
      } finally {
        setHashing(false);
        setBuilderProgress(null);
      }
    },
    [entries, toast]
  );

  const handleDescriptionChange = useCallback((entryId, value) => {
    const clean = sanitizeDescription(value);
    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, description: clean } : entry))
    );
    setBuilderStatus(null);
  }, []);

  const handleRemoveEntry = useCallback((entryId) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setBuilderStatus('File removed from the manifest. The file on your device is untouched.');
    setStorageWarning(null);
  }, []);

  const handleClear = useCallback(() => {
    setEntries([]);
    setTitle(DEFAULT_MANIFEST_TITLE);
    setFileErrors([]);
    setBuilderStatus('Manifest cleared from this page.');
    setStorageWarning(null);
    clearSavedManifest();
    setManifest(null);
    setManifestSource(null);
    resetVerification();
  }, [resetVerification]);

  const buildCurrentManifest = useCallback(() => {
    if (entries.length === 0) {
      throw new Error('Add at least one evidence file before building the manifest.');
    }
    return buildManifest({
      title,
      entries,
      createdAt: manifest?.createdAt && manifest.files?.length === entries.length ? manifest.createdAt : undefined,
    });
  }, [entries, manifest, title]);

  const handleSaveLocal = useCallback(() => {
    try {
      const next = buildCurrentManifest();
      const outcome = saveManifest(next);
      setManifest(next);
      setManifestSource('saved on this device');
      setBuilderStatus(
        outcome.ok
          ? 'Manifest saved on this device. It will be here next time you open this page.'
          : null
      );
      setStorageWarning(outcome.ok ? null : outcome.error);
      if (outcome.ok) {
        toast.success('Manifest saved on this device.', 'Evidence manifest');
      } else {
        toast.error(outcome.error, 'Could not save the manifest');
      }
    } catch (error) {
      setStorageWarning(error.message);
      toast.error(error.message, 'Could not save the manifest');
    }
  }, [buildCurrentManifest, toast]);

  const handleExport = useCallback(() => {
    try {
      const next = buildCurrentManifest();
      const fileName = manifestFileName(next);
      const done = downloadText(serializeManifest(next), fileName, 'application/json;charset=utf-8');

      if (!done) {
        setStorageWarning('This browser blocked the download. Copy the manifest from the preview below instead.');
        return;
      }

      setManifest(next);
      setBuilderStatus(`Manifest exported as ${fileName}. Keep this file somewhere you trust.`);
      toast.success('Manifest exported. Keep the JSON file with your dossier.', 'Evidence manifest');
    } catch (error) {
      setStorageWarning(error.message);
      toast.error(error.message, 'Could not export the manifest');
    }
  }, [buildCurrentManifest, toast]);

  const triggerImport = useCallback(() => {
    setImportError(null);
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setImportError(null);
      setImportNotice(null);

      if (file.size > MAX_MANIFEST_JSON_BYTES) {
        setImportError(
          `That file is ${formatBytes(file.size)}. A manifest is much smaller than ${formatBytes(MAX_MANIFEST_JSON_BYTES)}, so this is probably not a manifest.`
        );
        return;
      }

      if (!String(file.name || '').toLowerCase().endsWith('.json')) {
        setImportError('Choose the .json manifest file you exported from this page.');
        return;
      }

      try {
        const text = await file.text();
        const parsed = parseManifest(text);

        if (!parsed.ok) {
          setImportError(parsed.error);
          return;
        }

        applyManifest(parsed.manifest, `imported from ${file.name}`, {
          notice: `Imported ${parsed.manifest.files.length} file${
            parsed.manifest.files.length === 1 ? '' : 's'
          } from ${file.name}.`,
          duplicates: parsed.duplicateGroups || [],
        });
        toast.success('Manifest imported. You can now check your evidence files.', 'Evidence manifest');
      } catch {
        setImportError('The manifest could not be read. Try exporting it again.');
      }
    },
    [applyManifest, toast]
  );

  const handleForgetManifest = useCallback(() => {
    clearSavedManifest();
    setManifest(null);
    setManifestSource(null);
    setEntries([]);
    setTitle(DEFAULT_MANIFEST_TITLE);
    setBuilderStatus(null);
    resetVerification();
    toast.info('Manifest removed from this device. Your evidence files were not touched.', 'Evidence manifest');
  }, [resetVerification, toast]);

  const handleVerifyFiles = useCallback(
    async (files) => {
      if (!manifest) return;

      resetVerification();
      setVerifying(true);
      setVerifierProgress({ processed: 0, total: files.length, fileName: files[0]?.name || '' });

      try {
        const outcome = await verifyManifestAgainstFiles(manifest, files, { onProgress: setVerifierProgress });

        setResults(outcome.results);
        setSummary(outcome.summary);
        setVerificationErrors(outcome.errors);
        setScanDuplicates(outcome.duplicates);

        saveLastCheck(outcome.summary);

        if (outcome.summary.isIntact) {
          toast.success('Every file still matches the manifest.', 'Verification complete');
        } else {
          toast.warning(
            `${outcome.summary.changed} changed, ${outcome.summary.missing} missing, ${outcome.summary.extra} not in the manifest.`,
            'Verification finished with differences'
          );
        }
      } catch (error) {
        setVerifyError(error.message);
        toast.error(error.message, 'Verification could not finish');
      } finally {
        setVerifying(false);
        setVerifierProgress(null);
      }
    },
    [manifest, resetVerification, toast]
  );

  const handleExportResults = useCallback(() => {
    if (!results) return;
    const csv = verificationToCsv(results, manifest?.title);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const done = downloadText(csv, `evidence-verification-${stamp}.csv`, 'text/csv;charset=utf-8');
    if (done) {
      toast.success('Verification result exported as CSV.', 'Evidence manifest');
    } else {
      toast.error('This browser blocked the download.', 'Export failed');
    }
  }, [manifest, results, toast]);

  const handleDownloadManifest = useCallback(() => {
    if (!manifest) return;
    const done = downloadText(serializeManifest(manifest), manifestFileName(manifest), 'application/json;charset=utf-8');
    if (!done) toast.error('This browser blocked the download.', 'Export failed');
  }, [manifest, toast]);

  const tabButton = (id, label, Icon) => (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      className="ev-tab"
      aria-selected={tab === id}
      aria-controls={`${baseId}-panel-${id}`}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </button>
  );

  const lastCheck = manifest?.createdAt ? formatDateTime(manifest.createdAt) : null;

  return (
    <div className="section animate-fade-in ev-page">
      <div className="container ev-shell" style={{ maxWidth: '1150px' }}>
        <StandardPageHeader
          eyebrow="Evidence & Documentation"
          eyebrowIcon={<FileCheck2 size={16} />}
          title="Local Evidence Dossier Integrity Verification"
          subtitle="Collect the evidence for a complaint in one place, record a SHA-256 digest for every file, and check later whether any file changed, went missing or was duplicated — all on your own device, without uploading anything."
          align="left"
          maxWidth="58rem"
        />

        <EvidenceOfflineNotice isOnline={isOnline} />

        <div className="ev-banner ev-banner--info" role="note">
          <ShieldAlert size={18} aria-hidden="true" />
          <div className="ev-banner__body">
            <strong>Your files stay on your device</strong>
            <p>
              Files are read in this browser only to compute a digest. No file is uploaded, and no file contents
              are stored. Only a manifest of names, sizes, formats, timestamps and digests is saved — and only if
              you ask for it.
            </p>
          </div>
        </div>

        <div className="ev-tabs" role="tablist" aria-label="Evidence manifest sections">
          {tabButton('build', 'Build manifest', FileCheck2)}
          {tabButton('verify', 'Verify files', ShieldCheck)}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-build`}
          aria-labelledby={`${baseId}-tab-build`}
          hidden={tab !== 'build'}
        >
          {tab === 'build' && (
            <EvidenceManifestBuilder
              manifest={manifest}
              title={title}
              onTitleChange={(value) => setTitle(value.slice(0, MAX_MANIFEST_TITLE_LENGTH))}
              entries={entries}
              onFilesChosen={handleFilesChosen}
              onDescriptionChange={handleDescriptionChange}
              onRemoveEntry={handleRemoveEntry}
              onExport={handleExport}
              onSaveLocal={handleSaveLocal}
              onClear={handleClear}
              onImportClick={triggerImport}
              importing={false}
              hashing={hashing}
              progress={builderProgress}
              fileErrors={fileErrors}
              onDismissFileErrors={() => setFileErrors([])}
              duplicateGroups={duplicateGroups}
              statusMessage={builderStatus}
              storageWarning={storageWarning}
            />
          )}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-verify`}
          aria-labelledby={`${baseId}-tab-verify`}
          hidden={tab !== 'verify'}
        >
          {tab === 'verify' && (
            <EvidenceManifestVerifier
              manifest={manifest}
              manifestSource={manifestSource}
              results={results}
              summary={summary}
              verificationErrors={verificationErrors}
              scanDuplicates={scanDuplicates}
              onImportManifestClick={triggerImport}
              onClearManifest={handleForgetManifest}
              onVerifyFiles={handleVerifyFiles}
              onExportResults={handleExportResults}
              onDownloadManifest={handleDownloadManifest}
              verifying={verifying}
              progress={verifierProgress}
              error={verifyError}
              onRetry={() => setVerifyError(null)}
              onResetResults={resetVerification}
            />
          )}
        </div>

        {lastCheck && entries.length > 0 && (
          <p className="ev-meta">
            <Info size={13} aria-hidden="true" /> Manifest created {lastCheck}.{' '}
            {manifestSource ? `Source: ${manifestSource}.` : ''}
          </p>
        )}

        <EvidenceDisclaimers />

        <p className="ev-panel__text" style={{ fontSize: '0.8rem' }}>
          {INTEGRITY_DISCLAIMER}
        </p>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="ev-visually-hidden"
          aria-label="Import an evidence manifest JSON file"
          tabIndex={-1}
        />

        <AccessibleModal
          isOpen={Boolean(importError) || Boolean(importNotice)}
          onClose={() => {
            setImportError(null);
            setImportNotice(null);
          }}
          title={importError ? 'That manifest could not be used' : 'Manifest loaded'}
          subtitle={importError ? 'Nothing was changed on this page.' : 'You can now check your evidence files.'}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={`ev-banner ${importError ? 'ev-banner--error' : 'ev-banner--ok'}`} role="alert">
              <Info size={18} aria-hidden="true" />
              <div className="ev-banner__body">
                <strong>{importError ? 'Manifest problem' : 'Manifest imported'}</strong>
                <p>{importError || importNotice}</p>
              </div>
            </div>
            <div className="ev-actions">
              <button
                type="button"
                className="ev-btn"
                onClick={() => {
                  setImportError(null);
                  setImportNotice(null);
                  if (!importError) setTab('verify');
                }}
              >
                {importError ? 'Choose another file' : 'Go to verification'}
              </button>
              <button
                type="button"
                className="ev-btn ev-btn--ghost"
                onClick={() => {
                  setImportError(null);
                  setImportNotice(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </AccessibleModal>
      </div>
    </div>
  );
}
