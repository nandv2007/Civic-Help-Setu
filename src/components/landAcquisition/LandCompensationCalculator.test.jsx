import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandCompensationCalculator from './LandCompensationCalculator.jsx';

describe('LandCompensationCalculator Component (#876)', () => {
  it('renders input fields and First Schedule header', () => {
    const html = renderToStaticMarkup(
      <LandCompensationCalculator
        landArea={2}
        areaUnit="ACRES"
        circleRatePerUnit={1000000}
        averageSaleRatePerUnit={1500000}
        locationType="RURAL_NEAR"
        valueAttachedAssetsInr={200000}
        notificationDate="2022-01-01"
        awardDate="2023-01-01"
        collectorOfferedTotalInr={4000000}
      />
    );

    expect(html).toContain('First Schedule Fair Land Compensation &amp; Solatium Calculator');
    expect(html).toContain('Acquired Land Area');
    expect(html).toContain('Circle / Guidance Rate');
    expect(html).toContain('Top 2% Comparable Sale Rate');
    expect(html).toContain('Location Multiplier Category');
    expect(html).toContain('Attached Assets');
  });

  it('renders breakdown cards with 100% Solatium and shortfall badge', () => {
    const html = renderToStaticMarkup(
      <LandCompensationCalculator
        landArea={2}
        areaUnit="ACRES"
        circleRatePerUnit={1000000}
        averageSaleRatePerUnit={1500000}
        locationType="RURAL_REMOTE"
        valueAttachedAssetsInr={200000}
        notificationDate="2022-01-01"
        awardDate="2023-01-01"
        collectorOfferedTotalInr={5000000}
      />
    );

    expect(html).toContain('First Schedule Fair Compensation Breakdown');
    expect(html).toContain('Mandatory 100% Solatium (Sec 30(1))');
    expect(html).toContain('SHORTFALL OF RS.');
    expect(html).toContain('Total Statutory Fair Compensation');
  });
});
