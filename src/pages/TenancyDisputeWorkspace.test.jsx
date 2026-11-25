import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TenancyDisputeWorkspace from './TenancyDisputeWorkspace.jsx';
import { resetToSampleTenancyCases } from '../services/tenancyDisputeStorage.js';

describe('TenancyDisputeWorkspace Page (#1338)', () => {
  beforeEach(() => {
    resetToSampleTenancyCases();
  });

  it('renders workspace title and statutory Model Tenancy Act references', () => {
    const html = renderToStaticMarkup(<TenancyDisputeWorkspace />);

    expect(html).toContain('Tenancy Security Deposit &amp; Rent Authority Redressal Workspace');
    expect(html).toContain('MODEL TENANCY ACT 2021');
    expect(html).toContain('Offline Local Vault');
    expect(html).toContain('Section 11');
    expect(html).toContain('Section 20');
  });

  it('renders sample tenancy dispute case and sub-tab navigation', () => {
    const html = renderToStaticMarkup(<TenancyDisputeWorkspace />);

    expect(html).toContain('Arbitrary Painting Deduction &amp; Water Severance Dispute');
    expect(html).toContain('1. Security Deposit &amp; Deductions Auditor (Section 11)');
    expect(html).toContain('2. Essential Services &amp; Lockout Auditor (Section 20)');
  });

  it('renders global export and storage control buttons', () => {
    const html = renderToStaticMarkup(<TenancyDisputeWorkspace />);

    expect(html).toContain('Export All Dossier (.MD)');
    expect(html).toContain('Export All (.JSON)');
    expect(html).toContain('Reset Sample Data');
    expect(html).toContain('New Case');
  });
});
