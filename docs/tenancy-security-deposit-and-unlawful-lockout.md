# Tenancy Security Deposit Refund, Unlawful Lockout & Rent Authority Redressal Workspace

## 1. Statutory Background & Framework
The **Model Tenancy Act, 2021 (MTA 2021)**, drafted by the Ministry of Housing and Urban Affairs (MoHUA), Government of India, and corresponding State Tenancy / Rent Control Regulations establish clear statutory boundaries protecting tenants and landlords in urban residential and commercial premises.

Prior to this workspace, tenants frequently suffered:
- **Excessive & Delayed Security Deposits (Section 11):** Demands exceeding statutory caps and arbitrary non-refund beyond the mandated move-out date.
- **Unlawful Deductions for Customary Wear-and-Tear (Section 11(2)):** Forfeiture of deposit funds for ordinary paint fading or age-related building scuffs without actual contractor invoices.
- **Severance of Essential Services & Illegal Lockouts (Sections 15, 20 & 21):** Extortionate disconnection of drinking water, electricity, or lift access to force an eviction without an order from the Rent Court.

This workspace provides an offline, client-side audit engine and statutory representation drafter for tenants and citizen advocates.

---

## 2. Core Capabilities

### 2.1 Security Deposit & Deductions Auditor (Section 11 MTA 2021)
- **Statutory Deposit Caps:**
  - Residential Premises: Maximum **2 months' rent** (Section 11(1)).
  - Non-Residential / Commercial Premises: Maximum **6 months' rent**.
- **Lawful vs. Prohibited Deductions:**
  - *Prohibited:* Normal wear-and-tear, customary aging, general repaint surcharges, and arbitrary lump-sum cleaning fees.
  - *Permissible:* Documented structural damage caused by tenant negligence and unpaid utility bills, strictly contingent upon contractor invoices/bills.
- **30-Day Overdue & Statutory Interest:**
  - Evaluates days elapsed since vacant possession handover. If deposit is withheld beyond 30 days, calculates statutory pro-rata interest.

### 2.2 Essential Services & Lockout Auditor (Section 20 & 21 MTA 2021)
- **Prohibition on Severing Essential Services (Section 20):**
  - Audits illegal cutoffs across drinking water, electricity, lift access, sanitation/drainage, and parking access.
  - Flags emergency violations requiring 24-hour ex-parte interim restoration from the Rent Authority.
  - Calculates statutory compensation up to **two months' rent** under Section 20(4).

### 2.3 Non-Automated Legal Representation Drafter
- Generates tailored, editable legal drafts:
  1. **Pre-Litigation Legal Demand Notice:** Grants a 7-day cure window to the landlord to refund the withheld deposit and restore utilities before invoking the Rent Court.
  2. **Section 11/20/30 Formal Rent Authority Petition:** Formatted for the Sub-Divisional Magistrate (SDM) / Deputy Collector serving as the Rent Authority.
- Supports `.txt` and `.md` exports and one-click clipboard copying.

### 2.4 Privacy, Offline Storage & Cryptographic Verification
- Data stored locally under `civicbridge_tenancy_cases_v1` and `civicbridge_tenancy_settings_v1`.
- Fully integrated with CivicBridge's **Clear My Data** framework (`category: 'drafts'`).
- Deterministic SHA-256 seal computation (`computeTenancyCaseDigest`) and verification (`verifyTenancyCaseIntegrity`).

---

## 3. Storage Keys & Routes

| Key | Layer | Purpose |
|---|---|---|
| `civicbridge_tenancy_cases_v1` | LocalStorage / Memory | Stored tenancy disputes, deduction audits, severed services, and SHA-256 digests |
| `civicbridge_tenancy_settings_v1` | LocalStorage / Memory | Local user preferences and jurisdiction defaults |

### Routes:
- `/tenancy-dispute-workspace` (Main workspace entry point)
- `/tenancy-deposit-redressal` (Direct alias)
- `/tenant-rights-audit` (Direct alias)
