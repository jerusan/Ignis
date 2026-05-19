#!/usr/bin/env python3
"""
Ignis eval harness — runs 20 ground-truth questions through the agent
and scores responses using Claude as judge.

Run from repo root:
    python eval.py

Options:
    python eval.py --ids spec_01 spec_02      (run specific questions)
    python eval.py --category spec             (run a category)
    python eval.py --no-judge                  (skip LLM judge, just collect responses)

Scoring rubric per question (max 7):
    technical_accuracy  0–3  (0 = hallucinated spec number)
    tool_routing        0–2  (correct tools called)
    multimodal          0–2  (image shown when requires_image=True)

Target: >= 6/7 per question.
"""

import sys
import json
import time
import argparse
import textwrap
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env", override=True)
sys.path.insert(0, str(ROOT))

import anthropic  # noqa: E402 — after load_dotenv
from backend.agent import run_agent  # noqa: E402

DATASET_PATH = ROOT / "eval" / "golden_dataset.json"

JUDGE_SYSTEM = """\
You are evaluating an AI assistant's response to a question about the Vulcan OmniPro 220 multiprocess welder.
Score the response on three dimensions. Return ONLY valid JSON, no other text."""

JUDGE_PROMPT = """\
Question: {question}

Ground truth answer: {ground_truth}

Key numbers that must be correct (if present): {key_numbers}

Agent's response: {response}

Tools the agent called: {tools_called}
Expected tools: {expected_tools}
Requires image/visual: {requires_image}
Agent showed an image: {showed_image}

Score on these three dimensions:

1. technical_accuracy (0-3):
   - 3: All facts correct, all key numbers exactly right, no hallucinations
   - 2: Mostly correct with minor omissions, no wrong numbers
   - 1: Partially correct but missing key information or has one error
   - 0: Contains any hallucinated spec number OR is completely wrong
   IMPORTANT: If key_numbers is non-empty and ANY listed number is wrong or missing, max score is 1.

2. tool_routing (0-2):
   - 2: Called all expected tools
   - 1: Called some expected tools but missed one
   - 0: Called wrong tools or no tools at all

3. multimodal (0-2):
   Only score this dimension if requires_image is true.
   - 2: Showed a relevant image/diagram (showed_image is true)
   - 1: Referenced or described a visual but didn't show the actual image
   - 0: No visual content at all when one was required
   If requires_image is false, set multimodal to 2 (full credit, not applicable).

Return exactly this JSON:
{{
  "technical_accuracy": <0-3>,
  "tool_routing": <0-2>,
  "multimodal": <0-2>,
  "reasoning": "<one sentence explanation>",
  "hallucination_detected": <true|false>
}}"""


def collect_response(messages: list[dict], session_id: str) -> tuple[str, list[str], bool]:
    """Run agent, return (full_text, tools_called, showed_image)."""
    text_parts: list[str] = []
    tools_called: list[str] = []
    showed_image = False

    for event in run_agent(messages, session_id):
        if event["type"] == "text_delta":
            text_parts.append(event["text"])
        elif event["type"] == "tool_use":
            tools_called.append(event["name"])
        elif event["type"] == "tool_result":
            content = event.get("content", "")
            if isinstance(content, str) and "assets/" in content:
                showed_image = True
        elif event["type"] == "done":
            break

    full_text = "".join(text_parts)
    # Also check if the response text references an image URL
    if "assets/" in full_text or "image_id" in full_text or "/assets/" in full_text:
        showed_image = True

    return full_text, tools_called, showed_image


def judge_response(
    client: anthropic.Anthropic,
    question: dict,
    response: str,
    tools_called: list[str],
    showed_image: bool,
) -> dict:
    prompt = JUDGE_PROMPT.format(
        question=question["question"],
        ground_truth=question["ground_truth"],
        key_numbers=json.dumps(question.get("key_numbers", [])),
        response=response[:2000],
        tools_called=json.dumps(tools_called),
        expected_tools=json.dumps(question.get("expected_tool_calls", [])),
        requires_image=question.get("requires_image", False),
        showed_image=showed_image,
    )
    resp = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        system=JUDGE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        return json.loads(resp.content[0].text)
    except json.JSONDecodeError:
        return {
            "technical_accuracy": 0,
            "tool_routing": 0,
            "multimodal": 0,
            "reasoning": "Failed to parse judge response",
            "hallucination_detected": False,
        }


