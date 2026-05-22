"""
Tool definitions and implementations for the Ignis agent.

Four tools, one per knowledge layer:
  get_machine_spec  — Layer 1: specs.json
  diagnose_defect   — Layer 2: diagnostic_graph.json
  get_visual        — Layer 3: visual_registry.json
  search_manual     — Layer 4: chunks/*.md
"""

import json
from pathlib import Path

from .session import get_session, update_session

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

# ── Tool schema definitions (passed to Claude) ────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "get_machine_spec",
        "description": (
            "Look up exact specifications for the Vulcan OmniPro 220: duty cycles, "
            "polarity settings, wire tensioner values, gas flow rates, input power. "
            "Always call this before stating any spec number — never answer from memory."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "spec_type": {
                    "type": "string",
                    "enum": ["duty_cycle", "polarity", "wire_settings", "gas_settings", "input_power"],
                    "description": "Which category of spec to look up.",
                },
                "process": {
                    "type": "string",
                    "enum": ["MIG", "flux_cored", "TIG", "Stick"],
                    "description": "Welding process filter (optional).",
                },
                "voltage": {
                    "type": "string",
                    "enum": ["120V", "240V"],
                    "description": "Input voltage filter for duty cycle (optional).",
                },
            },
            "required": ["spec_type"],
        },
    },
    {
        "name": "diagnose_defect",
        "description": (
            "Walk the user through a structured yes/no troubleshooting tree for weld "
            "defects or machine problems. Returns the next diagnostic question or a "
            "confirmed fix. Use for: porosity, bird's nest, burn-through, spatter, "
            "inadequate penetration, arc won't ignite, wire won't feed, machine won't start. "
            "Ask the user one question at a time — never dump a list of all possible causes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tree": {
                    "type": "string",
                    "enum": [
                        "porosity_wire", "porosity_stick", "birds_nest",
                        "wire_wont_feed", "arc_wont_ignite", "machine_wont_start",
                        "burn_through", "excessive_spatter", "inadequate_penetration",
                    ],
                    "description": "Which diagnostic tree to use.",
                },
                "node_id": {
                    "type": "string",
                    "description": "Current node ID in the tree. Omit to start from root.",
                },
                "user_answer": {
                    "type": "string",
                    "enum": ["yes", "no"],
                    "description": "User's answer to the previous question. Omit when starting.",
                },
            },
            "required": ["tree"],
        },
    },
    {
        "name": "get_visual",
        "description": (
            "Retrieve a diagram or photo from the manual. "
            "Always call this for: cable/polarity setup questions, front panel layout, "
            "wire bead diagnosis, weld penetration cross-sections. "
            "Never describe a cable connection without showing the diagram."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "image_id": {
                    "type": "string",
                    "description": (
                        "Exact image ID. Known IDs: dcen_polarity_p13, dcep_polarity_p14, "
                        "tig_setup_p24, stick_setup_p27, front_panel_p8, interior_controls_p9, "
                        "wire_weld_diagnosis_p35, wire_penetration_p36, stick_weld_diagnosis_p38, "
                        "push_drag_angle_p22, qsg_cable_setups, selection_chart."
                    ),
                },
                "query": {
                    "type": "string",
                    "description": "Natural-language query to find the best image if ID unknown.",
                },
            },
        },
    },
    {
        "name": "search_manual",
        "description": (
            "Search the full manual text for procedural instructions, step-by-step setup, "
            "or safety warnings. Use for how-to questions and anything not covered by the "
            "other three tools."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to look up.",
                },
                "section": {
                    "type": "string",
                    "enum": [
                        "wire_setup", "tig_stick", "welding_tips",
                        "maintenance", "safety", "all",
                    ],
                    "description": "Narrow the search to a manual section (default: all).",
                },
            },
            "required": ["query"],
        },
    },
]


# ── Cached data ────────────────────────────────────────────────────────────────

_specs: dict | None = None
_graph: dict | None = None
_registry: dict | None = None


def _specs_data() -> dict:
    global _specs
    if _specs is None:
        _specs = json.loads((DATA_DIR / "specs.json").read_text())
    return _specs


def _graph_data() -> dict:
    global _graph
    if _graph is None:
        _graph = json.loads((DATA_DIR / "diagnostic_graph.json").read_text())
    return _graph


def _registry_data() -> dict:
    global _registry
    if _registry is None:
        _registry = json.loads((DATA_DIR / "visual_registry.json").read_text())
    return _registry


