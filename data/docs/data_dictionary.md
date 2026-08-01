# Data Dictionary — Motor Insurance Quote-to-Policy Conversion

**Purpose:** this project uses two unrelated public Kaggle datasets as a proxy for a real insurer's quote-to-policy data, since no insurer publishes that data openly. This document exists so any modeling decision made to make that proxy work — and there are several — has a clear, citable answer instead of looking like an oversight if a judge or reviewer asks about it.

---

## 1. Data Sources

| Source | Kaggle handle | Role | Native size |
|---|---|---|---|
| Cross-Sell dataset | `apoorvasharma03/vehicle-insurance-dataset` | Customer demographics, quote/conversion signal, sales channel | ~381,109 rows |
| Analytics Vidhya Claims dataset | `avikumart/analytics-vidhya-nov22-insurance-claims-dataset` | Vehicle specs, safety features, policy, claims | 97,655 rows (train + test combined) |

**These two datasets have no real relationship to each other.** No shared customer, vehicle, or policy ID exists between them — they were built by different teams for different competitions. Every "customer ↔ vehicle" link in this project is a synthetic pairing we constructed, described below.

---

## 2. Entity Alignment Methodology

**The decision:** the two source populations were aligned into one synthetic entity chain by sorting each dataset by its own age field (`customer_age` for Cross-Sell, `age_of_policyholder` for Claims) and matching by percentile rank, then resampling the larger Cross-Sell population down to the Claims population size (97,655).

**Why age-percentile matching instead of random pairing:** a defensible, explainable answer to "why is this customer linked to this vehicle?" — customers and policyholders are paired by age similarity, not arbitrarily. It is still a synthetic pairing, not a real relationship, and should be described as such if asked.

**Cardinality model: 1 : 1 : 1.** Each synthetic entity has exactly one customer, one vehicle, one quote, one policy. This does not reflect real insurer data (a real customer can own multiple vehicles/policies) — it was a deliberate scoping decision to keep the warehouse buildable in the project timeline. A production version would need bridge tables (`bridge_customer_policy`, `bridge_policy_vehicle`) to support many-to-many relationships.

**Surrogate keys** (`customer_sk`, `vehicle_sk`, `policy_sk`, `quote_sk`, `claim_sk`) are assigned positionally (`range(1, n+1)`) against this aligned population — row *i* in every Gold table refers to the same synthetic entity.

---

## 3. Layer Architecture

```
Bronze  — raw Kaggle CSVs, ingested as-is via DuckDB, timestamped, untouched
Silver  — cleaned, renamed, aligned (this is where the two source
          populations get matched into one entity chain)
Gold    — dimensions, facts, and BI-ready marts
```

---

## 4. Gold Dimensions

### dim_customer
| Column | Description |
|---|---|
| `customer_sk` | Surrogate key, positional |
| `customer_id` | Business key, `CUST000001` format |
| `gender`, `customer_age`, `age_band` | From Cross-Sell |
| `has_driving_license`, `driving_license_status` | Same fact represented two ways — kept for now, functionally redundant |
| `previously_insured`, `insurance_history` | Same underlying flag — `insurance_history` is a descriptive label of `previously_insured` |
| `customer_segment` | Derived from `previously_insured` (Existing/New Customer) |
| `region` | Raw Cross-Sell region code (numeric) — not mapped to real geography |
| `risk_profile` | Rule-based: no license or age < 25 → High; age > 60 → Medium; else Low |

### dim_vehicle
| Column | Description |
|---|---|
| `vehicle_sk` | Surrogate key, positional — **independent of `policy_id`**, a vehicle is its own entity |
| `policy_id` | Retained as a valid join key *within* the claims-world tables (vehicle/safety/policy/claim all derive from the same source rows) — not a link back to `dim_customer` |
| `customer_sk` | Attached positionally via the aligned population |
| `make`, `model`, `segment` | **Numeric/coded values from the source dataset, not real brand names** |
| `vehicle_age`, `vehicle_age_band` | Age in years / bucketed (New ≤2, Mid Age ≤5, Old >5) |
| `displacement`, `engine_category` | Engine size (cc) / bucketed |
| `safety_score` | Composite of airbags + 7 binary safety features + NCAP rating, **rescaled to 0–100** |
| `safety_rating` | Bucketed from `safety_score`: Excellent ≥90, Good ≥75, Average ≥60, Poor <60 |
| `premium_vehicle` | **Redefined from the original design** — originally checked `make` against a real brand list (Toyota, Honda, etc.), which can never match since `make` is numeric here. Currently: `displacement ≥ 1200 AND ncap_rating ≥ 3`. Thresholds are a starting placeholder, not a validated business rule. |

### dim_policy
| Column | Description |
|---|---|
| `policy_sk`, `policy_id` | Keys |
| `policy_type`, `coverage_type`, `policy_status` | Synthetic — randomly assigned, not derived from real business logic |
| `policy_tenure`, `policy_tenure_band` | From source data / bucketed |
| `active_flag` | Derived from `policy_status == "Active"` |

**Note:** `renewal_probability` and `policy_age_score` were originally modeled as dimension attributes and have been moved to `fact_underwriting` — they're predictive outputs, not stable descriptive facts about a policy.

### dim_channel
| Column | Description |
|---|---|
| `channel_sk`, `channel_id` | Keys |
| `channel_name` | **Fabricated taxonomy** — raw numeric sales channel codes mapped to named channels (Agent, Website, Mobile App, etc.) using arbitrary numeric ranges. Not derived from any real business logic in the source data. |
| `channel_type`, `ownership`, `is_digital`, `priority` | Derived from the fabricated `channel_name` |

