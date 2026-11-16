/**
 * Land Acquisition Fair Compensation & LARRA Reference Service
 *
 * Implements deterministic statutory computations, rural multipliers,
 * mandatory 100% solatium, Section 30(3) 12% additional interest,
 * Second Schedule R&R entitlements, and Section 64 LARRA reference drafting
 * under the Right to Fair Compensation and Transparency in Land Acquisition,
 * Rehabilitation and Resettlement Act, 2013 (Act No. 30 of 2013).
 */

export const STATUTORY_SOLATIUM_PERCENT = 100; // Section 30(1): Mandatory 100% of total compensation
export const STATUTORY_ADDITIONAL_INTEREST_RATE = 12.0; // Section 30(3): 12% per annum from preliminary notification

/**
 * Standard Area Conversion Constants
 */
export const AREA_UNITS = {
  ACRES: { id: 'ACRES', label: 'Acres', toSqMeters: 4046.86 },
  HECTARES: { id: 'HECTARES', label: 'Hectares', toSqMeters: 10000.0 },
  GUNTHAS: { id: 'GUNTHAS', label: 'Gunthas / Bighas (Std Guntha)', toSqMeters: 101.17 },
  SQ_METERS: { id: 'SQ_METERS', label: 'Square Meters', toSqMeters: 1.0 },
};

/**
 * Land Location Classification & Statutory Multiplier (Section 26(2))
 */
export const LAND_LOCATION_TYPES = {
  URBAN: {
    id: 'URBAN',
    label: 'Urban Agglomeration / Municipal Limits',
    defaultMultiplier: 1.0,
    minMultiplier: 1.0,
    maxMultiplier: 1.0,
    description: 'Land situated within municipal corporation, municipality, or designated urban area (Multiplier 1.00x).',
  },
  RURAL_NEAR: {
    id: 'RURAL_NEAR',
    label: 'Rural Area (Within 10 km from urban limit)',
    defaultMultiplier: 1.25,
    minMultiplier: 1.0,
    maxMultiplier: 2.0,
    description: 'Rural land located within 10 km of the nearest urban boundary.',
  },
  RURAL_MID: {
    id: 'RURAL_MID',
    label: 'Rural Area (10 km to 25 km from urban limit)',
    defaultMultiplier: 1.5,
    minMultiplier: 1.0,
    maxMultiplier: 2.0,
    description: 'Rural agricultural land intermediate distance from urban agglomeration.',
  },
  RURAL_REMOTE: {
    id: 'RURAL_REMOTE',
    label: 'Rural Hinterland (Beyond 25 km from urban limit)',
    defaultMultiplier: 2.0,
    minMultiplier: 1.0,
    maxMultiplier: 2.0,
    description: 'Remote rural or agricultural land entitled to maximum statutory rural multiplier (up to 2.00x).',
  },
};

/**
 * Second Schedule Mandatory Rehabilitation & Resettlement (R&R) Baseline Benefits
 */
export const MANDATORY_RR_PROVISIONS = [
  {
    id: 'housing_provision',
    title: 'Constructed House or Financial Grant',
    statutoryRef: 'Second Schedule, Element 1',
    description: 'Free constructed house (min 50 sq.m in rural or 25 sq.m in urban) if residential dwelling is acquired.',
    defaultMonetaryValue: 300000,
  },
  {
    id: 'one_time_resettlement_allowance',
    title: 'One-Time Resettlement Allowance',
    statutoryRef: 'Second Schedule, Element 4',
    description: 'Mandatory lump-sum allowance of Rs. 50,000 for each displaced or relocated family.',
    defaultMonetaryValue: 50000,
  },
  {
    id: 'subsistence_grant',
    title: '12-Month Subsistence Grant',
    statutoryRef: 'Second Schedule, Element 3',
    description: 'Monthly grant of Rs. 3,000 per month for 12 months (Rs. 36,000 total, or Rs. 50,000 for SC/ST families).',
    defaultMonetaryValue: 36000,
  },
  {
    id: 'cattle_shed_or_shop_grant',
    title: 'Cattle Shed / Artisan Petty Shop Grant',
    statutoryRef: 'Second Schedule, Element 5',
    description: 'Assistance for construction of cattle shed or petty trade kiosk (Rs. 25,000 minimum).',
    defaultMonetaryValue: 25000,
  },
  {
    id: 'mandatory_employment_or_annuity',
    title: 'Employment or Lump-Sum Annuity Option',
    statutoryRef: 'Second Schedule, Element 2',
    description: 'Mandatory employment for one person per affected family, OR lump-sum of Rs. 5,00,000, OR life annuity of Rs. 2,000/month.',
    defaultMonetaryValue: 500000,
  },
];

