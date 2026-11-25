import { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import {
  generateRentAuthorityPetition,
  generateLegalNoticeToLandlord,
} from '../../services/tenancyDisputeService.js';

export default function TenancyDisputeDrafterModal({
  caseData,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('notice'); // 'notice' | 'petition'
  const [tenantName, setTenantName] = useState(caseData?.tenantName || '');
  const [tenantContact, setTenantContact] = useState(caseData?.tenantContact || '');
  const [customText, setCustomText] = useState(null);
  const [copied, setCopied] = useState(false);

  const defaultDraft = useMemo(() => {
    if (!caseData) return '';
    if (activeTab === 'notice') {
      return generateLegalNoticeToLandlord(caseData, { tenantName, tenantContact });
    }
    return generateRentAuthorityPetition(caseData, { tenantName, tenantContact });
  }, [caseData, activeTab, tenantName, tenantContact]);

  const displayedText = customText !== null ? customText : defaultDraft;

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setCustomText(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownload = (format = 'txt') => {
    const filename = `${(caseData?.title || 'tenancy_dispute')
      .slice(0, 30)
      .replace(/[^a-z0-9]/gi, '_')}_${activeTab}.${format}`;
    const mime = format === 'txt' ? 'text/plain' : 'text/markdown';
    const blob = new Blob([displayedText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenancy-draft-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal, #1e293b)',
          borderRadius: '1rem',
          maxWidth: '850px',
          width: '100%',
          border: '1px solid var(--border-light, #334155)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-main, #f8fafc)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} style={{ color: '#38bdf8' }} />
            <h2
              id="tenancy-draft-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}
            >
              Tenancy Legal Notice &amp; Rent Authority Drafter
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs & Content */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Tab Selection */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid var(--border-light, #334155)',
              marginBottom: '1rem',
            }}
          >
            <button
              onClick={() => handleTabSwitch('notice')}
              type="button"
              style={{
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'notice' ? '3px solid #38bdf8' : '3px solid transparent',
                color: activeTab === 'notice' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              1. Pre-Litigation Legal Demand Notice (7 Days)
            </button>
            <button
              onClick={() => handleTabSwitch('petition')}
              type="button"
              style={{
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'petition' ? '3px solid #c084fc' : '3px solid transparent',
                color: activeTab === 'petition' ? '#c084fc' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Scale size={14} /> 2. Rent Authority Formal Petition (Sections 11 &amp; 20)
            </button>
          </div>

          {/* Non-submission Disclaimer Banner */}
          <div
            style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#fef08a',
              fontSize: '0.8rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ color: '#eab308', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <strong>Non-Automated Draft Notice:</strong> CivicBridge generates this draft locally on your device incorporating your lease details, deduction audits, and essential service proofs. This document is <strong>NOT</strong> transmitted automatically. You must review, print/sign, and deliver it to the landlord or Rent Authority registry via Speed Post, email, or physical counter.
            </div>
          </div>

          {/* Tenant Contact Customization Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.75rem',
              background: 'rgba(15, 23, 42, 0.5)',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="tenant-name-input"
                style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}
              >
                Complainant / Tenant Full Name
              </label>
              <input
                id="tenant-name-input"
                type="text"
                value={tenantName}
                onChange={(e) => {
                  setTenantName(e.target.value);
                  setCustomText(null);
                }}
                placeholder="Rahul Sharma"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.375rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="tenant-contact-input"
                style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}
              >
                Tenant Contact Address / Email / Phone
              </label>
              <input
                id="tenant-contact-input"
                type="text"
                value={tenantContact}
                onChange={(e) => {
                  setTenantContact(e.target.value);
                  setCustomText(null);
                }}
                placeholder="rahul.s@example.com / +91-9876543210"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.375rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Editable Draft Text Area */}
          <div>
            <label
              htmlFor="tenancy-draft-textarea"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                color: '#94a3b8',
                marginBottom: '0.35rem',
              }}
            >
              <span>Editable Legal Representation Text</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {customText !== null ? 'Custom Edits Applied' : 'Auto-Generated'}
              </span>
            </label>
            <textarea
              id="tenancy-draft-textarea"
              rows={16}
              value={displayedText}
              onChange={(e) => setCustomText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleDownload('txt')}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Download size={13} /> Download .txt
            </button>
            <button
              onClick={() => handleDownload('md')}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Download size={13} /> Download .md
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleCopy}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: copied ? '#15803d' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Draft Text'}
            </button>
            <button
              onClick={onClose}
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
