/**
 * @file tenancyDisputeService.js
 * @description Core statutory calculation and legal petition drafting engine for tenancy disputes under
 * the Model Tenancy Act, 2021 (MTA 2021) and State Rent Control Acts.
 */

export const MTA_SECTIONS = {
  TENANCY_AGREEMENT: 'Section 4 - Mandatory Tenancy Agreement in Writing',
  SECURITY_DEPOSIT: 'Section 11 - Security Deposit Limits and 30-Day Refund Rule',
  ENTRY_NOTICE: 'Section 15 - 24-Hour Notice for Landlord Entry (7 AM to 8 PM)',
  ESSENTIAL_SERVICES: 'Section 20 - Prohibition on Severing Essential Services',
  EVICTION_REMEDY: 'Section 21 - Protection Against Unlawful Eviction and Lockout',
  RENT_AUTHORITY: 'Section 30 - Rent Authority Adjudication and Powers',
};

export const ESSENTIAL_SERVICES = [
  { id: 'water', label: 'Water Supply (Drinking & Domestic)', statutoryWeight: 'critical' },
  { id: 'electricity', label: 'Electricity & Lighting', statutoryWeight: 'critical' },
  { id: 'elevator', label: 'Elevator / Lift Access', statutoryWeight: 'high' },
  { id: 'sanitation', label: 'Sanitation, Drainage & Sewage Clearance', statutoryWeight: 'critical' },
  { id: 'staircase_lights', label: 'Common Staircase & Corridor Lighting', statutoryWeight: 'medium' },
  { id: 'parking', label: 'Designated Parking Access', statutoryWeight: 'medium' },
  { id: 'security', label: 'Main Gate Access & Security Entry', statutoryWeight: 'high' },
];

export const DEDUCTION_CATEGORIES = {
  WEAR_AND_TEAR: {
    id: 'wear_and_tear',
    label: 'Normal Wear and Tear (Faded paint, minor scuffs, customary aging)',
    isStatutorilyAllowed: false,
    explanation: 'Section 11(2) prohibits deductions for customary aging and ordinary wear and tear.',
  },
  STRUCTURAL_DAMAGE: {
    id: 'structural_damage',
    label: 'Actual Tenant-Caused Damage (Broken fixtures, shattered glass, gouged doors)',
    isStatutorilyAllowed: true,
    requiresProof: true,
    explanation: 'Permissible only when accompanied by actual contractor estimates or purchase receipts.',
  },
  UNPAID_UTILITIES: {
    id: 'unpaid_utilities',
    label: 'Pending Utility Bills (Electricity, water, gas consumed during tenancy)',
    isStatutorilyAllowed: true,
    requiresProof: true,
    explanation: 'Permissible only up to the exact invoiced utility amount for the occupancy period.',
  },
  UNPAID_RENT: {
    id: 'unpaid_rent',
    label: 'Arrears of Agreed Rent',
    isStatutorilyAllowed: true,
    requiresProof: true,
    explanation: 'Permissible up to the unpaid rent balance for the notice/occupancy period.',
  },
  ARBITRARY_PENALTY: {
    id: 'arbitrary_penalty',
    label: 'Arbitrary Painting/Deep-Cleaning Flat Surcharge without invoice',
    isStatutorilyAllowed: false,
    explanation: 'Flat percentage or arbitrary forfeiture is unlawful unless specifically invoiced for tenant negligence.',
  },
};

export const RENT_AUTHORITIES = {
  RENT_AUTHORITY: 'Rent Authority (Deputy Collector / SDM)',
  RENT_COURT: 'Rent Court (Additional District Magistrate / Civil Sub-Judge)',
  RENT_TRIBUNAL: 'Rent Tribunal (District Judge / Principal Appellate Court)',
};

export const CASE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: '1. Internal Audit (Draft)' },
  { value: 'NOTICE_ISSUED', label: '2. 7-Day Demand Notice Dispatched' },
  { value: 'RENT_AUTHORITY_FILED', label: '3. Rent Authority Petition Filed' },
  { value: 'ORDER_PASSED', label: '4. Interim / Final Order Passed' },
  { value: 'RESOLVED', label: '5. Resolved & Deposit Refunded' },
];

export const TENANCY_LEGAL_DISCLAIMER =
  'CITIZEN ADVISORY & STATUTORY NOTICE: This calculation and draft are prepared locally for citizen advocacy under the Model Tenancy Act, 2021. Generating this document does not constitute formal legal representation or automatic filing. The petition must be physically or digitally submitted before the competent Rent Authority or Rent Court having local jurisdiction.';

