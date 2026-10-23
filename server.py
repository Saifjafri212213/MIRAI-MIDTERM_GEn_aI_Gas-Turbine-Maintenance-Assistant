"""
Gas Turbine Maintenance Assistant - Web Application Server

Exposes a FastAPI backend that interfaces directly with ask.py to serve
real-time RAG responses, citations, and evaluation tables over a modern web UI.

Run it:
    python server.py
"""

import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

from ask import answer_question
from evaluate import parse_answer_and_reference, QUESTIONS

app = FastAPI(title="Gas Turbine Maintenance Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str

@app.post("/api/ask")
def handle_ask(req: QueryRequest):
    q = req.question.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    
    raw = answer_question(q)
    answer, reference = parse_answer_and_reference(raw)
    
    return {
        "question": q,
        "answer": answer,
        "reference": reference,
        "raw": raw,
        "is_not_found": raw.strip().lower() == "not found"
    }

@app.get("/api/questions")
def get_preset_questions():
    return {
        "questions": [
            {
                "id": 1,
                "text": "What are the three main types of inspection?",
                "tag": "Maintenance Scopes"
            },
            {
                "id": 2,
                "text": "What does a maintenance factor of two mean?",
                "tag": "Calculation Rule"
            },
            {
                "id": 3,
                "text": "What is the purchase price of this gas turbine?",
                "tag": "Hallucination Trap"
            },
            {
                "id": 4,
                "text": "What is the melting point of titanium?",
                "tag": "Hallucination Trap"
            },
            {
                "id": 5,
                "text": "What is the recommended combustion-inspection interval in hours?",
                "tag": "Figure 36 Table"
            }
        ]
    }

@app.get("/api/results")
def get_evaluation_results():
    answers_path = os.path.join("results", "answers.md")
    if os.path.exists(answers_path):
        with open(answers_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"markdown": content}
    return {"markdown": "Evaluation results not yet generated."}

# Mount UI static files
UI_DIR = os.path.join(os.path.dirname(__file__), "ui")
os.makedirs(UI_DIR, exist_ok=True)

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(UI_DIR, "index.html"))

app.mount("/static", StaticFiles(directory=UI_DIR), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
