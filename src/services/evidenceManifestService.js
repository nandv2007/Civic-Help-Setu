/**
 * src/services/evidenceManifestService.js
 * Local evidence manifest builder and verifier (#947).
 *
 * A manifest stores, for each evidence file in a dossier:
 *   - the file name, size and reported format,
 *   - a SHA-256 digest of the bytes,
 *   - when the file was added and an optional citizen description.
 *
 * The file contents never leave the browser: bytes are read only to compute
 * the digest, and only metadata + digest are kept. The exported manifest JSON
 * can be re-imported later to check whether the same files are unchanged,
 * changed, missing or newly added.
 */

import {
  EVIDENCE_SCHEMA_VERSION,
  HASH_ALGORITHM,
  MANIFEST_KIND,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_MANIFEST,
  MAX_MANIFEST_JSON_BYTES,
  DIGEST_PATTERN,
  VERIFICATION_STATUS,
  sanitizeDescription,
  sanitizeManifestTitle,
  validateEvidenceFile,
  getFileExtension,
} from '../data/evidenceManifestContract.js';

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

const toBytes = (input) => {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return null;
};

/**
 * Computes a lowercase hex SHA-256 digest of a string, byte array or Blob.
 * Throws a clear error when the Web Crypto API is unavailable so the UI can
 * show an error state instead of a wrong digest.
 */
export async function computeSha256Hex(input) {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error(
      'Secure hashing is not available in this browser (Web Crypto API missing). Open this page over HTTPS or in a modern browser to compute SHA-256 digests.'
    );
  }

  const bytes = toBytes(input);
  const buffer = bytes ?? (await input.arrayBuffer());
  const digest = await subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest), (byte) => HEX[byte]).join('');
}

/**
 * Reads one picked file: validates it, hashes the bytes and returns the
 * manifest entry. The File object itself is not stored anywhere.
 */
export async function createManifestEntry(file, { description = '', now = () => new Date() } = {}) {
  const check = validateEvidenceFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File is larger than the allowed size.');
  }

  const digest = await computeSha256Hex(file);

  return {
    id: `entry-${digest.slice(0, 12)}-${String(file.size)}`,
    fileName: String(file.name),
    sizeBytes: Number(file.size),
    mimeType: (file.type || '').split(';')[0].trim().toLowerCase(),
    extension: getFileExtension(file.name),
    digest,
    addedAt: now().toISOString(),
    description: sanitizeDescription(description),
  };
}

/**
 * Builds entries for a list of files, reporting progress per file and
 * collecting per-file errors instead of failing the whole batch.
 *
 * @returns {Promise<{ entries: object[], errors: {fileName: string, error: string}[] }>}
 */
export async function createManifestEntries(files, { descriptions = {}, onProgress } = {}) {
  const list = Array.from(files || []);
  const entries = [];
  const errors = [];

  for (let index = 0; index < list.length; index += 1) {
    const file = list[index];
    onProgress?.({ processed: index, total: list.length, fileName: file?.name || '' });

    try {
      entries.push(await createManifestEntry(file, { description: descriptions[file.name] || '' }));
    } catch (error) {
      errors.push({ fileName: file?.name || 'Unknown file', error: error.message });
    }
  }

  onProgress?.({ processed: list.length, total: list.length, fileName: '' });

  return { entries, errors };
}

/**
 * Groups entries that share a digest (byte-identical files) or the same name.
 * Returns a list of duplicate groups so the UI can warn before sharing.
 */
export function findDuplicateEntries(entries = []) {
  const byDigest = new Map();
  const byName = new Map();

  entries.forEach((entry) => {
    if (!byDigest.has(entry.digest)) byDigest.set(entry.digest, []);
    byDigest.get(entry.digest).push(entry);

    const nameKey = String(entry.fileName || '').toLowerCase();
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(entry);
  });

  const groups = [];

  byDigest.forEach((group) => {
    if (group.length > 1) {
      groups.push({
        reason: 'identical-content',
        message: 'These files have identical bytes (same SHA-256 digest).',
        entries: group,
      });
    }
  });

  byName.forEach((group) => {
    if (group.length > 1 && !groups.some((g) => g.reason === 'identical-content' && g.entries[0].digest === group[0].digest)) {
      groups.push({
        reason: 'same-name',
        message: 'More than one file uses this name. Rename them so the dossier is unambiguous.',
        entries: group,
      });
    }
  });

  return groups;
}

/** Stable JSON: sorted keys per entry, so two identical manifests serialise the same way. */
const sortKeys = (object) =>
  Object.keys(object)
    .sort()
    .reduce((acc, key) => {
      acc[key] = object[key];
      return acc;
    }, {});

/**
 * Creates the manifest object. Entries are kept in the order the citizen
 * added them, which makes the exported file easy to read.
 */
