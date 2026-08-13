# Dashboard Guide — Motor Insurance Quote-to-Policy Conversion

**Live URL:** `https://amitexl11.github.io/Motor-Insurance-Quote-to-Policy-Conversion/dashboard.html`
**Data source:** Gold layer CSVs auto-fetched from GitHub on page load
**Tech stack:** HTML · Chart.js 4.4 · PapaParse · EXL brand (navy `#003057` · orange `#F26522`)

---

## How the Dashboard Works

When you open the dashboard it immediately renders with synthetic demo data so the page is never blank. In the background it fetches 7 CSV files from your GitHub repo:

| File | Path | Rows |
|---|---|---|
| `executive_dashboard.csv` | `data/gold/data_marts/` | 730 |
| `sales_dashboard.csv` | `data/gold/data_marts/` | 97,655 |
| `underwriting_dashboard.csv` | `data/gold/data_marts/` | 97,655 |
| `claims_dashboard.csv` | `data/gold/data_marts/` | 97,655 |
| `ai_monitoring_dashboard.csv` | `data/gold/data_marts/` | 195,395 |
| `customer360_dashboard.csv` | `data/gold/data_marts/` | 97,655 |
| `fact_customer_journey.csv` | `data/gold/facts/` | 419,906 |

The status badge in the top-right changes from **DEMO DATA** → **LOADING…** → **LIVE DATA** as each file loads. A debug panel (click **DEBUG** button) shows the fetch log with HTTP status, bytes received, and rows parsed for each file.

---

## Tab 1 — Executive Dashboard

**Business question answered:** Is the business improving?

### KPI Cards (10 metrics)

| KPI | Source column | Notes |
|---|---|---|
| Quote Volume | `quote_volume` | Sum of all active days |
| Policies Issued | `policies_issued` | Sum of all active days |
| Conversion Rate | `conversion_rate` | Average of daily rates — dashboard shows **~12%** |
| Abandonment Rate | 100 − conversion_rate | Derived |
| Premium Collected | `premium_collected` | Sum — displays as ₹Cr |
| Claims Paid | `claims_paid` or `claim_amount` | Falls back to `claim_amount` if `claims_paid` = 0 |
| Claim Ratio | `claim_ratio` | Average of daily ratios |
| Manual UW % | `manual_underwriting_pct` | Average — dashboard shows **~39%** |
| Customer Satisfaction | `customer_satisfaction` | Average — dashboard shows **3.3/5** |
| Avg Journey Time | `average_journey_time` | Average in minutes — dashboard shows **~544 min (9 hrs)** |

### Charts

**Quote & Policy Trend** — dual-line chart, `quote_volume` vs `policies_issued` by `date`. Sampled to 30 points for readability.

**Conversion & Abandonment Trend** — dual-line chart, `conversion_rate` vs `100 - conversion_rate` by `date`.

**Revenue & Claims Trend** — dual-line chart, `premium_collected` vs claims by `date`. If `claims_paid` is all zeros (as in current data), falls back to `claim_amount`.

**Conversion Funnel** — 6-stage horizontal bar funnel. If `fact_customer_journey` is loaded, counts `completed_flag=true` per `stage_name`. Otherwise uses proportional estimate from quote volume.

**KPI vs Target Table** — current value vs case brief target with status badge (On Track / Action Needed).

**Manual UW % vs AI Usage Trend** — `manual_underwriting_pct` and `ai_usage` by `date`.

---

## Tab 2 — Sales & Conversion

**Business question answered:** Where are we losing sales?

### KPI Cards

| KPI | Source | Value |
|---|---|---|
| Total Quotes | Row count | 97,655 |
| Avg Conversion | Derived from `conversion_flag` | ~12% |
| Avg Premium | `quoted_premium` average | ~₹5,400 |
| High Value Quotes | `high_value_quote = 1` count | ~8,240 |
| Avg Days Since Contact | `days_since_last_contact` average | ~4.2 days |

### Charts

**Conversion Funnel by Stage** — cumulative funnel using `quote_stage` column. Counts all quotes that reached each stage or beyond (not snapshot of current stage). Uses navy→orange colour progression.

