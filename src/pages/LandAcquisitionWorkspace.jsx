import { useState } from 'react';
import {
  saveLarrClaim,
  listLarrClaims,
  deleteLarrClaim,
  verifyClaimIntegrity,
  exportLarrDossierJson,
  exportLarrTextSlip,
} from '../services/landAcquisitionStorage.js';
import LandCompensationCalculator from '../components/landAcquisition/LandCompensationCalculator.jsx';
import RehabilitationEntitlementCard from '../components/landAcquisition/RehabilitationEntitlementCard.jsx';
import LarraReferenceDrafter from '../components/landAcquisition/LarraReferenceDrafter.jsx';
import LarrEvidenceChecklist from '../components/landAcquisition/LarrEvidenceChecklist.jsx';
import {
  Landmark,
  Calculator,
  Home,
  FileText,
  FileCheck2,
  FolderLock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export default function LandAcquisitionWorkspace() {
  const [activeTab, setActiveTab] = useState('calculator');
  const [notification, setNotification] = useState(null);

  // Claim state
  const [claimState, setClaimState] = useState({
    landArea: 2.5,
    areaUnit: 'ACRES',
    circleRatePerUnit: 1200000,
    averageSaleRatePerUnit: 1800000,
    locationType: 'RURAL_NEAR',
    customMultiplier: 1.25,
    valueAttachedAssetsInr: 350000,
    notificationDate: '2022-04-10',
    awardDate: '2023-10-15',
    collectorOfferedTotalInr: 6500000,
    paymentProtestDate: '2023-11-01',
    wasPresentAtAward: false,
    claimant: {
      name: 'Ramesh Patil',
      address: 'Plot No. 12, Bidar District, Karnataka',
      contact: '9845012345',
    },
    project: {
      projectName: 'National Highway Expansion Project',
      acquiringBody: 'National Highways Authority of India (NHAI)',
      awardNo: 'LA/NHAI/2023/102',
    },
    landDetails: {
      village: 'Humnabad Rural',
      taluk: 'Humnabad',
      district: 'Bidar',
      surveyNo: 'Sy. No. 204/1A',
    },
  });

  // Evidence checklist state
  const [checklistState, setChecklistState] = useState({
    collector_award_copy: true,
    section_11_notification: true,
    record_of_rights_ror: true,
    comparable_sale_deeds: true,
    attached_assets_valuation: false,
    award_protest_receipt: false,
  });

  // Saved claims list
  const [savedClaims, setSavedClaims] = useState(() => listLarrClaims());

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleClaimFieldChange = (field, value) => {
    setClaimState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggleChecklistItem = (itemId) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSaveClaim = () => {
    try {
      const saved = saveLarrClaim({
        ...claimState,
        evidenceChecklist: checklistState,
      });
      setSavedClaims(listLarrClaims());
      showNotification(`Claim dossier successfully sealed and saved (${saved.id.slice(0, 10)}...)`);
    } catch (err) {
      showNotification(`Failed to save claim: ${err.message}`, 'error');
    }
  };

  const handleDeleteClaim = (id) => {
    const success = deleteLarrClaim(id);
    if (success) {
      setSavedClaims(listLarrClaims());
      showNotification('Claim removed from local vault.');
    }
  };

  const handleLoadClaim = (claim) => {
    setClaimState(claim);
    if (claim.evidenceChecklist) {
      setChecklistState(claim.evidenceChecklist);
    }
    setActiveTab('drafter');
    showNotification('Loaded claim into drafter.');
  };

  const handleDownloadDossier = (claim) => {
    const json = exportLarrDossierJson(claim);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LARRA_Dossier_${claim.id || 'export'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSlip = (claim) => {
    const text = exportLarrTextSlip(claim);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LARRA_Section_64_Petition_${claim.id || 'export'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            background: notification.type === 'error' ? '#ef4444' : '#22c55e',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
              display: 'flex',
            }}
          >
            <Landmark size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 800 }}>
              Land Acquisition Fair Compensation & LARRA Reference Workspace
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
              Statutory First Schedule compensation calculator, 100% Solatium, Second Schedule R&R matrix, and Section 64 reference generator
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            Central Act No. 30 of 2013 (RFCTLARR)
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            Sec. 30(1): Mandatory 100% Solatium
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            Sec. 26(2): Up to 2.0x Rural Multiplier
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}
          >
            Sec. 64: 6-Week / 6-Month Reference Window
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Land Acquisition Workspace Tabs"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          paddingBottom: '0.5rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'calculator'}
          onClick={() => setActiveTab('calculator')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'calculator' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
            color: activeTab === 'calculator' ? '#22c55e' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'calculator' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Calculator size={16} /> Fair Compensation Calculator
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'rehabilitation'}
          onClick={() => setActiveTab('rehabilitation')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'rehabilitation' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === 'rehabilitation' ? '#3b82f6' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'rehabilitation' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <Home size={16} /> Rehabilitation Matrix (R&R)
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'drafter'}
          onClick={() => setActiveTab('drafter')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'drafter' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
            color: activeTab === 'drafter' ? '#a855f7' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'drafter' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FileText size={16} /> Section 64 LARRA Drafter
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'evidence'}
          onClick={() => setActiveTab('evidence')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'evidence' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            color: activeTab === 'evidence' ? '#f59e0b' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'evidence' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FileCheck2 size={16} /> Evidence Checklist
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'locker'}
          onClick={() => setActiveTab('locker')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: activeTab === 'locker' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: activeTab === 'locker' ? 'var(--text-primary, #f8fafc)' : 'var(--text-secondary, #94a3b8)',
            fontWeight: activeTab === 'locker' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FolderLock size={16} /> Saved Claims Locker ({savedClaims.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'calculator' && (
        <LandCompensationCalculator
          landArea={claimState.landArea}
          onLandAreaChange={(val) => handleClaimFieldChange('landArea', val)}
          areaUnit={claimState.areaUnit}
          onAreaUnitChange={(val) => handleClaimFieldChange('areaUnit', val)}
          circleRatePerUnit={claimState.circleRatePerUnit}
          onCircleRateChange={(val) => handleClaimFieldChange('circleRatePerUnit', val)}
          averageSaleRatePerUnit={claimState.averageSaleRatePerUnit}
          onAverageSaleRateChange={(val) => handleClaimFieldChange('averageSaleRatePerUnit', val)}
          locationType={claimState.locationType}
          onLocationTypeChange={(val) => handleClaimFieldChange('locationType', val)}
          valueAttachedAssetsInr={claimState.valueAttachedAssetsInr}
          onAttachedAssetsChange={(val) => handleClaimFieldChange('valueAttachedAssetsInr', val)}
          notificationDate={claimState.notificationDate}
          onNotificationDateChange={(val) => handleClaimFieldChange('notificationDate', val)}
          awardDate={claimState.awardDate}
          onAwardDateChange={(val) => handleClaimFieldChange('awardDate', val)}
          collectorOfferedTotalInr={claimState.collectorOfferedTotalInr}
          onCollectorOfferedChange={(val) => handleClaimFieldChange('collectorOfferedTotalInr', val)}
        />
      )}

      {activeTab === 'rehabilitation' && <RehabilitationEntitlementCard />}

      {activeTab === 'drafter' && (
        <LarraReferenceDrafter
          claimState={claimState}
          onClaimFieldChange={handleClaimFieldChange}
          onSaveClaim={handleSaveClaim}
        />
      )}

      {activeTab === 'evidence' && (
        <LarrEvidenceChecklist
          checklistState={checklistState}
          onToggleItem={handleToggleChecklistItem}
        />
      )}

      {activeTab === 'locker' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
            Offline Privacy Vault Locker
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            All land acquisition claims are saved locally in your browser storage (<code style={{ color: '#22c55e' }}>civicbridge_larr_claims</code>) with SHA-256 seal verification.
          </p>

          {savedClaims.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                borderRadius: '0.5rem',
                background: 'var(--bg-primary, #0f172a)',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.9rem',
              }}
            >
              No claims saved in this browser yet. Use the Section 64 Drafter tab to generate and seal your claim.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedClaims.map((item) => {
                const isIntegrityValid = verifyClaimIntegrity(item);
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-primary, #0f172a)',
                      border: '1px solid var(--border-light, #334155)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary, #f8fafc)' }}>
                          {item.project?.projectName || 'Untitled Project'}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                          }}
                        >
                          {item.landArea} {item.areaUnit} - {item.landDetails?.surveyNo || 'N/A'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            background: isIntegrityValid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isIntegrityValid ? '#22c55e' : '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {isIntegrityValid ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                          {isIntegrityValid ? 'DIGITAL SEAL VERIFIED' : 'INTEGRITY MISMATCH'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>
                        Claimant: {item.claimant?.name || 'N/A'} | Location: {item.landDetails?.village || ''}, {item.landDetails?.district || ''}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                        SHA-256: {item.digest ? `${item.digest.slice(0, 16)}...${item.digest.slice(-8)}` : 'N/A'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleLoadClaim(item)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Load Claim
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDossier(item)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Download size={13} /> JSON Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSlip(item)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Download size={13} /> Text Slip
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClaim(item.id)}
                        className="btn btn-secondary"
                        style={{ color: '#ef4444', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                        aria-label="Delete claim"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Statutory Footer Citation */}
      <div
        style={{
          marginTop: '2.5rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light, #334155)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary, #94a3b8)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Statutory Notice:</strong> This workspace enforces calculation standards under the <em>Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013 (Act No. 30 of 2013)</em>. Reference applications under Section 64 must be lodged with the Collector within the statutory limitation period (6 weeks if present at award, or 6 months if not present) for transmission to the Presiding Officer, LARRA.
      </div>
    </div>
  );
}
