# db_utils.py
# Direct database access layer (No MCP, No HTTP)

import sqlite3
import os


# --------------------------------------------
# DATABASE PATH
# --------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "mcp_v3_server", "mcp_v3.db")


# --------------------------------------------
# GET DATABASE CONNECTION
# --------------------------------------------

def get_connection():
    """
    Returns a SQLite connection to mcp_v3.db
    """
    return sqlite3.connect(DB_PATH)


# --------------------------------------------
# FETCH USER CONTEXT
# --------------------------------------------

def get_user_context(uid):
    """
    Fetch user details (name, role)
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT uid, name, role FROM users WHERE uid = ?",
        (uid,)
    )

    result = cursor.fetchone()

    conn.close()

    if not result:
        return None

    return {
        "uid": result[0],
        "name": result[1],
        "role": result[2]
    }


# --------------------------------------------
# FETCH SOPS BY ROLE
# --------------------------------------------

def get_sops_by_role(role):
    """
    Returns all SOPs assigned to a specific role
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, doc_name, content FROM sops WHERE role = ?",
        (role,)
    )

    results = cursor.fetchall()

    conn.close()

    sops = []

    for row in results:
        sops.append({
            "id": row[0],
            "doc_name": row[1],
            "content": row[2]
        })

    return sops


# --------------------------------------------
# FETCH SOP CONTENT BY ID
# --------------------------------------------

def get_sop_content(sop_id):
    """
    Returns SOP content by ID
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT content FROM sops WHERE id = ?",
        (sop_id,)
    )

    result = cursor.fetchone()

    conn.close()

    return result[0] if result else None