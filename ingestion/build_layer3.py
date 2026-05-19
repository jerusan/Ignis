#!/usr/bin/env python3
"""
Phase 1 Step 4 — Build data/visual_registry.json (Layer 3).

Writes the 12 image records that agents can retrieve with get_visual().
Verifies that each referenced PNG exists in assets/ before writing.

Run from repo root (after extract.py):
    python -m ingestion.build_layer3
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets"

DATA_DIR.mkdir(exist_ok=True)

REGISTRY = {
    "images": [
        {
            "id": "dcen_polarity_p13",
            "file": "assets/page_12.png",
            "page": 12,
            "source": "owner_manual",
            "description": (
                "DCEN polarity setup diagram: ground clamp cable plugged into the POSITIVE (+) "
                "socket, wire feed power cable (MIG gun) plugged into the NEGATIVE (−) socket. "
                "Required for all flux-cored (gasless) welding. Labels clearly show which socket "
                "is positive and which is negative."
            ),
            "semantic_tags": [
                "DCEN", "flux-cored", "gasless", "polarity", "ground clamp",
                "negative socket", "positive socket", "cable setup", "self-shielded",
            ],
        },
        {
            "id": "dcep_polarity_p14",
            "file": "assets/page_13.png",
            "page": 13,
            "source": "owner_manual",
            "description": (
                "DCEP polarity setup diagram: ground clamp cable plugged into the NEGATIVE (−) "
                "socket, wire feed power cable (MIG gun) plugged into the POSITIVE (+) socket. "
                "Required for MIG welding with solid wire and shielding gas."
            ),
            "semantic_tags": [
                "DCEP", "MIG", "solid wire", "gas shielded", "polarity",
                "ground clamp", "positive socket", "negative socket", "cable setup",
            ],
        },
        {
            "id": "tig_setup_p24",
            "file": "assets/page_24.png",
            "page": 24,
            "source": "owner_manual",
            "description": (
                "TIG cable setup: ground clamp in the POSITIVE (+) socket, TIG torch in the "
                "NEGATIVE (−) socket (DCEN). Foot pedal connects to the interior control socket "
                "inside the machine's storage compartment. Shielding gas (100% Argon) connects "
                "to the gas inlet on the back of the machine."
            ),
            "semantic_tags": [
                "TIG", "GTAW", "DCEN", "torch", "foot pedal", "argon",
                "polarity", "cable setup", "socket", "interior control",
            ],
        },
        {
            "id": "stick_setup_p27",
            "file": "assets/page_26.png",
            "page": 26,
            "source": "owner_manual",
            "description": (
                "Stick (SMAW) cable setup: ground clamp in the NEGATIVE (−) socket, electrode "
                "holder (stinger) in the POSITIVE (+) socket (DCEP). No gas required. "
                "Diagram shows both cables and their correct socket positions."
            ),
            "semantic_tags": [
                "Stick", "SMAW", "DCEP", "electrode holder", "stinger",
                "polarity", "cable setup", "no gas", "ground clamp",
            ],
        },
        {
            "id": "front_panel_p8",
            "file": "assets/page_7.png",
            "page": 7,
            "source": "owner_manual",
            "description": (
                "Front panel layout of the Vulcan OmniPro 220. Components labeled: "
                "Home button (returns to main screen), Back button, Left knob (secondary "
                "parameter), Main/center knob (primary setting), Right knob (fine adjust), "
                "LCD color display, MIG gun Eurofitting socket, Negative (−) output socket, "
                "Positive (+) output socket, Spool gun gas outlet, storage compartment door "
                "(houses foot pedal socket), Power switch."
            ),
            "semantic_tags": [
                "front panel", "LCD", "display", "knob", "socket", "power switch",
                "home button", "back button", "MIG gun", "output terminal",
                "storage compartment", "controls", "layout",
            ],
        },
        {
            "id": "interior_controls_p9",
            "file": "assets/page_8.png",
            "page": 8,
            "source": "owner_manual",
            "description": (
                "Interior controls diagram (accessed by opening the side door). Components "
                "labeled: cold wire feed switch (jogs wire without striking arc), idler arm "
                "with tension knob, drive rolls, wire spool hub with brake knob, wire inlet "
                "guide, feed roller knob (selects drive roll groove size), wire feed control "
                "socket (24V trigger circuit), foot pedal socket."
            ),
            "semantic_tags": [
                "interior", "drive roll", "idler arm", "tension", "wire spool",
                "cold feed", "wire feed", "foot pedal socket", "hub", "brake",
                "liner", "inside", "mechanism",
            ],
        },
        {
            "id": "wire_weld_diagnosis_p35",
            "file": "assets/page_36.png",
            "page": 36,
            "source": "owner_manual",
            "description": (
                "Four-panel wire weld defect diagnosis chart with top-view diagrams and corrective actions. "
                "Shows common wire weld defects: porosity/contamination, incorrect voltage/wire speed, "
                "incorrect travel speed, and CTWD issues. Each panel shows the bead appearance and lists "
                "probable causes and corrections."
            ),
            "semantic_tags": [
                "weld diagnosis", "bead appearance", "wire weld", "MIG", "flux-cored",
                "voltage too low", "voltage too high", "travel speed", "CTWD", "polarity",
                "good weld", "troubleshooting", "visual guide",
            ],
        },
        {
            "id": "wire_penetration_p36",
            "file": "assets/page_35.png",
            "page": 35,
            "source": "owner_manual",
            "description": (
                "Cross-section profile diagrams showing three penetration conditions: "
                "(1) Inadequate penetration — bead sits on top of base metal, no fusion into joint; "
                "(2) Proper penetration — bead fused fully into base metal, smooth transition; "
                "(3) Excess penetration / burn-through — bead has melted through, visible hole or "
                "excessive drop-through on the back side."
            ),
            "semantic_tags": [
                "penetration", "cross section", "fusion", "burn-through",
                "inadequate penetration", "proper penetration", "profile",
                "weld quality", "diagnosis",
            ],
        },
        {
            "id": "stick_weld_diagnosis_p38",
            "file": "assets/page_37.png",
            "page": 37,
            "source": "owner_manual",
            "description": (
                "Seven-panel stick weld photo comparison with corrective actions: "
                "(1) Good weld — even ripples, consistent width, smooth tie-in; "
                "(2) Current too low — ropy, uneven, slag hard to remove, overlap; "
                "(3) Current too high — flat, wide, undercut at edges, spatter; "
                "(4) Travel speed too fast — narrow, high crowned, poor coverage; "
                "(5) Travel speed too slow — wide, flat, overlap, burned edges; "
                "(6) Arc too short — irregular, stubbing, prone to sticking; "
                "(7) Arc too long — porous, wide spatter, undercut."
            ),
            "semantic_tags": [
                "stick", "SMAW", "weld diagnosis", "bead", "current", "amperage",
                "arc length", "travel speed", "good weld", "troubleshooting", "photo",
            ],
        },
        {
            "id": "push_drag_angle_p22",
            "file": "assets/page_21.png",
            "page": 21,
            "source": "owner_manual",
            "description": (
                "MIG gun angle and CTWD diagrams: "
                "Push angle (forehand): 0–15° tilt away from direction of travel — for solid "
                "wire with shielding gas. Less penetration, wider, flatter bead. "
                "Drag angle (backhand): 0–15° tilt back toward direction of travel — for "
                "flux-cored wire without gas. More penetration, narrower bead. "
                "CTWD (contact tip to work distance): shown as ≤1/2 inch. "
                "Stringer vs weave bead comparison showing width and penetration difference."
            ),
            "semantic_tags": [
                "gun angle", "push angle", "drag angle", "forehand", "backhand",
                "CTWD", "contact tip", "work distance", "stickout", "technique",
                "stringer", "weave", "MIG", "flux-cored",
            ],
        },
        {
            "id": "qsg_cable_setups",
            "file": "assets/qsg_page_1.png",
            "page": 1,
            "source": "qsg",
            "description": (
                "Quick start guide page showing all four cable setup configurations side by side: "
                "Stick DCEP (electrode to +, ground to −), MIG DCEP (wire feed to +, ground to −), "
                "Flux-cored DCEN (wire feed to −, ground to +), TIG DCEN (torch to −, ground to +). "
                "Color-coded diagrams with clear socket labels."
            ),
            "semantic_tags": [
                "quick start", "all processes", "Stick", "MIG", "flux-cored", "TIG",
                "cable setup", "DCEP", "DCEN", "polarity", "overview", "comparison",
            ],
        },
        {
            "id": "selection_chart",
            "file": "assets/selection_chart.png",
            "page": 0,
            "source": "selection_chart",
            "description": (
                "Process selection chart: helps choose the right welding process. "
                "Flux-cored (FCAW): low skill level, works outdoors/windy, dirty or rusty metal, "
                "no gas setup needed. MIG (GMAW): moderate skill, clean indoor welds, thin to medium "
                "material, requires gas cylinder. Stick (SMAW): works outdoors, dirty or thick steel, "
                "no gas, versatile. TIG (GTAW): highest skill, precision welds, thin material, "
                "stainless/aluminum, slowest process. Material thickness ranges shown for each."
            ),
            "semantic_tags": [
                "process selection", "which process", "MIG vs Stick vs TIG vs flux-cored",
                "skill level", "outdoor", "indoor", "material thickness", "comparison",
                "flux-cored", "MIG", "Stick", "TIG", "choose",
            ],
        },
    ]
}


def main() -> None:
    missing = []
    for record in REGISTRY["images"]:
        file_path = ROOT / record["file"]
        if not file_path.exists():
            missing.append(record["file"])

    if missing:
        print(f"WARNING: {len(missing)} asset file(s) not found:")
        for f in missing:
            print(f"  missing: {f}")
        print("Run 'python -m ingestion.extract' first to generate PNGs.")
    else:
        print(f"All {len(REGISTRY['images'])} asset files verified ✓")

    out_path = DATA_DIR / "visual_registry.json"
    out_path.write_text(json.dumps(REGISTRY, indent=2))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
