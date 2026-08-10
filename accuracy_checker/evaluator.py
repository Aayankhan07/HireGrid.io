"""
HireGrid.io scoring evaluation harness.

What changed and why
--------------------
The previous version injected a fixed `semantic_score` (80.0 for candidates it
expected to pass, 40.0 for ones it expected to fail) and then asserted the
resulting composite landed above/below a threshold. That measured arithmetic,
not the product: the semantic layer -- the component that actually decides
ranking quality -- never ran, and the pass/fail expectations were entailed by
the injected inputs. A "100% accuracy" report from that design carried no
information.

This version runs the real pipeline end to end (extraction, embeddings,
composite scoring) and evaluates what the tool is actually for: ordering
candidates correctly against a job.

Metrics
-------
Ranking quality is measured against a human-assigned relevance grade per
candidate, using the standard IR measures:

  * Precision@k -- of the top k returned, how many are genuinely relevant
  * NDCG@k      -- rewards putting the strongest candidates highest, discounted
                   by rank position
  * Kendall tau -- rank correlation between predicted and ideal ordering

Extraction accuracy (years of experience, education level, skills) is scored
separately, since a ranking error caused by a parsing failure needs a different
fix from one caused by scoring weights.

Honest limitations
------------------
The bundled benchmark is small (see BENCHMARK_SUITE) and written by hand, so it
detects regressions rather than establishing absolute accuracy. Numbers from it
should not be quoted as a general accuracy claim. To make it meaningful, grow it
toward 50+ real resume/JD pairs with independent human grading.
"""

import argparse
import json
import math
import os
import sys

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

from core.nlp_layer import extract_all  # noqa: E402
from core.rules_engine import compute_final_score, get_matched_missing_skills  # noqa: E402
from core.similarity import (  # noqa: E402
    compute_semantic_similarity,
    compute_batch_skill_similarity,
)

# Relevance grades: 3 = strong hire, 2 = worth interviewing, 1 = weak, 0 = irrelevant.
RELEVANT_THRESHOLD = 2


# ──────────────────────────────────────────────────────────────────────────────
# Benchmark data
# ──────────────────────────────────────────────────────────────────────────────

