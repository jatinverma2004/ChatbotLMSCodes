# graph_nodes.py

import requests
from .ollama_client import call_ollama

MCP_BASE_URL = "http://127.0.0.1:8000"


# =====================================================
# FETCH EMPLOYEE CONTEXT
# =====================================================
def fetch_context_node(state):

    uid = state["uid"]

    try:
        res = requests.get(f"{MCP_BASE_URL}/api/context/{uid}")
        state["context"] = res.json()
    except:
        state["context"] = {}

    return state


# =====================================================
# FETCH ROLE SOP LIST
# =====================================================
def fetch_role_sops_node(state):

    role = state.get("context", {}).get("role", "")

    try:
        res = requests.get(f"{MCP_BASE_URL}/api/sops/by-role/{role}")
        state["role_sops"] = res.json()
    except:
        state["role_sops"] = []

    return state


# =====================================================
# DYNAMIC SOP MATCHING (NO HIVE LOGIC)
# =====================================================
def sop_matching_node(state):

    message = state["message"].lower()
    role_sops = state.get("role_sops", [])

    if not role_sops:
        state["matched_sops"] = []
        return state

    matched = []

    # 🔥 Simple semantic-style matching
    for sop in role_sops:
        name = sop["doc_name"].lower()

        if "policy" in message and "policy" in name:
            matched.append(sop)
        elif "hr" in message and "hr" in name:
            matched.append(sop)
        elif "leave" in message and ("policy" in name or "hr" in name):
            matched.append(sop)

    # fallback → use all role SOPs
    if not matched:
        matched = role_sops

    print("\n[LangGraph DEBUG] Matched SOPs:",
          [x["doc_name"] for x in matched])

    state["matched_sops"] = matched

    return state


# =====================================================
# LOAD SOP TEXT FROM MCP (REAL SOURCE)
# =====================================================
def load_sop_text_node(state):

    uid = state.get("uid")

    try:
        url = f"{MCP_BASE_URL}/api/context/{uid}"
        res = requests.get(url)

        if res.status_code != 200:
            print("[LangGraph ERROR] MCP context fetch failed")
            state["sop_text"] = ""
            return state

        data = res.json()

        # MCP builds merged SOP context automatically
        state["sop_text"] = data.get("sop_context", "")

        print("[LangGraph DEBUG] SOP length:",
              len(state["sop_text"]))

    except Exception as e:
        print("[LangGraph ERROR]", e)
        state["sop_text"] = ""

    return state


# =====================================================
# FINAL LLM ANSWER NODE  ✅ (NEW CHATBOT STYLE)
# =====================================================
def llm_answer_node(state):

    role = state.get("context", {}).get("role", "")
    message = state["message"]
    sop_text = state.get("sop_text", "")
    matched = state.get("matched_sops", [])

    doc_labels = ", ".join(
        [x["doc_name"] for x in matched]) if matched else "Unknown"

    # 🔥 NEW PROMPT — fixes robotic LMS tone
    prompt = f"""
You are an internal enterprise chatbot.

RULES:
- Answer ONLY using the SOP content provided.
- DO NOT invent policies.
-If the info in SOP are in pointers , then provide those info in pointers or same format only
- DO NOT write emails, letters, or scripts.
-End with a follow up question and provide choices to the user
-Sound professional and don't use words like : "as per your query","end of discussion"
- Speak directly like a helpful assistant.
- Give a clear explanation in 1–2 paragraphs.
- Mention which SOP was used naturally.

Employee Role:
{role}

SOP SOURCE:
{doc_labels}

SOP CONTENT:
{sop_text}

User Question:
{message}

Chatbot Answer:
"""

    answer = call_ollama(prompt)

    # 🔥 same UI style you liked before
    sop_count = len(matched)

    state["response"] = (
        f"📄 Using {sop_count} SOP document(s)\n\n"
        f"{answer}\n\n"
        f"Source: {doc_labels}"
    )

    return state