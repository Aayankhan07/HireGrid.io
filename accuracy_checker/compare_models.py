"""
Compare embedding models on this repo's benchmark.

The embedding model carries 40% of the composite score, so swapping it is the
highest-leverage change available — and the easiest to get wrong. A model with
better public benchmark numbers is not automatically better here: MTEB measures
retrieval over web passages, while this system ranks resumes against a job
description, which is a different task with a different score distribution.

Measured example: bge-small-en-v1.5 scores higher than all-MiniLM-L6-v2 on MTEB,
but on this benchmark it compressed the usable range badly. An off-domain nurse
resume scored 0.52 cosine against a backend engineering JD (MiniLM: 0.10), and
it inverted the top two candidates. That is why MiniLM remains the default.

Run this before changing EMBEDDING_MODEL, and judge on ranking quality
(NDCG, Kendall tau) plus separation — not on the model's reputation.

Usage:
    python accuracy_checker/compare_models.py
    python accuracy_checker/compare_models.py --models all-MiniLM-L6-v2 BAAI/bge-small-en-v1.5
"""

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DEFAULT_MODELS = [
    "all-MiniLM-L6-v2",
    "BAAI/bge-small-en-v1.5",
]


def run_for_model(model_name: str) -> dict:
    """
    Run the benchmark in a subprocess with EMBEDDING_MODEL set.

    A subprocess is required: core.similarity loads the model and reads its
    calibration at import time, so switching models in-process would reuse the
    first model's settings.
    """
    env = dict(os.environ)
    env["EMBEDDING_MODEL"] = model_name
    env["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"

    report_path = os.path.join(HERE, "accuracy_report.json")
    backup = None
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            backup = f.read()

    try:
        proc = subprocess.run(
            [sys.executable, os.path.join(HERE, "evaluator.py"), "--quiet"],
            env=env,
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=1800,
        )
        if proc.returncode != 0:
            return {"error": (proc.stderr or proc.stdout or "").strip()[:400]}

        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except subprocess.TimeoutExpired:
        return {"error": "timed out"}
    except Exception as e:
        return {"error": str(e)[:400]}
    finally:
        # Leave the committed report as the default model produced it.
        if backup is not None:
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(backup)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=DEFAULT_MODELS)
    args = parser.parse_args()

    results = {}
    for name in args.models:
        print(f"Evaluating {name} ...", flush=True)
        results[name] = run_for_model(name)

    rows = []
    for name, report in results.items():
        if "error" in report:
            print(f"\n  {name}: FAILED — {report['error']}")
            continue
        m = report["ranking_metrics"]
        rows.append((
            name,
            m["mean_ndcg_at_3"],
            m["mean_precision_at_1"],
            m["mean_kendall_tau"],
            report["extraction"]["accuracy"],
        ))

    if not rows:
        print("\nNo model completed successfully.")
        return 1

    print()
    header = f"{'model':<30} {'NDCG@3':>8} {'P@1':>7} {'tau':>7} {'extract':>8}"
    print(header)
    print("-" * len(header))
    for name, ndcg, p1, tau, extract in rows:
        print(f"{name:<30} {ndcg:>8.3f} {p1:>7.3f} {tau:>7.3f} {extract:>8.3f}")

    best = max(rows, key=lambda r: (r[1], r[3]))
    print(f"\nHighest NDCG@3: {best[0]}")

    if all(abs(r[1] - rows[0][1]) < 1e-9 for r in rows):
        print(
            "\nAll models tied. The benchmark is too small or too easy to\n"
            "separate them — this is not evidence that they are equivalent.\n"
            "Grow accuracy_checker/evaluator.py's BENCHMARK_SUITE with harder,\n"
            "human-graded cases before making a decision on these numbers."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
