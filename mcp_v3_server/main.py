from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import os
import shutil
import subprocess
from datetime import datetime
import mimetypes

# Import document extraction
from sop_text_extractor import extract_text

app = FastAPI(title="MCP V3 Server - MongoDB Edition")

# ================= CORS CONFIGURATION =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= PATHS =================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "file_storage")

# Create storage directories
for subdir in ["sops", "user_uploads", "snapshots"]:
    os.makedirs(os.path.join(STORAGE_DIR, subdir), exist_ok=True)

# ================= MONGODB CONFIGURATION =================

MONGO_URI = "mongodb://localhost:27017"  # Update if using remote MongoDB
MONGO_DB_NAME = "jio_lms_chatbot"

try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DB_NAME]
    print(f"✓ MongoDB connected to {MONGO_DB_NAME}")
except Exception as e:
    print(f"✗ MongoDB connection failed: {e}")
    print("Ensure MongoDB is running: mongod")

# ================= DATABASE INITIALIZATION =================

def init_mongodb():
    """Initialize MongoDB collections with indexes"""
    try:
        # USER_PROFILES Collection
        if "user_profiles" not in db.list_collection_names():
            db.create_collection("user_profiles")
            db["user_profiles"].create_index("uid", unique=True)
            print("✓ Created user_profiles collection")

        # SOP_REGISTRY Collection
        if "sop_registry" not in db.list_collection_names():
            db.create_collection("sop_registry")
            db["sop_registry"].create_index("doc_name")
            db["sop_registry"].create_index("job_role_code")
            print("✓ Created sop_registry collection")

        # USER_UPLOADS Collection (NEW - for user file uploads)
        if "user_uploads" not in db.list_collection_names():
            db.create_collection("user_uploads")
            db["user_uploads"].create_index("uid")
            db["user_uploads"].create_index("upload_date")
            print("✓ Created user_uploads collection")

        # SNAPSHOTS Collection (NEW - for screenshot/snapshot uploads)
        if "snapshots" not in db.list_collection_names():
            db.create_collection("snapshots")
            db["snapshots"].create_index("uid")
            db["snapshots"].create_index("capture_date")
            print("✓ Created snapshots collection")

        # SKILLS_REGISTRY Collection
        if "skills_registry" not in db.list_collection_names():
            db.create_collection("skills_registry")
            db["skills_registry"].create_index("skill_id", unique=True)
            print("✓ Created skills_registry collection")

        # JOB_ROLE_SKILLS Collection
        if "job_role_skills" not in db.list_collection_names():
            db.create_collection("job_role_skills")
            db["job_role_skills"].create_index("job_role_code")
            print("✓ Created job_role_skills collection")

        # USER_SKILLS_MAP Collection
        if "user_skills_map" not in db.list_collection_names():
            db.create_collection("user_skills_map")
            db["user_skills_map"].create_index("uid")
            print("✓ Created user_skills_map collection")

        # USER_AUTH Collection
        if "user_auth" not in db.list_collection_names():
            db.create_collection("user_auth")
            db["user_auth"].create_index("uid", unique=True)
            print("✓ Created user_auth collection")

    except Exception as e:
        print(f"Error initializing MongoDB: {e}")

# Initialize collections
init_mongodb()

# ================= SUPPORTED FILE TYPES =================

ALLOWED_EXTENSIONS = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'csv': 'text/csv',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
}

# ================= HEALTH CHECK =================

@app.get("/")
def health():
    mongo_status = "connected" if mongo_client.server_info() else "disconnected"
    return {
        "status": "MCP V3 running",
        "database": "MongoDB",
        "mongo_status": mongo_status
    }

# ================= USER MANAGEMENT =================

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
    try:
        user_data = {
            "uid": uid,
            "emp_code": employee_code,
            "employee_name": employee_name,
            "job_role_code": job_role_code,
            "job_role_text": job_role_text,
            "date_of_joining": date_of_joining,
            "org_unit_text": org_unit,
            "job_work_area": job_work_area,
            "job_work_stream": job_work_stream,
            "function_text": function,
            "sub_function_text": sub_function,
            "company_text": company,
            "state": state,
            "region": region,
            "facility": facility,
            "category_l1_name": category_l1,
            "l1_emp_code": l1_employee_code,
            "created_at": datetime.utcnow()
        }
        
        db["user_profiles"].update_one(
            {"uid": uid},
            {"$set": user_data},
            upsert=True
        )
        
        # Create auth record
        db["user_auth"].update_one(
            {"uid": uid},
            {"$set": {"uid": uid, "password": "1234", "role": "employee"}},
            upsert=True
        )
        
        return {"message": "User added successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/users")
