from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "pdfs"
OUTPUT = ROOT / "curriculum" / "official"
DATE = "2026-08-16"

VOLUME_TWO_URL = (
    "https://kcpe-kcse.com/wp-content/uploads/2018/02/"
    "SYLLABUS-ORIGINAL-FOR-MATH-PHYSICS-CHEMISTRY-BIOLOGY-AGRICULTURE-HOME-SCIENCE.pdf"
)
VOLUME_THREE_URL = (
    "https://www.scribd.com/document/867743223/Kicd-Syllabus-2002-Vol-3-1"
)
VOLUME_ONE_CATALOGUE = (
    "https://maktaba.pu.ac.ke/cgi-bin/koha/opac-detail.pl?biblionumber=12647"
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("�", "’")).strip()


def slug(value: str) -> str:
    return re.sub(
        r"(^-|-$)",
        "",
        re.sub(r"[^a-z0-9]+", "-", value.lower().replace("’", "").replace("'", "")),
    )


def pages(label: str) -> list[int]:
    found = [int(item) + 1 for item in re.findall(r"\d+", label)]
    return list(range(found[0], found[1] + 1)) if len(found) == 2 else found[:1]


def read_web_rows(pattern: str, lower: int, upper: int) -> list[dict]:
    indexed = {}
    for path in sorted(TMP.glob(pattern)):
        for raw in path.read_text(encoding="utf-8").splitlines():
            parts = raw.split("\t", 2)
            if len(parts) != 3 or not parts[0].isdigit():
                continue
            line = int(parts[0])
            if lower <= line <= upper:
                indexed.setdefault(
                    line,
                    {"line": line, "page": parts[1], "text": clean(parts[2])},
                )
    missing = [line for line in range(lower, upper + 1) if line not in indexed]
    if missing:
        raise RuntimeError(f"{pattern} is missing source lines {missing[:20]}")
    return [indexed[line] for line in sorted(indexed)]


def parse_objectives(
    rows: list[dict],
    include_pages: bool = True,
    allow_roman_labels: bool = False,
) -> list[dict]:
    objectives = []
    current = None
    for row in rows:
        text = row["text"]
        if not text or re.match(
            r"^(By the end|learner should|able to:?|Specific Objectives)", text, re.I
        ):
            continue
        if allow_roman_labels:
            match = re.match(
                r"^(?:\(([a-z])\)|([a-z])\)|((?:viii|vii|iii|vi|iv|ii|ix|x|v|i))\)?)\s*(.*)$",
                text,
                re.I,
            )
            label = (
                next(group for group in match.groups()[:3] if group)
                if match
                else None
            )
            objective_text = match.group(4) if match else None
        else:
            match = re.match(r"^([a-z])\s*\)\s*(.*)$", text, re.I)
            label = match.group(1) if match else None
            objective_text = match.group(2) if match else None
        if match:
            if current:
                objectives.append(current)
            current = {
                "label": f"{label.lower()})",
                "text": clean(objective_text),
            }
            if include_pages:
                current["sourcePages"] = pages(row.get("page", ""))
            continue
        if current:
            current["text"] = clean(f"{current['text']} {text}")
            if include_pages:
                current["sourcePages"] = sorted(
                    set(current["sourcePages"] + pages(row.get("page", "")))
                )
    if current:
        objectives.append(current)
    if not objectives:
        unlabelled_rows = [
            row
            for row in rows
            if row["text"]
            and not re.match(
                r"^(By the end|learner should|able to:?|Specific Objectives)",
                row["text"],
                re.I,
            )
        ]
        unlabelled_text = clean(" ".join(row["text"] for row in unlabelled_rows))
        if unlabelled_text:
            objective = {"label": "unlabelled", "text": unlabelled_text}
            if include_pages:
                objective["sourcePages"] = sorted(
                    {
                        page
                        for row in unlabelled_rows
                        for page in pages(row.get("page", ""))
                    }
                )
            objectives.append(objective)
    for order, objective in enumerate(objectives, 1):
        objective["order"] = order
    return objectives


