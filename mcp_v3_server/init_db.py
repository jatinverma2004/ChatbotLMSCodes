import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "mcp_v3.db")

conn = sqlite3.connect(DB_PATH)
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

conn.commit()
conn.close()

print("MCP V3 Database Ready")
