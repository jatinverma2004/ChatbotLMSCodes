import sqlite3
import os

# ================= DB PATH =================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "evaluation.db")

# ================= INIT =================

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        question TEXT,
        retrieved_context TEXT,
        answer TEXT,
        accuracy REAL,
        precision REAL,
        recall REAL,
        verdict TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

# ================= INSERT =================

def insert_record(data: dict):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
        INSERT INTO evaluations (
            uid,
            question,
            retrieved_context,
            answer,
            accuracy,
            precision,
            recall,
            verdict,
            reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("uid"),
            data.get("question"),
            data.get("retrieved_context"),
            data.get("answer"),
            data.get("accuracy"),
            data.get("precision"),
            data.get("recall"),
            data.get("verdict"),
            data.get("reason")
        ))

        conn.commit()
        conn.close()

        print("✅ DB INSERT SUCCESS")

    except Exception as e:
        print("🔥 DB INSERT ERROR:", str(e))
