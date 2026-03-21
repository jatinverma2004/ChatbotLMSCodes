import streamlit as st
import requests
import pandas as pd

API_BASE = "http://127.0.0.1:8100"

st.set_page_config(page_title="MCP Admin Panel", layout="wide")
st.title("MCP ADMIN PANEL")

# -----------------------------
# SIDEBAR
# -----------------------------
section = st.sidebar.selectbox(
    "Select Section",
    [
        "Add User",
        "Upload SOP",
        "View Tables",
        "Add Skills Registry",
        "Assign Skill to User"
    ]
)

# -----------------------------
# ADD USER
# -----------------------------
if section == "Add User":
    st.header("Add User Profile")

    uid = st.text_input("UID")
    emp_code = st.text_input("Employee Code")
    emp_name = st.text_input("Employee Name")

    job_role_code = st.text_input("Job Role Code")
    job_role_text = st.text_input("Job Role Text")

    date_of_joining = st.text_input("Date of Joining")
    org_unit = st.text_input("Org Unit")
    job_work_area = st.text_input("Job Work Area")
    job_work_stream = st.text_input("Job Work Stream")

    function = st.text_input("Function")
    sub_function = st.text_input("Sub Function")

    company = st.text_input("Company")
    state = st.text_input("State")
    region = st.text_input("Region")
    facility = st.text_input("Facility")

    category_l1 = st.text_input("Category L1 Name")
    l1_employee_code = st.text_input("L1 Employee Code")

    if st.button("Save User"):
        data = {
            "uid": uid,
            "employee_code": emp_code,
            "employee_name": emp_name,
            "job_role_code": job_role_code,
            "job_role_text": job_role_text,
            "date_of_joining": date_of_joining,
            "org_unit": org_unit,
            "job_work_area": job_work_area,
            "job_work_stream": job_work_stream,
            "function": function,
            "sub_function": sub_function,
            "company": company,
            "state": state,
            "region": region,
            "facility": facility,
            "category_l1": category_l1,
            "l1_employee_code": l1_employee_code
        }

        r = requests.post(f"{API_BASE}/api/user/add", data=data)

        if r.status_code == 200:
            st.success("User added successfully")
        else:
            st.error(r.text)

# -----------------------------
# UPLOAD SOP
# -----------------------------
elif section == "Upload SOP":
    st.header("Upload SOP / Role Document")

    doc_name = st.text_input("Document Name")
    job_role_code = st.text_input("Job Role Code (e.g. BH001)")
    job_role_text = st.text_input("Job Role Text (e.g. Business Head)")
    version = st.text_input("Version", value="v1.0")

    uploaded_file = st.file_uploader(
        "Upload SOP File (PDF / DOCX)",
        type=["pdf", "docx"]
    )

    if st.button("Upload SOP"):
        if not uploaded_file:
            st.error("Please select a file")
        else:
            files = {
                "file": (
                    uploaded_file.name,
                    uploaded_file,
                    uploaded_file.type
                )
            }

            data = {
                "doc_name": doc_name,
                "job_role_code": job_role_code,
                "job_role_text": job_role_text,
                "version": version
            }

            r = requests.post(
                f"{API_BASE}/api/sop/upload",
                data=data,
                files=files
            )

            if r.status_code == 200:
                st.success("SOP uploaded successfully")
            else:
                st.error(r.text)

# -----------------------------
# ADD SKILLS REGISTRY
# -----------------------------
elif section == "Add Skills Registry":

    st.header("Add Skill")

    skill_id = st.text_input("Skill ID (e.g TH001)")
    skill_name = st.text_input("Skill Name")
    proficiency = st.selectbox("Proficiency", ["LOW","MEDIUM","HIGH"])
    criticality = st.selectbox("Criticality", ["LOW","MEDIUM","HIGH"])

    if st.button("Save Skill"):

        data = {
            "skill_id": skill_id,
            "skill_name": skill_name,
            "proficiency": proficiency,
            "criticality": criticality
        }

        r = requests.post(f"{API_BASE}/api/skill/add", data=data)

        if r.status_code == 200:
            st.success("Skill added")
        else:
            st.error(r.text)

    # 🔥 SHOW SKILL TABLE WITH COLUMNS
    r = requests.get(f"{API_BASE}/api/skills")

    if r.status_code == 200:
        data = r.json()
        df = pd.DataFrame(data["rows"], columns=data["columns"])
        st.dataframe(df, use_container_width=True)

# -----------------------------
# ASSIGN SKILL TO USER
# -----------------------------
elif section == "Assign Skill to User":

    st.header("Assign Skill to User")

    uid = st.text_input("User UID")

    # 🔥 LOAD SKILL REGISTRY FOR DROPDOWN
    skills_resp = requests.get(f"{API_BASE}/api/skills")

    skill_options = []

    if skills_resp.status_code == 200:
        skill_data = skills_resp.json()
        skill_options = [
            f"{row[0]} - {row[1]}" for row in skill_data["rows"]
        ]

    selected_skill = st.selectbox(
        "Select Skill",
        skill_options if skill_options else ["No Skills Available"]
    )

    skill_id = selected_skill.split(" - ")[0] if " - " in selected_skill else ""

    if st.button("Assign"):

        data = {
            "uid": uid,
            "skill_id": skill_id
        }

        r = requests.post(f"{API_BASE}/api/user-skill/add", data=data)

        if r.status_code == 200:
            st.success("Skill assigned")
        else:
            st.error(r.text)

    # 🔥 SHOW ASSIGNED SKILLS WITH COLUMN NAMES
    if uid:
        r = requests.get(f"{API_BASE}/api/user-skills/{uid}")

        if r.status_code == 200:
            data = r.json()
            df = pd.DataFrame(data["rows"], columns=data["columns"])
            st.dataframe(df, use_container_width=True)

# -----------------------------
# VIEW TABLES
# -----------------------------
elif section == "View Tables":
    st.header("View Database Tables")

    table = st.selectbox(
        "Select Table",
        [
            "Users",
            "SOP Registry",
            "Role → Skill Map"
        ]
    )

    if table == "Role → Skill Map":

        st.subheader("Add / Update Role Skill Mapping")

        col1, col2, col3 = st.columns(3)

        role_code = col1.text_input("Job Role Code (e.g BH001)")
        skill_level = col2.selectbox("Skill Level", ["S1","S2","S3"])
        proficiency = col3.selectbox("Proficiency Level", ["LOW","MEDIUM","HIGH"])

        criticality = st.selectbox("Criticality Level", ["LOW","MEDIUM","HIGH"])

        if st.button("Save Role Skill Map"):

            payload = {
                "job_role_code": role_code,
                "skill_level": skill_level,
                "proficiency": proficiency,
                "criticality": criticality
            }

            r = requests.post(
                f"{API_BASE}/api/role-skill-map/add",
                json=payload
            )

            if r.status_code == 200:
                st.success("Role Skill Map Updated")
            else:
                st.error(r.text)

        r = requests.get(f"{API_BASE}/api/role-skill-map")

    elif table == "Users":
        r = requests.get(f"{API_BASE}/api/users")

    else:
        r = requests.get(f"{API_BASE}/api/sops")

    if r.status_code == 200:
        data = r.json()
        df = pd.DataFrame(data["rows"], columns=data["columns"])
        st.dataframe(df, use_container_width=True)
    else:
        st.error(r.text)