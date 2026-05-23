# Ignis Ingestion Accuracy Audit — Prompt for Claude Opus

## Instructions for use
Attach all three PDFs before sending this prompt:
- `files/owner-manual.pdf`
- `files/quick-start-guide.pdf`
- `files/selection-chart.pdf`

Paste the entire content below as your message. The data files to audit are embedded inline.

---

You are performing a data accuracy audit for **Ignis**, an AI assistant for the Vulcan OmniPro 220 multiprocess welder. The agent's knowledge base was manually extracted from the source PDFs and stored in structured JSON files.

Your job: **compare every piece of data in the files below against the source PDFs you have been provided, and report any inaccuracies, missing information, or entries you cannot verify.**

This audit has real consequences — these JSON files are what the agent returns as ground truth when users ask safety-relevant questions. A wrong duty cycle or polarity assignment would give a user incorrect guidance on live electrical equipment. Treat discrepancies of any size as worth reporting.

---

## Files to Audit

### FILE 1 — `data/specs.json`

This file is the agent's authoritative source for all machine specifications. It is called by the `get_machine_spec` tool.

```json
{
  "duty_cycles": [
    { "process": "MIG",        "voltage": "120V", "pct_40": 100, "pct_60": 85,  "pct_100": 75,  "range_min": 30, "range_max": 140 },
    { "process": "MIG",        "voltage": "240V", "pct_25": 200, "pct_60": 130, "pct_100": 115, "range_min": 30, "range_max": 220 },
    { "process": "flux_cored", "voltage": "120V", "pct_40": 100, "pct_60": 85,  "pct_100": 75,  "range_min": 30, "range_max": 140 },
    { "process": "flux_cored", "voltage": "240V", "pct_25": 200, "pct_60": 130, "pct_100": 115, "range_min": 30, "range_max": 220 },
    { "process": "TIG",        "voltage": "120V", "pct_40": 125, "pct_60": 105, "pct_100": 90,  "range_min": 10, "range_max": 125 },
    { "process": "TIG",        "voltage": "240V", "pct_30": 175, "pct_60": 125, "pct_100": 105, "range_min": 10, "range_max": 175 },
    { "process": "Stick",      "voltage": "120V", "pct_40": 80,  "pct_60": 70,  "pct_100": 60,  "range_min": 10, "range_max": 80  },
    { "process": "Stick",      "voltage": "240V", "pct_25": 175, "pct_60": 115, "pct_100": 100, "range_min": 10, "range_max": 175 }
  ],
  "polarity": [
    { "process": "MIG",        "mode": "DCEP", "ground_socket": "negative (−)", "wire_socket": "positive (+)",    "gas_required": true,  "gas_type": "C25 (75% Argon / 25% CO2) or stainless tri-mix" },
    { "process": "flux_cored", "mode": "DCEN", "ground_socket": "positive (+)", "wire_socket": "negative (−)",    "gas_required": false, "note": "Self-shielded — do NOT use shielding gas" },
    { "process": "TIG",        "mode": "DCEN", "ground_socket": "positive (+)", "torch_socket": "negative (−)",  "foot_pedal_socket": "interior control socket", "gas_required": true, "gas_type": "100% Argon" },
    { "process": "Stick",      "mode": "DCEP", "ground_socket": "negative (−)", "electrode_socket": "positive (+)", "gas_required": false, "note": "Some specialty electrodes use DCEN — check electrode packaging" }
  ],
  "wire_settings": {
    "drive_roll_tension_solid_wire": "3–5 (scale on idler arm)",
    "drive_roll_tension_flux_cored": "2–3 (softer wire — less tension needed)",
    "solid_wire_sizes": ["0.025\"", "0.030\"", "0.035\""],
    "flux_cored_sizes": ["0.030\"", "0.035\"", "0.045\""],
    "ctwd_max_inches": 0.5,
    "stickout_inches": 0.5
  },
  "gas_settings": {
    "MIG": { "flow_scfh_min": 20, "flow_scfh_max": 30, "type": "C25 (75% Argon / 25% CO2) for mild steel; stainless tri-mix for stainless" },
    "TIG": { "flow_scfh_min": 10, "flow_scfh_max": 25, "type": "100% Argon — no CO2 or mixed gas" }
  },
  "input_power": {
    "120V": { "input_current_rated": "20A", "breaker_minimum": "20A dedicated circuit", "plug_type": "NEMA 5-20P" },
    "240V": { "input_current_rated": "27A", "breaker_minimum": "30A",                  "plug_type": "NEMA 6-50P" }
  }
}
```

