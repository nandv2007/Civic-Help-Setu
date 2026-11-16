/**
 * Land Acquisition Fair Compensation & Claim Storage Service
 *
 * Client-side offline-first persistence for land acquisition claims with
 * automated PII sanitization, canonical SHA-256 digital seals, and
 * tampering detection under RFCTLARR Act 2013 (#876).
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import { draftLarraReferencePetition } from './landAcquisitionService.js';

export const STORAGE_KEY = 'civicbridge_larr_claims';

function getStorage(storage) {
  if (storage && typeof storage.getItem === 'function') {
    return storage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Computes canonical SHA-256 digest over land acquisition claim record.
 *
 * @param {Object} claim
 * @returns {string} 64-character lowercase hex digest
 */
export const computeClaimDigest = (claim) => {
  if (!claim || typeof claim !== 'object') {
    return '0'.repeat(64);
  }

  const canonicalPayload = {
    version: 1,
    claimant: {
      name: String(claim.claimant?.name || ''),
      address: String(claim.claimant?.address || ''),
      contact: String(claim.claimant?.contact || ''),
    },
    landDetails: {
      surveyNo: String(claim.landDetails?.surveyNo || ''),
      village: String(claim.landDetails?.village || ''),
      taluk: String(claim.landDetails?.taluk || ''),
      district: String(claim.landDetails?.district || ''),
    },
    project: {
      projectName: String(claim.project?.projectName || ''),
      acquiringBody: String(claim.project?.acquiringBody || ''),
      awardNo: String(claim.project?.awardNo || ''),
    },
    landArea: Number(claim.landArea || 0),
    areaUnit: String(claim.areaUnit || 'ACRES'),
    circleRatePerUnit: Number(claim.circleRatePerUnit || 0),
    averageSaleRatePerUnit: Number(claim.averageSaleRatePerUnit || 0),
    consortiumAgreedRatePerUnit: Number(claim.consortiumAgreedRatePerUnit || 0),
    locationType: String(claim.locationType || 'RURAL_NEAR'),
    customMultiplier: Number(claim.customMultiplier || 0),
    valueAttachedAssetsInr: Number(claim.valueAttachedAssetsInr || 0),
    notificationDate: String(claim.notificationDate || ''),
    awardDate: String(claim.awardDate || ''),
    collectorOfferedTotalInr: Number(claim.collectorOfferedTotalInr || 0),
  };

  return sha256Hex(canonicalStringify(canonicalPayload));
};

/**
 * Masks sensitive personal identifiers for external sharing and exports
 * in accordance with DPDP Act principles.
 *
 * @param {Object} claim
 * @returns {Object} Sanitized claim object
 */
export function minimizeForExternal(claim) {
  if (!claim || typeof claim !== 'object') {
    return {};
  }

  const maskPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `XXXXXX${digits.slice(-4)}`;
    }
    return 'REDACTED';
  };

  const maskSurveyNo = (survey) => {
    if (!survey || typeof survey !== 'string') return '';
    return '[Masked Survey / Khasra No.]';
  };

  return {
    ...claim,
    claimant: {
      ...claim.claimant,
      name: claim.claimant?.name
        ? `${claim.claimant.name.slice(0, 1)}*** (Masked)`
        : '[Masked Landholder]',
      contact: maskPhone(claim.claimant?.contact),
    },
    landDetails: {
      ...claim.landDetails,
      surveyNo: maskSurveyNo(claim.landDetails?.surveyNo),
    },
    isRedacted: true,
  };
}

/**
 * Verifies SHA-256 integrity seal of a claim record.
 *
 * @param {Object} claim
 * @returns {boolean} True if digital seal matches exactly
 */
export function verifyClaimIntegrity(claim) {
  if (!claim || typeof claim.digest !== 'string') {
    return false;
  }
  const expectedDigest = computeClaimDigest(claim);
  return constantTimeEqual(claim.digest, expectedDigest);
}

/**
 * Lists all stored land acquisition claims.
 *
 * @param {Storage} [storageEngine]
 * @returns {Array} List of claims
 */
export function listLarrClaims(storageEngine) {
  const store = getStorage(storageEngine);
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves a single claim by ID.
 *
 * @param {string} id
 * @param {Storage} [storageEngine]
 * @returns {Object|null}
 */
export function getLarrClaim(id, storageEngine) {
  if (!id) return null;
  const list = listLarrClaims(storageEngine);
  return list.find((c) => c.id === id) || null;
}

/**
 * Saves or updates a land acquisition claim in client-side storage.
 *
 * @param {Object} claimData
 * @param {Storage} [storageEngine]
 * @returns {Object} Saved claim with ID, timestamp, and digest
 */
export function saveLarrClaim(claimData = {}, storageEngine) {
  const store = getStorage(storageEngine);
  if (!store) {
    throw new Error('Local storage is unavailable in this environment.');
  }

  const existingList = listLarrClaims(storageEngine);
  const now = new Date().toISOString();
  const id = claimData.id || `larr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const claimToSave = {
    ...claimData,
    id,
    updatedAt: now,
    createdAt: claimData.createdAt || now,
  };

  claimToSave.digest = computeClaimDigest(claimToSave);

  const existingIndex = existingList.findIndex((c) => c.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...existingList];
    updatedList[existingIndex] = claimToSave;
  } else {
    updatedList = [claimToSave, ...existingList];
  }

  store.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  return claimToSave;
}

/**
 * Deletes a stored claim by ID.
 *
 * @param {string} id
 * @param {Storage} [storageEngine]
 * @returns {boolean} True if deleted
 */
export function deleteLarrClaim(id, storageEngine) {
  if (!id) return false;
  const store = getStorage(storageEngine);
  if (!store) return false;

  const existingList = listLarrClaims(storageEngine);
  const filtered = existingList.filter((c) => c.id !== id);
  if (filtered.length === existingList.length) {
    return false;
  }

  store.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Exports claim as a signed JSON dossier.
 */
export function exportLarrDossierJson(claim, { redact = false } = {}) {
  const target = redact ? minimizeForExternal(claim) : claim;
  return JSON.stringify(target, null, 2);
}

/**
 * Exports claim as a plain text legal reference memorandum.
 */
export function exportLarrTextSlip(claim) {
  return draftLarraReferencePetition(claim);
}
