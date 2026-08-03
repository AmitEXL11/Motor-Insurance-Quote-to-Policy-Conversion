const MOCK_PROFILES = [
  {
    id: 'p1', name: 'Priya Nair', age: 34, occupation: 'Software Engineer', vehicle: 'Hyundai i20', vehicleAgeStated: 2, vehicleType: 'Passenger Car', region: '28', previouslyInsured: 'No', priorDamage: 'No', priorClaims: 0, quotedPremium: 8200, channel: 'Direct', ageBand: '26-35', channelName: 'Direct',
    docStated: { name: 'Priya Nair', vehicleReg: 'KA01AB1234', vehicleModel: 'Hyundai i20', licenseValid: true, vehicleAgeYears: 2 },
    docExtracted: { name: 'Priya Nair', vehicleReg: 'KA01AB1234', vehicleModel: 'Hyundai i20', licenseValid: true, vehicleAgeYears: 2 }
  },
  {
    id: 'p2', name: 'Rohit Malhotra', age: 45, occupation: 'Business Owner', vehicle: 'Toyota Innova', vehicleAgeStated: 6, vehicleType: 'Passenger Car', region: '8', previouslyInsured: 'Yes', priorDamage: 'Yes', priorClaims: 2, quotedPremium: 15400, channel: 'Aggregator', ageBand: '36-45', channelName: 'Aggregator',
    docStated: { name: 'Rohit Malhotra', vehicleReg: 'MH12CD5678', vehicleModel: 'Toyota Innova', licenseValid: true, vehicleAgeYears: 6 },
    docExtracted: { name: 'Rohit Malhotra', vehicleReg: 'MH12CD5678', vehicleModel: 'Toyota Innova', licenseValid: true, vehicleAgeYears: 8 }
  },
  {
    id: 'p3', name: 'Sana Sheikh', age: 26, occupation: 'Marketing Executive', vehicle: 'Royal Enfield Classic', vehicleAgeStated: 1, vehicleType: 'Two-Wheeler', region: '41', previouslyInsured: 'No', priorDamage: 'No', priorClaims: 0, quotedPremium: 3100, channel: 'Direct', ageBand: '18-25', channelName: 'Direct',
    docStated: { name: 'Sana Sheikh', vehicleReg: 'DL05EF9012', vehicleModel: 'Royal Enfield Classic', licenseValid: true, vehicleAgeYears: 1 },
    docExtracted: { name: 'Sana Sheikh', vehicleReg: 'DL05EF9012', vehicleModel: 'Royal Enfield Classic', licenseValid: true, vehicleAgeYears: 1 }
  },
  {
    id: 'p4', name: 'Vikram Desai', age: 52, occupation: 'Transport Contractor', vehicle: 'Mahindra Scorpio', vehicleAgeStated: 9, vehicleType: 'Passenger Car', region: '8', previouslyInsured: 'Yes', priorDamage: 'Yes', priorClaims: 4, quotedPremium: 22000, channel: 'Broker', ageBand: '46-60', channelName: 'Broker',
    docStated: { name: 'Vikram Desai', vehicleReg: 'GJ01GH3456', vehicleModel: 'Mahindra Scorpio', licenseValid: true, vehicleAgeYears: 9 },
    docExtracted: { name: 'Vikram Desai', vehicleReg: 'GJ01GH3456', vehicleModel: 'Mahindra Scorpio', licenseValid: true, vehicleAgeYears: 9 }
  },
];

const AGENTS = [
  { key: 'customer', title: 'Customer Intelligence Agent', sub: 'Customer + Quote Dataset' },
  { key: 'document', title: 'Document Validation Agent', sub: 'Computed field diff + Claude' },
  { key: 'risk', title: 'Risk Assessment Agent', sub: 'Computed score + Claude' },
  { key: 'conversion', title: 'Conversion Prediction Agent', sub: 'Computed estimate + cohort' },
  { key: 'offer', title: 'Offer Optimization Agent', sub: 'Computed tier/premium + Claude' },
  { key: 'underwriting', title: 'Underwriting Decision Agent', sub: 'AI read vs. rule-enforced' },
  { key: 'insights', title: 'Executive Insights Agent', sub: 'Session + real Gold KPIs' },
];