**What to verify for FILE 1:**
- Every duty cycle percentage and its corresponding amperage breakpoint (8 rows, ~3 values each — verify all 24 number pairs)
- Every duty cycle amperage range (range_min and range_max for all 8 rows)
- Polarity mode and socket assignments for all 4 processes
- Gas type and flow rate ranges for MIG and TIG
- Drive roll tension ranges for solid wire and flux-cored
- Supported wire sizes for solid and flux-cored
- CTWD max (0.5 inches)
- Input power current ratings and circuit breaker sizes for both voltages
- Plug types (NEMA 5-20P and NEMA 6-50P)

---

### FILE 2 — `data/fault_codes.json`

This file contains error codes shown on the machine LCD. Called by the `get_fault_code` tool.

```json
[
  {
    "code": "E01", "name": "Input Power Fault",
    "cause": "Input voltage too low, unstable, or outside rated range. Often caused by an undersized extension cord or a shared circuit with high-draw appliances.",
    "action": "Verify input voltage is within range (120 V: 104–132 V; 240 V: 208–264 V). Use a dedicated 20 A (120 V) or 30 A (240 V) circuit. Limit extension cords to 25 ft and use 12 AWG or heavier."
  },
  {
    "code": "E02", "name": "Output Over-Voltage",
    "cause": "Output voltage exceeded the safe limit. Can occur from open-circuit arc conditions, a worn contact tip, or an internal board fault.",
    "action": "Release the trigger and wait 2 minutes. Inspect and replace the contact tip if worn or damaged. If the error recurs, contact technical support — do not attempt internal repairs."
  },
  {
    "code": "E03", "name": "Thermal Overload",
    "cause": "Duty cycle exceeded; internal thermal protection activated to prevent component damage. Excessive ambient temperature or blocked vents can also trigger this.",
    "action": "Leave power ON so fans continue cooling. Allow 15–20 minutes cool-down. Check that vents are unobstructed. Review duty cycle limits for the selected amperage."
  },
  {
    "code": "E04", "name": "Wire Feed Motor Fault",
    "cause": "Drive motor stalled or overloaded. Possible causes: wire bird-nesting at the spool or gun inlet, excessive drive roll tension, a kinked or clogged gun liner, or a jammed contact tip.",
    "action": "Power off. Clear any wire bird-nest at the drive rolls or gun inlet. Reduce drive roll tension to 2–3 (flux-cored) or 3–5 (solid wire). Straighten or replace a kinked liner. Replace a blocked contact tip."
  },
  {
    "code": "E05", "name": "Communication Error",
    "cause": "Internal communication failure between the control board and the inverter board. Can be caused by vibration, a loose internal cable, or an inverter board fault.",
    "action": "Power cycle the machine (off for 30 s, then on). If the error reappears immediately, do not attempt board-level repair — contact Vulcan technical support for warranty service."
  },
  {
    "code": "E06", "name": "Output Short Circuit",
    "cause": "Output terminals shorted. Wire contacted the workpiece before the arc established, the trigger was held while wire was jammed, or the gun cable is internally shorted.",
    "action": "Release the trigger. Clear any wire jam at the contact tip. Set stickout to 1/4–3/8 inch before triggering. Inspect the gun cable for kinks or internal shorts; replace if damaged."
  }
]
```

**What to verify for FILE 2:**
- All 6 error codes exist (E01–E06)
- Error code names match the manual
- Cause descriptions are accurate — no invented causes
- Action steps match the manual's recommended procedure exactly
- Any specific values mentioned (voltage ranges: 104–132V, 208–264V; cool-down time: 15–20 min; stickout: 1/4–3/8 inch; extension cord: 25 ft / 12 AWG) are correct

---

### FILE 3 — `data/visual_registry.json`

This file maps image IDs to file paths and descriptions used by the `get_visual` tool. Each image was exported from the PDFs. Verify each description against the corresponding page in the PDF.

