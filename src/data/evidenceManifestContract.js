/**
 * src/data/evidenceManifestContract.js
 * Schema, limits and wording for Local Evidence Dossier Integrity
 * Verification (#947).
 *
 * Everything here is deliberately local-first: a manifest records file
 * metadata and a SHA-256 digest of the bytes, never the bytes themselves.
 * The manifest is a citizen-owned JSON file that can be exported and later
 * used to check whether the evidence files in a dossier changed, went
 * missing, or were duplicated.
 */

export const EVIDENCE_SCHEMA_VERSION = '1.0.0';
export const MANIFEST_KIND = 'civic-help-setu.evidence-manifest';
export const HASH_ALGORITHM = 'SHA-256';

/** Hard limits, surfaced in the UI before a file is even read. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_FILES_PER_MANIFEST = 25;
export const MAX_MANIFEST_JSON_BYTES = 512 * 1024; // 512 KB manifest file
export const MAX_FILE_NAME_LENGTH = 160;
export const MAX_DESCRIPTION_LENGTH = 200;
export const MAX_MANIFEST_TITLE_LENGTH = 120;

export const ALLOWED_FILE_TYPES = Object.freeze({
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'text/plain': ['txt'],
});

export const ALLOWED_FILE_EXTENSIONS = Object.freeze(
  Object.values(ALLOWED_FILE_TYPES).flat()
);

export const ALLOWED_TYPES_HINT =
  'PDF, JPG, PNG, WEBP or TXT files, up to 10 MB each, 25 files per manifest.';

/** A SHA-256 digest written as 64 lowercase hex characters. */
export const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'verified',
  CHANGED: 'changed',
  MISSING: 'missing',
  EXTRA: 'extra',
});

export const VERIFICATION_STATUS_LABELS = Object.freeze({
  verified: 'Unchanged',
  changed: 'Changed',
  missing: 'Missing',
  extra: 'Not in manifest',
});

export const VERIFICATION_STATUS_DESCRIPTIONS = Object.freeze({
  verified: 'The SHA-256 digest matches the manifest exactly.',
  changed:
    'The file has the same name but a different digest, so its bytes changed after the manifest was made.',
  missing:
    'The manifest lists this file, but it was not included in the files you selected.',
  extra:
    'This file was selected but the manifest does not list it, so it was probably added later.',
});

/**
 * Honest wording: a hash is an integrity check, not a proof of authenticity
 * or of when a file was captured.
 */
export const INTEGRITY_DISCLAIMER =
  'A matching SHA-256 digest shows that the file bytes are identical to the ones recorded in the manifest. It does not prove who issued the document, that the document is genuine or legally valid, or when the photo or scan was actually taken. Timestamps in a manifest come from this browser and can be edited, so they are a record of when you added the file, not independent proof of capture time.';

export const LOCAL_ONLY_NOTICE =
  'Files are read in this browser only. Nothing is uploaded, and no file contents are saved — the manifest stores file names, sizes, formats, timestamps and SHA-256 digests.';

export const MANIFEST_TAMPER_NOTE =
  'A manifest can be edited by hand. If someone changes both a file and its digest in the manifest, the check will still pass, so keep a copy of the exported manifest somewhere you trust.';

export const DEFAULT_MANIFEST_TITLE = 'Evidence dossier';

/** Human readable file size used in limit messages and tables. */
export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.max(0, Math.round(bytes))} B`;
};

export const getFileExtension = (name = '') => {
  const idx = String(name).lastIndexOf('.');
  return idx === -1 ? '' : String(name).slice(idx + 1).toLowerCase();
};

/**
 * Checks a picked file against the documented size and format limits.
 * Returns { valid, error } so the UI can show a per-file message.
 */
export const validateEvidenceFile = (file) => {
  if (!file) return { valid: false, error: 'Choose a file first.' };

  const name = String(file.name || '');
  const size = Number(file.size || 0);

  if (!name) return { valid: false, error: 'This file has no name.' };
  if (name.length > MAX_FILE_NAME_LENGTH) {
    return {
      valid: false,
      error: `File name is longer than ${MAX_FILE_NAME_LENGTH} characters.`,
    };
  }
  if (!size) {
    return { valid: false, error: 'This file is empty, so there is nothing to hash.' };
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is ${formatBytes(size)}. The limit is ${formatBytes(MAX_FILE_SIZE_BYTES)} per file.`,
    };
  }

  const mime = String(file.type || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const extension = getFileExtension(name);
  const extensionsForType = ALLOWED_FILE_TYPES[mime];

  if (extensionsForType && extensionsForType.includes(extension)) {
    return { valid: true, error: '' };
  }

  // Some browsers and file managers report an empty or generic type, so the
  // extension alone is accepted when the type is not specific.
  if ((!mime || mime === 'application/octet-stream') && ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return { valid: true, error: '' };
  }

  if (!extensionsForType) {
    return {
      valid: false,
      error: `Unsupported format. Use ${ALLOWED_TYPES_HINT}`,
    };
  }

  return {
    valid: false,
    error: 'The file extension does not match its reported format.',
  };
};

/** Strips markup/control characters from a user-provided description. */
export const sanitizeDescription = (value, maxLength = MAX_DESCRIPTION_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

export const sanitizeManifestTitle = (value) => {
  const cleaned = sanitizeDescription(value, MAX_MANIFEST_TITLE_LENGTH);
  return cleaned || DEFAULT_MANIFEST_TITLE;
};
