import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeSha256Hex,
  createManifestEntry,
  createManifestEntries,
  buildManifest,
  serializeManifest,
  manifestFileName,
  parseManifest,
  compareManifestToFiles,
  summarizeVerification,
  findDuplicateEntries,
  verificationToCsv,
  verifyManifestAgainstFiles,
  resolveManifestCreatedAt,
} from './evidenceManifestService.js';
import {
  loadSavedManifest,
  saveManifest,
  clearSavedManifest,
  saveLastCheck,
  loadLastCheck,
  EVIDENCE_MANIFEST_STORAGE_KEY,
} from './evidenceManifestStorage.js';
import {
  EVIDENCE_SCHEMA_VERSION,
  HASH_ALGORITHM,
  MANIFEST_KIND,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_MANIFEST,
  MAX_MANIFEST_JSON_BYTES,
  VERIFICATION_STATUS,
  formatBytes,
  validateEvidenceFile,
  sanitizeDescription,
} from '../data/evidenceManifestContract.js';

/** Minimal File stand-in: the services only need name, size, type and bytes. */
const makeFile = (name, content, type = 'application/pdf') => {
  const bytes = new TextEncoder().encode(content);
  return {
    name,
    type,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
};

const fakeFile = (name, size, type) => ({ name, size, type, arrayBuffer: async () => new ArrayBuffer(0) });

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

const makeEntry = (overrides = {}) => ({
  id: `entry-${overrides.fileName || 'file'}`,
  fileName: 'statement.pdf',
  sizeBytes: 128,
  mimeType: 'application/pdf',
  extension: 'pdf',
  digest: DIGEST_A,
  addedAt: '2026-11-01T09:00:00.000Z',
  description: '',
  ...overrides,
});

const validManifestObject = (files = [makeEntry()]) => ({
  kind: MANIFEST_KIND,
  schemaVersion: EVIDENCE_SCHEMA_VERSION,
  hashAlgorithm: HASH_ALGORITHM,
  title: 'Ward 42 complaint',
  createdAt: '2026-11-01T09:05:00.000Z',
  files,
});

describe('evidence manifest contract limits (#947)', () => {
  it('formats byte sizes for the limit messages', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(formatBytes(-1)).toBe('');
  });

  it('accepts the documented formats and rejects other ones', () => {
    expect(validateEvidenceFile(fakeFile('scan.pdf', 1024, 'application/pdf')).valid).toBe(true);
    expect(validateEvidenceFile(fakeFile('photo.JPG', 1024, 'image/jpeg')).valid).toBe(true);
    expect(validateEvidenceFile(fakeFile('shot.png', 1024, 'image/png')).valid).toBe(true);
    expect(validateEvidenceFile(fakeFile('notes.txt', 1024, 'text/plain')).valid).toBe(true);

    const zip = validateEvidenceFile(fakeFile('archive.zip', 1024, 'application/zip'));
    expect(zip.valid).toBe(false);
    expect(zip.error).toContain('Unsupported format');
  });

  it('rejects empty files, oversized files and mismatched extensions', () => {
    expect(validateEvidenceFile(fakeFile('empty.pdf', 0, 'application/pdf')).error).toContain('empty');

    const big = validateEvidenceFile(fakeFile('huge.pdf', MAX_FILE_SIZE_BYTES + 1, 'application/pdf'));
    expect(big.valid).toBe(false);
    expect(big.error).toContain('limit is 10.0 MB');

    const mismatch = validateEvidenceFile(fakeFile('photo.pdf', 1024, 'image/png'));
    expect(mismatch.valid).toBe(false);
    expect(mismatch.error).toContain('does not match');
  });

  it('accepts a known extension when the browser reports no usable MIME type', () => {
    expect(validateEvidenceFile(fakeFile('scan.pdf', 10, '')).valid).toBe(true);
    expect(validateEvidenceFile(fakeFile('scan.pdf', 10, 'application/octet-stream')).valid).toBe(true);
  });

  it('strips markup and control characters from descriptions', () => {
    expect(sanitizeDescription('  <b>Photo</b>\n of the   pole  ')).toBe('Photo of the pole');
    expect(sanitizeDescription('x'.repeat(500))).toHaveLength(200);
    expect(sanitizeDescription(null)).toBe('');
  });
});

