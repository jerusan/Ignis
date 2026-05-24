#!/usr/bin/env python3
"""
Ignis eval harness — runs ground-truth questions through the agent
and scores responses using exact-match logic or Claude as judge.

Run from repo root:
    python eval.py

Options:
    python eval.py --quick                     (exact-match questions only)
    python eval.py --judge-only                (LLM-judge questions only)
    python eval.py --ids spec_01 spec_02
    python eval.py --category spec
    python eval.py --no-judge
    python eval.py --runs 3
"""

import re
import sys
import json
import time
import statistics
import argparse
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env", override=True)
sys.path.insert(0, str(ROOT))

import anthropic
from backend.agent import run_agent

DATASET_PATH = ROOT / "eval" / "golden_dataset.json"
FLAG_PATH = ROOT / "eval" / ".data_integrity_passed"

JUDGE_SYSTEM = """\
You are an expert, strict, and consistent evaluator of an AI assistant specialized in the Vulcan OmniPro 220 multiprocess welder.
You score responses according to a detailed rubric. Always return valid JSON only. Never add extra commentary."""

JUDGE_PROMPT_BASE = """\
You are evaluating an AI assistant's response about the Vulcan OmniPro 220 welder.

Score the response strictly using the rubric below.

=== FEW-SHOT EXAMPLES ===

Example 1 (Perfect):
Question: What is the duty cycle at 200A?
Ground truth: 60% at 200A according to page 12.
Key numbers: ["60%"]
Response: The OmniPro 220 has a 60% duty cycle at 200 amps. See page 12.
Tools: []
Showed image: false

Scores:
{"technical_accuracy": 3, "tool_routing": 2, "multimodal": 2, "citation_accurate": true, "tone": 1, "reasoning": "All key specs correct with proper citation and concise tone.", "hallucination_detected": false}

Example 2 (Hallucination):
Question: What size breaker do I need?
Ground truth: 50A breaker recommended. Page 8.
Key numbers: ["50"]
Response: You need at least a 60 amp breaker for safety.
Tools: []
Showed image: false

Scores:
{"technical_accuracy": 0, "tool_routing": 2, "multimodal": 2, "citation_accurate": false, "tone": 1, "reasoning": "Hallucinated incorrect breaker size (60A instead of 50A).", "hallucination_detected": true}

Example 3 (Good with visuals):
Question: How do I set up flux core welding?
Ground truth: Use 0.030 or 0.035 wire. Page 23.
Key numbers: ["0.030", "0.035"]
Response: For flux core, use 0.030 or 0.035 wire. Full instructions on page 23. [Image shown]
Tools: ["get_welding_parameters"]
Showed image: true

Scores:
{"technical_accuracy": 3, "tool_routing": 2, "multimodal": 2, "citation_accurate": true, "tone": 1, "reasoning": "Correct specs, tools, citation and visual aid provided.", "hallucination_detected": false}

Example 4 (Wrong number):
Question: What's the max voltage on MIG?
Ground truth: 28V max. Page 15.
Key numbers: ["28"]
Response: The maximum output voltage is 32 volts.
Tools: []
Showed image: false

Scores:
{"technical_accuracy": 0, "tool_routing": 2, "multimodal": 2, "citation_accurate": false, "tone": 0, "reasoning": "Incorrect voltage and missing citation.", "hallucination_detected": true}

Example 5 (Tone issue):
Question: Can I weld aluminum?
Ground truth: Yes with spool gun. Page 27.
Key numbers: []
Response: Yes you can weld aluminum but you need a spool gun. Always follow all safety rules and read the full manual because welding is dangerous if not done correctly...
Tools: ["get_material_capability"]
Showed image: false

Scores:
{"technical_accuracy": 2, "tool_routing": 1, "multimodal": 2, "citation_accurate": false, "tone": 0, "reasoning": "Mostly correct but overly verbose with safety theater and no citation.", "hallucination_detected": false}

=== END OF EXAMPLES ===

Now evaluate the following response using the exact same standards.

1. technical_accuracy (0-3):
   - 3 = All facts and key numbers exactly correct, no hallucinations
   - 2 = Mostly correct, minor omissions, no wrong numbers
   - 1 = Partial credit or one minor error
   - 0 = Any hallucinated spec number or fundamentally wrong
   → If key_numbers non-empty and any number wrong/missing → max 1
   Chain-of-Thought Verification: if the question involves troubleshooting and the agent
   guesses a root cause or fix without tracing the diagnostic tree step-by-step, cap at 1.

2. tool_routing (0-2):
   - 2 = All expected tools called correctly
   - 1 = Some but not all
   - 0 = Wrong or unnecessary tools
   Chain-of-Thought Verification (applies when a diagnostic tree is involved):
   → Score 0 if the agent states a terminal fix or root cause WITHOUT first calling `diagnose_defect`
     sequentially (i.e., initial call with only `tree`, then subsequent calls with `node_id` + `user_answer`).
   → Deduct 1 point if the agent asks the user a yes/no question that was already answered
     in the user's original message (redundant question penalty).

3. multimodal (0-2):
   - Only score if requires_image=True

4. citation_accurate (true/false)
5. tone (0-1): Brief, confident, garage-friendly. Penalize walls of text and safety theater.

Return **only** valid JSON in this exact format:
{
  "technical_accuracy": <0-3>,
  "tool_routing": <0-2>,
  "multimodal": <0-2>,
  "citation_accurate": <true|false>,
  "tone": <0-1>,
  "reasoning": "<one short sentence>",
  "hallucination_detected": <true|false>
}"""


