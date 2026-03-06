import streamlit as st
import requests
import json

# 🔥 IMPORTANT — USE MCP V3 PORT
MCP_BASE_URL = "http://127.0.0.1:8100"
CHATBOT_URL = "http://127.0.0.1:9000/chat"

st.set_page_config(page_title="Employee Assistant", page_icon="🤖")
st.title("🤖 Employee Skill Assistant")

# ================= SESSION STATE =================
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "uid" not in st.session_state:
    st.session_state.uid = None
if "messages" not in st.session_state:
    st.session_state.messages = []

# 🚀 CACHE MCP DATA (LATENCY FIX)
if "context_cache" not in st.session_state:
    st.session_state.context_cache = None
if "sops_cache" not in st.session_state:
    st.session_state.sops_cache = None

# ================= LOGIN =================
if not st.session_state.authenticated:

    emp_id = st.text_input("Employee ID")

    if st.button("Continue"):

        res = requests.get(f"{MCP_BASE_URL}/api/context/{emp_id}")

        if res.status_code == 200:

            data = res.json()

            st.session_state.uid = emp_id
            st.session_state.authenticated = True
            st.session_state.context_cache = data  # 🚀 CACHE CONTEXT

            st.session_state.messages.append({
                "role": "assistant",
                "content": f"Welcome {data['user_profile']['employee_name']} ({data['user_profile']['job_role_text']})"
            })

            st.rerun()

        else:
            st.error("User not found")

    st.stop()

# ================= SIDEBAR SOP VIEW =================

st.sidebar.title("📚 Available SOPs")

# 🚀 USE CACHE — DO NOT CALL MCP EVERY RERUN
if st.session_state.context_cache is None:
    ctx_res = requests.get(f"{MCP_BASE_URL}/api/context/{st.session_state.uid}")
    if ctx_res.status_code == 200:
        st.session_state.context_cache = ctx_res.json()

ctx = st.session_state.context_cache
role_code = ctx["user_profile"]["job_role_code"]

# 🚀 CACHE SOP LIST
if st.session_state.sops_cache is None:

    sop_res = requests.get(f"{MCP_BASE_URL}/api/sops")

    if sop_res.status_code == 200:
        raw = sop_res.json()
        sops = []

        for r in raw["rows"]:
            sops.append(dict(zip(raw["columns"], r)))

        st.session_state.sops_cache = sops

sops = st.session_state.sops_cache

# 🌐 GENERIC DOCS
generic_docs = [
    s for s in sops
    if str(s.get("doc_type", "")).upper() == "GENERIC"
]

if generic_docs:
    st.sidebar.subheader("🌐 Company Docs")
    for sop in generic_docs:

        name = sop["doc_name"]
        version = sop["version"]

        with st.sidebar.expander(f"{name} (v{version})"):
            st.link_button(
                "👁️ Open Document",
                f"{MCP_BASE_URL}/api/sop/open/{name}"
            )

# 🧩 ROLE BASED DOCS (STRICT MATCH)
role_docs = [
    s for s in sops
    if str(s.get("job_role_code", "")).strip().upper()
    ==
    str(role_code).strip().upper()
]

if role_docs:
    st.sidebar.subheader("🧩 Role SOPs")
    for sop in role_docs:

        name = sop["doc_name"]
        version = sop["version"]

        with st.sidebar.expander(f"{name} (v{version})"):
            st.link_button(
                "👁️ Open Document",
                f"{MCP_BASE_URL}/api/sop/open/{name}"
            )

# ================= CHAT =================

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

prompt = st.chat_input("Ask your question...")

if prompt:

    st.session_state.messages.append({
        "role": "user",
        "content": prompt
    })

    with st.spinner("Thinking..."):

        r = requests.post(
            CHATBOT_URL,
            params={
                "uid": st.session_state.uid,
                "message": prompt
            }
        )

        answer = r.json()["response"]

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer
    })

    st.rerun()