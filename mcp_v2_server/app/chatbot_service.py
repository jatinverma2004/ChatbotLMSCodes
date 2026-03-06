import sqlite3
from pathlib import Path

def load_sop_texts(job_role_code: str):
    conn = sqlite3.connect("mcp_v2.db")
    cur = conn.cursor()

    cur.execute("""
        SELECT doc_name, file_path
        FROM sop_registry
        WHERE job_role_code = ? AND is_active = 1
    """, (job_role_code,))

    docs = cur.fetchall()
    conn.close()

    sop_text = ""
    for name, path in docs:
        try:
            sop_text += f"\n\n### {name}\n"
            sop_text += Path(path).read_text(encoding="utf-8", errors="ignore")
        except:
            pass

    return sop_text


def build_system_prompt(user_profile, sop_text):
    return f"""
You are an internal employee assistant.

Employee:
- Name: {user_profile['employee_name']}
- Role: {user_profile['job_role_text']}
- Role Code: {user_profile['job_role_code']}

RULES:
- Answer strictly using SOP content
- If not found, say: "Not found in SOP documents"
- Suggest which SOP to refer

SOP DOCUMENTS:
{sop_text}
"""