/**
 * Validates ISO Date string (YYYY-MM-DD).
 */
export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime());
}

/**
 * Computes calendar days between two ISO dates.
 */
export function getDaysBetween(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates Section 26 base market value per unit.
 *
 * @param {Object} params
 * @param {number} params.circleRatePerUnit Government circle rate / guidance value
 * @param {number} [params.averageSaleRatePerUnit=0] Average sale price of top 2% comparable deeds
 * @param {number} [params.consortiumAgreedRatePerUnit=0] Mutually agreed rate under Sec 2(2)
 * @returns {number} Higher benchmark rate
 */
export function computeBaseMarketRate({
  circleRatePerUnit = 0,
  averageSaleRatePerUnit = 0,
  consortiumAgreedRatePerUnit = 0,
}) {
  const circle = Math.max(0, Number(circleRatePerUnit) || 0);
  const avgSale = Math.max(0, Number(averageSaleRatePerUnit) || 0);
  const agreed = Math.max(0, Number(consortiumAgreedRatePerUnit) || 0);

  return Math.max(circle, avgSale, agreed);
}

/**
 * Calculates comprehensive First Schedule statutory land compensation award.
 *
 * @param {Object} params
 * @param {number} params.landArea Total land area acquired
 * @param {string} [params.areaUnit='ACRES'] Unit of measurement from AREA_UNITS
 * @param {number} params.circleRatePerUnit Government circle rate per unit (in INR)
 * @param {number} [params.averageSaleRatePerUnit=0] Highest average comparable sale deed rate (in INR)
 * @param {number} [params.consortiumAgreedRatePerUnit=0] Agreed rate (if any)
 * @param {string} [params.locationType='RURAL_NEAR'] Key from LAND_LOCATION_TYPES
 * @param {number} [params.customMultiplier] Explicit multiplier (overrides location default if provided)
 * @param {number} [params.valueAttachedAssetsInr=0] Value of standing trees, wells, buildings (Section 29)
 * @param {string} params.notificationDate Preliminary notification date under Sec 4/11 (YYYY-MM-DD)
 * @param {string} params.awardDate Collector's award date under Section 23 (YYYY-MM-DD)
 * @param {number} [params.collectorOfferedTotalInr=0] Total compensation awarded by Collector
 * @returns {Object} Comprehensive statutory compensation breakdown
 */
export function calculateLandCompensation({
  landArea = 0,
  areaUnit = 'ACRES',
  circleRatePerUnit = 0,
  averageSaleRatePerUnit = 0,
  consortiumAgreedRatePerUnit = 0,
  locationType = 'RURAL_NEAR',
  customMultiplier,
  valueAttachedAssetsInr = 0,
  notificationDate,
  awardDate,
  collectorOfferedTotalInr = 0,
}) {
  const area = Math.max(0, Number(landArea) || 0);
  const baseRate = computeBaseMarketRate({
    circleRatePerUnit,
    averageSaleRatePerUnit,
    consortiumAgreedRatePerUnit,
  });

  const locMeta = LAND_LOCATION_TYPES[locationType] || LAND_LOCATION_TYPES.RURAL_NEAR;
  const multiplier = customMultiplier !== undefined && customMultiplier !== null
    ? Math.max(1.0, Math.min(2.0, Number(customMultiplier) || locMeta.defaultMultiplier))
    : locMeta.defaultMultiplier;

  // Unadjusted Basic Land Value = Area * Base Rate
  const basicLandValueInr = Math.round(area * baseRate);

  // Section 26(2) Adjusted Market Value = Basic Land Value * Rural Multiplier
  const adjustedMarketValueInr = Math.round(basicLandValueInr * multiplier);

  // Section 29 Attached Assets Value (trees, crops, structures, wells)
  const attachedAssetsInr = Math.max(0, Math.round(Number(valueAttachedAssetsInr) || 0));

  // Subtotal before Solatium = Adjusted Market Value + Attached Assets
  const preSolatiumSubtotalInr = adjustedMarketValueInr + attachedAssetsInr;

  // Section 30(1) Mandatory 100% Solatium
  const solatiumAmountInr = preSolatiumSubtotalInr; // 100% of total assessed value

  // Section 30(3) 12% Additional Interest
  let additionalInterestInr = 0;
  let interestDays = 0;
  let isInterestCalculated = false;

  if (isValidDate(notificationDate) && isValidDate(awardDate)) {
    interestDays = getDaysBetween(notificationDate, awardDate);
    if (interestDays > 0) {
      // 12% per annum on basic market value (adjustedMarketValue)
      additionalInterestInr = Math.round(
        (adjustedMarketValueInr * (STATUTORY_ADDITIONAL_INTEREST_RATE / 100) * interestDays) / 365
      );
      isInterestCalculated = true;
    }
  }

  // Total Statutory Fair Compensation Award
  const totalStatutoryCompensationInr =
    adjustedMarketValueInr + attachedAssetsInr + solatiumAmountInr + additionalInterestInr;

  const collectorOffered = Math.max(0, Math.round(Number(collectorOfferedTotalInr) || 0));
  const shortfallInr = Math.max(0, totalStatutoryCompensationInr - collectorOffered);
  const hasShortfall = collectorOffered > 0 && shortfallInr > 0;

  return {
    isValid: area > 0 && baseRate > 0,
    area,
    areaUnit,
    baseRatePerUnit: baseRate,
    circleRatePerUnit: Number(circleRatePerUnit) || 0,
    averageSaleRatePerUnit: Number(averageSaleRatePerUnit) || 0,
    basicLandValueInr,
    locationType: locMeta.id,
    locationLabel: locMeta.label,
    multiplier,
    adjustedMarketValueInr,
    attachedAssetsInr,
    preSolatiumSubtotalInr,
    solatiumAmountInr,
    solatiumPercentage: STATUTORY_SOLATIUM_PERCENT,
    notificationDate: isValidDate(notificationDate) ? notificationDate : null,
    awardDate: isValidDate(awardDate) ? awardDate : null,
    interestDays,
    isInterestCalculated,
    additionalInterestInr,
    additionalInterestRate: STATUTORY_ADDITIONAL_INTEREST_RATE,
    totalStatutoryCompensationInr,
    collectorOfferedTotalInr: collectorOffered,
    shortfallInr,
    hasShortfall,
    shortfallPercentage: collectorOffered > 0
      ? Math.round((shortfallInr / totalStatutoryCompensationInr) * 100)
      : 0,
  };
}

/**
 * Evaluates Section 64 LARRA Reference limitation period.
 *
 * @param {Object} params
 * @param {string} params.awardDate Date on which Collector passed award (YYYY-MM-DD)
 * @param {string} [params.awardNoticeServedDate] Date on which Section 20/23 notice was served
 * @param {boolean} [params.wasPresentAtAward=false] Whether landholder was present when award made
 * @param {string} [params.evaluationDate] Current date (defaults to today)
 * @returns {Object} Limitation calculation
 */
export function evaluateSection64Limitation({
  awardDate,
  awardNoticeServedDate,
  wasPresentAtAward = false,
  evaluationDate,
}) {
  if (!isValidDate(awardDate)) {
    return {
      isValid: false,
      error: 'Invalid or missing Collector award date.',
      isWithinLimitation: false,
      remainingDays: 0,
    };
  }

  const evalDate = isValidDate(evaluationDate)
    ? evaluationDate
    : new Date().toISOString().slice(0, 10);

  // If present at award: 6 weeks = 42 days from award date
  // If not present: 6 weeks from notice receipt, OR 6 months (180 days) from award/notice
  const anchorDate = wasPresentAtAward
    ? awardDate
    : (isValidDate(awardNoticeServedDate) ? awardNoticeServedDate : awardDate);

  const limitationWindowDays = wasPresentAtAward ? 42 : 180;
  const daysLapsed = getDaysBetween(anchorDate, evalDate);
  const remainingDays = Math.max(0, limitationWindowDays - daysLapsed);
  const isWithinLimitation = daysLapsed <= limitationWindowDays;

  return {
    isValid: true,
    awardDate,
    anchorDate,
    wasPresentAtAward,
    limitationWindowDays,
    daysLapsed,
    remainingDays,
    isWithinLimitation,
    statutoryRule: wasPresentAtAward
      ? 'Section 64(2)(a): Application must be filed within 6 weeks (42 days) of the award.'
      : 'Section 64(2)(b): Application must be filed within 6 weeks of notice or 6 months (180 days) of knowledge of award.',
  };
}

/**
 * Required statutory evidence checklist for Land Acquisition Reference.
 */
export const LARR_EVIDENCE_CHECKLIST = [
  {
    id: 'collector_award_copy',
    label: 'Certified Copy of Collector Award under Section 23',
    mandatory: true,
    description: 'Official award order showing survey numbers, land categorization, and compensation breakup.',
  },
  {
    id: 'section_11_notification',
    label: 'Section 11 Preliminary Notification Copy',
    mandatory: true,
    description: 'Official gazette notification marking inception date for Section 30(3) 12% interest.',
  },
  {
    id: 'record_of_rights_ror',
    label: 'Revenue Records / 7/12 Extract / Patta / Khatiyan (ROR)',
    mandatory: true,
    description: 'Updated record of rights confirming title, classification (wet/dry/irrigated), and area.',
  },
  {
    id: 'comparable_sale_deeds',
    label: 'Registered Sale Deeds of Highest Adjacent Comparable Lands',
    mandatory: false,
    description: 'Certified copies of top registered sale transactions within 3 years prior to notification.',
  },
  {
    id: 'attached_assets_valuation',
    label: 'Valuation Certificate for Trees / Wells / Structures',
    mandatory: false,
    description: 'Evaluation report by Chartered Engineer, PWD Valuer, or Horticulture Department.',
  },
  {
    id: 'award_protest_receipt',
    label: 'Payment Protest Receipt / Objection Note under Section 64',
    mandatory: false,
    description: 'Proof that compensation was received "UNDER PROTEST" without waiving reference rights.',
  },
];

/**
 * Evaluates evidence checklist readiness.
 */
export function evaluateLarrEvidenceReadiness(checklistState = {}) {
  const items = LARR_EVIDENCE_CHECKLIST.map((item) => ({
    ...item,
    attached: Boolean(checklistState[item.id]),
  }));

  const mandatory = items.filter((i) => i.mandatory);
  const attachedMandatory = mandatory.filter((i) => i.attached);
  const allMandatoryAttached = attachedMandatory.length === mandatory.length;
  const totalAttached = items.filter((i) => i.attached).length;
  const readinessPercentage = Math.round((totalAttached / items.length) * 100);

  return {
    items,
    readinessPercentage,
    allMandatoryAttached,
    totalAttached,
    totalItems: items.length,
    missingMandatory: mandatory.filter((i) => !i.attached).map((i) => i.label),
  };
}

/**
 * Drafts a formal, court-ready Section 64 Application for Reference to the LARRA.
 *
 * @param {Object} claimData
 * @returns {string} Formatted statutory legal petition text
 */
export function draftLarraReferencePetition(claimData = {}) {
  const calculation = calculateLandCompensation({
    landArea: claimData.landArea,
    areaUnit: claimData.areaUnit || 'ACRES',
    circleRatePerUnit: claimData.circleRatePerUnit || 0,
    averageSaleRatePerUnit: claimData.averageSaleRatePerUnit || 0,
    consortiumAgreedRatePerUnit: claimData.consortiumAgreedRatePerUnit || 0,
    locationType: claimData.locationType || 'RURAL_NEAR',
    customMultiplier: claimData.customMultiplier,
    valueAttachedAssetsInr: claimData.valueAttachedAssetsInr || 0,
    notificationDate: claimData.notificationDate,
    awardDate: claimData.awardDate,
    collectorOfferedTotalInr: claimData.collectorOfferedTotalInr || 0,
  });

  const limitation = evaluateSection64Limitation({
    awardDate: claimData.awardDate,
    awardNoticeServedDate: claimData.awardNoticeServedDate,
    wasPresentAtAward: Boolean(claimData.wasPresentAtAward),
  });

  const claimantName = claimData.claimant?.name || '[NAME OF LANDHOLDER / INTERESTED PERSON]';
  const claimantAddress = claimData.claimant?.address || '[RESIDENTIAL ADDRESS OF CLAIMANT]';
  const claimantContact = claimData.claimant?.contact || '[PHONE / EMAIL]';

  const acquiringBody = claimData.project?.acquiringBody || '[ACQUIRING BODY / NHAI / RAILWAYS / STATE PWD]';
  const projectName = claimData.project?.projectName || '[PUBLIC PURPOSE PROJECT NAME]';
  const village = claimData.landDetails?.village || '[VILLAGE / MOUZA]';
  const taluk = claimData.landDetails?.taluk || '[TALUK / TEHSIL]';
  const district = claimData.landDetails?.district || '[DISTRICT]';
  const surveyNo = claimData.landDetails?.surveyNo || '[SURVEY / KHASRA NUMBER]';
  const awardNo = claimData.project?.awardNo || '[AWARD NUMBER / CASE NUMBER]';

  const lines = [
    '================================================================================',
    'FORMAL APPLICATION FOR REFERENCE UNDER SECTION 64 OF THE RIGHT TO FAIR',
    'COMPENSATION AND TRANSPARENCY IN LAND ACQUISITION, REHABILITATION AND',
    'RESETTLEMENT ACT, 2013 (CENTRAL ACT NO. 30 OF 2013)',
    '================================================================================',
    '',
    'TO:',
    'THE DISTRICT COLLECTOR / SPECIAL LAND ACQUISITION OFFICER,',
    `OFFICE OF THE COLLECTORATE, ${district.toUpperCase()}`,
    '',
    `SUBJECT: APPLICATION REQUIRING REFERENCE TO THE LAND ACQUISITION, REHABILITATION`,
    `         AND RESETTLEMENT AUTHORITY (LARRA) UNDER SECTION 64 REGARDING AWARD NO. ${awardNo}`,
    '',
    'IN THE MATTER OF:',
    `1. APPLICANT / INTERESTED PERSON:`,
    `   ${claimantName}`,
    `   Residing at: ${claimantAddress}`,
    `   Contact: ${claimantContact}`,
    '',
    '                           AND',
    '',
    `2. ACQUIRING BODY / REQUISITIONING AUTHORITY:`,
    `   ${acquiringBody}`,
    `   Project: ${projectName}`,
    `   Location: Village ${village}, Tehsil ${taluk}, District ${district}`,
    `   Survey / Khasra No.: ${surveyNo}`,
    '',
    '--------------------------------------------------------------------------------',
    'I. BRIEF PARTICULARS OF THE ACQUIRED PROPERTY & COLLECTOR\'S AWARD:',
    '--------------------------------------------------------------------------------',
    `1. Total Land Acquired: ${calculation.area} ${calculation.areaUnit}`,
    `2. Land Classification: ${calculation.locationLabel}`,
    `3. Section 11 Preliminary Notification Date: ${calculation.notificationDate || '[DATE]' }`,
    `4. Section 23 Award Pronounced On: ${calculation.awardDate || '[DATE]'}`,
    `5. Total Compensation Offered by Collector: Rs. ${calculation.collectorOfferedTotalInr.toLocaleString('en-IN')}`,
    `6. Payment Status: RECEIVED UNDER PROTEST on ${claimData.paymentProtestDate || '[DATE]' } without prejudice to reference rights.`,
    `7. Limitation Compliance: Filed within statutory period under ${limitation.statutoryRule} (${limitation.remainingDays} days remaining).`,
    '',
    '--------------------------------------------------------------------------------',
    'II. GROUNDS OF OBJECTION TO THE COLLECTOR\'S AWARD:',
    '--------------------------------------------------------------------------------',
    '1. ERRONEOUS BASE MARKET VALUE UNDER SECTION 26:',
    `   The Collector grossly undervalued the subject land by ignoring registered sale deeds of comparable prime adjacent plots in the vicinity, fixing an arbitrary rate of Rs. ${calculation.circleRatePerUnit.toLocaleString('en-IN')}/${calculation.areaUnit} instead of true market rate of Rs. ${calculation.baseRatePerUnit.toLocaleString('en-IN')}/${calculation.areaUnit}.`,
    '',
    '2. FAILURE TO APPLY STATUTORY RURAL MULTIPLIER UNDER SECTION 26(2):',
    `   The acquired property is situated in a rural area and is statutorily entitled to a multiplier factor of ${calculation.multiplier}x. The Collector failed to apply the appropriate rural factor, resulting in grave prejudice.`,
    '',
    '3. DEFICIT IN MANDATORY 100% SOLATIUM UNDER SECTION 30(1):',
    `   Under Section 30(1), the award of Solatium of 100% over the total assessed market value is mandatory and non-discretionary. The correct statutory Solatium entitlement evaluates to Rs. ${calculation.solatiumAmountInr.toLocaleString('en-IN')}.`,
    '',
    '4. ARBITRARY DENIAL OF 12% ADDITIONAL INTEREST UNDER SECTION 30(3):',
    `   Under Section 30(3), the Applicant is entitled to additional interest at 12% per annum from Section 11 notification (${calculation.notificationDate}) to Award date (${calculation.awardDate}) covering ${calculation.interestDays} days, amounting to Rs. ${calculation.additionalInterestInr.toLocaleString('en-IN')}.`,
    '',
    '5. DENIAL OF SECOND SCHEDULE REHABILITATION & RESETTLEMENT (R&R) ENTITLEMENTS:',
    '   The Collector failed to provide mandatory alternative housing, one-time resettlement grant of Rs. 50,000, and employment/annuity guaranteed under the Second Schedule.',
    '',
    '--------------------------------------------------------------------------------',
    'III. STATUTORY FAIR COMPENSATION COMPUTATION (FIRST SCHEDULE):',
    '--------------------------------------------------------------------------------',
    `1. Basic Land Value (Area x Base Rate): Rs. ${calculation.basicLandValueInr.toLocaleString('en-IN')}`,
    `2. Section 26(2) Rural Multiplier (${calculation.multiplier}x): Rs. ${calculation.adjustedMarketValueInr.toLocaleString('en-IN')}`,
    `3. Section 29 Attached Assets (Trees, Structures, Wells): Rs. ${calculation.attachedAssetsInr.toLocaleString('en-IN')}`,
    `4. Section 30(1) Mandatory 100% Solatium: Rs. ${calculation.solatiumAmountInr.toLocaleString('en-IN')}`,
    `5. Section 30(3) 12% Additional Interest: Rs. ${calculation.additionalInterestInr.toLocaleString('en-IN')}`,
    '   -----------------------------------------------------------------------------',
    `   TOTAL STATUTORY FAIR COMPENSATION: Rs. ${calculation.totalStatutoryCompensationInr.toLocaleString('en-IN')}`,
    `   LESS: Amount Awarded by Collector: Rs. ${calculation.collectorOfferedTotalInr.toLocaleString('en-IN')}`,
    '   -----------------------------------------------------------------------------',
    `   NET SHORTFALL / ENHANCEMENT CLAIMED: Rs. ${calculation.shortfallInr.toLocaleString('en-IN')}`,
    '',
    '--------------------------------------------------------------------------------',
    'IV. PRAYER:',
    '--------------------------------------------------------------------------------',
    'WHEREFORE, the Applicant respectfully prays that the Learned Collector be pleased to:',
    '(a) Forward and refer this Application forthwith to the Presiding Officer, Land Acquisition, Rehabilitation and Resettlement Authority (LARRA) under Section 64 of the Act within the mandatory 30-day statutory period.',
    `(b) Transmit all connected revenue records, sale deed comparables, and award files to the Hon'ble Authority for redetermination of fair market value.`,
    `(c) Direct payment of the enhanced compensation shortfall of Rs. ${calculation.shortfallInr.toLocaleString('en-IN')} with 15% statutory interest under Section 72 on excess amounts from date of possession until payment.`,
    '(d) Grant Second Schedule Rehabilitation and Resettlement package entitlements.',
    '',
    '--------------------------------------------------------------------------------',
    'V. VERIFICATION',
    '--------------------------------------------------------------------------------',
    `I, ${claimantName}, do hereby solemnly verify and declare that the contents of paragraphs I to IV are true and correct to my knowledge and belief, and no material fact has been suppressed.`,
    '',
    `Dated: ${new Date().toISOString().slice(0, 10)}`,
    `Place: ${district}`,
    '',
    '______________________________',
    'Signature / Thumb Impression of Applicant',
    '================================================================================',
  ];

  return lines.join('\n');
}
