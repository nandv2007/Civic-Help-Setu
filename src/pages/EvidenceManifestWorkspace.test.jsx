import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import EvidenceManifestWorkspace from './EvidenceManifestWorkspace';
import EvidenceManifestBuilder from '../components/evidence/EvidenceManifestBuilder';
import EvidenceManifestVerifier from '../components/evidence/EvidenceManifestVerifier';
import {
  EvidenceDisclaimers,
  EvidenceEmptyState,
  EvidenceErrorState,
  EvidenceOfflineNotice,
  EvidenceProgress,
  EvidenceStatusBadge,
} from '../components/evidence/EvidenceStates';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import {
  EVIDENCE_SCHEMA_VERSION,
  HASH_ALGORITHM,
  MANIFEST_KIND,
  VERIFICATION_STATUS,
} from '../data/evidenceManifestContract';
import { buildManifest, compareManifestToFiles, summarizeVerification } from '../services/evidenceManifestService';
import { clearSavedManifest, saveManifest } from '../services/evidenceManifestStorage';
import { EVIDENCE_MANIFEST_STORAGE_KEY } from '../services/evidenceManifestStorage';

const entry = (overrides = {}) => ({
  id: 'entry-1',
  fileName: 'statement.pdf',
  sizeBytes: 2048,
  mimeType: 'application/pdf',
  extension: 'pdf',
  digest: 'a'.repeat(64),
  addedAt: '2026-11-01T09:00:00.000Z',
  description: 'Signed statement from the resident',
  ...overrides,
});

const renderWorkspace = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <NetworkProvider>
        <ToastProvider>
          <EvidenceManifestWorkspace />
        </ToastProvider>
      </NetworkProvider>
    </MemoryRouter>
  );

describe('EvidenceManifestWorkspace (#947)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSavedManifest();
  });

  it('renders the page heading, privacy notice and section tabs', () => {
    const html = renderWorkspace();

    expect(html).toContain('Local Evidence Dossier Integrity Verification');
    expect(html).toContain('Your files stay on your device');
    expect(html).toContain('No file is uploaded');
    expect(html).toContain('Build manifest');
    expect(html).toContain('Verify files');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
  });

  it('states the honesty limits: integrity is not authenticity or capture time', () => {
    const html = renderWorkspace();

    expect(html).toContain('What this check does — and does not — prove');
    expect(html).toContain('Integrity is not authenticity');
    expect(html).toContain('does not prove who issued the document');
    expect(html).toContain('when the photo or scan was actually taken');
    expect(html).toContain('A manifest can be edited by hand');
  });

  it('shows the empty builder state with limits and disabled export before any file is added', () => {
    const html = renderWorkspace();

    expect(html).toContain('No files in this manifest yet');
    expect(html).toContain('10 MB');
    expect(html).toContain('25 files');
    expect(html).toContain('disabled');
  });

  it('hydrates a saved manifest from this device', () => {
    const manifest = buildManifest({ title: 'Saved dossier', entries: [entry()] });
    store.set(EVIDENCE_MANIFEST_STORAGE_KEY, JSON.stringify(manifest));

    const html = renderWorkspace();

    // The builder table lists the saved file, and the value survives rerender.
    expect(html).toContain('Saved dossier');
    expect(html).toContain('statement.pdf');
    expect(html).toContain('Signed statement from the resident');
  });

  it('writes only manifest metadata to local storage, never file contents', () => {
    const saved = saveManifest(buildManifest({ title: 'Metadata only', entries: [entry()] }));
    expect(saved.ok).toBe(true);

    const raw = store.get(EVIDENCE_MANIFEST_STORAGE_KEY);
    const parsed = JSON.parse(raw);

    expect(parsed.files[0].digest).toBe('a'.repeat(64));
    expect(Object.keys(parsed.files[0])).not.toContain('content');
    expect(Object.keys(parsed.files[0])).not.toContain('bytes');
    expect(Object.keys(parsed.files[0])).not.toContain('dataUrl');
    expect(raw).not.toContain('data:application');
  });

  it('ignores a corrupt saved manifest instead of crashing', () => {
    store.set(EVIDENCE_MANIFEST_STORAGE_KEY, '{"schemaVersion":"0.0.1"}');
    const html = renderWorkspace();
    expect(html).toContain('No files in this manifest yet');
  });
});

