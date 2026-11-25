import { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  PlusCircle,
  Trash2,
  Clock,
  Coins,
} from 'lucide-react';
import {
  DEDUCTION_CATEGORIES,
  auditSecurityDepositRefund,
} from '../../services/tenancyDisputeService.js';

export default function DepositDeductionsAuditorCard({
  caseData,
  onUpdateDeductions,
}) {
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('WEAR_AND_TEAR');
  const [newHasInvoice, setNewHasInvoice] = useState(false);

  if (!caseData) return null;

  const audit = auditSecurityDepositRefund(caseData);

  const handleAddDeduction = (e) => {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount || Number(newAmount) <= 0) return;

    const updated = [
      ...(caseData.deductions || []),
      {
        id: `ded-${Date.now().toString(36)}`,
        description: newDesc.trim(),
        amount: Number(newAmount),
        category: newCategory,
        hasInvoice: newHasInvoice,
      },
    ];

    onUpdateDeductions(updated);
    setNewDesc('');
    setNewAmount('');
    setNewCategory('WEAR_AND_TEAR');
    setNewHasInvoice(false);
  };

  const handleRemoveDeduction = (idx) => {
    const updated = (caseData.deductions || []).filter((_, i) => i !== idx);
    onUpdateDeductions(updated);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Coins size={20} style={{ color: '#38bdf8' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
          Security Deposit &amp; Deductions Auditor (Section 11 MTA 2021)
        </h2>
      </div>

      {/* Statutory Cap Comparison Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Monthly Rent</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            ₹{audit.monthlyRent.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            {audit.premisesType === 'commercial' ? 'Commercial (6-month cap)' : 'Residential (2-month cap)'}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Statutory Deposit Ceiling</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
            ₹{audit.maxStatutoryDeposit.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Max permitted under Sec 11(1)
          </div>
        </div>

        <div
          style={{
            background: audit.isExcessDepositCharged ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.6)',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: `1px solid ${audit.isExcessDepositCharged ? 'rgba(239, 68, 68, 0.3)' : '#334155'}`,
          }}
        >
          <div style={{ fontSize: '0.75rem', color: audit.isExcessDepositCharged ? '#fca5a5' : '#94a3b8' }}>
            Security Deposit Paid
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: audit.isExcessDepositCharged ? '#ef4444' : '#f8fafc',
            }}
          >
            ₹{audit.securityDepositPaid.toLocaleString('en-IN')}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: audit.isExcessDepositCharged ? '#ef4444' : '#22c55e',
              marginTop: '0.2rem',
            }}
          >
            {audit.isExcessDepositCharged
              ? `₹${audit.depositExcessCharged.toLocaleString('en-IN')} excess charged`
              : 'Within statutory ceiling'}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#86efac' }}>Total Claimable Balance</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e' }}>
            ₹{audit.totalClaimableSum.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '0.2rem' }}>
            Principal + Accrued Interest
          </div>
        </div>
      </div>

      {/* Statutory 30-Day Overdue Banner */}
      {audit.isRefundOverdue && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.12)',
            borderLeft: '4px solid #eab308',
            borderRadius: '0.375rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: '#fef08a',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
          }}
        >
          <Clock size={16} style={{ color: '#eab308', flexShrink: 0, marginTop: '0.15rem' }} />
          <div>
            <strong>Section 11(2) Refund Overdue:</strong> Physical possession was vacated {audit.daysSinceVacating}{' '}
            days ago ({audit.daysPastStatutoryDeadline} days past the mandatory 30-day statutory refund deadline). An
            estimated penal interest of <strong>₹{audit.statutoryInterestAccrued.toLocaleString('en-IN')}</strong> has
            accrued at pro-rata statutory rates.
          </div>
        </div>
      )}

      {/* Itemized Deductions Audit List */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem' }}>
        Itemized Landlord Deductions Audit
      </h3>

      {audit.itemizedAudit.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.5rem',
            border: '1px dashed #334155',
            color: '#94a3b8',
            fontSize: '0.875rem',
            marginBottom: '1.25rem',
          }}
        >
          No deductions logged. If your landlord withheld any portion of your deposit for painting, deep cleaning, or
          alleged damages, log them below to audit legality.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {audit.itemizedAudit.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(15, 23, 42, 0.5)',
                border: `1px solid ${item.isStatutorilyAllowed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  {item.isStatutorilyAllowed ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#4ade80',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={12} /> LAWFUL DEDUCTION
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      <ShieldAlert size={12} /> UNLAWFUL DEDUCTION
                    </span>
                  )}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                    {item.description}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.reason}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: item.isStatutorilyAllowed ? '#f8fafc' : '#ef4444',
                    }}
                  >
                    ₹{item.amount.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {item.isStatutorilyAllowed ? 'Valid expense' : 'Disputed'}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveDeduction(idx)}
                  type="button"
                  aria-label={`Remove deduction ${item.description}`}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    color: '#ef4444',
                    borderRadius: '0.375rem',
                    padding: '0.35rem',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Deduction Form */}
      <form
        onSubmit={handleAddDeduction}
        style={{
          background: 'rgba(15, 23, 42, 0.4)',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem' }}>
          + Add Deduction Item to Audit
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label htmlFor="deduction-desc" style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
              Deduction Description *
            </label>
            <input
              id="deduction-desc"
              type="text"
              required
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="e.g. Wall painting charges"
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
            <label htmlFor="deduction-amt" style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
              Amount Deducted (₹) *
            </label>
            <input
              id="deduction-amt"
              type="number"
              required
              min="1"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="e.g. 15000"
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
            <label htmlFor="deduction-cat" style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
              Classification Category *
            </label>
            <select
              id="deduction-cat"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: '0.375rem',
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              {Object.entries(DEDUCTION_CATEGORIES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={newHasInvoice}
              onChange={(e) => setNewHasInvoice(e.target.checked)}
            />
            Landlord provided official contractor tax invoice / receipt
          </label>

          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={14} /> Add Item
          </button>
        </div>
      </form>
    </div>
  );
}
