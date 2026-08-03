import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import your agent pipeline execution function from agent.py
from agent import process_pipeline, process_query

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("policypilot")

# ==========================================================
# FastAPI App Setup
# ==========================================================

app = FastAPI(
    title="PolicyPilot AI",
    description="Multi-Agent Insurance Pipeline & Decision Engine",
    version="1.0.0",
)

# ==========================================================
# CORS Configuration
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# Pydantic Schemas
# ==========================================================

class CustomerProfile(BaseModel):
    id: Optional[str] = "p1"
    name: str = "Unknown Customer"
    age: Optional[int] = 30
    occupation: Optional[str] = "Other"
    vehicle: Optional[str] = "Standard Vehicle"
    vehicleAgeStated: Optional[int] = 0
    vehicleType: Optional[str] = "Passenger Car"
    previouslyInsured: Optional[str] = "No"
    priorDamage: Optional[str] = "No"
    priorClaims: Optional[int] = 0
    quotedPremium: Optional[float] = 0.0
    channel: Optional[str] = "Direct"
    docStated: Optional[dict[str, Any]] = Field(default_factory=dict)
    docExtracted: Optional[dict[str, Any]] = Field(default_factory=dict)


class PipelineRequest(BaseModel):
    profile: CustomerProfile
    question: str = Field(..., example="Why is my premium higher than expected?")


class QueryRequest(BaseModel):
    question: str = Field(..., example="What is our current straight-through rate?")


# ==========================================================
# Endpoints
# ==========================================================

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Health check endpoint for container monitors or load balancers."""
    return {"status": "healthy", "service": "PolicyPilot AI Engine"}


@app.post("/api/run-pipeline")
async def run_pipeline(payload: PipelineRequest):
    """
    Executes the multi-agent pipeline:
    Runs Document, Risk, Conversion, Offer, Underwriting, and Customer agents sequentially.
    """
    try:
        profile_dict = payload.profile.model_dump()
        logger.info(f"Running pipeline for customer: {profile_dict.get('name')}")

        result = process_pipeline(profile=profile_dict, question=payload.question)
        return {"status": "success", "data": result}

    except Exception as err:
        logger.error(f"Pipeline execution error: {str(err)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline processing failed: {str(err)}",
        )


@app.post("/chat")
async def chat(payload: QueryRequest):
    """
    Single-query router endpoint for general ad-hoc questions.
    Detects intent and routes to the appropriate domain agent.
    """
    try:
        if not payload.question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question cannot be empty.",
            )

        logger.info(f"Processing chat query: {payload.question}")
        response = process_query(payload.question)
        return {"status": "success", "data": response}

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Chat processing error: {str(err)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing your request: {str(err)}",
        )