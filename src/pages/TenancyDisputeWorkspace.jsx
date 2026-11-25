import { useState, useMemo } from 'react';
import {
  Scale,
  PlusCircle,
  FolderOpen,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  X,
  Home,
  Save,
} from 'lucide-react';
import {
  listTenancyCases,
  saveTenancyCase,
  deleteTenancyCase,
  resetToSampleTenancyCases,
  exportTenancyCaseJson,
  exportTenancyCaseMarkdown,
  exportAllTenancyCasesDossier,
} from '../services/tenancyDisputeStorage.js';
import TenancyCaseSummaryCard from '../components/tenancyDispute/TenancyCaseSummaryCard.jsx';
import DepositDeductionsAuditorCard from '../components/tenancyDispute/DepositDeductionsAuditorCard.jsx';
import EssentialServicesAuditCard from '../components/tenancyDispute/EssentialServicesAuditCard.jsx';
import TenancyDisputeDrafterModal from '../components/tenancyDispute/TenancyDisputeDrafterModal.jsx';

export default function TenancyDisputeWorkspace() {
  const [cases, setCases] = useState(() => listTenancyCases());
  const [activeCaseId, setActiveCaseId] = useState(() => {
    const list = listTenancyCases();
    return list.length > 0 ? list[0].id : '';
  });

  const [activeTab, setActiveTab] = useState('deposit'); // 'deposit' | 'services'
  const [isDrafterOpen, setIsDrafterOpen] = useState(false);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [notification, setNotification] = useState(null);

  // Form Fields for Case Modal
  const [title, setTitle] = useState('');
  const [premisesAddress, setPremisesAddress] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [premisesType, setPremisesType] = useState('residential');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDepositPaid, setSecurityDepositPaid] = useState('');
  const [vacationDate, setVacationDate] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantContact, setTenantContact] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [landlordContact, setLandlordContact] = useState('');

  const activeCase = useMemo(() => {
    return cases.find((c) => c.id === activeCaseId) || cases[0] || null;
  }, [cases, activeCaseId]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshCases = (newActiveId = null) => {
    const updated = listTenancyCases();
    setCases(updated);
    if (newActiveId) {
      setActiveCaseId(newActiveId);
    } else if (!updated.some((c) => c.id === activeCaseId) && updated.length > 0) {
      setActiveCaseId(updated[0].id);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (newStatus) => {
    if (!activeCase) return;
    try {
      await saveTenancyCase({
        ...activeCase,
        status: newStatus,
      });
      refreshCases();
      showNotification(`Dispute stage updated to ${newStatus}`);
    } catch (err) {
      showNotification(`Could not update status: ${err.message}`, 'error');
    }
  };

  // Update Deductions
  const handleUpdateDeductions = async (newDeductions) => {
    if (!activeCase) return;
    try {
      await saveTenancyCase({
        ...activeCase,
        deductions: newDeductions,
      });
      refreshCases();
      showNotification('Deduction items updated.');
    } catch (err) {
      showNotification(`Could not update deductions: ${err.message}`, 'error');
    }
  };

  // Update Services
  const handleUpdateServices = async (updatedCase) => {
    try {
      await saveTenancyCase(updatedCase);
      refreshCases();
      showNotification('Essential service configuration updated.');
    } catch (err) {
      showNotification(`Could not update services: ${err.message}`, 'error');
    }
  };

  // Delete Case
  const handleDeleteCase = () => {
    if (!activeCase) return;
    if (window.confirm(`Are you sure you want to delete "${activeCase.title}"?`)) {
      deleteTenancyCase(activeCase.id);
      refreshCases();
      showNotification('Tenancy case removed from vault.');
    }
  };

  // Open Edit Case Modal
  const handleOpenEditCaseModal = () => {
    if (!activeCase) return;
    setEditingCase(activeCase);
    setTitle(activeCase.title || '');
    setPremisesAddress(activeCase.premisesAddress || '');
    setJurisdiction(activeCase.jurisdiction || '');
    setPremisesType(activeCase.premisesType || 'residential');
    setMonthlyRent(String(activeCase.monthlyRent || ''));
    setSecurityDepositPaid(String(activeCase.securityDepositPaid || ''));
    setVacationDate(activeCase.vacationDate || '');
    setTenantName(activeCase.tenantName || '');
    setTenantContact(activeCase.tenantContact || '');
    setLandlordName(activeCase.landlordName || '');
    setLandlordContact(activeCase.landlordContact || '');
    setIsCaseModalOpen(true);
  };

  // Open New Case Modal
  const handleOpenNewCaseModal = () => {
    setEditingCase(null);
    setTitle('');
    setPremisesAddress('');
    setJurisdiction('');
    setPremisesType('residential');
    setMonthlyRent('');
    setSecurityDepositPaid('');
    setVacationDate(new Date().toISOString().slice(0, 10));
    setTenantName('');
    setTenantContact('');
    setLandlordName('');
    setLandlordContact('');
    setIsCaseModalOpen(true);
  };

  // Save Case Modal Form
  const handleSaveCase = async (e) => {
    e.preventDefault();
    if (!title.trim() || !monthlyRent || !securityDepositPaid) {
      showNotification('Please fill in required fields: title, rent, and deposit.', 'error');
      return;
    }

    try {
      const saved = await saveTenancyCase({
        ...(editingCase || {}),
        title: title.trim(),
        premisesAddress: premisesAddress.trim(),
        jurisdiction: jurisdiction.trim() || 'Local Sub-Division',
        premisesType,
        monthlyRent: Number(monthlyRent),
        securityDepositPaid: Number(securityDepositPaid),
        vacationDate: vacationDate || '',
        tenantName: tenantName.trim(),
        tenantContact: tenantContact.trim(),
        landlordName: landlordName.trim(),
        landlordContact: landlordContact.trim(),
        status: editingCase?.status || 'DRAFT',
        deductions: editingCase?.deductions || [],
        severedServices: editingCase?.severedServices || [],
      });

      refreshCases(saved.id);
      setIsCaseModalOpen(false);
      showNotification(editingCase ? 'Tenancy case updated.' : 'New tenancy dispute record created.');
    } catch (err) {
      showNotification(`Could not save case: ${err.message}`, 'error');
    }
  };

  // Export Handlers
  const handleExportJson = () => {
    if (!activeCase) return;
    const json = exportTenancyCaseJson(activeCase);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenancy_case_${activeCase.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported structured tenancy case JSON.');
  };

  const handleExportMarkdown = () => {
    if (!activeCase) return;
    const md = exportTenancyCaseMarkdown(activeCase);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenancy_dossier_${activeCase.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported printable Markdown dossier.');
  };

  const handleExportAllJson = () => {
    const json = JSON.stringify(cases, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenancy_all_cases_export.json';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported all cases as JSON.');
  };

  const handleExportAllDossier = () => {
    const md = exportAllTenancyCasesDossier(cases);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenancy_master_dossier.md';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported master tenancy dossier (.MD).');
  };

  const handleResetSampleData = () => {
    resetToSampleTenancyCases();
    refreshCases();
    showNotification('Reset to sample demonstrative tenancy case.');
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        color: 'var(--text-main, #f8fafc)',
      }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 10000,
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            background: notification.type === 'error' ? '#ef4444' : '#15803d',
            color: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
        >
          {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {notification.msg}
        </div>
      )}

      {/* Main Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <Scale size={13} /> MODEL TENANCY ACT 2021
            </span>
            <span
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Offline Local Vault
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.2rem 0', color: '#ffffff' }}>
            Tenancy Security Deposit &amp; Rent Authority Redressal Workspace
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0, maxWidth: '800px', lineHeight: 1.5 }}>
            Audit unlawful landlord security deposit deductions under Section 11 of the Model Tenancy Act, 2021 (capped at 2 months rent for residential premises), evaluate essential services severance under Section 20, and prepare formal petitions to the Rent Authority (SDM / Deputy Collector).
          </p>
        </div>

        {/* Global Toolbar & Case Selector */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {cases.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FolderOpen size={16} style={{ color: '#94a3b8' }} />
                <select
                  value={activeCaseId}
                  onChange={(e) => setActiveCaseId(e.target.value)}
                  aria-label="Select active tenancy dispute case"
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.85rem',
                    maxWidth: '240px',
                  }}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExportAllDossier}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={13} /> Export All Dossier (.MD)
              </button>
              <button
                onClick={handleExportAllJson}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={13} /> Export All (.JSON)
              </button>
            </>
          )}

          <button
            onClick={handleResetSampleData}
            type="button"
            title="Reset to default sample cases"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} /> Reset Sample Data
          </button>

          <button
            onClick={handleOpenNewCaseModal}
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
            <PlusCircle size={15} /> New Case
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeCase ? (
        <>
          <TenancyCaseSummaryCard
            caseData={activeCase}
            onStatusChange={handleStatusChange}
            onEditCase={handleOpenEditCaseModal}
            onDeleteCase={handleDeleteCase}
            onExportJson={handleExportJson}
            onExportMarkdown={handleExportMarkdown}
            onOpenDrafter={() => setIsDrafterOpen(true)}
          />

          {/* Sub-tab Navigation */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid var(--border-light, #334155)',
              marginBottom: '1.5rem',
            }}
          >
            <button
              onClick={() => setActiveTab('deposit')}
              type="button"
              style={{
                padding: '0.75rem 1.25rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'deposit' ? '3px solid #38bdf8' : '3px solid transparent',
                color: activeTab === 'deposit' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              1. Security Deposit &amp; Deductions Auditor (Section 11)
            </button>
            <button
              onClick={() => setActiveTab('services')}
              type="button"
              style={{
                padding: '0.75rem 1.25rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'services' ? '3px solid #38bdf8' : '3px solid transparent',
                color: activeTab === 'services' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              2. Essential Services &amp; Lockout Auditor (Section 20)
            </button>
          </div>

          {activeTab === 'deposit' ? (
            <DepositDeductionsAuditorCard
              caseData={activeCase}
              onUpdateDeductions={handleUpdateDeductions}
            />
          ) : (
            <EssentialServicesAuditCard
              caseData={activeCase}
              onUpdateServices={handleUpdateServices}
            />
          )}
        </>
      ) : (
        /* Empty Cases Screen */
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: '1rem',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <Home size={40} style={{ color: '#64748b', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>
            No Tenancy Dispute Cases in Vault
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
            Start auditing security deposit withholdings, unlawful deductions, or utility disconnections.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={handleOpenNewCaseModal}
              type="button"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create Your First Case
            </button>
            <button
              onClick={handleResetSampleData}
              type="button"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Sample Data
            </button>
          </div>
        </div>
      )}

      {/* Drafter Modal */}
      {isDrafterOpen && activeCase && (
        <TenancyDisputeDrafterModal
          caseData={activeCase}
          onClose={() => setIsDrafterOpen(false)}
        />
      )}

      {/* Create / Edit Case Modal */}
      {isCaseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-modal-title"
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
              maxWidth: '620px',
              width: '100%',
              border: '1px solid var(--border-light, #334155)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              color: 'var(--text-main, #f8fafc)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light, #334155)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 id="case-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {editingCase ? 'Edit Tenancy Case Details' : 'Record New Tenancy Dispute Case'}
              </h2>
              <button
                onClick={() => setIsCaseModalOpen(false)}
                type="button"
                aria-label="Close modal"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCase} style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Dispute Case Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Unlawful Painting Deductions & Security Deposit Non-Refund"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Agreed Monthly Rent (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="e.g. 20000"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Total Security Deposit Paid (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={securityDepositPaid}
                    onChange={(e) => setSecurityDepositPaid(e.target.value)}
                    placeholder="e.g. 60000"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Premises Classification
                  </label>
                  <select
                    value={premisesType}
                    onChange={(e) => setPremisesType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  >
                    <option value="residential">Residential (Section 11 2-Month Cap)</option>
                    <option value="commercial">Commercial (Section 11 6-Month Cap)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Vacant Handover Date
                  </label>
                  <input
                    type="date"
                    value={vacationDate}
                    onChange={(e) => setVacationDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Leased Premises Address
                </label>
                <input
                  type="text"
                  value={premisesAddress}
                  onChange={(e) => setPremisesAddress(e.target.value)}
                  placeholder="e.g. Flat 402, Greenfield Apartments, Sector 45, Gurgaon"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Landlord / Owner Name
                  </label>
                  <input
                    type="text"
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    placeholder="e.g. Ramesh Gupta"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Landlord Contact Details
                  </label>
                  <input
                    type="text"
                    value={landlordContact}
                    onChange={(e) => setLandlordContact(e.target.value)}
                    placeholder="Phone or email"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setIsCaseModalOpen(false)}
                  type="button"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Save size={15} /> {editingCase ? 'Save Changes' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
