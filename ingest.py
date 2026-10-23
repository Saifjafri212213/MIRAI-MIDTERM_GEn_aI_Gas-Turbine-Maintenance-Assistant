"""
Gas Turbine Maintenance Assistant - Step 1: Ingest Document

Loads the GE GER-3620 Rev P technical document, segments pages into
semantically coherent chunks while preserving section headings and page
numbers, generates vector embeddings using Google Generative AI, and stores
them in a local Chroma vector database.

Follows the teaching style and structure of the course repo (provks/GenAI rag/ingest.py).

Run it:
    python ingest.py
"""

import os
import re
import shutil
import sys
import time

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma

load_dotenv()

# Embedding model constant (easy to swap between models/gemini-embedding-001 and models/embedding-001)
EMBED_MODEL = "models/gemini-embedding-001"
PDF_PATH = "data/GER-3620-P.pdf"
DB_DIR = "db"
COLLECTION_NAME = "ger3620"


def clean_heading(line: str) -> str:
    """Strip leading page numbers or bullets from a candidate heading line."""
    return re.sub(r"^\d+\s*", "", line).strip()


def is_section_heading(line: str) -> bool:
    """
    Detect short, title-like heading lines (under ~60 chars, Title Case, no ending period)
    such as 'Combustion Inspection', 'Hot Gas Path Inspection', 'Major Inspection',
    'Maintenance Factors', 'Inspection Intervals'.
    """
    s = clean_heading(line)
    if not (4 <= len(s) <= 60):
        return False
    # Headings do not end in punctuation
    if s.endswith((".", ",", ";", ":", "-")):
        return False
    # Avoid mathematical symbols, bullets, or equation notation
    if any(c in s for c in ["=", "<", ">", "%", "+", "*", "/", "\\", "_", "•", "–", "—", "(", ")", "[", "]", "@", "$"]):
        return False
    # Filter header/footer boilerplate and common non-headings
    lower = s.lower()
    if any(skip in lower for skip in ["ger-3620", "doc name", "non-public", "heavy-duty gas turbine", "figure", "table", "revision history", "page "]):
        return False
    # Avoid fused column text from multi-column tables (e.g., 'InspectionType')
    if re.search(r"[a-z][A-Z]", s):
        return False
    # Check title casing across words
    raw_words = re.split(r"[\s\-]+", s)
    words = [w for w in raw_words if w.isalpha()]
    if not words:
        return False
    stop_words = {"and", "or", "of", "for", "to", "the", "in", "with", "on", "vs", "by", "at"}
    if len(words) == 1:
        return words[0] in ["Introduction", "Conclusion", "Appendix", "References"]
    for w in words:
        if w.lower() in stop_words:
            continue
        if not w[0].isupper():
            return False
    return True


def main(pdf_path: str = PDF_PATH) -> None:
    # 1. DOCUMENT LOADER - opens the PDF file and pulls out its raw text,
    #    one "document" per page. PyPDFLoader's metadata['page'] is 0-indexed,
    #    so we store metadata['page_number'] = page + 1 for clean, human-readable citations.
    loader = PyPDFLoader(pdf_path)
    documents = loader.load()
    for doc in documents:
        doc.metadata["page_number"] = doc.metadata.get("page", 0) + 1
    print(f"Loaded {len(documents)} page(s) from {pdf_path}")

    # 2. TEXT SPLITTER - cuts the long text into small, overlapping chunks
    #    (1000 characters each, overlapping by 150 characters).
    #    NOTE ON CHUNK SIZE: We use 1000/150 rather than the course repo's 500/50
    #    because GE GER-3620 is a dense engineering specification containing
    #    multi-sentence operating procedures, maintenance factor equations, and
    #    detailed inspection interval tables (e.g. Figure 36). A 500-char window
    #    would sever the relationships between operating conditions, formulas,
    #    and their baseline intervals.
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = []
    current_section = "Operating and Maintenance Considerations"

    for doc in documents:
        page_num = doc.metadata["page_number"]
        page_chunks = splitter.split_documents([doc])
        for chunk in page_chunks:
            # Check lines in this chunk to detect the nearest heading above/within it
            for line in chunk.page_content.split("\n"):
                if is_section_heading(line):
                    current_section = clean_heading(line)
            chunk.metadata["section"] = current_section if current_section else "Unknown section"
            chunk.metadata["page_number"] = page_num
            chunks.append(chunk)

    print(f"Created {len(chunks)} chunk(s)")

    # 3. EMBEDDINGS - turns each chunk's text into a vector representation
    #    that captures semantic meaning. Chunks with similar engineering concepts
    #    end up close to each other in vector space.
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBED_MODEL,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )

    # 4. VECTOR STORE - a local, searchable vector database (Chroma).
    #    We delete the old ./db directory first so that re-running this script
    #    re-indexes cleanly and never creates duplicate chunks.
    if os.path.exists(DB_DIR):
        shutil.rmtree(DB_DIR)

    # Note on API rate limits: Google's free-tier embedding API enforces a limit
    # of 100 requests per minute. To stay comfortably within this limit, we index
    # in batches of 70 chunks and wait between batches, with automatic retry.
    batch_size = 70
    vector_store = None

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        print(f"Embedding and storing chunks {i + 1} to {min(i + batch_size, len(chunks))} of {len(chunks)}...")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                if vector_store is None:
                    vector_store = Chroma.from_documents(
                        batch,
                        embeddings,
                        persist_directory=DB_DIR,
                        collection_name=COLLECTION_NAME,
                    )
                else:
                    vector_store.add_documents(batch)
                break
            except Exception as e:
                if ("429" in str(e) or "ResourceExhausted" in str(e)) and attempt < max_retries - 1:
                    print(f"Rate limit reached. Waiting 30s before retry (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(30)
                else:
                    raise e

        # Pause between batches to respect the 100 requests/minute quota
        if i + batch_size < len(chunks):
            print("Pausing 60s to respect Google API 100 requests/minute rate limit...")
            time.sleep(60)

    print(f"Saved to local vector store: ./{DB_DIR} (collection: '{COLLECTION_NAME}')")


if __name__ == "__main__":
    target_path = sys.argv[1] if len(sys.argv) > 1 else PDF_PATH
    main(target_path)