def volume_two_forms(
    subject: str, pattern: str, lower: int, upper: int
) -> dict[str, list[dict]]:
    rows = read_web_rows(pattern, lower, upper)
    form = None
    starts = []
    names = {"ONE": "Form 1", "TWO": "Form 2", "THREE": "Form 3", "FOUR": "Form 4"}
    for index, row in enumerate(rows):
        marker = re.fullmatch(r"FORM (ONE|TWO|THREE|FOUR)", row["text"], re.I)
        if marker:
            form = names[marker.group(1).upper()]
            continue
        topic = re.match(r"^(\d+)\.0\.0\s+(.+)$", row["text"])
        if topic and form:
            starts.append((index, int(topic.group(1)), topic.group(2), form))

    result = {f"Form {number}": [] for number in range(1, 5)}
    for position, (start, number, first_title, form) in enumerate(starts):
        stop = starts[position + 1][0] if position + 1 < len(starts) else len(rows)
        block = rows[start:stop]
        objective_at = next(
            (
                i
                for i, row in enumerate(block)
                if re.match(
                    rf"^{number}\.(?:1|2)\.\d+\s+Spec(?:ific|ial) Objectives", row["text"], re.I
                )
            ),
            None,
        )
        content_at = next(
            (
                i
                for i, row in enumerate(block)
                if re.match(
                    rf"^{number}\.(?:2\.\d+|20)\s+Content", row["text"], re.I
                )
            ),
            None,
        )
        if objective_at is None or content_at is None:
            raise RuntimeError(
                f"{subject} topic {number} lacks an objective/content boundary"
            )

        title_parts = [first_title]
        for row in block[1:objective_at]:
            text = re.sub(
                r"\(\s*\d+\s+lessons?\s*\)", "", row["text"], flags=re.I
            )
            if clean(text) and not re.fullmatch(r"\d+", clean(text)):
                title_parts.append(clean(text))
        title = clean(
            re.sub(
                r"\(\s*\d+\s+lessons?\s*\)",
                "",
                " ".join(title_parts),
                flags=re.I,
            )
        )
        objectives = parse_objectives(block[objective_at + 1 : content_at])
        content = block[content_at + 1 :]
        sub_starts = []
        for offset, row in enumerate(content):
            match = re.match(
                rf"^({number}\.(?:\.)?2\.(\d+))\s+(.+)$", row["text"]
            )
            if match:
                sub_starts.append(
                    (
                        offset,
                        f"{number}.2.{int(match.group(2))}",
                        match.group(1),
                        match.group(3),
                    )
                )

        sub_topics = []
        counts = {}
        for sub_position, (offset, code, raw_code, first_name) in enumerate(sub_starts):
            sub_stop = (
                sub_starts[sub_position + 1][0]
                if sub_position + 1 < len(sub_starts)
                else len(content)
            )
            name_parts = [first_name]
            source_pages = pages(content[offset]["page"])
            for row in content[offset + 1 : sub_stop]:
                text = row["text"]
                if (
                    not text
                    or re.match(
                        r"^(Notes?|Suggested|Project|Practical|Caution)", text, re.I
                    )
                    or re.match(r"^[▪•-]", text)
                    or re.match(r"^[a-z]\s*\)", text, re.I)
                    or re.match(r"^\d+\.\d+\.\d+", text)
                    or re.fullmatch(r"\d+", text)
                ):
                    break
                name_parts.append(text)
                source_pages.extend(pages(row["page"]))
            counts[code] = counts.get(code, 0) + 1
            item = {
                "code": code,
                "order": len(sub_topics) + 1,
                "name": clean(" ".join(name_parts)),
                "sourcePages": sorted(set(source_pages)),
                "objectiveStatus": (
                    "official_topic_objectives_apply"
                    if objectives
                    else "source_required"
                ),
            }
            if raw_code != code:
                item["sourceCode"] = raw_code
                item["sourceDiscrepancy"] = "OCR code normalized from the cited scan."
            sub_topics.append(item)

        if not sub_topics:
            raise RuntimeError(f"{subject} topic {number} has no numbered content")
        for sub_topic in sub_topics:
            if counts[sub_topic["code"]] > 1:
                sub_topic["sourceDiscrepancy"] = (
                    "The cited syllabus repeats this code; source order is preserved."
                )
        result[form].append(
            {
                "code": f"{number}.0.0",
                "order": len(result[form]) + 1,
                "name": title,
                "sourcePages": pages(block[0]["page"]),
                "objectiveStatus": "sourced" if objectives else "source_required",
                "objectives": objectives,
                "objectiveScope": "official_topic_level",
                "subTopics": sub_topics,
            }
        )
    return result


