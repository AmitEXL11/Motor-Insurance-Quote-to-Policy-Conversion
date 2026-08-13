# Demo Guide — Agentic Conversion Intelligence Platform

**Live URL:** `https://amitexl11.github.io/Motor-Insurance-Quote-to-Policy-Conversion/demo.html`
**Tech stack:** HTML · Claude claude-sonnet-4-6 API · EXL brand (navy `#003057` · orange `#F26522`)
**File location:** `docs/demo.html`

---

## What This Demo Shows

This is a live multi-agent AI pipeline that demonstrates how an insurer can recover abandoned motor insurance quotes. It is **not a mockup** — every agent run makes real Claude API calls and the pipeline logic is computed in JavaScript.

The demo answers one core business question:

> *"How does an insurer know a quote is about to be lost — and what does it do about it in real time?"*

---

## The Three-Panel Layout

```
┌─────────────────────┬──────────────────────────────┬────────────────────────┐
│  Panel 1            │  Panel 2                     │  Panel 3               │
│  Abandoned Quote    │  Agent Orchestration Engine  │  WhatsApp Channel      │
│  Queue              │                              │                        │
│                     │  6 agent nodes               │  Live Claude-generated │
│  5 customer         │  + Execution trace log       │  outreach conversation │
│  profiles           │  + Next Best Action panel    │                        │
│                     │                              │  Customer can reply    │
│  Click any card     │  Runs sequentially on        │  and accept policy     │
│  to trigger         │  card click                  │  in one conversation   │
└─────────────────────┴──────────────────────────────┴────────────────────────┘
```

**Session KPI bar** at the bottom of Panel 2 tracks: Runs · Recovered · Recovery Rate · Premium Recovered — updates live across all 5 profiles.

---

## The 5 Customer Profiles

Each profile represents a distinct drop-off reason. All data is hardcoded in the demo (no CSV dependency) so it works offline except for the Claude API calls.

### QT-4412 — Priya Sharma · Bengaluru
| Field | Value |
|---|---|
| Vehicle | Maruti Swift (2022) · Hatchback |
| Drop-off reason | **Price shock** at Premium Confirmation |
| Quoted premium | ₹9,800/yr |
| Risk score | 22/100 — Low |
| Prior claims | 0 |
| Telematics eligible | Yes |
| Previously insured | Yes |
| Mileage | 7,500 km/yr |

**What the agents do:** Detect price abandonment → compute telematics reward (−8%) + renewal loyalty (−5%) + low mileage (−6%) → revised premium ₹7,644 → Claude drafts personalised WhatsApp message.

---

### QT-5891 — Rohit Malhotra · Mumbai
| Field | Value |
|---|---|
| Vehicle | Toyota Innova Crysta (2019) · MUV |
| Drop-off reason | **Underwriting hold** — pending 4 days |
| Quoted premium | ₹18,500/yr |
| Risk score | 58/100 — Medium |
| Prior claims | 1 (windshield, 2022) |
| Telematics eligible | No |
| STP eligible | No |

**What the agents do:** Detect 4-day UW silence → classify as Assisted Review → assign to available underwriter → Claude drafts urgency-aware WhatsApp message noting expected resolution time.

---

### QT-6230 — Ananya Krishnan · Chennai
| Field | Value |
|---|---|
| Vehicle | Honda Activa 6G (2023) · Two-Wheeler |
| Drop-off reason | **Document friction** at upload stage |
| Quoted premium | ₹2,400/yr |
| Risk score | 30/100 — Low |
| Prior claims | 0 |
| Doc mismatches | RC book too large · DL scan unclear |
| STP eligible | Yes (after doc fix) |

**What the agents do:** Detect document issues → enable DigiLocker API pathway for RC → offer AI OCR pre-check for licence → Claude drafts guided re-upload message with one-tap links.

---

