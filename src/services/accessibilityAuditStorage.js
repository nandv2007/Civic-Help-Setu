/**
 * src/services/accessibilityAuditStorage.js
 * Persistence for measured accessibility audits and remediation plans (#948).
 *
 * Shape: one record per office, holding an append-only list of assessments.
 * Re-assessments are never overwritten — each one keeps the measurements, the
 * findings and the benchmark version it was judged against, which is what makes
 * "did it get better after we complained" answerable later.
 *
 * Storage is local to the browser. Nothing is uploaded and no personal details
 * are collected, so a record can be shared as a report without redaction.
 */

import { AUDIT_SCHEMA_VERSION, MAX_AUDITS_PER_OFFICE } from '../data/accessibilityAuditStandards.js';

export const ACCESSIBILITY_AUDIT_STORAGE_KEY = 'civicbridge_accessibility_audits_v1';

let memoryStore = null;

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const today = () => new Date().toISOString();

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Reads the whole store as { [officeId]: { officeId, officeName, assessments: [] } }.
 * A corrupt or outdated store is dropped rather than crashing the page.
 */
export function loadAuditStore() {
  const storage = getStorage();

  if (!storage) return memoryStore ? clone(memoryStore) : {};

  try {
    const raw = storage.getItem(ACCESSIBILITY_AUDIT_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return {};

    if (parsed.schemaVersion !== AUDIT_SCHEMA_VERSION) {
      // Older/unknown shape: keep nothing, but do not delete the raw value here —
      // the caller decides whether to migrate or reset.
      return {};
    }

    return isPlainObject(parsed.offices) ? parsed.offices : {};
  } catch {
    return {};
  }
}

function writeStore(offices) {
  const payload = { schemaVersion: AUDIT_SCHEMA_VERSION, savedAt: today(), offices };
  const storage = getStorage();

  if (!storage) {
    memoryStore = clone(payload.offices);
    return { ok: true, persisted: false, error: '' };
  }

  try {
    storage.setItem(ACCESSIBILITY_AUDIT_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, persisted: true, error: '' };
  } catch {
    memoryStore = clone(payload.offices);
    return {
      ok: false,
      persisted: false,
      error:
        'This browser could not save the audit (storage may be full or blocked). Export the report so the measurements are not lost.',
    };
  }
}

/** Assessments for one office, oldest first. */
export function listAssessments(officeId) {
  if (!officeId) return [];
  const store = loadAuditStore();
  const record = store[officeId];
  if (!record || !Array.isArray(record.assessments)) return [];
  return [...record.assessments].sort((a, b) => String(a.assessedAt).localeCompare(String(b.assessedAt)));
}

export function getAssessment(officeId, assessmentId) {
  return listAssessments(officeId).find((assessment) => assessment.id === assessmentId) || null;
}

/** The most recent assessment for an office, or null. */
export function getLatestAssessment(officeId) {
  const assessments = listAssessments(officeId);
  return assessments.length > 0 ? assessments[assessments.length - 1] : null;
}

export function listAuditedOffices() {
  const store = loadAuditStore();
  return Object.values(store)
    .filter((record) => Array.isArray(record.assessments) && record.assessments.length > 0)
    .map((record) => ({
      officeId: record.officeId,
      officeName: record.officeName,
      count: record.assessments.length,
      lastAssessedAt: record.assessments[record.assessments.length - 1]?.assessedAt || '',
    }));
}

/**
 * Appends a new assessment. Returns { ok, assessment, error }.
 * The caller is expected to pass a fully built assessment (see
 * accessibilityAuditService.buildAssessment).
 */
export function saveAssessment(assessment) {
  if (!isPlainObject(assessment) || !assessment.officeId || !assessment.id) {
    return { ok: false, assessment: null, error: 'This assessment is incomplete and was not saved.' };
  }

  const store = loadAuditStore();
  const existing = store[assessment.officeId] || {
    officeId: assessment.officeId,
    officeName: assessment.officeName || '',
    assessments: [],
  };

  const assessments = [...existing.assessments, assessment].slice(-MAX_AUDITS_PER_OFFICE);

  const nextStore = {
    ...store,
    [assessment.officeId]: {
      officeId: assessment.officeId,
      officeName: assessment.officeName || existing.officeName,
      assessments,
    },
  };

  const outcome = writeStore(nextStore);

  return {
    ok: outcome.ok,
    persisted: outcome.persisted,
    error: outcome.error,
    assessment,
    // Make the cap visible instead of silently dropping the oldest assessment.
    pruned: existing.assessments.length + 1 > MAX_AUDITS_PER_OFFICE,
  };
}

/**
 * Updates a remediation action inside one assessment.
 * Actions live with the assessment that raised them, so the history of what was
 * promised and when it was closed stays attached to the measurement.
 */
export function updateRemediationAction(officeId, assessmentId, actionId, patch = {}) {
  const store = loadAuditStore();
  const record = store[officeId];
  if (!record || !Array.isArray(record.assessments)) {
    return { ok: false, error: 'That audit could not be found on this device.' };
  }

  let found = false;
  const assessments = record.assessments.map((assessment) => {
    if (assessment.id !== assessmentId) return assessment;

    const actions = (assessment.remediationActions || []).map((action) => {
      if (action.id !== actionId) return action;
      found = true;
      return {
        ...action,
        ...patch,
        updatedAt: today(),
      };
    });

    return { ...assessment, remediationActions: actions };
  });

  if (!found) return { ok: false, error: 'That action could not be found.' };

  const outcome = writeStore({ ...store, [officeId]: { ...record, assessments } });
  return { ok: outcome.ok, error: outcome.error };
}

/** Deletes one assessment (used to remove a mistyped entry). */
export function deleteAssessment(officeId, assessmentId) {
  const store = loadAuditStore();
  const record = store[officeId];
  if (!record) return { ok: false, error: 'That audit could not be found on this device.' };

  const remaining = record.assessments.filter((assessment) => assessment.id !== assessmentId);
  const nextStore = { ...store };

  if (remaining.length === 0) delete nextStore[officeId];
  else nextStore[officeId] = { ...record, assessments: remaining };

  const outcome = writeStore(nextStore);
  return { ok: outcome.ok, error: outcome.error };
}

/** Removes all audits from this device. Returns the number of offices cleared. */
export function clearAllAudits() {
  const cleared = Object.keys(loadAuditStore()).length;
  const storage = getStorage();
  memoryStore = null;

  if (storage) {
    try {
      storage.removeItem(ACCESSIBILITY_AUDIT_STORAGE_KEY);
    } catch {
      return { ok: false, cleared: 0, error: 'This browser would not clear the saved audits.' };
    }
  }

  return { ok: true, cleared, error: '' };
}