> **Note:** `quote_stage` records where a quote currently is. The funnel counts rows where `stageRank[quote_stage] >= i` to get cumulative volumes.

**Conversion by Channel** — bar chart, `channel_name` × `conversion_flag`. Blank `channel_name` rows are filtered out before grouping.

**Conversion by Region** — bar chart, `region` column (float e.g. 24.0) normalised to integer string. Top 12 regions shown.

**Conversion by Age Band** — `customer_age` is binned on the fly into: 18–25 / 26–35 / 36–45 / 46–55 / 56–65 / 66+. No `age_band` column exists in `sales_dashboard.csv`.

**Conversion by Device** — `device_type` × `conversion_flag`.

**Channel × Region Heatmap** — conversion rate matrix, top 4 channels vs top 5 regions. Darker = higher conversion.

**Premium Distribution** — `quoted_premium` histogram, buckets: <3K / 3–5K / 5–8K / 8–12K / 12–20K / >20K.

**Conversion by Quote Source** — `quote_source` × `conversion_flag`.

**Conversion by Gender** — doughnut chart, `gender` × `conversion_flag`.

---

## Tab 3 — Customer Journey

**Business question answered:** Why are customers dropping off?

### KPI Cards

| KPI | Value |
|---|---|
| Total Sessions | 97,655 |
| Completion Rate | ~11.5% |
| Top Exit: Premium | 38% |
| AI-Assisted Conversion | 22.4% vs 8.8% unassisted |
| Mobile Drop % | 68% |

### Charts

**Journey Drop-off Funnel** — `fact_customer_journey`, counts per `stage_name` ordered by `stage_sequence`.

**Drop-off % per Stage** — percentage lost between consecutive stages.

**Avg Time Between Stages** — `AVG(duration_seconds)/60` by `stage_name`.

**Exit Reasons** — doughnut chart, `exit_reason` where `abandoned_flag = true`.

**AI Assistance vs Conversion** — grouped bar: with/without `ai_assistance_used`, converted vs not.

**Device Journey Breakdown** — stacked bar, `device_type` × `stage_name`.

**Traffic Source vs Conversion** — bar chart, `traffic_source` × `conversion_flag`.

---

## Tab 4 — Customer 360

**Business question answered:** Who converts and why?

### KPI Cards

| KPI | Source column |
|---|---|
| Total Customers | Row count |
| Avg AI Interactions | `total_ai_interactions` average |
| Avg AI Confidence | `avg_ai_confidence` × 100 |
| Avg Customer Rating | `avg_customer_rating` |
| Previously Insured % | `previously_insured` rate |
| High Value Quotes % | `high_value_quote` rate |

### Aggregate Profile Card

Displays aggregate stats across all 97,655 records: avg age, top region, top segment, risk profile breakdown, avg risk score, licence validity rate.

### Charts

**Risk Profile Distribution** — doughnut, `risk_category` or `risk_profile` (Low / Medium / High).

**Conversion by Insurance History** — doughnut, `previously_insured` × `conversion_flag`.

**Rule-Based Recommendations** — three hard-coded rules (not ML):
- Abandoned + high value → assign to senior agent
- Abandoned + high value → send 10% WhatsApp discount
- Converted + previously insured + age 36–55 → cross-sell campaign

**AI Interaction Quality by Segment** — `customer_segment` × `avg_ai_confidence` and `avg_customer_rating`.

**Journey Events by Stage** — `total_journey_events` distribution.

---

## Tab 5 — Underwriting

**Business question answered:** Why is underwriting slow?

### KPI Cards

| KPI | Source column | Value |
|---|---|---|
| Avg Review Time | `review_time_minutes` average | ~28 min |
| STP Rate | `stp_flag = 1` rate | ~43% |
| Manual Review % | `manual_review_flag = 1` rate | ~39% |
| Approval Rate | `auto_approved_flag = 1` or decision contains "approv" | ~91% |
| Fraud Flag Rate | `fraud_flag = 1` rate | ~5.6% |
| SLA Breach Rate | `sla_breached_flag = 1` rate | ~12% |