# ── Tool implementations ───────────────────────────────────────────────────────

def get_machine_spec(spec_type: str, process: str | None = None, voltage: str | None = None) -> dict:
    data = _specs_data()

    if spec_type == "duty_cycle":
        results = data["duty_cycles"]
        if process:
            results = [r for r in results if r["process"] == process]
        if voltage:
            results = [r for r in results if r["voltage"] == voltage]
        return {"duty_cycles": results}

    if spec_type == "polarity":
        results = data["polarity"]
        if process:
            results = [r for r in results if r["process"] == process]
        return {"polarity": results}

    if spec_type == "wire_settings":
        return {"wire_settings": data["wire_settings"]}

    if spec_type == "gas_settings":
        result = data["gas_settings"]
        if process and process in result:
            return {"gas_settings": {process: result[process]}}
        return {"gas_settings": result}

    if spec_type == "input_power":
        result = data.get("input_power", {})
        if voltage and voltage in result:
            return {"input_power": {voltage: result[voltage]}}
        return {"input_power": result}

    return {"error": f"Unknown spec_type: {spec_type}"}


def diagnose_defect(
    tree: str,
    node_id: str | None = None,
    user_answer: str | None = None,
    session_id: str | None = None,
) -> dict:
    graph = _graph_data()

    if tree not in graph["trees"]:
        return {"error": f"Unknown diagnostic tree: {tree}"}

    tree_data = graph["trees"][tree]
    nodes = tree_data["nodes"]

    # Determine which node to return
    if node_id is None:
        # Starting fresh — return root node question
        current_id = tree_data["root"]
    elif user_answer in ("yes", "no"):
        # Advance based on user answer
        current_node = nodes.get(node_id)
        if not current_node:
            return {"error": f"Unknown node_id: {node_id}"}
        key = "yes_next" if user_answer == "yes" else "no_next"
        current_id = current_node.get(key)
        if not current_id:
            return {"error": f"Node {node_id} has no {key} branch"}
    else:
        current_id = node_id

    current_node = nodes.get(current_id)
    if not current_node:
        return {"error": f"Node not found: {current_id}"}

    # Update session
    if session_id:
        update_session(session_id, current_diagnostic_tree=tree, current_diagnostic_node=current_id)

    result: dict = {"node_id": current_id, "tree": tree}

    # Include quick_tips and relevant images on the first call (root node)
    if node_id is None:
        if "quick_tips" in tree_data:
            result["quick_tips"] = tree_data["quick_tips"]
        if "quick_tips_images" in tree_data:
            resolved = [img for img_id in tree_data["quick_tips_images"]
                        if (img := _get_image_by_id(img_id)) is not None]
            if resolved:
                result["show_images"] = resolved

    if current_node.get("type") == "terminal":
        result["status"] = "diagnosis_complete"
        result["fix"] = current_node["fix"]
        if "image_trigger" in current_node:
            image = _get_image_by_id(current_node["image_trigger"])
            if image:
                result["show_image"] = image
    else:
        result["status"] = "question"
        result["question"] = current_node["question"]
        if "image_trigger" in current_node:
            image = _get_image_by_id(current_node["image_trigger"])
            if image:
                result["show_image"] = image

    return result


def _get_image_by_id(image_id: str) -> dict | None:
    for img in _registry_data()["images"]:
        if img["id"] == image_id:
            return {
                "id": img["id"],
                "description": img["description"],
                "file_url": f"/assets/{img['file'].split('assets/')[-1]}",
            }
    return None


def get_visual(image_id: str | None = None, query: str | None = None) -> dict:
    registry = _registry_data()

    # Exact ID match
    if image_id:
        for img in registry["images"]:
            if img["id"] == image_id:
                return {
                    "id": img["id"],
                    "description": img["description"],
                    "file_url": f"/assets/{img['file'].split('assets/')[-1]}",
                    "semantic_tags": img.get("semantic_tags", []),
                }
        return {"error": f"No image with id={image_id}"}

    # Semantic search over tags + description
    if query:
        query_tokens = set(query.lower().split())
        scored: list[tuple[int, dict]] = []
        for img in registry["images"]:
            tags = [t.lower() for t in img.get("semantic_tags", [])]
            desc_tokens = set(img.get("description", "").lower().split())
            tag_score = sum(1 for t in tags if any(q in t or t in q for q in query_tokens))
            desc_score = len(query_tokens & desc_tokens)
            total = tag_score * 2 + desc_score
            if total > 0:
                scored.append((total, img))
        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            img = scored[0][1]
            return {
                "id": img["id"],
                "description": img["description"],
                "file_url": f"/assets/{img['file'].split('assets/')[-1]}",
                "semantic_tags": img.get("semantic_tags", []),
                "match_score": scored[0][0],
            }
        return {"error": "No matching image found for query", "query": query}

    return {"error": "Provide either image_id or query"}