let runHistory = [];
let c360Rows = [], uwRows = [], claimsRows = [], execRows = [];
let activeProfiles = MOCK_PROFILES;

// ---------- CSV ----------
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const parseLine = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseLine(line); const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] ?? '').trim());
    return obj;
  });
}

function handleUpload(evt, kind) {
  const file = evt.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (kind === 'c360') c360Rows = rows;
    else if (kind === 'uw') uwRows = rows;
    else if (kind === 'claims') claimsRows = rows;
    else if (kind === 'exec') execRows = rows;
    if (kind === 'c360' || kind === 'uw') rebuildProfilesFromData();
    updateDataStatus(); updateRealKpi();
  };
  reader.readAsText(file);
}

function updateDataStatus() {
  const parts = [];
  if (c360Rows.length) parts.push(`${c360Rows.length} customer360 rows`);
  if (uwRows.length) parts.push(`${uwRows.length} underwriting rows`);
  if (claimsRows.length) parts.push(`${claimsRows.length} claims rows`);
  if (execRows.length) parts.push(`${execRows.length} executive rows`);
  document.getElementById('dataStatus').textContent = parts.length ? 'Loaded: ' + parts.join(', ') + '.' : 'Using 4 built-in demo profiles.';
}

function updateRealKpi() {
  const el = document.getElementById('kpiReal');
  if (!execRows.length) { el.textContent = 'Upload executive_dashboard.csv to compare against your real warehouse KPIs.'; return; }
  const avg = (key) => {
    const vals = execRows.map(r => parseFloat(r[key])).filter(v => !isNaN(v));
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'n/a';
  };
  el.textContent = `Real warehouse: ${avg('conversion_rate')}% avg conversion · ${avg('claim_ratio')}% avg claim ratio (${execRows.length} days)`;
}

function rebuildProfilesFromData() {
  if (!c360Rows.length) { activeProfiles = MOCK_PROFILES; renderProfileOptions(); return; }
  const uwByCustomer = {}; uwRows.forEach(r => { uwByCustomer[r.customer_sk] = r; });
  const claimsByCustomer = {};
  claimsRows.forEach(r => { (claimsByCustomer[r.customer_sk] = claimsByCustomer[r.customer_sk] || []).push(r); });
  activeProfiles = c360Rows.slice(0, 25).map((r, i) => {
    const uw = uwByCustomer[r.customer_sk] || {};
    const custClaims = claimsByCustomer[r.customer_sk] || [];
    return {
      id: 'real' + i, name: r.customer_id || ('Customer ' + (r.customer_sk || i)),
      age: r.customer_age || 'n/a', occupation: r.customer_segment || 'n/a',
      vehicle: [uw.make, uw.model].filter(Boolean).join(' ') || 'n/a — upload underwriting.csv',
      vehicleAgeStated: uw.vehicle_age_band || 'n/a', vehicleType: uw.segment || 'n/a',
      region: r.region || 'n/a', ageBand: r.age_band || 'n/a', channelName: r.channel_name || 'n/a', channel: r.channel_name || 'n/a',
      previouslyInsured: (r.previously_insured === '1' || /true/i.test(r.previously_insured || '')) ? 'Yes' : 'No',
      priorDamage: custClaims.length ? 'Yes' : 'n/a', priorClaims: custClaims.length,
      quotedPremium: r.quoted_premium || 'n/a', realRiskScore: uw.risk_score || r.avg_risk_score || null,
      docStated: { name: r.customer_id, vehicleReg: 'n/a', vehicleModel: uw.model || 'n/a', licenseValid: true, vehicleAgeYears: uw.vehicle_age_band || 'n/a' },
      docExtracted: { name: r.customer_id, vehicleReg: 'n/a', vehicleModel: uw.model || 'n/a', licenseValid: true, vehicleAgeYears: uw.vehicle_age_band || 'n/a' },
    };
  });
  renderProfileOptions();
}

// ---------- deterministic calculations (never Claude) ----------
function computeDocumentMatch(p) {
  const keys = ['name', 'vehicleReg', 'vehicleModel', 'licenseValid', 'vehicleAgeYears'];
  const mismatches = keys.filter(k => String(p.docStated[k]) !== String(p.docExtracted[k]));
  return { total: keys.length, matched: keys.length - mismatches.length, mismatches };
}

