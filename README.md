# Motor Insurance Quote-to-Policy Conversion

Accelerating quote-to-policy conversion in motor insurance through intelligent automation and analytics — a case study solution combining a dimensional data warehouse, BI dashboards, and a live multi-agent AI pipeline.

## Problem

Motor insurers lose a significant share of quotes before they convert to policies. This project analyzes the quote-to-policy lifecycle — quote → document submission → underwriting → premium confirmation → policy issuance — to identify where conversion breaks down and demonstrate what automation could recover.

**Target outcomes:** +10% quote-to-policy conversion, -20% quote abandonment, -25% policy issuance turnaround time, -20% manual underwriting effort.

## Architecture

```
                    Kaggle sources (2 datasets, no shared key)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Bronze (raw)         Bronze (raw)
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    Silver (cleaned + aligned
                    into one synthetic entity chain)
                              │
                              ▼
                    Gold (star schema)
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         5 dimensions    5 fact tables    6 BI marts
                              │
                              ▼
                    Power BI / Plotly dashboards
                              │
                              ▼
                    Live agent pipeline demo
              (Customer → Document → Risk →
               Recommendation → Underwriting → KPI)
```

Two open Kaggle datasets stand in for real insurer data, since insurers don't publish quote-to-policy data openly. They're synthetically aligned into one entity chain (age-percentile matching) rather than randomly paired — see the [data dictionary](./docs/data_dictionary.md) for the full methodology and every modeling decision made along the way.

## Repo Structure

```
├── data/
│   ├── bronze/          raw ingested Kaggle CSVs (untouched)
│   ├── silver/          cleaned, renamed, entity-aligned
│   └── gold/
│       ├── dimensions/  dim_customer, dim_vehicle, dim_policy, dim_channel, dim_date
│       ├── facts/       fact_quote, fact_claim, fact_underwriting,
│       │                fact_customer_journey, fact_ai_interaction
│       └── data_marts/  executive, sales, underwriting, claims,
│                        customer360, ai_monitoring dashboards
├── notebooks/
│   ├── 01_bronze_ingestion.ipynb
│   ├── 02_bronze_to_silver.ipynb
│   ├── 03_silver_to_gold.ipynb
│   └── 04_dashboard_data_marts.ipynb
├── docs/
│   └── data_dictionary.md
├── validate_gold_layer.py
└── README.md
```

## Data Sources

| Source | Kaggle handle | Provides |
|---|---|---|
| Cross-Sell dataset | `apoorvasharma03/vehicle-insurance-dataset` | Customer demographics, quote/conversion signal, sales channel |
| Analytics Vidhya Claims dataset | `avikumart/analytics-vidhya-nov22-insurance-claims-dataset` | Vehicle specs, safety features, policy, claims |

## Gold Layer

**5 dimensions** — customer, vehicle, policy, channel, date
**5 facts** — quote, claim, underwriting, customer journey, AI interaction
**6 marts** — executive, sales, underwriting, claims, customer 360, AI monitoring

Full column-level documentation, every modeling assumption, and a Q&A cheat sheet for defending design decisions live in **[`docs/data_dictionary.md`](./docs/data_dictionary.md)**.

## Dashboards

| Dashboard | Answers |
|---|---|
| Executive | Conversion rate, quote volume, premium collected, claim ratio, manual underwriting %, AI usage, customer satisfaction, avg. journey time — as trends, not snapshots |
| Sales | Funnel by stage, channel, device, region, quote value band |
| Underwriting | STP rate, manual review volume, AI recommendation vs. final decision (override rate), SLA |
| Claims | Claim amount, severity, fraud risk, settlement time — by vehicle/policy/date, deliberately excludes customer demographics |
| Customer 360 | Full per-customer view combining demographics, quote outcome, journey behavior, AI usage, underwriting risk |
| AI Monitoring | Interaction volume by question category, resolution/escalation rate, confidence, satisfaction |

## Live Agent Pipeline Demo

A working multi-agent pipeline, not a mockup — each stage below is a real model call:

```
Customer Agent → Document Agent → Risk Agent → Recommendation Agent → Underwriting Agent → KPI Agent
```

- **Customer Agent** answers live customer questions in context
- **Document Agent** cross-validates stated details against extracted document fields (Claude reads documents natively — no separate OCR pipeline)
- **Risk Agent**, **Recommendation Agent**, **Underwriting Agent** score risk, recommend coverage, and decide approve/refer
- **KPI Agent** aggregates results into a live session dashboard

## Tech Stack

| Layer | Demo build | Production target |
|---|---|---|
| Orchestration | Sequential chained calls | LangGraph (conditional branching, human-in-the-loop escalation) |
| LLM | Claude | Claude |
| Frontend | Self-contained HTML artifact | Streamlit |
| Document processing | Claude native vision | Claude native vision |
| Dashboard | Plotly / Power BI | Power BI |
| Data | Kaggle (proxy) | Insurer's real quote engine + CRM |

## Getting Started

Run notebooks in order — each depends on the previous layer's output:

```
01_bronze_ingestion.ipynb
02_bronze_to_silver.ipynb
03_silver_to_gold.ipynb
04_dashboard_data_marts.ipynb
```

Then validate before building anything on top of Gold:

```bash
cd notebooks
python ../validate_gold_layer.py
```

All checks should report `PASS`. `FAIL` results must be resolved before dashboards or the agent demo are trusted; `WARN` results are informational.

## Known Limitations

- Two unrelated open datasets synthetically aligned — not a real insurer's book of business
- 1:1:1 customer/vehicle/policy cardinality (a real customer can hold multiple policies/vehicles — out of scope for this build)
- Quote funnel stage-level detail is simulated; only the final conversion outcome is grounded in real source signal
- Sales channel names are a fabricated taxonomy over real but unlabeled numeric codes

Full detail on every decision above: [`docs/data_dictionary.md`](./docs/data_dictionary.md)

## Case Study

Built for: *Accelerating Motor Insurance Quote to Policy Conversion Through Intelligent Automation and Analytics*