def collect_response(messages: list[dict], session_id: str) -> tuple[str, list[str], list[dict], bool]:
    """Run agent, return (full_text, tools_called, tool_calls, showed_image)."""
    text_parts: list[str] = []
    tools_called: list[str] = []
    tool_calls: list[dict] = []
    showed_image = False

    for event in run_agent(messages, session_id):
        if event["type"] == "text_delta":
            text_parts.append(event["text"])
        elif event["type"] == "tool_use":
            tools_called.append(event["name"])
            tool_calls.append({"name": event["name"], "input": event["input"]})
        elif event["type"] == "tool_result":
            content = event.get("content", "")
            if isinstance(content, str) and "assets/" in content:
                showed_image = True
        elif event["type"] == "done":
            break

    full_text = "".join(text_parts)
    if "assets/" in full_text or "image_id" in full_text or "/assets/" in full_text:
        showed_image = True

    return full_text, tools_called, tool_calls, showed_image


def check_exact_match(response: str, key_numbers: list[str]) -> tuple[bool, str]:
    normalized_response = response.lower()

    vulgar_replacements = {
        "2½": "2-1/2", "½": "1/2", "¼": "1/4", "⅜": "3/8",
    }
    for old, new in vulgar_replacements.items():
        normalized_response = normalized_response.replace(old, new)

    replacements = {
        " amperes": "a", " ampere": "a", " amps": "a", " amp": "a",
        "-ampere": "a", "-amperes": "a", "-amps": "a", "-amp": "a",
        " volts": "v", " volt": "v", "-volts": "v", "-volt": "v",
        " ipm": "ipm", " scfh": "scfh",
        " percent": "%", " %": "%", "a.": "a", "v.": "v", "a ": "a", "v ": "v",
    }
    for old, new in replacements.items():
        normalized_response = normalized_response.replace(old, new)

    missing = []
    for kn in key_numbers:
        kn_norm = kn.lower()
        found = False
        if kn_norm in normalized_response:
            found = True
        else:
            if kn_norm in ("1/2", "0.5") and ("1/2" in normalized_response or "0.5" in normalized_response):
                found = True
            elif kn_norm in ("2-1/2", "2.5") and any(x in normalized_response for x in ("2-1/2", "2.5", "2.5x", "2.5×")):
                found = True
            elif kn_norm in ("1/4", "0.25") and any(x in normalized_response for x in ("1/4", "0.25", "0.250")):
                found = True
            elif kn_norm in ("3/8", "0.375") and ("3/8" in normalized_response or "0.375" in normalized_response):
                found = True
            elif kn_norm in ("3/16", "0.188") and ("3/16" in normalized_response or "0.188" in normalized_response):
                found = True
            elif kn_norm in ("5/16", "0.312") and ("5/16" in normalized_response or "0.312" in normalized_response):
                found = True
            elif kn_norm == "2 minutes" and any(x in normalized_response for x in ("2 min", "2-minute")):
                found = True
            elif kn_norm == "30 seconds" and any(x in normalized_response for x in ("30 sec", "30-second")):
                found = True
            elif kn_norm.endswith(".0"):
                integer_part = kn_norm[:-2]
                if re.search(rf"\b{integer_part}(?!\d)", normalized_response):
                    found = True
            elif kn_norm.endswith("%"):
                num = kn_norm.replace("%", "").strip()
                if f"{num} percent" in normalized_response or f"{num} %" in normalized_response:
                    found = True

        if not found:
            missing.append(kn)

    if not missing:
        return True, "All key numbers matched"
    return False, f"Missing key numbers: {missing}"


