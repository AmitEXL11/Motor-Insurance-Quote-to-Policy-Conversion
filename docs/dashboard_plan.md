# Power BI Chart Specification — Motor Insurance Quote-to-Policy

Legend: **Ready** = builds directly off current Gold layer · **New mart** = needs a mart we haven't built yet · **Fix needed** = small addition/change required first

---

## 1. Executive Dashboard
*Answers: "Is the business improving?"* — Source: `executive_dashboard`

| Chart | Type | Column(s) | Status |
|---|---|---|---|
| Quote Volume | KPI card | `SUM(quote_volume)` | Ready |
| Policies Issued | KPI card | `SUM(policies_issued)` | Ready |
| Conversion Rate | KPI card | `AVG(conversion_rate)` | Ready |
| Quote Abandonment Rate | KPI card | `100 − conversion_rate` (measure) | Ready |
| Premium Collected | KPI card | `SUM(premium_collected)` | Ready — see calc note below |
| Claims Paid | KPI card | `SUM(claims_paid)`, `SUM(claim_amount)` | Ready |
| Claim Ratio | KPI card | `AVG(claim_ratio)` | Ready |
| Manual Underwriting % | KPI card | `AVG(manual_underwriting_pct)` | Ready |
| AI Assisted Quotes | KPI card | `SUM(ai_usage)` vs `quote_volume` | Ready |
| Customer Satisfaction | KPI card | `AVG(customer_satisfaction)` | Ready |
| Average Journey Time | KPI card | `AVG(average_journey_time)` | Ready |
| **Average Underwriting Time** | KPI card | `underwriting_date_sk − quote.date_sk`, joined via `customer_sk` | **Fix needed** — new measure, not a stored column |
| Quote Trend | Line | `quote_volume` by `date` | Ready |
| Policy Trend | Line | `policies_issued` by `date` | Ready |
| Conversion Trend | Line | `conversion_rate` by `date` | Ready |
| Revenue Trend | Line | `premium_collected` by `date` | Ready |
| Claims Trend | Line | `claim_amount` by `date` | Ready |
| **Executive Funnel** | Funnel | Quotes → Documents Submitted → Underwriting → Premium Confirmed → Policy Issued | **New mart** — the middle 3 stages need `fact_customer_journey.stage_name` + `completed_flag` |
| KPI vs Target | Table/gauge | `conversion_rate` (current) vs case-brief target vs gap | Ready — measures only |
| Executive Alerts | Cards, conditional formatting | `sla_breached_flag` (underwriting), device-level conversion drop (sales), `manual_underwriting_pct` trend | Ready, pulls from other marts |

**Calc note — Premium Collected:** no field stores the final adjusted premium. Use `quoted_premium × (1 + premium_adjustment_pct/100)`, documented as a calculated measure, not assumed to be a stored column.

---

## 2. Sales & Conversion Dashboard
*Answers: "Where are we losing sales?"* — Source: `sales_dashboard`

| Chart | Type | Column(s) | Status |
|---|---|---|---|
| Quote Volume | KPI | `SUM(quote_count)` | Ready |
| Conversion % / Abandonment % | KPI | `AVG(conversion_rate)`, `100 − it` | Ready |
| Average Premium | KPI | `AVG(quoted_premium)` | Ready |
| Average Contact Delay | KPI | `AVG(days_since_last_contact)` | Ready |
| High Value Quotes | KPI | `SUM(high_value_quote)` | Ready |
| Conversion Funnel | Funnel | `quote_stage` counts, ordered | Ready |
| Conversion by Channel | Bar | `channel_name` × `conversion_flag` | Ready |
| Conversion by Region | Bar | `region` × `conversion_flag` | Ready |
| Conversion by Age | Bar | `customer_age` (binned) × `conversion_flag` | Ready |
| Conversion by Gender | Bar | `gender` × `conversion_flag` | Ready |
| Conversion by Vehicle Segment | Bar | `segment` × `conversion_flag` | **Fix needed** — `sales_dashboard` doesn't currently carry vehicle segment; join `underwriting_dashboard.segment` via `customer_sk` |
| Conversion by Fuel Type | Bar | `fuel_type` × `conversion_flag` | **Fix needed** — same join as above |
| Conversion by Device | Bar | `device_type` × `conversion_flag` | Ready |
| Conversion by Quote Source | Bar | `quote_source` × `conversion_flag` | Ready |
| Channel × Region Heatmap | Matrix | `channel_name`, `region`, `conversion_rate` | Ready |
| Premium Distribution | Histogram | `quoted_premium` | Ready |
| Days Since Contact vs Conversion | Scatter | `days_since_last_contact` vs `conversion_flag` | Ready |
| High Value Quotes | Treemap | `region`/`channel_name` × `high_value_quote` count | Ready |

