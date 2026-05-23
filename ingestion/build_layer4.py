#!/usr/bin/env python3
"""
Phase 1 Step 5 — Build data/chunks/*.md (Layer 4).

Reads data/raw_pages.json, slices relevant pages per topic, sends to Claude
for clean extraction, writes structured markdown chunks.

These chunks are loaded in full into the agent system prompt (~35k tokens).
No retrieval — the agent has the complete manual text at all times.

Run from repo root (after extract.py):
    python -m ingestion.build_layer4
"""

import json
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
CHUNKS_DIR = DATA_DIR / "chunks"
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

# Page ranges are 0-indexed within the owner-manual source.
# Manual printed pages n → Python index n-1.
TOPICS: list[dict] = [
    {
        "filename": "safety_warnings.md",
        "title": "Safety Warnings and Requirements",
        "source": "owner_manual",
        "page_range": (2, 5),   # printed pp. 3–6
    },
    {
        "filename": "wire_spool_install.md",
        "title": "Wire Spool Installation",
        "source": "owner_manual",
        "page_range": (16, 18),  # printed pp. 17–19
    },
    {
        "filename": "wire_feed_setup.md",
        "title": "Wire Feed Setup and Drive Roll Adjustment",
        "source": "owner_manual",
        "page_range": (19, 20),  # printed pp. 20–21
    },
    {
        "filename": "mig_welding_technique.md",
        "title": "MIG Welding Setup and Technique",
        "source": "owner_manual",
        "page_range": (21, 25),  # printed pp. 22–26
    },
    {
        "filename": "tig_torch_assembly.md",
        "title": "TIG Torch Assembly and Setup",
        "source": "owner_manual",
        "page_range": (22, 24),  # printed pp. 23–25
    },
    {
        "filename": "tungsten_grinding.md",
        "title": "Tungsten Electrode Preparation and Grinding",
        "source": "owner_manual",
        "page_range": (24, 25),  # printed pp. 25–26
    },
    {
        "filename": "stick_welding_technique.md",
        "title": "Stick Welding Setup and Technique",
        "source": "owner_manual",
        "page_range": (26, 27),  # printed pp. 27–28
    },
    {
        "filename": "optional_settings.md",
        "title": "Optional Settings and Advanced Controls",
        "source": "owner_manual",
        "page_range": (29, 31),  # printed pp. 30–32
    },
    {
        "filename": "maintenance.md",
        "title": "Maintenance and Care",
        "source": "owner_manual",
        "page_range": (32, 33),  # printed pp. 33–34
    },
]

EXTRACT_PROMPT = """\
You are extracting and organizing technical content from a welder manual for the Vulcan OmniPro 220.

Topic: {title}

Your task: Extract ALL information about this topic from the manual pages below. Write clean, structured markdown that a technician can reference mid-job.

Requirements:
- Use clear section headers (## and ###)
- Number every procedural step
- Preserve all tables exactly — don't summarize them
- Put all safety warnings in a > blockquote or **bold**
- Keep every specific value exactly as written (dimensions, settings, torque specs, temperatures)
- Do not add information not present in the source pages
- Do not omit any steps or values — completeness is critical

Manual pages:
---
{pages_text}
---

Write the complete, structured markdown for "{title}" now."""


def build_pages_text(raw_pages: list[dict], source: str, page_range: tuple[int, int]) -> str:
    start, end = page_range
    sections: list[str] = []
    for page in raw_pages:
        if page["source"] != source:
            continue
        idx = page["page_idx"]
        if start <= idx <= end:
            header = f"=== Page {idx + 1} (index {idx}) ==="
            text = page["markdown_text"] or ""
            if page.get("visual_description"):
                text += f"\n\n[VISUAL CONTENT]: {page['visual_description']}"
            sections.append(f"{header}\n{text}")
    return "\n\n".join(sections)


def extract_chunk(title: str, pages_text: str, client: anthropic.Anthropic) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": EXTRACT_PROMPT.format(title=title, pages_text=pages_text),
        }],
    )
    return resp.content[0].text


def main() -> None:
    raw_path = DATA_DIR / "raw_pages.json"
    if not raw_path.exists():
        print("ERROR: data/raw_pages.json not found.")
        print("Run 'python -m ingestion.extract' first.")
        return

    raw_pages: list[dict] = json.loads(raw_path.read_text())
    client = anthropic.Anthropic()

    for topic in TOPICS:
        out_path = CHUNKS_DIR / topic["filename"]
        if out_path.exists():
            print(f"  Skipping {topic['filename']} (already exists)")
            continue

        print(f"  Extracting: {topic['title']} ...")
        pages_text = build_pages_text(raw_pages, topic["source"], topic["page_range"])

        if not pages_text.strip():
            print(f"    WARNING: no pages found for range {topic['page_range']}")
            continue

        chunk_md = extract_chunk(topic["title"], pages_text, client)
        out_path.write_text(chunk_md)
        print(f"    Wrote {out_path} ({len(chunk_md)} chars)")

    written = list(CHUNKS_DIR.glob("*.md"))
    print(f"\nChunks directory: {CHUNKS_DIR}")
    print(f"Total chunks: {len(written)}")


if __name__ == "__main__":
    main()
