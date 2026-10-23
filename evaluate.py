"""
Gas Turbine Maintenance Assistant - Evaluation Script

Runs the 5 graded assignment questions using the RAG pipeline defined in ask.py,
prints the questions, answers, and references clearly to the console, and
saves the results as a formatted markdown table in results/answers.md.

Run it:
    python evaluate.py
"""

import os
import re
from ask import answer_question

QUESTIONS = [
    "What are the three main types of inspection?",
    "What does a maintenance factor of two mean?",
    "What is the purchase price of this gas turbine?",
    "What is the melting point of titanium?",
    "What is the recommended combustion-inspection interval in hours?",
]

OUTPUT_DIR = "results"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "answers.md")


def parse_answer_and_reference(raw_response: str):
    """
    Splits the LLM output into the core answer and its reference citation
    for clean presentation in a markdown table.
    """
    text = raw_response.strip()
    # Strip leading 'Answer:' label if model generated it per output format
    text = re.sub(r"^Answer:\s*", "", text, flags=re.IGNORECASE).strip()

    if text.lower() == "not found":
        return "Not found", "N/A"

    # Search for 'Reference: ...' at the end of the response
    match = re.search(r"(?:Reference|Source):\s*(.*)$", text, re.IGNORECASE | re.DOTALL)
    if match:
        reference = match.group(1).strip()
        answer = text[: match.start()].strip()
        # Clean any trailing labels or newlines from answer
        answer = re.sub(r"\n+", " ", answer)
        reference = re.sub(r"\n+", " ", reference)
        return answer, reference

    # If no explicit reference tag, return full response with N/A
    clean_text = re.sub(r"\n+", " ", text)
    return clean_text, "N/A"


def main():
    print("=" * 75)
    print("Gas Turbine Maintenance Assistant - Running 5 Evaluation Questions")
    print("=" * 75)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    table_rows = []

    for idx, question in enumerate(QUESTIONS, start=1):
        print(f"\n[Question {idx}] {question}")
        raw_answer = answer_question(question)
        print("Answer:")
        print(raw_answer)
        print("-" * 75)

        answer_part, ref_part = parse_answer_and_reference(raw_answer)
        # Escape any pipe characters to prevent breaking markdown tables
        answer_escaped = answer_part.replace("|", "\\|")
        ref_escaped = ref_part.replace("|", "\\|")
        table_rows.append((idx, question, answer_escaped, ref_escaped))

    # Construct results/answers.md
    md_content = "# Gas Turbine Maintenance Assistant - Evaluation Answers\n\n"
    md_content += "Evaluation of GE GER-3620 Rev P RAG assistant across the 5 required questions.\n\n"
    md_content += "| # | Question | Answer | Reference |\n"
    md_content += "|---|----------|--------|-----------|\n"
    for idx, q, a, r in table_rows:
        md_content += f"| {idx} | {q} | {a} | {r} |\n"

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"\nResults saved successfully to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
