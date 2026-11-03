#!/usr/bin/env python3
"""Convert the Yorkshire regional DMARD guideline (.docx) into app content.

Usage:
    python3 tools/build_content.py "path/to/YORKSHIRE DMARD GUIDELINES.docx"

Requires pandoc. Writes:
    content/guideline.json   sections and drug pages (HTML fragments)
    content/media/           images embedded in the guideline
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "content")

# Drug headings in the biologics chapter are bold paragraphs, not Word
# headings. Promote them so every drug becomes its own page.
BOLD_PARA = re.compile(
    r"^(?:<blockquote>\s*)?<p>((?:<strong>(?:[^<]|</?sup>)*</strong>\s*[^<\s]{0,2}\s*)+)</p>(?:\s*</blockquote>)?",
    re.M)
KNOWN_BIOLOGICS = (
    "Abatacept", "Adalimumab", "Anakinra", "Belimumab", "Certolizumab",
    "Etanercept", "Golimumab", "Guselkumab", "Infliximab", "Risankizumab",
    "Rituximab", "Sarilumab", "Tocilizumab", "Ustekinumab",
)

# Chapter titles in the docx -> (id, title, group)
CHAPTERS = [
    ("Introduction", "introduction", "Introduction", "About"),
    ("Abbreviations", "abbreviations", "Abbreviations", "About"),
    ("Corticosteroids", "corticosteroids", "Corticosteroids", "Topics"),
    ("Synthetic or csDMARDs", "csdmards", "csDMARDs overview", "csDMARDs"),
    ("Biologic therapy", "biologics", "Biologics overview", "Biologics (bDMARDs)"),
    ("Targeted Synthetic DMARDS", "tsdmards", "tsDMARDs overview", "Targeted synthetic (tsDMARDs)"),
    ("Guidance on vaccination", "vaccination", "Vaccination & travel", "Topics"),
    ("Recommendations for patients undergoing surgical", "surgery", "Surgery (peri-operative)", "Topics"),
    ("Guidance on use of DMARDS in", "pregnancy", "Pregnancy & breastfeeding", "Topics"),
    ("References", "references", "References", "About"),
]

# Short pages that are really part of the chapter overview.
OVERVIEW_PARTS = ("Table 1", "Table 2", "Table 3", "Treatment with TNF")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def clean_title(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).replace("Ⓡ", "®").replace(" R)", "®)")
    return re.sub(r"\s+", " ", text).strip()


def preprocess(body):
    def promote(m):
        text = clean_title(m.group(1))
        if text.startswith(KNOWN_BIOLOGICS) and len(text) < 80:
            return f"<h2>{html.escape(text)}</h2>"
        return m.group(0)

    body = BOLD_PARA.sub(promote, body)
    # Apremilast's heading sits *after* its table in the source; move it
    # to just after the tsDMARD chapter heading.
    m = re.search(r"<h2[^>]*>\s*Apremilast.*?</h2>", body, flags=re.S)
    ts = re.search(r"<h1[^>]*>\s*Targeted Synthetic DMARDS.*?</h1>", body, flags=re.S)
    if m and ts and m.start() > ts.end():
        heading = m.group(0)
        body = body[: m.start()] + body[m.end():]
        body = body[: ts.end()] + heading + body[ts.end():]
    # Drop the docx table of contents; the app builds its own.
    body = re.sub(r"<h1[^>]*>Contents</h1>.*?(?=<h1[^>]*>Abbreviations)", "", body, flags=re.S)
    return body


def split_sections(body):
    """Split pandoc HTML on h1/h2 into (level, title, html) parts."""
    parts = re.split(r"(<h[12][^>]*>.*?</h[12]>)", body, flags=re.S)
    sections = []
    preamble = parts[0]
    for i in range(1, len(parts), 2):
        level = int(parts[i][2])
        title = clean_title(parts[i])
        sections.append([level, title, parts[i + 1]])
    return preamble, sections


def chapter_for(title):
    for prefix, cid, ctitle, group in CHAPTERS:
        if title.startswith(prefix):
            return cid, ctitle, group
    return None


def drug_name(title):
    return re.split(r"\s*\(", title)[0].replace(" Citrate", "").strip()


def extract_fields(fragment):
    """Map first-column labels of the drug's summary table to cell HTML."""
    fields = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", fragment, flags=re.S):
        cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, flags=re.S)
        if len(cells) < 2:
            continue
        label = clean_title(cells[0]).rstrip(":").strip()
        # Long labels carry a footnote in brackets; keep the heading part.
        label = re.split(r"\s*[:(]", label)[0].strip() if len(label) >= 60 else label
        if label and len(label) < 80:
            key = slug(label)
            fields.setdefault(key, {"label": label, "html": cells[1].strip()})
    return fields