/**
 * Evaluates security deposit compliance against statutory caps and computes illegal deductions and interest.
 *
 * @param {Object} data
 * @param {number} data.monthlyRent - Monthly rent in INR
 * @param {number} data.securityDepositPaid - Total deposit paid in INR
 * @param {string} [data.premisesType='residential'] - 'residential' | 'commercial'
 * @param {string} data.vacationDate - Date of vacating premises (YYYY-MM-DD)
 * @param {Array<{ description: string, amount: number, category: string, hasInvoice: boolean }>} [data.deductions=[]]
 * @param {number} [data.currentDateDays] - Optional reference timestamp for testing
 * @returns {Object} Comprehensive audit breakdown
 */
export function auditSecurityDepositRefund(data) {
  const {
    monthlyRent = 0,
    securityDepositPaid = 0,
    premisesType = 'residential',
    vacationDate = '',
    deductions = [],
  } = data || {};

  const rent = Math.max(0, Number(monthlyRent) || 0);
  const depositPaid = Math.max(0, Number(securityDepositPaid) || 0);

  // Section 11(1) Cap: Max 2 months for residential, 6 months for non-residential
  const maxAllowedMonths = premisesType === 'commercial' ? 6 : 2;
  const maxStatutoryDeposit = rent * maxAllowedMonths;
  const depositExcessCharged = Math.max(0, depositPaid - maxStatutoryDeposit);

  // Calculate Allowed vs Unlawful Deductions
  let validDeductionsTotal = 0;
  let unlawfulDeductionsTotal = 0;
  const itemizedAudit = deductions.map((item, idx) => {
    const amt = Math.max(0, Number(item.amount) || 0);
    const cat = DEDUCTION_CATEGORIES[item.category] || DEDUCTION_CATEGORIES.ARBITRARY_PENALTY;
    const isAllowed = cat.isStatutorilyAllowed && (!cat.requiresProof || Boolean(item.hasInvoice));

    if (isAllowed) {
      validDeductionsTotal += amt;
    } else {
      unlawfulDeductionsTotal += amt;
    }

    return {
      id: `ded-${idx + 1}`,
      description: item.description || `Deduction item ${idx + 1}`,
      amount: amt,
      category: item.category,
      categoryLabel: cat.label,
      isStatutorilyAllowed: isAllowed,
      reason: isAllowed
        ? 'Lawfully deductible with valid documentation'
        : !cat.isStatutorilyAllowed
        ? 'Prohibited: Normal wear & tear or arbitrary forfeiture'
        : 'Disallowed: Mandatory contractor invoice/receipt missing',
    };
  });

  const legitimateRefundDue = Math.max(0, depositPaid - validDeductionsTotal);

  // Calculate Delayed Days past 30 days of vacation
  let daysSinceVacating = 0;
  let daysPastStatutoryDeadline = 0;
  let isRefundOverdue = false;
  let statutoryInterestAccrued = 0;

  if (vacationDate) {
    const vacParts = vacationDate.split('-').map(Number);
    if (vacParts.length === 3) {
      const vacDays = Math.floor(Date.UTC(vacParts[0], vacParts[1] - 1, vacParts[2]) / 86400000);
      const now = new Date();
      const currentDays = Math.floor(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
      );
      daysSinceVacating = Math.max(0, currentDays - vacDays);
      daysPastStatutoryDeadline = Math.max(0, daysSinceVacating - 30);
      isRefundOverdue = daysPastStatutoryDeadline > 0;

      // Statutory interest rate: Standard bank rate + 2% p.a. (assumed ~8% p.a. pro-rata)
      if (isRefundOverdue && legitimateRefundDue > 0) {
        const annualRate = 0.08;
        statutoryInterestAccrued = Math.round(
          legitimateRefundDue * annualRate * (daysPastStatutoryDeadline / 365)
        );
      }
    }
  }

  const totalClaimableSum = legitimateRefundDue + statutoryInterestAccrued;

  return {
    monthlyRent: rent,
    securityDepositPaid: depositPaid,
    premisesType,
    maxStatutoryDeposit,
    depositExcessCharged,
    isExcessDepositCharged: depositExcessCharged > 0,
    validDeductionsTotal,
    unlawfulDeductionsTotal,
    legitimateRefundDue,
    daysSinceVacating,
    daysPastStatutoryDeadline,
    isRefundOverdue,
    statutoryInterestAccrued,
    totalClaimableSum,
    itemizedAudit,
    statutoryReference: MTA_SECTIONS.SECURITY_DEPOSIT,
  };
}