function computeRiskScore(p) {
  if (p.realRiskScore && !isNaN(Number(p.realRiskScore))) {
    const s = Math.round(Number(p.realRiskScore));
    return { score: s, band: s >= 70 ? 'High' : s >= 40 ? 'Medium' : 'Low', source: 'your uploaded Gold layer (risk_score)' };
  }
  let s = 20;
  s += (Number(p.priorClaims) || 0) * 12;
  s += p.priorDamage === 'Yes' ? 15 : 0;
  const va = Number(p.vehicleAgeStated) || 0;
  s += va >= 7 ? 15 : va >= 4 ? 8 : 0;
  s += p.occupation === 'Transport Contractor' ? 10 : 0;
  s = Math.max(5, Math.min(95, s));
  return { score: s, band: s >= 70 ? 'High' : s >= 40 ? 'Medium' : 'Low', source: 'heuristic (prior claims, damage, vehicle age, occupation)' };
}

function computeCohortConversion(p) {
  if (!c360Rows.length) return null;
  let matched = c360Rows.filter(r => (p.ageBand !== 'n/a' && r.age_band === p.ageBand) || (p.channelName !== 'n/a' && r.channel_name === p.channelName));
  if (matched.length < 5) matched = c360Rows;
  const converted = matched.filter(r => r.conversion_flag === '1' || /true/i.test(r.conversion_flag || '')).length;
  return { rate: Math.round(100 * converted / matched.length), n: matched.length };
}

function computeConversionScore(p, cohort) {
  let s = 50;
  s += p.channel === 'Direct' ? 12 : p.channel === 'Aggregator' ? -12 : 0;
  s += p.previouslyInsured === 'Yes' ? 8 : -5;
  const prem = Number(p.quotedPremium) || 0;
  s += prem > 15000 ? -10 : prem < 5000 ? 8 : 0;
  s += p.priorDamage === 'Yes' ? -6 : 0;
  s = Math.max(5, Math.min(95, Math.round(s)));
  return s;
}

function computeOffer(p, riskBand) {
  const tier = riskBand === 'High' ? 'Third-Party' : riskBand === 'Medium' ? 'Comprehensive' : 'Comprehensive+';
  const prem = Number(p.quotedPremium) || 0;
  const addons = p.vehicleType === 'Two-Wheeler' ? ['Zero Depreciation'] : (prem > 10000 ? ['Zero Depreciation', 'Engine Protect'] : ['Roadside Assistance']);
  const adj = riskBand === 'High' ? 1.12 : riskBand === 'Low' ? 0.95 : 1.0;
  return { tier, addons, recommendedPremium: prem ? Math.round(prem * adj) : 'n/a' };
}

function computeFinalDecision(riskBand, docMatch, aiRecommendation) {
  const decision = (riskBand === 'High' || docMatch.mismatches.length > 0) ? 'Refer to Manual Review' : 'Approve';
  const overridden = aiRecommendation && aiRecommendation !== decision;
  return { decision, overridden };
}

// ---------- UI ----------
function renderProfileOptions() {
  const sel = document.getElementById('profileSel');
  sel.innerHTML = activeProfiles.map(p => `<option value="${p.id}">${p.name} — ${p.vehicle}</option>`).join('');
}

function currentProfile() { return activeProfiles.find(p => p.id === document.getElementById('profileSel').value); }

function renderAgentGrid() {
  document.getElementById('agentGrid').innerHTML = AGENTS.map((a, i) => `
    <div class="agent-card" id="card-${a.key}">
      <div class="agent-num">${i + 1}</div>
      <div class="agent-title">${a.title}</div>
      <div class="agent-sub">${a.sub}</div>
      <div class="agent-out" id="out-${a.key}"></div>
    </div>`).join('');
}

async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 1000,
      system: system + " Respond with ONLY valid JSON, no markdown fences. Explain and narrate the given computed numbers — do not invent or override them.",
      messages: [{ role: "user", content: user }]
    })
  });
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function setCard(key, state) { document.getElementById(`card-${key}`).className = 'agent-card ' + state; }