describe('computeSha256Hex (#947)', () => {
  it('matches the known SHA-256 digest of a string', async () => {
    // echo -n "abc" | sha256sum
    await expect(computeSha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('hashes byte arrays and blobs identically to the equivalent string', async () => {
    const text = 'evidence dossier';
    const bytes = new TextEncoder().encode(text);
    const blob = new Blob([bytes]);

    const fromString = await computeSha256Hex(text);
    const fromBytes = await computeSha256Hex(bytes);
    const fromBlob = await computeSha256Hex(blob);

    expect(fromBytes).toBe(fromString);
    expect(fromBlob).toBe(fromString);
    expect(fromString).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reports a clear error when Web Crypto is unavailable', async () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', {});
    try {
      await expect(computeSha256Hex('abc')).rejects.toThrow(/Secure hashing is not available/);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });
});

describe('createManifestEntry / createManifestEntries (#947)', () => {
  it('records metadata and a digest but never the file contents', async () => {
    const file = makeFile('statement.pdf', 'hello evidence');
    const entry = await createManifestEntry(file, { description: 'Signed statement' });

    expect(entry.fileName).toBe('statement.pdf');
    expect(entry.sizeBytes).toBe(file.size);
    expect(entry.mimeType).toBe('application/pdf');
    expect(entry.extension).toBe('pdf');
    expect(entry.digest).toBe(await computeSha256Hex('hello evidence'));
    expect(entry.description).toBe('Signed statement');
    expect(JSON.stringify(entry)).not.toContain('hello evidence');
  });

  it('gives identical bytes under different names distinct ids (React keys)', async () => {
    const first = await createManifestEntry(makeFile('statement.pdf', 'same bytes'));
    const second = await createManifestEntry(makeFile('statement-copy.pdf', 'same bytes'));

    expect(first.digest).toBe(second.digest);
    expect(first.id).not.toBe(second.id);
    expect(first.id).toContain('statement-pdf');
  });

  it('refuses a file that breaks the limits', async () => {
    await expect(createManifestEntry(fakeFile('virus.exe', 10, 'application/x-msdownload'))).rejects.toThrow(
      /Unsupported format/
    );
  });

  it('collects per-file errors and still returns the files that worked', async () => {
    const good = makeFile('photo.png', 'pixels', 'image/png');
    const bad = fakeFile('notes.zip', 10, 'application/zip');
    const progress = [];

    const outcome = await createManifestEntries([good, bad], {
      onProgress: (state) => progress.push(state.processed),
    });

    expect(outcome.entries).toHaveLength(1);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0].fileName).toBe('notes.zip');
    expect(progress.at(-1)).toBe(2);
  });
});

describe('findDuplicateEntries (#947)', () => {
  it('flags byte-identical files and repeated names', () => {
    const groups = findDuplicateEntries([
      makeEntry({ id: 'a', fileName: 'p1.pdf', digest: DIGEST_A }),
      makeEntry({ id: 'b', fileName: 'p1-copy.pdf', digest: DIGEST_A }),
      makeEntry({ id: 'c', fileName: 'receipt.pdf', digest: DIGEST_B }),
      makeEntry({ id: 'd', fileName: 'receipt.pdf', digest: 'c'.repeat(64) }),
    ]);

    expect(groups.some((group) => group.reason === 'identical-content')).toBe(true);
    expect(groups.some((group) => group.reason === 'same-name')).toBe(true);
  });

  it('returns nothing for distinct files', () => {
    expect(
      findDuplicateEntries([
        makeEntry({ id: 'a', fileName: 'one.pdf', digest: DIGEST_A }),
        makeEntry({ id: 'b', fileName: 'two.pdf', digest: DIGEST_B }),
      ])
    ).toEqual([]);
  });
});

describe('buildManifest and export (#947)', () => {
  it('builds a manifest with schema metadata and no file contents', () => {
    const manifest = buildManifest({ title: 'Ward 42 complaint', entries: [makeEntry()] });

    expect(manifest.kind).toBe(MANIFEST_KIND);
    expect(manifest.schemaVersion).toBe(EVIDENCE_SCHEMA_VERSION);
    expect(manifest.hashAlgorithm).toBe(HASH_ALGORITHM);
    expect(manifest.fileCount).toBe(1);
    expect(manifest.title).toBe('Ward 42 complaint');
    expect(Object.keys(manifest.files[0]).sort()).toEqual([
      'addedAt',
      'description',
      'digest',
      'extension',
      'fileName',
      'id',
      'mimeType',
      'sizeBytes',
    ]);
  });

  it('falls back to a default title and blocks empty or oversized manifests', () => {
    expect(buildManifest({ title: '   ', entries: [makeEntry()] }).title).toBe('Evidence dossier');
    expect(() => buildManifest({ title: 'x', entries: [] })).toThrow(/at least one/);

    const tooMany = Array.from({ length: MAX_FILES_PER_MANIFEST + 1 }, (_, index) =>
      makeEntry({ id: `e-${index}`, fileName: `file-${index}.pdf`, digest: index.toString(16).padStart(64, '0').slice(-64) })
    );
    expect(() => buildManifest({ title: 'x', entries: tooMany })).toThrow(/at most 25/);
  });

  it('serialises to readable JSON that parses back to the same data', () => {
    const manifest = buildManifest({ title: 'Evidence', entries: [makeEntry()] });
    const text = serializeManifest(manifest);
    const parsed = parseManifest(text);

    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "kind"');
    expect(parsed.ok).toBe(true);
    expect(parsed.manifest.files[0].digest).toBe(manifest.files[0].digest);
  });

  it('derives a safe export file name', () => {
    const name = manifestFileName({
      title: 'Streetlight / Ward 42: photos!',
      createdAt: '2026-11-18T10:00:00.000Z',
    });
    expect(name).toBe('evidence-manifest-streetlight-ward-42-photos-2026-11-18.json');
  });
});

describe('resolveManifestCreatedAt (#947)', () => {
  const previous = buildManifest({
    title: 'Old name',
    entries: [makeEntry({ id: 'a', fileName: 'one.pdf' }), makeEntry({ id: 'b', fileName: 'two.pdf', digest: DIGEST_B })],
    createdAt: '2026-11-01T09:00:00.000Z',
  });

  it('keeps the original stamp when only the title changes', () => {
    expect(resolveManifestCreatedAt(previous.files, previous)).toBe('2026-11-01T09:00:00.000Z');
  });

  it('starts a new stamp when files are added, removed or re-hashed', () => {
    expect(resolveManifestCreatedAt(previous.files.slice(0, 1), previous)).toBeUndefined();
    expect(
      resolveManifestCreatedAt([...previous.files, makeEntry({ id: 'c', fileName: 'three.pdf' })], previous)
    ).toBeUndefined();
    expect(
      resolveManifestCreatedAt([{ ...previous.files[0], digest: 'f'.repeat(64) }, previous.files[1]], previous)
    ).toBeUndefined();
  });

  it('falls back to now when there is no earlier manifest', () => {
    expect(resolveManifestCreatedAt([makeEntry()], null)).toBeUndefined();
    expect(resolveManifestCreatedAt([makeEntry()], { files: [] })).toBeUndefined();
  });
});

describe('parseManifest rejects malformed manifests (#947)', () => {
  const cases = [
    { label: 'empty text', input: '', match: /empty/ },
    { label: 'non-JSON', input: '{not json', match: /not valid JSON/ },
    { label: 'JSON array', input: '[]', match: /must be a JSON object/ },
    {
      label: 'a different JSON file',
      input: JSON.stringify({ hello: 'world' }),
      match: /not a Civic Help Setu evidence manifest/,
    },
    {
      label: 'no files',
      input: JSON.stringify({ ...validManifestObject(), files: [] }),
      match: /no files listed/,
    },
    {
      label: 'missing schema version',
      input: JSON.stringify({ ...validManifestObject(), schemaVersion: undefined }),
      match: /schema version/,
    },
    {
      label: 'future major version',
      input: JSON.stringify({ ...validManifestObject(), schemaVersion: '9.0.0' }),
      match: /cannot read/,
    },
    {
      label: 'unsupported algorithm',
      input: JSON.stringify({ ...validManifestObject(), hashAlgorithm: 'MD5' }),
      match: /Unsupported hash algorithm/,
    },
  ];

  cases.forEach(({ label, input, match }) => {
    it(`rejects ${label}`, () => {
      const outcome = parseManifest(input);
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toMatch(match);
    });
  });

  it('rejects a file entry with a bad digest', () => {
    const outcome = parseManifest(
      JSON.stringify(validManifestObject([makeEntry({ digest: 'not-a-hash' })]))
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/64 hexadecimal/);
  });

  it('rejects a file entry with an impossible timestamp or size', () => {
    const badTime = parseManifest(
      JSON.stringify(validManifestObject([makeEntry({ addedAt: 'yesterday-ish' })]))
    );
    expect(badTime.ok).toBe(false);
    expect(badTime.error).toMatch(/timestamp/);

    const badSize = parseManifest(
      JSON.stringify(validManifestObject([makeEntry({ sizeBytes: -5 })]))
    );
    expect(badSize.ok).toBe(false);
    expect(badSize.error).toMatch(/invalid size/);

    const huge = parseManifest(
      JSON.stringify(validManifestObject([makeEntry({ sizeBytes: MAX_FILE_SIZE_BYTES + 1 })]))
    );
    expect(huge.ok).toBe(false);
    expect(huge.error).toMatch(/larger than the supported file size/);
  });

  it('rejects an absurdly large manifest file before parsing it', () => {
    const padded = JSON.stringify({
      ...validManifestObject(),
      padding: 'x'.repeat(MAX_MANIFEST_JSON_BYTES),
    });
    const outcome = parseManifest(padded);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/too large/);
  });

  it('accepts a manifest exported by this app and reports its own duplicates', () => {
    const outcome = parseManifest(
      JSON.stringify(
        validManifestObject([
          makeEntry({ id: 'a', fileName: 'p1.pdf' }),
          makeEntry({ id: 'b', fileName: 'p1-copy.pdf' }),
        ])
      )
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.manifest.files).toHaveLength(2);
    expect(outcome.duplicateGroups[0].reason).toBe('identical-content');
  });
});

