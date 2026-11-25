import {
  Droplet,
  AlertOctagon,
} from 'lucide-react';
import {
  ESSENTIAL_SERVICES,
  auditEssentialServiceSeverance,
} from '../../services/tenancyDisputeService.js';

export default function EssentialServicesAuditCard({
  caseData,
  onUpdateServices,
}) {
  if (!caseData) return null;

  const audit = auditEssentialServiceSeverance(caseData);
  const severed = caseData.severedServices || [];

  const handleToggleService = (serviceId) => {
    let next;
    if (severed.includes(serviceId)) {
      next = severed.filter((id) => id !== serviceId);
    } else {
      next = [...severed, serviceId];
    }
    onUpdateServices({
      ...caseData,
      severedServices: next,
    });
  };

  const handleDateChange = (val) => {
    onUpdateServices({
      ...caseData,
      disconnectionDate: val,
    });
  };

  const handlePoliceToggle = (val) => {
    onUpdateServices({
      ...caseData,
      hasPoliceComplaint: val,
    });
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Droplet size={20} style={{ color: '#38bdf8' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
          Essential Services &amp; Unlawful Disconnection Auditor (Section 20 MTA 2021)
        </h2>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
        Under Section 20 of the Model Tenancy Act, 2021, no landlord or property manager can sever or withhold
        essential supplies or services (water, electricity, elevator, drainage) to coerce a tenant or force an
        unlawful eviction. The Rent Authority can order immediate 24-hour reconnection and impose up to two months’
        rent as compensation.
      </p>

      {/* Emergency Alert if Critical Services are Severed */}
      {audit.hasCriticalDisconnection && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '0.375rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
          }}
        >
          <AlertOctagon size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong>EMERGENCY STATUTORY VIOLATION (Section 20):</strong> Critical life-essential utilities (drinking water /
            electricity / drainage) have been severed for {audit.daysOfDeprivation} days. This qualifies for an urgent
            ex-parte interim restoration order from the Rent Authority within 24 hours. Maximum statutory compensation
            available: <strong>₹{audit.maxStatutoryCompensation.toLocaleString('en-IN')}</strong>.
          </div>
        </div>
      )}

      {/* Services Grid Toggles */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem' }}>
        Select Severed or Withheld Services:
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        {ESSENTIAL_SERVICES.map((serv) => {
          const isSevered = severed.includes(serv.id);
          return (
            <div
              key={serv.id}
              onClick={() => handleToggleService(serv.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: isSevered ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                border: `1px solid ${isSevered ? '#ef4444' : '#334155'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={isSevered}
                onChange={() => {}} // handled by parent onClick
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: isSevered ? '#fca5a5' : '#f8fafc',
                  }}
                >
                  {serv.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: isSevered ? '#f87171' : '#64748b' }}>
                  {serv.statutoryWeight === 'critical' ? 'Critical Essential Utility' : 'Common Building Amenity'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Date & Police Entry Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          background: 'rgba(15, 23, 42, 0.4)',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #334155',
        }}
      >
        <div>
          <label
            htmlFor="disconnection-date-input"
            style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}
          >
            Date of Service Disconnection / Interruption
          </label>
          <input
            id="disconnection-date-input"
            type="date"
            value={caseData.disconnectionDate || ''}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.65rem',
              borderRadius: '0.375rem',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
            Local Police Station General Diary (GD) / DD Entry
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(caseData.hasPoliceComplaint)}
              onChange={(e) => handlePoliceToggle(e.target.checked)}
            />
            Formal police memo or daily dairy entry logged for lockout/disconnection
          </label>
        </div>
      </div>
    </div>
  );
}
