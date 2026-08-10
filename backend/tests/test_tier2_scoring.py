"""
Tests for the accuracy work: section chunking, skill importance weighting,
negation handling, and the configurable embedding model.

These target behaviours that the ranking benchmark cannot isolate. The benchmark
tells you whether the end-to-end ordering is right; these tell you *why*, and
they fail loudly when a specific mechanism breaks.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.nlp_layer import (  # noqa: E402
    split_into_chunks,
    extract_skills,
    extract_skills_with_density,
    extract_all,
)
from core.skill_weights import (  # noqa: E402
    parse_skill_weights,
    missing_must_haves,
    get_must_have_skills,
    format_weight_label,
    WEIGHT_MUST_HAVE,
    WEIGHT_STANDARD,
    WEIGHT_NICE_TO_HAVE,
    MISSING_MUST_HAVE_CAP,
)
from core.rules_engine import (  # noqa: E402
    calculate_weighted_skills_score,
    compute_final_score,
)


# ── Section chunking ──────────────────────────────────────────────────────────

def test_split_produces_multiple_chunks_for_sectioned_resume():
    resume = """Jane Doe
Senior Engineer

Summary
Backend specialist with a decade of platform experience across several domains.

Experience
Platform Engineer, Acme (2020 - 2024)
- Operated Kubernetes clusters in production across three regions.
- Wrote automation tooling in Go and managed Terraform modules.

Education
BSc Computer Science, Some University (2012 - 2016)
"""
    chunks = split_into_chunks(resume)
    assert len(chunks) > 1
    joined = " ".join(chunks).lower()
    assert "kubernetes" in joined
    assert "bsc computer science" in joined


def test_chunking_preserves_content_beyond_the_old_1500_char_cutoff():
    """
    The regression this whole change exists to prevent: content past the first
    1500 characters used to be invisible to the semantic layer.
    """
    filler = "\n".join(
        f"- Handled routine support ticket number {i} for internal users." for i in range(60)
    )
    resume = f"""Deepak Rao

Experience
IT Support Analyst, Old Corp (2014 - 2019)
{filler}