### QT-7104 — Vikram Singh · Delhi
| Field | Value |
|---|---|
| Vehicle | Mahindra XUV700 (2021) · SUV |
| Drop-off reason | **High-risk UW hold** — pending 6 days |
| Quoted premium | ₹24,000/yr |
| Risk score | 74/100 — High |
| Prior claims | 3 |
| Telematics eligible | Yes |
| LTV | ₹1,45,000 |

**What the agents do:** Flag High risk → telematics opt-in pathway (−9% = ₹21,840 revised) → Senior UW + monitored risk pricing → Claude emphasises high LTV in outreach and telematics benefit.

---

### QT-8847 — Sana Ansari · Hyderabad
| Field | Value |
|---|---|
| Vehicle | Hyundai Creta (2020) · SUV |
| Drop-off reason | **Channel drop-off** — aggregator hand-off |
| Quoted premium | ₹13,200/yr |
| Risk score | 28/100 — Low |
| Prior claims | 0 |
| Telematics eligible | Yes |
| STP eligible | Yes |

**What the agents do:** Detect aggregator cold drop → apply direct channel discount (−7% = ₹12,276) → STP approved (instant issuance) → Claude drafts competitive, urgency-driven WhatsApp message.

---

## The 6-Agent Pipeline

When you click a quote card, these 6 agents run in sequence. Each one reads the output of all agents before it.

### Agent 1 — Journey Monitoring Agent
**Purpose:** Detect exactly where and why the quote was abandoned.

**Inputs:** `dropPoint`, `dropReason`, `timeInStage`, `funnelPct`, `riskScore`, `riskBand`

**What it computes:**
- Stage label (e.g. "Premium Confirmation")
- Time stuck (e.g. "18 hrs")
- Funnel depth percentage
- Abandonment risk threshold check

**Output shown:** `Stage: [dropPoint] · Time stuck: [timeInStage] · Funnel depth: [funnelPct]% · Triggered: abandon risk threshold breached`

---

### Agent 2 — Propensity Agent
**Purpose:** Score the probability this customer will convert if re-engaged.

**Inputs:** `channel`, `prevInsured`, `priorClaims`, `riskBand`, `mileageKm`, `behavioural.visits`

**Scoring formula (JavaScript, not Claude):**

```javascript
let s = 50;
s += channel includes 'Direct' ? +14 : -8
s += prevInsured ? +10 : -4
s += priorClaims === 0 ? +8 : priorClaims === 1 ? -5 : -18
s += riskBand === 'Low' ? +10 : riskBand === 'High' ? -20 : -2
s += mileageKm < 8000 ? +6 : mileageKm > 15000 ? -6 : 0
s += visits >= 4 ? +6 : 0
// Clamped: max(8, min(94, s))
```

**Output shown:** `Conversion probability: [X]% · Abandon risk: [Y]% · Priority: [HIGH/MEDIUM/URGENT]`

---

### Agent 3 — Root Cause Intelligence Agent
**Purpose:** Explain precisely why the customer dropped, not just that they did.

**Inputs:** `dropReason`, `timeInStage`, `priorClaims`, `docMismatches`

**Root cause messages by reason:**

| Reason | Root cause output |
|---|---|
| `price` | Premium 18% above peer segment · competitor aggregator comparison likely |
| `docs` | Document upload failure: [N] issues · friction score: HIGH · first-time buyer pattern |
| `uw` | Manual review delay: [N days] · SLA breach · customer silence escalating |
| `channel` | Aggregator hand-off gap · no direct re-engagement · 3–4 insurer comparison active |

---

### Agent 4 — Underwriting Auto-Pilot Agent
**Purpose:** Make an automated underwriting decision without human intervention where possible.

**Inputs:** `riskBand`, `stpEligible`, `docMismatches`, `priorClaims`, `telematicsOk`

**Decision logic (JavaScript):**

```javascript
// Auto Approve (STP)
if riskBand !== 'High' AND docMismatches.length === 0 AND priorClaims < 2
  → "Auto Approve (STP)" · Straight-through processing

// Telematics Pathway (High risk)
if riskBand === 'High' AND telematicsOk
  → "Telematics Pathway" · Senior UW + telematics offer

// Assisted Review (Medium risk or doc issues)
else
  → "Assisted Review" · Assigned underwriter · SLA 24 hrs
```

