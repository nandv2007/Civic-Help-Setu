# Land Acquisition Fair Compensation & Section 64 LARRA Reference Workspace (#876)

## 1. Statutory Background & Objectives

Under the **Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013 (Central Act No. 30 of 2013 - RFCTLARR Act)**, landholders and agrarian families whose lands are compulsorily acquired for public projects are statutorily entitled to fair market value, rural multipliers, mandatory 100% solatium, and comprehensive Rehabilitation and Resettlement (R&R) packages.

Prior to #876, citizens facing compulsory land acquisition possessed no interactive tool to calculate statutory entitlements under the First Schedule, verify Second Schedule R&R entitlements, or draft formal applications to the District Collector requiring reference to the **Land Acquisition, Rehabilitation and Resettlement Authority (LARRA)** under Section 64.

This workspace introduces:
1. **Deterministic First Schedule Compensation Engine:** Evaluates Section 26 base market rates (circle rates vs top 2% comparable sales vs consortium rate), applies Section 26(2) rural multipliers (1.00x to 2.00x), computes mandatory 100% Solatium under Section 30(1), and calculates Section 30(3) 12% additional annual interest.
2. **Second Schedule Mandatory R&R Matrix:** Evaluates family entitlements including constructed housing, one-time resettlement allowance (₹50,000), 12-month subsistence grant (₹36,000), and employment/annuity preferences.
3. **Section 64 LARRA Reference Drafter:** Generates court-ready objection petitions addressed to the District Collector for transmission to the Presiding Officer, LARRA, tracking the statutory 6-week / 6-month limitation window.
4. **Client-Side Cryptographic Vault (`civicbridge_larr_claims`):** Offline persistence with DPDP-compliant PII scrubbing (`minimizeForExternal`) and canonical SHA-256 digital seals.

---

## 2. Mathematical & Statutory Calculation Models

### 2.1 Base Market Value Determination (Section 26(1))
$$\text{Base Rate} = \max\left(\text{Circle Guidance Rate}, \text{Average Top 2\% Sales}, \text{Agreed Consortium Rate}\right)$$

### 2.2 Adjusted Market Value & Rural Multiplier (Section 26(2))
$$\text{Adjusted Market Value} = \text{Land Area} \times \text{Base Rate} \times \text{Multiplier Factor}$$
Where Multiplier Factor ranges from:
- $1.00\times$ for urban municipal areas.
- $1.25\times$ to $2.00\times$ for rural areas depending on distance from urban boundaries.

### 2.3 Solatium (Section 30(1))
A mandatory solatium amount of one hundred percent ($100\%$) over the total assessed market value and attached assets (trees, wells, structures):
$$\text{Solatium} = 1.00 \times (\text{Adjusted Market Value} + \text{Attached Assets Value})$$

### 2.4 Additional Interest (Section 30(3))
An additional amount calculated at the rate of twelve percent ($12\%$) per annum on market value from date of preliminary notification under Section 11 to date of Collector's award under Section 23:
$$\text{Additional Interest} = \text{Adjusted Market Value} \times 0.12 \times \left(\frac{\text{Days Between Notification and Award}}{365}\right)$$

### 2.5 Total Statutory Fair Compensation
$$\text{Total Compensation} = \text{Adjusted Market Value} + \text{Attached Assets} + \text{Solatium} + \text{Additional Interest}$$

---

## 3. Section 64 Reference Limitation

Under Section 64(2):
- **Present at Award:** Application must be filed within **6 weeks (42 days)** of the Collector's award.
- **Not Present at Award:** Application must be filed within **6 weeks of notice** under Section 20, or **6 months (180 days)** from date of knowledge of the award.
- **Collector's SLA:** The Collector is statutorily bound to refer the application to LARRA within **30 days** of receipt.

---

## 4. Privacy & Verification Commands

Run tests:
```bash
npx vitest run src/services/landAcquisitionService.test.js src/services/landAcquisitionStorage.test.js src/components/landAcquisition/LandCompensationCalculator.test.jsx src/pages/LandAcquisitionWorkspace.test.jsx
```

Run linter:
```bash
npx eslint src/services/landAcquisitionService.js src/services/landAcquisitionStorage.js src/components/landAcquisition/LandCompensationCalculator.jsx src/components/landAcquisition/RehabilitationEntitlementCard.jsx src/components/landAcquisition/LarraReferenceDrafter.jsx src/components/landAcquisition/LarrEvidenceChecklist.jsx src/pages/LandAcquisitionWorkspace.jsx
```

Run security check and production build:
```bash
npm run lint:security
npm run build
```
