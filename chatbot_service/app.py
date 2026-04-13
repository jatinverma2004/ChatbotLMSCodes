from groq import Groq
import json
import re

# ✅ SET YOUR API KEY HERE
client = Groq(api_key="Your API key here")


def evaluate_answer(question, context, answer):

    print("\n🧠 EVALUATION STARTED")

    prompt = f"""
Evaluate the chatbot response strictly.

Return ONLY JSON in this format:

{{
"accuracy": 0-1,
"relevance": 0-1,
"grounding": 0-1,
"verdict": "Excellent/Good/Average/Poor",
"reason": "short reason"
}}

QUESTION:
{question}

CONTEXT:
{context[:1200]}

ANSWER:
{answer}
"""

    try:
        res = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        raw = res.choices[0].message.content.strip()

        print("🔍 RAW LLM OUTPUT:\n", raw)

        # ================= FIX 1: REMOVE CODE BLOCKS =================
        raw = raw.replace("```json", "").replace("```", "").strip()

        # ================= FIX 2: EXTRACT JSON =================
        match = re.search(r"\{.*\}", raw, re.DOTALL)

        if not match:
            print("❌ NO JSON FOUND IN RESPONSE")
            return None

        json_str = match.group()

        # ================= FIX 3: SAFE PARSE =================
        try:
            data = json.loads(json_str)
        except Exception as e:
            print("❌ JSON PARSE ERROR:", e)
            return None

        print("✅ PARSED DATA:", data)

        # ================= FIX 4: RETURN CLEAN STRUCTURE =================
        return {
            "accuracy": float(data.get("accuracy", 0)),
            "precision": float(data.get("relevance", 0)),
            "recall": float(data.get("grounding", 0)),
            "verdict": data.get("verdict", "Unknown"),
            "reason": data.get("reason", "")
        }

    except Exception as e:
        print("🔥 EVALUATION ERROR:", str(e))
        return None