```json
[
  { "id": "dcen_polarity_p13",    "file": "assets/page_12.png",       "page": 12, "source": "owner_manual",   "description": "DCEN polarity setup diagram: ground clamp cable plugged into the POSITIVE (+) socket, wire feed power cable (MIG gun) plugged into the NEGATIVE (−) socket. Required for all flux-cored (gasless) welding." },
  { "id": "dcep_polarity_p14",    "file": "assets/page_13.png",       "page": 13, "source": "owner_manual",   "description": "DCEP polarity setup diagram: ground clamp cable plugged into the NEGATIVE (−) socket, wire feed power cable (MIG gun) plugged into the POSITIVE (+) socket. Required for MIG welding with solid wire and shielding gas." },
  { "id": "tig_setup_p24",        "file": "assets/page_24.png",       "page": 24, "source": "owner_manual",   "description": "TIG cable setup: ground clamp in the POSITIVE (+) socket, TIG torch in the NEGATIVE (−) socket (DCEN). Foot pedal connects to the interior control socket inside the machine's storage compartment. Shielding gas (100% Argon) connects to the gas inlet on the back of the machine." },
  { "id": "stick_setup_p27",      "file": "assets/page_26.png",       "page": 26, "source": "owner_manual",   "description": "Stick (SMAW) cable setup: ground clamp in the NEGATIVE (−) socket, electrode holder (stinger) in the POSITIVE (+) socket (DCEP). No gas required." },
  { "id": "front_panel_p8",       "file": "assets/page_7.png",        "page": 7,  "source": "owner_manual",   "description": "Front panel layout. Components: Home button, Back button, Left knob (secondary parameter), Main/center knob (primary setting), Right knob (fine adjust), LCD color display, MIG gun Eurofitting socket, Negative (−) output socket, Positive (+) output socket, Spool gun gas outlet, storage compartment door (houses foot pedal socket), Power switch." },
  { "id": "interior_controls_p9", "file": "assets/page_8.png",        "page": 8,  "source": "owner_manual",   "description": "Interior controls diagram. Components: cold wire feed switch, idler arm with tension knob, drive rolls, wire spool hub with brake knob, wire inlet guide, feed roller knob (selects drive roll groove size), wire feed control socket (24V trigger circuit), foot pedal socket." },
  { "id": "wire_weld_diagnosis_p35","file": "assets/page_36.png",     "page": 36, "source": "owner_manual",   "description": "Four-panel wire weld defect diagnosis chart. Shows: porosity/contamination, incorrect voltage/wire speed, incorrect travel speed, and CTWD issues. Each panel shows bead appearance and lists probable causes and corrections." },
  { "id": "wire_penetration_p36", "file": "assets/page_35.png",       "page": 35, "source": "owner_manual",   "description": "Cross-section profile diagrams showing three penetration conditions: (1) Inadequate penetration — bead sits on top; (2) Proper penetration — fully fused; (3) Excess penetration / burn-through — melted through." },
  { "id": "stick_weld_diagnosis_p38","file": "assets/page_37.png",    "page": 37, "source": "owner_manual",   "description": "Seven-panel stick weld photo comparison: (1) Good weld; (2) Current too low; (3) Current too high; (4) Travel speed too fast; (5) Travel speed too slow; (6) Arc too short; (7) Arc too long." },
  { "id": "push_drag_angle_p22",  "file": "assets/page_21.png",       "page": 21, "source": "owner_manual",   "description": "MIG gun angle and CTWD diagrams. Push angle (forehand): 0–15° tilt away from travel. Drag angle (backhand): 0–15° tilt back toward travel. CTWD shown as ≤1/2 inch. Stringer vs weave bead comparison." },
  { "id": "qsg_cable_setups",     "file": "assets/qsg_page_1.png",    "page": 1,  "source": "qsg",            "description": "Quick start guide: all four cable setup configurations side by side — Stick DCEP, MIG DCEP, Flux-cored DCEN, TIG DCEN." },
  { "id": "selection_chart",      "file": "assets/selection_chart.png","page": 0,  "source": "selection_chart","description": "Process selection chart: helps choose welding process based on material, conditions, and skill level. Shows Flux-cored, MIG, Stick, TIG with application guidance and thickness ranges." }
]
```

**What to verify for FILE 3:**
- Page number in `page` field matches where that content actually appears in the PDF (note: page numbering may be off-by-one due to 0-indexed export)
- Description of each image accurately describes what's visible in the diagram/photo
- Polarity socket assignments in the descriptions match the actual diagrams (this is safety-critical)
- Component names and labels in descriptions match the manual's terminology
- The number of panels in diagnosis charts (4-panel wire chart, 7-panel stick chart) is correct
- The angle ranges quoted (0–15° for push/drag) are correct

---

### FILE 4 — `data/baseline_grid.json` (36 entries)

This file powers the `get_synergic_settings` tool. Verify the voltage and wire feed speed values against the manual's synergic parameter table.