/**
 * Audits essential services severance under Section 20 of MTA 2021.
 *
 * @param {Object} data
 * @param {Array<string>} data.severedServices - Array of service IDs
 * @param {string} data.disconnectionDate - Date when severed (YYYY-MM-DD)
 * @param {number} data.monthlyRent - Rent in INR for interim penalty computation
 * @param {boolean} data.hasPoliceComplaint - Whether a local DD / GD entry was lodged
 * @returns {Object} Severance audit result
 */
export function auditEssentialServiceSeverance(data) {
  const {
    severedServices = [],
    disconnectionDate = '',
    monthlyRent = 0,
    hasPoliceComplaint = false,
  } = data || {};

  const rent = Math.max(0, Number(monthlyRent) || 0);
  const severedList = severedServices.map((id) => {
    const meta = ESSENTIAL_SERVICES.find((s) => s.id === id) || {
      id,
      label: id,
      statutoryWeight: 'high',
    };
    return meta;
  });

  const hasCriticalDisconnection = severedList.some((s) => s.statutoryWeight === 'critical');
  const isViolatingSection20 = severedList.length > 0;

  // Under Section 20(4), Rent Authority can award up to two months' rent as compensation
  const maxStatutoryCompensation = isViolatingSection20 ? rent * 2 : 0;

  let daysOfDeprivation = 0;
  if (disconnectionDate) {
    const dParts = disconnectionDate.split('-').map(Number);
    if (dParts.length === 3) {
      const dDays = Math.floor(Date.UTC(dParts[0], dParts[1] - 1, dParts[2]) / 86400000);
      const now = new Date();
      const currentDays = Math.floor(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
      );
      daysOfDeprivation = Math.max(0, currentDays - dDays);
    }
  }

  return {
    isViolatingSection20,
    hasCriticalDisconnection,
    severedList,
    daysOfDeprivation,
    maxStatutoryCompensation,
    hasPoliceComplaint,
    statutoryReference: MTA_SECTIONS.ESSENTIAL_SERVICES,
    urgencyLevel: hasCriticalDisconnection ? 'EMERGENCY_24_HR' : isViolatingSection20 ? 'HIGH_PRIORITY' : 'NONE',
  };
}

/**
 * Formats a formal petition to the Rent Authority under Sections 20, 21, and 30 of the Model Tenancy Act, 2021.
 *
 * @param {Object} caseData
 * @param {Object} [options]
 * @returns {string} Formatted petition text
 */
