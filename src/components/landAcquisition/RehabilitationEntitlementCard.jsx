import { useState } from 'react';
import { MANDATORY_RR_PROVISIONS } from '../../services/landAcquisitionService.js';
import { Home, CheckSquare, Square, Gift } from 'lucide-react';

export default function RehabilitationEntitlementCard() {
  const [selectedProvisions, setSelectedProvisions] = useState(() =>
    MANDATORY_RR_PROVISIONS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );

  const toggleProvision = (id) => {
    setSelectedProvisions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const totalMonetaryValue = MANDATORY_RR_PROVISIONS.filter(
    (p) => selectedProvisions[p.id]
  ).reduce((sum, p) => sum + p.defaultMonetaryValue, 0);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              display: 'flex',
            }}
          >
            <Home size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
              Second Schedule Mandatory Rehabilitation & Resettlement (R&R) Matrix
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Statutory family entitlements under RFCTLARR Act 2013 in addition to land compensation
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>
            Estimated Package Value
          </span>
          <strong style={{ fontSize: '1.15rem', color: '#3b82f6' }}>
            Rs. {totalMonetaryValue.toLocaleString('en-IN')}
          </strong>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {MANDATORY_RR_PROVISIONS.map((item) => {
          const isSelected = Boolean(selectedProvisions[item.id]);
          return (
            <div
              key={item.id}
              onClick={() => toggleProvision(item.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                borderRadius: '0.5rem',
                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary, #0f172a)',
                border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-light, #334155)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ marginTop: '0.15rem', color: isSelected ? '#3b82f6' : 'var(--text-secondary, #94a3b8)' }}>
                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '0.25rem',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                    }}
                  >
                    Rs. {item.defaultMonetaryValue.toLocaleString('en-IN')} Value
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  {item.description}
                </p>
                <span style={{ fontSize: '0.7rem', color: '#a855f7', marginTop: '0.2rem', display: 'inline-block' }}>
                  {item.statutoryRef}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
        <Gift size={15} color="#22c55e" />
        <span>R&R benefits are non-waivable and apply to all affected agrarian and displaced rural families.</span>
      </div>
    </div>
  );
}
