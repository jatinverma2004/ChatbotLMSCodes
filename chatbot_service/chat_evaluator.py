import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3"

# chat_evaluator.py

import re
from collections import Counter

def _tokenize(text: str):
    if not text:
        return []
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [t for t in text.split() if len(t) > 2]
    return tokens

def _overlap_score(context_tokens, answer_tokens):
    if not context_tokens or not answer_tokens:
        return 0.2

    ctx = Counter(context_tokens)
    ans = Counter(answer_tokens)

    overlap = sum(min(ctx[w], ans[w]) for w in ans)
    total = sum(ans.values())

    if total == 0:
        return 0.2

    score = overlap / total
    return min(max(score, 0.0), 1.0)

def evaluate_answer(question: str, context: str, answer: str):
    """
    Returns RAG-friendly metrics:
    - accuracy: how much answer overlaps with context
    - precision: overlap precision
    - recall: overlap recall
    """

    context_tokens = _tokenize(context)
    answer_tokens = _tokenize(answer)

    if not context_tokens:
        # no SOP context retrieved
        return {
            "accuracy": 0.3,
            "precision": 0.3,
            "recall": 0.3
        }

    overlap = _overlap_score(context_tokens, answer_tokens)

    # derive metrics
    precision = overlap
    recall = overlap
    accuracy = overlap

    return {
        "accuracy": round(accuracy, 2),
        "precision": round(precision, 2),
        "recall": round(recall, 2)
    }