```json
[
  {"process":"mig","material":"mild_steel","thickness_label":"24 ga","wire":"0.023","voltage_v":14.5,"wfs_ipm":70,"amp_lo":25,"amp_hi":35,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"24 ga","wire":"0.025","voltage_v":15.0,"wfs_ipm":75,"amp_lo":25,"amp_hi":35,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"22 ga","wire":"0.023","voltage_v":15.0,"wfs_ipm":90,"amp_lo":35,"amp_hi":45,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"22 ga","wire":"0.025","voltage_v":15.5,"wfs_ipm":95,"amp_lo":35,"amp_hi":45,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"20 ga","wire":"0.025","voltage_v":16.0,"wfs_ipm":115,"amp_lo":45,"amp_hi":55,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"20 ga","wire":"0.030","voltage_v":15.5,"wfs_ipm":90,"amp_lo":45,"amp_hi":55,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"18 ga","wire":"0.025","voltage_v":17.0,"wfs_ipm":140,"amp_lo":60,"amp_hi":75,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"18 ga","wire":"0.030","voltage_v":16.5,"wfs_ipm":110,"amp_lo":60,"amp_hi":75,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"16 ga","wire":"0.030","voltage_v":17.5,"wfs_ipm":145,"amp_lo":80,"amp_hi":95,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"16 ga","wire":"0.035","voltage_v":17.0,"wfs_ipm":110,"amp_lo":80,"amp_hi":95,"ctwd_in":0.5,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"14 ga","wire":"0.030","voltage_v":18.5,"wfs_ipm":175,"amp_lo":100,"amp_hi":115,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"14 ga","wire":"0.035","voltage_v":18.0,"wfs_ipm":140,"amp_lo":100,"amp_hi":115,"ctwd_in":0.5,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"3/16\"","wire":"0.030","voltage_v":20.0,"wfs_ipm":225,"amp_lo":130,"amp_hi":150,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"3/16\"","wire":"0.035","voltage_v":19.5,"wfs_ipm":175,"amp_lo":130,"amp_hi":150,"ctwd_in":0.5,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"1/4\"","wire":"0.035","voltage_v":21.5,"wfs_ipm":220,"amp_lo":155,"amp_hi":175,"ctwd_in":0.5,"gas":"C25 @ 20–25 SCFH","note":"240 V recommended"},
  {"process":"mig","material":"mild_steel","thickness_label":"1/8\"","wire":"0.025","voltage_v":17.5,"wfs_ipm":160,"amp_lo":85,"amp_hi":100,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"1/8\"","wire":"0.030","voltage_v":18.5,"wfs_ipm":200,"amp_lo":95,"amp_hi":115,"ctwd_in":0.375,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"mild_steel","thickness_label":"1/8\"","wire":"0.035","voltage_v":18.0,"wfs_ipm":155,"amp_lo":95,"amp_hi":115,"ctwd_in":0.5,"gas":"C25 @ 20–25 SCFH"},
  {"process":"mig","material":"stainless","thickness_label":"20 ga","wire":"0.025","voltage_v":15.5,"wfs_ipm":105,"amp_lo":45,"amp_hi":55,"ctwd_in":0.375,"gas":"Tri-mix @ 20–25 SCFH","note":"ER308L or ER316L wire"},
  {"process":"mig","material":"stainless","thickness_label":"18 ga","wire":"0.030","voltage_v":16.5,"wfs_ipm":100,"amp_lo":55,"amp_hi":70,"ctwd_in":0.375,"gas":"Tri-mix @ 20–25 SCFH","note":"ER308L or ER316L wire"},
  {"process":"mig","material":"stainless","thickness_label":"16 ga","wire":"0.030","voltage_v":17.5,"wfs_ipm":130,"amp_lo":75,"amp_hi":90,"ctwd_in":0.375,"gas":"Tri-mix @ 20–25 SCFH"},
  {"process":"mig","material":"stainless","thickness_label":"14 ga","wire":"0.030","voltage_v":18.5,"wfs_ipm":155,"amp_lo":95,"amp_hi":115,"ctwd_in":0.375,"gas":"Tri-mix @ 20–25 SCFH"},
  {"process":"mig","material":"stainless","thickness_label":"1/8\"","wire":"0.035","voltage_v":19.5,"wfs_ipm":160,"amp_lo":115,"amp_hi":135,"ctwd_in":0.5,"gas":"Tri-mix @ 20–25 SCFH"},
  {"process":"mig","material":"stainless","thickness_label":"3/16\"","wire":"0.035","voltage_v":20.5,"wfs_ipm":190,"amp_lo":135,"amp_hi":155,"ctwd_in":0.5,"gas":"Tri-mix @ 20–25 SCFH"},
  {"process":"mig","material":"aluminum","thickness_label":"1/8\"","wire":"0.030","voltage_v":18.0,"wfs_ipm":285,"amp_lo":95,"amp_hi":115,"ctwd_in":0.5,"gas":"100% Argon @ 20–30 SCFH","note":"Spool gun required · ER4043 wire"},
  {"process":"mig","material":"aluminum","thickness_label":"3/16\"","wire":"0.030","voltage_v":19.5,"wfs_ipm":355,"amp_lo":120,"amp_hi":140,"ctwd_in":0.5,"gas":"100% Argon @ 20–30 SCFH","note":"Spool gun required · ER4043 wire"},
  {"process":"mig","material":"aluminum","thickness_label":"1/4\"","wire":"0.030","voltage_v":21.0,"wfs_ipm":430,"amp_lo":145,"amp_hi":165,"ctwd_in":0.5,"gas":"100% Argon @ 20–30 SCFH","note":"Spool gun required · 240 V"},
  {"process":"mig","material":"aluminum","thickness_label":"3/8\"","wire":"0.030","voltage_v":22.5,"wfs_ipm":530,"amp_lo":175,"amp_hi":200,"ctwd_in":0.5,"gas":"100% Argon @ 20–30 SCFH","note":"Spool gun required · 240 V only"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"20 ga","wire":"0.030","voltage_v":15.0,"wfs_ipm":100,"amp_lo":40,"amp_hi":55,"ctwd_in":0.5,"gas":"none (self-shielded)"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"18 ga","wire":"0.030","voltage_v":15.5,"wfs_ipm":115,"amp_lo":55,"amp_hi":70,"ctwd_in":0.5,"gas":"none (self-shielded)"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"16 ga","wire":"0.030","voltage_v":16.5,"wfs_ipm":145,"amp_lo":75,"amp_hi":90,"ctwd_in":0.5,"gas":"none (self-shielded)"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"14 ga","wire":"0.030","voltage_v":17.0,"wfs_ipm":160,"amp_lo":90,"amp_hi":110,"ctwd_in":0.5,"gas":"none (self-shielded)"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"1/8\"","wire":"0.035","voltage_v":17.5,"wfs_ipm":175,"amp_lo":95,"amp_hi":115,"ctwd_in":0.5,"gas":"none (self-shielded)"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"3/16\"","wire":"0.035","voltage_v":18.5,"wfs_ipm":210,"amp_lo":120,"amp_hi":145,"ctwd_in":0.5,"gas":"none (self-shielded)"},
  {"process":"flux_cored","material":"mild_steel","thickness_label":"1/4\"","wire":"0.045","voltage_v":19.5,"wfs_ipm":175,"amp_lo":145,"amp_hi":165,"ctwd_in":0.5,"gas":"none (self-shielded)","note":"240 V recommended"},
  {"process":"flux_cored","material":"aluminum","thickness_label":"1/8\"","wire":"0.030","voltage_v":17.0,"wfs_ipm":220,"amp_lo":85,"amp_hi":105,"ctwd_in":0.5,"gas":"none (self-shielded)","note":"Use E71T-GS aluminum-compatible wire"}
]
```