describe('EvidenceManifestBuilder (#947)', () => {
  it('renders a manifest table with digest, size and description fields', () => {
    const html = renderToStaticMarkup(
      <EvidenceManifestBuilder
        title="Ward 42 dossier"
        entries={[entry(), entry({ id: 'entry-2', fileName: 'photo.jpg', mimeType: 'image/jpeg', description: '' })]}
        manifest={{ title: 'Ward 42 dossier', files: [entry()] }}
        onTitleChange={() => {}}
        onFilesChosen={() => {}}
        onDescriptionChange={() => {}}
        onRemoveEntry={() => {}}
        onExport={() => {}}
        onSaveLocal={() => {}}
        onClear={() => {}}
        onImportClick={() => {}}
      />
    );

    expect(html).toContain('Build an evidence manifest');
    expect(html).toContain('2 files recorded in this manifest');
    expect(html).toContain('a'.repeat(64));
    expect(html).toContain('2 KB');
    expect(html).toContain('Description for statement.pdf');
    expect(html).toContain('Export manifest (.json)');
    expect(html).toContain('Import manifest');
    expect(html).toContain('Clear manifest');
  });

  it('shows a progress state while hashing and lists rejected files', () => {
    const html = renderToStaticMarkup(
      <EvidenceManifestBuilder
        title="Dossier"
        entries={[]}
        hashing
        progress={{ processed: 1, total: 3, fileName: 'photo.png' }}
        fileErrors={[
          { fileName: 'archive.zip', error: 'Unsupported format. Use PDF, JPG, PNG, WEBP or TXT files.' },
        ]}
        onFilesChosen={() => {}}
        onDescriptionChange={() => {}}
        onRemoveEntry={() => {}}
        onTitleChange={() => {}}
        onExport={() => {}}
        onSaveLocal={() => {}}
        onClear={() => {}}
        onImportClick={() => {}}
      />
    );

    expect(html).toContain('Hashing files 2 of 3: photo.png');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('1 file could not be added');
    expect(html).toContain('archive.zip');
    expect(html).toContain('Unsupported format');
  });

  it('warns about duplicate files that share a digest', () => {
    const html = renderToStaticMarkup(
      <EvidenceManifestBuilder
        title="Dossier"
        entries={[entry(), entry({ id: 'entry-2', fileName: 'statement-copy.pdf' })]}
        duplicateGroups={[
          {
            reason: 'identical-content',
            message: 'These files have identical bytes (same SHA-256 digest).',
            entries: [entry(), entry({ id: 'entry-2', fileName: 'statement-copy.pdf' })],
          },
        ]}
        onFilesChosen={() => {}}
        onDescriptionChange={() => {}}
        onRemoveEntry={() => {}}
        onTitleChange={() => {}}
        onExport={() => {}}
        onSaveLocal={() => {}}
        onClear={() => {}}
        onImportClick={() => {}}
      />
    );

    expect(html).toContain('Possible duplicate files');
    expect(html).toContain('identical bytes');
    expect(html).toContain('statement-copy.pdf');
  });
});