def list_users():
    try:
        users = list(db["user_profiles"].find({}, {"_id": 0}))
        if users:
            columns = list(users[0].keys())
            rows = [[user.get(col) for col in columns] for user in users]
            return {"columns": columns, "rows": rows}
        return {"columns": [], "rows": []}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/context/{uid}")
def get_context(uid: str):
    try:
        user = db["user_profiles"].find_one({"uid": uid}, {"_id": 0})
        if not user:
            return {"error": "User not found"}
        return {"user_profile": user}
    except Exception as e:
        return {"error": str(e)}

# ================= SOP MANAGEMENT =================

@app.post("/api/sop/upload")
async def upload_sop(
    doc_name: str = Form(...),
    job_role_code: str = Form(...),
    job_role_text: str = Form(...),
    version: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        # Validate file extension
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            return {"error": f"File type .{file_ext} not allowed"}

        # Save file
        file_path = os.path.join(STORAGE_DIR, "sops", file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract text
        text = extract_text(file_path, file.filename)

        # Store metadata in MongoDB
        sop_record = {
            "doc_name": doc_name,
            "job_role_code": job_role_code,
            "job_role_text": job_role_text,
            "file_path": file_path,
            "file_name": file.filename,
            "file_size": os.path.getsize(file_path),
            "file_type": file_ext,
            "version": version,
            "doc_type": "ROLE",
            "skill_level": "S2",
            "extracted_text_preview": text[:500] if text else "",
            "full_text_length": len(text) if text else 0,
            "upload_date": datetime.utcnow(),
            "content_hash": hash(text) if text else None
        }

        db["sop_registry"].insert_one(sop_record)

        # Trigger embedding generation
        try:
            subprocess.run(
                ["python", "generate_embeddings.py"],
                cwd=BASE_DIR,
                timeout=30
            )
            print("✓ Embeddings generated")
        except Exception as e:
            print(f"⚠ Embedding generation warning: {e}")

        return {"message": "SOP uploaded successfully", "text_extracted": len(text) > 0}

    except Exception as e:
        return {"error": str(e)}

@app.get("/api/sops")
def list_sops(query: str = ""):
    try:
        sops = list(db["sop_registry"].find({}, {"_id": 0}))
        
        if not sops:
            return {"columns": [], "rows": [], "best_match": None}

        # Extract columns from first record
        columns = list(sops[0].keys())
        
        # Score documents based on query
        for sop in sops:
            if query:
                query_lower = query.lower()
                doc_name = sop.get("doc_name", "").lower()
                sop["match_score"] = 100 if query_lower in doc_name else (50 if query_lower in sop.get("file_name", "").lower() else 0)
            else:
                sop["match_score"] = 0

        # Sort by match score
        sops.sort(key=lambda x: -x["match_score"])
        
        rows = [[sop.get(col) for col in columns] for sop in sops]
        best_match = rows[0] if rows else None

        return {
            "columns": columns,
            "rows": rows,
            "best_match": best_match
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/sop/open/{name}")
def open_sop(name: str):
    try:
        sop = db["sop_registry"].find_one({"doc_name": name}, {"_id": 0})
        if not sop:
            return {"error": "SOP not found"}
        return FileResponse(sop["file_path"])
    except Exception as e:
        return {"error": str(e)}

# ================= USER FILE UPLOADS (NEW) =================

@app.post("/api/user/upload-file")
async def upload_user_file(
    uid: str = Form(...),
    file_type: str = Form(...),  # "document" or "snapshot"
    file_description: str = Form(""),
    file: UploadFile = File(...)
):
    """
    Allow users to upload various file types:
    - Images (PNG, JPG, GIF, BMP, WebP)
    - Excel files (XLSX, XLS)
    - PDF documents
    - Word documents (DOCX, DOC)
    - CSV, TXT files
    """
    try:
        # Validate user exists
        user = db["user_profiles"].find_one({"uid": uid})
        if not user:
            return {"error": "User not found"}

        # Validate file extension
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            return {"error": f"File type .{file_ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS.keys())}"}

        # Determine storage directory
        if file_type == "snapshot":
            storage_subdir = "snapshots"
            collection = "snapshots"
        else:
            storage_subdir = "user_uploads"
            collection = "user_uploads"

        # Create unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{uid}_{timestamp}_{file.filename}"
        file_path = os.path.join(STORAGE_DIR, storage_subdir, unique_filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(file_path)

        # Extract text if applicable
        extracted_text = ""
        if file_ext in ['pdf', 'docx', 'doc', 'txt']:
            extracted_text = extract_text(file_path, file.filename)

        # Store metadata in MongoDB
        file_record = {
            "uid": uid,
            "file_name": file.filename,
            "unique_file_name": unique_filename,
            "file_path": file_path,
            "file_type": file_ext,
            "file_size": file_size,
            "mime_type": ALLOWED_EXTENSIONS.get(file_ext, "unknown"),
            "file_description": file_description,
            "extracted_text": extracted_text,
            "upload_date": datetime.utcnow(),
            "is_image": file_ext in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
            "is_document": file_ext in ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt'],
            "status": "ready"
        }

        result = db[collection].insert_one(file_record)

        return {
            "message": f"{file_type.capitalize()} uploaded successfully",
            "file_id": str(result.inserted_id),
            "file_name": unique_filename,
            "file_size": file_size,
            "extracted_text_preview": extracted_text[:200] if extracted_text else ""
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/api/user/files/{uid}")
def list_user_files(uid: str, file_type: str = "all"):
    """
    Get all uploaded files for a user
    file_type: "all", "documents", "snapshots", or specific extension
    """
    try:
        if file_type == "snapshots":
            files = list(db["snapshots"].find({"uid": uid}, {"_id": 0, "file_path": 0}))
        elif file_type == "documents":
            files = list(db["user_uploads"].find({"uid": uid}, {"_id": 0, "file_path": 0}))
        else:
            # Combine both collections
            snapshots = list(db["snapshots"].find({"uid": uid}, {"_id": 0, "file_path": 0, "upload_date": 1}))
            uploads = list(db["user_uploads"].find({"uid": uid}, {"_id": 0, "file_path": 0, "upload_date": 1}))
            files = snapshots + uploads
            files.sort(key=lambda x: x.get("upload_date", datetime.utcnow()), reverse=True)

        if files:
            columns = ["file_name", "file_type", "file_size", "upload_date", "file_description"]
            rows = [[f.get(col) for col in columns] for f in files]
            return {"columns": columns, "rows": rows, "total_files": len(files)}
        
        return {"columns": [], "rows": [], "total_files": 0}

    except Exception as e:
        return {"error": str(e)}

@app.get("/api/user/download/{uid}/{file_name}")
def download_user_file(uid: str, file_name: str):
    """Download a user-uploaded file"""
    try:
        # Find file in both collections
        file_doc = db["snapshots"].find_one({"uid": uid, "unique_file_name": file_name})
        if not file_doc:
            file_doc = db["user_uploads"].find_one({"uid": uid, "unique_file_name": file_name})
        
        if not file_doc:
            return {"error": "File not found"}

        return FileResponse(file_doc["file_path"], filename=file_doc["file_name"])

    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/user/delete-file/{uid}/{file_name}")
def delete_user_file(uid: str, file_name: str):
    """Delete a user-uploaded file"""
    try:
        # Find and delete from snapshots
        file_doc = db["snapshots"].find_one_and_delete({"uid": uid, "unique_file_name": file_name})
        if file_doc:
            if os.path.exists(file_doc["file_path"]):
                os.remove(file_doc["file_path"])
            return {"message": "Snapshot deleted successfully"}

        # Find and delete from user_uploads
        file_doc = db["user_uploads"].find_one_and_delete({"uid": uid, "unique_file_name": file_name})
        if file_doc:
            if os.path.exists(file_doc["file_path"]):
                os.remove(file_doc["file_path"])
            return {"message": "File deleted successfully"}

        return {"error": "File not found"}

    except Exception as e:
        return {"error": str(e)}

# ================= SKILLS MANAGEMENT =================

@app.post("/api/skill/add")
async def add_skill(
    skill_id: str = Form(...),
    skill_name: str = Form(""),
    proficiency: str = Form(""),
    criticality: str = Form("")
):
    try:
        skill_data = {
            "skill_id": skill_id,
            "skill_name": skill_name,
            "proficiency": proficiency,
            "criticality": criticality,
            "created_at": datetime.utcnow()
        }
        db["skills_registry"].update_one(
            {"skill_id": skill_id},
            {"$set": skill_data},
            upsert=True
        )
        return {"message": "Skill added successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/skills")
def list_skills():
    try:
        skills = list(db["skills_registry"].find({}, {"_id": 0}))
        if skills:
            columns = list(skills[0].keys())
            rows = [[skill.get(col) for col in columns] for skill in skills]
            return {"columns": columns, "rows": rows}
        return {"columns": [], "rows": []}
    except Exception as e:
        return {"error": str(e)}

# ================= USER SKILL MAPPING =================

@app.post("/api/user-skill/add")
async def add_user_skill(
    uid: str = Form(...),
    skill_id: str = Form(...)
):
    try:
        skill_record = {
            "uid": uid,
            "skill_id": skill_id,
            "assigned_date": datetime.utcnow()
        }
        db["user_skills_map"].insert_one(skill_record)
        return {"message": "User skill added"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/user-skills/{uid}")
def get_user_skills(uid: str):
    try:
        user_skills = list(db["user_skills_map"].find({"uid": uid}, {"_id": 0}))
        skill_ids = [us["skill_id"] for us in user_skills]
        
        skills = list(db["skills_registry"].find(
            {"skill_id": {"$in": skill_ids}},
            {"_id": 0}
        ))
        
        if skills:
            columns = list(skills[0].keys())
            rows = [[skill.get(col) for col in columns] for skill in skills]
            return {"columns": columns, "rows": rows}
        
        return {"columns": [], "rows": []}
    except Exception as e:
        return {"error": str(e)}

# ================= ROLE-SKILL MAPPING =================

@app.post("/api/role-skill-map/save")
async def save_role_skill_map(
    job_role_code: str = Form(...),
    skill_level: str = Form(...),
    proficiency: str = Form(...),
    criticality: str = Form(...)
):
    try:
        # Remove old mapping
        db["job_role_skills"].delete_many({"job_role_code": job_role_code})
        
        # Add new mapping
        mapping = {
            "job_role_code": job_role_code,
            "skill_level": skill_level,
            "proficiency": proficiency,
            "criticality": criticality,
            "updated_at": datetime.utcnow()
        }
        db["job_role_skills"].insert_one(mapping)
        
        return {"message": "Role Skill Map saved successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/role-skill-map")
def list_role_skill_map():
    try:
        mappings = list(db["job_role_skills"].find({}, {"_id": 0}))
        if mappings:
            columns = list(mappings[0].keys())
            rows = [[m.get(col) for col in columns] for m in mappings]
            return {"columns": columns, "rows": rows}
        return {"columns": [], "rows": []}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/role-skill-map/{role_code}")
def get_role_skills(role_code: str):
    try:
        mapping = db["job_role_skills"].find_one(
            {"job_role_code": role_code},
            {"_id": 0}
        )
        if not mapping:
            return {"skills": []}
        
        return {"skills": [mapping]}
    except Exception as e:
        return {"error": str(e)}

# ================= STATS & DASHBOARD =================

@app.get("/api/stats")
def get_stats():
    """Get overall system statistics"""
    try:
        stats = {
            "total_users": db["user_profiles"].count_documents({}),
            "total_sops": db["sop_registry"].count_documents({}),
            "total_skills": db["skills_registry"].count_documents({}),
            "total_user_uploads": db["user_uploads"].count_documents({}),
            "total_snapshots": db["snapshots"].count_documents({}),
            "total_files": db["user_uploads"].count_documents({}) + db["snapshots"].count_documents({}),
            "total_storage_gb": sum([
                os.path.getsize(os.path.join(STORAGE_DIR, subdir, f))
                for subdir in ["sops", "user_uploads", "snapshots"]
                for f in os.listdir(os.path.join(STORAGE_DIR, subdir)) if os.path.isfile(os.path.join(STORAGE_DIR, subdir, f))
            ]) / (1024**3)
        }
        return stats
    except Exception as e:
        return {"error": str(e)}