**STP counter:** Increments the session KPI `STP Approved` count for every Auto Approve decision.

---

### Agent 5 — Customer Engagement Agent *(Claude API call)*
**Purpose:** Generate a personalised WhatsApp message that will re-engage this specific customer for this specific reason.

**System prompt:**
```
You are EXL's Omnichannel Outreach AI for a motor insurer. Write a warm, brief,
personalised WhatsApp message to recover an abandoned insurance quote. Use only
the computed data provided. Keep it under 75 words. Tone: helpful human agent,
not a bot. Return JSON: {"greeting":"...","offerLine":"...","cta":"..."}
```

**User message includes:**
- Customer name, age, city, vehicle
- Drop-off reason and stage
- Original premium, revised premium, savings amount (all JavaScript-computed)
- Cover tier, add-ons, STP eligibility
- Customer context (behavioural profile)

**Output:** Three fields rendered in the WhatsApp panel:
- `greeting` → opening message with customer name
- `offerLine` → one sentence on the revised offer
- `cta` → button label (max 4 words)

**Fallback:** If the API call fails, a hardcoded message is shown so the demo never breaks.

---

### Agent 6 — Next Best Action Agent *(Claude API call)*
**Purpose:** Give the sales team 3 prioritised actions with confidence scores.

**System prompt:**
```
Given a customer insurance profile and conversion data, return exactly 3
prioritised actions for the sales team. Return JSON:
{"actions":[{"action":"...","confidence":85},{"action":"...","confidence":70},{"action":"...","confidence":55}]}
```

**User message includes:** Customer name, propensity score, abandon risk, LTV, renewal probability, cross-sell score, UW decision, offer sent status.

**Output:** Rendered in the **Next Best Actions** panel below the agent nodes in Panel 2. Each action shows the text and a confidence % badge.

---

## Computed vs Claude — The Key Distinction

This is the most important technical point in the demo.

| What is **JavaScript-computed** | What **Claude does** |
|---|---|
| Risk score (0–100) | Writes the WhatsApp greeting |
| Propensity score | Writes the offer summary line |
| Revised premium (with discount breakdown) | Suggests next best actions |
| STP eligibility check | Writes the policy issuance confirmation |
| Cover tier and add-ons | Answers live customer questions |
| Doc mismatch detection | — |
| UW decision (STP / Assisted / Telematics) | — |
| Conversion KPIs (runs, recovered, premium) | — |

**Why this matters:** Claude narrates computed results — it never invents numbers. This makes outputs explainable, auditable, and IRDAI-compliant. A judge or CIO can verify every number independently.

---

## The WhatsApp Panel

The right panel simulates the customer-facing WhatsApp channel.

### Message flow after pipeline runs:
1. **Typing indicator** appears (3 bouncing dots)
2. **Greeting message** posts (Claude-generated, personalised)
3. Short pause, typing indicator again
4. **Offer card** posts with:
   - Cover tier
   - Add-ons
   - Original premium (struck context)
   - Revised premium (green)
   - Savings amount (orange)
   - Issuance time (Instant if STP, Within 24 hrs otherwise)
   - Accept button with Claude's CTA label
5. Input box and send button activate — **customer can now reply**

### Live conversation:
After the offer posts, the customer input is active. You can type any question:
- "What does zero dep cover?"
- "Can I pay in EMI?"
- "How long will it take?"

Claude responds in context — it knows the customer's name, vehicle, offer premium, and cover tier. Conversation history is maintained across turns.

### Policy acceptance:
Clicking the accept button:
1. Posts `"Yes, I'd like to go ahead with this offer."` as a user message
2. Agent 6 (Policy Issuance) activates
3. Claude generates a warm confirmation message
4. Session KPI `Recovered` increments
5. `Premium Recovered` adds the revised premium amount
6. Green `Policy issued — customer onboarded` banner appears