Platform Engineer, Northwind (2020 - 2024)
- Operated Kubernetes clusters and wrote Go tooling.
"""
    assert len(resume) > 1500
    assert "kubernetes" not in resume[:1500].lower(), "fixture must bury the signal"

    chunks = split_into_chunks(resume)
    assert any("kubernetes" in c.lower() for c in chunks)


def test_chunks_respect_max_size():
    resume = "Experience\n" + ("word " * 4000)
    for chunk in split_into_chunks(resume, max_chars=500):
        assert len(chunk) <= 500


def test_split_handles_empty_and_headingless_text():
    assert split_into_chunks("") == []
    assert split_into_chunks("   ") == []
    chunks = split_into_chunks("Just a single line of prose with no headings at all.")
    assert len(chunks) == 1


def test_extract_all_exposes_chunks():
    extracted = extract_all("Experience\nBuilt services in Python and Docker.\n")
    assert "chunks" in extracted
    assert isinstance(extracted["chunks"], list)
    assert extracted["chunks"]


# ── Skill weighting ───────────────────────────────────────────────────────────

def test_parse_skill_weights_reads_markers_and_strips_them():
    names, weights = parse_skill_weights("Python!, PostgreSQL, Jira?")
    assert names == ["Python", "PostgreSQL", "Jira"]
    assert weights["Python"] == WEIGHT_MUST_HAVE
    assert weights["PostgreSQL"] == WEIGHT_STANDARD
    assert weights["Jira"] == WEIGHT_NICE_TO_HAVE


def test_parse_skill_weights_accepts_a_list():
    names, weights = parse_skill_weights(["Go!", " Terraform "])
    assert names == ["Go", "Terraform"]
    assert weights["Go"] == WEIGHT_MUST_HAVE


def test_parse_skill_weights_is_backward_compatible():
    """An unmarked list must behave exactly as it did before weighting existed."""
    names, weights = parse_skill_weights("Python, FastAPI, Docker")
    assert names == ["Python", "FastAPI", "Docker"]
    assert set(weights.values()) == {WEIGHT_STANDARD}


def test_parse_skill_weights_ignores_blanks_and_bare_markers():
    names, _ = parse_skill_weights("Python, , !, ?, Docker")
    assert names == ["Python", "Docker"]


def test_weighted_score_favours_must_have_over_nice_to_have():
    required = ["Kubernetes", "Jira"]
    weights = {"Kubernetes": WEIGHT_MUST_HAVE, "Jira": WEIGHT_NICE_TO_HAVE}

    has_must = calculate_weighted_skills_score(required, ["Kubernetes"], weights)
    has_nice = calculate_weighted_skills_score(required, ["Jira"], weights)

    assert has_must > has_nice
    assert has_must == pytest.approx(80.0)   # 2.0 / 2.5
    assert has_nice == pytest.approx(20.0)   # 0.5 / 2.5


def test_weighted_score_matches_unweighted_when_no_weights_given():
    required = ["Python", "Docker"]
    candidate = ["Python"]
    assert calculate_weighted_skills_score(required, candidate, None) == pytest.approx(50.0)


def test_missing_must_haves_uses_canonical_names():
    weights = {"Kubernetes": WEIGHT_MUST_HAVE}
    # "k8s" is the same skill; it must not be reported as missing.
    assert missing_must_haves(weights, ["k8s"]) == []
    assert missing_must_haves(weights, ["Terraform"]) == ["Kubernetes"]


def test_get_must_have_skills_and_labels():
    weights = {"A": WEIGHT_MUST_HAVE, "B": WEIGHT_STANDARD, "C": WEIGHT_NICE_TO_HAVE}
    assert get_must_have_skills(weights) == ["A"]
    assert format_weight_label(WEIGHT_MUST_HAVE) == "must-have"
    assert format_weight_label(WEIGHT_STANDARD) == "standard"
    assert format_weight_label(WEIGHT_NICE_TO_HAVE) == "nice-to-have"


def _platform_candidate(skills):
    return {
        "skills": skills,
        "skills_density": {s: 2 for s in skills},
        "experience": 6,
        "education": "Bachelor",
        "certifications": [],
        "location": "Remote",
        "languages": [],
    }


def test_missing_must_have_caps_the_skills_subscore():
    job = {
        "job_title": "Platform Engineer",
        "required_skills": ["Kubernetes", "Go", "Terraform"],
        "skill_weights": {"Kubernetes": WEIGHT_MUST_HAVE, "Go": 1.0, "Terraform": 1.0},
        "required_experience_years": 4,
        "required_education": "Any",
    }
    result = compute_final_score(
        _platform_candidate(["Go", "Terraform"]),
        job,
        semantic_score=80.0,
        # Deliberately maxed: without the cap, a perfect semantic skill score
        # would hide the fact that the non-negotiable skill is absent.
        skill_similarity_score=100.0,
    )

    assert result["missing_must_haves"] == ["Kubernetes"]
    assert result["breakdown"]["skills"] <= MISSING_MUST_HAVE_CAP
    assert "must-have" in result["audit_log"]["skills"]


def test_candidate_with_must_have_outranks_one_without():
    job = {
        "job_title": "Platform Engineer",
        "required_skills": ["Kubernetes", "Go", "Terraform"],
        "skill_weights": {"Kubernetes": WEIGHT_MUST_HAVE, "Go": 1.0, "Terraform": 1.0},
        "required_experience_years": 4,
        "required_education": "Any",
    }
    with_k8s = compute_final_score(
        _platform_candidate(["Kubernetes", "Go", "Terraform"]), job, 80.0, 90.0
    )
    without_k8s = compute_final_score(
        _platform_candidate(["Go", "Terraform"]), job, 80.0, 90.0
    )
    assert with_k8s["final_score"] > without_k8s["final_score"]


def test_no_weights_means_no_cap_and_no_must_haves():
    job = {
        "job_title": "Engineer",
        "required_skills": ["Kubernetes", "Go"],
        "required_experience_years": 0,
        "required_education": "Any",
    }
    result = compute_final_score(_platform_candidate(["Go"]), job, 80.0, 80.0)
    assert result["missing_must_haves"] == []


# ── Negation handling ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("sentence", [
    "Ran workloads on ECS; no Kubernetes exposure.",
    "No direct Kubernetes experience.",
    "Looking to learn Kubernetes in my next role.",
    "Limited Kubernetes exposure to date.",
])
def test_negated_skill_is_not_extracted(sentence):
    assert extract_skills(sentence, {"kubernetes"}) == []


def test_positive_mention_is_still_extracted():
    assert extract_skills("Operated Kubernetes clusters in production.", {"kubernetes"}) == ["kubernetes"]


def test_negation_does_not_leak_across_sentences():
    """A negation about one skill must not suppress a later, unrelated claim."""
    text = "No Terraform experience. Operated Kubernetes clusters daily."
    found = extract_skills(text, {"kubernetes", "terraform"})
    assert "kubernetes" in found
    assert "terraform" not in found


def test_skill_claimed_elsewhere_survives_a_single_negation():
    text = "No Kubernetes at my last role.\nOperated Kubernetes clusters at Northwind."
    assert extract_skills(text, {"kubernetes"}) == ["kubernetes"]


def test_density_excludes_negated_mentions():
    text = "No Kubernetes exposure. Kubernetes was not used."
    assert extract_skills_with_density(text, {"kubernetes"}).get("kubernetes", 0) == 0


# ── Model configuration ───────────────────────────────────────────────────────

def test_model_registry_entries_are_complete():
    from core.similarity import MODEL_REGISTRY

    required_keys = {
        "semantic_floor", "semantic_ceiling",
        "skill_floor", "skill_ceiling",
        "query_prefix", "normalize",
    }
    for name, cfg in MODEL_REGISTRY.items():
        assert required_keys <= set(cfg), f"{name} is missing calibration keys"
        assert cfg["semantic_ceiling"] > cfg["semantic_floor"], name
        assert cfg["skill_ceiling"] > cfg["skill_floor"], name


def test_active_calibration_comes_from_the_registry():
    from core.similarity import (
        MODEL_NAME, MODEL_REGISTRY, SEMANTIC_FLOOR, SEMANTIC_CEILING,
    )

    if MODEL_NAME in MODEL_REGISTRY and "SEMANTIC_FLOOR" not in os.environ:
        assert SEMANTIC_FLOOR == MODEL_REGISTRY[MODEL_NAME]["semantic_floor"]
        assert SEMANTIC_CEILING == MODEL_REGISTRY[MODEL_NAME]["semantic_ceiling"]


def test_chunked_similarity_beats_truncated_for_buried_experience():
    """
    End-to-end proof of the chunking fix: a resume whose relevant experience is
    buried past the truncation point must score higher when chunks are used.
    """
    from core.similarity import compute_semantic_similarity

    jd = (
        "Platform engineer to operate production Kubernetes clusters, write Go "
        "tooling, and manage Terraform infrastructure as code."
    )
    filler = "\n".join(
        f"- Handled routine desktop support ticket {i} and updated the asset log."
        for i in range(60)
    )
    resume = f"""Deepak Rao

Experience
IT Support Analyst, Old Corp (2014 - 2019)
{filler}

Platform Engineer, Northwind (2020 - 2024)
- Operated 12 production Kubernetes clusters and wrote Go automation tooling.
- Managed all infrastructure as code with Terraform.
"""
    truncated = resume[:1500]
    chunks = split_into_chunks(resume)

    old_way = compute_semantic_similarity(jd, truncated)
    new_way = compute_semantic_similarity(jd, resume, chunks)

    assert new_way > old_way, (
        f"chunking should surface buried experience (old={old_way}, new={new_way})"
    )
