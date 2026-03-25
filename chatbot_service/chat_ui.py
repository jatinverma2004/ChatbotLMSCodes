import streamlit as st

# ✅ MUST BE FIRST STREAMLIT CALL
st.set_page_config(
    page_title="Employee Assistant",
    page_icon="🤖",
    layout="wide"
)

import requests
import json
import os

CHAT_DB = "chat_memory.json"


def load_memory():
    if not os.path.exists(CHAT_DB):
        return {}
    with open(CHAT_DB, "r") as f:
        return json.load(f)


def save_memory(data):
    with open(CHAT_DB, "w") as f:
        json.dump(data, f, indent=2)

# ================= CONFIG =================

MCP_BASE_URL = "http://127.0.0.1:8100"
CHATBOT_URL = "http://127.0.0.1:9000/chat"

# ================= DARK THEME =================

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

            st.session_state.messages.append({
                "role":"assistant",
                "content":f"Hi {name} 👋"
            })

            st.rerun()

        else:
            st.error("User not found")

    st.stop()

# ================= SIDEBAR =================
st.sidebar.title("💬 Chat History")

memory = load_memory()
uid = st.session_state.uid

if uid in memory:
    for i, chat in enumerate(memory[uid]):
        if st.sidebar.button(chat["title"], key=i):
            st.session_state.messages = chat["messages"]
            st.rerun()

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
    if str(s.get("job_role_code","")).upper()
    ==
    str(role_code).upper()
]

for sop in role_docs:
    name = sop["doc_name"]
    version = sop["version"]

    with st.sidebar.expander(f"{name} (v{version})"):
        st.link_button(
            "Open Document",
            f"{MCP_BASE_URL}/api/sop/open/{name}"
        )
st.sidebar.title("⚙️ Controls")
mode = st.sidebar.toggle("Admin Mode", key="admin_toggle")

if mode:
    import admin_dashboard
    admin_dashboard.render_dashboard()
    st.stop()
if st.sidebar.button("🗑️ Clear Chat History"):
    if uid in memory:
        memory[uid] = []
        save_memory(memory)
        st.session_state.messages = []
        st.rerun()
# ================= HEADER =================

profile = ctx["user_profile"]

st.markdown("<div class='big-title'>Employee Skill Assistant</div>", unsafe_allow_html=True)

st.markdown(
f"<div class='subtitle'>Hi {profile['employee_name']} — Where should we start?</div>",
unsafe_allow_html=True
)

# ================= CHAT =================

for msg in st.session_state.messages:

    if msg["role"] == "user":
        st.markdown(f"<div class='user-msg'>{msg['content']}</div>", unsafe_allow_html=True)
    else:
        st.markdown(f"<div class='bot-msg'>{msg['content']}</div>", unsafe_allow_html=True)

# ================= INPUT =================

# ✅ SAFE IMPORTS (FIXED ISSUE)
from streamlit_mic_recorder import mic_recorder
from streamlit_js_eval import streamlit_js_eval

col1, col2 = st.columns([8,1])

with col1:
    prompt = st.chat_input("Ask something...")

with col2:
    voice = mic_recorder(
        start_prompt="🎤",
        stop_prompt="⏹",
        just_once=True
    )

# ================= VOICE (JS) =================

if st.button("🎤 Voice"):
    spoken = streamlit_js_eval(
        js_expressions="""
        new Promise((resolve) => {
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'en-US';
            recognition.start();
            recognition.onresult = (event) => {
                resolve(event.results[0][0].transcript);
            };
        })
        """
    )

    if spoken:
        st.session_state.messages.append({
            "role": "user",
            "content": spoken
        })
        prompt = spoken

# ================= VOICE (MIC) =================

if voice:
    import speech_recognition as sr
    from pydub import AudioSegment
    from io import BytesIO

    audio_bytes = voice["bytes"]
    audio = AudioSegment.from_file(BytesIO(audio_bytes))
    audio.export("temp.wav", format="wav")

    recognizer = sr.Recognizer()

    with sr.AudioFile("temp.wav") as source:
        audio_data = recognizer.record(source)

    try:
        prompt = recognizer.recognize_google(audio_data)
        st.write("You said:", prompt)
    except:
        st.warning("Could not recognize speech")

# ================= CHAT CALL =================

if prompt:

    st.session_state.messages.append({
        "role":"user",
        "content":prompt
    })

    with st.spinner("Thinking..."):

        try:
            r = requests.post(
                CHATBOT_URL,
                params={
                    "uid":st.session_state.uid,
                    "message":prompt
                },
                timeout=60
            )

            if r.status_code == 200:
                answer = r.json().get("answer", "No response")
            else:
                answer = f"Server error: {r.status_code}"

        except Exception as e:
            answer= f"Error: {str(e)}"

    st.session_state.messages.append({
        "role":"assistant",
        "content":answer
    })

    # ================= MEMORY SAVE =================

    memory = load_memory()
    uid = st.session_state.uid

    if uid not in memory:
        memory[uid] = []

    title = "New Chat"
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            title = msg["content"][:40]
            break

    memory[uid].append({
        "title": title,
        "messages": st.session_state.messages
    })

    save_memory(memory)
    st.rerun()