> **Important:** All flag columns (`stp_flag`, `manual_review_flag`, `sla_breached_flag`, `fraud_flag`, `auto_approved_flag`) store `0`/`1` integers. The dashboard uses `isTrue()` helper which handles `0/1`, `True/False` strings, and booleans.

### Charts

**Risk Score Distribution** — histogram, `risk_score` bucketed: 0–20 / 21–40 / 41–60 / 61–80 / 81–100.

**Decision Breakdown** — doughnut, `underwriting_decision` distribution.

**SLA Breach Gauge** — summary panel showing breach rate, count, and STP gap to 60% target.

**Manual Review % Trend** — `manual_review_flag` rate grouped by `underwriting_date_sk` (numeric surrogate key).

**AI Recommendation vs Final Decision Matrix** — crosstab of `recommendation` × `underwriting_decision`. Highlighted cells = AI override cases. Override rate = cells where `recommendation ≠ underwriting_decision`.

**Review Time by Underwriter** — `underwriter` × `AVG(review_time_minutes)`.

**Fraud Probability Distribution** — histogram, `fraud_probability` bucketed 0–1 in 0.2 bands.

---

## Tab 6 — Claims

**Business question answered:** How are claims impacting profitability?

> **Design note:** This dashboard deliberately excludes customer demographics. Those live in Customer 360 instead (per `data_dictionary.md`).

### KPI Cards

| KPI | Source column |
|---|---|
| Total Claims | Row count |
| Total Claim Amount | `claim_amount` sum |
| Avg Settlement | `settlement_days` average |
| Fraud Flag % | `high_fraud = 1` rate |
| Claim Approval % | `claim_approved = True/False` string rate |

> **Note:** `claim_approved` and `high_fraud` store string `True`/`False` values. The `isTrue()` helper handles this.

### Charts

**Claim Amount Trend** — line chart, `claim_amount` by `date`.

**Claim Severity Distribution** — doughnut, `claim_severity` categories.

**Settlement Time Distribution** — histogram, `settlement_band` categories.

**Fraud Risk Distribution** — doughnut, `fraud_risk` categories.

**Vehicle Segment vs Claims** — bar chart, `segment` × claim count.

**Safety Rating vs Claim Frequency** — bar chart, `safety_rating` × claim count.

**Segment × Fuel Type Heatmap** — `segment` rows × `fuel_type` columns, claim count. Redder = higher claim volume.

---

## Tab 7 — AI Monitoring

**Business question answered:** Is AI delivering value?

**Model versions tracked:** Claude Haiku 4.5 · Claude Sonnet 5 · Claude Opus 4.8 (matches `ai_model_version` column in `ai_monitoring_dashboard.csv`).

### KPI Cards

| KPI | Source column |
|---|---|
| Total AI Sessions | Row count |
| Avg Confidence | `confidence_score` × 100 (values 0.55–0.99) |
| Escalation Rate | `escalated_interaction = 1` or `escalation_required = True` rate |
| Resolution Rate | `resolved_interaction = 1` or `resolved_flag = True` rate |
| Avg Rating | `customer_rating` average |
| Avg Latency | `response_time_ms` average |
| Total Tokens | `token_count` sum |

> **Note:** `resolved_flag` and `escalation_required` store string `True`/`False`. Both column names checked via `isTrue()`.

### Charts

**Confidence Distribution** — histogram, `confidence_score` bucketed: 0.55–0.65 / 0.65–0.75 / 0.75–0.85 / 0.85–0.95 / 0.95–0.99.

**Question Category Breakdown** — doughnut, `question_category` distribution.

**Escalations by Category** — bar chart, `question_category` × escalation rate %.

**Response Time Trend** — line chart, `AVG(response_time_ms)` by `date`.

**Sentiment Trend** — stacked area chart, `customer_sentiment` (Positive / Neutral / Negative) proportion by `date`.

**Model Performance** — bar chart, `ai_model_version` × `AVG(ai_quality_score)`. Values are 0–100 scale (e.g. 80.7, 50.1) — not multiplied by 100.

