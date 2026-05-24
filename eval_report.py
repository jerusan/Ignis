#!/usr/bin/env python3
"""
Run the full eval N times and print README-ready markdown.

Usage:
    python eval_report.py            # 3 runs (default)
    python eval_report.py --runs 5
"""

import sys
import argparse
import statistics
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env", override=True)

from eval import run_eval


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-run eval report for README")
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()

    print(f"Running {args.runs} full eval passes ({args.runs * 53}~ agent calls)...\n")

    all_runs: list[list[dict]] = []
    for i in range(args.runs):
        print(f"\n=== Run {i + 1}/{args.runs} ===")
        all_runs.append(run_eval())

    n_questions = len(all_runs[0])
    qids = [r["id"] for r in all_runs[0]]

    # Per-question stats across runs
    q_stats: dict[str, dict] = {}
    for qid in qids:
        scores = []
        for run in all_runs:
            for r in run:
                if r["id"] == qid:
                    scores.append(r["total"])
                    break
        first = next(r for r in all_runs[0] if r["id"] == qid)
        q_stats[qid] = {
            "mean": statistics.mean(scores),
            "std": statistics.stdev(scores) if len(scores) > 1 else 0.0,
            "scores": scores,
            "category": first["category"],
            "method": first["accuracy_method"],
        }

    # Overall pass rate and avg score
    all_totals = [r["total"] for run in all_runs for r in run]
    overall_avg = statistics.mean(all_totals)
    per_run_pass = [
        sum(1 for r in run if r["total"] >= 6) / len(run) for run in all_runs
    ]
    avg_pass_pct = statistics.mean(per_run_pass) * 100

    # Category breakdown
    categories = sorted({r["category"] for r in all_runs[0]})
    cat_stats: dict[str, dict] = {}
    for cat in categories:
        scores, passes = [], []
        for run in all_runs:
            for r in run:
                if r["category"] == cat:
                    scores.append(r["total"])
                    passes.append(1 if r["total"] >= 6 else 0)
        n = len([r for r in all_runs[0] if r["category"] == cat])
        cat_stats[cat] = {
            "n": n,
            "avg": statistics.mean(scores),
            "pass_pct": statistics.mean(passes) * 100,
        }

    # Hallucination rate
    avg_hall = statistics.mean(
        sum(1 for r in run if r["scores"].get("hallucination_detected")) for run in all_runs
    )

    # Unstable questions (std > 0), sorted by std desc
    unstable = sorted(
        [(qid, s) for qid, s in q_stats.items() if s["std"] > 0],
        key=lambda x: -x[1]["std"],
    )

    # ── Print README markdown ────────────────────────────────────────────────
    divider = "─" * 70
    print(f"\n{divider}")
    print("README MARKDOWN  (copy everything below this line)")
    print(divider)
    print()

    date_str = datetime.now().strftime("%Y-%m-%d")
    print(f"## Eval results  ·  {date_str}")
    print()
    print(
        f"{args.runs}-run average · {n_questions} questions · "
        f"scored /7 (technical accuracy 0–3, tool routing 0–2, multimodal 0–2)"
    )
    print()
    print(f"**{avg_pass_pct:.1f}% passing (≥ 6/7) · avg {overall_avg:.2f} / 7**")
    print()

    # Category table
    print("| Category | Questions | Pass rate | Avg score |")
    print("|---|--:|--:|--:|")
    for cat in categories:
        s = cat_stats[cat]
        print(f"| `{cat}` | {s['n']} | {s['pass_pct']:.0f}% | {s['avg']:.2f} |")
    print()

    if avg_hall > 0:
        print(f"Hallucination rate: **{avg_hall:.1f}** per run  ")
        print()

    if unstable:
        print("<details>")
        print("<summary>Unstable questions (score varies across runs)</summary>")
        print()
        print("| ID | Category | Method | Mean | Std | Scores |")
        print("|---|---|---|--:|--:|---|")
        for qid, s in unstable:
            print(
                f"| `{qid}` | {s['category']} | {s['method']} "
                f"| {s['mean']:.1f} | {s['std']:.2f} | {s['scores']} |"
            )
        print()
        print("</details>")
    else:
        print("All questions scored identically across all runs. ✓")
    print()


if __name__ == "__main__":
    main()
