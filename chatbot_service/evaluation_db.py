import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "evaluation.db")


def init_db():

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_evaluation (

        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        question TEXT,
        retrieved_context TEXT,
        answer TEXT,
        accuracy REAL,
        precision REAL,
        recall REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    )
    """)

    conn.commit()
    conn.close()


def insert_record(data):

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO chat_evaluation
    (uid, question, retrieved_context, answer, accuracy, precision, recall)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data["uid"],
        data["question"],
        data["retrieved_context"],
        data["answer"],
        data["accuracy"],
        data["precision"],
        data["recall"]
    ))

    conn.commit()
    conn.close()