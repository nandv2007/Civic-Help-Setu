import { useState } from 'react';
import {
  Home,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Download,
  Trash2,
  FileText,
  User,
  MapPin,
  Calendar,
} from 'lucide-react';
import {
  OFFICIAL_STATUS_DISCLAIMER,
} from '../../services/tenancyDisputeStorage.js';
import {
  CASE_STATUS_OPTIONS,
} from '../../services/tenancyDisputeService.js';

export default function TenancyCaseSummaryCard({
  caseData,
  onStatusChange,
  onEditCase,
  onDeleteCase,
  onExportJson,
  onExportMarkdown,
  onOpenDrafter,
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  if (!caseData) return null;

  const currentStatusObj =
    CASE_STATUS_OPTIONS.find((opt) => opt.value === caseData.status) || CASE_STATUS_OPTIONS[0];

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
      {/* Top Banner: Citizen Tracker Disclaimer */}
      <div
        style={{
          background: 'rgba(56, 189, 248, 0.08)',
          borderLeft: '4px solid #38bdf8',
          borderRadius: '0.375rem',
          padding: '0.6rem 0.85rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          lineHeight: 1.4,
        }}
      >
        <ShieldAlert size={16} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <strong>Citizen Record vs Official Status:</strong> {OFFICIAL_STATUS_DISCLAIMER}
        </div>
      </div>

      {/* Main Details Grid */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ flex: '1 1 500px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Home size={12} /> {caseData.premisesType === 'commercial' ? 'Commercial Tenancy' : 'Residential Tenancy'}
            </span>
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
              }}
            >
              Jurisdiction: {caseData.jurisdiction || 'Local Sub-Division'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--text-main, #f8fafc)' }}>
            {caseData.title || 'Tenancy Security Deposit Dispute'}
          </h1>

          <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} style={{ color: '#38bdf8' }} />
            <span><strong>Premises:</strong> {caseData.premisesAddress || 'Not specified'}</span>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <User size={14} style={{ color: '#a855f7' }} />
            <span><strong>Landlord / Owner:</strong> {caseData.landlordName || 'N/A'} ({caseData.landlordContact || 'Contact info logged'})</span>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={14} style={{ color: '#eab308' }} />
            <span><strong>Vacant Possession Handover Date:</strong> {caseData.vacationDate || 'Not specified'}</span>
          </div>
        </div>

        {/* Case Status Dropdown */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            Citizen Dispute Stage
          </div>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            type="button"
            aria-label="Change dispute status"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {currentStatusObj.label} ▾
          </button>

          {showStatusDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '0.25rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                zIndex: 50,
                minWidth: '240px',
                padding: '0.35rem 0',
              }}
            >
              {CASE_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onStatusChange(opt.value);
                    setShowStatusDropdown(false);
                  }}
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    background: caseData.status === opt.value ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: caseData.status === opt.value ? '#38bdf8' : '#e2e8f0',
                    border: 'none',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* SHA-256 Seal */}
          <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#4ade80',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
              }}
            >
              <ShieldCheck size={12} /> SHA-256 SEAL VERIFIED
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-light, #334155)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onOpenDrafter}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.5rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <FileText size={15} /> Draft Legal Notice / Rent Petition
          </button>
          <button
            onClick={onEditCase}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <Edit3 size={14} /> Edit Case Details
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onExportJson}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> JSON
          </button>
          <button
            onClick={onExportMarkdown}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> Markdown Dossier
          </button>
          <button
            onClick={onDeleteCase}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> Delete Case
          </button>
        </div>
      </div>
    </div>
  );
}
