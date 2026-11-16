import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandAcquisitionWorkspace from './LandAcquisitionWorkspace.jsx';

describe('LandAcquisitionWorkspace Page (#876)', () => {
  it('exports a valid React functional component', () => {
    expect(typeof LandAcquisitionWorkspace).toBe('function');
  });

  it('renders page header, statutory badges, and tab list', () => {
    const html = renderToStaticMarkup(<LandAcquisitionWorkspace />);

    expect(html).toContain('Land Acquisition Fair Compensation &amp; LARRA Reference Workspace');
    expect(html).toContain('Central Act No. 30 of 2013 (RFCTLARR)');
    expect(html).toContain('Sec. 30(1): Mandatory 100% Solatium');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Fair Compensation Calculator');
    expect(html).toContain('Rehabilitation Matrix (R&amp;R)');
    expect(html).toContain('Section 64 LARRA Drafter');
    expect(html).toContain('Evidence Checklist');
    expect(html).toContain('Saved Claims Locker');
  });

  it('renders default Compensation Calculator tab and statutory notice', () => {
    const html = renderToStaticMarkup(<LandAcquisitionWorkspace />);

    expect(html).toContain('First Schedule Fair Land Compensation &amp; Solatium Calculator');
    expect(html).toContain('Acquired Land Area');
    expect(html).toContain('Statutory Notice:');
    expect(html).toContain('Right to Fair Compensation and Transparency in Land Acquisition');
  });
});