export function generateRentAuthorityPetition(caseData, options = {}) {
  const petitioner = options.tenantName || caseData.tenantName || '[Tenant Full Name]';
  const tenantContact = options.tenantContact || caseData.tenantContact || '[Tenant Phone/Email]';
  const respondent = caseData.landlordName || '[Landlord / Property Owner Full Name]';
  const landlordContact = caseData.landlordContact || '[Landlord Phone/Email/Address]';
  const premises = caseData.premisesAddress || '[Full Address of Leased Residential/Commercial Premises]';
  const rentAuthorityLocation = caseData.jurisdiction || '[District / Sub-Division Name]';

  const depositAudit = auditSecurityDepositRefund(caseData);
  const serviceAudit = auditEssentialServiceSeverance(caseData);

  const lines = [
    `BEFORE THE HON'BLE RENT AUTHORITY / SUB-DIVISIONAL MAGISTRATE`,
    `AT: ${rentAuthorityLocation.toUpperCase()}`,
    `================================================================`,
    `PETITION UNDER SECTIONS 11, 20, AND 30 OF THE MODEL TENANCY ACT, 2021`,
    ``,
    `IN THE MATTER OF:`,
    `${petitioner}`,
    `Contact: ${tenantContact}`,
    `... PETITIONER / AGGRIEVED TENANT`,
    ``,
    `VERSUS`,
    ``,
    `${respondent}`,
    `Address: ${landlordContact}`,
    `... RESPONDENT / LANDLORD`,
    ``,
    `SUBJECT: APPLICATION FOR STATUTORY REFUND OF WITHHELD SECURITY DEPOSIT, RESTORATION OF ESSENTIAL SERVICES, AND DAMAGES UNDER SECTION 20(4) OF THE MODEL TENANCY ACT, 2021`,
    ``,
    `MOST RESPECTFULLY SHOWETH:`,
    ``,
    `1. PREMISES & TENANCY BACKGROUND:`,
    `   (a) The Petitioner was the lawful tenant in respect of premises situated at: ${premises}.`,
    `   (b) Agreed Monthly Rent: ₹${depositAudit.monthlyRent.toLocaleString('en-IN')}/- per month.`,
    `   (c) Total Security Deposit Paid to Respondent: ₹${depositAudit.securityDepositPaid.toLocaleString('en-IN')}/-.`,
    `   (d) Date of Vacant Physical Possession Handover: ${caseData.vacationDate || '[Date]'}.`,
    ``,
  ];

  // Section on Security Deposit Non-Refund
  lines.push(`2. STATUTORY VIOLATION REGARDING SECURITY DEPOSIT (SECTION 11):`);
  lines.push(`   (a) Under Section 11(1) of the Model Tenancy Act, 2021, the maximum permissible security deposit for residential premises is capped at two months' rent (₹${depositAudit.maxStatutoryDeposit.toLocaleString('en-IN')}/-).`);
  if (depositAudit.depositExcessCharged > 0) {
    lines.push(`   (b) The Respondent unlawfully demanded and collected an excess deposit of ₹${depositAudit.depositExcessCharged.toLocaleString('en-IN')}/-.`);
  }
  lines.push(`   (c) Section 11(2) mandates that the security deposit shall be refunded on the date of vacating the premises. The Respondent has failed to refund the deposit despite ${depositAudit.daysSinceVacating} days having elapsed.`);
  lines.push(`   (d) Arbitrary & Unlawful Deductions Disputed: ₹${depositAudit.unlawfulDeductionsTotal.toLocaleString('en-IN')}/- deducted without contractor invoices or for ordinary wear-and-tear prohibited by law.`);
  lines.push(`   (e) Legitimate Principal Balance Payable: ₹${depositAudit.legitimateRefundDue.toLocaleString('en-IN')}/- along with accrued statutory interest of ₹${depositAudit.statutoryInterestAccrued.toLocaleString('en-IN')}/-. Total Claimable: ₹${depositAudit.totalClaimableSum.toLocaleString('en-IN')}/-.`);
  lines.push(``);

  // Section on Essential Services Severance
  if (serviceAudit.isViolatingSection20) {
    lines.push(`3. UNLAWFUL SEVERANCE OF ESSENTIAL SERVICES (SECTION 20):`);
    lines.push(`   (a) The Respondent unlawfully disconnected or severed the following essential services: ${serviceAudit.severedList.map((s) => s.label).join(', ')}.`);
    lines.push(`   (b) The Petitioner has suffered ${serviceAudit.daysOfDeprivation} days of essential service deprivation, causing grave hardship and violating Section 20(1).`);
    lines.push(`   (c) Under Section 20(4), the Hon'ble Rent Authority is empowered to direct immediate reconnection and award statutory compensation up to two months' rent (₹${serviceAudit.maxStatutoryCompensation.toLocaleString('en-IN')}/-).`);
    lines.push(``);
  }

  // Prayer
  lines.push(`4. PRAYER:`);
  lines.push(`   Wherefore, in light of the above facts and statutory provisions, the Petitioner prays that this Hon'ble Authority may be pleased to:`);
  lines.push(`   (a) Direct the Respondent to forthwith refund the principal security deposit balance of ₹${depositAudit.legitimateRefundDue.toLocaleString('en-IN')}/- together with penal interest;`);
  if (serviceAudit.isViolatingSection20) {
    lines.push(`   (b) Pass an immediate ex-parte interim order directing the Respondent/utility provider to restore disconnected essential supplies within 24 hours;`);
    lines.push(`   (c) Direct the Respondent to pay compensation of ₹${serviceAudit.maxStatutoryCompensation.toLocaleString('en-IN')}/- under Section 20(4);`);
  }
  lines.push(`   (d) Impose appropriate statutory penalties under Section 30 of the Model Tenancy Act, 2021;`);
  lines.push(`   (e) Pass any such further orders as deemed just and proper in the interest of justice.`);
  lines.push(``);
  lines.push(`Date: ${new Date().toLocaleDateString('en-IN')}`);
  lines.push(`Place: ${rentAuthorityLocation}`);
  lines.push(``);
  lines.push(`PETITIONER`);
  lines.push(`${petitioner}`);
  lines.push(``);
  lines.push(`----------------------------------------------------------------`);
  lines.push(`[${TENANCY_LEGAL_DISCLAIMER}]`);

  return lines.join('\n');
}