_SECTION_CHUNKS: dict[str, list[str]] = {
    "wire_setup": ["wire_spool_install", "wire_feed_setup"],
    "tig_stick": ["tig_torch_assembly", "tungsten_grinding", "stick_welding_technique"],
    "welding_tips": ["mig_welding_technique"],
    "maintenance": ["maintenance"],
    "safety": ["safety_warnings"],
}


def search_manual(query: str, section: str = "all", session_id: str | None = None) -> dict:
    chunks_dir = DATA_DIR / "chunks"
    chunk_names = _SECTION_CHUNKS.get(section) if section != "all" else None

    # Load active process from session state
    active_process = None
    if session_id:
        session = get_session(session_id)
        active_process = session.get("process")

    results: list[dict] = []
    for md_file in sorted(chunks_dir.glob("*.md")):
        name = md_file.stem
        if chunk_names is not None and name not in chunk_names:
            continue
        content = md_file.read_text()
        # Simple relevance: count keyword matches
        query_lower = query.lower()
        hits = sum(content.lower().count(word) for word in query_lower.split() if len(word) > 3)

        # Apply process-based boost to prioritize related content
        boost = 0
        if active_process:
            proc_lower = active_process.lower()
            if proc_lower == "mig" and name in ["mig_welding_technique", "wire_feed_setup", "wire_spool_install"]:
                boost = 15
            elif proc_lower == "flux_cored" and name in ["mig_welding_technique", "wire_feed_setup", "wire_spool_install"]:
                boost = 15
            elif proc_lower == "tig" and name in ["tig_torch_assembly", "tungsten_grinding"]:
                boost = 15
            elif proc_lower == "stick" and name in ["stick_welding_technique"]:
                boost = 15

        if hits > 0 or boost > 0:
            hits += boost
            results.append({"chunk": name, "hits": hits, "content": content})

    if not results:
        # Return all chunks in section if no keyword match
        results = []
        for md_file in sorted(chunks_dir.glob("*.md")):
            name = md_file.stem
            if chunk_names is not None and name not in chunk_names:
                continue
            # Still apply boost here just in case all hits are 0 but we want process priority
            boost = 0
            if active_process:
                proc_lower = active_process.lower()
                if proc_lower == "mig" and name in ["mig_welding_technique", "wire_feed_setup", "wire_spool_install"]:
                    boost = 15
                elif proc_lower == "flux_cored" and name in ["mig_welding_technique", "wire_feed_setup", "wire_spool_install"]:
                    boost = 15
                elif proc_lower == "tig" and name in ["tig_torch_assembly", "tungsten_grinding"]:
                    boost = 15
                elif proc_lower == "stick" and name in ["stick_welding_technique"]:
                    boost = 15
            results.append({"chunk": name, "hits": boost, "content": md_file.read_text()})

    results.sort(key=lambda r: r["hits"], reverse=True)
    # Return top 2 chunks to avoid bloating context
    top = results[:2]
    return {
        "results": [{"chunk": r["chunk"], "content": r["content"]} for r in top],
        "total_chunks_searched": len(list(chunks_dir.glob("*.md"))),
    }


# ── Dispatch ───────────────────────────────────────────────────────────────────

def execute_tool(name: str, tool_input: dict, session_id: str) -> dict:
    if name == "get_machine_spec":
        return get_machine_spec(
            spec_type=tool_input["spec_type"],
            process=tool_input.get("process"),
            voltage=tool_input.get("voltage"),
        )
    if name == "diagnose_defect":
        return diagnose_defect(
            tree=tool_input["tree"],
            node_id=tool_input.get("node_id"),
            user_answer=tool_input.get("user_answer"),
            session_id=session_id,
        )
    if name == "get_visual":
        return get_visual(
            image_id=tool_input.get("image_id"),
            query=tool_input.get("query"),
        )
    if name == "search_manual":
        return search_manual(
            query=tool_input["query"],
            section=tool_input.get("section", "all"),
            session_id=session_id,
        )
    return {"error": f"Unknown tool: {name}"}
