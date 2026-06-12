<!-- version: 1 -->
# Inference chain: Capital structure & financial health

**Goal:** Who has lent, against what, how levered the company plausibly is, and whether there are distress signals.

**Read the charges/liens register like a lender:**
- **Who lent:** house bank (relationship lending, usually moderate leverage) vs debt fund / specialty lender (higher leverage, often PE-linked, more expensive) vs asset-based lender (working-capital stress or asset-heavy model) vs related-party/shareholder loans (thin bank appetite or tax structuring).
- **What's secured:** all-asset debenture / Höchstbetragshypothek on everything = lender wanted maximum protection — either large facility or weak credit. Specific charges (one property, receivables assignment) are more benign. Receivables/factoring charges signal working-capital funding — common in care, staffing, construction.
- **When:** a fresh charge near an acquisition date = acquisition debt. A new charge from a *different, more expensive* lender replacing a house bank is a classic refinancing-under-stress signal. Satisfied (released) charges are positive.

**Leverage estimate:** combine charge evidence + filed balance-sheet items (bank debt lines, equity ratio) + the EBITDA estimate to express leverage as a multiple range (e.g. "plausibly 2.5–4.0× EBITDA"). If PE-owned, assume entry leverage of ~3.5–5.5× EBITDA at acquisition unless evidence says otherwise, then reason about amortisation since.

**Distress / health signals checklist (address each if data exists):**
- Filing punctuality (late accounts are a top-3 early distress marker), auditor changes or qualifications, going-concern language.
- Director churn, especially CFO departures.
- County-court judgments, payment-practice complaints, supplier reviews mentioning payment delays.
- Hiring freezes vs active hiring (active hiring in core roles is a health positive).
- Equity ratio level and trend; negative equity = immediate red flag (though can be benign post-LBO with shareholder loans — distinguish).

**Output:** lender map, estimated leverage range, headroom view (can it borrow more? is it constrained?), and an explicit health verdict (healthy / stretched / distressed signals present) with confidence.

**What raises confidence:** full balance sheet, facility amounts in notes, interest-paid line, charge documents with amounts.