def check_citation(response: str, manual_page: int) -> bool:
    if manual_page == 0:
        return True
    page_str = str(manual_page)
    if re.search(rf'source_pages="[^"]*\b{page_str}\b[^"]*"', response):
        return True
    if re.search(rf'\bpage\s+{page_str}\b', response, re.IGNORECASE):
        return True
    return False


def check_tool_params(tool_calls: list[dict], expected_tool_inputs: dict | None) -> tuple[bool | None, str]:
    if not expected_tool_inputs:
        return None, "N/A"

    def call_matches(call_input: dict, required: dict) -> bool:
        return all(
            str(call_input.get(k, "")).lower() == str(v).lower()
            for k, v in required.items()
        )

    failures = []
    for tool_name, required_params in expected_tool_inputs.items():
        matching = [c for c in tool_calls if c["name"] == tool_name]
        if not matching:
            failures.append(f"{tool_name}: not called")
            continue
        if not any(call_matches(c["input"], required_params) for c in matching):
            actuals = [{k: c["input"].get(k) for k in required_params} for c in matching]
            failures.append(f"{tool_name} expected {required_params}, got {actuals}")

    if not failures:
        return True, "All tool params matched"
    return False, "; ".join(failures)


def detect_artifacts(response: str) -> list[dict]:
    artifacts = []
    for match in re.finditer(r'<artifact\b([^>]*?)>', response, re.DOTALL):
        attr_str = match.group(1)
        attrs = {}
        for key in ("type", "name", "id"):
            m = re.search(rf'\b{key}="([^"]*)"', attr_str)
            if m:
                attrs[key] = m.group(1)
        if attrs:
            artifacts.append(attrs)
    return artifacts


def check_artifact(response: str, expected_artifact: dict | None) -> bool | None:
    if expected_artifact is None:
        return None
    for a in detect_artifacts(response):
        if a.get("type") == expected_artifact.get("type"):
            if "name" not in expected_artifact or a.get("name") == expected_artifact["name"]:
                return True
    return False