def format_score(scores: dict) -> str:
    total = scores["technical_accuracy"] + scores["tool_routing"] + scores["multimodal"]
    flag = " ⚠ HALLUCINATION" if scores.get("hallucination_detected") else ""
    return f"{total}/7 (acc={scores['technical_accuracy']}/3 route={scores['tool_routing']}/2 mm={scores['multimodal']}/2){flag}"


def run_eval(ids: list[str] | None = None, category: str | None = None, no_judge: bool = False) -> None:
    dataset: list[dict] = json.loads(DATASET_PATH.read_text())

    if ids:
        dataset = [q for q in dataset if q["id"] in ids]
    if category:
        dataset = [q for q in dataset if q["category"] == category]

    client = anthropic.Anthropic() if not no_judge else None
    results = []

    print(f"\nRunning {len(dataset)} questions...\n")
    print(f"{'ID':<12} {'Category':<18} {'Score':<40} {'Latency'}")
    print("─" * 90)

    for q in dataset:
        session_id = f"eval_{q['id']}"
        messages = [{"role": "user", "content": q["question"]}]

        t0 = time.monotonic()
        response, tools_called, showed_image = collect_response(messages, session_id)
        latency_ms = int((time.monotonic() - t0) * 1000)

        if not no_judge and client:
            scores = judge_response(client, q, response, tools_called, showed_image)
        else:
            scores = {"technical_accuracy": 0, "tool_routing": 0, "multimodal": 0, "reasoning": "skipped", "hallucination_detected": False}

        total = scores["technical_accuracy"] + scores["tool_routing"] + scores["multimodal"]
        result = {
            "id": q["id"],
            "category": q["category"],
            "scores": scores,
            "total": total,
            "tools_called": tools_called,
            "showed_image": showed_image,
            "latency_ms": latency_ms,
            "response_preview": response[:120].replace("\n", " "),
        }
        results.append(result)

        score_str = format_score(scores)
        pass_fail = "✓" if total >= 6 else "✗"
        print(f"{pass_fail} {q['id']:<11} {q['category']:<18} {score_str:<40} {latency_ms}ms")
        if total < 6:
            print(f"   Reasoning: {scores.get('reasoning', '')}")
            print(f"   Response:  {result['response_preview']}")

    # Summary
    passing = sum(1 for r in results if r["total"] >= 6)
    avg_score = sum(r["total"] for r in results) / len(results) if results else 0
    hallucinations = sum(1 for r in results if r["scores"].get("hallucination_detected"))

    print("\n" + "─" * 90)
    print(f"Results: {passing}/{len(results)} passing (≥6/7)")
    print(f"Average score: {avg_score:.1f}/7")
    if hallucinations:
        print(f"⚠  Hallucinations detected: {hallucinations}")
    else:
        print("✓  No hallucinations detected")

    # By category
    print("\nBy category:")
    for cat in sorted({r["category"] for r in results}):
        cat_results = [r for r in results if r["category"] == cat]
        cat_avg = sum(r["total"] for r in cat_results) / len(cat_results)
        cat_pass = sum(1 for r in cat_results if r["total"] >= 6)
        print(f"  {cat:<18} {cat_pass}/{len(cat_results)} passing, avg {cat_avg:.1f}/7")

    # Save results
    out_path = ROOT / "eval" / "last_run.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nFull results → {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ignis eval harness")
    parser.add_argument("--ids", nargs="+", help="Run specific question IDs")
    parser.add_argument("--category", choices=["spec", "diagnostic", "polarity_setup"], help="Run a category")
    parser.add_argument("--no-judge", action="store_true", help="Skip LLM judge (collect responses only)")
    args = parser.parse_args()

    run_eval(ids=args.ids, category=args.category, no_judge=args.no_judge)


if __name__ == "__main__":
    main()
