# langgraph_engine.py

from langgraph.graph import StateGraph, END
from .graph_state import GraphState

# ✅ ONLY these nodes exist now
from .graph_nodes import (
    fetch_context_node,
    fetch_role_sops_node,
    sop_matching_node,
    load_sop_text_node,
    llm_answer_node,
)


# ======================================================
# BUILD LANGGRAPH PIPELINE
# ======================================================

def build_graph():

    graph = StateGraph(GraphState)

    # --------------------------------------------------
    # NODES
    # --------------------------------------------------

    graph.add_node("fetch_context", fetch_context_node)
    graph.add_node("fetch_role_sops", fetch_role_sops_node)
    graph.add_node("sop_matching", sop_matching_node)
    graph.add_node("load_sop_text", load_sop_text_node)
    graph.add_node("llm_answer", llm_answer_node)

    # --------------------------------------------------
    # FLOW ORDER
    # --------------------------------------------------

    graph.set_entry_point("fetch_context")

    graph.add_edge("fetch_context", "fetch_role_sops")
    graph.add_edge("fetch_role_sops", "sop_matching")
    graph.add_edge("sop_matching", "load_sop_text")
    graph.add_edge("load_sop_text", "llm_answer")

    graph.add_edge("llm_answer", END)

    # --------------------------------------------------
    # COMPILE
    # --------------------------------------------------

    return graph.compile()