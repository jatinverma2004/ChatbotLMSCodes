from fastapi import FastAPI, Query
from io import BytesIO
from pypdf import PdfReader
from docx import Document
import requests
import json
import threading
import sqlite3
import re
import random
from datetime import datetime

from chat_evaluator import evaluate_answer
from evaluation_db import insert_record, init_db

# ✅ GROQ IMPORT
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

# ✅ GROQ CLIENT
GROQ_API_KEY = ""
client = Groq(api_key=GROQ_API_KEY)
print("✅ GROQ CLIENT INITIALIZED")

SOP_CACHE = {}        # full text cache  {doc_name: full_text}
SNIPPET_CACHE = {}    # snippet cache    {doc_name: first_300_chars}

# ================= SOP SANITIZER =================

def clean_sop_text(text: str) -> str:
    if not text:
        return ""
    blocked_patterns = [
        "your task", "instruction:", "###", "```",
        "generate", "appendix", "solution:", "problem:", "query:"
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
    role_code = context.get("user_profile", {}).get("job_role_code", "").upper()
    try:
        r = requests.get(f"{MCP_BASE_URL}/api/sops")
        data = r.json()
        columns = data["columns"]
        rows = data["rows"]
        sops = [dict(zip(columns, row)) for row in rows]
        matched = [s for s in sops if str(s.get("job_role_code", "")).upper() == role_code]
        if matched:
            return {"mode": "SOP", "docs": matched}
        else:
            return {"mode": "GENERAL", "docs": []}
    except:
        return {"mode": "GENERAL", "docs": []}

# ================= SOP TEXT LOADER =================

def fetch_sop_text(sop_name: str) -> str:
    """Fetch and cache full text of a SOP document."""
    if sop_name in SOP_CACHE:
        return SOP_CACHE[sop_name]
    try:
        url = f"{MCP_BASE_URL}/api/sop/open/{sop_name}"
        r = requests.get(url)
        content_type = r.headers.get("content-type", "")
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
        text = r.text
        SOP_CACHE[sop_name] = text
        return text
    except:
        return ""


def fetch_sop_snippet(sop_name: str, chars: int = 300) -> str:
    """Return a short snippet (first N chars) of a SOP for inventory listing."""
    if sop_name in SNIPPET_CACHE:
        return SNIPPET_CACHE[sop_name]
    full = fetch_sop_text(sop_name)
    snippet = full[:chars].replace("\n", " ").strip()
    SNIPPET_CACHE[sop_name] = snippet
    return snippet

# ================= SMART DOC SELECTOR =================

def normalize_doc_name(name: str) -> set:
    """'Important_Doc__2_.docx' → {'important', 'doc', '2'}"""
    name = name.lower()
    name = re.sub(r'\.(pdf|docx|doc|txt)$', '', name)
    name = re.sub(r'[_\-\.]+', ' ', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    return set(w for w in name.split() if w)

# ⚠️ "important" is intentionally NOT a stop word so it matches Important_Doc
_STOP_WORDS = {
    'what', 'does', 'the', 'say', 'is', 'in', 'a', 'an', 'are', 'how',
    'do', 'i', 'to', 'for', 'of', 'and', 'or', 'tell', 'me', 'about',
    'please', 'can', 'you', 'give', 'show', 'summarize', 'summary',
    'details', 'detail', 'it', 'its', 'this', 'that', 'with', 'from',
    'have', 'has', 'sops', 'docs', 'available', 'list', 'all', 'get'
}

def normalize_query(query: str) -> set:
    query = query.lower()
    query = re.sub(r'[^a-z0-9\s]', '', query)
    return set(w for w in query.split() if w and w not in _STOP_WORDS)


def score_doc(doc_name: str, query_words: set) -> int:
    """
    Score doc relevance to query.
    +100 exact token match, +50 substring match.
    """
    doc_words = normalize_doc_name(doc_name)
    doc_name_flat = doc_name.lower()
    score = 0
    for qw in query_words:
        if qw in doc_words:
            score += 100
        elif qw in doc_name_flat:
            score += 50
    return score


def select_relevant_docs(docs, user_message, top_n=3):
    """
    Pick top_n most relevant docs by name-match scoring.
    If NO doc scores above 0 (generic query), return ALL docs
    so the inventory prompt covers everything.
    """
    query_words = normalize_query(user_message)
    print(f"🔍 Query words: {query_words}")

    scored = []
    for d in docs:
        s = score_doc(d.get("doc_name", ""), query_words)
        print(f"  {d.get('doc_name')} → score {s}")
        scored.append((s, d))

    scored.sort(key=lambda x: -x[0])

    top_score = scored[0][0] if scored else 0

    if top_score > 0:
        # Specific doc query → return top matches
        selected = [d for _, d in scored[:top_n]]
    else:
        # Generic query (no name match) → return ALL docs
        # so inventory + snippet approach covers everything
        selected = [d for _, d in scored]  # all docs

    print(f"✅ Selected: {[d.get('doc_name') for d in selected]}")
    return selected

# ================= DOC INVENTORY BUILDER =================

def build_doc_inventory(docs) -> str:
    """
    Build a compact inventory string listing every assigned SOP
    with its name and a short content snippet.
    This is always injected into the prompt so the LLM knows
    what documents exist — even if we don't load their full text.
    """
    lines = ["ASSIGNED SOP DOCUMENTS FOR THIS EMPLOYEE:\n"]
    for i, d in enumerate(docs, 1):
        name = d.get("doc_name", "Unknown")
        snippet = fetch_sop_snippet(name, chars=250)
        display_name = re.sub(r'\.(pdf|docx|doc|txt)$', '', name)
        display_name = display_name.replace("_", " ").replace("-", " ").strip()
        lines.append(f"{i}. [{display_name}] — {snippet}")
    return "\n".join(lines)

# ================= PROMPT =================

def build_prompt(context, sop_text, doc_inventory, user_message, mode):
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
- If asked "what documents are available" or "what SOPs exist" → list them from the DOC INVENTORY below
- If a specific doc is asked about → answer from DETAILED SOP CONTEXT
- If answer not found in context → say "Not found in SOP"

ROLE:
{role}

{doc_inventory}

DETAILED SOP CONTEXT (full content of most relevant document(s)):
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

# ================= LLM CALL =================

def call_ollama(prompt):
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("GROQ ERROR:", e)
        return f"🔥 ERROR: {str(e)}"

# ================= EVALUATION (FIXED) =================

def run_evaluation(uid, message, sop_text, answer):

    ev = evaluate_answer(message, sop_text, answer)

    if ev is None:
        print("❌ Evaluation failed, skipping")
        return

    try:
        insert_record({
            "uid": uid,
            "question": message,
            "retrieved_context": sop_text[:2000],
            "answer": answer,
            "accuracy": ev["accuracy"],
            "precision": ev["precision"],
            "recall": ev["recall"],
            "verdict": ev["verdict"],
            "reason": ev["reason"]
        })
    except Exception as e:
        print("DB INSERT ERROR:", e)

# ================= SUGGESTIONS =================

LAST_SUGGESTIONS = {}

def generate_prompt_suggestions(role, docs, user_query=None, uid=None):
    base = [
        f"What are key responsibilities of a {role}?",
        f"What SOPs should a {role} follow daily?",
        f"What are safety guidelines for {role}?",
        f"How does {role} handle compliance issues?",
        f"What are common mistakes a {role} should avoid?"
    ]

    sop_based = []
    for d in docs:
        name = d.get("doc_name", "").replace(".pdf", "").replace(".docx", "")
        sop_based.extend([
            f"Explain {name}",
            f"Key rules from {name}",
            f"Important points in {name}"
        ])

    query_based = []
    if user_query:
        q = user_query.lower()
        if "leave" in q:
            query_based.extend([
                "What is leave approval workflow?",
                "How many leave types exist?",
                "What documents are required for leave?"
            ])
        if "policy" in q:
            query_based.extend([
                "Summarize policy in simple terms",
                "What are critical policy rules?",
                "What happens if policy is violated?"
            ])
        if "safety" in q:
            query_based.extend([
                "List all safety precautions",
                "How to report safety incidents?",
                "What are safety violations?"
            ])

    all_suggestions = base + sop_based + query_based
    random.shuffle(all_suggestions)

    seen = set()
    unique = []
    for s in all_suggestions:
        if s not in seen:
            unique.append(s)
            seen.add(s)

    if uid:
        last = LAST_SUGGESTIONS.get(uid, [])
        unique = [u for u in unique if u not in last]

    final = unique[:5]
    if uid:
        LAST_SUGGESTIONS[uid] = final

    return final

# ================= MAIN ROUTE =================

@app.post("/chat")
def chat(uid: str = Query(...), message: str = Query(...)):

    context = fetch_user_context(uid)

    route = hive_router(message, context)
    mode = route["mode"]
    docs = route["docs"]

    # ── LAYER 1: Doc Inventory (always built from ALL assigned docs) ──────────
    # Every prompt gets a compact list of ALL doc names + snippets.
    # This ensures the LLM always knows what documents exist for this employee.
    doc_inventory = ""
    if mode == "SOP" and docs:
        doc_inventory = build_doc_inventory(docs)

    # ── LAYER 2: Full content for most relevant docs ──────────────────────────
    # Smart selector picks docs whose NAMES match the query keywords.
    # For generic queries (no name match) it returns ALL docs so snippets cover them.
    selected_docs = select_relevant_docs(docs, message, top_n=3)

    collected = []
    for d in selected_docs:
        raw = fetch_sop_text(d["doc_name"])
        clean = clean_sop_text(raw)
        if clean:
            collected.append(f"=== {d['doc_name']} ===\n{clean}")
    sop_text = "\n\n".join(collected)

    # Increased from 3500 → 8000 chars to avoid truncation
    MAX_CHARS = 8000
    if len(sop_text) > MAX_CHARS:
        sop_text = sop_text[:MAX_CHARS]

    prompt = build_prompt(context, sop_text, doc_inventory, message, mode)

    answer = call_ollama(prompt)
    answer = guard_llm_output(answer)

    # Initialize before if-block to avoid UnboundLocalError
    suggestions = []
    header = ""
    final = answer

    if mode == "SOP" and docs:
        header = f"📄 Using {len(docs)} SOP document(s)\n\n"
        role = context.get("user_profile", {}).get("job_role_text", "Employee")
        suggestions = generate_prompt_suggestions(role, docs, message, uid)
        suggestion_text = "\n\n💡 You can also ask:\n"
        for s in suggestions:
            suggestion_text += f"- {s}\n"
        final = header + answer + suggestion_text

    print("FINAL:", final[:300])

    threading.Thread(
        target=run_evaluation,
        args=(uid, message, sop_text, answer)
    ).start()

    if suggestions:
        print("SUGGESTIONS:", suggestions)

    return {"answer": final}
