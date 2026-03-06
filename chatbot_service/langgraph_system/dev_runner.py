import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import subprocess
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

print("Starting MCP Server...")
subprocess.Popen(
    ["uvicorn", "main:app", "--reload", "--port", "8100"],
    cwd=os.path.join(BASE_DIR, "..", "mcp_v3_server")
)

print("Starting OLD Chatbot Server...")
subprocess.Popen(
    ["uvicorn", "app:app", "--reload", "--port", "9000"],
    cwd=BASE_DIR
)

print("Starting LangGraph Server...")
subprocess.Popen(
    ["uvicorn", "langgraph_system.langgraph_chat:app", "--reload", "--port", "9100"],
    cwd=BASE_DIR
)

print("Starting Streamlit UI...")
subprocess.Popen(
    ["streamlit", "run", "chat_ui.py"],
    cwd=BASE_DIR
)

input("All services running. Press ENTER to stop.")