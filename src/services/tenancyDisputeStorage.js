/**
 * @file tenancyDisputeStorage.js
 * @description Local-first persistence layer with SHA-256 integrity seal for tenancy disputes under
 * the Model Tenancy Act, 2021 (MTA 2021).
 */

export const TENANCY_CASES_STORAGE_KEY = 'civicbridge_tenancy_cases_v1';
export const TENANCY_SETTINGS_STORAGE_KEY = 'civicbridge_tenancy_settings_v1';

export const OFFICIAL_STATUS_DISCLAIMER =
  'CITIZEN TRACKER NOTICE: This tenancy dispute record and timeline reflect personal correspondence notes, payment receipts, and evidence logs. It is not an official government Rent Authority docket, and saving here does not automatically file proceedings or create binding judicial liability.';

let inMemoryStore = null;

function getStorage(customStorage) {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export const INITIAL_SAMPLE_CASES = [
  {
    id: 'case-ten-sample-01',
    title: 'Arbitrary Painting Deduction & Water Severance Dispute',
    premisesAddress: 'Flat 402, Greenfield Apartments, Sector 45, Gurgaon',
    jurisdiction: 'Gurgaon Sub-Division, Haryana',
    premisesType: 'residential',
    tenantName: 'Rahul Sharma',
    tenantContact: 'rahul.s@example.com',
    landlordName: 'Ramesh Gupta',
    landlordContact: 'ramesh.gupta.owner@example.com / +91-9876543210',
    monthlyRent: 20000,
    securityDepositPaid: 60000,
    vacationDate: '2026-01-15',
    status: 'NOTICE_ISSUED',
    officialStatusDisclaimer: OFFICIAL_STATUS_DISCLAIMER,
    deductions: [
      {
        id: 'ded-1',
        description: 'Repainting entire flat due to customary sun fading',
        amount: 15000,
        category: 'WEAR_AND_TEAR',
        hasInvoice: false,
      },
      {
        id: 'ded-2',
        description: 'Deep cleaning and pest control flat surcharge without contractor bills',
        amount: 5000,
        category: 'ARBITRARY_PENALTY',
        hasInvoice: false,
      },
      {
        id: 'ded-3',
        description: 'Replacement of broken ceramic basin in hallway',
        amount: 3500,
        category: 'STRUCTURAL_DAMAGE',
        hasInvoice: true,
      },
    ],
    severedServices: ['water', 'elevator'],
    disconnectionDate: '2026-01-10',
    createdAt: '2026-01-16T10:00:00.000Z',
    updatedAt: '2026-01-20T14:30:00.000Z',
  },
];

/**
 * Computes a deterministic SHA-256 seal for a tenancy dispute record.
 *
 * @param {Object} caseData
 * @returns {Promise<string>} Hex digest
 */
export async function computeTenancyCaseDigest(caseData) {
  if (!caseData || typeof caseData !== 'object') return '';

  const canonicalPayload = {
    id: caseData.id || '',
    premisesAddress: caseData.premisesAddress || '',
    monthlyRent: Number(caseData.monthlyRent) || 0,
    securityDepositPaid: Number(caseData.securityDepositPaid) || 0,
    vacationDate: caseData.vacationDate || '',
    deductionsCount: (caseData.deductions || []).length,
    severedServices: (caseData.severedServices || []).sort(),
    status: caseData.status || '',
  };

  const canonicalString = JSON.stringify(canonicalPayload);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure deterministic JS fallback hash
  let hash = 5381;
  for (let i = 0; i < canonicalString.length; i++) {
    hash = (hash << 5) + hash + canonicalString.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Verifies the integrity of a stored case record against its computed digest.
 *
 * @param {Object} caseData
 * @returns {Promise<{ valid: boolean, calculatedDigest: string, storedDigest: string }>}
 */
export async function verifyTenancyCaseIntegrity(caseData) {
  if (!caseData) return { valid: false, calculatedDigest: '', storedDigest: '' };
  const calculated = await computeTenancyCaseDigest(caseData);
  const stored = caseData.digest || '';
  return {
    valid: Boolean(stored && calculated === stored),
    calculatedDigest: calculated,
    storedDigest: stored,
  };
}

/**
 * Loads all tenancy cases from local storage.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function listTenancyCases(customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) {
    if (!inMemoryStore) {
      inMemoryStore = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CASES));
    }
    return inMemoryStore;
  }

  try {
    const raw = storage.getItem(TENANCY_CASES_STORAGE_KEY);
    if (!raw) {
      const cloned = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CASES));
      storage.setItem(TENANCY_CASES_STORAGE_KEY, JSON.stringify(cloned));
      return cloned;
    }
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_CASES));
  }
}

/**
 * Retrieves a single tenancy case by ID.
 *
 * @param {string} caseId
 * @param {Storage} [customStorage]
 * @returns {Object|null}
 */
export function getTenancyCaseById(caseId, customStorage) {
  const cases = listTenancyCases(customStorage);
  return cases.find((c) => c.id === caseId) || null;
}

/**
 * Persists a tenancy dispute case, computing its SHA-256 seal.
 *
 * @param {Object} caseData
 * @param {Storage} [customStorage]
 * @returns {Promise<Object>} Saved case with seal
 */
export async function saveTenancyCase(caseData, customStorage) {
  if (!caseData || typeof caseData !== 'object') {
    throw new Error('Invalid case data: object required.');
  }

  const storage = getStorage(customStorage);
  const cases = listTenancyCases(customStorage);
  const now = new Date().toISOString();

  const caseId = caseData.id || `case-ten-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const existingIdx = cases.findIndex((c) => c.id === caseId);

  const updatedCase = {
    ...caseData,
    id: caseId,
    officialStatusDisclaimer: OFFICIAL_STATUS_DISCLAIMER,
    updatedAt: now,
    createdAt: existingIdx >= 0 ? cases[existingIdx].createdAt || now : now,
  };

  updatedCase.digest = await computeTenancyCaseDigest(updatedCase);

  if (existingIdx >= 0) {
    cases[existingIdx] = updatedCase;
  } else {
    cases.push(updatedCase);
  }

  if (storage) {
    storage.setItem(TENANCY_CASES_STORAGE_KEY, JSON.stringify(cases));
  } else {
    inMemoryStore = cases;
  }

  return updatedCase;
}

/**
 * Deletes a tenancy case by ID.
 *
 * @param {string} caseId
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function deleteTenancyCase(caseId, customStorage) {
  const storage = getStorage(customStorage);
  const cases = listTenancyCases(customStorage);
  const filtered = cases.filter((c) => c.id !== caseId);

  if (storage) {
    storage.setItem(TENANCY_CASES_STORAGE_KEY, JSON.stringify(filtered));
  } else {
    inMemoryStore = filtered;
  }
  return true;
}

/**
 * Clears all tenancy cases from local storage.
 *
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function clearAllTenancyCases(customStorage) {
  const storage = getStorage(customStorage);
  if (storage) {
    storage.setItem(TENANCY_CASES_STORAGE_KEY, JSON.stringify([]));
  } else {
    inMemoryStore = [];
  }
  return true;
}

/**
 * Resets the tenancy case store to default sample cases.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function resetToSampleTenancyCases(customStorage) {
  const cloned = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CASES));
  const storage = getStorage(customStorage);
  if (storage) {
    storage.setItem(TENANCY_CASES_STORAGE_KEY, JSON.stringify(cloned));
  } else {
    inMemoryStore = cloned;
  }
  return cloned;
}

/**
 * Exports a case timeline as structured JSON.
 *
 * @param {Object} caseData
 * @returns {string} JSON string
 */
export function exportTenancyCaseJson(caseData) {
  const payload = {
    exportVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    generator: 'CivicBridge Tenancy Security Deposit & Rent Authority Workspace',
    disclaimer: OFFICIAL_STATUS_DISCLAIMER,
    case: { ...caseData },
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Exports a printable Markdown representation of a tenancy case.
 *
 * @param {Object} caseData
 * @returns {string} Markdown text
 */
export function exportTenancyCaseMarkdown(caseData) {
  const lines = [
    `# TENANCY DISPUTE & SECURITY DEPOSIT AUDIT DOSSIER`,
    `**Case Title:** ${caseData.title || 'Untitled Tenancy Case'}`,
    `**Premises:** ${caseData.premisesAddress || 'N/A'}`,
    `**Jurisdiction:** ${caseData.jurisdiction || 'N/A'}`,
    `**Monthly Rent:** ₹${Number(caseData.monthlyRent || 0).toLocaleString('en-IN')}`,
    `**Security Deposit Paid:** ₹${Number(caseData.securityDepositPaid || 0).toLocaleString('en-IN')}`,
    `**Vacation Date:** ${caseData.vacationDate || 'Not specified'}`,
    `**Status:** ${caseData.status || 'DRAFT'}`,
    `**Cryptographic Seal (SHA-256):** \`${caseData.digest || 'Pending'}\``,
    `**Exported Date:** ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `> **${OFFICIAL_STATUS_DISCLAIMER}**`,
    ``,
    `---`,
    `## DISPUTED DEDUCTIONS AUDIT`,
    ``,
  ];

  if (!caseData.deductions || caseData.deductions.length === 0) {
    lines.push(`*No deductions logged.*`);
  } else {
    caseData.deductions.forEach((d, idx) => {
      lines.push(`### ${idx + 1}. ${d.description}`);
      lines.push(`- **Amount:** ₹${Number(d.amount || 0).toLocaleString('en-IN')}`);
      lines.push(`- **Category:** ${d.category}`);
      lines.push(`- **Contractor Invoice Provided:** ${d.hasInvoice ? 'Yes' : 'No'}`);
      lines.push(``);
    });
  }

  if (caseData.severedServices && caseData.severedServices.length > 0) {
    lines.push(`---`);
    lines.push(`## SEVERED ESSENTIAL SERVICES (SECTION 20)`);
    lines.push(`- **Disconnected Services:** ${caseData.severedServices.join(', ')}`);
    lines.push(`- **Disconnection Date:** ${caseData.disconnectionDate || 'N/A'}`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*Generated via CivicBridge Tenancy Security Deposit Refund & Rent Authority Workspace (Model Tenancy Act, 2021)*`);
  return lines.join('\n');
}

/**
 * Exports a master dossier in Markdown for all stored cases.
 *
 * @param {Array<Object>} cases
 * @returns {string} Master markdown dossier
 */
export function exportAllTenancyCasesDossier(cases = []) {
  const lines = [
    `# MASTER TENANCY DISPUTE DOSSIER`,
    `Generated: ${new Date().toLocaleDateString('en-IN')}`,
    `Total Cases Tracked: ${cases.length}`,
    ``,
    `> **${OFFICIAL_STATUS_DISCLAIMER}**`,
    ``,
    `---`,
    ``,
  ];

  if (!cases || cases.length === 0) {
    lines.push(`*No tenancy dispute cases found in local storage.*`);
  } else {
    cases.forEach((c, idx) => {
      lines.push(`## CASE ${idx + 1}: ${c.title || 'Untitled Case'}`);
      lines.push(exportTenancyCaseMarkdown(c));
      lines.push(`\n---\n`);
    });
  }

  return lines.join('\n');
}
