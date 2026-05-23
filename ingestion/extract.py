#!/usr/bin/env python3
"""
Phase 1 Step 1 — Extract text + export PNGs + vision pass.

Run from repo root:
    python -m ingestion.extract

Outputs:
    assets/page_N.png          (owner-manual pages, 0-indexed)
    assets/qsg_page_N.png      (quick-start-guide pages, 0-indexed)
    assets/selection_chart.png
    data/raw_pages.json
"""

import json
import base64
from pathlib import Path

import fitz  # PyMuPDF
import pymupdf4llm
import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

ROOT = Path(__file__).parent.parent
ASSETS_DIR = ROOT / "assets"
DATA_DIR = ROOT / "data"

ASSETS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

PDFS = [
    (ROOT / "files" / "owner-manual.pdf", "owner_manual"),
    (ROOT / "files" / "quick-start-guide.pdf", "qsg"),
    (ROOT / "files" / "selection-chart.pdf", "selection_chart"),
]

# Pages that get the Claude vision pass (0-indexed within each PDF)
VISION_PAGES: dict[str, set[int]] = {
    "owner_manual": {8, 9, 13, 14, 22, 24, 27, 29, 35, 36, 37, 38, 45},
    "qsg": {0, 1},
    "selection_chart": {0},
}

VISION_PROMPT = """\
You are extracting technical content from a welder manual page.
Describe every diagram, table, labeled component, and connection precisely.
For polarity diagrams: state exactly which cable goes in which socket.
For duty cycle charts: extract all numbers as a structured table.
For weld diagnosis images: describe what each bead defect looks like visually and state the corrective action listed.
For front panel or interior component diagrams: list every labeled component and its location.
Be exhaustive — a technician will rely on this description."""


def asset_filename(pdf_key: str, page_idx: int) -> str:
    if pdf_key == "owner_manual":
        return f"page_{page_idx}.png"
    elif pdf_key == "qsg":
        return f"qsg_page_{page_idx}.png"
    else:
        return "selection_chart.png"


def export_png(doc: fitz.Document, page_idx: int, out_path: Path) -> None:
    page = doc[page_idx]
    mat = fitz.Matrix(2.0, 2.0)  # 200 dpi
    pix = page.get_pixmap(matrix=mat)
    pix.save(str(out_path))


def run_vision(img_path: Path, client: anthropic.Anthropic) -> str:
    img_b64 = base64.standard_b64encode(img_path.read_bytes()).decode()
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/png", "data": img_b64},
                },
                {"type": "text", "text": VISION_PROMPT},
            ],
        }],
    )
    return resp.content[0].text


def main() -> None:
    client = anthropic.Anthropic()
    all_pages: list[dict] = []

    for pdf_path, pdf_key in PDFS:
        print(f"\nProcessing {pdf_path.name} ...")
        md_pages = pymupdf4llm.to_markdown(str(pdf_path), page_chunks=True)
        doc = fitz.open(str(pdf_path))
        vision_set = VISION_PAGES.get(pdf_key, set())

        for page_data in md_pages:
            page_idx: int = page_data["metadata"]["page_number"] - 1  # 1-indexed → 0-indexed
            markdown_text: str = page_data["text"]

            png_name = asset_filename(pdf_key, page_idx)
            png_path = ASSETS_DIR / png_name
            export_png(doc, page_idx, png_path)

            visual_description: str | None = None
            if page_idx in vision_set:
                print(f"  Vision pass: {pdf_key} page {page_idx} ...")
                visual_description = run_vision(png_path, client)

            all_pages.append({
                "source": pdf_key,
                "page_idx": page_idx,
                "asset_file": png_name,
                "markdown_text": markdown_text,
                "visual_description": visual_description,
            })
            print(f"  Page {page_idx} ✓", end="\r")

        doc.close()
        print(f"\n  Done: {len(md_pages)} pages exported")

    out_path = DATA_DIR / "raw_pages.json"
    out_path.write_text(json.dumps(all_pages, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(all_pages)} total pages → {out_path}")
    print(f"Assets → {ASSETS_DIR}/")


if __name__ == "__main__":
    main()
