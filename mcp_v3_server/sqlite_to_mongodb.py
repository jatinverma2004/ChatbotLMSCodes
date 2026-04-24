
from pymongo import MongoClient
import sqlite3
import json
from datetime import datetime
 
# Connect to MongoDB
mongo_client = MongoClient("mongodb://localhost:27017")
db = mongo_client["jio_lms_chatbot"]
 
# Connect to SQLite
sqlite_conn = sqlite3.connect("C:/Users/jatin/Desktop/langflow_project/mcp_v3_server/mcp_v3.db")
sqlite_cursor = sqlite_conn.cursor()
 
# Function to migrate table
def migrate_table(table_name):
    try:
        sqlite_cursor.execute(f"SELECT * FROM {table_name}")
        columns = [description[0] for description in sqlite_cursor.description]
        rows = sqlite_cursor.fetchall()
        
        records = []
        for row in rows:
            record = dict(zip(columns, row))
            records.append(record)
        
        if records:
            db[table_name].insert_many(records)
            print(f"✓ Migrated {len(records)} records from {table_name}")
        else:
            print(f"⚠ No records found in {table_name}")
    
    except Exception as e:
        print(f"✗ Error migrating {table_name}: {e}")
 
# Migrate all tables
tables = [
    "user_profiles",
    "sop_registry",
    "skills_registry",
    "job_role_skills",
    "user_skills_map",
    "user_auth"
]
 
for table in tables:
    migrate_table(table)
 
print("✓ Migration complete!")
sqlite_conn.close()