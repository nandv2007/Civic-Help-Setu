import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TenancyCaseSummaryCard from './TenancyCaseSummaryCard.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/tenancyDisputeStorage.js';

describe('TenancyCaseSummaryCard Component (#1338)', () => {
  const sampleCase = INITIAL_SAMPLE_CASES[0];

  it('returns null when caseData is null', () => {
    const html = renderToStaticMarkup(<TenancyCaseSummaryCard caseData={null} />);
    expect(html).toBe('');
  });

  it('renders case title, premises address, landlord contact, and official status disclaimer', () => {
    const html = renderToStaticMarkup(
      <TenancyCaseSummaryCard
        caseData={sampleCase}
        onStatusChange={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onExportJson={vi.fn()}
        onExportMarkdown={vi.fn()}
        onOpenDrafter={vi.fn()}
      />
    );

    expect(html).toContain('Arbitrary Painting Deduction &amp; Water Severance Dispute');
    expect(html).toContain('Flat 402, Greenfield Apartments, Sector 45, Gurgaon');
    expect(html).toContain('Ramesh Gupta');
    expect(html).toContain('Citizen Record vs Official Status:');
    expect(html).toContain('CITIZEN TRACKER NOTICE');
    expect(html).toContain('SHA-256 SEAL VERIFIED');
  });

  it('renders action buttons for drafting notice, editing, and exports', () => {
    const html = renderToStaticMarkup(
      <TenancyCaseSummaryCard
        caseData={sampleCase}
        onStatusChange={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onExportJson={vi.fn()}
        onExportMarkdown={vi.fn()}
        onOpenDrafter={vi.fn()}
      />
    );

    expect(html).toContain('Draft Legal Notice / Rent Petition');
    expect(html).toContain('Edit Case Details');
    expect(html).toContain('JSON');
    expect(html).toContain('Markdown Dossier');
    expect(html).toContain('Delete Case');
  });
});
