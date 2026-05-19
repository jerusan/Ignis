#!/usr/bin/env python3
"""
Phase 1 Step 3 — Build data/diagnostic_graph.json (Layer 2).

Nine binary decision trees for troubleshooting weld defects and machine problems.
Each terminal node has a fix and optionally an image_trigger (Layer 3 image ID).

Run from repo root:
    python -m ingestion.build_layer2
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

GRAPH = {
    "trees": {

        # ── 1. POROSITY IN WIRE WELDING (MIG or flux-cored) ──────────────────
        "porosity_wire": {
            "root": "pw_1",
            "label": "Porosity in wire weld (MIG or flux-cored)",
            "nodes": {
                "pw_1": {
                    "question": "Are you welding flux-cored (gasless, no shielding gas cylinder)?",
                    "yes_next": "pw_dcen_check",
                    "no_next": "pw_gas_on",
                },
                # ── Flux-cored branch ──
                "pw_dcen_check": {
                    "question": "Is polarity set to DCEN — ground clamp in the (+) socket, wire feed power in the (−) socket?",
                    "yes_next": "pw_fc_clean",
                    "no_next": "pw_dcen_fix",
                    "image_trigger": "dcen_polarity_p13",
                },
                "pw_dcen_fix": {
                    "type": "terminal",
                    "fix": "Swap your cables. Ground clamp goes in the POSITIVE (+) socket. Wire feed power cable goes in the NEGATIVE (−) socket. This is DCEN — required for all flux-cored welding. Wrong polarity is the #1 cause of porosity with flux-cored.",
                    "image_trigger": "dcen_polarity_p13",
                },
                "pw_fc_clean": {
                    "question": "Is the base metal clean — free of rust, paint, oil, mill scale, or galvanizing?",
                    "yes_next": "pw_fc_gas_leak",
                    "no_next": "pw_fc_clean_fix",
                },
                "pw_fc_clean_fix": {
                    "type": "terminal",
                    "fix": "Clean the base metal with a wire brush, angle grinder, or acetone wipe. Rust, paint, oil, and zinc (galvanized) all cause porosity. Flux-cored tolerates contamination better than MIG but not heavy buildup.",
                },
                "pw_fc_gas_leak": {
                    "question": "Is a shielding gas cylinder connected — even empty or partially open?",
                    "yes_next": "pw_fc_gas_off",
                    "no_next": "pw_fc_technique",
                },
                "pw_fc_gas_off": {
                    "type": "terminal",
                    "fix": "Disconnect the gas regulator. Flux-cored (FCAW-S) is self-shielded — it does NOT use external shielding gas. Mixing flux-cored wire with gas will cause porosity and disrupts the shielding chemistry.",
                },
                "pw_fc_technique": {
                    "type": "terminal",
                    "fix": "Check technique: CTWD should be 3/8 to 1/2 inch. Use a 5–15° drag angle (drag the gun away from the weld). Travel speed should be steady. Drafts and wind will blow away the self-generated shielding — use a welding screen outdoors.",
                    "image_trigger": "push_drag_angle_p22",
                },
                # ── MIG (solid wire + gas) branch ──
                "pw_gas_on": {
                    "question": "Is the shielding gas cylinder open and the regulator showing 20–30 SCFH of flow?",
                    "yes_next": "pw_nozzle",
                    "no_next": "pw_gas_fix",
                },
                "pw_gas_fix": {
                    "type": "terminal",
                    "fix": "Open the cylinder valve fully (counterclockwise). Set the regulator flow to 20–30 SCFH. Check for kinks in the gas hose. Weld a short test bead and listen — no hissing means no gas flow.",
                },
                "pw_nozzle": {
                    "question": "Is the MIG nozzle clear — no heavy spatter buildup inside?",
                    "yes_next": "pw_dcep_check",
                    "no_next": "pw_nozzle_fix",
                },
                "pw_nozzle_fix": {
                    "type": "terminal",
                    "fix": "Remove the nozzle and clear spatter with nozzle pliers or a reamer. Apply anti-spatter compound to the inside. Blocked nozzle creates turbulence that lets air contaminate the shielding gas envelope.",
                },
                "pw_dcep_check": {
                    "question": "Is polarity DCEP — ground clamp in the (−) socket, wire feed power in the (+) socket?",
                    "yes_next": "pw_mig_clean",
                    "no_next": "pw_dcep_fix",
                    "image_trigger": "dcep_polarity_p14",
                },
                "pw_dcep_fix": {
                    "type": "terminal",
                    "fix": "Set polarity to DCEP: ground clamp in the NEGATIVE (−) socket, wire feed power in the POSITIVE (+) socket. DCEP is required for MIG with solid wire and shielding gas.",
                    "image_trigger": "dcep_polarity_p14",
                },
                "pw_mig_clean": {
                    "question": "Is the base metal clean — no rust, oil, grease, paint, or galvanizing?",
                    "yes_next": "pw_wind",
                    "no_next": "pw_mig_clean_fix",
                },
                "pw_mig_clean_fix": {
                    "type": "terminal",
                    "fix": "Clean the weld area. MIG with solid wire requires clean base metal. Use an angle grinder to remove rust, acetone for oil/grease, and avoid welding galvanized steel without proper ventilation.",
                },
                "pw_wind": {
                    "type": "terminal",
                    "fix": "Check for drafts — even a light breeze will blow away shielding gas and cause porosity. Use a welding screen. If welding outdoors, increase gas flow to 30 SCFH or more.",
                },
            },
        },

        # ── 2. POROSITY IN STICK WELDING ──────────────────────────────────────
        "porosity_stick": {
            "root": "ps_1",
            "label": "Porosity in stick weld",
            "nodes": {
                "ps_1": {
                    "question": "Are the electrodes from an opened package that has been sitting around (more than a few weeks exposed to air)?",
                    "yes_next": "ps_damp",
                    "no_next": "ps_arc",
                },
                "ps_damp": {
                    "type": "terminal",
                    "fix": "Electrodes have absorbed moisture. Discard them or dry low-hydrogen electrodes in an oven at 250–300°F for 1–2 hours. Store electrodes in a sealed container or rod oven. Damp electrodes cause porosity, hydrogen cracking, and rough arc behavior.",
                },
                "ps_arc": {
                    "question": "Is the arc length approximately equal to the electrode core diameter (roughly 1/8 inch for a 1/8\" rod)?",
                    "yes_next": "ps_polarity",
                    "no_next": "ps_arc_fix",
                },
                "ps_arc_fix": {
                    "type": "terminal",
                    "fix": "Shorten the arc. Too long an arc lets atmospheric oxygen and nitrogen contaminate the weld pool before the flux shield forms. Arc length = core diameter of the electrode. Practice maintaining a tight, consistent arc.",
                },
                "ps_polarity": {
                    "question": "Is polarity DCEP — electrode holder in the (+) socket, ground clamp in the (−) socket?",
                    "yes_next": "ps_clean",
                    "no_next": "ps_polarity_fix",
                    "image_trigger": "stick_setup_p27",
                },
                "ps_polarity_fix": {
                    "type": "terminal",
                    "fix": "Set DCEP: electrode holder in the POSITIVE (+) socket, ground clamp in the NEGATIVE (−) socket. Most stick electrodes require DCEP. Check the electrode packaging for polarity requirements.",
                    "image_trigger": "stick_setup_p27",
                },
                "ps_clean": {
                    "question": "Is the base metal free of rust, paint, oil, or galvanizing at the weld zone?",
                    "yes_next": "ps_technique",
                    "no_next": "ps_clean_fix",
                },
                "ps_clean_fix": {
                    "type": "terminal",
                    "fix": "Clean the base metal with a wire brush or angle grinder. Stick tolerates surface contamination better than MIG, but heavy rust, oil, or galvanized coating will still cause porosity.",
                },
                "ps_technique": {
                    "type": "terminal",
                    "fix": "Use a 5–10° drag angle and steady travel speed. Avoid stopping and restarting in the same spot. Re-striking on a cold crater can trap slag and cause porosity. Chip and wire-brush slag between passes.",
                    "image_trigger": "stick_weld_diagnosis_p38",
                },
            },
        },

        # ── 3. BIRD'S NEST (wire tangle at drive rolls) ───────────────────────
        "birds_nest": {
            "root": "bn_1",
            "label": "Bird's nest — wire tangling at drive rolls or in gun",
            "nodes": {
                "bn_1": {
                    "question": "Is the tangle occurring at the drive rolls (inside the machine), not inside the gun?",
                    "yes_next": "bn_tension",
                    "no_next": "bn_gun",
                },
                "bn_tension": {
                    "question": "Is drive roll tension set higher than 3–5 for solid wire or 2–3 for flux-cored?",
                    "yes_next": "bn_tension_fix",
                    "no_next": "bn_liner",
                    "image_trigger": "interior_controls_p9",
                },
                "bn_tension_fix": {
                    "type": "terminal",
                    "fix": "Reduce drive roll tension. Set to 3–5 for solid wire or 2–3 for flux-cored. Excess tension crushes soft wire and makes it buckle behind the rolls. Test: you should be able to stop the wire with two fingers while it's feeding — if not, reduce tension.",
                    "image_trigger": "interior_controls_p9",
                },
                "bn_liner": {
                    "question": "Does the wire feel stiff or jam when you manually push it through the gun liner?",
                    "yes_next": "bn_liner_fix",
                    "no_next": "bn_roll_size",
                },
                "bn_liner_fix": {
                    "type": "terminal",
                    "fix": "Replace or clear the gun liner. A kinked, worn, or debris-filled liner creates back-pressure that causes wire to buckle at the drive rolls. Blow out the liner with compressed air or replace it — liners are wear items.",
                },
                "bn_roll_size": {
                    "type": "terminal",
                    "fix": "Check that the drive roll groove size matches the wire diameter. A 0.030\" groove with 0.035\" wire will pinch and jam. Also check that the idler arm is locked down firmly over the drive roll.",
                    "image_trigger": "interior_controls_p9",
                },
                "bn_gun": {
                    "question": "Is the wire looping or tangling inside the gun cable, causing a blockage partway down the gun?",
                    "yes_next": "bn_gun_liner",
                    "no_next": "bn_spool",
                },
                "bn_gun_liner": {
                    "type": "terminal",
                    "fix": "Replace the gun liner. A kinked or worn liner inside the gun cable is the most common cause of tangling inside the gun. Trim the new liner to the correct length so it seats flush into the contact tip body — a liner that's too short leaves a gap where wire can catch.",
                },
                "bn_spool": {
                    "type": "terminal",
                    "fix": "Check spool brake tension. If the spool spins freely when you stop feeding, it will unravel and create a tangle. Tighten the spool knob (hub tension) until the spool stops promptly when the wire feed stops.",
                    "image_trigger": "interior_controls_p9",
                },
            },
        },

        # ── 4. WIRE FEEDS BUT WON'T STOP / WIRE WON'T FEED ──────────────────
        "wire_wont_feed": {
            "root": "wf_1",
            "label": "Wire won't feed — motor spins but wire doesn't move, or no motor at all",
            "nodes": {
                "wf_1": {
                    "question": "Does the drive motor spin when you pull the gun trigger?",
                    "yes_next": "wf_slip",
                    "no_next": "wf_no_power",
                },
                "wf_slip": {
                    "question": "Is the drive roll spinning but the wire slipping — not gripping the wire?",
                    "yes_next": "wf_tension",
                    "no_next": "wf_liner",
                },
                "wf_tension": {
                    "question": "Is the idler arm locked down and drive roll tension set above 2?",
                    "yes_next": "wf_roll_size",
                    "no_next": "wf_tension_fix",
                    "image_trigger": "interior_controls_p9",
                },
                "wf_tension_fix": {
                    "type": "terminal",
                    "fix": "Lock the idler arm down firmly and increase drive roll tension. Start at 3 for solid wire or 2 for flux-cored. If the roll is spinning without gripping the wire, the idler arm may not be fully seated.",
                    "image_trigger": "interior_controls_p9",
                },
                "wf_roll_size": {
                    "type": "terminal",
                    "fix": "Check that the drive roll groove matches the wire diameter. A 0.023\" groove won't grip 0.035\" wire properly. If the groove is worn smooth, replace the drive roll.",
                    "image_trigger": "interior_controls_p9",
                },
                "wf_liner": {
                    "question": "Is there resistance feeding the wire by hand through the gun — does it catch or drag?",
                    "yes_next": "wf_liner_fix",
                    "no_next": "wf_tip",
                },
                "wf_liner_fix": {
                    "type": "terminal",
                    "fix": "Clear or replace the gun liner. A clogged, kinked, or corroded liner is the most common cause of wire feed resistance. Check for spatter buildup at the contact tip end of the liner.",
                },
                "wf_tip": {
                    "type": "terminal",
                    "fix": "Replace the contact tip. A worn tip with an oversized bore won't guide wire properly and causes erratic feeding. Tip ID should match wire diameter (e.g., 0.030\" tip for 0.030\" wire).",
                },
                "wf_no_power": {
                    "question": "Is the MIG gun cable plugged into the correct socket on the front panel?",
                    "yes_next": "wf_trigger",
                    "no_next": "wf_cable_fix",
                    "image_trigger": "front_panel_p8",
                },
                "wf_cable_fix": {
                    "type": "terminal",
                    "fix": "Plug the MIG gun Eurofitting into the MIG gun socket on the front panel of the machine.",
                    "image_trigger": "front_panel_p8",
                },
                "wf_trigger": {
                    "question": "Does pressing the trigger firmly produce any sound — relay click or motor hum?",
                    "yes_next": "wf_motor_check",
                    "no_next": "wf_trigger_fix",
                },
                "wf_trigger_fix": {
                    "type": "terminal",
                    "fix": "The gun trigger switch may be faulty. Test by shorting the trigger pins on the connector with a wire — if the motor runs, replace the trigger assembly.",
                },
                "wf_motor_check": {
                    "type": "terminal",
                    "fix": "Drive motor is receiving a trigger signal but not running. Check for debris in the drive mechanism. Inspect the gear and motor shaft for damage. The motor may need replacement — contact Harbor Freight service.",
                    "image_trigger": "interior_controls_p9",
                },
            },
        },

        # ── 5. ARC WON'T IGNITE ───────────────────────────────────────────────
        "arc_wont_ignite": {
            "root": "ai_1",
            "label": "Wire feeds and touches workpiece but arc won't start",
            "nodes": {
                "ai_1": {
                    "question": "Is the work clamp making direct metal-to-metal contact with the workpiece (not on paint, rust, or the table clamp)?",
                    "yes_next": "ai_polarity",
                    "no_next": "ai_ground_fix",
                },
                "ai_ground_fix": {
                    "type": "terminal",
                    "fix": "Move the work clamp to bare metal on the actual workpiece. Attach as close to the weld zone as practical. A poor ground is the number one cause of arc start failure — and arc instability once started.",
                },
                "ai_polarity": {
                    "question": "Is polarity correct for your process — DCEP for MIG/Stick, DCEN for flux-cored/TIG?",
                    "yes_next": "ai_ctwd",
                    "no_next": "ai_polarity_fix",
                },
                "ai_polarity_fix": {
                    "type": "terminal",
                    "fix": "Check polarity: MIG and Stick use DCEP (ground to −, wire/electrode to +). Flux-cored and TIG use DCEN (ground to +, wire/torch to −). Reversed polarity causes poor arc start and unstable arc.",
                },
                "ai_ctwd": {
                    "question": "Is wire sticking out more than 3/4 inch beyond the contact tip?",
                    "yes_next": "ai_ctwd_fix",
                    "no_next": "ai_contact",
                    "image_trigger": "push_drag_angle_p22",
                },
                "ai_ctwd_fix": {
                    "type": "terminal",
                    "fix": "Trim wire stickout to 1/4–1/2 inch. Excessive CTWD (contact tip to work distance) lowers current density and makes the arc hard to start. Clip the wire with side-cutters before striking.",
                    "image_trigger": "push_drag_angle_p22",
                },
                "ai_contact": {
                    "question": "Is the contact tip worn — visibly widened bore or pitted?",
                    "yes_next": "ai_tip_fix",
                    "no_next": "ai_settings",
                },
                "ai_tip_fix": {
                    "type": "terminal",
                    "fix": "Replace the contact tip. A worn tip causes poor electrical contact with the wire and makes arc starts inconsistent.",
                },
                "ai_settings": {
                    "type": "terminal",
                    "fix": "Check that wire speed isn't set too low — minimum effective wire speed is around 100 IPM for most diameters. Also verify the correct process is selected on the display and the machine isn't in lock mode.",
                    "image_trigger": "front_panel_p8",
                },
            },
        },

        # ── 6. MACHINE WON'T START ────────────────────────────────────────────
        "machine_wont_start": {
            "root": "ms_1",
            "label": "Machine won't power on or won't initiate welding",
            "nodes": {
                "ms_1": {
                    "question": "Does any light, display, or fan come on when you flip the power switch to ON?",
                    "yes_next": "ms_thermal",
                    "no_next": "ms_breaker",
                },
                "ms_thermal": {
                    "question": "Was the machine running hard before this? Is a thermal overload indicator light illuminated?",
                    "yes_next": "ms_thermal_fix",
                    "no_next": "ms_voltage",
                },
                "ms_thermal_fix": {
                    "type": "terminal",
                    "fix": "Thermal overload has tripped. Power the machine OFF (leave it plugged in so the fan can run). Wait 15–20 minutes for the machine to cool. Check that intake and exhaust vents are unobstructed — never weld in an enclosed space with no airflow around the machine.",
                },
                "ms_voltage": {
                    "question": "Is the input voltage selector (on the power cable plug assembly) set to match your outlet — 120V for a standard outlet, 240V for a 240V outlet?",
                    "yes_next": "ms_lock",
                    "no_next": "ms_voltage_fix",
                    "image_trigger": "front_panel_p8",
                },
                "ms_voltage_fix": {
                    "type": "terminal",
                    "fix": "Set the voltage selector on the power cord assembly to match your outlet. Using the 240V setting with 120V power will prevent the machine from reaching operating voltage and welding will not initiate.",
                    "image_trigger": "front_panel_p8",
                },
                "ms_lock": {
                    "type": "terminal",
                    "fix": "Check the LOCK function — if lock mode is enabled, settings may be frozen and welding disabled. Hold the Home button to exit lock. Also confirm the correct process is selected and that min/max limits haven't been set too tight.",
                    "image_trigger": "front_panel_p8",
                },
                "ms_breaker": {
                    "question": "Is the circuit breaker at your panel tripped or the outlet fuse blown?",
                    "yes_next": "ms_breaker_fix",
                    "no_next": "ms_outlet",
                },
                "ms_breaker_fix": {
                    "type": "terminal",
                    "fix": "Reset the breaker. For 240V welding, use a minimum 30A dedicated circuit. For 120V, use a 20A dedicated circuit — do not share with other loads. If the breaker trips immediately again, there may be a fault in the machine.",
                },
                "ms_outlet": {
                    "type": "terminal",
                    "fix": "Test the outlet with a different device (lamp, phone charger). Check the power cord for cuts or damage. Confirm the power switch is fully in the ON position. If the outlet is dead and the breaker is fine, have the outlet tested by an electrician.",
                },
            },
        },

        # ── 7. BURN-THROUGH ───────────────────────────────────────────────────
        "burn_through": {
            "root": "bt_1",
            "label": "Burn-through — melting holes in the base metal",
            "nodes": {
                "bt_1": {
                    "question": "Is the material thinner than 3/16 inch (approximately 5mm)?",
                    "yes_next": "bt_thin_amp",
                    "no_next": "bt_thick",
                },
                "bt_thin_amp": {
                    "question": "Is wire speed (amperage) set at or above the recommended range for your material thickness?",
                    "yes_next": "bt_speed",
                    "no_next": "bt_fitup",
                },
                "bt_speed": {
                    "question": "Are you moving slowly — pausing, using a wide weave, or letting the puddle grow large?",
                    "yes_next": "bt_speed_fix",
                    "no_next": "bt_amp_fix",
                },
                "bt_speed_fix": {
                    "type": "terminal",
                    "fix": "Increase travel speed significantly. For thin metal, keep moving — don't pause or weave. Use tight stringer beads. Weld in short sections to let heat dissipate. Consider tacking a backing strip of copper or aluminum behind the joint.",
                    "image_trigger": "wire_weld_diagnosis_p35",
                },
                "bt_amp_fix": {
                    "type": "terminal",
                    "fix": "Reduce wire speed (amperage) by 15–20%. Also drop voltage one step. Use the thinnest wire diameter available — 0.023\" wire gives better control on thin material than 0.030\". Lower heat input is the only fix for chronic burn-through.",
                    "image_trigger": "wire_weld_diagnosis_p35",
                },
                "bt_fitup": {
                    "question": "Is there a visible gap between the pieces at the joint?",
                    "yes_next": "bt_fitup_fix",
                    "no_next": "bt_technique",
                },
                "bt_fitup_fix": {
                    "type": "terminal",
                    "fix": "Improve fit-up. Even small gaps on thin material will cause burn-through. Clamp pieces together tightly. Tack weld every 2–3 inches before running a continuous bead.",
                },
                "bt_technique": {
                    "type": "terminal",
                    "fix": "Material may be at the edge of MIG capability. Consider TIG welding for material under 1/8\" — it offers much better heat control. Alternatively, use a push-pull technique: weld 1 inch, move the gun back slightly, then weld forward again.",
                },
                "bt_thick": {
                    "type": "terminal",
                    "fix": "Burn-through on thick material (over 3/16\") usually means too-slow travel speed or excessive dwell time. Speed up. Also check for large gaps in fit-up and ensure you're not grinding the groove too deep before welding.",
                    "image_trigger": "wire_penetration_p36",
                },
            },
        },

        # ── 8. EXCESSIVE SPATTER ──────────────────────────────────────────────
        "excessive_spatter": {
            "root": "sp_1",
            "label": "Excessive weld spatter",
            "nodes": {
                "sp_1": {
                    "question": "Are you welding flux-cored (no shielding gas)?",
                    "yes_next": "sp_fc_polarity",
                    "no_next": "sp_mig_gas",
                },
                # ── Flux-cored branch ──
                "sp_fc_polarity": {
                    "question": "Is polarity DCEN — ground clamp in (+) socket, wire feed power in (−) socket?",
                    "yes_next": "sp_fc_voltage",
                    "no_next": "sp_fc_pol_fix",
                    "image_trigger": "dcen_polarity_p13",
                },
                "sp_fc_pol_fix": {
                    "type": "terminal",
                    "fix": "Set DCEN: ground clamp to the POSITIVE (+) socket, wire feed power to the NEGATIVE (−) socket. Wrong polarity with flux-cored causes massive spatter — this is the most common cause.",
                    "image_trigger": "dcen_polarity_p13",
                },
                "sp_fc_voltage": {
                    "question": "Does the arc sound rough and popping — not a smooth steady crackle?",
                    "yes_next": "sp_fc_voltage_fix",
                    "no_next": "sp_fc_technique",
                },
                "sp_fc_voltage_fix": {
                    "type": "terminal",
                    "fix": "Increase voltage one step at a time until the arc sounds smooth and steady (like frying bacon). Flux-cored spatter is often caused by voltage too low relative to wire speed. The arc should sound consistent with no popping.",
                    "image_trigger": "wire_weld_diagnosis_p35",
                },
                "sp_fc_technique": {
                    "type": "terminal",
                    "fix": "Some spatter is normal with flux-cored. Apply anti-spatter spray to nozzle before welding. Use a 5–15° drag angle. Keep CTWD at 3/8–1/2 inch. Clean spatter from nozzle regularly to maintain gas shielding geometry.",
                    "image_trigger": "push_drag_angle_p22",
                },
                # ── MIG branch ──
                "sp_mig_gas": {
                    "question": "Is shielding gas flowing — cylinder open, regulator showing 20–30 SCFH?",
                    "yes_next": "sp_mig_nozzle",
                    "no_next": "sp_mig_gas_fix",
                },
                "sp_mig_gas_fix": {
                    "type": "terminal",
                    "fix": "Check gas: open the cylinder valve, set regulator to 20–30 SCFH, inspect the hose for kinks. Welding MIG without shielding gas causes severe spattering and a porous, rough weld.",
                },
                "sp_mig_nozzle": {
                    "question": "Is the nozzle heavily coated in spatter inside?",
                    "yes_next": "sp_mig_nozzle_fix",
                    "no_next": "sp_mig_voltage",
                },
                "sp_mig_nozzle_fix": {
                    "type": "terminal",
                    "fix": "Remove nozzle and clear spatter with nozzle pliers or reamer. Apply anti-spatter compound to the nozzle interior. A spatter-blocked nozzle disrupts the gas envelope and causes spatter to cascade.",
                },
                "sp_mig_voltage": {
                    "question": "Does the arc sound rough and uneven — not a steady crackling hiss?",
                    "yes_next": "sp_mig_tune",
                    "no_next": "sp_mig_wire",
                },
                "sp_mig_tune": {
                    "type": "terminal",
                    "fix": "Voltage is too low relative to wire speed. Increase voltage one step and listen. The arc should sound like steady, smooth crackling. If spatter still occurs, reduce wire speed slightly. Use the synergic mode to auto-tune voltage to wire speed.",
                    "image_trigger": "wire_weld_diagnosis_p35",
                },
                "sp_mig_wire": {
                    "type": "terminal",
                    "fix": "Check wire quality — cheap or rusty wire causes spatter. Also verify that you're using the correct wire type and shielding gas combination (C25 gas for mild steel, not pure CO2 which increases spatter).",
                },
            },
        },

        # ── 9. INADEQUATE PENETRATION ─────────────────────────────────────────
        "inadequate_penetration": {
            "root": "ip_1",
            "label": "Inadequate penetration — cold, convex bead sitting on top of the metal",
            "nodes": {
                "ip_1": {
                    "question": "Is polarity correct for your process — DCEP for MIG/Stick, DCEN for flux-cored/TIG?",
                    "yes_next": "ip_speed",
                    "no_next": "ip_polarity_fix",
                },
                "ip_polarity_fix": {
                    "type": "terminal",
                    "fix": "Correct polarity first. DCEP (electrode positive) drives more heat into the workpiece, which is why it's used for MIG and Stick. DCEN (electrode negative) concentrates heat at the electrode — correct for TIG and flux-cored but will give shallow penetration for MIG.",
                    "image_trigger": "dcep_polarity_p14",
                },
                "ip_speed": {
                    "question": "Are you moving the gun faster than a comfortable walking pace — the weld bead looks narrow and tall?",
                    "yes_next": "ip_speed_fix",
                    "no_next": "ip_amp",
                },
                "ip_speed_fix": {
                    "type": "terminal",
                    "fix": "Slow down. Travel speed too fast leaves a cold, narrow, high-crowned bead with poor fusion to the base metal. Match travel speed so the bead width is 2–3× the wire diameter. The weld pool should visibly wet out to the sides.",
                    "image_trigger": "wire_weld_diagnosis_p35",
                },
                "ip_amp": {
                    "question": "Is wire speed set at the lower end of the range — below 200 IPM for 0.030\" wire on material over 1/8\"?",
                    "yes_next": "ip_amp_fix",
                    "no_next": "ip_angle",
                },
                "ip_amp_fix": {
                    "type": "terminal",
                    "fix": "Increase wire speed to raise amperage. More amperage = more heat = better penetration. For 1/8\" mild steel with 0.030\" wire: wire speed 250–300 IPM, voltage 17–19V is a good starting point. Check the settings guide on the machine.",
                    "image_trigger": "wire_penetration_p36",
                },
                "ip_angle": {
                    "question": "Is the gun angle perpendicular to the work or using a push (forehand) angle instead of drag?",
                    "yes_next": "ip_ctwd",
                    "no_next": "ip_angle_fix",
                },
                "ip_angle_fix": {
                    "type": "terminal",
                    "fix": "Use a slight drag (backhand) angle for MIG — 5–15° tilting the gun back away from the direction of travel. A push angle reduces penetration. Pointing the gun directly at the weld zone also helps direct arc force into the joint.",
                    "image_trigger": "push_drag_angle_p22",
                },
                "ip_ctwd": {
                    "type": "terminal",
                    "fix": "Check CTWD — keep it at 1/4 to 1/2 inch. Excessive stick-out reduces current density at the wire tip and lowers penetration. Also consider joint prep: a 60–70° V-groove on thicker material improves access for the arc.",
                    "image_trigger": "push_drag_angle_p22",
                },
            },
        },

    }
}


def main() -> None:
    out_path = DATA_DIR / "diagnostic_graph.json"
    out_path.write_text(json.dumps(GRAPH, indent=2))
    print(f"Wrote {out_path}")
    for tree_name, tree in GRAPH["trees"].items():
        node_count = len(tree["nodes"])
        terminal_count = sum(
            1 for n in tree["nodes"].values() if n.get("type") == "terminal"
        )
        print(f"  {tree_name}: {node_count} nodes, {terminal_count} terminal")


if __name__ == "__main__":
    main()
