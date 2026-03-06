import sqlite3
from datetime import datetime

# Connect to database
conn = sqlite3.connect("mcp_v3.db")
cursor = conn.cursor()

# Fetch all SOP ids and skill levels
cursor.execute("SELECT id, skill_level FROM sop_registry;")
sops = cursor.fetchall()

for sop_id, skill_level in sops:

    # Map skill level to criticality
    if skill_level == "S3":
        criticality = "HIGH"
    elif skill_level == "S2":
        criticality = "MEDIUM"
    else:
        criticality = "LOW"

    proficiency_level = skill_level
    last_updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Insert metadata
    cursor.execute(
        """
        INSERT INTO sop_metadata (sop_id, criticality, proficiency_level, last_updated)
        VALUES (?, ?, ?, ?)
        """,
        (sop_id, criticality, proficiency_level, last_updated)
    )

conn.commit()
conn.close()

print("✅ Metadata populated successfully.")