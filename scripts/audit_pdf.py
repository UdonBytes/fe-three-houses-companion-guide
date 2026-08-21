import json
import re
import sys
from pathlib import Path

import pdfplumber


PDF_PATH = Path(r"C:\Users\janeh\Downloads\Fire Emblem_ Three Houses One-Stop Guide.pdf")
ROOT = Path(__file__).resolve().parents[1]
CURRENT_DATA = ROOT / "scripts" / "current-data.json"


def extract_pdf_text():
    with pdfplumber.open(PDF_PATH) as pdf:
        pages = []
        for index, page in enumerate(pdf.pages, 1):
            pages.append({"page": index, "text": page.extract_text() or ""})
    return pages


def page_summary(pages):
    for page in pages:
        words = " ".join(page["text"].split()[:36])
        print(f"PAGE {page['page']}: {words}")


def dump_tables(page_numbers):
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number in page_numbers:
            page = pdf.pages[page_number - 1]
            print(f"\n--- PAGE {page_number} TABLES ---")
            tables = page.extract_tables()
            print(f"tables: {len(tables)}")
            for table_index, table in enumerate(tables, 1):
                print(f"TABLE {table_index} rows={len(table)}")
                for row in table[:12]:
                    print(json.dumps(row, ensure_ascii=False))
                if len(table) > 12:
                    print("...")


def clean_cell(value):
    return re.sub(r"\s+", " ", (value or "").strip())


def source_character_name(value):
    value = clean_cell(value)
    # pdfplumber extracts Leonie as "Leonne" on the tea table page.
    # This keeps the audit focused on source data, not extractor noise.
    if value == "Leonne":
        return "Leonie"
    return value


def norm(value):
    value = value or ""
    value = value.replace("�", "'")
    value = value.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    value = value.replace("…", "...")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def text_value(value):
    return value if isinstance(value, str) else value.get("text", "")


def extract_tables(page_numbers):
    rows = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number in page_numbers:
            for table in pdf.pages[page_number - 1].extract_tables():
                for row in table:
                    rows.append([cell or "" for cell in row])
    return rows


def extract_gifts_lost():
    gifts = {}
    lost = {}
    for row in extract_tables([1, 2, 3, 4]):
        if not row or row[0] == "Character":
            continue
        character, gift, house = map(clean_cell, row[:3])
        lost_character, lost_item, lost_house = map(clean_cell, row[4:7])
        if character and gift:
            gifts.setdefault(character, {"house": house, "items": []})["items"].append(gift)
        if lost_character and lost_item:
            lost.setdefault(lost_character, {"house": lost_house, "items": []})["items"].append(lost_item)
    return gifts, lost


def split_lines(value):
    return [line.strip() for line in (value or "").splitlines() if line.strip()]


def parse_final_answers(value):
    lines = split_lines(value)
    entries = []
    index = 0
    while index < len(lines) - 1:
        prompt = lines[index]
        answers = [part.strip() for part in lines[index + 1].split("/") if part.strip()]
        entries.append({"prompt": prompt, "answers": answers})
        index += 2
    return entries


def extract_tea():
    data = {}
    for row in extract_tables([5, 6, 7, 8, 9, 10, 11]):
        if not row or row[0] == "Character":
            continue
        character = source_character_name(row[0])
        if not character:
            continue
        topics = []
        for column in [2, 3, 4]:
            topics.extend(split_lines(row[column]))
        data[character] = {
            "topics": topics,
            "finalResponses": parse_final_answers(row[5]),
            "teas": split_lines(row[6]),
            "house": clean_cell(row[7]),
        }
    return data


def extract_question_answers():
    entries = []
    for row in extract_tables([12, 13, 14, 15, 16, 17, 18, 19, 20]):
        if not row or row[0] == "Question":
            continue
        question, answer, timing = map(clean_cell, row[:3])
        if question and answer:
            entries.append({"question": question, "answer": answer, "timing": timing})
    return entries


def compare_lists(label, source_items, current_items):
    source_norm = {norm(item): item for item in source_items}
    current_norm = {norm(item): item for item in current_items}
    missing = [source_norm[key] for key in source_norm if key not in current_norm]
    extra = [current_norm[key] for key in current_norm if key not in source_norm]
    return {"label": label, "missing": missing, "extra": extra}


