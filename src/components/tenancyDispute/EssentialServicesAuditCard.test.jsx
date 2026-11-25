import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EssentialServicesAuditCard from './EssentialServicesAuditCard.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/tenancyDisputeStorage.js';

describe('EssentialServicesAuditCard Component (#1338)', () => {
  const sampleCase = INITIAL_SAMPLE_CASES[0];

  it('returns null when caseData is not provided', () => {
    const html = renderToStaticMarkup(<EssentialServicesAuditCard caseData={null} />);
    expect(html).toBe('');
  });

  it('renders Section 20 statutory description and emergency warning', () => {
    const html = renderToStaticMarkup(
      <EssentialServicesAuditCard
        caseData={sampleCase}
        onUpdateServices={vi.fn()}
      />
    );

    expect(html).toContain('Essential Services &amp; Unlawful Disconnection Auditor (Section 20 MTA 2021)');
    expect(html).toContain('EMERGENCY STATUTORY VIOLATION (Section 20):');
    expect(html).toContain('Critical life-essential utilities');
    expect(html).toContain('₹40,000');
  });

  it('renders essential services checkboxes and disconnection date input', () => {
    const html = renderToStaticMarkup(
      <EssentialServicesAuditCard
        caseData={sampleCase}
        onUpdateServices={vi.fn()}
      />
    );

    expect(html).toContain('Water Supply (Drinking &amp; Domestic)');
    expect(html).toContain('Electricity &amp; Lighting');
    expect(html).toContain('Elevator / Lift Access');
    expect(html).toContain('Date of Service Disconnection / Interruption');
    expect(html).toContain('2026-01-10');
  });
});