---

## Session KPIs

The bottom bar of Panel 2 tracks across all runs in the current browser session:

| KPI | How computed |
|---|---|
| Runs | Increments on every quote card click |
| Recovered | Increments when customer clicks Accept |
| Recovery Rate | `Recovered / Runs × 100` |
| Premium Recovered | Sum of all accepted revised premiums |

These reset on page refresh. To demonstrate all 5 profiles, click each card, run the pipeline, and accept the offer — the KPIs accumulate.

---

## Discount Calculation Reference

Discounts are computed deterministically before Claude is called:

| Discount | Condition | Amount |
|---|---|---|
| Telematics reward | `dropReason = 'price'` AND `telematicsOk = true` | −8% of quoted premium |
| Renewal loyalty | Above + `prevInsured = true` | −5% of quoted premium |
| Low mileage | Above + `mileageKm < 8000` | −6% of quoted premium |
| Direct channel | `dropReason = 'channel'` | −7% of quoted premium |
| Telematics (UW) | `dropReason = 'uw'` AND `telematicsOk = true` | −9% of quoted premium |

Discounts are additive. Maximum possible discount: −19% (Priya's profile: telematics + loyalty + low mileage).

---

## Cover Tier Logic

```javascript
if riskBand === 'High'   → 'Third-Party Comprehensive' + ['Engine Protect', 'Zero Dep']
if riskBand === 'Medium' → 'Comprehensive' + ['Zero Dep', 'RSA']
if vehicleType === 'Two-Wheeler' → 'Comprehensive' + ['Zero Dep']
else (Low risk, 4-wheeler) → 'Comprehensive+' + ['Zero Dep', 'Engine Protect', 'RSA']
```

---

## Running the Demo — Step by Step

1. Open `https://amitexl11.github.io/Motor-Insurance-Quote-to-Policy-Conversion/demo.html`
2. Panel 1 shows 5 quote cards with abandon risk %, propensity %, and drop-off tag
3. Click any card — the pipeline starts immediately
4. Watch Panel 2: agent nodes turn orange (running) → green (done) → flagged (red for high risk)
5. Watch Panel 3: typing indicator → greeting → offer card appears
6. Type a question in the WhatsApp input to test live conversation
7. Click the accept button to simulate conversion and watch session KPIs update
8. Click a different quote card to run a new profile — session KPIs accumulate

**Recommended demo order for judges:**
1. **Priya** (price shock) — clearest before/after premium story
2. **Sana** (channel drop) — STP + instant issuance
3. **Ananya** (doc friction) — DigiLocker pathway
4. **Rohit** (UW delay) — medium risk, assisted review
5. **Vikram** (high risk) — telematics pathway, highest LTV

---

## Technical Notes

### API authentication
The Claude API key is injected by the Claude.ai environment when running inside this chat. When hosted on GitHub Pages, you need to add your own key to `docs/demo.html`:

```javascript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'sk-ant-YOUR-KEY-HERE',
  'anthropic-version': '2023-06-01'
}
```

### Fallback behaviour
Every Claude API call is wrapped in `try/catch`. If the API is unavailable, a sensible hardcoded message renders so the demo never shows a broken state.

### No CSV dependency
Unlike the dashboard, the demo uses hardcoded profile data. It works offline (except Claude calls) and does not require the Gold layer CSVs.

### Conversation history
`convHistory` array maintains the full message history for the WhatsApp conversation. Passed to Claude on every message so the AI has context across turns.

### Agent state rendering
`agentStates` object holds `{state, text}` for each of the 6 agent nodes. Panel 2 re-renders from this object every time any agent state changes. States: `idle` · `running` · `done` · `flagged`.

---

## File Structure

```
docs/demo.html          ← Single self-contained file (HTML + CSS + JS)
```

No external dependencies except:
- Anthropic API (`api.anthropic.com/v1/messages`)
- No npm, no build step, no server required
