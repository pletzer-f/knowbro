<!-- version: 1 -->
# Inference chain: Revenue estimate

**Goal:** A defensible revenue range for the most recent period the data supports, even when no turnover is disclosed.

**Primary method — headcount × sector revenue per employee:**
1. Establish headcount from the most reliable signal available (filed average-employee figures > social-security disclosures > LinkedIn/website ranges > job-ad inference). State which you used and its reliability.
2. Apply a sector revenue-per-employee benchmark appropriate to region and business model. Anchors to reason from (adjust for region, premium vs commodity positioning, and capital intensity — state your adjustment):
   - Professional services / agencies: ~€90–150k per head
   - Software / SaaS: ~€150–300k per head
   - Specialised machinery / engineering (DACH Mittelstand): ~€180–280k per head
   - Construction / installation: ~€150–250k per head
   - Hospitality (hotels): ~€60–110k per head (seasonal FTE distortion — convert seasonal headcount to FTE first)
   - Care / social services (UK domiciliary): ~£25–40k per head
   - Distribution / wholesale: ~€400k–1m+ per head (headcount method weak here — flag it)
3. Produce a range, not a point.

**Cross-check methods (run every one the data allows):**
- **Fixed-asset base:** filed total assets or PPE × sector asset-turnover norms. Especially useful where an abridged balance sheet is filed but no P&L (Austria/Germany small GmbH regime).
- **Disclosed bands/thresholds:** size-class thresholds are hard constraints — e.g. Austrian/German abridged-filing size classes (small GmbH: revenue ≤ ~€10m, total assets ≤ ~€5m, ≤ 50 employees — two of three), UK small-company audit exemption (≤ £10.2m turnover), VAT registration, "company size" statements in award/press materials.
- **Physical footprint:** rooms × occupancy × ADR for hotels; sites × revenue-per-site norms for multi-site operators; production area for manufacturers.
- **Customer/contract signals:** disclosed contract values, public procurement awards, customer counts × plausible ACV.

**Reconciliation (required):** State each method's result side by side. If they diverge, explain why (e.g. headcount method overstates because of part-time staff) and give the final range with the reasoning for where you landed inside it. Methods that converge independently justify medium confidence; a single method is low confidence; a filed figure is high.

**What raises confidence:** filed turnover (even banded), audited accounts, count of FTE vs heads, one more independent method converging.
