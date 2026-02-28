"""
REFLEX — AI Incident Runbook Generator
© 2026 Wiqi Lee | Built for the Mistral Worldwide Hackathon 2025
FastAPI backend with code analysis, failure detection, and runbook generation.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from fastapi.responses import PlainTextResponse

from backend.models import CodeInput, MultiFileInput, AnalysisResult
from backend.services.mistral_client import ReflexMistral
from backend.services.analyzer import Analyzer
from backend.services.exporter import runbook_to_markdown, analysis_to_markdown
from backend.services.multilingual import MultilingualService, SUPPORTED_LANGUAGES

load_dotenv()

# === Lifespan ===

mistral_client: ReflexMistral | None = None
analyzer: Analyzer | None = None
multilingual: MultilingualService | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mistral_client, analyzer, multilingual
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        print("WARNING: MISTRAL_API_KEY not set. API calls will fail.")
    else:
        mistral_client = ReflexMistral(api_key=api_key)
        analyzer = Analyzer(mistral=mistral_client)
        multilingual = MultilingualService(mistral=mistral_client)
        print("REFLEX initialized with Mistral AI")
    yield
    print("REFLEX shutting down")


# === App ===

app = FastAPI(
    title="REFLEX",
    description="AI Incident Runbook Generator — Paste code, get production-ready runbooks. © 2026 Wiqi Lee",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Routes ===

@app.get("/")
async def root():
    return {
        "name": "REFLEX",
        "tagline": "AI Incident Runbook Generator",
        "version": "1.0.0",
        "author": "Wiqi Lee",
        "year": 2026,
        "event": "Mistral Worldwide Hackathon 2025",
        "status": "online",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "mistral": "connected" if mistral_client else "not configured"
    }


@app.post("/api/v1/analyze", response_model=AnalysisResult)
async def analyze_code(input: CodeInput):
    """
    Analyze a single code file for failure scenarios and generate runbooks.
    
    Paste your code → get a list of everything that can go wrong + 
    step-by-step runbooks to handle each incident.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Mistral API not configured. Set MISTRAL_API_KEY.")
    
    try:
        result = await analyzer.analyze_single(input)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/v1/analyze/multi", response_model=AnalysisResult)
async def analyze_multi(input: MultiFileInput):
    """
    Analyze multiple code files and generate a combined analysis with runbooks.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Mistral API not configured. Set MISTRAL_API_KEY.")
    
    if len(input.files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per analysis.")
    
    try:
        result = await analyzer.analyze_multi(input)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/v1/runbook/{scenario_id}")
async def regenerate_runbook(scenario_id: str, input: CodeInput):
    """
    Regenerate a runbook for a specific scenario with updated context.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Mistral API not configured.")
    
    try:
        result = await analyzer.analyze_single(input)
        # Find matching scenario
        for rb in result.runbooks:
            if rb.scenario.id == scenario_id:
                return rb
        # If not found, return first runbook
        if result.runbooks:
            return result.runbooks[0]
        raise HTTPException(status_code=404, detail="No runbook generated.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Runbook generation failed: {str(e)}")


# === Demo Route ===

DEMO_CODE = '''import requests
import sqlite3
import os

DB_PATH = "/var/data/app.db"
API_TIMEOUT = 5
MAX_RETRIES = 3
PAYMENT_API = "https://api.stripe.com/v1/charges"

def process_payment(user_id, amount, currency="usd"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get user payment method
    cursor.execute(f"SELECT payment_method FROM users WHERE id = {user_id}")
    row = cursor.fetchone()
    payment_method = row[0]
    
    # Call payment API
    response = requests.post(
        PAYMENT_API,
        headers={"Authorization": f"Bearer {os.getenv('STRIPE_KEY')}"},
        json={"amount": int(amount * 100), "currency": currency, "payment_method": payment_method},
        timeout=API_TIMEOUT
    )
    
    if response.status_code == 200:
        charge_id = response.json()["id"]
        cursor.execute(
            f"INSERT INTO transactions (user_id, charge_id, amount) VALUES ({user_id}, '{charge_id}', {amount})"
        )
        conn.commit()
        return {"status": "success", "charge_id": charge_id}
    else:
        return {"status": "failed", "error": response.text}

def get_user_balance(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(f"SELECT SUM(amount) FROM transactions WHERE user_id = {user_id}")
    result = cursor.fetchone()
    return result[0] if result[0] else 0.0

def refund_payment(charge_id):
    response = requests.post(
        f"https://api.stripe.com/v1/refunds",
        headers={"Authorization": f"Bearer {os.getenv('STRIPE_KEY')}"},
        json={"charge": charge_id}
    )
    return response.json()
'''

@app.get("/api/v1/demo")
async def demo_analysis():
    """
    Run analysis on a demo payment service code.
    Great for testing without providing your own code.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Mistral API not configured.")
    
    demo_input = CodeInput(
        code=DEMO_CODE,
        filename="payment_service.py",
        language="python",
        context="Production payment service handling Stripe transactions. ~10k transactions/day."
    )
    
    try:
        result = await analyzer.analyze_single(demo_input)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demo analysis failed: {str(e)}")


# === Feature 13: Export Routes ===

@app.post("/api/v1/export/markdown", response_class=PlainTextResponse)
async def export_analysis_markdown(input: CodeInput):
    """
    Analyze code and export the full report as Markdown.
    Returns a ready-to-save .md document with all scenarios and runbooks.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Mistral API not configured.")
    
    try:
        result = await analyzer.analyze_single(input)
        md = analysis_to_markdown(result)
        return PlainTextResponse(content=md, media_type="text/markdown")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.post("/api/v1/export/runbook/{index}", response_class=PlainTextResponse)
async def export_single_runbook(index: int, input: CodeInput):
    """
    Analyze code and export a specific runbook by index as Markdown.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Mistral API not configured.")
    
    try:
        result = await analyzer.analyze_single(input)
        if index >= len(result.runbooks):
            raise HTTPException(status_code=404, detail=f"Runbook index {index} not found. Total: {len(result.runbooks)}")
        md = runbook_to_markdown(result.runbooks[index])
        return PlainTextResponse(content=md, media_type="text/markdown")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# === Feature 14: Multilingual Routes ===

@app.get("/api/v1/languages")
async def list_languages():
    """List all supported languages for runbook translation."""
    return {"languages": SUPPORTED_LANGUAGES}


@app.post("/api/v1/translate", response_class=PlainTextResponse)
async def translate_runbook_endpoint(input: CodeInput, lang: str = "id"):
    """
    Analyze code, generate runbooks, then translate the full report to target language.
    
    Supported languages: en, id, es, fr, de, pt, ja, ko, zh, ar, hi, ru, tr, vi, th, nl, it, pl
    
    Mistral's multilingual strength means runbooks maintain technical accuracy 
    while being naturally readable in the target language.
    """
    if not analyzer or not multilingual:
        raise HTTPException(status_code=503, detail="Mistral API not configured.")
    
    if lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}. Supported: {list(SUPPORTED_LANGUAGES.keys())}")
    
    try:
        # Step 1: Analyze and generate English runbook
        result = await analyzer.analyze_single(input)
        md = analysis_to_markdown(result)
        
        # Step 2: Translate to target language
        if lang == "en":
            return PlainTextResponse(content=md, media_type="text/markdown")
        
        translated = await multilingual.translate_runbook(md, lang)
        return PlainTextResponse(content=translated, media_type="text/markdown")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