def docx_paragraphs(filename: str) -> list[str]:
    return [clean(paragraph.text) for paragraph in Document(TMP / filename).paragraphs]


ENGLISH_SPECS = {
    "Form 1": [
        (1, "LISTENING AND SPEAKING", 7, 35),
        (2, "GRAMMAR", 35, 88),
        (3, "READING", 88, 132),
        (4, "WRITING", 132, 188),
    ],
    "Form 2": [
        (5, "LISTENING AND SPEAKING", 194, 234),
        (6, "GRAMMAR", 234, 275),
        (7, "READING", 275, 314),
        (8, "WRITING", 314, 370),
    ],
    "Form 3": [
        (9, "LISTENING AND SPEAKING", 376, 405),
        (10, "GRAMMAR", 405, 444),
        (11, "READING", 444, 492),
        (12, "WRITING", 492, 531),
    ],
    "Form 4": [
        (13, "LISTENING AND SPEAKING", 537, 565),
        (14, "GRAMMAR", 565, 597),
        (15, "READING", 597, 638),
        (16, "WRITING", 638, 676),
    ],
}

ENGLISH_SUBTOPICS = {
    "Form 1": {
        "LISTENING AND SPEAKING": [
            "Pronunciation",
            "Listening Comprehension and note-taking",
            "Mastery of Content",
            "Etiquette",
            "Non-verbal cues that enhance listening and speaking",
        ],
        "GRAMMAR": ["Parts of speech", "Phrases", "Simple sentences"],
        "READING": [
            "Reading Skills",
            "Intensive Reading",
            "Extensive Reading",
            "Comprehension Skills",
        ],
        "WRITING": [
            "Handwriting",
            "Spelling rules",
            "Building sentence skills and paragraphing",
            "Punctuation",
            "Personal writing",
            "Social Writing",
            "Study Writing",
            "Creative Writing",
            "Institutional Writing",
        ],
    },
    "Form 2": {
        "LISTENING AND SPEAKING": [
            "Pronunciation",
            "Listening Comprehension and Note-taking",
            "Mastery of Content",
            "Etiquette",
            "Non-verbal skills in listening and speaking",
        ],
        "GRAMMAR": ["Parts of speech", "Phrases", "Clauses"],
        "READING": [
            "Reading Skills",
            "Intensive Reading",
            "Extensive Reading",
            "Comprehension Skills",
        ],
        "WRITING": [
            "Spelling",
            "Building sentence skills and paragraphing",
            "Punctuation",
            "Study Writing",
            "Creative Writing",
            "Institutional Writing",
            "Personal Writing",
            "Social Writing",
            "Public Writing",
        ],
    },
    "Form 3": {
        "LISTENING AND SPEAKING": [
            "Pronunciation",
            "Listening, Comprehension and Note-taking",
            "Mastery of Content",
            "Etiquette",
            "Non-verbal cues that enhance listening and speaking",
        ],
        "GRAMMAR": ["Parts of speech", "Phrases", "Clauses"],
        "READING": [
            "Reading Skills",
            "Intensive Reading",
            "Extensive Reading",
            "Comprehension Skills",
        ],
        "WRITING": [
            "Building Sentence Skills and Paragraphing",
            "Punctuation",
            "Personal Writing",
            "Social Writing",
            "Public Writing",
            "Study Writing",
            "Creative Writing",
            "Institutional Writing",
        ],
    },
    "Form 4": {
        "LISTENING AND SPEAKING": [
            "Pronunciation",
            "Listening Comprehension and Note-taking",
            "Mastery of content",
            "Etiquette",
        ],
        "GRAMMAR": ["Parts of Speech", "Clauses"],
        "READING": [
            "Reading Skills",
            "Intensive Reading",
            "Extensive Reading",
            "Comprehension Skills",
        ],
        "WRITING": [
            "Building Sentence Skills and Paragraphing",
            "Punctuation",
            "Personal Writing",
            "Social Writing",
            "Public Writing",
            "Study Writing",
            "Creative Writing",
            "Institutional Writing",
        ],
    },
}