**Filters:** year, month, `region`, `channel_name`, `device_type`, `customer_segment` (via join)

---

## 3. Customer Journey Dashboard — *new, not yet built*
*Answers: "Why are customers dropping?"* — Source: `fact_customer_journey` + `dim_date`, lightly joined to `dim_customer`/`dim_channel`

This is GPT's strongest structural addition — it deserves its own mart since `fact_customer_journey` already carries exactly what root-cause analysis needs and nothing else surfaces it.

| Chart | Type | Column(s) |
|---|---|---|
| Journey Funnel | Funnel | `stage_name` count where `completed_flag=true`, ordered by `stage_sequence` |
| Drop-off % per stage | Bar/table | Count entering stage N vs stage N+1 (calculated) |
| Average time between stages | Bar | `AVG(duration_seconds)` by `stage_name` |
| Journey Sankey | Sankey | `session_id` path across `stage_sequence` → `stage_name` |
| Exit Reasons | Pie | `exit_reason` where `abandoned_flag=true` |
| Session Duration | Histogram | `duration_seconds` / `duration_band` |
| AI Assistance vs Conversion | Bar | `ai_assistance_used` × `conversion_flag` |
| Device Journey | Stacked bar | `device_type` × `stage_name` |
| Traffic Source | Bar | `traffic_source` × `conversion_flag` |

**Mart build note:** join `customer_sk → dim_customer` for `region`/`customer_segment` as optional filters — this dashboard isn't subject to the "no customer join" rule (that was specific to Claims), so demographic cuts are fine here if useful for root-cause slicing.

---

## 4. Customer 360 Dashboard
*Answers: "Who converts?"* — Source: `customer360_dashboard` + drill into `fact_ai_interaction`/`fact_customer_journey` by `customer_sk`

| Chart | Type | Column(s) | Status |
|---|---|---|---|
| Lifetime Quotes/Premium | KPI | `quote_count`, `quoted_premium` | Ready — labeled "lifetime" loosely, since 1:1:1 model means one quote per customer; disclose this |
| AI Usage | KPI | `total_ai_interactions`, `avg_ai_confidence` | Ready |
| Journey Count | KPI | `total_journey_events` | Ready |
| Customer Rating | KPI | `avg_customer_rating` | Ready |
| Customer Profile card | Card | `customer_age`, `gender`, `region`, `customer_segment`, `risk_profile`, `insurance_history`, `has_driving_license` | Ready |
| Quote History | Timeline | `quote_id`, `date`, `quoted_premium`, `quote_status` | Ready, single-row given 1:1 model |
| AI Interactions | Timeline | Drill to `fact_ai_interaction`: `interaction_timestamp`, `question_category`, `ai_response` filtered by `customer_sk` | Ready |
| Journey History | Timeline | Drill to `fact_customer_journey`: `stage_name`, `duration_seconds` filtered by `customer_sk` | Ready |
| Risk Profile Gauge | Gauge | `avg_risk_score` / `risk_category` — label as **"Risk Score (rule-based)"** | Ready, relabel required |
| ~~Conversion Probability Gauge~~ | — | — | **Cut** — implies a trained ML model you don't have; don't ship this one |
| Recommendations | Cards | Business rules off existing fields: `abandoned_sessions>0 AND high_value_quote=1` → "Manual Call"; `quote_status='Abandoned' AND high_value_quote=1` → "Offer Discount" | Ready — label explicitly as **rule-based**, not ML output |

---

## 5. Underwriting Dashboard
*Answers: "Why is underwriting slow?"* — Source: `underwriting_dashboard`

| Chart | Type | Column(s) | Status |
|---|---|---|---|
| Average Review Time | KPI | `AVG(review_time_minutes)` | Ready |
| STP % | KPI | `AVG(stp_flag)` | Ready |
| Manual Review % | KPI | `AVG(manual_review_flag)` | Ready |
| Approval % | KPI | `underwriting_decision='Approved'` rate | Ready |
| Fraud % | KPI | `AVG(fraud_flag)` | Ready |
| Risk Distribution | Histogram | `risk_score` | Ready |
| Decision Breakdown | Pie/bar | `underwriting_decision` | Ready |
| Manual Review Trend | Line | `manual_review_flag` rate by `underwriting_date_sk` | Ready |
| Review Time by Underwriter | Bar | `underwriter` × `AVG(review_time_minutes)` | Ready |
| Rule Trigger Frequency | Bar | `rules_triggered` distribution | Ready |
| Fraud Probability Distribution | Histogram | `fraud_probability` | Ready |
| **AI Recommendation vs Final Decision** | Matrix | `recommendation` × `underwriting_decision` | Ready — this is your AI-governance/override-rate story, confirmed to diverge now |
| SLA Breach | Gauge | `sla_breached_flag` rate | Ready |

