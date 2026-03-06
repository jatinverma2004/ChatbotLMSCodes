from fastapi import FastAPI, Query
from .langgraph_engine import build_graph

app = FastAPI(title="LangGraph Enterprise Chat")

graph = build_graph()

@app.api_route("/chat", methods=["GET","POST"])
def chat(uid: str = Query(...), message: str = Query(...)):

    state = {
        "uid": uid,
        "message": message,
        "context": {},
        "role_sops": [],
        "matched_sops": [],
        "sop_text": "",
        "intent": "",
        "clarification_needed": False,
        "response": ""
    }

    result = graph.invoke(state)

    return {"response": result["response"]}

    