def english_forms() -> dict[str, list[dict]]:
    paragraphs = docx_paragraphs("kie-english-syllabus.docx")
    result = {}
    for form, specs in ENGLISH_SPECS.items():
        result[form] = []
        for number, name, start, stop in specs:
            section = [line for line in paragraphs[start:stop] if line]
            objective_at = next(
                (i for i, line in enumerate(section) if "Specific Objectives" in line),
                None,
            )
            objective_lines = []
            if objective_at is not None:
                for line in section[objective_at + 1 :]:
                    if "introduction" in line.lower() or re.match(
                        rf"^{number}\.[23]", line
                    ):
                        break
                    objective_lines.extend(clean(item) for item in line.splitlines())
            objectives = parse_objectives(
                [{"text": line, "page": ""} for line in objective_lines],
                include_pages=False,
                allow_roman_labels=True,
            )
            sub_topics = [
                {
                    "code": None,
                    "order": order,
                    "name": sub_name,
                    "objectiveStatus": (
                        "official_topic_objectives_apply"
                        if objectives
                        else "source_required"
                    ),
                }
                for order, sub_name in enumerate(ENGLISH_SUBTOPICS[form][name], 1)
            ]
            if not sub_topics:
                raise RuntimeError(f"English {form} {name} has no source sub-topics")
            topic = {
                "code": f"{number}.0",
                "order": len(result[form]) + 1,
                "name": name,
                "objectiveStatus": "sourced" if objectives else "source_required",
                "objectives": objectives,
                "objectiveScope": "official_topic_level",
                "subTopics": sub_topics,
            }
            if (form, name) == ("Form 1", "LISTENING AND SPEAKING"):
                topic["code"] = None
                topic["sourceDiscrepancy"] = (
                    "The archived Form extract provides the heading and objectives "
                    "without a printed Form-level parent code; no code was invented."
                )
            if (form, name) == ("Form 4", "READING"):
                topic["code"] = None
                topic["sourceCode"] = "15.3"
                topic["sourceDiscrepancy"] = (
                    "The archived extract prints READING and 15.3 section labels but "
                    "omits a Form-level parent code; no 15.0 code was invented."
                )
            if (form, name) == ("Form 3", "GRAMMAR"):
                topic["sourceDiscrepancy"] = (
                    "The archived Form 3 extract repeats 6.3.1-6.3.3 content codes "
                    "under topic 10.0; headings are preserved without invented "
                    "sub-topic codes."
                )
            result[form].append(topic)
    return result


