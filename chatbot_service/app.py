from fastapi import FastAPI, Query
from io import BytesIO
from pypdf import PdfReader
from docx import Document
import requests
import json

app = FastAPI(title="Employee Skill Chatbot")

# ================= CONFIG =================

MCP_BASE_URL = "http://127.0.0.1:8100"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "phi3"

SOP_CACHE = {}

# ================= USER CONTEXT =================

def fetch_user_context(uid: str):
    try:
        r = requests.get(f"{MCP_BASE_URL}/api/context/{uid}")
        return r.json()
    except:
        return {}

# ================= SKILL CAPABILITY =================

def fetch_skill_capability(context):
    try:
        role_code = context.get("user_profile",{}).get("job_role_code","")
        r = requests.get(f"{MCP_BASE_URL}/api/role-skill-map/{role_code}")
        data = r.json()

        if not data.get("skills"):
            return []

        return [s["skill_id"] for s in data["skills"]]
    except:
        return []

# ================= INTENT DETECTION =================

def detect_intent_mode(message: str):

    msg = message.lower()

    if any(x in msg for x in ["policy","rule","guideline","leave policy","code of conduct","working hours"]):
        return "policy"

    if any(x in msg for x in ["core rules","business policy","how to","steps","process","procedure","workflow","do i"]):
        return "procedure"

    if any(x in msg for x in ["strategy","plan","vision","future","improve","lead"]):
        return "strategy"

    return "generic"

# ================= 🐝 SMART HIVE ROUTER (PHASE 2) =================

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

        # 🔥 ENTERPRISE LOGIC
        if matched:
            return {
                "mode":"SOP",
                "docs":matched
            }
        else:
            return {
                "mode":"GENERAL",
                "docs":[]
            }

    except:
        return {
            "mode":"GENERAL",
            "docs":[]
        }

# ================= SOP TEXT LOADER =================

def fetch_sop_text(sop_name: str):

    if sop_name in SOP_CACHE:
        return SOP_CACHE[sop_name]

    try:
        url = f"{MCP_BASE_URL}/api/sop/open/{sop_name}"
        r = requests.get(url)

        content_type = r.headers.get("content-type","")

        if "application/pdf" in content_type:
            reader = PdfReader(BytesIO(r.content))
            text = ""
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            SOP_CACHE[sop_name] = text.strip()
            return SOP_CACHE[sop_name]

        if "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type:
            doc = Document(BytesIO(r.content))
            text = "\n".join([p.text for p in doc.paragraphs if p.text])
            SOP_CACHE[sop_name] = text.strip()
            return SOP_CACHE[sop_name]

        SOP_CACHE[sop_name] = r.text
        return SOP_CACHE[sop_name]

    except:
        return ""

# ================= SMART PROMPT BUILDER =================

def build_prompt(context, sop_text, user_message, mode):

    user = context.get("user_profile", {})
    role = user.get("job_role_text", "Employee")

    # 🔥 SOP MODE
    if mode == "SOP":
        return f"""
You are an Enterprise LMS Assistant supporting the currently logged-in employee.

COMMUNICATION STYLE:
- Speak directly using "you".
- Professional enterprise tone.
- Answer ONLY from provided SOP context.
- Provide a follow up question to the user based on query.
-Responses should be in paragraphs
-never ask user opinion on provided sop , just assist them and provide what is asked

EMPLOYEE ROLE:
{role}

SOP CONTEXT:
{sop_text}

USER QUESTION:
{user_message}
"""

    # 🔥 GENERAL MODE (NEW INTELLIGENCE)
    return f"""
You are an Enterprise AI Assistant.

No SOP matched for this question.
Provide a professional, practical advisory response.

COMMUNICATION STYLE:
- Speak directly using "you".
- Do NOT refuse.
- Give structured guidance.

EMPLOYEE ROLE:
{role}

USER QUESTION:
{user_message}
"""

# ================= OLLAMA =================

def call_ollama(prompt):

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True
    }

    r = requests.post(OLLAMA_URL, json=payload, stream=True)

    full = ""

    for line in r.iter_lines():
        if line:
            data = json.loads(line.decode())
            full += data.get("response","")

    return full.strip()

# ================= ROUTES =================

@app.post("/chat")
def chat(uid: str = Query(...), message: str = Query(...)):

    context = fetch_user_context(uid)

    route = hive_router(message, context)

    mode = route["mode"]
    docs = route["docs"]

    collected = []

    # 🔥 MULTI DOC SUPPORT
    for d in docs:
        collected.append(fetch_sop_text(d["doc_name"]))

    sop_text = "\n\n".join(collected)

    prompt = build_prompt(context, sop_text, message, mode)

    answer = call_ollama(prompt)

    header = ""

    if mode == "SOP" and docs:
        header += f"📄 Using {len(docs)} SOP document(s)\n\n"
    else:
        header += "🧠 General Advisory Mode\n\n"

    return {"response": header + answer}


    
