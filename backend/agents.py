import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from anthropic import Anthropic
from prompts import (
    AI_MONITORING_PROMPT,
    CLAIMS_PROMPT,
    CUSTOMER_PROMPT,
    EXECUTIVE_PROMPT,
    SALES_PROMPT,
    UNDERWRITING_PROMPT,
)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("policypilot.agent")

# Initialize Anthropic Client
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ==========================================================
# 1. Deterministic Calculation Engines
# ==========================================================

def compute_document_match(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Calculates exact field discrepancies between stated vs extracted documents."""
    doc_stated = profile.get("docStated") or {}
    doc_extracted = profile.get("docExtracted") or {}
    keys = ["name", "vehicleReg", "vehicleModel", "licenseValid", "vehicleAgeYears"]

    mismatches = [
        k for k in keys if str(doc_stated.get(k, "")).strip().lower() != str(doc_extracted.get(k, "")).strip().lower()
    ]
    matched_count = len(keys) - len(mismatches)
    confidence = round((matched_count / len(keys)) * 100) if keys else 100

    return {
        "total": len(keys),
        "matched": matched_count,
        "mismatches": mismatches,
        "confidence_pct": confidence,
        "status": "PASS" if not mismatches else "FLAGGED",
    }


def compute_risk_score(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Computes risk score deterministically or pulls from Gold warehouse layer."""
    real_score = profile.get("realRiskScore")
    if real_score is not None:
        try:
            score = round(float(real_score))
            band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
            return {"score": score, "band": band, "source": "Gold Layer (Real Warehouse)"}
        except (ValueError, TypeError):
            pass

    score = 20
    score += int(profile.get("priorClaims", 0) or 0) * 12
    score += 15 if str(profile.get("priorDamage", "")).lower() == "yes" else 0

    va = int(profile.get("vehicleAgeStated", 0) or 0)
    score += 15 if va >= 7 else (8 if va >= 4 else 0)
    score += 10 if str(profile.get("occupation", "")).lower() == "transport contractor" else 0

    score = max(5, min(95, score))
    band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
    return {"score": score, "band": band, "source": "Heuristic Engine"}


def compute_conversion_score(profile: Dict[str, Any], cohort: Optional[Dict[str, Any]] = None) -> int:
    """Calculates conversion likelihood percentage."""
    score = 50
    channel = str(profile.get("channel", "")).lower()
    score += 12 if channel == "direct" else (-12 if channel == "aggregator" else 0)
    score += 8 if str(profile.get("previouslyInsured", "")).lower() == "yes" else -5

    prem = float(profile.get("quotedPremium", 0) or 0)
    score += -10 if prem > 15000 else (8 if prem < 5000 else 0)
    score += -6 if str(profile.get("priorDamage", "")).lower() == "yes" else 0

    if cohort and "rate" in cohort:
        score = round((score + float(cohort["rate"])) / 2)

    return max(5, min(95, score))


def compute_offer(profile: Dict[str, Any], risk_band: str) -> Dict[str, Any]:
    """Determines tier, add-ons, and pricing adjustment deterministically."""
    tier = "Third-Party" if risk_band == "High" else ("Comprehensive" if risk_band == "Medium" else "Comprehensive+")
    prem = float(profile.get("quotedPremium", 0) or 0)
    v_type = str(profile.get("vehicleType", "")).lower()

    if "two" in v_type or "bike" in v_type:
        addons = ["Zero Depreciation"]
    elif prem > 10000:
        addons = ["Zero Depreciation", "Engine Protect"]
    else:
        addons = ["Roadside Assistance"]

    adj = 1.12 if risk_band == "High" else (0.95 if risk_band == "Low" else 1.0)
    recommended_prem = round(prem * adj) if prem > 0 else 0.0

    return {"tier": tier, "addons": addons, "recommendedPremium": recommended_prem}


def compute_final_decision(risk_band: str, doc_match: Dict[str, Any], ai_recommendation: str) -> Dict[str, Any]:
    """Applies strict underwriting governance rules over AI output."""
    decision = "Refer to Manual Review" if (risk_band == "High" or len(doc_match["mismatches"]) > 0) else "Approve"
    overridden = bool(ai_recommendation and ai_recommendation.lower() != decision.lower())
    return {"decision": decision, "overridden": overridden}


# ==========================================================
# 2. Guardrails & Fallback JSON Parsing
# ==========================================================

def clean_json_string(raw_text: str) -> str:
    """Removes markdown code fences and cleans leading/trailing whitespace."""
    text = re.sub(r"```json\s*", "", raw_text)
    text = re.sub(r"```\s*", "", text)
    return text.strip()


def run_claude_with_guardrails(
    system_prompt: str,
    user_prompt: str,
    fallback_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes Claude Sonnet call with structured JSON enforcement,
    error handling, and automatic schema fallback recovery.
    """
    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            temperature=0.1,  # Low temperature for deterministic formatting
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        raw_text = response.content[0].text
        cleaned = clean_json_string(raw_text)
        return json.loads(cleaned)

    except json.JSONDecodeError as err:
        logger.warning(f"JSONDecodeError encountered. Attempting regex extract. Error: {str(err)}")
        # Attempt to extract JSON via regex if extra prose exists
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        logger.error("Failed to parse JSON from Claude response. Returning safe fallback schema.")
        fallback_copy = fallback_dict.copy()
        fallback_copy["_parse_warning"] = "Fallback applied: Invalid JSON output from LLM."
        return fallback_copy

    except Exception as err:
        logger.error(f"Anthropic API call failed: {str(err)}")
        fallback_copy = fallback_dict.copy()
        fallback_copy["_error"] = str(err)
        return fallback_copy


# ==========================================================
# 3. Individual Agents (7-Agent Sequence)
# ==========================================================

def run_agent_1_customer(profile: Dict[str, Any], question: str) -> Dict[str, Any]:
    system_prompt = (
        "You are the Customer Intelligence Agent. Return valid JSON:\n"
        '{"summary":"1 sentence profile overview","answer":"2 sentence direct response to user question"}'
    )
    user_prompt = f"Profile: {json.dumps(profile)}\nQuestion: {question}"
    fallback = {
        "summary": f"Customer profile for {profile.get('name', 'Applicant')}.",
        "answer": "Your premium reflects vehicle parameters, location risk, and prior driver history."
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


def run_agent_2_document(doc_match: Dict[str, Any]) -> Dict[str, Any]:
    system_prompt = (
        "You are the Document Validation Agent. Return valid JSON:\n"
        '{"narrative":"1 sentence explaining field match results"}'
    )
    user_prompt = f"Computed Match: {doc_match['matched']}/{doc_match['total']}. Mismatches: {doc_match['mismatches']}"
    fallback = {
        "narrative": f"Validated {doc_match['matched']} of {doc_match['total']} fields successfully with {len(doc_match['mismatches'])} discrepancy."
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


def run_agent_3_risk(risk: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
    system_prompt = (
        "You are the Risk Assessment Agent. Return valid JSON:\n"
        '{"explanation":"1 sentence explanation of risk score driver"}'
    )
    user_prompt = f"Computed Risk: {risk['score']}/100 ({risk['band']} band). Source: {risk['source']}. Vehicle age: {profile.get('vehicleAgeStated')}, Claims: {profile.get('priorClaims')}."
    fallback = {
        "explanation": f"Assigned {risk['band']} risk band based on claims history and vehicle parameters."
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


def run_agent_4_conversion(conv_score: int, profile: Dict[str, Any], cohort: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    system_prompt = (
        "You are the Conversion Prediction Agent. Return valid JSON:\n"
        '{"reasons":["reason 1","reason 2"],"action":"1 sentence key recommendation"}'
    )
    user_prompt = f"Conversion Score: {conv_score}%. Channel: {profile.get('channel')}, Quoted Premium: {profile.get('quotedPremium')}, Cohort Data: {json.dumps(cohort)}"
    fallback = {
        "reasons": ["Channel conversion sensitivity", "Quoted premium baseline"],
        "action": "Offer dynamic quote discount to optimize channel conversion."
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


def run_agent_5_offer(offer: Dict[str, Any], profile: Dict[str, Any], risk_band: str) -> Dict[str, Any]:
    system_prompt = (
        "You are the Offer Optimization Agent. Return valid JSON:\n"
        '{"rationale":"1 sentence coverage tier justification"}'
    )
    user_prompt = f"Computed Offer: Tier={offer['tier']}, Addons={offer['addons']}, RecPremium={offer['recommendedPremium']}. Risk Band: {risk_band}."
    fallback = {
        "rationale": f"Recommended {offer['tier']} coverage with tailored add-ons to align with risk profile."
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


def run_agent_6_underwriting(risk: Dict[str, Any], doc_match: Dict[str, Any]) -> Dict[str, Any]:
    system_prompt = (
        "You are the Underwriting Decision Agent. Give your independent read. Return valid JSON:\n"
        '{"recommendation":"Approve|Refer to Manual Review","rationale":"1 sentence justification"}'
    )
    user_prompt = f"Risk Score: {risk['score']}, Risk Band: {risk['band']}. Document Mismatches: {doc_match['mismatches']}."
    fallback = {
        "recommendation": "Refer to Manual Review" if risk["band"] == "High" or doc_match["mismatches"] else "Approve",
        "rationale": "Automated underwriting decision applied based on risk threshold rules."
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


def run_agent_7_executive(pipeline_summary: Dict[str, Any]) -> Dict[str, Any]:
    system_prompt = EXECUTIVE_PROMPT
    user_prompt = f"Execution Context Summary: {json.dumps(pipeline_summary)}"
    fallback = {
        "executive_summary": "Pipeline execution completed with rule enforcement.",
        "key_findings": ["Risk score within range", "Document verification complete"],
        "business_impact": "Maintained underwriting governance standards.",
        "recommendations": ["Optimize automated STP rules for low-risk cohorts."],
        "expected_roi": "+5% STP Efficiency"
    }
    return run_claude_with_guardrails(system_prompt, user_prompt, fallback)


# ==========================================================
# 4. Pipeline Orchestrator (Shared Context Flow)
# ==========================================================

def process_pipeline(profile: Dict[str, Any], question: str, cohort_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Executes all 7 agents sequentially over a shared context state.
    """
    context: Dict[str, Any] = {"profile": profile}

    # Agent 1: Customer Intelligence Agent
    agent1_out = run_agent_1_customer(profile, question)
    context["customer"] = agent1_out

    # Agent 2: Document Validation Agent (Computed + LLM Narrative)
    doc_match = compute_document_match(profile)
    agent2_out = run_agent_2_document(doc_match)
    context["document"] = {"computed": doc_match, "llm": agent2_out}

    # Agent 3: Risk Assessment Agent (Computed + LLM Narrative)
    risk = compute_risk_score(profile)
    agent3_out = run_agent_3_risk(risk, profile)
    context["risk"] = {"computed": risk, "llm": agent3_out}

    # Agent 4: Conversion Prediction Agent (Computed + LLM Insight)
    conv_score = compute_conversion_score(profile, cohort_data)
    agent4_out = run_agent_4_conversion(conv_score, profile, cohort_data)
    context["conversion"] = {"score": conv_score, "llm": agent4_out}

    # Agent 5: Offer Optimization Agent (Computed + LLM Rationale)
    offer = compute_offer(profile, risk["band"])
    agent5_out = run_agent_5_offer(offer, profile, risk["band"])
    context["offer"] = {"computed": offer, "llm": agent5_out}

    # Agent 6: Underwriting Agent (AI Read vs Rule-Enforced Final)
    agent6_out = run_agent_6_underwriting(risk, doc_match)
    final_decision = compute_final_decision(risk["band"], doc_match, agent6_out.get("recommendation", ""))
    context["underwriting"] = {"ai_read": agent6_out, "final_decision": final_decision}

    # Agent 7: Executive Insights Agent
    pipeline_summary = {
        "customer": profile.get("name"),
        "stp_status": final_decision["decision"] == "Approve",
        "overridden": final_decision["overridden"],
        "conversion_score": conv_score,
        "risk_band": risk["band"]
    }
    agent7_out = run_agent_7_executive(pipeline_summary)
    context["executive_insights"] = agent7_out

    return context


# ==========================================================
# 5. Intent Router Endpoint (For Ad-hoc /chat Route)
# ==========================================================

def detect_intent(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["quote", "conversion", "sales", "premium", "funnel"]):
        return "sales"
    elif any(w in q for w in ["claim", "fraud", "settlement", "leakage"]):
        return "claims"
    elif any(w in q for w in ["underwriting", "risk", "manual review", "stp"]):
        return "underwriting"
    elif any(w in q for w in ["customer", "journey", "retention", "abandonment"]):
        return "customer"
    elif any(w in q for w in ["ai", "model", "confidence", "hallucination", "llm"]):
        return "ai"
    return "executive"


def process_query(question: str) -> Dict[str, Any]:
    intent = detect_intent(question)
    
    prompt_map = {
        "sales": SALES_PROMPT,
        "claims": CLAIMS_PROMPT,
        "underwriting": UNDERWRITING_PROMPT,
        "customer": CUSTOMER_PROMPT,
        "ai": AI_MONITORING_PROMPT,
        "executive": EXECUTIVE_PROMPT
    }
    
    selected_prompt = prompt_map.get(intent, EXECUTIVE_PROMPT)
    fallback = {
        "summary": "Analysis completed.",
        "insights": ["Query processed under domain route."],
        "recommendation": "Review metric dashboards."
    }
    
    answer = run_claude_with_guardrails(selected_prompt, question, fallback)
    return {"intent": intent, "answer": answer}