CRE_FORM_THREE = [
    (
        16,
        "THE GIFTS OF THE HOLY SPIRIT",
        [
            ("16.21", "Peter's message on the Day of Pentecost (Acts 2:1-40)"),
            (
                "16.22",
                "The teaching of Jesus on the role of the Holy Spirit "
                "(John 14:15-26; 16:5-15, Acts 1:7-8)",
            ),
            ("16.23", "The gifts of the Holy Spirit (1 Corinthians 12, 13, 14)"),
            (
                "16.24",
                "The criteria for discerning the gifts of the Holy Spirit "
                "(1 Corinthians 12:1-3; Matthew 7:15-20; Galatians 5:16-26)",
            ),
            (
                "16.25",
                "Manifestations of the gifts of the Holy Spirit in the church today "
                "(Galatians 5:16-26)",
            ),
            ("16.26", "The fruit of the Holy Spirit (Galatians 5:6-26)"),
        ],
    ),
    (
        17,
        "UNITY OF BELIEVERS",
        [
            (
                "17.21",
                "Teaching on the unity of believers in selected New Testament texts",
            )
        ],
    ),
    (
        18,
        "SELECTED OLD TESTAMENT PROPHETS AND THEIR TEACHINGS",
        [
            ("18.21", "Definition of the terms 'prophets' and 'prophecy'"),
            ("18.22", "Categories of prophets"),
            ("18.23", "Importance of prophets"),
            ("18.24", "The characteristics of prophets"),
            ("18.25", "The writing of prophetic Messages"),
            (
                "18.26",
                "Relationship between the Old Testament prophecies and the New Testament",
            ),
            (
                "18.27",
                "Similarities and differences between the traditional and the Old "
                "Testament prophets and their relevance to Christians today",
            ),
        ],
    ),
    (
        19,
        "AMOS",
        [
            ("19.21", "Background to Amos"),
            ("19.22", "The call of Amos (Amos 1:1; 3:8; 7:10-15)"),
            ("19.23", "The visions of Amos (Amos 7:1-9; 8:1-3; 9:1-4)"),
            ("19.24", "The Teachings of Prophet Amos"),
        ],
    ),
    (
        20,
        "JEREMIAH",
        [
            (
                "20.21",
                "Political social and religious background of Prophet Jeremiah",
            ),
            ("20.22", "Personal life and the call of Jeremiah (Jeremiah 1)"),
            ("20.23", "Evils addressed by prophet Jeremiah"),
            ("20.24", "The temple sermon (Jeremiah 7:1-8:1-3)"),
            (
                "20.25",
                "Relevance of Jeremiah's teaching on evils and false prophets to "
                "Christians today",
            ),
            ("20.26", "Teachings on judgment and punishment"),
            ("20.27", "Symbolic acts related to judgment and punishment"),
            ("20.28", "Suffering and Lamentations of Jeremiah"),
            ("20.29", "The New Covenant"),
            ("20.30", "Symbolic acts related to hope and restoration"),
            (
                "20.31",
                "The fall of Jerusalem and the exile of the Israelites (Jeremiah 39)",
            ),
            (
                "20.32",
                "Relating the teachings of Jeremiah to the New Testament and Christian "
                "life today",
            ),
        ],
    ),
    (
        21,
        "NEHEMIAH",
        [
            ("21.21", "Political, religious and social background to Nehemiah"),
            ("21.22", "Occasions when Nehemiah prayed"),
            ("21.23", "Importance of prayer in Christian life"),
            ("21.23", "Good leadership qualities"),
            (
                "21.25",
                "Relevance of Nehemiah's leadership to Christians today",
            ),
            ("21.26", "Problems faced by Nehemiah"),
            (
                "21.27",
                "Relevance of Nehemiah's experiences to Christians today",
            ),
            ("21.28", "Renewal of the covenant"),
            (
                "21.29",
                "Dedication of the wall of Jerusalem (Nehemiah 12:27-47)",
            ),
            ("21.30", "Final reforms (Nehemiah 13)"),
            (
                "21.31",
                "Teachings from Nehemiah's exemplary life to St. Luke's gospel and a "
                "Christian life today",
            ),
        ],
    ),
]