**What to verify for FILE 4:**
- Does the manual contain a synergic parameter table? If so, verify every voltage and WFS value against it row by row
- Are the thickness labels correct (gauge numbers, fractional inches)?
- Are the wire sizes listed for each row supported by the machine for that material?
- Are the CTWD values consistent with specs.json?
- Specifically flag any rows where voltage or WFS look out of sequence with adjacent thicknesses (a monotonically increasing pattern is expected — any inversion is suspicious)
- Verify the flux-cored aluminum entry (`flux_cored · aluminum · 1/8"`) — is there actually a flux-cored aluminum wire mode supported by this machine? This is unusual and should be confirmed

---

### FILE 5 — `data/diagnostic_graph.json` (quick_tips excerpts)

This file powers the `diagnose_defect` tool. The full file is 558 lines; the key content to verify is the `quick_tips` text shown to users at the start of each diagnostic session, plus representative terminal fix texts. Verify these against the troubleshooting sections of the owner manual.

**quick_tips values to verify:**

```
porosity_wire:
  "FLUX-CORED: (1) Wrong polarity — must be DCEN (ground to + socket, wire feed to - socket);
   (2) Shielding gas attached — flux-cored is self-shielded, remove gas; (3) Dirty base metal;
   (4) CTWD too long (max 1/2 inch), use 5-15 degree drag angle.
   MIG SOLID WIRE: (1) Gas not flowing — set 20-30 SCFH; (2) Wrong polarity — must be DCEP
   (ground to -, wire to +); (3) Nozzle clogged with spatter; (4) Drafts blowing away gas."

porosity_stick:
  "(1) Damp/old electrodes — dry in oven at 250-300 F for 1-2 hours; (2) Arc too long —
   keep arc length equal to electrode core diameter; (3) Wrong polarity — most stick electrodes
   need DCEP (electrode to +, ground to -); (4) Heavy surface contamination."

machine_wont_start:
  "Circuit requirements: 240V welding needs a dedicated 30A circuit; 120V needs a dedicated 20A
   circuit. Voltage selector on power cord must match outlet. Thermal overload wait: 15-20 min."

burn_through:
  "(1) Increase travel speed; (2) Reduce wire speed 15-20% and drop voltage one step;
   (3) Use thinnest wire — 0.023 inch for very thin material; (4) Tack weld every 2-3 inches."
```