/**
 * Generates a formal Pre-Litigation Legal Demand Notice to the Landlord.
 *
 * @param {Object} caseData
 * @param {Object} [options]
 * @returns {string} Formatted legal notice
 */
export function generateLegalNoticeToLandlord(caseData, options = {}) {
  const petitioner = options.tenantName || caseData.tenantName || '[Tenant Full Name]';
  const respondent = caseData.landlordName || '[Landlord Full Name]';
  const premises = caseData.premisesAddress || '[Leased Premises Address]';
  const depositAudit = auditSecurityDepositRefund(caseData);

  return [
    `LEGAL DEMAND NOTICE FOR STATUTORY REFUND OF SECURITY DEPOSIT`,
    `DISPATCHED VIA REGISTERED SPEED POST / EMAIL`,
    `============================================================`,
    `Date: ${new Date().toLocaleDateString('en-IN')}`,
    ``,
    `To,`,
    `${respondent}`,
    `${caseData.landlordContact || '[Landlord Contact Address]'}`,
    ``,
    `From,`,
    `${petitioner}`,
    `Former Tenant of: ${premises}`,
    `Contact: ${options.tenantContact || caseData.tenantContact || '[Contact Info]'}`,
    ``,
    `SUBJECT: FINAL STATUTORY DEMAND NOTICE UNDER SECTION 11 AND 20 OF THE MODEL TENANCY ACT, 2021 FOR REFUND OF SECURITY DEPOSIT AMOUNTING TO ₹${depositAudit.totalClaimableSum.toLocaleString('en-IN')}/-`,
    ``,
    `Sir/Madam,`,
    ``,
    `Under instructions from my self-represented capacity as your former tenant of the above-mentioned premises, I hereby give you this final statutory notice:`,
    ``,
    `1. That I lawfully occupied the premises at ${premises} and handed over vacant physical possession thereof on ${caseData.vacationDate || '[Date]'} after clearing all due utility bills.`,
    ``,
    `2. That at the inception of tenancy, you collected a security deposit of ₹${depositAudit.securityDepositPaid.toLocaleString('en-IN')}/-. Under Section 11(1) of the Model Tenancy Act, 2021, the maximum permitted deposit is 2 months' rent (₹${depositAudit.maxStatutoryDeposit.toLocaleString('en-IN')}/-).`,
    ``,
    `3. Under Section 11(2) of the Act, you are legally bound to refund the security deposit on the date of vacating the premises. More than 30 days have elapsed, and your continued retention of ₹${depositAudit.legitimateRefundDue.toLocaleString('en-IN')}/- without providing valid contractor invoices for normal wear-and-tear constitutes an illegal act.`,
    ``,
    `4. You are hereby called upon to transfer the full claimable sum of ₹${depositAudit.totalClaimableSum.toLocaleString('en-IN')}/- (including principal and accrued statutory interest) to my bank account within SEVEN (7) DAYS of receipt of this notice.`,
    ``,
    `5. Take notice that if you fail to refund the said amount within the stipulated 7 days, I shall be constrained to initiate formal legal proceedings before the Hon'ble Rent Authority / Rent Court under Sections 20, 21, and 30 of the Model Tenancy Act, 2021, holding you liable for all legal costs, interest, and damages.`,
    ``,
    `Yours faithfully,`,
    ``,
    `${petitioner}`,
    ``,
    `----------------------------------------------------------------`,
    `[${TENANCY_LEGAL_DISCLAIMER}]`,
  ].join('\n');
}

/**
 * Sanitizes a case record for privacy-preserving export under DPDP Act 2023.
 *
 * @param {Object} caseData
 * @returns {Object} Sanitized copy
 */
export function sanitizeTenancyCase(caseData) {
  if (!caseData || typeof caseData !== 'object') return {};
  return {
    ...caseData,
    tenantName: caseData.tenantName ? `${caseData.tenantName.slice(0, 2)}***` : 'Protected Citizen',
    tenantContact: caseData.tenantContact ? 'REDACTED_CONTACT' : '',
    landlordName: caseData.landlordName ? `${caseData.landlordName.slice(0, 2)}***` : 'Landlord',
    landlordContact: 'REDACTED_FOR_EXPORT',
  };
}
