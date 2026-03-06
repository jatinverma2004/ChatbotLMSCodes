from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import FastAPI, UploadFile, File, Form
import sqlite3
import os
from datetime import datetime

app = FastAPI(title="MCP V2 Server")

# -----------------------------------
# CONFIG
# -----------------------------------
DB_PATH = "mcp_v2.db"
SOP_DIR = "sop_storage"

os.makedirs(SOP_DIR, exist_ok=True)

# Serve SOP folder
app.mount(
    "/sop_storage",
    StaticFiles(directory=SOP_DIR),
    name="sop_storage"
)

# -----------------------------------
# HOME
# -----------------------------------
@app.get("/")
def home():
    return {"status": "MCP V2 Server Running"}

# -----------------------------------
# ADD USER
# -----------------------------------
@app.post("/api/user/add")
def add_user(
    uid: str = Form(...),
    employee_code: str = Form(...),
    employee_name: str = Form(...),
    job_role_code: str = Form(...),
    job_role_text: str = Form(...),
    company: str = Form(None),
    state: str = Form(None),
    region: str = Form(None),
    facility: str = Form(None),
    category_l1: str = Form(None),
    l1_employee_code: str = Form(None),
    date_of_joining: str = Form(None),
    org_unit: str = Form(None),
    job_work_area: str = Form(None),
    job_work_stream: str = Form(None),
    function: str = Form(None),
    sub_function: str = Form(None)
):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO user_profiles (
            uid, emp_code, employee_name,
            job_role_code, job_role_text,
            company, state, region, facility,
            category_l1, l1_employee_code,
            date_of_joining, org_unit,
            job_work_area, job_work_stream,
            function, sub_function
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        uid, employee_code, employee_name,
        job_role_code, job_role_text,
        company, state, region, facility,
        category_l1, l1_employee_code,
        date_of_joining, org_unit,
        job_work_area, job_work_stream,
        function, sub_function
    ))

    conn.commit()
    conn.close()

    return {"status": "User added successfully"}

# -----------------------------------
# SOP UPLOAD
# -----------------------------------
@app.post("/api/sop/upload")
def upload_sop(
    doc_name: str = Form(...),
    job_role_code: str = Form(...),
    job_role_text: str = Form(...),
    version: str = Form(...),
    file: UploadFile = File(...)
):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(SOP_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO sop_registry
        (doc_name, job_role_code, job_role_text, file_path, version)
        VALUES (?,?,?,?,?)
    """, (
        doc_name, job_role_code, job_role_text, file_path, version
    ))

    conn.commit()
    conn.close()

    return {"status": "SOP uploaded successfully"}

# -----------------------------------
# VIEW USERS
# -----------------------------------
@app.get("/api/users")
def view_users():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT * FROM user_profiles")
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    conn.close()
    return {"columns": cols, "rows": rows}

# -----------------------------------
# VIEW SOP REGISTRY
# -----------------------------------
@app.get("/api/sops")
def view_sops():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, doc_name, job_role_code, job_role_text, version, is_active, created_at
        FROM sop_registry
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    conn.close()
    return {"columns": cols, "rows": rows}

# -----------------------------------
# VIEW ROLE → SKILL MAP
# -----------------------------------
@app.get("/api/role-skill-map")
def view_role_skill_map():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT job_role_code, job_role_text, skill_id, proficiency, criticality
        FROM job_role_skills
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    conn.close()
    return {"columns": cols, "rows": rows}

# -----------------------------------
# OPEN SOP DOCUMENT  ✅ FIXED
# -----------------------------------
@app.get("/api/sop/open/{doc_name}")
def open_sop(doc_name: str):

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # ✅ FIXED TABLE NAME HERE
    cur.execute("""
        SELECT file_path
        FROM sop_registry
        WHERE doc_name = ?
    """, (doc_name,))

    row = cur.fetchone()
    conn.close()

    if not row:
        return {"error": "Document not found in DB"}

    file_path = row[0]

    if not os.path.exists(file_path):
        return {"error": "File missing from storage"}

    return FileResponse(file_path)

# -----------------------------------
# CONTEXT FETCH (CHATBOT)
# -----------------------------------
@app.get("/api/context/{uid}")
def get_context(uid: str):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT uid, emp_code, employee_name, job_role_code, job_role_text
        FROM user_profiles
        WHERE uid = ?
    """, (uid,))
    user = cur.fetchone()

    if not user:
        return {"error": "User not found"}

    cur.execute("""
        SELECT skill_id, proficiency, criticality
        FROM job_role_skills
        WHERE job_role_code = ?
    """, (user[3],))

    skills = cur.fetchall()
    conn.close()

    return {
        "user_profile": {
            "uid": user[0],
            "emp_code": user[1],
            "employee_name": user[2],
            "job_role_code": user[3],
            "job_role_text": user[4]
        },
        "role_context": [
            {
                "skill_id": s[0],
                "proficiency": s[1],
                "criticality": s[2]
            } for s in skills
        ]
    }
