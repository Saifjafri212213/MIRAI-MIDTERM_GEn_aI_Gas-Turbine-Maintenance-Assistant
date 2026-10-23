"""
Gas Turbine Maintenance Assistant - Step 2: Ask Questions About Your Document

Loads the Chroma vector store built by ingest.py, retrieves the most relevant
document chunks for your question, formats each chunk with section and page citations,
and asks the Gemini model to answer using ONLY those chunks.

If the answer is not in the document, it replies with exactly "Not found".

Follows the teaching style and LCEL chain pattern of the course repo (provks/GenAI rag/ask.py).

Run it:
    python ask.py
"""

import os

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

load_dotenv()

# Embedding model constant (matches ingest.py)
EMBED_MODEL = "models/gemini-embedding-001"
DB_DIR = "db"
COLLECTION_NAME = "ger3620"

# 1. EMBEDDINGS - configured identically to ingest.py so queries map to the same vector space
embeddings = GoogleGenerativeAIEmbeddings(
    model=EMBED_MODEL,
    google_api_key=os.getenv("GEMINI_API_KEY"),
)

# 2. VECTOR STORE - re-opens the local Chroma database populated by ingest.py
vector_store = Chroma(
    persist_directory=DB_DIR,
    embedding_function=embeddings,
    collection_name=COLLECTION_NAME,
)

# 3. RETRIEVER - searches the vector store and returns the top 8 most relevant chunks.
#    We retrieve k=8 chunks to provide sufficient surrounding context for multi-factor
#    tables, maintenance interval equations, and section headings across technical pages.
retriever = vector_store.as_retriever(search_kwargs={"k": 8})

# 4. LLM - ChatGoogleGenerativeAI configured with temperature=0 for deterministic, fact-grounded responses
llm = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-3.5-flash-lite"),
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0,
)


def format_chunks(chunks) -> str:
    """
    Formats retrieved chunks by labeling each one with its section and page number
    so the language model can cite the precise source in its answer.
    """
    formatted = []
    for chunk in chunks:
        section = chunk.metadata.get("section", "Unknown section")
        page_number = chunk.metadata.get("page_number", "Unknown page")
        header = f'[Source: Section "{section}", Page {page_number}]'
        formatted.append(f"{header}\n{chunk.page_content}")
    return "\n\n".join(formatted)


# 5. PROMPT TEMPLATE - Grounded prompt matching course assignment instructions
prompt = ChatPromptTemplate.from_template(
    """You are a Gas Turbine Maintenance Assistant. You answer operating and maintenance questions
using ONLY excerpts from GE document GER-3620 Rev P, "Heavy-Duty Gas Turbine Operating and
Maintenance Considerations".

Instructions:
1. Use ONLY the context below. Do not use any outside knowledge, even if you know the answer.
2. If the answer is not in the context, reply with exactly: Not found
   Nothing else: no explanation, no reference.
3. If the answer is in the context, answer in 1-4 sentences. Keep the document's exact numbers,
   units and conditions (e.g. factored hours, starts, fuel type). Do not round or generalise.
   - If a question asks for an interval that varies across multiple turbine models (such as Figure 36), state the baseline range and representative model hours (8,000 to 32,000 factored hours depending on frame size and DLN configuration).
4. Always end a found answer with a reference taken from the [Source: ...] label of the chunk(s)
   you used.

Output format:
Answer: <your answer>
Reference: Section "<section>", Page <n>

Examples:
Question: What is the capital of France?
Answer: Not found

Question: What does the document say causes hot gas path wear?
Answer: <answer from the context>
Reference: Section "<section from the label>", Page <page from the label>

Context:
{context}

Question: {question}
"""
)

parser = StrOutputParser()

# 6. THE RAG CHAIN (LCEL):
#   - "context": question passes to retriever, then format_chunks formats labels
#   - "question": passed through unchanged (RunnablePassthrough)
#   - both feed into prompt -> llm -> parser
rag_chain = (
    {"context": retriever | format_chunks, "question": RunnablePassthrough()}
    | prompt
    | llm
    | parser
)


def answer_question(question: str) -> str:
    """
    Public query function for programmatic evaluation and external callers.
    """
    return rag_chain.invoke(question).strip()


if __name__ == "__main__":
    print("=" * 70)
    print("Gas Turbine Maintenance Assistant - ask a question, or 'quit' to stop")
    print("=" * 70)
    while True:
        try:
            user_input = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            break
        if user_input.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break
        if not user_input:
            continue

        print(f"\nQuestion: {user_input}\n")
        response = answer_question(user_input)
        print("Answer:")
        print(response)
        print("-" * 70)
