import sqlite3
import uuid

conn = sqlite3.connect("mcp_v2.db")
cur = conn.cursor()

# -----------------------
# JOB ROLE
# -----------------------
job_role_code = "BH001"
job_role_text = "Business Head"

cur.execute("""
INSERT OR IGNORE INTO job_roles
(job_role_code, job_role_text, description)
VALUES (?, ?, ?)
""", (job_role_code, job_role_text, "Leads business operations"))

# -----------------------
# SKILLS
# -----------------------
skills = [
    ("S1", "Task Execution & Prioritization", "Skill"),
    ("S2", "Operational Systems", "Knowledge"),
    ("S3", "Effective Communication", "Skill")
]

for s in skills:
    cur.execute("""
    INSERT OR IGNORE INTO skills_master
    (skill_id, skill_name, skill_type)
    VALUES (?, ?, ?)
    """, s)

# -----------------------
# ROLE → SKILL MAPPING
# -----------------------
mappings = [
    ("S1", "Skill", "High"),
    ("S2", "Knowledge", "High"),
    ("S3", "Skill", "Medium")
]

for skill_id, prof, crit in mappings:
    cur.execute("""
    INSERT OR IGNORE INTO job_role_skills
    (id, job_role_code, job_role_text, skill_id, proficiency, criticality)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), job_role_code, job_role_text, skill_id, prof, crit))

# -----------------------
# USER
# -----------------------
cur.execute("""
INSERT OR IGNORE INTO user_profiles
(uid, emp_code, employee_name, job_role_code, job_role_text)
VALUES (?, ?, ?, ?, ?)
""", ("U001", "EMP001", "Jatin Verma", job_role_code, job_role_text))

conn.commit()
conn.close()

print("Seed data inserted successfully.")
