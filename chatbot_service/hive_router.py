# hive_router.py
# ============================================
# Hive Map Routing Layer
# Decides WHICH SOP should be used
# based on user intent.
# ============================================

import re

# -------------------------------
# HIVE MAP CONFIG
# You can later move this to DB
# -------------------------------

HIVE_MAP = {
    "leave": {
        "keywords": ["leave", "attendance", "holiday", "absence"],
        "sop": ["Policy Document"]
    },
    "business": {
        "keywords": ["business rules", "core rules", "business policy"],
        "sop": ["Doc"]
    },
    "leadgen": {
        "keywords": ["skills" , "role" ,"lead generation", "duty", "sales duty"],
        "sop": ["leadgenerationduty"]
    }
}


# ---------------------------------
# INTENT DETECTION
# VERY LIGHTWEIGHT CLASSIFIER
# ---------------------------------
def detect_intent(user_query: str) -> str:
    q = user_query.lower()

    for intent, data in HIVE_MAP.items():
        for kw in data["keywords"]:
            if kw in q:
                return intent

    return "generic"


# ---------------------------------
# ROUTE SOP BASED ON INTENT
# ---------------------------------
def get_sop_route(user_query: str):
    intent = detect_intent(user_query)

    if intent in HIVE_MAP:
        return HIVE_MAP[intent]["sop"]

    # fallback generic
    return ["Doc"]

    