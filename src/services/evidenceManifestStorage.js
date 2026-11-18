/**
 * src/services/evidenceManifestStorage.js
 * Local persistence for the evidence manifest (#947).
 *
 * Only the manifest (metadata + SHA-256 digests) is stored. File contents are
 * never written to storage. Storage is a convenience: the exported JSON file
 * is the portable copy, and importing it restores the manifest on any device.
 */

import { EVIDENCE_SCHEMA_VERSION, MAX_MANIFEST_JSON_BYTES } from '../data/evidenceManifestContract.js';

export const EVIDENCE_MANIFEST_STORAGE_KEY = 'civicbridge_evidence_manifest_v1';

let memoryStore = null;

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Loads the saved manifest, or null when there is none.
 * Corrupt or oversized entries are dropped instead of breaking the page.
 */
export function loadSavedManifest() {
  const storage = getStorage();

  if (!storage) return memoryStore ? JSON.parse(JSON.stringify(memoryStore)) : null;

  try {
    const raw = storage.getItem(EVIDENCE_MANIFEST_STORAGE_KEY);
    if (!raw) return null;
    if (raw.length > MAX_MANIFEST_JSON_BYTES) {
      storage.removeItem(EVIDENCE_MANIFEST_STORAGE_KEY);
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== EVIDENCE_SCHEMA_VERSION || !Array.isArray(parsed.files)) {
      storage.removeItem(EVIDENCE_MANIFEST_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Saves the manifest locally. Returns { ok, error } so the UI can warn when
 * storage is full or blocked (private browsing, quota exceeded).
 */
export function saveManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.files)) {
    return { ok: false, error: 'There is no manifest to save.' };
  }

  const storage = getStorage();
  const payload = { ...manifest, savedAt: new Date().toISOString() };

  if (!storage) {
    memoryStore = JSON.parse(JSON.stringify(payload));
    return { ok: true, error: '', persisted: false };
  }

  try {
    storage.setItem(EVIDENCE_MANIFEST_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, error: '', persisted: true };
  } catch {
    memoryStore = JSON.parse(JSON.stringify(payload));
    return {
      ok: false,
      error:
        'This browser could not store the manifest (storage may be full or blocked). Export the manifest file to keep it.',
      persisted: false,
    };
  }
}

export function clearSavedManifest() {
  memoryStore = null;
  const storage = getStorage();
  if (!storage) return true;
  try {
    storage.removeItem(EVIDENCE_MANIFEST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Most recent verification summary, so a citizen can see the last check. */
export const EVIDENCE_LAST_CHECK_KEY = 'civicbridge_evidence_last_check_v1';

export function saveLastCheck(summary) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      EVIDENCE_LAST_CHECK_KEY,
      JSON.stringify({ ...summary, checkedAt: new Date().toISOString() })
    );
  } catch {
    // A missing last-check record is not worth interrupting the user for.
  }
}

export function loadLastCheck() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(EVIDENCE_LAST_CHECK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