describe('compareManifestToFiles (#947)', () => {
  const manifestFiles = [
    makeEntry({ id: 'a', fileName: 'statement.pdf', digest: DIGEST_A, sizeBytes: 100 }),
    makeEntry({ id: 'b', fileName: 'photo.jpg', digest: DIGEST_B, sizeBytes: 200, mimeType: 'image/jpeg' }),
    makeEntry({ id: 'c', fileName: 'receipt.png', digest: 'c'.repeat(64), sizeBytes: 300 }),
  ];

  it('marks exact name + digest matches as unchanged', () => {
    const results = compareManifestToFiles(manifestFiles, [
      { fileName: 'statement.pdf', digest: DIGEST_A, sizeBytes: 100 },
      { fileName: 'photo.jpg', digest: DIGEST_B, sizeBytes: 200 },
      { fileName: 'receipt.png', digest: 'c'.repeat(64), sizeBytes: 300 },
    ]);

    expect(results.every((result) => result.status === VERIFICATION_STATUS.VERIFIED)).toBe(true);
    expect(summarizeVerification(results)).toMatchObject({
      total: 3,
      verified: 3,
      changed: 0,
      missing: 0,
      extra: 0,
      isIntact: true,
    });
  });

  it('detects a tampered file as changed with the size difference', () => {
    const results = compareManifestToFiles([manifestFiles[0]], [
      { fileName: 'statement.pdf', digest: 'f'.repeat(64), sizeBytes: 140 },
    ]);

    expect(results[0].status).toBe(VERIFICATION_STATUS.CHANGED);
    expect(results[0].expectedDigest).toBe(DIGEST_A);
    expect(results[0].actualDigest).toBe('f'.repeat(64));
    expect(results[0].sizeDelta).toBe(40);
    expect(summarizeVerification(results).isIntact).toBe(false);
  });

  it('detects missing files and files that were added later', () => {
    const results = compareManifestToFiles(manifestFiles, [
      { fileName: 'statement.pdf', digest: DIGEST_A, sizeBytes: 100 },
      { fileName: 'bonus.jpg', digest: '9'.repeat(64), sizeBytes: 10, mimeType: 'image/jpeg' },
    ]);

    const byStatus = summarizeVerification(results);
    expect(byStatus.verified).toBe(1);
    expect(byStatus.missing).toBe(2);
    expect(byStatus.extra).toBe(1);
    expect(byStatus.isIntact).toBe(false);

    const missingNames = results
      .filter((result) => result.status === VERIFICATION_STATUS.MISSING)
      .map((result) => result.manifestEntry.fileName);
    expect(missingNames).toEqual(['photo.jpg', 'receipt.png']);
  });

  it('treats a renamed but unchanged file as missing + extra', () => {
    const results = compareManifestToFiles([manifestFiles[0]], [
      { fileName: 'statement-renamed.pdf', digest: DIGEST_A, sizeBytes: 100 },
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      VERIFICATION_STATUS.EXTRA,
      VERIFICATION_STATUS.MISSING,
    ]);
  });

  it('handles an empty comparison without throwing', () => {
    expect(summarizeVerification(compareManifestToFiles([], []))).toMatchObject({ total: 0, isIntact: true });
  });
});

