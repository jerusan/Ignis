#!/usr/bin/env python3
"""
Phase 1 Step 2 — Build data/specs.json (Layer 1).

Hardcoded from the Vulcan OmniPro 220 nameplate (pp. 14/16) and
specifications table (p. 7).  All numbers are ground truth.

Run from repo root:
    python -m ingestion.build_layer1
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

SPECS = {
    "duty_cycles": [
        # MIG 120V: 40% @ 100A, 60% @ 85A, 100% @ 75A, range 30–140A
        {
            "process": "MIG", "voltage": "120V",
            "pct_40": 100, "pct_60": 85, "pct_100": 75,
            "range_min": 30, "range_max": 140,
        },
        # MIG 240V: 25% @ 200A, 60% @ 130A, 100% @ 115A, range 30–220A
        {
            "process": "MIG", "voltage": "240V",
            "pct_25": 200, "pct_60": 130, "pct_100": 115,
            "range_min": 30, "range_max": 220,
        },
        # Flux-cored shares MIG duty cycle values (same wire feed mechanism)
        {
            "process": "flux_cored", "voltage": "120V",
            "pct_40": 100, "pct_60": 85, "pct_100": 75,
            "range_min": 30, "range_max": 140,
        },
        {
            "process": "flux_cored", "voltage": "240V",
            "pct_25": 200, "pct_60": 130, "pct_100": 115,
            "range_min": 30, "range_max": 220,
        },
        # TIG 120V: 40% @ 125A, 60% @ 105A, 100% @ 90A, range 10–125A
        {
            "process": "TIG", "voltage": "120V",
            "pct_40": 125, "pct_60": 105, "pct_100": 90,
            "range_min": 10, "range_max": 125,
        },
        # TIG 240V: 30% @ 175A, 60% @ 125A, 100% @ 105A, range 10–175A
        {
            "process": "TIG", "voltage": "240V",
            "pct_30": 175, "pct_60": 125, "pct_100": 105,
            "range_min": 10, "range_max": 175,
        },
        # Stick 120V: 40% @ 80A, 60% @ 70A, 100% @ 60A, range 10–80A
        {
            "process": "Stick", "voltage": "120V",
            "pct_40": 80, "pct_60": 70, "pct_100": 60,
            "range_min": 10, "range_max": 80,
        },
        # Stick 240V: 25% @ 175A, 60% @ 115A, 100% @ 100A, range 10–175A
        {
            "process": "Stick", "voltage": "240V",
            "pct_25": 175, "pct_60": 115, "pct_100": 100,
            "range_min": 10, "range_max": 175,
        },
    ],

    "polarity": [
        {
            "process": "MIG",
            "mode": "DCEP",
            "description": "Direct Current Electrode Positive",
            "ground_socket": "negative (−)",
            "wire_socket": "positive (+)",
            "gas_required": True,
            "gas_type": "C25 (75% Argon / 25% CO2) or stainless tri-mix",
            "image_id": "dcep_polarity_p14",
        },
        {
            "process": "flux_cored",
            "mode": "DCEN",
            "description": "Direct Current Electrode Negative (gasless)",
            "ground_socket": "positive (+)",
            "wire_socket": "negative (−)",
            "gas_required": False,
            "note": "Self-shielded flux-cored — do NOT use shielding gas",
            "image_id": "dcen_polarity_p13",
        },
        {
            "process": "TIG",
            "mode": "DCEN",
            "description": "Direct Current Electrode Negative",
            "ground_socket": "positive (+)",
            "torch_socket": "negative (−)",
            "foot_pedal_socket": "interior control socket",
            "gas_required": True,
            "gas_type": "100% Argon",
            "image_id": "tig_setup_p24",
        },
        {
            "process": "Stick",
            "mode": "DCEP",
            "description": "Direct Current Electrode Positive (most electrodes)",
            "ground_socket": "negative (−)",
            "electrode_socket": "positive (+)",
            "gas_required": False,
            "note": "Some specialty electrodes use DCEN — check electrode packaging",
            "image_id": "stick_setup_p27",
        },
    ],

    "wire_settings": {
        "drive_roll_tension_solid_wire": "3–5 (scale on idler arm)",
        "drive_roll_tension_flux_cored": "2–3 (softer wire — less tension needed)",
        "solid_wire_sizes": ["0.025\"", "0.030\"", "0.035\""],
        "flux_cored_sizes": ["0.030\"", "0.035\"", "0.045\""],
        "ctwd_max_inches": 0.5,
        "ctwd_description": "Contact tip to work distance — tip of contact tip to base metal surface",
        "stickout_inches": 0.5,
        "stickout_description": "Wire extending beyond end of contact tip",
    },

    "gas_settings": {
        "MIG": {
            "flow_scfh_min": 20,
            "flow_scfh_max": 30,
            "type": "C25 (75% Argon / 25% CO2) for mild steel; stainless tri-mix for stainless",
        },
        "TIG": {
            "flow_scfh_min": 10,
            "flow_scfh_max": 25,
            "type": "100% Argon — no CO2 or mixed gas",
        },
    },

    "input_power": {
        "120V": {
            "input_current_rated": "20A",
            "breaker_minimum": "20A dedicated circuit",
            "plug_type": "NEMA 5-20P",
        },
        "240V": {
            "input_current_rated": "27A",
            "breaker_minimum": "30A",
            "plug_type": "NEMA 6-50P",
        },
    },
}


def main() -> None:
    out_path = DATA_DIR / "specs.json"
    out_path.write_text(json.dumps(SPECS, indent=2))
    print(f"Wrote {out_path}")
    total_dc = len(SPECS["duty_cycles"])
    total_pol = len(SPECS["polarity"])
    print(f"  {total_dc} duty cycle entries, {total_pol} polarity entries")


if __name__ == "__main__":
    main()