**What to verify for FILE 5:**
- The DCEN/DCEP socket assignments in porosity_wire match the manual
- The electrode drying temperature (250–300°F) and time (1–2 hours) for porosity_stick are correct
- The 30A / 20A circuit requirements match the manual
- The burn_through wire size recommendation (0.023 inch) is mentioned in the manual
- The tack weld spacing (2–3 inches) is mentioned or consistent with the manual

---

## Output Format

Return a single JSON object structured exactly as follows. Be thorough — report everything you can verify or cannot verify.

```json
{
  "audit_summary": {
    "files_audited": 5,
    "total_checks_performed": 0,
    "discrepancies_found": 0,
    "critical_issues": 0,
    "minor_issues": 0,
    "unable_to_verify_count": 0
  },
  "discrepancies": [
    {
      "file": "specs.json",
      "field_path": "duty_cycles[1].pct_25",
      "current_value": "200",
      "correct_value": "195",
      "severity": "critical",
      "manual_source": "owner-manual.pdf",
      "manual_page": 16,
      "explanation": "The manual's duty cycle table shows 195A at 25% for MIG on 240V, not 200A."
    }
  ],
  "verified_correct": [
    {
      "file": "specs.json",
      "section": "polarity — MIG DCEP socket assignments",
      "confidence": "high",
      "manual_page": 13,
      "note": "Page 13 diagram clearly shows ground to (−) and wire to (+) for MIG DCEP."
    }
  ],
  "unable_to_verify": [
    {
      "file": "baseline_grid.json",
      "entry": "flux_cored · aluminum · 1/8\"",
      "reason": "Could not find a flux-cored aluminum wire welding section in the owner manual. This process combination may not be supported by this machine.",
      "recommendation": "Remove this entry or add a note that this is not covered in the Vulcan OmniPro 220 manual."
    }
  ],
  "additional_observations": [
    "The visual_registry.json uses 0-indexed page numbers (page_12.png for manual page 13). This is internally consistent but should be documented."
  ]
}
```

### Severity definitions

- **`critical`**: A specific number, socket assignment, or polarity is wrong. This would give a user incorrect guidance — wrong duty cycle, wrong cable position, wrong circuit breaker size.
- **`minor`**: A description is incomplete, uses imprecise language, or is missing context — but the core facts are not wrong.
- **`unable_to_verify`**: You searched the PDFs but could not find the relevant section to confirm or deny the stored value.

### Confidence definitions (for `verified_correct`)

- **`high`**: You can see the exact value in the PDF and it matches. You are certain.
- **`medium`**: The PDF supports the value but the source is ambiguous or the exact number isn't explicitly stated.

---

## Audit Priorities

If you can only do a partial audit, prioritize in this order:

1. **Duty cycle numbers** — wrong values here are the most dangerous (user might overheat the machine)
2. **Polarity socket assignments** — wrong polarity causes poor welds and machine damage
3. **Input power / circuit requirements** — wrong breaker size is an electrical safety issue
4. **Fault code actions** — user follows these instructions during a live machine fault
5. **Baseline grid voltage and WFS values** — wrong settings produce bad welds but are less dangerous
6. **Image descriptions and page numbers** — important for correctness but not safety-critical

Output the JSON object only. No preamble, no explanation outside the JSON structure.