describe('verifyManifestAgainstFiles (#947)', () => {
  it('hashes a whole selection, compares it and reports progress', async () => {
    const statement = makeFile('statement.pdf', 'signed statement');
    const photo = makeFile('photo.png', 'image bytes', 'image/png');

    const built = buildManifest({
      title: 'Dossier',
      entries: [await createManifestEntry(statement), await createManifestEntry(photo)],
    });

    const progress = [];
    const outcome = await verifyManifestAgainstFiles(built, [statement, photo], {
      onProgress: (state) => progress.push(state.processed),
    });

    expect(outcome.summary).toMatchObject({ total: 2, verified: 2, changed: 0, missing: 0, extra: 0, isIntact: true });
    expect(outcome.errors).toEqual([]);
    expect(progress.at(-1)).toBe(2);
  });

  it('skips files that fail validation and keeps counting the rest', async () => {
    const statement = makeFile('statement.pdf', 'signed statement');
    const built = buildManifest({ title: 'Dossier', entries: [await createManifestEntry(statement)] });

    const outcome = await verifyManifestAgainstFiles(built, [
      fakeFile('payload.exe', 10, 'application/x-msdownload'),
      makeFile('statement.pdf', 'signed statement'),
    ]);

    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0].fileName).toBe('payload.exe');
    expect(outcome.summary.verified).toBe(1);
  });

  it('refuses to run without a manifest or without files', async () => {
    await expect(verifyManifestAgainstFiles(null, [])).rejects.toThrow(/Import a manifest/);
    await expect(verifyManifestAgainstFiles({ files: [] }, [])).rejects.toThrow(/Choose the evidence files/);
  });
});