BENCHMARK_SUITE = [
    {
        "id": "backend_senior",
        "job": {
            "job_title": "Senior Python Backend Engineer",
            "job_description": (
                "We are hiring a senior backend engineer to design and operate Python "
                "microservices. You will build REST APIs with FastAPI, model data in "
                "PostgreSQL, containerise services with Docker, and run them on Kubernetes. "
                "Five or more years of professional backend experience is required."
            ),
            "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
            "required_experience_years": 5,
            "required_education": "Bachelor",
            "preferred_location": "New York",
            "preferred_languages": [],
            "required_certifications": [],
        },
        "candidates": [
            {
                "id": "alex_rivera",
                "grade": 3,
                "expect": {"experience_min": 5.0, "education": "Bachelor"},
                "resume": """
Alex Rivera
Email: alex.rivera@dev.io | Phone: +1 555-4321
Location: New York, NY

Experience
Senior Software Engineer, DataCorp (2018 - 2024)
- Designed Python microservices serving 40M requests/day.
- Built REST APIs with FastAPI and deployed them on Kubernetes.
- Owned PostgreSQL schema design, indexing and query tuning.
- Containerised the platform with Docker; ran CI/CD in GitHub Actions.

Education
Bachelor of Science in Computer Science, New York University (2014 - 2018)

Skills
Python, FastAPI, Docker, Kubernetes, PostgreSQL, Redis, Microservices, Git

Certifications
AWS Certified Solutions Architect
""",
            },
            {
                "id": "priya_menon_alias",
                "grade": 3,
                # Same competence as Alex, but written with alias spellings. This
                # candidate is the regression guard for vocabulary matching: with
                # naive exact-string matching she scores zero and is auto-rejected.
                "expect": {"experience_min": 5.0},
                "resume": """
Priya Menon
Email: priya.menon@mail.com | Phone: +44 20 7946 0958
Location: London

Experience
Lead Backend Developer, Fintech Ltd (2017 - 2024)
- Built RESTful services in Python 3 using FastAPI.
- Ran production workloads on k8s with containerisation via Docker.
- Administered Postgres clusters, including replication and failover.

Education
MSc Computer Science, University of Manchester (2015 - 2017)

Skills
Python, FastAPI, Postgres, Docker, k8s, CI/CD, Microservices
""",
            },
            {
                "id": "sam_okafor_mid",
                "grade": 2,
                "expect": {},
                "resume": """
Sam Okafor
Email: sam.okafor@mail.com
Location: Austin, TX

Experience
Backend Engineer, Retail Systems Inc (2021 - 2024)
- Developed Python services and REST APIs with Flask.
- Worked with PostgreSQL and Docker in a small platform team.

Education
Bachelor of Science in Software Engineering, University of Texas (2017 - 2021)

Skills
Python, Flask, PostgreSQL, Docker, SQL, Git
""",
            },
            {
                "id": "kevin_park_junior",
                "grade": 1,
                "expect": {"experience_max": 2.5, "education": "High School"},
                "resume": """
Kevin Park
Email: kevin.park@mail.com
Location: Chicago, IL

Experience
Junior Web Developer, Local Agency (2023 - 2024)
- Built marketing pages in HTML and CSS.
- Wrote small JavaScript widgets.

Education
High School Diploma (2019 - 2023)

Skills
HTML, CSS, JavaScript, Python
""",
            },
            {
                "id": "maria_gomez_offdomain",
                "grade": 0,
                "expect": {},
                "resume": """
Maria Gomez
Email: maria.gomez@clinic.org
Location: Madrid

Experience
Registered Nurse, Central Hospital (2015 - 2024)
- Delivered post-operative patient care on a 30-bed ward.
- Coordinated medication schedules and patient records.

Education
Bachelor of Nursing, Universidad Complutense (2011 - 2015)

Skills
Patient care, Triage, Clinical documentation
""",
            },
        ],
    },
    {
        "id": "frontend_mid",
        "job": {
            "job_title": "Frontend Engineer",
            "job_description": (
                "Join our product team to build accessible, responsive web interfaces in "
                "React and TypeScript. You will work closely with designers, own component "
                "architecture, and care about performance and accessibility."
            ),
            "required_skills": ["React", "TypeScript", "CSS"],
            "required_experience_years": 3,
            "required_education": "Any",
            "preferred_location": "",
            "preferred_languages": [],
            "required_certifications": [],
        },
        "candidates": [
            {
                "id": "dana_liu_react",
                "grade": 3,
                "expect": {},
                "resume": """
Dana Liu
Email: dana.liu@mail.com
Location: Remote

Experience
Frontend Engineer, SaaS Co (2019 - 2024)
- Built component libraries in ReactJS and TypeScript.
- Implemented responsive CSS layouts and improved Lighthouse scores.
- Led accessibility remediation to WCAG 2.1 AA.

Education
Bachelor of Arts in Design, Rhode Island School of Design (2015 - 2019)

Skills
React, TypeScript, CSS, HTML, Jest, Webpack
""",
            },
            {
                "id": "tom_becker_backend",
                "grade": 1,
                "expect": {},
                "resume": """
Tom Becker
Email: tom.becker@mail.com
Location: Berlin

Experience
Backend Engineer, Logistics GmbH (2018 - 2024)
- Built Java Spring Boot services and Kafka pipelines.
- Occasional bug fixes in an internal React admin panel.

Education
Master of Science in Informatics, TU Berlin (2016 - 2018)

Skills
Java, Spring Boot, Kafka, PostgreSQL, Docker
""",
            },
            {
                "id": "iris_novak_designer",
                "grade": 0,
                "expect": {},
                "resume": """
Iris Novak
Email: iris.novak@studio.com
Location: Prague

Experience
Graphic Designer, Print Studio (2016 - 2024)
- Produced brand identity and packaging artwork.
- Managed print production schedules.

Education
Bachelor of Fine Arts, Academy of Arts (2012 - 2016)

Skills
Photoshop, Illustrator, InDesign, Typography
""",
            },
        ],
    },
    {
        # Deliberately harder than the first two cases. It exercises two things
        # the earlier cases cannot detect:
        #
        #   1. Chunking. `deepak_rao_buried` keeps the relevant Kubernetes/Go
        #      platform work on the second page, after a long stretch of
        #      unrelated support and QA history. Scoring only the first 1500
        #      characters makes that experience invisible.
        #   2. Must-have weighting. `helen_cruz_no_k8s` is strong everywhere
        #      except the one skill marked non-negotiable, and should rank below
        #      a candidate who has it.
        "id": "platform_k8s",
        "job": {
            "job_title": "Platform Engineer",
            "job_description": (
                "Platform engineer to run our Kubernetes estate. You will operate "
                "multi-cluster Kubernetes in production, write tooling in Go, manage "
                "infrastructure as code with Terraform, and own the CI/CD platform "
                "other engineering teams build on. Kubernetes experience is essential."
            ),
            "required_skills": ["Kubernetes", "Go", "Terraform", "CI/CD"],
            "skill_weights": {"Kubernetes": 2.0, "Go": 1.0, "Terraform": 1.0, "CI/CD": 0.5},
            "required_experience_years": 4,
            "required_education": "Any",
            "preferred_location": "",
            "preferred_languages": [],
            "required_certifications": [],
        },
        "candidates": [
            {
                "id": "deepak_rao_buried",
                "grade": 3,
                "expect": {},
                "resume": """
Deepak Rao
Email: deepak.rao@mail.com
Location: Remote

Summary
Infrastructure specialist with a long support background who moved into platform work.

Experience
IT Support Analyst, Regional Health Trust (2014 - 2017)
- Handled tier-1 and tier-2 desktop support tickets for 900 staff.
- Managed printer fleets, imaging, and Active Directory account provisioning.
- Wrote knowledge base articles and ran onboarding sessions for new starters.
- Maintained asset inventory spreadsheets and coordinated hardware refreshes.

QA Analyst, Regional Health Trust (2017 - 2019)
- Executed manual regression suites for an internal scheduling application.
- Logged defects, triaged severity, and coordinated with offshore vendors.
- Produced weekly test reports and release sign-off documentation.
- Maintained a library of test cases and shared fixtures across teams.

Service Delivery Coordinator, Meridian Systems (2019 - 2020)
- Coordinated change requests and maintenance windows across three sites.
- Chaired incident reviews and tracked remediation actions to closure.

Platform Engineer, Northwind Cloud (2020 - 2024)
- Operated 12 production Kubernetes clusters across three regions.
- Wrote cluster automation and admission controllers in Go.
- Managed all infrastructure as code using Terraform modules.
- Owned the CI/CD platform used by 40 engineers, including runner autoscaling.

Education
BSc Information Systems, Open University (2010 - 2014)

Skills
Kubernetes, Go, Terraform, CI/CD, Helm, Prometheus, Linux
""",
            },
            {
                "id": "helen_cruz_no_k8s",
                "grade": 1,
                "expect": {},
                # Strong on everything except the must-have. Should rank below
                # Deepak because Kubernetes is marked non-negotiable.
                "resume": """
Helen Cruz
Email: helen.cruz@mail.com
Location: Remote

Experience
Infrastructure Engineer, Blue Harbour (2018 - 2024)
- Built extensive Terraform modules for a large AWS estate.
- Wrote internal tooling and CLIs in Go.
- Owned Jenkins and GitHub Actions CI/CD pipelines for 20 services.
- Ran workloads on EC2 and ECS; no Kubernetes exposure.

Education
BSc Computer Science, University of Leeds (2014 - 2018)

Skills
Terraform, Go, CI/CD, AWS, Jenkins, Linux, Bash
""",
            },
            {
                "id": "owen_fields_offdomain",
                "grade": 0,
                "expect": {},
                "resume": """
Owen Fields
Email: owen.fields@mail.com
Location: Bristol

Experience
Account Manager, Trident Media (2016 - 2024)
- Managed a portfolio of 40 advertising clients.
- Negotiated annual contracts and upsell campaigns.

Education
BA Marketing, University of Bristol (2012 - 2016)

Skills
Negotiation, Client Relations, Salesforce, Presentations
""",
            },
        ],
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# Metrics
# ──────────────────────────────────────────────────────────────────────────────

def precision_at_k(ordered_grades: list, k: int) -> float:
    """
    Precision@k, capped by the number of relevant candidates available.

    Plain P@k is misleading on small cases: if a job has only one relevant
    candidate, perfect ranking still scores 0.33 at k=3, which reads as a
    scoring failure when it is really a property of the dataset. Dividing by
    min(k, relevant_total) means a perfect ranking scores 1.0.
    """
    top = ordered_grades[:k]
    if not top:
        return 0.0
    relevant_total = sum(1 for g in ordered_grades if g >= RELEVANT_THRESHOLD)
    if relevant_total == 0:
        return 0.0
    denominator = min(k, relevant_total, len(ordered_grades))
    return sum(1 for g in top if g >= RELEVANT_THRESHOLD) / denominator


def dcg(grades: list) -> float:
    return sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(grades))


def ndcg_at_k(ordered_grades: list, k: int) -> float:
    actual = dcg(ordered_grades[:k])
    ideal = dcg(sorted(ordered_grades, reverse=True)[:k])
    return actual / ideal if ideal > 0 else 0.0


def kendall_tau(ordered_grades: list) -> float:
    """Rank correlation between the produced ordering and the ideal ordering."""
    n = len(ordered_grades)
    if n < 2:
        return 1.0
    concordant = discordant = 0
    for i in range(n):
        for j in range(i + 1, n):
            # Ranked earlier should have a grade >= one ranked later.
            if ordered_grades[i] > ordered_grades[j]:
                concordant += 1
            elif ordered_grades[i] < ordered_grades[j]:
                discordant += 1
    total = concordant + discordant
    return (concordant - discordant) / total if total else 1.0


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline
# ──────────────────────────────────────────────────────────────────────────────

def score_candidate(resume_text: str, job: dict) -> dict:
    """Run the real production path: extraction, embeddings, composite score."""
    req_skills = job["required_skills"]
    lexicon = {s.lower() for s in req_skills} | {
        "python", "fastapi", "docker", "postgresql", "kubernetes", "redis", "git",
        "react", "typescript", "css", "html", "javascript", "jest", "webpack",
        "java", "spring boot", "kafka", "flask", "sql", "microservices", "ci/cd",
        "photoshop", "illustrator",
        "go", "golang", "terraform", "helm", "prometheus", "linux", "aws",
        "jenkins", "bash", "salesforce",
    }
    skill_weights = job.get("skill_weights")

    extracted = extract_all(resume_text, lexicon)
    # Chunks, not the leading excerpt: this is the production path, and the
    # difference is exactly what the platform_k8s case is designed to catch.
    semantic = compute_semantic_similarity(
        job["job_description"], extracted["summary"], extracted.get("chunks")
    )
    skill_sim = compute_batch_skill_similarity(
        req_skills, extracted["skills"], extracted["summary"], skill_weights=skill_weights
    )
    scoring = compute_final_score(extracted, job, semantic, skill_sim)
    matched, missing = get_matched_missing_skills(req_skills, extracted["skills"])

    return {
        "score": scoring["final_score"],
        "semantic": semantic,
        "skill_similarity": skill_sim,
        "matched_skills": matched,
        "missing_skills": missing,
        "missing_must_haves": scoring.get("missing_must_haves", []),
        "extracted": extracted,
    }


def check_extraction(extracted: dict, expect: dict) -> list:
    """Compare extracted fields against hand-labelled expectations."""
    problems = []
    if "experience_min" in expect and extracted["experience"] < expect["experience_min"]:
        problems.append(
            f"experience {extracted['experience']} < expected min {expect['experience_min']}"
        )
    if "experience_max" in expect and extracted["experience"] > expect["experience_max"]:
        problems.append(
            f"experience {extracted['experience']} > expected max {expect['experience_max']}"
        )
    if "education" in expect and extracted["education"] != expect["education"]:
        problems.append(
            f"education {extracted['education']!r} != expected {expect['education']!r}"
        )
    return problems


def run_benchmark(verbose: bool = True) -> dict:
    case_reports = []
    extraction_checks = extraction_failures = 0

    for case in BENCHMARK_SUITE:
        job = case["job"]
        if verbose:
            print(f"\n=== {case['id']}: {job['job_title']} ===")

        scored = []
        for cand in case["candidates"]:
            result = score_candidate(cand["resume"], job)
            scored.append({
                "id": cand["id"],
                "grade": cand["grade"],
                "score": result["score"],
                "semantic": result["semantic"],
                "skill_similarity": result["skill_similarity"],
                "matched_skills": result["matched_skills"],
            })

            problems = check_extraction(result["extracted"], cand.get("expect", {}))
            extraction_checks += len(cand.get("expect", {}))
            extraction_failures += len(problems)

            if verbose:
                print(
                    f"  {cand['id']:<26} grade={cand['grade']}  score={result['score']:6.2f}  "
                    f"semantic={result['semantic']:5.1f}  skills={result['skill_similarity']:5.1f}  "
                    f"matched={result['matched_skills']}"
                )
                for p in problems:
                    print(f"      extraction issue: {p}")

        scored.sort(key=lambda c: c["score"], reverse=True)
        ordered_grades = [c["grade"] for c in scored]

        metrics = {
            "precision_at_1": round(precision_at_k(ordered_grades, 1), 3),
            "precision_at_3": round(precision_at_k(ordered_grades, 3), 3),
            "ndcg_at_3": round(ndcg_at_k(ordered_grades, 3), 3),
            "ndcg_full": round(ndcg_at_k(ordered_grades, len(ordered_grades)), 3),
            "kendall_tau": round(kendall_tau(ordered_grades), 3),
        }

        if verbose:
            print(f"  ranking: {' > '.join(c['id'] for c in scored)}")
            print(f"  metrics: {metrics}")

        case_reports.append({
            "id": case["id"],
            "job_title": job["job_title"],
            "ranking": [
                {"id": c["id"], "grade": c["grade"], "score": c["score"]} for c in scored
            ],
            "metrics": metrics,
        })

    def mean(key):
        return round(sum(c["metrics"][key] for c in case_reports) / len(case_reports), 3)

    extraction_accuracy = (
        round((extraction_checks - extraction_failures) / extraction_checks, 3)
        if extraction_checks else None
    )

    report = {
        "note": (
            "Small hand-written benchmark: use for regression detection, not as an "
            "absolute accuracy claim. See module docstring."
        ),
        "cases_evaluated": len(case_reports),
        "candidates_evaluated": sum(len(c["candidates"]) for c in BENCHMARK_SUITE),
        "ranking_metrics": {
            "mean_precision_at_1": mean("precision_at_1"),
            "mean_precision_at_3": mean("precision_at_3"),
            "mean_ndcg_at_3": mean("ndcg_at_3"),
            "mean_ndcg_full": mean("ndcg_full"),
            "mean_kendall_tau": mean("kendall_tau"),
        },
        "extraction": {
            "checks": extraction_checks,
            "failures": extraction_failures,
            "accuracy": extraction_accuracy,
        },
        "cases": case_reports,
    }

    if verbose:
        print("\n" + "-" * 60)
        print("Aggregate ranking metrics:")
        for k, v in report["ranking_metrics"].items():
            print(f"  {k:<24} {v}")
        print(f"  extraction_accuracy      {extraction_accuracy}")
        print("-" * 60)

    return report


def main():
    parser = argparse.ArgumentParser(description="HireGrid.io scoring evaluation harness")
    parser.add_argument(
        "--min-ndcg", type=float, default=None,
        help="Exit non-zero if mean NDCG@3 falls below this value (for CI gating).",
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress per-candidate output.")
    args = parser.parse_args()

    report = run_benchmark(verbose=not args.quiet)

    report_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "accuracy_report.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport written to {report_file}")

    if args.min_ndcg is not None:
        actual = report["ranking_metrics"]["mean_ndcg_at_3"]
        if actual < args.min_ndcg:
            print(f"FAIL: mean NDCG@3 {actual} is below the required {args.min_ndcg}")
            return 1
        print(f"PASS: mean NDCG@3 {actual} >= {args.min_ndcg}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