def cre_docx_form(form: str, start: int, stop: int, expected: range) -> list[dict]:
    paragraphs = docx_paragraphs("kie-cre-syllabus.docx")
    flat = []
    for paragraph in paragraphs[start:stop]:
        flat.extend(clean(line) for line in paragraph.splitlines() if clean(line))
    summary = {}
    for line in flat:
        match = re.match(r"^(\d+)\.0\.0\s+(.+)$", line)
        if match and int(match.group(1)) in expected:
            summary.setdefault(int(match.group(1)), match.group(2).rstrip("."))

    starts = []
    seen = set()
    for index, line in enumerate(flat):
        match = re.match(r"^(\d+)\.(?:00|0,0|0\.0)\s+(.+)$", line)
        if match:
            if index + 1 >= len(flat) or "Specific Objectives" not in flat[index + 1]:
                continue
            number = int(match.group(1))
            if number in expected and number not in seen:
                starts.append((index, number, match.group(2)))
                seen.add(number)

    topics = []
    for position, (index, number, detailed_name) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(flat)
        block = flat[index:end]
        objective_at = next(
            (i for i, line in enumerate(block) if "Specific Objectives" in line),
            None,
        )
        content_at = next(
            (
                i
                for i, line in enumerate(block)
                if re.match(r"^(CONTENT:?|\d+\.(?:2\.0|20) Content)", line, re.I)
            ),
            None,
        )
        if content_at is None:
            first_sub_topic = next(
                (
                    i
                    for i, line in enumerate(block)
                    if re.match(
                        rf"^(?:{number}\.\d+\.\d+|{number}\.\d{{2}})\s+", line
                    )
                ),
                None,
            )
            content_at = first_sub_topic - 1 if first_sub_topic is not None else None
        objectives = (
            parse_objectives(
                [
                    {"text": line, "page": ""}
                    for line in block[objective_at + 1 : content_at]
                ],
                include_pages=False,
            )
            if objective_at is not None and content_at is not None
            else []
        )
        sub_topics = []
        if content_at is not None:
            for line in block[content_at + 1 :]:
                dotted = re.match(rf"^{number}\.(\d+)\.(\d+)\s+(.+)$", line)
                compact = re.match(rf"^{number}\.(\d{{2}})\s+(.+)$", line)
                source_discrepancy = None
                if dotted:
                    code = f"{number}.{int(dotted.group(1))}{int(dotted.group(2))}"
                    source_code = (
                        f"{number}.{int(dotted.group(1))}.{int(dotted.group(2))}"
                    )
                    name = dotted.group(3)
                elif compact:
                    code = f"{number}.{compact.group(1)}"
                    source_code = code
                    name = compact.group(2)
                elif number == 23:
                    truncated = re.match(r"^3\.2\.1\s+(.+)$", line)
                    if not truncated:
                        continue
                    code = "23.21"
                    source_code = "3.2.1"
                    name = truncated.group(1)
                    source_discrepancy = (
                        "The archived DOCX truncates source code 23.21 as 3.2.1; "
                        "the official Volume Three scan shows 23.21."
                    )
                else:
                    continue
                item = {
                    "code": code,
                    "sourceCode": source_code,
                    "order": len(sub_topics) + 1,
                    "name": name,
                    "objectiveStatus": (
                        "official_topic_objectives_apply"
                        if objectives
                        else "source_required"
                    ),
                }
                if source_discrepancy:
                    item["sourceDiscrepancy"] = source_discrepancy
                sub_topics.append(item)
        duplicate_codes = {
            item["code"]
            for item in sub_topics
            if sum(1 for other in sub_topics if other["code"] == item["code"]) > 1
        }
        for item in sub_topics:
            if item["code"] in duplicate_codes:
                item["sourceDiscrepancy"] = item.get(
                    "sourceDiscrepancy",
                    f"The official source repeats sub-topic code {item['code']}.",
                )
        if not sub_topics:
            raise RuntimeError(f"CRE {form} topic {number} has no source sub-topics")
        topics.append(
            {
                "code": f"{number}.00",
                "order": len(topics) + 1,
                "name": clean(summary.get(number, detailed_name)).upper(),
                "objectiveStatus": "sourced" if objectives else "source_required",
                "objectives": objectives,
                "objectiveScope": "official_topic_level",
                "subTopics": sub_topics,
            }
        )
    missing = sorted(
        set(expected) - {int(topic["code"].split(".")[0]) for topic in topics}
    )
    if missing:
        raise RuntimeError(f"CRE {form} missing topics {missing}")
    return topics


def cre_forms() -> dict[str, list[dict]]:
    result = {
        "Form 1": cre_docx_form("Form 1", 29, 222, range(1, 10)),
        "Form 2": cre_docx_form("Form 2", 222, 371, range(10, 16)),
        "Form 4": cre_docx_form("Form 4", 551, 726, range(22, 29)),
    }
    form_three = []
    for number, name, source_sub_topics in CRE_FORM_THREE:
        duplicate_codes = {
            code
            for code, _ in source_sub_topics
            if sum(1 for other, _ in source_sub_topics if other == code) > 1
        }
        sub_topics = []
        for code, sub_name in source_sub_topics:
            item = {
                "code": code,
                "order": len(sub_topics) + 1,
                "name": sub_name,
                "sourceLines": "KIE Volume Three scan lines 3414-3598",
                "objectiveStatus": "source_required",
            }
            if code in duplicate_codes:
                item["sourceDiscrepancy"] = (
                    "The official scan repeats 21.23 and omits 21.24; "
                    "source order is preserved."
                )
            sub_topics.append(item)
        form_three.append(
            {
                "code": f"{number}.00",
                "order": len(form_three) + 1,
                "name": name,
                "sourcePrintedPages": list(range(84, 88)),
                "objectiveStatus": "source_required",
                "objectiveSourceNote": (
                    "The official two-column scan contains topic objectives, but the "
                    "archive text interleaves columns. Exact objective-to-topic "
                    "transcription requires manual source review."
                ),
                "objectiveScope": "official_topic_level",
                "subTopics": sub_topics,
            }
        )
    result["Form 3"] = form_three
    return result


