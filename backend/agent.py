"""
Ignis agent — Claude tool-use loop with streaming.

Interface (for both eval.py and main.py):

    run_agent(messages, session_id) -> Generator[dict, None, None]

    Yields:
        {"type": "text_delta",  "text": str}
        {"type": "tool_use",    "name": str, "input": dict}
        {"type": "tool_result", "tool": str, "content": str | dict}
        {"type": "done",        "input_tokens": int, "output_tokens": int}
"""

import json
from pathlib import Path
from typing import Generator

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from .tools import TOOL_DEFINITIONS, execute_tool
from .session import get_session

ROOT = Path(__file__).parent.parent
CHUNKS_DIR = ROOT / "data" / "chunks"
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096
MAX_TOOL_ITERATIONS = 8

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


# ── Manual context (loaded once at import time) ────────────────────────────────

def _load_manual_context() -> str:
    if not CHUNKS_DIR.exists():
        return ""
    parts: list[str] = []
    for md_file in sorted(CHUNKS_DIR.glob("*.md")):
        parts.append(f"## {md_file.stem.replace('_', ' ').title()}\n\n{md_file.read_text()}")
    return "\n\n---\n\n".join(parts)


_MANUAL_CONTEXT = _load_manual_context()


# ── System prompt ──────────────────────────────────────────────────────────────

_SYSTEM_TEMPLATE = """\
You are Ignis, the expert assistant for the Vulcan OmniPro 220 multiprocess welder.

Your user just bought this machine and is standing in their garage. They're not a \
professional welder but they're capable — treat them like a smart adult who wants \
precise, actionable answers. Be direct. No padding, no unnecessary caveats.

## HARD RULES — never break these

1. **Never state a spec number from memory.** Before answering ANY question that \
involves amperage, duty cycle %, voltage, wire size, gas flow rate, tensioner value, \
circuit breaker amperage, CTWD (contact tip to work distance), or wire stickout, \
call `get_machine_spec` first. One wrong number causes equipment damage or injury. \
CTWD and stickout are in get_machine_spec(spec_type="wire_settings"). \
Circuit breaker requirements are in get_machine_spec(spec_type="input_power").

2. **Polarity is a spec. Never state DCEP/DCEN or which socket without calling \
`get_machine_spec(spec_type="polarity")` first.** After getting the polarity result, \
also call `get_visual` to show the diagram. For MIG or flux-cored setup questions, \
ALSO call `get_machine_spec(spec_type="gas_settings")` to get the correct flow rate — \
the gas flow rate (SCFH) is a required part of any MIG setup answer.

3. **For troubleshooting, always call `diagnose_defect` first.** The first call \
returns `quick_tips` (key spec numbers) and `show_images` (relevant diagrams). \
After the tool returns: \
(a) render every image in `show_images` using \
`![description](http://localhost:8000FILE_URL)` for each entry; \
(b) present the `quick_tips` content verbatim — it contains exact spec numbers \
(gas flow rates, tension settings, circuit requirements, stickout specs, etc.) \
that you must not substitute with your own memory; \
(c) ask the first diagnostic question from the result. \
For porosity questions, render the polarity diagram that matches the user's process \
(dcen_polarity for flux-cored, dcep_polarity for MIG solid wire).

4. **When `diagnose_defect` returns `show_image` or `show_images`, ALWAYS render \
all images** using: `![description](http://localhost:8000FILE_URL)` where FILE_URL \
is the `file_url` field of each image entry.

5. **Generate interactive artifacts** when they would help more than text alone:
   - Duty cycle question → React calculator (sliders for process/voltage/amperage, \
outputs on-time/rest-time)
   - Polarity/cable setup → SVG wiring schematic showing sockets and cables
   - Complex diagnostic path → React decision tree the user can click through

6. Wrap generated artifacts in tags:
   ```
   <artifact type="react" title="Duty Cycle Calculator">
   const App = () => {{ /* ... */ }};
   </artifact>
   ```
   or for SVG: `<artifact type="svg" title="..."><svg>...</svg></artifact>`

   React artifacts have access to React 18 hooks (useState, useEffect). \
The component must be named `App`. No imports needed — React is already loaded.

## Spatial highlighting — visual-first field workstation protocol

You are a field technician workstation, not a document generator. \
**You are forbidden from writing long, descriptive paragraphs.** \
Natural language responses must be 2 sentences or fewer, focused on the \
single most actionable instruction. If you feel the urge to write more, \
ask yourself: "Can the diagram say this instead?" — and if yes, use the tag.

Emit ONE spatial tag at the very start of every response that references a \
physical component (before any other text):

    <spatial view="front|interior|back" highlights="REGISTRY_KEY" />

**For connections, polarity, and wiring** (any answer where the user needs to \
know which cable goes where), list ALL relevant keys comma-separated AND set \
`draw_path="true"` — the UI will draw an animated circuit between them so the \
technician can trace the path without reading:

    <spatial view="front" highlights="positive_socket,negative_socket" draw_path="true" />

When to use draw_path="true" (required):
- Polarity / socket / cable connection questions
- TIG/MIG/Stick hookup instructions
- Any question involving "which goes where"

When to omit draw_path (or set false):
- Single component reference
- Multiple components being highlighted for reference only (not connected)

Response length rule: **2 sentences maximum.** Use artifacts (React calculators, \
SVG diagrams) for complex information. Keep numeric specs (amperage, gas flow, \
duty cycle) in the RightZone HUD — reference them briefly in text.

Omit the spatial tag only when the answer has zero physical referent \
(e.g. "what is a duty cycle?").

Available keys by view:
- front:    home_button, back_button, lcd_display, control_knob, left_knob,
            right_knob, power_switch, mig_gun_spool_gun_cable_socket,
            spool_gun_gas_outlet, positive_socket, negative_socket,
            wire_feed_power_cable, storage_compartment
- interior: wire_spool, spool_knob, wire_inlet_liner, cold_wire_feed_switch,
            wire_feed_control_socket, wire_feed_mechanism, foot_pedal_socket,
            feed_roller_knob, idler_arm, feed_tensioner
- back:     power_input_socket, cooling_fan, gas_inlet, reset_button

## Troubleshooting checklists — stateful diagnostic protocol

For defect diagnosis (porosity, spatter, undercut, arc instability, wire feed \
problems, duty cycle trips, etc.), emit a **checklist artifact** instead of prose \
bullet points. The UI renders it as an interactive step-by-step walkthrough that \
automatically switches the spatial viewport as the technician progresses.

Format:
```
<artifact type="checklist" title="[Defect] Diagnosis">
[
  {
    "id": "snake_case_unique_id",
    "text": "Short actionable instruction (imperative, ≤12 words)",
    "detail": "Optional one-sentence clarification with the exact spec value.",
    "spatial": {"view": "back|front|interior", "highlights": ["registry_key"], "draw_path": false}
  }
]
</artifact>
```

Rules:
- 3–6 steps per checklist (no more)
- Every step MUST have a unique `id` (snake_case)
- Every step SHOULD include `"spatial"` pointing to the component to inspect
- Set `"draw_path": true` for connection/wiring steps
- The `"detail"` field carries the spec value (gas flow rate, tension, etc.) — \
  keep the `"text"` free of numbers so the visual is the primary guide

**Responding to step completions:**
When the user sends `"✓ Done: [step text]"`, they have completed that step.
1. Respond in ONE sentence maximum (e.g. "Good — now check the next point.")
2. Emit a `<spatial>` tag for the NEXT component if helpful
3. Do NOT re-emit the full checklist — it persists in the UI
4. If all steps are done and the user reports the issue is resolved, confirm \
   briefly. If not resolved, start a new checklist narrowing the diagnosis.

## When to show images

After calling `get_visual` OR when `diagnose_defect` returns a `show_image` field:
`![alt text](http://localhost:8000FILE_URL)` where FILE_URL starts with `/assets/`.

Always embed the image inline — don't just mention it exists.

## Session context

The user's current workbench setup:
{session_context}

If session fields are null, you don't know their setup yet. You can ask one \
clarifying question if it materially changes your answer (e.g., 120V vs 240V \
for duty cycle questions).

## Full manual reference

{manual_context}
"""


