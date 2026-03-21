import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3"


def evaluate_answer(question, context, answer):

    prompt = f"""
You are an AI evaluation system.

Question:
{question}

Context (SOP content):
{context}

Answer:
{answer}

Evaluate the answer.

Return JSON:
{{
 "accuracy": score between 0 and 1,
 "precision": score between 0 and 1,
 "recall": score between 0 and 1
}}

Do not explain.
"""

    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False
    }

    res = requests.post(OLLAMA_URL, json=payload)

    text = res.json()["response"]

    try:
        result = json.loads(text)
    except:
        result = {
            "accuracy": 0.5,
            "precision": 0.5,
            "recall": 0.5
        }

    return result