**Token Usage Trend** — line chart, `SUM(token_count)` by `date`.

---

## Tab 8 — Recommendations & ROI

**Business question answered:** What should the business do and what is it worth?

### Recommendation Cards (6)

Priority-tagged findings with action and financial impact:

| Priority | Finding | Action | Impact |
|---|---|---|---|
| HIGH | 38.6% manual UW | UW Auto-Pilot for Low risk | ₹3.1Cr savings |
| HIGH | 38% cite premium too high | Dynamic Pricing Agent | ₹8.4Cr revenue |
| MEDIUM | 24% doc upload friction | DigiLocker API | ₹2.8Cr recovered |
| MEDIUM | 12.4% SLA breach | Auto SLA alerts | ₹1.2Cr prevented lapse |
| LOW | Direct 2.2× better than aggregator | Shift 15% budget | ₹4.6Cr uplift |
| LOW | AI-assisted 2.5× better | Scale coverage to 60% | ₹6.2Cr uplift |

### ROI Calculator

Six editable inputs:

| Input | Default | Source |
|---|---|---|
| Current Conversion Rate | 12% | `executive_dashboard` avg |
| Target Conversion Rate | 22% | Current + 10pp case brief target |
| Avg Premium | ₹5,400 | `fact_quote` avg `quoted_premium` |
| Annual Quote Volume | 97,655 | `fact_quote` row count |
| UW Cost / Manual Case | ₹800 | Industry benchmark (stated assumption) |
| Manual UW % Reduction | 20% | Case brief target |

Four live outputs (update as you type):

- **Additional Policies** = 97,655 × (target − current) / 100
- **Incremental Revenue** = additional policies × avg premium
- **UW Cost Savings** = 97,655 × (manual% reduction / 100) × ₹800
- **Total Annual Benefit** = revenue + savings

### Charts

**KPI vs Target** — grouped bar, current vs target for all 4 case brief KPIs.

**Agent Contribution Matrix** — table mapping each KPI target to the agents responsible and expected uplift.

---

## Known Data Behaviours

| Issue | Explanation | How dashboard handles it |
|---|---|---|
| `claims_paid` all zeros | Claims not joined to exec mart | Falls back to `claim_amount` |
| `channel_name` blank rows | Some rows have empty channel | Filtered before grouping |
| `region` stored as float (24.0) | Source data quirk | Normalised to integer string "24" |
| `claim_approved` is "True"/"False" string | Python bool serialised as string | `isTrue()` helper handles all variants |
| `age_band` not in `sales_dashboard.csv` | Column doesn't exist | `customer_age` binned on-the-fly |
| `underwriting_date_sk` is numeric (20250520) | Surrogate key not a real date | Grouped by SK value directly |
| Emoji icons render as ? | LibreOffice/PPTX environment | Use text-based icon boxes instead |

---

## Data Source Transparency

This dashboard uses two unrelated Kaggle datasets synthetically aligned — not a real insurer's book of business:

| Source | Kaggle handle | Provides |
|---|---|---|
| Cross-Sell dataset | `apoorvasharma03/vehicle-insurance-dataset` | Customer demographics · quote/conversion signal |
| Analytics Vidhya Claims | `avikumart/analytics-vidhya-nov22-insurance-claims-dataset` | Vehicle specs · claims · underwriting |

**Alignment method:** Age-percentile matching across both populations. Every modeling decision documented in `docs/data_dictionary.md`.

---

## Hosting & Deployment

```
docs/
├── index.html          ← Landing page
├── dashboard.html      ← This dashboard (auto-fetches Gold CSVs)
└── demo.html           ← 9-agent agentic demo
```

Hosted via **GitHub Pages** → Settings → Pages → Source: `main` branch → `/docs` folder.

Dashboard auto-fetches CSVs from:
```
https://raw.githubusercontent.com/AmitEXL11/Motor-Insurance-Quote-to-Policy-Conversion/main/data/gold/data_marts/<filename>.csv
```

To update data: regenerate CSVs locally → `git push origin main` → dashboard refreshes automatically on next page load.
