from fastapi import FastAPI, Request, HTTPException
import sqlite3
import os

app = FastAPI(title="MCP Context Server")

# ==============================
# DATABASE PATH (ABSOLUTE SAFE)
# ==============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "../mcp_v2.db")


def get_conn():
    return sqlite3.connect(DB_PATH)


# ==============================
# HEALTH CHECK
# ==============================

@app.get("/")
def health():
    return {"status": "MCP Server Running"}


# ==============================
# ADD USER (FINAL SAFE VERSION)
# ==============================

@app.post("/api/user/add")
async def add_user(request: Request):

    data = await request.form()

    try:
        conn = get_conn()
        cursor = conn.cursor()

        cursor.execute("""
        INSERT INTO user_profiles (
            uid,
            emp_code,
            employee_name,
            job_role_code,
            job_role_text,
            date_of_joining,
            org_unit_text,
            job_work_area,
            job_work_stream,
            function_text,
            sub_function_text,
            company_text,
            state,
            region,
            facility,
            category_l1_name,
            l1_emp_code
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data.get("uid"),
            data.get("employee_code"),
            data.get("employee_name"),
            data.get("job_role_code"),
            data.get("job_role_text"),
            data.get("date_of_joining"),
            data.get("org_unit"),
            data.get("job_work_area"),
            data.get("job_work_stream"),
            data.get("function"),
            data.get("sub_function"),
            data.get("company"),
            data.get("state"),
            data.get("region"),
            data.get("facility"),
            data.get("category_l1"),
            data.get("l1_employee_code")
        ))

        conn.commit()
        conn.close()

        return {"message": "User added successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================
# GET USERS (FOR ADMIN PANEL)
# ==============================

@app.get("/api/users")
def get_users():

    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_profiles")

    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    conn.close()

    return {
        "columns": columns,
        "rows": rows
    }
