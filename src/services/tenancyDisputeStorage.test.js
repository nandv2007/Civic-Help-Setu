import { describe, it, expect, beforeEach } from 'vitest';
import {
  listTenancyCases,
  getTenancyCaseById,
  saveTenancyCase,
  deleteTenancyCase,
  clearAllTenancyCases,
  resetToSampleTenancyCases,
  computeTenancyCaseDigest,
  verifyTenancyCaseIntegrity,
  exportTenancyCaseJson,
  exportTenancyCaseMarkdown,
  exportAllTenancyCasesDossier,
  INITIAL_SAMPLE_CASES,
  OFFICIAL_STATUS_DISCLAIMER,
} from './tenancyDisputeStorage.js';

describe('tenancyDisputeStorage (#1338)', () => {
  let mockStorage;
  let store;

  beforeEach(() => {
    store = new Map();
    mockStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
    };
  });

  it('initializes with seed sample case when storage is empty', () => {
    const cases = listTenancyCases(mockStorage);
    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0].id).toBe(INITIAL_SAMPLE_CASES[0].id);
    expect(cases[0].officialStatusDisclaimer).toBe(OFFICIAL_STATUS_DISCLAIMER);
  });

  it('computes deterministic SHA-256 seal and detects tampering', async () => {
    const testCase = {
      id: 'case-test-tenancy-1',
      premisesAddress: 'Flat 101, Lakeview Heights, Bengaluru',
      monthlyRent: 25000,
      securityDepositPaid: 100000,
      vacationDate: '2026-02-01',
      status: 'DRAFT',
      deductions: [{ id: 'd1', amount: 10000 }],
      severedServices: ['water'],
    };

    const digest1 = await computeTenancyCaseDigest(testCase);
    const digest2 = await computeTenancyCaseDigest(testCase);
    expect(digest1).toBe(digest2);
    expect(digest1.length).toBeGreaterThan(0);

    testCase.digest = digest1;
    const verification = await verifyTenancyCaseIntegrity(testCase);
    expect(verification.valid).toBe(true);

    // Tamper with rent / deposit
    const tampered = { ...testCase, monthlyRent: 35000 };
    const tamperedVerification = await verifyTenancyCaseIntegrity(tampered);
    expect(tamperedVerification.valid).toBe(false);
  });

  it('saves, retrieves, and deletes a tenancy case', async () => {
    const saved = await saveTenancyCase(
      {
        title: 'Security Deposit Non-Refund Notice',
        premisesAddress: 'House 12, Indiranagar, Bengaluru',
        monthlyRent: 30000,
        securityDepositPaid: 90000,
        deductions: [],
      },
      mockStorage
    );

    expect(saved.id).toBeDefined();
    expect(saved.digest).toBeDefined();

    const retrieved = getTenancyCaseById(saved.id, mockStorage);
    expect(retrieved).not.toBeNull();
    expect(retrieved.premisesAddress).toBe('House 12, Indiranagar, Bengaluru');

    deleteTenancyCase(saved.id, mockStorage);
    const afterDelete = getTenancyCaseById(saved.id, mockStorage);
    expect(afterDelete).toBeNull();
  });

  it('clears all cases and resets to sample data', () => {
    clearAllTenancyCases(mockStorage);
    expect(listTenancyCases(mockStorage).length).toBe(0);

    const resetCases = resetToSampleTenancyCases(mockStorage);
    expect(resetCases.length).toBeGreaterThanOrEqual(1);
    expect(resetCases[0].premisesType).toBe('residential');
  });

  it('exports case as structured JSON and Markdown dossier', () => {
    const caseData = INITIAL_SAMPLE_CASES[0];

    const json = exportTenancyCaseJson(caseData);
    const parsed = JSON.parse(json);
    expect(parsed.generator).toContain('Tenancy Security Deposit');
    expect(parsed.case.premisesAddress).toBe(caseData.premisesAddress);

    const md = exportTenancyCaseMarkdown(caseData);
    expect(md).toContain('# TENANCY DISPUTE &amp; SECURITY DEPOSIT AUDIT DOSSIER'.replace('&amp;', '&'));
    expect(md).toContain('Greenfield Apartments');
    expect(md).toContain(OFFICIAL_STATUS_DISCLAIMER);

    const masterDossier = exportAllTenancyCasesDossier([caseData]);
    expect(masterDossier).toContain('# MASTER TENANCY DISPUTE DOSSIER');
    expect(masterDossier).toContain('Total Cases Tracked: 1');
  });
});