def judge_response(
    client: anthropic.Anthropic,
    question: dict,
    response: str,
    tools_called: list[str],
    tool_calls: list[dict],
    showed_image: bool,
) -> dict:
    """Judge with ephemeral prompt caching."""
    dynamic_content = f"""Question: {question["question"]}

Ground truth answer: {question["ground_truth"]}
Expected manual page: {question.get("manual_page", "N/A")}
Key numbers: {json.dumps(question.get("key_numbers", []))}

Agent's response: {response[:2200]}

Tools called (names only): {json.dumps(tools_called)}
Tool calls with arguments: {json.dumps(tool_calls)}
Expected tools: {json.dumps(question.get("expected_tool_calls", []))}
Requires image: {question.get("requires_image", False)}
Agent showed image: {showed_image}"""

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": JUDGE_PROMPT_BASE + "\n\nNow evaluate the following:",
                    "cache_control": {"type": "ephemeral"}
                }
            ]
        },
        {
            "role": "user",
            "content": dynamic_content
        }
    ]

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            temperature=0,
            system=JUDGE_SYSTEM,
            messages=messages,
            extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"}
        )

        usage = resp.usage
        cache_read = getattr(usage, 'cache_read_input_tokens', 0)
        cache_write = getattr(usage, 'cache_creation_input_tokens', 0)
        if cache_read > 0 or cache_write > 0:
            print(f"  [Cache] Read:{cache_read} Write:{cache_write} | Total:{usage.input_tokens}")

        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
            raw = re.sub(r"\n?```\s*$", "", raw)
        result = json.loads(raw.strip())

        if "citation_accurate" not in result:
            result["citation_accurate"] = check_citation(response, question.get("manual_page", 0))
        if "tone" not in result:
            result["tone"] = 1

        return result

    except Exception as e:
        print(f"❌ Judge error for {question['id']}: {e}")
        print(f"   Full response (for debugging):")
        print(f"   {response}")
        print("-" * 80)
        
        return {
            "technical_accuracy": 0,
            "tool_routing": 0,
            "multimodal": 0,
            "citation_accurate": False,
            "tone": 0,
            "reasoning": f"Judge failed: {str(e)}",
            "hallucination_detected": True,
        }


def format_score(scores: dict) -> str:
    total = scores["technical_accuracy"] + scores["tool_routing"] + scores["multimodal"]
    flag = " ⚠ HALLUCINATION" if scores.get("hallucination_detected") else ""
    cite = " ©" if scores.get("citation_accurate") else ""
    artifact = scores.get("artifact_correct")
    art = " ▣" if artifact is True else (" □" if artifact is False else "")
    tone = scores.get("tone")
    tone_str = f" T{tone}" if tone is not None else ""
    params = scores.get("tool_params_correct")
    params_str = " P✓" if params is True else (" P✗" if params is False else "")
    return f"{total}/7 (acc={scores['technical_accuracy']}/3 route={scores['tool_routing']}/2 mm={scores['multimodal']}/2){art}{cite}{tone_str}{params_str}{flag}"


def check_data_integrity_status() -> None:
    data_dir = ROOT / "data"
    data_files = list(data_dir.glob("*.json")) + list((data_dir / "chunks").glob("*.md"))

    if not FLAG_PATH.exists():
        print("⚠ WARNING: Data integrity flag file '.data_integrity_passed' does not exist.", file=sys.stderr)
        print("Run 'python eval_data.py' to verify ingestion structure.", file=sys.stderr)
        print("─" * 90)
        return

    flag_mtime = FLAG_PATH.stat().st_mtime
    outdated_files = [f.name for f in data_files if f.stat().st_mtime > flag_mtime]
    if outdated_files:
        print("⚠ WARNING: Data files modified since last integrity check:", file=sys.stderr)
        print(f"  {', '.join(outdated_files)}", file=sys.stderr)
        print("Re-run 'python eval_data.py' before continuing.", file=sys.stderr)
        print("─" * 90)


