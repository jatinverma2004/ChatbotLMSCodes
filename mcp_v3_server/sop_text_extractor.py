import os

def extract_text(file_path: str, filename: str) -> str:
    """
    Extract text from SOP files without pytesseract.
    Supports: .txt, .pdf, .docx
    """
    ext = os.path.splitext(filename)[1].lower()

    # ── Plain text ──────────────────────────────────────────
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    # ── PDF ─────────────────────────────────────────────────
    elif ext == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                return "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
        except ImportError:
            pass

        try:
            import PyPDF2
            text = []
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text.append(page.extract_text() or "")
            return "\n".join(text)
        except ImportError:
            pass

        return ""  # PDF but no library available

    # ── Word Document ────────────────────────────────────────
    elif ext == ".docx":
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs)
        except ImportError:
            pass

        return ""  # docx but no library available

    # ── Unsupported ──────────────────────────────────────────
    else:
        return ""