def audit():
    current = json.loads(CURRENT_DATA.read_text(encoding="utf-8"))
    by_character = {character["name"]: character for character in current["characters"]}

    pdf_gifts, pdf_lost = extract_gifts_lost()
    pdf_tea = extract_tea()
    pdf_qa = extract_question_answers()

    report = {
        "giftLostIssues": [],
        "teaIssues": [],
        "finalResponseIssues": [],
        "questionAnswerIssues": [],
        "counts": {
            "pdfGiftCharacters": len(pdf_gifts),
            "pdfLostCharacters": len(pdf_lost),
            "pdfTeaCharacters": len(pdf_tea),
            "pdfQuestionAnswers": len(pdf_qa),
            "currentCharacters": len(current["characters"]),
            "currentQuestionAnswers": len(current["questionAnswers"]),
        },
    }

    for name, source in sorted(pdf_gifts.items()):
        current_character = by_character.get(name)
        if not current_character:
            report["giftLostIssues"].append({"character": name, "type": "missing-character-for-gifts"})
            continue
        diff = compare_lists(f"{name} gifts", source["items"], current_character.get("gifts", []))
        if diff["missing"] or diff["extra"]:
            report["giftLostIssues"].append({"character": name, "type": "gifts", **diff})

    for name, source in sorted(pdf_lost.items()):
        current_character = by_character.get(name)
        if not current_character:
            report["giftLostIssues"].append({"character": name, "type": "missing-character-for-lost"})
            continue
        diff = compare_lists(f"{name} lost items", source["items"], current_character.get("lostItems", []))
        if diff["missing"] or diff["extra"]:
            report["giftLostIssues"].append({"character": name, "type": "lostItems", **diff})

    for name, source in sorted(pdf_tea.items()):
        current_character = by_character.get(name)
        if not current_character:
            report["teaIssues"].append({"character": name, "type": "missing-character"})
            continue
        teas = [text_value(item) for item in current_character.get("teas", [])]
        topics = [text_value(item) for item in current_character.get("topics", [])]
        tea_diff = compare_lists(f"{name} teas", source["teas"], teas)
        topic_diff = compare_lists(f"{name} topics", source["topics"], topics)
        if tea_diff["missing"] or tea_diff["extra"]:
            report["teaIssues"].append({"character": name, "type": "teas", **tea_diff})
        if topic_diff["missing"] or topic_diff["extra"]:
            report["teaIssues"].append({"character": name, "type": "topics", **topic_diff})

        source_final = {norm(entry["prompt"]): entry for entry in source["finalResponses"]}
        current_final = {norm(entry["prompt"]): entry for entry in current_character.get("finalResponses", [])}
        for key, entry in source_final.items():
            if key not in current_final:
                report["finalResponseIssues"].append({"character": name, "type": "missing-prompt", "source": entry})
                continue
            answer_diff = compare_lists(f"{name} {entry['prompt']} answers", entry["answers"], current_final[key].get("answers", []))
            if answer_diff["missing"] or answer_diff["extra"]:
                report["finalResponseIssues"].append({
                    "character": name,
                    "type": "answers",
                    "prompt": entry["prompt"],
                    **answer_diff,
                })
        for key, entry in current_final.items():
            if key not in source_final:
                report["finalResponseIssues"].append({"character": name, "type": "extra-prompt", "current": entry})

    source_qa = {norm(entry["question"]): entry for entry in pdf_qa}
    current_qa = {norm(entry["question"]): entry for entry in current["questionAnswers"]}
    for key, entry in source_qa.items():
        if key not in current_qa:
            report["questionAnswerIssues"].append({"type": "missing-question", "source": entry})
            continue
        current_entry = current_qa[key]
        if norm(entry["answer"]) != norm(current_entry["answer"]) or norm(entry["timing"]) != norm(current_entry["timing"]):
            report["questionAnswerIssues"].append({
                "type": "question-mismatch",
                "question": entry["question"],
                "source": entry,
                "current": current_entry,
            })
    for key, entry in current_qa.items():
        alias_keys = [norm(alias) for alias in entry.get("searchAliases", [])]
        if key not in source_qa and not any(alias in source_qa for alias in alias_keys):
            report["questionAnswerIssues"].append({"type": "extra-question", "current": entry})

    out = ROOT / "scripts" / "pdf-audit-report.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report["counts"], indent=2))
    for section in ["giftLostIssues", "teaIssues", "finalResponseIssues", "questionAnswerIssues"]:
        print(section, len(report[section]))
        for item in report[section][:12]:
            print(json.dumps(item, ensure_ascii=False))
        if len(report[section]) > 12:
            print("...")
    print(f"report: {out}")


if __name__ == "__main__":
    if "--tables" in sys.argv:
        pages = extract_pdf_text()
        print(f"pages: {len(pages)}")
        page_summary(pages)
        dump_tables([1, 2, 3, 4, 5, 6, 11, 12, 19, 20, 21])
    elif "--audit" in sys.argv:
        audit()
    else:
        pages = extract_pdf_text()
        print(f"pages: {len(pages)}")
        page_summary(pages)