export function buildManifest({ title, entries = [], createdAt } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Add at least one evidence file before building a manifest.');
  }
  if (entries.length > MAX_FILES_PER_MANIFEST) {
    throw new Error(`A manifest can hold at most ${MAX_FILES_PER_MANIFEST} files.`);
  }

  return {
    kind: MANIFEST_KIND,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    title: sanitizeManifestTitle(title),
    createdAt: createdAt || new Date().toISOString(),
    fileCount: entries.length,
    files: entries.map((entry) =>
      sortKeys({
        id: entry.id,
        fileName: entry.fileName,
        sizeBytes: entry.sizeBytes,
        mimeType: entry.mimeType,
        extension: entry.extension,
        digest: entry.digest,
        addedAt: entry.addedAt,
        description: entry.description || '',
      })
    ),
  };
}

/** Pretty-printed manifest JSON, ready to download. */
export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Default export file name, derived from the manifest title. */
export function manifestFileName(manifest) {
  const base = sanitizeManifestTitle(manifest?.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const stamp = String(manifest?.createdAt || new Date().toISOString()).slice(0, 10);
  return `evidence-manifest-${base || 'dossier'}-${stamp}.json`;
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseIsoDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/**
 * Parses and validates an imported manifest.
 * Never throws: malformed input comes back as { ok: false, error }.
 */
export function parseManifest(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: 'The manifest file is empty.' };
  }

  if (new TextEncoder().encode(text).length > MAX_MANIFEST_JSON_BYTES) {
    return {
      ok: false,
      error: 'This manifest file is too large to be a manifest produced by Civic Help Setu.',
    };
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON. Choose the .json manifest you exported.' };
  }

  if (!isPlainObject(raw)) {
    return { ok: false, error: 'A manifest must be a JSON object.' };
  }

  if (raw.kind !== MANIFEST_KIND) {
    return {
      ok: false,
      error: 'This is not a Civic Help Setu evidence manifest. Check that you picked the exported manifest file.',
    };
  }

  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    return { ok: false, error: 'The manifest has no files listed in it.' };
  }

  if (raw.files.length > MAX_FILES_PER_MANIFEST) {
    return {
      ok: false,
      error: `The manifest lists ${raw.files.length} files; the supported maximum is ${MAX_FILES_PER_MANIFEST}.`,
    };
  }

  const majorVersion = String(raw.schemaVersion || '').split('.')[0];
  const supportedMajor = EVIDENCE_SCHEMA_VERSION.split('.')[0];
  if (!raw.schemaVersion) {
    return { ok: false, error: 'The manifest is missing its schema version.' };
  }
  if (majorVersion !== supportedMajor) {
    return {
      ok: false,
      error: `This manifest uses schema version ${raw.schemaVersion}, which this page cannot read. Export a new manifest to upgrade.`,
    };
  }

  if (raw.hashAlgorithm && raw.hashAlgorithm !== HASH_ALGORITHM) {
    return {
      ok: false,
      error: `Unsupported hash algorithm "${raw.hashAlgorithm}". Only ${HASH_ALGORITHM} manifests are supported.`,
    };
  }

  const files = [];
  const problems = [];

  raw.files.forEach((file, index) => {
    const position = `File ${index + 1}`;

    if (!isPlainObject(file)) {
      problems.push(`${position} is not an object.`);
      return;
    }

    const fileName = typeof file.fileName === 'string' ? file.fileName.trim() : '';
    if (!fileName) {
      problems.push(`${position} has no file name.`);
      return;
    }

    const digest = typeof file.digest === 'string' ? file.digest.trim().toLowerCase() : '';
    if (!DIGEST_PATTERN.test(digest)) {
      problems.push(`${position} ("${fileName}") has a digest that is not 64 hexadecimal characters.`);
      return;
    }

    const sizeBytes = Number(file.sizeBytes);
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      problems.push(`${position} ("${fileName}") has an invalid size.`);
      return;
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      problems.push(
        `${position} ("${fileName}") is recorded as larger than the supported file size limit.`
      );
      return;
    }

    const addedAt = parseIsoDate(file.addedAt);
    if (!addedAt) {
      problems.push(`${position} ("${fileName}") has an invalid "added" timestamp.`);
      return;
    }

    files.push({
      id: typeof file.id === 'string' && file.id ? file.id : `entry-imported-${index}`,
      fileName,
      sizeBytes,
      mimeType: typeof file.mimeType === 'string' ? file.mimeType : '',
      extension: typeof file.extension === 'string' ? file.extension : getFileExtension(fileName),
      digest,
      addedAt,
      description: sanitizeDescription(file.description || ''),
    });
  });

  if (problems.length > 0) {
    return {
      ok: false,
      error: problems[0],
      problems,
    };
  }

  const duplicates = findDuplicateEntries(files);

  return {
    ok: true,
    manifest: {
      kind: raw.kind,
      schemaVersion: raw.schemaVersion,
      hashAlgorithm: raw.hashAlgorithm || HASH_ALGORITHM,
      title: sanitizeManifestTitle(raw.title),
      createdAt: parseIsoDate(raw.createdAt) || files[0].addedAt,
      fileCount: files.length,
      files,
    },
    duplicateGroups: duplicates,
  };
}

