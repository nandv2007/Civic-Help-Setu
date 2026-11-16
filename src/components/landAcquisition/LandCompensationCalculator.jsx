import {
  AREA_UNITS,
  LAND_LOCATION_TYPES,
  calculateLandCompensation,
} from '../../services/landAcquisitionService.js';
import { Calculator, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

export default function LandCompensationCalculator({
  landArea,
  onLandAreaChange,
  areaUnit,
  onAreaUnitChange,
  circleRatePerUnit,
  onCircleRateChange,
  averageSaleRatePerUnit,
  onAverageSaleRateChange,
  locationType,
  onLocationTypeChange,
  valueAttachedAssetsInr,
  onAttachedAssetsChange,
  notificationDate,
  onNotificationDateChange,
  awardDate,
  onAwardDateChange,
  collectorOfferedTotalInr,
  onCollectorOfferedChange,
}) {
  const calculation = calculateLandCompensation({
    landArea,
    areaUnit,
    circleRatePerUnit,
    averageSaleRatePerUnit,
    locationType,
    valueAttachedAssetsInr,
    notificationDate,
    awardDate,
    collectorOfferedTotalInr,
  });

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, #334155)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
            display: 'flex',
          }}
        >
          <Calculator size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
            First Schedule Fair Land Compensation & Solatium Calculator
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Statutory computation under RFCTLARR Act 2013 (Market Value x Multiplier + Assets + 100% Solatium + 12% Interest)
          </p>
        </div>
      </div>

      {/* Inputs Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label
            htmlFor="calc-land-area"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Acquired Land Area *
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="calc-land-area"
              type="number"
              step="0.01"
              min="0"
              value={landArea ?? ''}
              onChange={(e) => onLandAreaChange?.(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 2.5"
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.9rem',
              }}
            />
            <select
              aria-label="Area Measurement Unit"
              value={areaUnit || 'ACRES'}
              onChange={(e) => onAreaUnitChange?.(e.target.value)}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              {Object.entries(AREA_UNITS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="calc-circle-rate"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Circle / Guidance Rate (Rs./Unit) *
          </label>
          <input
            id="calc-circle-rate"
            type="number"
            min="0"
            step="1000"
            value={circleRatePerUnit ?? ''}
            onChange={(e) => onCircleRateChange?.(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 1000000"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="calc-sale-rate"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Top 2% Comparable Sale Rate (Rs./Unit)
          </label>
          <input
            id="calc-sale-rate"
            type="number"
            min="0"
            step="1000"
            value={averageSaleRatePerUnit ?? ''}
            onChange={(e) => onAverageSaleRateChange?.(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 1500000"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="calc-location-type"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Location Multiplier Category (Sec 26(2)) *
          </label>
          <select
            id="calc-location-type"
            value={locationType || 'RURAL_NEAR'}
            onChange={(e) => onLocationTypeChange?.(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          >
            {Object.entries(LAND_LOCATION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} ({v.defaultMultiplier}x)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="calc-attached-assets"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Attached Assets (Trees, Wells, Structures) Rs.
          </label>
          <input
            id="calc-attached-assets"
            type="number"
            min="0"
            step="1000"
            value={valueAttachedAssetsInr ?? ''}
            onChange={(e) => onAttachedAssetsChange?.(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 350000"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="calc-notification-date"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Sec 11 Preliminary Notification Date
          </label>
          <input
            id="calc-notification-date"
            type="date"
            value={notificationDate || ''}
            onChange={(e) => onNotificationDateChange?.(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="calc-award-date"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Sec 23 Collector Award Date
          </label>
          <input
            id="calc-award-date"
            type="date"
            value={awardDate || ''}
            onChange={(e) => onAwardDateChange?.(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="calc-collector-offered"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Collector's Total Offered Award (Rs.)
          </label>
          <input
            id="calc-collector-offered"
            type="number"
            min="0"
            step="1000"
            value={collectorOfferedTotalInr ?? ''}
            onChange={(e) => onCollectorOfferedChange?.(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 5000000"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>
      </div>

      {/* Summary Card */}
      {calculation.isValid ? (
        <div
          style={{
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.5rem',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
              First Schedule Fair Compensation Breakdown
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: calculation.hasShortfall ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: calculation.hasShortfall ? '#ef4444' : '#22c55e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {calculation.hasShortfall ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {calculation.hasShortfall
                ? `SHORTFALL OF RS. ${calculation.shortfallInr.toLocaleString('en-IN')} (${calculation.shortfallPercentage}%)`
                : 'NO DEFICIENCY DETECTED'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Adjusted Land Market Value (x{calculation.multiplier})
              </span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary, #f8fafc)' }}>
                Rs. {calculation.adjustedMarketValueInr.toLocaleString('en-IN')}
              </strong>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Mandatory 100% Solatium (Sec 30(1))
              </span>
              <strong style={{ fontSize: '1rem', color: '#f59e0b' }}>
                Rs. {calculation.solatiumAmountInr.toLocaleString('en-IN')}
              </strong>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                12% Addl. Interest ({calculation.interestDays} Days)
              </span>
              <strong style={{ fontSize: '1rem', color: '#3b82f6' }}>
                Rs. {calculation.additionalInterestInr.toLocaleString('en-IN')}
              </strong>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Total Statutory Fair Compensation
              </span>
              <strong style={{ fontSize: '1.15rem', color: '#22c55e' }}>
                Rs. {calculation.totalStatutoryCompensationInr.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          {calculation.hasShortfall && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.85rem' }}>
              <TrendingUp size={16} />
              <span>
                Collector Award deficit of <strong>Rs. {calculation.shortfallInr.toLocaleString('en-IN')}</strong> qualifies for immediate reference to LARRA under Section 64.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem' }}>
          Enter acquired land area and applicable circle/market rate to compute statutory entitlements.
        </div>
      )}
    </div>
  );
}