def tidy(fragment):
    fragment = fragment.replace('src="media/', 'src="content/media/')
    fragment = re.sub(r"<(table)([^>]*)>", r'<div class="table-wrap"><\1\2>', fragment)
    fragment = fragment.replace("</table>", "</table></div>")
    fragment = re.sub(r'<a\s+href="#[^"]*">(.*?)</a>', r"\1", fragment, flags=re.S)
    fragment = re.sub(r'<a\s+href="(https?:[^"]+)"', r'<a target="_blank" rel="noopener" href="\1"', fragment)
    return fragment.strip()


def main(docx):
    with tempfile.TemporaryDirectory() as tmp:
        body = subprocess.run(["pandoc", "-t", "html", "--extract-media", tmp, docx],
                              check=True, capture_output=True, text=True).stdout
        body = preprocess(body.replace(f'src="{tmp}/media/', 'src="media/'))
        media_out = os.path.join(OUT_DIR, "media")
        shutil.rmtree(media_out, ignore_errors=True)
        if os.path.isdir(os.path.join(tmp, "media")):
            shutil.copytree(os.path.join(tmp, "media"), media_out)

    preamble, raw = split_sections(body)
    title_m = re.search(r"<p>(YORKSHIRE.*?)</p>", preamble, flags=re.S)
    preamble_text = clean_title(preamble)
    edition_m = re.search(r"(\d+\w* Edition)\s*(Revised \w+ \d{4})", preamble_text)

    pages = []
    chapter = None
    for level, title, frag in raw:
        ch = chapter_for(title) if level == 1 else None
        if ch:
            chapter = {"id": ch[0], "title": ch[1], "group": ch[2], "kind": "chapter", "html": frag}
            pages.append(chapter)
            continue
        if not title or (level == 2 and title.startswith(OVERVIEW_PARTS)) or level == 1:
            # Untitled or overview fragment: append to the current page.
            target = pages[-1] if pages else chapter
            heading = f"<h2>{html.escape(title)}</h2>" if title else ""
            target["html"] += heading + frag
            continue
        name = drug_name(title)
        pages.append({
            "id": slug(name),
            "title": name,
            "subtitle": title[len(name):].strip(" ()") if title != name else "",
            "group": chapter["group"],
            "kind": "drug",
            "html": frag,
        })

    for p in pages:
        p["html"] = tidy(p["html"])
        if p["kind"] == "drug":
            p["fields"] = extract_fields(p["html"])
        p["text"] = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", p["html"]))).strip()

    doc = {
        "source": {
            "title": clean_title(title_m.group(1)) if title_m else "Yorkshire DMARD guidelines",
            "edition": edition_m.group(1) if edition_m else "",
            "revised": edition_m.group(2) if edition_m else "",
            "file": os.path.basename(docx),
        },
        "pages": pages,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "guideline.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    for p in pages:
        print(f"{p['group']:32} {p['kind']:8} {p['id']:24} {len(p['html']):6} "
              f"{','.join(list(p.get('fields', {}))[:6])}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