describe('EvidenceManifestVerifier (#947)', () => {
  const manifest = {
    kind: MANIFEST_KIND,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    title: 'Ward 42 complaint',
    createdAt: '2026-11-01T09:05:00.000Z',
    fileCount: 3,
    files: [
      entry({ id: 'a', fileName: 'statement.pdf', digest: 'a'.repeat(64), sizeBytes: 2048 }),
      entry({ id: 'b', fileName: 'photo.jpg', digest: 'b'.repeat(64), sizeBytes: 1024, mimeType: 'image/jpeg' }),
      entry({ id: 'c', fileName: 'receipt.png', digest: 'c'.repeat(64), sizeBytes: 512 }),
    ],
  };

  it('renders the manifest summary and asks for files when no result exists yet', () => {
    const html = renderToStaticMarkup(
      <EvidenceManifestVerifier
        manifest={manifest}
        manifestSource="imported from evidence-manifest.json"
        onImportManifestClick={() => {}}
        onClearManifest={() => {}}
        onVerifyFiles={() => {}}
        onExportResults={() => {}}
        onDownloadManifest={() => {}}
      />
    );

    expect(html).toContain('Check files against a manifest');
    expect(html).toContain('Ward 42 complaint');
    expect(html).toContain('Files: <strong>3</strong>');
    expect(html).toContain('imported from evidence-manifest.json');
    expect(html).toContain('Evidence files to check');
    expect(html).toContain('reported as missing rather than as changed');
    expect(html).not.toContain('Verification result');
  });

  it('asks for a manifest when none is loaded', () => {
    const html = renderToStaticMarkup(
      <EvidenceManifestVerifier
        manifest={null}
        onImportManifestClick={() => {}}
        onClearManifest={() => {}}
        onVerifyFiles={() => {}}
        onExportResults={() => {}}
        onDownloadManifest={() => {}}
      />
    );

    expect(html).toContain('No manifest loaded');
    expect(html).toContain('Import manifest (.json)');
  });

  it('reports a tampered, missing and extra file in the result table', () => {
    const results = compareManifestToFiles(manifest.files, [
      { fileName: 'statement.pdf', digest: 'a'.repeat(64), sizeBytes: 2048 },
      { fileName: 'photo.jpg', digest: 'f'.repeat(64), sizeBytes: 4096, mimeType: 'image/jpeg' },
      { fileName: 'added-later.jpg', digest: '9'.repeat(64), sizeBytes: 100, mimeType: 'image/jpeg' },
    ]);
    const summary = summarizeVerification(results);

    const html = renderToStaticMarkup(
      <EvidenceManifestVerifier
        manifest={manifest}
        results={results}
        summary={summary}
        onImportManifestClick={() => {}}
        onClearManifest={() => {}}
        onVerifyFiles={() => {}}
        onExportResults={() => {}}
        onDownloadManifest={() => {}}
      />
    );

    expect(html).toContain('Verification result');
    expect(html).toContain('The dossier does not match the manifest');
    expect(html).toContain(
      '4 files checked against the manifest: 1 unchanged, 1 changed, 1 missing and 1 not listed in the manifest.'
    );
    expect(html).toContain('Changed');
    expect(html).toContain('Missing');
    expect(html).toContain('Not in manifest');
    expect(html).toContain('f'.repeat(64));
    expect(html).toContain('ev-digest--mismatch');
    expect(html).toContain('not found');
    expect(html).toContain('added-later.jpg');
    expect(html).toContain('Export result (.csv)');
  });

  it('celebrates an intact dossier without overclaiming authenticity', () => {
    const results = compareManifestToFiles(manifest.files, [
      { fileName: 'statement.pdf', digest: 'a'.repeat(64), sizeBytes: 2048 },
      { fileName: 'photo.jpg', digest: 'b'.repeat(64), sizeBytes: 1024 },
      { fileName: 'receipt.png', digest: 'c'.repeat(64), sizeBytes: 512 },
    ]);
    const summary = summarizeVerification(results);

    const html = renderToStaticMarkup(
      <EvidenceManifestVerifier
        manifest={manifest}
        results={results}
        summary={summary}
        onImportManifestClick={() => {}}
        onClearManifest={() => {}}
        onVerifyFiles={() => {}}
        onExportResults={() => {}}
        onDownloadManifest={() => {}}
      />
    );

    expect(html).toContain('No changes detected');
    expect(html).toContain('All 3 files were found and every digest matched the manifest.');
    expect(html).toContain('does not prove the documents themselves are authentic');
  });

  it('surfaces hashing failures and duplicate warnings during verification', () => {
    const html = renderToStaticMarkup(
      <EvidenceManifestVerifier
        manifest={manifest}
        verificationErrors={[{ fileName: 'huge.pdf', error: 'File is 12.0 MB. The limit is 10.0 MB per file.' }]}
        scanDuplicates={[
          {
            reason: 'identical-content',
            message: 'These files have identical bytes (same SHA-256 digest).',
            entries: [{ fileName: 'photo.jpg' }, { fileName: 'photo-copy.jpg' }],
          },
        ]}
        error="Verification was interrupted."
        onImportManifestClick={() => {}}
        onClearManifest={() => {}}
        onVerifyFiles={() => {}}
        onExportResults={() => {}}
        onDownloadManifest={() => {}}
        onRetry={() => {}}
      />
    );

    expect(html).toContain('Something went wrong');
    expect(html).toContain('Verification was interrupted.');
    expect(html).toContain('Try again');
    expect(html).toContain('1 file could not be checked');
    expect(html).toContain('huge.pdf');
    expect(html).toContain('not counted as unchanged');
    expect(html).toContain('Duplicate files in what you just selected');
  });
});

describe('Evidence helper components (#947)', () => {
  it('renders accessible progress with a live region', () => {
    const html = renderToStaticMarkup(
      <EvidenceProgress label="Hashing files" processed={2} total={4} fileName="b.pdf" />
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-valuetext="2 of 4 files processed"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Hashing files 3 of 4: b.pdf');
  });

  it('renders error, empty and offline states', () => {
    const errorHtml = renderToStaticMarkup(<EvidenceErrorState error="Hash failed" onRetry={() => {}} />);
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('Hash failed');
    expect(errorHtml).toContain('Try again');

    const emptyHtml = renderToStaticMarkup(
      <EvidenceEmptyState title="Nothing here" message="Add a file to begin." />
    );
    expect(emptyHtml).toContain('Nothing here');
    expect(emptyHtml).toContain('Add a file to begin.');

    expect(renderToStaticMarkup(<EvidenceOfflineNotice isOnline />)).toBe('');
    const offlineHtml = renderToStaticMarkup(<EvidenceOfflineNotice isOnline={false} />);
    expect(offlineHtml).toContain('You are offline.');
    expect(offlineHtml).toContain('still work');
  });

  it('labels every verification status with text, not colour alone', () => {
    [
      [VERIFICATION_STATUS.VERIFIED, 'Unchanged'],
      [VERIFICATION_STATUS.CHANGED, 'Changed'],
      [VERIFICATION_STATUS.MISSING, 'Missing'],
      [VERIFICATION_STATUS.EXTRA, 'Not in manifest'],
    ].forEach(([status, label]) => {
      expect(renderToStaticMarkup(<EvidenceStatusBadge status={status} />)).toContain(label);
    });
  });

  it('renders the full disclaimer panel by default and a short one when compact', () => {
    const html = renderToStaticMarkup(<EvidenceDisclaimers />);
    expect(html).toContain('Stays on your device');
    expect(html).toContain('Integrity is not authenticity');
    expect(html).toContain('Keep your own copy of the manifest');

    const compact = renderToStaticMarkup(<EvidenceDisclaimers compact />);
    expect(compact).not.toContain('Keep your own copy of the manifest');
  });

});
