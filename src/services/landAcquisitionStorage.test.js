import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeClaimDigest,
  minimizeForExternal,
  verifyClaimIntegrity,
  listLarrClaims,
  getLarrClaim,
  saveLarrClaim,
  deleteLarrClaim,
  exportLarrDossierJson,
  exportLarrTextSlip,
} from './landAcquisitionStorage.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Land Acquisition Storage Service (#876)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  const sampleClaim = {
    claimant: {
      name: 'Balwant Singh',
      address: 'Village Rupnagar, Punjab',
      contact: '9814012345',
    },
    landDetails: {
      surveyNo: 'Khasra No. 891/2',
      village: 'Rupnagar Rural',
      taluk: 'Anandpur Sahib',
      district: 'Rupnagar',
    },
    project: {
      projectName: 'Freight Corridor Rail Link',
      acquiringBody: 'DFCCIL / Ministry of Railways',
      awardNo: 'DFCCIL/PB/2023/12',
    },
    landArea: 4.0,
    areaUnit: 'ACRES',
    circleRatePerUnit: 1500000,
    averageSaleRatePerUnit: 2200000,
    locationType: 'RURAL_REMOTE',
    customMultiplier: 2.0,
    valueAttachedAssetsInr: 600000,
    notificationDate: '2022-01-10',
    awardDate: '2023-04-15',
    collectorOfferedTotalInr: 12000000,
  };

  it('generates deterministic SHA-256 digital seals', () => {
    const digest1 = computeClaimDigest(sampleClaim);
    const digest2 = computeClaimDigest(sampleClaim);
    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[a-f0-9]{64}$/);

    const modified = { ...sampleClaim, landArea: 5.0 };
    const digestModified = computeClaimDigest(modified);
    expect(digestModified).not.toBe(digest1);
  });

  it('scrubs PII under DPDP principles for external export', () => {
    const redacted = minimizeForExternal(sampleClaim);
    expect(redacted.claimant.name).toBe('B*** (Masked)');
    expect(redacted.claimant.contact).toBe('XXXXXX2345');
    expect(redacted.landDetails.surveyNo).toBe('[Masked Survey / Khasra No.]');
    expect(redacted.isRedacted).toBe(true);
  });

  it('saves, verifies, and lists claims in client-side storage', () => {
    const saved = saveLarrClaim(sampleClaim, mockStorage);
    expect(saved.id).toBeDefined();
    expect(saved.digest).toBeDefined();
    expect(verifyClaimIntegrity(saved)).toBe(true);

    const list = listLarrClaims(mockStorage);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);

    const fetched = getLarrClaim(saved.id, mockStorage);
    expect(fetched.claimant.name).toBe('Balwant Singh');
  });

  it('detects tampering when claim data is modified post-save', () => {
    const saved = saveLarrClaim(sampleClaim, mockStorage);
    expect(verifyClaimIntegrity(saved)).toBe(true);

    const tampered = { ...saved, landArea: 99.9 };
    expect(verifyClaimIntegrity(tampered)).toBe(false);
  });

  it('updates existing claims and preserves record identity', () => {
    const saved = saveLarrClaim(sampleClaim, mockStorage);
    const updated = saveLarrClaim(
      { ...saved, collectorOfferedTotalInr: 14000000 },
      mockStorage
    );

    expect(updated.id).toBe(saved.id);
    const list = listLarrClaims(mockStorage);
    expect(list.length).toBe(1);
    expect(list[0].collectorOfferedTotalInr).toBe(14000000);
    expect(verifyClaimIntegrity(updated)).toBe(true);
  });

  it('deletes claim by ID', () => {
    const saved = saveLarrClaim(sampleClaim, mockStorage);
    expect(listLarrClaims(mockStorage).length).toBe(1);

    const deleted = deleteLarrClaim(saved.id, mockStorage);
    expect(deleted).toBe(true);
    expect(listLarrClaims(mockStorage).length).toBe(0);
    expect(deleteLarrClaim('non-existent', mockStorage)).toBe(false);
  });

  it('exports JSON evidence dossier and legal reference slip', () => {
    const saved = saveLarrClaim(sampleClaim, mockStorage);
    const json = exportLarrDossierJson(saved);
    expect(json).toContain('Balwant Singh');
    expect(json).toContain(saved.digest);

    const redactedJson = exportLarrDossierJson(saved, { redact: true });
    expect(redactedJson).not.toContain('9814012345');
    expect(redactedJson).toContain('XXXXXX2345');

    const slip = exportLarrTextSlip(saved);
    expect(slip).toContain('APPLICATION REQUIRING REFERENCE TO THE LAND ACQUISITION');
    expect(slip).toContain('Balwant Singh');
  });
});
