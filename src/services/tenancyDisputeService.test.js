import { describe, it, expect } from 'vitest';
import {
  auditSecurityDepositRefund,
  auditEssentialServiceSeverance,
  generateRentAuthorityPetition,
  generateLegalNoticeToLandlord,
  sanitizeTenancyCase,
  TENANCY_LEGAL_DISCLAIMER,
} from './tenancyDisputeService.js';

describe('tenancyDisputeService (#1338)', () => {
  const sampleCase = {
    monthlyRent: 20000,
    securityDepositPaid: 60000, // 3 months paid, exceeding 2-month cap of 40000
    premisesType: 'residential',
    vacationDate: '2026-01-15',
    tenantName: 'Rahul Sharma',
    tenantContact: 'rahul.s@example.com',
    landlordName: 'Ramesh Gupta',
    landlordContact: 'ramesh.g@example.com',
    premisesAddress: 'Flat 402, Greenfield Apartments, Sector 45, Gurgaon',
    jurisdiction: 'Gurgaon Sub-Division',
    deductions: [
      {
        description: 'Repainting walls due to sun fading and picture nail holes',
        amount: 15000,
        category: 'WEAR_AND_TEAR',
        hasInvoice: false,
      },
      {
        description: 'Broken ceramic washbasin in master bath',
        amount: 3500,
        category: 'STRUCTURAL_DAMAGE',
        hasInvoice: true,
      },
      {
        description: 'Deep cleaning fee without bills',
        amount: 5000,
        category: 'ARBITRARY_PENALTY',
        hasInvoice: false,
      },
    ],
    severedServices: ['water', 'electricity'],
    disconnectionDate: '2026-01-10',
  };

  it('audits residential security deposit ceiling and identifies excess collection', () => {
    const audit = auditSecurityDepositRefund(sampleCase);

    expect(audit.maxStatutoryDeposit).toBe(40000); // 20000 * 2
    expect(audit.depositExcessCharged).toBe(20000); // 60000 - 40000
    expect(audit.isExcessDepositCharged).toBe(true);
  });

  it('differentiates permissible structural deductions from prohibited wear-and-tear', () => {
    const audit = auditSecurityDepositRefund(sampleCase);

    // Permissible: broken washbasin (3500)
    expect(audit.validDeductionsTotal).toBe(3500);
    // Unlawful: repainting wear-and-tear (15000) + arbitrary cleaning (5000) = 20000
    expect(audit.unlawfulDeductionsTotal).toBe(20000);
    expect(audit.legitimateRefundDue).toBe(56500); // 60000 - 3500
    expect(audit.isRefundOverdue).toBe(true);
    expect(audit.statutoryInterestAccrued).toBeGreaterThan(0);
    expect(audit.totalClaimableSum).toBeGreaterThan(56500);
  });

  it('audits essential services disconnection under Section 20', () => {
    const serviceAudit = auditEssentialServiceSeverance(sampleCase);

    expect(serviceAudit.isViolatingSection20).toBe(true);
    expect(serviceAudit.hasCriticalDisconnection).toBe(true);
    expect(serviceAudit.severedList.length).toBe(2);
    expect(serviceAudit.maxStatutoryCompensation).toBe(40000); // 2 months rent under Sec 20(4)
    expect(serviceAudit.urgencyLevel).toBe('EMERGENCY_24_HR');
  });

  it('generates a formal Rent Authority petition with statutory prayers and disclaimers', () => {
    const petition = generateRentAuthorityPetition(sampleCase);

    expect(petition).toContain('BEFORE THE HON\'BLE RENT AUTHORITY');
    expect(petition).toContain('PETITION UNDER SECTIONS 11, 20, AND 30');
    expect(petition).toContain('Rahul Sharma');
    expect(petition).toContain('Ramesh Gupta');
    expect(petition).toContain('Flat 402, Greenfield Apartments');
    expect(petition).toContain('₹56,500');
    expect(petition).toContain(TENANCY_LEGAL_DISCLAIMER);
    expect(petition).toContain('SECTION 11');
  });

  it('generates a pre-litigation legal demand notice to the landlord', () => {
    const notice = generateLegalNoticeToLandlord(sampleCase);

    expect(notice).toContain('LEGAL DEMAND NOTICE FOR STATUTORY REFUND');
    expect(notice).toContain('SEVEN (7) DAYS');
    expect(notice).toContain('Ramesh Gupta');
    expect(notice).toContain('Rahul Sharma');
    expect(notice).toContain(TENANCY_LEGAL_DISCLAIMER);
  });

  it('sanitizes case records for privacy under DPDP Act 2023', () => {
    const sanitized = sanitizeTenancyCase(sampleCase);

    expect(sanitized.tenantName).toBe('Ra***');
    expect(sanitized.tenantContact).toBe('REDACTED_CONTACT');
    expect(sanitized.landlordContact).toBe('REDACTED_FOR_EXPORT');
  });
});