def write_candidate(
    subject: str,
    form: str,
    topics: list[dict],
    source: dict,
    form_reference: str | None = None,
) -> None:
    objective_status = (
        "sourced"
        if all(topic["objectiveStatus"] == "sourced" for topic in topics)
        else "mixed_source_required"
    )
    if form_reference:
        source = {**source, "formReference": form_reference}
    document = {
        "schemaVersion": 1,
        "educationSystem": "8-4-4",
        "form": form,
        "subject": subject,
        "verificationStatus": "OFFICIAL_VERIFIED_NOT_IMPORTED",
        "applicationStatus": "provisional_seed_preserved",
        "objectiveStatus": objective_status,
        "objectiveMappingPolicy": (
            "Official objectives are retained at topic level because the cited KIE "
            "syllabuses do not map each objective one-to-one to a numbered sub-topic."
        ),
        "source": source,
        "topics": topics,
    }
    directory = OUTPUT / f"form-{form.split()[-1]}"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{slug(subject)}.json").write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    volume_two = {
        "Mathematics": ("kie-volume-2-mathematics-web-extract.txt", 143, 2845),
        "Physics": ("kie-volume-2-physics-web-extract.txt", 2846, 4087),
        "Chemistry": ("kie-volume-2-chemistry-web-extract*.txt", 4088, 5877),
        "Biology": ("kie-volume-2-biology-web-extract.txt", 5878, 7080),
    }
    source_two = {
        "authority": (
            "Kenya Institute of Education (KIE), Ministry of Education, "
            "Science and Technology"
        ),
        "title": "Secondary Education Syllabus Volume Two",
        "year": "2002",
        "edition": "First published April 2002",
        "archiveDocument": VOLUME_TWO_URL,
        "bibliographicRecord": "https://library.spu.ac.ke/bib/46784",
        "accessedOn": DATE,
        "sourceType": "archived_official_syllabus",
    }
    for subject, (pattern, lower, upper) in volume_two.items():
        for form, topics in volume_two_forms(subject, pattern, lower, upper).items():
            write_candidate(subject, form, topics, source_two)

    source_one = {
        "authority": (
            "Kenya Institute of Education (KIE), Ministry of Education, "
            "Science and Technology"
        ),
        "title": "Secondary Education Syllabus Volume One - English extract",
        "year": "2002",
        "edition": "Archived syllabus extract; exact reprint not stated in the mirror",
        "archiveDocument": (
            "https://drive.google.com/open?id=1ckKAELak19L3x9FvgCyV9H485KsqtUu4"
        ),
        "crossCheckDocument": (
            "https://drive.google.com/open?id=1j4AsRQqDIFGZMGfJEp1kp7kEalmeirjV"
        ),
        "bibliographicRecord": VOLUME_ONE_CATALOGUE,
        "accessedOn": DATE,
        "sourceType": "archived_official_syllabus_extract",
    }
    for form, topics in english_forms().items():
        write_candidate(
            "English",
            form,
            topics,
            source_one,
            f"{form} section in the archived English syllabus extract",
        )

    source_three = {
        "authority": (
            "Kenya Institute of Education (KIE), Ministry of Education, "
            "Science and Technology"
        ),
        "title": "Secondary Education Syllabus Volume Three",
        "year": "2002",
        "edition": "First published 2002; reprinted 2005, 2011 and 2012",
        "archiveDocument": VOLUME_THREE_URL,
        "accessedOn": DATE,
        "sourceType": "archived_official_syllabus",
    }
    ranges = {
        "Form 1": "printed pages 75-79",
        "Form 2": "printed pages 80-83",
        "Form 3": "printed pages 84-87",
        "Form 4": "printed pages 88-91",
    }
    for form, topics in cre_forms().items():
        write_candidate(
            "Christian Religious Education",
            form,
            topics,
            source_three,
            ranges[form],
        )

    print(
        "Generated 24 official Form 1-4 candidates; "
        "Kiswahili remains SOURCE UNAVAILABLE."
    )


if __name__ == "__main__":
    main()
