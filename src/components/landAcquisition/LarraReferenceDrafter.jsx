import { useState } from 'react';
import {
  evaluateSection64Limitation,
  draftLarraReferencePetition,
} from '../../services/landAcquisitionService.js';
import { FileText, Copy, Check, Download, ShieldCheck, Clock } from 'lucide-react';

export default function LarraReferenceDrafter({
  claimState = {},
  onClaimFieldChange,
  onSaveClaim,
}) {
  const [copied, setCopied] = useState(false);

  const limitation = evaluateSection64Limitation({
    awardDate: claimState.awardDate,
    awardNoticeServedDate: claimState.awardNoticeServedDate,
    wasPresentAtAward: Boolean(claimState.wasPresentAtAward),
  });

  const generatedPetitionText = draftLarraReferencePetition(claimState);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPetitionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadSlip = () => {
    const blob = new Blob([generatedPetitionText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LARRA_Section_64_Reference_${claimState.landDetails?.surveyNo?.replace(/\s+/g, '_') || 'Petition'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              display: 'flex',
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
              Section 64 LARRA Reference Application Generator
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Formal statutory objection addressed to District Collector for reference to the Land Acquisition Authority
            </p>
          </div>
        </div>

        {limitation.isValid && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              background: limitation.isWithinLimitation ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: limitation.isWithinLimitation ? '#22c55e' : '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <Clock size={14} />
            {limitation.isWithinLimitation
              ? `${limitation.remainingDays} Days Remaining to File Reference`
              : 'Limitation Window Expired'}
          </div>
        )}
      </div>

      {/* Case Particulars Form */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label
            htmlFor="claimant-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Claimant Full Name *
          </label>
          <input
            id="claimant-name"
            type="text"
            value={claimState.claimant?.name || ''}
            onChange={(e) =>
              onClaimFieldChange?.('claimant', {
                ...claimState.claimant,
                name: e.target.value,
              })
            }
            placeholder="e.g. Ramesh Patil"
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
            htmlFor="claimant-contact"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Contact Phone / Mobile
          </label>
          <input
            id="claimant-contact"
            type="text"
            value={claimState.claimant?.contact || ''}
            onChange={(e) =>
              onClaimFieldChange?.('claimant', {
                ...claimState.claimant,
                contact: e.target.value,
              })
            }
            placeholder="e.g. 9845012345"
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
            htmlFor="survey-no"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Survey / Khasra No. *
          </label>
          <input
            id="survey-no"
            type="text"
            value={claimState.landDetails?.surveyNo || ''}
            onChange={(e) =>
              onClaimFieldChange?.('landDetails', {
                ...claimState.landDetails,
                surveyNo: e.target.value,
              })
            }
            placeholder="e.g. Sy. No. 104/2B"
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
            htmlFor="village-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Village / Mouza *
          </label>
          <input
            id="village-name"
            type="text"
            value={claimState.landDetails?.village || ''}
            onChange={(e) =>
              onClaimFieldChange?.('landDetails', {
                ...claimState.landDetails,
                village: e.target.value,
              })
            }
            placeholder="e.g. Rampur"
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
            htmlFor="district-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            District *
          </label>
          <input
            id="district-name"
            type="text"
            value={claimState.landDetails?.district || ''}
            onChange={(e) =>
              onClaimFieldChange?.('landDetails', {
                ...claimState.landDetails,
                district: e.target.value,
              })
            }
            placeholder="e.g. Pune"
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
            htmlFor="project-name"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Project Name *
          </label>
          <input
            id="project-name"
            type="text"
            value={claimState.project?.projectName || ''}
            onChange={(e) =>
              onClaimFieldChange?.('project', {
                ...claimState.project,
                projectName: e.target.value,
              })
            }
            placeholder="e.g. Ring Road Express Highway"
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
            htmlFor="award-no"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Award Case No.
          </label>
          <input
            id="award-no"
            type="text"
            value={claimState.project?.awardNo || ''}
            onChange={(e) =>
              onClaimFieldChange?.('project', {
                ...claimState.project,
                awardNo: e.target.value,
              })
            }
            placeholder="e.g. LA/2023/45"
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
            htmlFor="acquiring-body"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Acquiring Body
          </label>
          <input
            id="acquiring-body"
            type="text"
            value={claimState.project?.acquiringBody || ''}
            onChange={(e) =>
              onClaimFieldChange?.('project', {
                ...claimState.project,
                acquiringBody: e.target.value,
              })
            }
            placeholder="e.g. NHAI / State PWD"
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

      {/* Petition Text Preview */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Section 64 Statutory Reference Petition Preview
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
              }}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Reference'}
            </button>
            <button
              type="button"
              onClick={handleDownloadSlip}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
              }}
            >
              <Download size={14} /> Download Slip
            </button>
          </div>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '260px',
            overflowY: 'auto',
            fontFamily: 'monospace',
          }}
        >
          {generatedPetitionText}
        </pre>
      </div>

      {/* Action footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onSaveClaim}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.9rem',
            padding: '0.6rem 1.25rem',
          }}
        >
          <ShieldCheck size={18} />
          Save Claim to Vault Locker
        </button>
      </div>
    </div>
  );
}
