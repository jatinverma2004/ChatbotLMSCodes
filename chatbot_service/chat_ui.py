import streamlit as st
import uuid

# ================= CONFIG =================

st.set_page_config(
    page_title="Employee Assistant",
    page_icon="🤖",
    layout="wide"
)

import requests
import json
import os

CHAT_DB = "chat_memory.json"
MCP_BASE_URL = "http://127.0.0.1:8100"
CHATBOT_URL = "http://127.0.0.1:9000/chat"

# ================= MEMORY =================

def load_memory():
    if not os.path.exists(CHAT_DB):
        return {}
    with open(CHAT_DB, "r") as f:
        return json.load(f)

def save_memory(data):
    with open(CHAT_DB, "w") as f:
        json.dump(data, f, indent=2)

# ================= STYLES =================

st.markdown("""
<style>
.stApp {background-color:#0b0f19;color:white;}
.block-container {max-width:900px;margin:auto;}
section[data-testid="stSidebar"] {background:#020617;}
section[data-testid="stSidebar"] * {color:white !important;}
.user-msg {background:#4f46e5;padding:12px 16px;border-radius:12px;margin-bottom:10px;width:fit-content;margin-left:auto;}
.bot-msg {background:#1e293b;padding:12px 16px;border-radius:12px;margin-bottom:10px;width:fit-content;}
.big-title {font-size:36px;font-weight:600;text-align:center;margin-top:40px;}
.subtitle {text-align:center;font-size:20px;color:#94a3b8;margin-bottom:40px;}
</style>
""", unsafe_allow_html=True)

# ================= SESSION =================

if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if "uid" not in st.session_state:
    st.session_state.uid = None

if "messages" not in st.session_state:
    st.session_state.messages = []

if "context_cache" not in st.session_state:
    st.session_state.context_cache = None

if "sops_cache" not in st.session_state:
    st.session_state.sops_cache = None

# 🔥 NEW (IMPORTANT)
if "current_chat_id" not in st.session_state:
    st.session_state.current_chat_id = None

# ================= LOGIN =================

if not st.session_state.authenticated:

    st.markdown("<div class='big-title'>Employee Assistant</div>", unsafe_allow_html=True)

    emp_id = st.text_input("Employee ID")

    if st.button("Continue"):

        res = requests.get(f"{MCP_BASE_URL}/api/context/{emp_id}")

        if res.status_code == 200:
            data = res.json()

            st.session_state.uid = emp_id
            st.session_state.authenticated = True
            st.session_state.context_cache = data

            name = data["user_profile"]["employee_name"]

            st.session_state.messages = [{
                "role": "assistant",
                "content": f"Hi {name} 👋"
            }]

            st.session_state.current_chat_id = None
            st.rerun()
        else:
            st.error("User not found")

    st.stop()

# ================= SIDEBAR =================

st.sidebar.title("💬 Chat History")

memory = load_memory()
uid = st.session_state.uid

# 🔥 NEW CHAT BUTTON
if st.sidebar.button("➕ New Chat"):
    st.session_state.messages = []
    st.session_state.current_chat_id = None
    st.rerun()

if uid in memory:
    for i, chat in enumerate(memory[uid]):

        col1, col2 = st.sidebar.columns([4, 1])

        # LOAD CHAT
        with col1:
            if st.button(chat["title"], key=f"chat_{i}"):
                st.session_state.messages = chat["messages"]
                st.session_state.current_chat_id = chat["id"]
                st.rerun()

        # DELETE CHAT
        with col2:
            if st.button("🗑️", key=f"delete_{i}"):
                memory[uid].pop(i)
                save_memory(memory)
                st.session_state.messages = []
                st.session_state.current_chat_id = None
                st.rerun()

# ================= SOP SIDEBAR =================

st.sidebar.title("📚 Available SOPs")

ctx = st.session_state.context_cache
role_code = ctx["user_profile"]["job_role_code"]

if st.session_state.sops_cache is None:
    sop_res = requests.get(f"{MCP_BASE_URL}/api/sops")
    if sop_res.status_code == 200:
        raw = sop_res.json()
        sops = []
        for r in raw["rows"]:
            sops.append(dict(zip(raw["columns"], r)))
        st.session_state.sops_cache = sops

sops = st.session_state.sops_cache

role_docs = [
    s for s in sops
    if str(s.get("job_role_code","")).upper() == str(role_code).upper()
]

for sop in role_docs:
    name = sop["doc_name"]
    version = sop["version"]

    with st.sidebar.expander(f"{name} (v{version})"):
        st.link_button("Open Document", f"{MCP_BASE_URL}/api/sop/open/{name}")

# ================= HEADER =================

profile = ctx["user_profile"]

st.markdown("<div class='big-title'>Employee Skill Assistant</div>", unsafe_allow_html=True)

st.markdown(
    f"<div class='subtitle'>Hi {profile['employee_name']} — Where should we start?</div>",
    unsafe_allow_html=True
)

# ================= HELPER =================

def extract_suggestions(answer_text):
    suggestions = []
    main_answer = answer_text

    if "💡 You can also ask:" in answer_text:
        parts = answer_text.split("💡 You can also ask:")
        main_answer = parts[0]
        lines = parts[1].strip().split("\n")

        for l in lines:
            l = l.replace("- ", "").strip()
            if l:
                suggestions.append(l)

    return main_answer, suggestions

# ================= CHAT =================

for msg in st.session_state.messages:

    if msg["role"] == "user":
        st.markdown(f"<div class='user-msg'>{msg['content']}</div>", unsafe_allow_html=True)
    else:
        main, sugg = extract_suggestions(msg["content"])
        st.markdown(f"<div class='bot-msg'>{main}</div>", unsafe_allow_html=True)

# ================= INPUT =================

prompt = st.chat_input("Ask something...")

# ================= CHAT CALL =================

if prompt:

    st.session_state.messages.append({
        "role": "user",
        "content": prompt
    })

    with st.spinner("Thinking..."):

        try:
            r = requests.post(
                CHATBOT_URL,
                params={
                    "uid": st.session_state.uid,
                    "message": prompt
                },
                timeout=60
            )

            if r.status_code == 200:
                answer = r.json().get("answer", "No response")
            else:
                answer = f"Server error: {r.status_code}"

        except Exception as e:
            answer = f"Error: {str(e)}"

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer
    })

    # ================= FIXED MEMORY LOGIC =================

    memory = load_memory()

    if uid not in memory:
        memory[uid] = []

    # 🔥 CREATE NEW CHAT ONLY ON FIRST MESSAGE
    if st.session_state.current_chat_id is None:

        chat_id = str(uuid.uuid4())
        title = prompt[:40]

        memory[uid].append({
            "id": chat_id,
            "title": title,
            "messages": st.session_state.messages
        })

        st.session_state.current_chat_id = chat_id

    else:
        # 🔥 UPDATE EXISTING CHAT
        for chat in memory[uid]:
            if chat["id"] == st.session_state.current_chat_id:
                chat["messages"] = st.session_state.messages
                break

    save_memory(memory)
    st.rerun()
