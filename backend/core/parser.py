import pdfplumber
import re

def extract_text_from_pdf(file_bytes: bytes) -> str:
    import io
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    raw = "\n".join(text_parts)
    return normalize_text(raw)

def normalize_text(text: str) -> str:
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text
