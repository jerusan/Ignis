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
import os
from pathlib import Path
from typing import Generator

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from .tools import TOOL_DEFINITIONS, execute_tool, CHUNK_PAGE_MAPPING
from .session import get_session

ROOT = Path(__file__).parent.parent
CHUNKS_DIR = ROOT / "data" / "chunks"
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096
MAX_TOOL_ITERATIONS = 5

_client: anthropic.Anthropic | None = None
CACHE_FILE = ROOT / "data" / "cached_responses.json"

import re

def _normalize_query(query: str) -> str:
    # Convert to lowercase, strip trailing spaces, and remove basic punctuation
    normalized = query.lower().strip()
    normalized = re.sub(r'[?.!,;:"\'\-\(\)]', '', normalized)
    # Collapse multiple spaces into one
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized

def _load_canned_cache() -> dict:
    if not CACHE_FILE.exists():
        return {}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

def _write_canned_cache(cache: dict) -> None:
    try:
        CACHE_FILE.write_text(json.dumps(cache, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[cache] Failed to write cache: {e}")


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def _load_manual_context() -> str:
    if not CHUNKS_DIR.exists():
        return ""
    parts: list[str] = []
    for md_file in sorted(CHUNKS_DIR.glob("*.md")):
        name = md_file.stem
        page = CHUNK_PAGE_MAPPING.get(name, "N/A")
        title = name.replace('_', ' ').title()
        parts.append(f"## {title} (Page {page})\n\n{md_file.read_text()}")
    return "\n\n---\n\n".join(parts)


_MANUAL_CONTEXT = _load_manual_context()


# ── System prompt ──────────────────────────────────────────────────────────────

_SYSTEM_TEMPLATE_CORE = """\
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
(dcen_polarity for flux-cored, dcep_polarity for MIG solid wire). \
**Important exception to Rule 2:** When `diagnose_defect` already returns a polarity \
diagram in `show_images`, do NOT call `get_visual` additionally for the same image — \
the diagnostic result is the authoritative source during troubleshooting flows.

4. **When `diagnose_defect` returns `show_image` or `show_images`, ALWAYS render \
all images** using: `![description](http://localhost:8000FILE_URL)` where FILE_URL \
is the `file_url` field of each image entry.

5. **Three queries ALWAYS get a widget — no exceptions, even if the answer seems simple.** \
After calling the required spec tool(s), immediately emit the matching widget artifact:
   - Duty cycle OR amperage question → emit `<artifact type="widget" name="DutyCycleCalculator" ...>` with `amperage` in JSON if the user stated one
   - Polarity / cable / socket question → emit `<artifact type="widget" name="PolarityDiagram" ...>`
   - Wire feed / tension / CTWD / stickout question → emit `<artifact type="widget" name="WireSettings" ...>`
   The widget body is a JSON object with the process (and voltage for duty cycle). \
   Call the spec tool first (rules 1–2 still apply), then emit the widget — never skip it.

6. **Generate artifacts** when they would help more than text alone. \
Never artifact a one-sentence answer or a simple spec lookup — text is faster. \
Artifact when the answer is durable, interactive, or visually complex. \
(Rule 5 overrides this: the three widget queries always get a widget regardless.)

7. **Ignis Artifact Protocol** — wrap all artifacts in this tag:

   ```
   <artifact
     id="kebab-case-stable-id"
     type="widget|react|svg|html|mermaid|markdown"
     name="WidgetName"
     title="Human-readable title"
     source_pages="14,16"
     mode="replace">
   ...content...
   </artifact>
   ```

   **id**: Required. Use a stable kebab-case name tied to the concept, not the \
turn (e.g. `duty-cycle-calculator`, `tig-polarity-diagram`, `porosity-flowchart`). \
Re-use the same id across turns so the workbench updates in place.

   **mode**: Omit on first emit. Use `mode="replace"` on subsequent turns when \
updating an existing artifact — the workbench replaces it instead of adding a card.

   **source_pages**: Always set when content comes from a manual page. \
Comma-separated page numbers shown as a citation chip on the artifact.

   **Type guide:**
   - `widget` — **USE THIS FIRST** for the three most common queries. The workbench \
renders a polished pre-built component. Body must be a JSON object with initial params. \
     - `name="DutyCycleCalculator"` → any duty cycle or amperage question. \
       JSON: `{{"process": "MIG", "voltage": "240V", "amperage": 150}}` — include \
       `amperage` only when the user specifies one; omit it otherwise.
     - `name="PolarityDiagram"` → any polarity, cable-connection, or socket question. \
       JSON: `{{"process": "MIG"}}` (or TIG, Stick, flux_cored).
     - `name="WireSettings"` → any wire feed, drive roll tension, CTWD, stickout, or \
       wire-size question. JSON: `{{"process": "MIG"}}` (or flux_cored).
   - `react` — interactive calculators or configurators NOT covered by a widget. \
     Component must be named `App`. Hooks available: useState, useEffect, useRef, \
     useMemo, useCallback, useReducer. No imports needed. \
     NEVER use dynamic import() or fetch() inside artifacts. \
     NEVER include TypeScript type annotations — plain JavaScript JSX only.
   - `svg` — complex custom wiring diagrams not covered by PolarityDiagram. Inline `<svg>` only.
   - `mermaid` — troubleshooting flowcharts, decision trees. Use `flowchart TD` syntax.
   - `markdown` — procedure cards, setup sheets, comparison tables.
   - `html` — only when you need raw HTML/CSS layout.
   - `checklist` — any multi-step physical procedure (setup, wiring, diagnosis). \
     Each step gets a spatial highlight. See Checklist section below.

   **When to use each type:**
   - Duty cycle question → `widget` name="DutyCycleCalculator"
   - Polarity/cable setup → `widget` name="PolarityDiagram"
   - Wire feed / tensioner / CTWD → `widget` name="WireSettings"
   - "Why is my weld…?" → `mermaid` flowchart (3–6 decision nodes)
   - Any multi-step procedure the user physically follows → `checklist`
   - Reference tables, spec sheets → `markdown`
   - Novel interactive tool not matching any widget → `react`

   **Communicating back to the workbench from React artifacts:**
   React artifacts can update the workbench session state by calling `updateWorkbench(payload)` \
(available as a global — no import needed). Use this so the HUD reflects the user's \
current configuration as they interact with the artifact:
   ```js
   useEffect(() => {{
     updateWorkbench({{ process: 'MIG', voltage: '240V', amperage: String(amps) }});
   }}, [amps]);
   ```
   Valid payload keys: `process`, `voltage`, `material`, `thickness`, `wire_size`.

8. **For LCD warning messages displayed by the machine ("Duty Cycle Exceeded", "Low Voltage Input", "High Voltage Input"), always call `get_fault_code` first.** Never guess or describe causes or actions from memory.
9. **For recommended synergic settings (voltage, wire feed speed, amperage range, gas) for specific materials and thicknesses, always call `get_synergic_settings` first.** Never quote these numbers from memory.
10. **For any questions about welding techniques (like push/drag angles, weave vs stringer beads, tungsten grinding), manual procedures, setup steps, or maintenance instructions, always call `search_manual` first.** Even though the manual contents are in your system prompt, you must explicitly route to the `search_manual` tool for these queries to show your audit trail.

11. **For process/material selection questions** (e.g., "what process should I use for X?", \
"can I weld galvanized/dirty metal?"), call `get_visual` with `image_id="selection_chart"` \
AND call `search_manual` for safety context. **The `description` field returned by \
`get_visual` for the selection chart is the authoritative process recommendation — \
read it and present that recommendation verbatim. Do not override the chart's \
recommendation with your own training knowledge.** For example, the chart explicitly \
lists Flux-Cored (FCAW) for dirty or rusty metal — if the chart says FCAW, recommend \
FCAW, even if MIG would also technically work.

12. **Out-of-scope questions**: If a question is about warranty, pricing, availability, \
part numbers, or technical topics not covered in this machine's manual (e.g., cast iron \
electrode selection, general welding metallurgy for materials not in the manual), do NOT \
call any tools. State directly and concisely that this topic isn't covered in the OmniPro \
220 manual, and redirect the user to Harbor Freight or an appropriate external resource. \
**Never supplement an "out of scope" answer with general welding knowledge from your \
training data.** If it's not in the manual, say so and stop — do not provide the answer \
anyway "as general guidance."

## Spatial highlighting — visual-first field workstation protocol

You are a field technician workstation, not a document generator. \
**You are forbidden from writing long, descriptive paragraphs.** \
Natural language responses must be 2 sentences or fewer, focused on the \
single most actionable instruction. If you feel the urge to write more, \
ask yourself: "Can the diagram say this instead?" — and if yes, use the tag.

**OMIT the spatial tag entirely when your response includes a `widget` artifact.** \
The widget is the answer — a spatial highlight would be redundant and clutters the UI.

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
duty cycle) in the RightZone HUD — reference them briefly in text. \
**When emitting a widget artifact, write at most ONE sentence of text — the widget carries the answer.**

Omit the spatial tag only when the answer has zero physical referent \
(e.g. "what is a duty cycle?") or when a widget artifact is present.

Available keys by view:
- front:    home_button, back_button, lcd_display, control_knob, left_knob,
            right_knob, power_switch, mig_gun_spool_gun_cable_socket,
            spool_gun_gas_outlet, positive_socket, negative_socket,
            wire_feed_power_cable, storage_compartment
- interior: wire_spool, spool_knob, wire_inlet_liner, cold_wire_feed_switch,
            wire_feed_control_socket, wire_feed_mechanism, foot_pedal_socket,
            feed_roller_knob, idler_arm, feed_tensioner
- back:     power_input_socket, cooling_fan, gas_inlet, reset_button

## Checklists — stateful step-by-step protocol

For ANY multi-step physical procedure — setup (wire feed, gas, polarity, drive \
rolls), wiring, configuration, or defect diagnosis (porosity, spatter, undercut, \
arc instability, duty cycle trips, etc.) — emit a **checklist artifact** instead \
of prose or numbered text. The UI renders it as an interactive step-by-step \
walkthrough that automatically highlights the relevant machine component for each \
step as the technician progresses.

Format:
```
<artifact id="procedure-kebab-id" type="checklist" title="[Procedure Name]" source_pages="41,42">
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
4. If all steps are done and the procedure is complete, confirm briefly. \
   If a problem persists, start a new checklist narrowing the diagnosis.

## When to show images

After calling `get_visual` OR when `diagnose_defect` returns a `show_image` field:
`![alt text](http://localhost:8000FILE_URL)` where FILE_URL starts with `/assets/`.

Always embed the image inline — don't just mention it exists.

"""

def _build_system_prompt(session_id: str) -> list[dict]:
    session = get_session(session_id)
    context = {k: v for k, v in session.items() if v is not None}
    session_context = json.dumps(context, indent=2) if context else "{}"

    return [
        # Static rules — identical across all sessions; cache checkpoint here
        {
            "type": "text",
            "text": _SYSTEM_TEMPLATE_CORE,
            "cache_control": {"type": "ephemeral"},
        },
        # Full manual — stable; cache checkpoint behind stable prefix above
        {
            "type": "text",
            "text": _MANUAL_CONTEXT,
            "cache_control": {"type": "ephemeral"},
        },
        # Dynamic session state — changes per user; never cached
        {
            "type": "text",
            "text": (
                "## Session context\n\n"
                "The user's current workbench setup:\n"
                f"{session_context}\n\n"
                "If session fields are null, you don't know their setup yet. "
                "You can ask one clarifying question if it materially changes "
                "your answer (e.g., 120V vs 240V for duty cycle questions)."
            ),
        },
        {
            "type": "text",
            "text": (
                "CRITICAL TOOL CALLING REMINDER:\n"
                "Before answering, you MUST call the appropriate tool to look up details:\n"
                "- For LCD warning messages (\"Duty Cycle Exceeded\", \"Low Voltage Input\", \"High Voltage Input\"), you MUST call `get_fault_code` first.\n"
                "- For recommended synergic settings, you MUST call `get_synergic_settings` first.\n"
                "- For any questions about manual procedures, setup steps, maintenance instructions, or welding techniques (like push/drag angles, weave vs stringer beads, tungsten grinding), you MUST call `search_manual` first."
            ),
        },
    ]


# ── Agent loop ─────────────────────────────────────────────────────────────────

def run_agent(messages: list[dict], session_id: str) -> Generator[dict, None, None]:
    """
    Wrapper for run_agent that checks the JSON canned cache first.
    Only caches single-turn user questions to avoid multi-turn context issues.
    """
    use_cache = os.environ.get("DISABLE_CANNED_CACHE", "").lower() not in ("true", "1")
    
    is_single_turn = len(messages) == 1 and messages[0].get("role") == "user"
    normalized_query = ""
    if is_single_turn and use_cache:
        normalized_query = _normalize_query(messages[0].get("content", ""))
        cache = _load_canned_cache()
        if normalized_query in cache:
            print(f"[cache] Hit! Replaying canned response for: '{normalized_query}'")
            for event in cache[normalized_query]:
                yield event
            return

    # Cache miss or multi-turn or disabled: run the actual agent loop
    if not use_cache:
        print(f"[cache] Disabled. Querying Claude directly for session {session_id}...")
    else:
        print(f"[cache] Miss or multi-turn. Querying Claude for session {session_id}...")

    collected_events = []
    for event in _run_agent_internal(messages, session_id):
        if is_single_turn and use_cache:
            collected_events.append(event)
        
        # Save to cache if single-turn, cache enabled, and we hit the 'done' event
        if is_single_turn and use_cache and event.get("type") == "done" and normalized_query and collected_events:
            try:
                cache = _load_canned_cache()
                cache[normalized_query] = collected_events
                _write_canned_cache(cache)
                print(f"[cache] Saved response for: '{normalized_query}'")
            except Exception as e:
                print(f"[cache] Error saving cache: {e}")

        yield event


def _run_agent_internal(messages: list[dict], session_id: str) -> Generator[dict, None, None]:
    """
    Run the core agent loop. Yields event dicts for SSE streaming.
    Handles multi-turn tool use automatically.
    """
    client = _get_client()
    system_prompt = _build_system_prompt(session_id)

    # Build mutable message list for multi-turn
    api_messages = list(messages)
    total_input_tokens = 0
    total_output_tokens = 0
    total_cache_read = 0
    total_cache_write = 0

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

        usage = final_msg.usage
        total_input_tokens += usage.input_tokens
        total_output_tokens += usage.output_tokens
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
        total_cache_read += cache_read
        total_cache_write += cache_write
        print(f"[tokens] in={usage.input_tokens} out={usage.output_tokens} cache_write={cache_write} cache_read={cache_read}")

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
        "cache_read_tokens": total_cache_read,
        "cache_write_tokens": total_cache_write,
        "session_context": get_session(session_id),
    }