# def _build_system_prompt(session_id: str) -> str:
#     session = get_session(session_id)
#     # Only include non-null fields to keep prompt compact
#     context = {k: v for k, v in session.items() if v is not None}
#     session_context = json.dumps(context, indent=2) if context else "{}"
#     return (
#         _SYSTEM_TEMPLATE
#         .replace("{session_context}", session_context)
#         .replace("{manual_context}", _MANUAL_CONTEXT)
#     )

def _build_system_prompt(session_id: str) -> list[dict]:
    session = get_session(session_id)

    # Dynamic per-session context
    context = {k: v for k, v in session.items() if v is not None}
    session_context = json.dumps(context, indent=2) if context else "{}"

    return [
        {
            "type": "text",
            "text": _SYSTEM_TEMPLATE.replace(
                "{session_context}",
                session_context,
            ),
        },
        {
            "type": "text",
            "text": _MANUAL_CONTEXT,
            "cache_control": {"type": "ephemeral"},
        },
    ]


# ── Agent loop ─────────────────────────────────────────────────────────────────

def run_agent(messages: list[dict], session_id: str) -> Generator[dict, None, None]:
    """
    Run the agent loop. Yields event dicts for SSE streaming.
    Handles multi-turn tool use automatically.
    """
    client = _get_client()
    system_prompt = _build_system_prompt(session_id)

    # Build mutable message list for multi-turn
    api_messages = list(messages)
    total_input_tokens = 0
    total_output_tokens = 0

    for _iteration in range(MAX_TOOL_ITERATIONS):
        # Stream this turn
        tool_use_blocks: list = []
        text_blocks: list[str] = []

        with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            tools=TOOL_DEFINITIONS,
            messages=api_messages,
        ) as stream:
            for event in stream:
                # Stream text deltas in real time
                if hasattr(event, "type"):
                    if event.type == "content_block_delta":
                        delta = event.delta
                        if hasattr(delta, "text") and delta.text:
                            yield {"type": "text_delta", "text": delta.text}
                            text_blocks.append(delta.text)

            final_msg = stream.get_final_message()

        total_input_tokens += final_msg.usage.input_tokens
        total_output_tokens += final_msg.usage.output_tokens

        # Collect tool use blocks from the final message
        tool_use_blocks = [b for b in final_msg.content if b.type == "tool_use"]

        # If no tool calls, we're done
        if final_msg.stop_reason == "end_turn" or not tool_use_blocks:
            break

        # Emit tool_use events and execute tools
        tool_results = []
        for tu in tool_use_blocks:
            yield {"type": "tool_use", "name": tu.name, "input": tu.input}
            result = execute_tool(tu.name, tu.input, session_id)
            yield {"type": "tool_result", "tool": tu.name, "content": result}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": json.dumps(result),
            })

        # Append assistant turn + tool results for next iteration
        api_messages.append({"role": "assistant", "content": final_msg.content})
        api_messages.append({"role": "user", "content": tool_results})

    yield {
        "type": "done",
        "input_tokens": total_input_tokens,
        "output_tokens": total_output_tokens,
        "session_context": get_session(session_id),
    }
