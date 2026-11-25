import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DepositDeductionsAuditorCard from './DepositDeductionsAuditorCard.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/tenancyDisputeStorage.js';

describe('DepositDeductionsAuditorCard Component (#1338)', () => {
  const sampleCase = INITIAL_SAMPLE_CASES[0];

  it('renders null when caseData is missing', () => {
    const html = renderToStaticMarkup(<DepositDeductionsAuditorCard caseData={null} />);
    expect(html).toBe('');
  });

  it('renders monthly rent, statutory cap, and deposit details', () => {
    const html = renderToStaticMarkup(
      <DepositDeductionsAuditorCard
        caseData={sampleCase}
        onUpdateDeductions={vi.fn()}
      />
    );

    expect(html).toContain('Security Deposit &amp; Deductions Auditor (Section 11 MTA 2021)');
    expect(html).toContain('₹20,000');
    expect(html).toContain('Statutory Deposit Ceiling');
    expect(html).toContain('₹40,000');
    expect(html).toContain('₹60,000');
    expect(html).toContain('₹20,000 excess charged');
  });

  it('renders itemized deductions audit breakdown and legal classification tags', () => {
    const html = renderToStaticMarkup(
      <DepositDeductionsAuditorCard
        caseData={sampleCase}
        onUpdateDeductions={vi.fn()}
      />
    );

    expect(html).toContain('Itemized Landlord Deductions Audit');
    expect(html).toContain('Repainting entire flat due to customary sun fading');
    expect(html).toContain('UNLAWFUL DEDUCTION');
    expect(html).toContain('Replacement of broken ceramic basin in hallway');
    expect(html).toContain('LAWFUL DEDUCTION');
  });

  it('renders add deduction form controls', () => {
    const html = renderToStaticMarkup(
      <DepositDeductionsAuditorCard
        caseData={sampleCase}
        onUpdateDeductions={vi.fn()}
      />
    );

    expect(html).toContain('+ Add Deduction Item to Audit');
    expect(html).toContain('Deduction Description *');
    expect(html).toContain('Amount Deducted (₹) *');
    expect(html).toContain('Classification Category *');
    expect(html).toContain('Landlord provided official contractor tax invoice / receipt');
  });
});