def run_eval(
    ids: list[str] | None = None,
    category: str | None = None,
    no_judge: bool = False,
    quick: bool = False,
    judge_only: bool = False,
) -> list[dict]:
    """Run the eval and return results. Prints a formatted table to stdout."""
    dataset: list[dict] = json.loads(DATASET_PATH.read_text())

    if ids:
        dataset = [q for q in dataset if q["id"] in ids]
    if category:
        dataset = [q for q in dataset if q["category"] == category]
    if quick:
        dataset = [q for q in dataset if q.get("accuracy_method") == "exact_match"]
        if not ids and not category:
            print("(--quick: running exact-match questions only)")
    if judge_only:
        dataset = [q for q in dataset if q.get("accuracy_method") == "llm_judge"]
        if not ids and not category:
            print("(--judge-only: running LLM-judge questions only)")

    needs_judge = not no_judge and any(q.get("accuracy_method") == "llm_judge" for q in dataset)
    client = anthropic.Anthropic() if needs_judge else None
    results = []

    print(f"\nRunning {len(dataset)} questions...\n")
    print(f"{'ID':<12} {'Category':<18} {'Score':<46} {'Latency'}")
    print("─" * 90)

    for q in dataset:
        session_id = f"eval_{q['id']}"
        messages = [{"role": "user", "content": q["question"]}]

        t0 = time.monotonic()
        response, tools_called, tool_calls, showed_image = collect_response(messages, session_id)
        latency_ms = int((time.monotonic() - t0) * 1000)

        is_exact = q.get("accuracy_method") == "exact_match"

        if no_judge:
            scores = {
                "technical_accuracy": 0, "tool_routing": 0, "multimodal": 0,
                "citation_accurate": False, "tone": None,
                "reasoning": "skipped", "hallucination_detected": False,
            }
        elif is_exact:
            passed, reason = check_exact_match(response, q.get("key_numbers", []))

            expected_tools = q.get("expected_tool_calls", [])
            if not expected_tools:
                tool_routing = 2
            else:
                hit_count = sum(1 for t in expected_tools if t in tools_called)
                tool_routing = 2 if hit_count == len(expected_tools) else (1 if hit_count > 0 else 0)

            multimodal = (2 if showed_image else 0) if q.get("requires_image", False) else 2

            scores = {
                "technical_accuracy": 3 if passed else 0,
                "tool_routing": tool_routing,
                "multimodal": multimodal,
                "citation_accurate": check_citation(response, q.get("manual_page", 0)),
                "tone": None,
                "reasoning": reason,
                "hallucination_detected": not passed,
            }
        else:
            if client:
                scores = judge_response(client, q, response, tools_called, tool_calls, showed_image)
            else:
                scores = {
                    "technical_accuracy": 0, "tool_routing": 0, "multimodal": 0,
                    "citation_accurate": False, "tone": None,
                    "reasoning": "Judge client not available",
                    "hallucination_detected": False,
                }

        # Artifact and param checks
        scores["artifact_correct"] = check_artifact(response, q.get("expected_artifact"))
        params_ok, params_reason = check_tool_params(tool_calls, q.get("expected_tool_inputs"))
        scores["tool_params_correct"] = params_ok
        scores["tool_params_reason"] = params_reason

        total = scores["technical_accuracy"] + scores["tool_routing"] + scores["multimodal"]

        result = {
            "id": q["id"],
            "category": q["category"],
            "accuracy_method": q.get("accuracy_method", "llm_judge"),
            "scores": scores,
            "total": total,
            "tools_called": tools_called,
            "showed_image": showed_image,
            "latency_ms": latency_ms,
            "response_preview": response[:120].replace("\n", " "),
            "full_response": response,
        }
        results.append(result)

        score_str = format_score(scores)
        pass_fail = "✓" if total >= 6 else "✗"
        method_indicator = "[E]" if is_exact else "[L]"
        print(f"{pass_fail} {q['id']:<11} {q['category']:<18} {score_str:<46} {latency_ms}ms {method_indicator}")

        if total < 6 or scores.get("hallucination_detected") or "Judge failed" in scores.get("reasoning", ""):
            print(f"   Reasoning: {scores.get('reasoning', '')}")
            print(f"   Response:  {response[:350]}...")
            if scores.get("tool_params_correct") is False:
                print(f"   Params:    {scores.get('tool_params_reason', '')}")

    _print_summary(results)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = ROOT / "eval" / f"run_{timestamp}.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nFull results → {out_path}")

    return results