function setOut(key, html) { const el = document.getElementById(`out-${key}`); el.innerHTML = html; el.classList.add('show'); }

function pushLog(profile, text, badgeClass, badgeText) {
  const list = document.getElementById('logList');
  if (list.querySelector('.log-empty')) list.innerHTML = '';
  const e = document.createElement('div'); e.className = 'log-entry';
  e.innerHTML = `<b>${profile.name}</b>${text} <span class="badge ${badgeClass}">${badgeText}</span>`;
  list.prepend(e);
}

async function runPipeline() {
  const btn = document.getElementById('runBtn'); btn.disabled = true;
  const p = currentProfile(); const question = document.getElementById('question').value;
  AGENTS.forEach(a => { setCard(a.key, ''); document.getElementById('out-' + a.key).classList.remove('show'); });
  const ctx = { profile: p }; // shared pipeline context, grows with every agent
  try {
    // 1. Customer Intelligence
    setCard('customer', 'active');
    const cust = await callClaude(
      "You are the Customer Intelligence Agent. Given a customer profile and their question, return JSON: {\"summary\":\"one sentence profile summary\",\"answer\":\"clear 2-3 sentence answer grounded in the profile\"}.",
      `Profile: ${JSON.stringify(p)}\nQuestion: ${question}`);
    ctx.customer = cust;
    setCard('customer', 'done'); setOut('customer', `<span class="tag claude">Claude</span><br><b>${cust.summary}</b><br>${cust.answer}`);

    // 2. Document Validation — computed diff, Claude narrates
    setCard('document', 'active');
    const docMatch = computeDocumentMatch(p);
    ctx.documentMatch = docMatch;
    const docNote = await callClaude(
      "You are the Document Validation Agent. You're given an already-computed field match result — narrate it in one sentence, don't re-evaluate it.",
      `Computed result: ${docMatch.matched} of ${docMatch.total} fields matched. Mismatched fields: ${docMatch.mismatches.join(', ') || 'none'}.`);
    const docFlag = docMatch.mismatches.length > 0;
    setCard('document', docFlag ? 'flagged' : 'done');
    setOut('document', `<span class="tag computed">computed</span><span class="tag claude">Claude</span><br><b>${docMatch.matched}/${docMatch.total} fields matched</b> (${Math.round(100 * docMatch.matched / docMatch.total)}% confidence)<br>${docNote.note || docNote.summary || JSON.stringify(docNote)}`);

    // 3. Risk Assessment — computed score, Claude explains
    setCard('risk', 'active');
    const risk = computeRiskScore(p);
    ctx.risk = risk;
    const riskNote = await callClaude(
      "You are the Risk Assessment Agent. You're given an already-computed risk score — explain in one sentence why it landed where it did, don't recompute it.",
      `Computed: score ${risk.score}/100, band ${risk.band}, source: ${risk.source}. Inputs: prior claims=${p.priorClaims}, prior damage=${p.priorDamage}, vehicle age=${p.vehicleAgeStated}, occupation=${p.occupation}.`);
    setCard('risk', 'done');
    setOut('risk', `<span class="tag computed">computed</span><span class="tag claude">Claude</span><br><b>${risk.score}/100 — ${risk.band}</b> (${risk.source})<br>${riskNote.note || riskNote.summary || JSON.stringify(riskNote)}`);

    // 4. Conversion Prediction — computed heuristic + real cohort if available
    setCard('conversion', 'active');
    const cohort = computeCohortConversion(p);
    const convScore = computeConversionScore(p, cohort);
    ctx.conversion = { estimate: convScore, cohort };
    const convNote = await callClaude(
      "You are the Conversion Prediction Agent. You're given a computed conversion likelihood estimate and, if available, a real cohort benchmark from uploaded data. Give the top 2 reasons behind the estimate and one recommended action to improve it. Return JSON: {\"reasons\":[\"...\",\"...\"],\"action\":\"one sentence\"}.",
      `Computed conversion estimate: ${convScore}%. Channel: ${p.channel}, previously insured: ${p.previouslyInsured}, quoted premium: ${p.quotedPremium}.${cohort ? ` Real cohort benchmark from uploaded data: ${cohort.rate}% (n=${cohort.n}).` : ' No real data uploaded — cohort benchmark unavailable.'}`);
    setCard('conversion', 'done');
    setOut('conversion', `<span class="tag computed">computed</span><span class="tag claude">Claude</span><br><b>${convScore}% likely to convert</b>${cohort ? ` · cohort: ${cohort.rate}% (n=${cohort.n})` : ' · upload real data for a cohort benchmark'}<br>${(convNote.reasons || []).join('; ')}<br>${convNote.action || ''}`);

    // 5. Offer Optimization — computed tier/premium, Claude explains
    setCard('offer', 'active');
    const offer = computeOffer(p, risk.band);
    ctx.offer = offer;
    const offerNote = await callClaude(
      "You are the Offer Optimization Agent. Explain the rationale for an already-computed coverage recommendation in one sentence. Don't recompute the numbers.",
      `Computed: tier=${offer.tier}, addons=${offer.addons.join(', ')}, recommended premium=${offer.recommendedPremium}. Customer: ${p.name}, vehicle: ${p.vehicle}, risk band: ${risk.band}.`);
    setCard('offer', 'done');
    setOut('offer', `<span class="tag computed">computed</span><span class="tag claude">Claude</span><br><b>${offer.tier}</b> + ${offer.addons.join(', ')} · ₹${offer.recommendedPremium}<br>${offerNote.note || offerNote.summary || JSON.stringify(offerNote)}`);

    // 6. Underwriting Decision — genuine AI read vs. rule-enforced final
    setCard('underwriting', 'active');
    const aiRead = await callClaude(
      "You are the Underwriting Decision Agent giving your own independent read, before business rules are applied. Return JSON: {\"recommendation\":\"Approve|Refer to Manual Review\",\"rationale\":\"one sentence\"}.",
      `Risk band: ${risk.band} (${risk.score}/100). Document match: ${docMatch.matched}/${docMatch.total}. Conversion estimate: ${convScore}%.`);
    const final = computeFinalDecision(risk.band, docMatch, aiRead.recommendation);
    ctx.underwriting = { aiRead, final };
    setCard('underwriting', final.decision !== 'Approve' ? 'flagged' : 'done');
    setOut('underwriting', `<span class="tag claude">Claude read</span><span class="tag computed">rule-enforced</span><br>AI recommended: <b>${aiRead.recommendation}</b><br>Final decision: <b>${final.decision}</b>${final.overridden ? ' <span class="badge warn">overridden</span>' : ''}<br>${aiRead.rationale}`);

    // 7. Executive Insights — deterministic only
    setCard('insights', 'active');
    runHistory.push({ straightThrough: final.decision === 'Approve', overridden: final.overridden, conversionEst: convScore });
    renderKPIs();
    setCard('insights', 'done');
    setOut('insights', `<span class="tag computed">computed</span><br>Session updated — ${runHistory.length} run(s) logged.`);

    pushLog(p, final.decision === 'Approve' ? ' — approved straight-through.' : ' — referred to manual review.', final.decision === 'Approve' ? 'ok' : 'warn', final.decision === 'Approve' ? 'approved' : 'referred');
  } catch (e) {
    setOut('insights', 'Error: ' + e.message);
  }
  btn.disabled = false;
}

function renderKPIs() {
  const n = runHistory.length;
  const stRate = n ? Math.round(100 * runHistory.filter(r => r.straightThrough).length / n) : 0;
  const overrideRate = n ? Math.round(100 * runHistory.filter(r => r.overridden).length / n) : 0;
  const avgConv = n ? Math.round(runHistory.reduce((s, r) => s + r.conversionEst, 0) / n) : null;
  document.getElementById('kpiMain').textContent = stRate + '%';
  document.getElementById('kpiRuns').textContent = n;
  document.getElementById('kpiOverride').textContent = overrideRate + '%';
  document.getElementById('kpiConv').textContent = avgConv !== null ? avgConv + '%' : '—';
}

// Initial setup on load
renderProfileOptions(); 
renderAgentGrid(); 
renderKPIs(); 
updateRealKpi();