import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TenancyDisputeDrafterModal from './TenancyDisputeDrafterModal.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/tenancyDisputeStorage.js';

describe('TenancyDisputeDrafterModal Component (#1338)', () => {
  const sampleCase = INITIAL_SAMPLE_CASES[0];

  it('renders modal with tabs for Demand Notice and Rent Authority Petition', () => {
    const html = renderToStaticMarkup(
      <TenancyDisputeDrafterModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Tenancy Legal Notice &amp; Rent Authority Drafter');
    expect(html).toContain('1. Pre-Litigation Legal Demand Notice (7 Days)');
    expect(html).toContain('2. Rent Authority Formal Petition (Sections 11 &amp; 20)');
  });

  it('renders non-automated submission legal warning notice', () => {
    const html = renderToStaticMarkup(
      <TenancyDisputeDrafterModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Non-Automated Draft Notice:');
    expect(html).toContain('CivicBridge generates this draft locally on your device');
    expect(html).toContain('This document is <strong>NOT</strong> transmitted automatically.');
  });

  it('renders generated draft content in textarea with statutory references', () => {
    const html = renderToStaticMarkup(
      <TenancyDisputeDrafterModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('LEGAL DEMAND NOTICE FOR STATUTORY REFUND OF SECURITY DEPOSIT');
    expect(html).toContain('Flat 402, Greenfield Apartments, Sector 45, Gurgaon');
    expect(html).toContain('SEVEN (7) DAYS');
  });

  it('renders copy and download action buttons', () => {
    const html = renderToStaticMarkup(
      <TenancyDisputeDrafterModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Copy Draft Text');
    expect(html).toContain('Download .txt');
    expect(html).toContain('Download .md');
  });
});
