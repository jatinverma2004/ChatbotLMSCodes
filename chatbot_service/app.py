from fastapi import FastAPI, Query
from io import BytesIO
from pypdf import PdfReader
from docx import Document
import requests
import json
import threading
import sqlite3
from datetime import datetime

from chat_evaluator import evaluate_answer
from evaluation_db import insert_record, init_db

# ✅ NEW IMPORT
from groq import Groq

# ================= DATABASE SETUP =================

DB_PATH = "evaluation.db"

def ensure_dashboard_table():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT,
        answer TEXT,
        accuracy REAL,
        precision REAL,
        recall REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()


init_db()
ensure_dashboard_table()

app = FastAPI(title="Employee Skill Chatbot")

# ================= CONFIG =================

MCP_BASE_URL = "http://127.0.0.1:8100"

# ❌ OLD (kept but unused for safety)
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "phi3:latest"

# ✅ NEW GROQ CLIENT
import os
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
print("KEY:", os.getenv("GROQ_API_KEY"))
SOP_CACHE = {}

# ================= SOP SANITIZER =================

def clean_sop_text(text: str) -> str:
    if not text:
        return ""

    blocked_patterns = [
        "your task",
        "instruction:",
        "###",
        "```",
        "generate",
        "appendix",
        "solution:",
        "problem:",
        "query:"
    ]

    lower = text.lower()

    for p in blocked_patterns:
        if p in lower:
            text = text.replace(p, "")

    return text.strip()

# ================= OUTPUT GUARD =================

def guard_llm_output(text: str) -> str:
    if not text:
        return text

    lower = text.lower()

    dangerous_patterns = [
        "your task:",
        "generate two more constraints",
        "write an in-depth analysis"
    ]

    for p in dangerous_patterns:
        if p in lower:
            return "⚠️ Unsafe content detected. Please rephrase your question."

    return text

# ================= USER CONTEXT =================

def fetch_user_context(uid: str):
    try:
        r = requests.get(f"{MCP_BASE_URL}/api/context/{uid}")
        return r.json()
    except:
        return {}

# ================= HIVE ROUTER =================

def hive_router(message, context):
    role_code = context.get("user_profile",{}).get("job_role_code","").upper()

    try:
        r = requests.get(f"{MCP_BASE_URL}/api/sops")
        data = r.json()

        columns = data["columns"]
        rows = data["rows"]

        sops = [dict(zip(columns,row)) for row in rows]

        matched = []

        for s in sops:
            if str(s.get("job_role_code","")).upper() == role_code:
                matched.append(s)

        if matched:
            return {"mode":"SOP","docs":matched}
        else:
            return {"mode":"GENERAL","docs":[]}

    except:
        return {"mode":"GENERAL","docs":[]}

# ================= SOP TEXT LOADER =================

def fetch_sop_text(sop_name: str):

    if sop_name in SOP_CACHE:
        return SOP_CACHE[sop_name]

    try:
        url = f"{MCP_BASE_URL}/api/sop/open/{sop_name}"
        r = requests.get(url)

        content_type = r.headers.get("content-type","")

        if "pdf" in content_type:
            reader = PdfReader(BytesIO(r.content))
            text = ""
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            SOP_CACHE[sop_name] = text
            return text

        if "wordprocessingml" in content_type:
            doc = Document(BytesIO(r.content))
            text = "\n".join([p.text for p in doc.paragraphs if p.text])
            SOP_CACHE[sop_name] = text
            return text

        return r.text

    except:
        return ""

# ================= PROMPT =================
def build_prompt(context, sop_text, user_message, mode):

    user = context.get("user_profile", {})
    role = user.get("job_role_text", "Employee")

    if mode == "SOP":
        return f"""
You are an intelligent Employee Assistant helping employees understand company SOPs.

Instructions:
- Answer clearly and in detail (not just one line)
- Explain concepts in simple language
- If acronym is asked → expand + explain
- Use SOP context strictly (do NOT hallucinate)
- Add examples where useful
- If answer not found → say "Not found in SOP"

ROLE:
{role}

SOP CONTEXT:
{sop_text}

USER QUESTION:
{user_message}

FINAL ANSWER:
"""

    return f"""
You are a helpful enterprise assistant.

Answer clearly and explain properly.

ROLE:
{role}

QUESTION:
{user_message}

ANSWER:
"""

# ================= LLM CALL (REPLACED WITH GROQ) =================

def call_ollama(prompt):

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print("GROQ ERROR:", e)
        return f"🔥 ERROR: {str(e)}"

# ================= EVALUATION =================

def run_evaluation(uid, message, sop_text, answer):
    try:
        ev = evaluate_answer(
            question=message,
            context=sop_text,
            answer=answer
        )

        insert_record({
            "uid": uid,
            "question": message,
            "retrieved_context": sop_text[:2000],
            "answer": answer,
            "accuracy": ev.get("accuracy",0),
            "precision": ev.get("precision",0),
            "recall": ev.get("recall",0)
        })

    except Exception as e:
        print("Evaluation failed:", e)

# ================= ROUTE =================

@app.post("/chat")
def chat(uid: str = Query(...), message: str = Query(...)):

    context = fetch_user_context(uid)

    route = hive_router(message, context)
    mode = route["mode"]
    docs = route["docs"]

    collected = []

    for d in docs:
        raw = fetch_sop_text(d["doc_name"])
        clean = clean_sop_text(raw)
        collected.append(clean)

    sop_text = "\n\n".join(collected)

    prompt = build_prompt(context, sop_text, message, mode)

    answer = call_ollama(prompt)

    answer = guard_llm_output(answer)

    header = ""
    if mode == "SOP" and docs:
        header = f"📄 Using {len(docs)} SOP document(s)\n\n"

    final = header + answer

    print("FINAL:", final[:300])

    threading.Thread(
        target=run_evaluation,
        args=(uid, message, sop_text, final)
    ).start()

    return {"answer": final}
    
