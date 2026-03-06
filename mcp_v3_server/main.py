from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
import sqlite3
import os
import shutil

app = FastAPI(title="MCP V3 Server")

# ================= PATHS =================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "mcp_v3.db")
SOP_DIR = os.path.join(BASE_DIR, "sop_storage")

if not os.path.exists(SOP_DIR):
    os.makedirs(SOP_DIR)

def get_conn():
    return sqlite3.connect(DB_PATH)

# ================= DB INIT =================

conn = get_conn()
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS user_profiles (
    uid TEXT PRIMARY KEY,
    emp_code TEXT,
    employee_name TEXT,
    job_role_code TEXT,
    job_role_text TEXT,
    date_of_joining TEXT,
    org_unit_text TEXT,
    job_work_area TEXT,
    job_work_stream TEXT,
    function_text TEXT,
    sub_function_text TEXT,
    company_text TEXT,
    state TEXT,
    region TEXT,
    facility TEXT,
    category_l1_name TEXT,
    l1_emp_code TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS sop_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_name TEXT,
    job_role_code TEXT,
    job_role_text TEXT,
    file_path TEXT,
    version TEXT,
    doc_type TEXT DEFAULT 'ROLE'
)
""")
# ================= SAFE MIGRATION FOR OLD DB =================
try:
    cursor.execute("ALTER TABLE sop_registry ADD COLUMN skill_level TEXT DEFAULT 'S2'")
except Exception as e:
    print("skill_level column already exists or migration skipped")

cursor.execute("""
CREATE TABLE IF NOT EXISTS job_role_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_role_code TEXT,
    skill_level TEXT,
    proficiency TEXT,
    criticality TEXT
)
""")
# ================= SKILL REGISTRY TABLES (PHASE 1) =================

try:
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS skills_registry (
        skill_id TEXT PRIMARY KEY,
        skill_name TEXT,
        proficiency TEXT,
        criticality TEXT
    )
    """)
except:
    pass

try:
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_skills_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        skill_id TEXT
    )
    """)
except:
    pass

conn.commit()
conn.close()

# ================= HEALTH =================

@app.get("/")
def health():
    return {"status": "MCP V3 running"}

# ================= USERS =================

@app.post("/api/user/add")
async def add_user(
    uid: str = Form(...),
    employee_code: str = Form(""),
    employee_name: str = Form(""),
    job_role_code: str = Form(""),
    job_role_text: str = Form(""),
    date_of_joining: str = Form(""),
    org_unit: str = Form(""),
    job_work_area: str = Form(""),
    job_work_stream: str = Form(""),
    function: str = Form(""),
    sub_function: str = Form(""),
    company: str = Form(""),
    state: str = Form(""),
    region: str = Form(""),
    facility: str = Form(""),
    category_l1: str = Form(""),
    l1_employee_code: str = Form("")
):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT OR REPLACE INTO user_profiles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """,(
        uid,
        employee_code,
        employee_name,
        job_role_code,
        job_role_text,
        date_of_joining,
        org_unit,
        job_work_area,
        job_work_stream,
        function,
        sub_function,
        company,
        state,
        region,
        facility,
        category_l1,
        l1_employee_code
    ))

    conn.commit()
    conn.close()

    return {"message":"User added successfully"}

@app.get("/api/users")
def users():

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_profiles")

    rows = cursor.fetchall()
    columns = [c[0] for c in cursor.description]

    conn.close()

    return {"columns":columns,"rows":rows}

# ================= CONTEXT =================

@app.get("/api/context/{uid}")
def context(uid: str):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_profiles WHERE uid=?",(uid,))
    row = cursor.fetchone()

    if not row:
        return {"error":"User not found"}

    columns = [c[0] for c in cursor.description]
    profile = dict(zip(columns,row))

    conn.close()

    return {"user_profile":profile}

# ================= SOP UPLOAD =================

