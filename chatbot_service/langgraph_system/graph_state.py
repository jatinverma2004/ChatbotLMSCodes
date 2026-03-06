# graph_state.py

from typing import TypedDict, List, Dict, Optional

class GraphState(TypedDict):
    uid: str
    message: str
    context: Dict
    role_sops: List[Dict]
    matched_sops: List[Dict]
    sop_text: str
    intent: str
    clarification_needed: bool
    response: str