---

## 6. Claims Dashboard
*Answers: "How are claims impacting profitability?"* — Source: `claims_dashboard` (no customer demographics, by design)

| Chart | Type | Column(s) | Status |
|---|---|---|---|
| Claim Count | KPI | `SUM(claim_count)` | Ready |
| Claim Amount | KPI | `SUM(claim_amount)` | Ready |
| Claim Ratio | KPI | Requires `premium_collected` from `executive_dashboard` — cross-mart measure | Ready, cross-mart |
| Average Settlement | KPI | `AVG(settlement_days)` | Ready |
| Fraud % | KPI | `AVG(high_fraud)` | Ready |
| Claim Trend | Line | `claim_amount` by `date` | Ready |
| Claim Severity | Pie | `claim_severity` | Ready |
| Settlement Time | Histogram | `settlement_days` / `settlement_band` | Ready |
| Fraud Risk | Bar | `fraud_risk` | Ready |
| Vehicle Segment vs Claims | Bar | `segment` × `claim_count` | Ready |
| Safety Rating vs Claim Frequency | Bar | `safety_rating` × `claim_count` | Ready |
| ~~Claim Amount Heatmap (Region × Vehicle)~~ | — | — | **Conflict** — `region` isn't in `claims_dashboard` by design (the no-customer-join decision). Swap for **Vehicle Segment × Fuel Type** heatmap instead, which is buildable from existing columns |

---

## 7. AI Monitoring Dashboard
*Answers: "Is AI delivering value?"* — Source: `ai_monitoring_dashboard`

| Chart | Type | Column(s) | Status |
|---|---|---|---|
| AI Sessions | KPI | `SUM(interaction_count)` | Ready |
| Average Confidence | KPI | `AVG(confidence_score)` | Ready |
| Escalation % | KPI | `AVG(escalated_interaction)` | Ready |
| Resolution % | KPI | `AVG(resolved_interaction)` | Ready |
| Customer Rating | KPI | `AVG(customer_rating)` | Ready |
| Latency | KPI | `AVG(response_time_ms)` | Ready |
| Confidence Distribution | Histogram | `confidence_score` | Ready |
| Response Time Trend | Line | `response_time_ms` by `date` | Ready |
| Sentiment Trend | Stacked line | `customer_sentiment` by `date` | Ready |
| Escalations by Category | Bar | `question_category` × `escalation_required` | Ready |
| Question Category | Pie | `question_category` | Ready |
| **Model Performance** | Bar | `ai_model_version` × `AVG(ai_quality_score)` | Ready — confirmed Claude Haiku/Sonnet/Opus, not generic placeholders |
| Confidence → Escalation → Rating | Funnel/scatter | `confidence_score`, `escalation_required`, `customer_rating` | Ready |
| Token Usage | Line/KPI | `SUM(token_count)` by `date` | Ready |

---

## 8. Executive Recommendations Dashboard — *new, not yet built*
*Answers: "What should management do?"* — table/card layout, not chart-heavy

| Element | Type | Source |
|---|---|---|
| Finding | Text card | Computed from any mart (e.g., "38% manual review rate" from `underwriting_dashboard`) |
| Impact (₹) | KPI card | **Real, computed** — see ROI formula below, never a placeholder number |
| Recommendation | Text card | Written, tied 1:1 to the Finding |
| Priority | Badge (R/A/G) | Manually set or rule-based on impact size |
| ROI Calculator | Cards | See formula below |

**ROI formula (use this exactly — replace any illustrative rupee figures):**
```
incremental_conversion_pp = target_conversion_rate − current_conversion_rate   [from executive_dashboard]
incremental_policies      = quote_volume × incremental_conversion_pp
incremental_revenue       = incremental_policies × AVG(quoted_premium)         [from fact_quote]
```
Decide and state explicitly whether your case brief's "+10% conversion" means +10 percentage points or a relative +10% — this changes the output materially, and it should be a stated assumption, not silently baked in.

---

## Power BI features worth layering on top (from GPT's list, all still good)

- Global slicers: Date, Region, Channel, Customer Segment, Vehicle Segment
- Drill-through: Executive → Sales → Customer 360
- Tooltip pages with KPI definitions (especially useful for the relabeled "Risk Score (rule-based)" gauges, so nobody misreads them as ML output)
- Decomposition Tree: Quote Abandonment → Channel → Region → Device
- Key Influencers visual on `conversion_flag` — genuinely useful here since you have enough dimensions for it to surface something real

## Build order given Aug 13

1. Fix `sales_dashboard` (add segment/fuel_type join) — quick
2. Build Customer Journey mart — new, highest narrative value
3. Add the underwriting-time measure to `executive_dashboard`
4. Build Executive Recommendations mart with real ROI calc
5. Everything else is ready to wire into Power BI as-is