/**
 * Compares hashed files against manifest entries. Pure function so the
 * comparison rules can be tested without touching the DOM.
 *
 * @param {object[]} manifestFiles entries from a parsed manifest
 * @param {{fileName: string, sizeBytes: number, digest: string}[]} scannedFiles hashed files
 */
export function compareManifestToFiles(manifestFiles = [], scannedFiles = []) {
  const remaining = [...scannedFiles];
  const results = [];

  manifestFiles.forEach((expected) => {
    const matchIndex = remaining.findIndex(
      (file) => file.fileName === expected.fileName && file.digest === expected.digest
    );

    if (matchIndex !== -1) {
      const [match] = remaining.splice(matchIndex, 1);
      results.push({
        status: VERIFICATION_STATUS.VERIFIED,
        manifestEntry: expected,
        actual: match,
        expectedDigest: expected.digest,
        actualDigest: match.digest,
      });
      return;
    }

    // Same name, different bytes: the file was changed after the manifest.
    const nameIndex = remaining.findIndex((file) => file.fileName === expected.fileName);

    if (nameIndex !== -1) {
      const [changed] = remaining.splice(nameIndex, 1);
      results.push({
        status: VERIFICATION_STATUS.CHANGED,
        manifestEntry: expected,
        actual: changed,
        expectedDigest: expected.digest,
        actualDigest: changed.digest,
        sizeDelta: changed.sizeBytes - expected.sizeBytes,
      });
      return;
    }

    results.push({
      status: VERIFICATION_STATUS.MISSING,
      manifestEntry: expected,
      actual: null,
      expectedDigest: expected.digest,
      actualDigest: '',
    });
  });

  remaining.forEach((file) => {
    results.push({
      status: VERIFICATION_STATUS.EXTRA,
      manifestEntry: null,
      actual: file,
      expectedDigest: '',
      actualDigest: file.digest,
    });
  });

  return results;
}

/** Counts per status, used for the summary and the progress announcement. */
export function summarizeVerification(results = []) {
  const counts = {
    total: results.length,
    verified: 0,
    changed: 0,
    missing: 0,
    extra: 0,
  };

  results.forEach((result) => {
    if (Object.prototype.hasOwnProperty.call(counts, result.status)) {
      counts[result.status] += 1;
    }
  });

  counts.isIntact = counts.changed === 0 && counts.missing === 0;

  return counts;
}

/**
 * Hashes the selected files and compares them with the manifest.
 * Progress is reported so the UI can show how far it has got.
 */
export async function verifyManifestAgainstFiles(manifest, files, { onProgress } = {}) {
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error('Import a manifest before verifying files.');
  }

  const list = Array.from(files || []);
  if (list.length === 0) {
    throw new Error('Choose the evidence files to check against the manifest.');
  }

  const scanned = [];
  const errors = [];

  for (let index = 0; index < list.length; index += 1) {
    const file = list[index];
    onProgress?.({ processed: index, total: list.length, fileName: file?.name || '' });

    const check = validateEvidenceFile(file);
    if (!check.valid) {
      errors.push({ fileName: file?.name || 'Unknown file', error: check.error });
      continue;
    }

    try {
      scanned.push({
        fileName: String(file.name),
        sizeBytes: Number(file.size),
        digest: await computeSha256Hex(file),
      });
    } catch (error) {
      errors.push({ fileName: file.name, error: error.message });
    }
  }

  onProgress?.({ processed: list.length, total: list.length, fileName: '' });

  const results = compareManifestToFiles(manifest.files, scanned);

  return {
    results,
    summary: summarizeVerification(results),
    duplicates: findDuplicateEntries(scanned.map((file, index) => ({ ...file, id: `scan-${index}` }))),
    errors,
  };
}

/** Small CSV export of a verification run, handy for attaching to a complaint. */
export function verificationToCsv(results = [], manifestTitle = '') {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Manifest', manifestTitle || 'Evidence dossier'],
    ['File name', 'Status', 'Expected SHA-256', 'Actual SHA-256', 'Expected size (bytes)', 'Actual size (bytes)'],
  ];

  results.forEach((result) => {
    rows.push([
      result.manifestEntry?.fileName || result.actual?.fileName || '',
      result.status,
      result.expectedDigest,
      result.actualDigest,
      result.manifestEntry?.sizeBytes ?? '',
      result.actual?.sizeBytes ?? '',
    ]);
  });

  return `${rows.map((row) => row.map(escape).join(',')).join('\n')}\n`;
}