describe('verificationToCsv (#947)', () => {
  it('writes a header and one row per file with escaped values', () => {
    const csv = verificationToCsv(
      [
        {
          status: VERIFICATION_STATUS.CHANGED,
          manifestEntry: { fileName: 'a "quoted" name.pdf', sizeBytes: 10 },
          actual: { fileName: 'a "quoted" name.pdf', sizeBytes: 12 },
          expectedDigest: DIGEST_A,
          actualDigest: DIGEST_B,
        },
      ],
      'Ward 42'
    );

    expect(csv).toContain('"File name","Status"');
    expect(csv).toContain('"a ""quoted"" name.pdf"');
    expect(csv).toContain('"changed"');
    expect(csv.trim().split('\n')).toHaveLength(3);
  });
});

describe('evidence manifest local storage (#947)', () => {
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

  it('saves and reloads a manifest', () => {
    const manifest = buildManifest({ title: 'Evidence', entries: [makeEntry()] });
    expect(saveManifest(manifest)).toMatchObject({ ok: true, persisted: true });

    const loaded = loadSavedManifest();
    expect(loaded.title).toBe('Evidence');
    expect(loaded.files[0].digest).toBe(DIGEST_A);
    expect(loaded.savedAt).toBeTruthy();
  });

  it('drops a corrupt or outdated saved manifest instead of crashing', () => {
    store.set(EVIDENCE_MANIFEST_STORAGE_KEY, '{"schemaVersion":"0.0.1","files":[]}');
    expect(loadSavedManifest()).toBeNull();
    expect(store.has(EVIDENCE_MANIFEST_STORAGE_KEY)).toBe(false);

    store.set(EVIDENCE_MANIFEST_STORAGE_KEY, 'not json');
    expect(loadSavedManifest()).toBeNull();
  });

  it('reports a storage failure without losing the manifest in memory', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
    });

    const manifest = buildManifest({ title: 'Evidence', entries: [makeEntry()] });
    const outcome = saveManifest(manifest);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/could not store the manifest/);
  });

  it('remembers the last check summary', () => {
    saveLastCheck({ total: 2, verified: 1, changed: 1, missing: 0, extra: 0, isIntact: false });
    const last = loadLastCheck();
    expect(last.changed).toBe(1);
    expect(last.checkedAt).toBeTruthy();
  });
});
