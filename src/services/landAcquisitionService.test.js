import { describe, it, expect } from 'vitest';
import {
  STATUTORY_SOLATIUM_PERCENT,
  STATUTORY_ADDITIONAL_INTEREST_RATE,
  AREA_UNITS,
  LAND_LOCATION_TYPES,
  MANDATORY_RR_PROVISIONS,
  isValidDate,
  getDaysBetween,
  computeBaseMarketRate,
  calculateLandCompensation,
  evaluateSection64Limitation,
  evaluateLarrEvidenceReadiness,
  draftLarraReferencePetition,
} from './landAcquisitionService.js';

describe('Land Acquisition Service (#876)', () => {
  describe('Constants & Date Helpers', () => {
    it('provides valid statutory constants', () => {
      expect(STATUTORY_SOLATIUM_PERCENT).toBe(100);
      expect(STATUTORY_ADDITIONAL_INTEREST_RATE).toBe(12.0);
      expect(AREA_UNITS.ACRES.toSqMeters).toBeCloseTo(4046.86);
      expect(LAND_LOCATION_TYPES.RURAL_REMOTE.defaultMultiplier).toBe(2.0);
      expect(MANDATORY_RR_PROVISIONS.length).toBe(5);
    });

    it('validates dates and calculates day deltas', () => {
      expect(isValidDate('2023-08-15')).toBe(true);
      expect(isValidDate('bad-date')).toBe(false);
      expect(getDaysBetween('2023-01-01', '2023-01-11')).toBe(10);
    });
  });

  describe('computeBaseMarketRate', () => {
    it('picks the highest among circle rate, average comparable sales, and agreed consortium rate', () => {
      const rate = computeBaseMarketRate({
        circleRatePerUnit: 2000000,
        averageSaleRatePerUnit: 3500000,
        consortiumAgreedRatePerUnit: 2800000,
      });
      expect(rate).toBe(3500000);
    });

    it('handles zero or missing values gracefully', () => {
      const rate = computeBaseMarketRate({
        circleRatePerUnit: 1500000,
      });
      expect(rate).toBe(1500000);
    });
  });

  describe('calculateLandCompensation', () => {
    it('correctly calculates First Schedule statutory compensation with 100% Solatium and 12% interest', () => {
      // 2 Acres land at Rs. 10,00,000/acre
      // Rural remote: 2.0x multiplier -> Basic = 20L, Adjusted = 40L
      // Attached assets: Rs. 5,00,000 -> Pre-solatium = 45L
      // Solatium 100% = 45L
      // 1 year (365 days) from notification to award: 12% of 40L = 4.8L
      // Total = 40L + 5L + 45L + 4.8L = 94.8L
      const result = calculateLandCompensation({
        landArea: 2,
        areaUnit: 'ACRES',
        circleRatePerUnit: 800000,
        averageSaleRatePerUnit: 1000000,
        locationType: 'RURAL_REMOTE',
        valueAttachedAssetsInr: 500000,
        notificationDate: '2022-01-01',
        awardDate: '2023-01-01',
        collectorOfferedTotalInr: 6000000, // 60L offered
      });

      expect(result.isValid).toBe(true);
      expect(result.baseRatePerUnit).toBe(1000000);
      expect(result.basicLandValueInr).toBe(2000000);
      expect(result.multiplier).toBe(2.0);
      expect(result.adjustedMarketValueInr).toBe(4000000);
      expect(result.attachedAssetsInr).toBe(500000);
      expect(result.solatiumAmountInr).toBe(4500000);
      expect(result.interestDays).toBe(365);
      expect(result.additionalInterestInr).toBe(480000);
      expect(result.totalStatutoryCompensationInr).toBe(9480000);
      expect(result.hasShortfall).toBe(true);
      expect(result.shortfallInr).toBe(3480000); // 94.8L - 60L
    });

    it('handles urban land with 1.0x multiplier and no attached assets', () => {
      const result = calculateLandCompensation({
        landArea: 1,
        areaUnit: 'ACRES',
        circleRatePerUnit: 5000000,
        locationType: 'URBAN',
        collectorOfferedTotalInr: 10000000,
      });

      expect(result.multiplier).toBe(1.0);
      expect(result.basicLandValueInr).toBe(5000000);
      expect(result.adjustedMarketValueInr).toBe(5000000);
      expect(result.solatiumAmountInr).toBe(5000000);
      expect(result.totalStatutoryCompensationInr).toBe(10000000);
      expect(result.hasShortfall).toBe(false);
      expect(result.shortfallInr).toBe(0);
    });
  });

  describe('evaluateSection64Limitation', () => {
    it('enforces 6-week limitation when landholder was present at award', () => {
      const result = evaluateSection64Limitation({
        awardDate: '2024-05-01',
        wasPresentAtAward: true,
        evaluationDate: '2024-05-20', // 19 days later
      });

      expect(result.isValid).toBe(true);
      expect(result.limitationWindowDays).toBe(42);
      expect(result.daysLapsed).toBe(19);
      expect(result.remainingDays).toBe(23);
      expect(result.isWithinLimitation).toBe(true);
      expect(result.statutoryRule).toContain('6 weeks (42 days)');
    });

    it('enforces 6-month limitation when landholder was not present at award', () => {
      const result = evaluateSection64Limitation({
        awardDate: '2024-01-01',
        wasPresentAtAward: false,
        evaluationDate: '2024-05-01', // 121 days later
      });

      expect(result.isValid).toBe(true);
      expect(result.limitationWindowDays).toBe(180);
      expect(result.daysLapsed).toBe(121);
      expect(result.remainingDays).toBe(59);
      expect(result.isWithinLimitation).toBe(true);
      expect(result.statutoryRule).toContain('6 months (180 days)');
    });

    it('flags limitation expiry when deadline has passed', () => {
      const result = evaluateSection64Limitation({
        awardDate: '2023-01-01',
        wasPresentAtAward: true,
        evaluationDate: '2023-04-01', // 90 days > 42 days
      });

      expect(result.isWithinLimitation).toBe(false);
      expect(result.remainingDays).toBe(0);
    });
  });

  describe('evaluateLarrEvidenceReadiness', () => {
    it('evaluates readiness and identifies missing mandatory records', () => {
      const incomplete = {
        collector_award_copy: true,
      };

      const result = evaluateLarrEvidenceReadiness(incomplete);
      expect(result.allMandatoryAttached).toBe(false);
      expect(result.missingMandatory).toContain('Section 11 Preliminary Notification Copy');
      expect(result.missingMandatory).toContain('Revenue Records / 7/12 Extract / Patta / Khatiyan (ROR)');

      const complete = {
        collector_award_copy: true,
        section_11_notification: true,
        record_of_rights_ror: true,
      };

      const fullResult = evaluateLarrEvidenceReadiness(complete);
      expect(fullResult.allMandatoryAttached).toBe(true);
      expect(fullResult.missingMandatory.length).toBe(0);
    });
  });

  describe('draftLarraReferencePetition', () => {
    const mockClaimData = {
      landArea: 3.5,
      areaUnit: 'ACRES',
      circleRatePerUnit: 1200000,
      averageSaleRatePerUnit: 1800000,
      locationType: 'RURAL_MID',
      customMultiplier: 1.5,
      valueAttachedAssetsInr: 450000,
      notificationDate: '2022-03-15',
      awardDate: '2023-09-15',
      collectorOfferedTotalInr: 8000000,
      paymentProtestDate: '2023-10-01',
      claimant: {
        name: 'Hanumantha Rao',
        address: 'H.No 4-52, Bidar District, Karnataka',
        contact: '9988776655',
      },
      project: {
        projectName: 'National Highway NH-50 Widening Project',
        acquiringBody: 'National Highways Authority of India (NHAI)',
        awardNo: 'LA/NH-50/2023/88',
      },
      landDetails: {
        village: 'Basavakalyan Rural',
        taluk: 'Basavakalyan',
        district: 'Bidar',
        surveyNo: 'Sy. No. 142/2A',
      },
    };

    it('drafts a complete statutory Section 64 Reference Petition', () => {
      const petition = draftLarraReferencePetition(mockClaimData);

      expect(petition).toContain('APPLICATION REQUIRING REFERENCE TO THE LAND ACQUISITION, REHABILITATION');
      expect(petition).toContain('SECTION 64 OF THE RIGHT TO FAIR');
      expect(petition).toContain('Hanumantha Rao');
      expect(petition).toContain('National Highway NH-50 Widening Project');
      expect(petition).toContain('Sy. No. 142/2A');
      expect(petition).toContain('LA/NH-50/2023/88');
      expect(petition).toContain('FAILURE TO APPLY STATUTORY RURAL MULTIPLIER UNDER SECTION 26(2)');
      expect(petition).toContain('DEFICIT IN MANDATORY 100% SOLATIUM UNDER SECTION 30(1)');
      expect(petition).toContain('ARBITRARY DENIAL OF 12% ADDITIONAL INTEREST UNDER SECTION 30(3)');
      expect(petition).toContain('SECOND SCHEDULE REHABILITATION & RESETTLEMENT (R&R) ENTITLEMENTS');
      expect(petition).toContain('NET SHORTFALL / ENHANCEMENT CLAIMED');
      expect(petition).toContain('Signature / Thumb Impression of Applicant');
    });
  });
});