def _print_summary(results: list[dict]) -> None:
    # [Your existing _print_summary function - unchanged]
    total_q = len(results)
    if total_q == 0:
        return

    passing = sum(1 for r in results if r["total"] >= 6)
    avg_score = sum(r["total"] for r in results) / total_q
    hallucinations = sum(1 for r in results if r["scores"].get("hallucination_detected"))

    exact_results = [r for r in results if r["accuracy_method"] == "exact_match"]
    llm_results = [r for r in results if r["accuracy_method"] == "llm_judge"]

    citation_results = [r for r in results if "citation_accurate" in r["scores"]]
    cited_correctly = sum(1 for r in citation_results if r["scores"].get("citation_accurate"))

    artifact_results = [r for r in results if r["scores"].get("artifact_correct") is not None]
    artifact_correct_count = sum(1 for r in artifact_results if r["scores"]["artifact_correct"])

    tone_results = [r for r in results if r["scores"].get("tone") is not None]
    avg_tone = sum(r["scores"]["tone"] for r in tone_results) / len(tone_results) if tone_results else None

    print("\n" + "─" * 90)
    print(f"Overall Results: {passing}/{total_q} passing (≥6/7)  │  avg {avg_score:.1f}/7")
    if exact_results:
        ep = sum(1 for r in exact_results if r["total"] >= 6)
        print(f"  Exact Match:  {ep}/{len(exact_results)} passing")
    if llm_results:
        lp = sum(1 for r in llm_results if r["total"] >= 6)
        print(f"  LLM Judge:    {lp}/{len(llm_results)} passing")
    if citation_results:
        print(f"  Citation acc: {cited_correctly}/{len(citation_results)} ({100*cited_correctly//len(citation_results)}%)")
    if artifact_results:
        pct = 100 * artifact_correct_count // len(artifact_results)
        print(f"  Artifact acc: {artifact_correct_count}/{len(artifact_results)} ({pct}%)")
    if tone_results:
        print(f"  Avg tone:     {avg_tone:.2f}/1")

    print("\nBy category:")
    for cat in sorted({r["category"] for r in results}):
        cat_results = [r for r in results if r["category"] == cat]
        cat_avg = sum(r["total"] for r in cat_results) / len(cat_results)
        cat_pass = sum(1 for r in cat_results if r["total"] >= 6)
        print(f"  {cat:<18} {cat_pass}/{len(cat_results)} passing, avg {cat_avg:.1f}/7")


def _report_variance(all_runs: list[list[dict]]) -> None:
    # [Your existing _report_variance function - unchanged]
    n = len(all_runs)
    print("\n" + "=" * 90)
    print(f"Variance Report ({n} runs)")
    print("=" * 90)

    question_ids = [r["id"] for r in all_runs[0]]
    unstable = []

    for qid in question_ids:
        scores_across_runs = []
        for run in all_runs:
            for r in run:
                if r["id"] == qid:
                    scores_across_runs.append(r["total"])
                    break
        if len(scores_across_runs) < 2:
            continue
        mean = statistics.mean(scores_across_runs)
        std = statistics.stdev(scores_across_runs) if len(scores_across_runs) > 1 else 0
        if std > 0:
            unstable.append((qid, mean, std, scores_across_runs))

    if unstable:
        print("\nUnstable questions:")
        for qid, mean, std, scores in sorted(unstable, key=lambda x: -x[2]):
            print(f"  {qid:<12} mean={mean:.1f}/7  std={std:.2f}  scores={scores}")
    else:
        print("\n✓ All questions scored identically across all runs.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ignis eval harness")
    parser.add_argument("--ids", nargs="+", help="Run specific question IDs")
    parser.add_argument("--category", choices=["spec", "diagnostic", "polarity_setup", "fault_code", "technique", "synergic", "complex", "adversarial", "no_info"])
    parser.add_argument("--no-judge", action="store_true")
    parser.add_argument("--quick", action="store_true")
    parser.add_argument("--judge-only", action="store_true")
    parser.add_argument("--runs", type=int, default=1)

    args = parser.parse_args()

    check_data_integrity_status()

    if args.runs > 1:
        print(f"Multi-run mode: {args.runs} runs")
        all_runs = []
        for i in range(args.runs):
            print(f"\n=== Run {i+1}/{args.runs} ===")
            results = run_eval(
                ids=args.ids,
                category=args.category,
                no_judge=args.no_judge,
                quick=args.quick,
                judge_only=args.judge_only,
            )
            all_runs.append(results)
        _report_variance(all_runs)
    else:
        run_eval(
            ids=args.ids,
            category=args.category,
            no_judge=args.no_judge,
            quick=args.quick,
            judge_only=args.judge_only,
        )


if __name__ == "__main__":
    main()