### dim_date
Standard calendar dimension, generated (not sourced), spanning **2022-01-01 to 2026-12-31**. Includes Indian financial year (April–March) fields.

---

## 5. Gold Facts

### fact_quote
Grain: one row per quote (= one row per synthetic customer, given 1:1:1).

| Column | Description |
|---|---|
| `accepted_offer` | Raw Cross-Sell `Response` field — customer expressed interest in the quote. **This is not the same as a policy being issued.** |
| `conversion_flag` | **The true "policy issued" outcome.** A second attrition layer was added on top of `accepted_offer` — roughly 20% of customers who accept the offer still don't convert, dropping at Document Upload, Underwriting, or Payment. Without this layer, `accepted_offer` and `conversion_flag` would be identical and the funnel would have nothing to analyze. |
| `quote_stage` | Where each quote currently sits. For non-converters, drawn from a probability-weighted set of stages — **this is simulated, not observed** — no source dataset captures real stage-level funnel data. Disclose this if asked. |
| `quote_value_band` | Bucketed from `quoted_premium`, bins tuned to the actual formula's ~3,500–8,000 range (Low/Medium/High/Premium at 4500/5500/7000) |
| `quoted_premium` | Synthetic formula: `3500 + age×20 + vehicle_age×500 ± random noise` |

### fact_claim
| Column | Description |
|---|---|
| `claim_flag` | From source `is_claim`. Any rows where the source test split was missing this value were filled as "no claim" — confirm this was verified as zero/negligible before trusting downstream claim counts. |
| `claim_approved` | **Independent outcome from `claim_flag`** — filing a claim doesn't guarantee approval. ~85% approval rate for filed claims (placeholder rate). |
| `claim_date` | Anchored to the customer's quote date + a 30–700 day lag, not an independent random date |
| `fraud_risk` | Function of claim amount + unusually fast settlement + a noise component — deliberately decorrelated from `claim_severity` so the two don't just restate each other |

### fact_underwriting
| Column | Description |
|---|---|
| `underwriting_date_sk` | Anchored to quote date + 0–4 day turnaround, not independent random |
| `recommendation` | The AI's raw suggestion (Auto Approve / Refer Underwriter / Reject), purely score-driven |
| `underwriting_decision` | The final outcome. For referred cases, this now genuinely diverges from `recommendation` sometimes — this divergence is the AI-override-rate signal for the underwriting dashboard. |
| `manual_review_flag` | True when `recommendation == "Refer Underwriter"` |

### fact_customer_journey
Grain: one row per stage-event per session. Keyed off `conversion_flag` (not `accepted_offer`) to stay consistent with the two-layer funnel above.

### fact_ai_interaction
| Column | Description |
|---|---|
| `interaction_timestamp`, `date_sk` | Anchored to the originating quote's date + 0–2 days, not independent random |
| `confidence_score` | 0.55–0.99, genuine spread |
| `escalation_required`, `customer_rating`, `customer_sentiment` | **Correlated**, not independently random — low confidence drives escalation, which drives lower ratings/more negative sentiment |
| `ai_model_version` | Claude Haiku 4.5 / Sonnet 5 / Opus 4.8 — matches the actual assistant used in this project's own demo, not a generic placeholder |

---

## 6. Gold Marts

Six marts, each answering a distinct question — a `customer_dashboard` mart originally existed separately from `customer360_dashboard` and was merged into the latter due to near-total column overlap.

| Mart | Answers |
|---|---|
| `executive_dashboard` | The 4 case-brief KPIs as a daily time series (not a static snapshot) |
| `sales_dashboard` | Funnel/conversion by channel, device, region, value band |
| `underwriting_dashboard` | STP rate, manual review volume, AI override rate, SLA |
| `claims_dashboard` | Claim amount, severity, fraud, settlement — **deliberately excludes customer demographics**, which live in `customer360_dashboard` instead |
| `customer360_dashboard` | Full customer view: demographics + quote + journey + AI + underwriting aggregates |
| `ai_monitoring_dashboard` | AI interaction volume, resolution, escalation, satisfaction |

---

## 7. Known Modeling Decisions — Q&A Cheat Sheet

Quick answers to the questions most likely to come up:

- **"Is this real data?"** Two real (anonymized) Kaggle datasets, synthetically paired by age-percentile matching since no shared key exists between them. Not a real insurer's book of business.
- **"Why does this customer link to this vehicle?"** Age-percentile alignment across the two source populations — documented above, not arbitrary.
- **"Does one customer have multiple policies?"** No — 1:1:1 cardinality by design, a scoping decision for project timeline, not a data limitation we missed.
- **"Is the quote funnel real?"** Conversion outcome (`conversion_flag`) is derived from real source signal (`Response`) plus a documented second attrition layer. Stage-level detail (`quote_stage`) is simulated — no open dataset captures real funnel stages.
- **"Why 'Toyota/Honda' brand checks failing?"** They don't apply — `make` in the underlying data is a numeric code. `premium_vehicle` is redefined off displacement/NCAP instead.
- **"Are the sales channels real?"** Named channels (Agent, Website, etc.) are a fabricated taxonomy mapped onto real but meaningless numeric codes from the source data.

---

## 8. Validation

Run `validate_gold_layer.py` after any pipeline rebuild — checks structural integrity, date logic, funnel consistency, value ranges, and known mart-specific regressions. See script for the full check list.

---

## 9. Open Items

- Confirm `is_claim` missing-value count from the source test split was resolved (should be zero after the fillna step)
- `policy_type`, `coverage_type`, `policy_status` in `dim_policy` are currently unconditioned random assignments — no correlation to tenure or claims history
- `channel_sk` in `fact_quote` must be regenerated any time `dim_channel` changes, or keys go stale (caught by the validator's orphan-key check)