@app.post("/api/sop/upload")
async def upload_sop(
    doc_name: str = Form(...),
    job_role_code: str = Form(""),
    job_role_text: str = Form(""),
    version: str = Form("v1.0"),
    file: UploadFile = File(...)
):

    file_path = os.path.join(SOP_DIR, file.filename)

    with open(file_path,"wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO sop_registry(doc_name,job_role_code,job_role_text,file_path,version,doc_type)
    VALUES (?,?,?,?,?,?)
    """,(doc_name,job_role_code,job_role_text,file_path,version,"ROLE"))

    conn.commit()
    conn.close()

    return {"message":"SOP uploaded successfully"}

# 🔥 THIS FORMAT MATCHES chat_ui.py EXACTLY
@app.get("/api/sops")
def list_sops(query: str = ""):

    conn = get_conn()
    cursor = conn.cursor()

    # Fetch SOPs with metadata
    cursor.execute("""
        SELECT
            s.doc_name,
            s.job_role_code,
            s.job_role_text,
            s.version,
            s.doc_type,
            s.skill_level,
            m.criticality,
            m.proficiency_level,
            m.last_updated
        FROM sop_registry s
        LEFT JOIN sop_metadata m
        ON s.id = m.sop_id
    """)

    rows = cursor.fetchall()

    # Convert rows to dictionary objects
    sops = []
    for r in rows:
        sops.append({
            "doc_name": r[0],
            "job_role_code": r[1],
            "job_role_text": r[2],
            "version": r[3],
            "doc_type": r[4],
            "skill_level": r[5],
            "criticality": r[6],
            "proficiency_level": r[7],
            "last_updated": r[8]
        })

    # -----------------------------
    # STEP 1: Query Matching Score
    # -----------------------------

    query = query.lower()

    for sop in sops:
        name = sop["doc_name"].lower()

        if query and query in name:
            sop["match_score"] = 1
        else:
            sop["match_score"] = 0

    # -----------------------------
    # STEP 2: Metadata Priority
    # -----------------------------

    priority_map = {
        "HIGH": 1,
        "MEDIUM": 2,
        "LOW": 3
    }

    for sop in sops:
        sop["priority"] = priority_map.get(sop["criticality"], 4)

    # -----------------------------
    # STEP 3: Final Ranking
    # -----------------------------

    sops.sort(key=lambda x: (
        -x["match_score"],   # query match first
        x["priority"]        # then metadata ranking
    ))

    conn.close()

    # -----------------------------
    # Prepare response
    # -----------------------------

    columns = [
        "doc_name",
        "job_role_code",
        "job_role_text",
        "version",
        "doc_type",
        "skill_level",
        "criticality",
        "proficiency_level",
        "last_updated"
    ]

    rows = [
        [
            sop["doc_name"],
            sop["job_role_code"],
            sop["job_role_text"],
            sop["version"],
            sop["doc_type"],
            sop["skill_level"],
            sop["criticality"],
            sop["proficiency_level"],
            sop["last_updated"]
        ]
        for sop in sops
    ]

    return {
        "columns": columns,
        "rows": rows,
        "best_match": rows[0] if rows else None
    }
@app.get("/api/sop/open/{name}")
def open_sop(name: str):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT file_path FROM sop_registry WHERE doc_name=?",(name,))
    row = cursor.fetchone()

    conn.close()

    if not row:
        return {"error":"Not found"}

    return FileResponse(row[0])

# ================= ROLE SKILL MAP =================

@app.get("/api/role-skill-map")
def role_skill_map():

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM job_role_skills")

    rows = cursor.fetchall()
    columns = [c[0] for c in cursor.description]

    conn.close()

    return {"columns":columns,"rows":rows}

@app.get("/api/role-skill-map/{role_code}")
def role_skill_by_role(role_code:str):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT skill_level,proficiency,criticality
        FROM job_role_skills
        WHERE job_role_code=?
    """,(role_code,))

    rows = cursor.fetchall()

    conn.close()

    skills=[{"skill_level":r[0],"proficiency":r[1], "criticality":r[2]} for r in rows]

    return {"skills":skills}


# ================= SKILLS REGISTRY =================

@app.post("/api/skill/add")
async def add_skill(
    skill_id: str = Form(...),
    skill_name: str = Form(""),
    proficiency: str = Form(""),
    criticality: str = Form("")
):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR REPLACE INTO skills_registry
        VALUES (?,?,?,?)
    """,(skill_id,skill_name,proficiency,criticality))

    conn.commit()
    conn.close()

    return {"message":"Skill added successfully"}


@app.get("/api/skills")
def list_skills():

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM skills_registry")

    rows = cursor.fetchall()
    columns = [c[0] for c in cursor.description]

    conn.close()

    return {"columns":columns,"rows":rows}

# ================= USER SKILL MAP =================

@app.post("/api/user-skill/add")
async def add_user_skill(
    uid: str = Form(...),
    skill_id: str = Form(...)
):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO user_skills_map(uid,skill_id)
        VALUES (?,?)
    """,(uid,skill_id))

    conn.commit()
    conn.close()

    return {"message":"User skill added"}


@app.get("/api/user-skills/{uid}")
def get_user_skills(uid:str):

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT s.skill_id,s.skill_name,s.proficiency,s.criticality
        FROM skills_registry s
        JOIN user_skills_map u
        ON s.skill_id = u.skill_id
        WHERE u.uid=?
    """,(uid,))

    rows = cursor.fetchall()
    columns = [c[0] for c in cursor.description]

    conn.close()

    return {"columns":columns,"rows":rows}

# ================= SAVE ROLE SKILL MAP =================

@app.post("/api/role-skill-map/save")
async def save_role_skill_map(
    job_role_code: str = Form(...),
    skill_level: str = Form(...),
    proficiency: str = Form(...),
    criticality: str = Form(...)
):

    conn = get_conn()
    cursor = conn.cursor()

    # Remove old mapping (update behavior)
    cursor.execute(
        "DELETE FROM job_role_skills WHERE job_role_code=?",
        (job_role_code,)
    )

    cursor.execute("""
        INSERT INTO job_role_skills(job_role_code,skill_level,proficiency,criticality)
        VALUES (?,?,?,?)
    """,(job_role_code,skill_level,proficiency,criticality))

    conn.commit()
    conn.close()

    return {"message":"Role Skill Map saved successfully"}