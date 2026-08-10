import os
# Mask potentially invalid/expired system HF tokens to prevent 401 crashes on public models
os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
os.environ["HF_TOKEN"] = ""
os.environ["HUGGING_FACE_HUB_TOKEN"] = ""

from sentence_transformers import SentenceTransformer, util
import torch

from core.skill_aliases import canonicalize_skills

# ── Model selection ───────────────────────────────────────────────────────────
# The embedding model carries 40% of the composite score, so it is the single
# highest-leverage component in the system — and therefore the one most worth
# being able to swap and measure rather than hardcode.
#
# Each entry ships its own calibration band because raw cosine distributions are
# model-specific: substituting a model without re-calibrating silently changes
# every score. `query_prefix` matters for asymmetric retrieval models (BGE, E5),
# which are trained to see an instruction on the query side; omitting it
# measurably degrades their ranking separation.
#
# IMPORTANT: a model with better public benchmark scores is not automatically
# better here. Measured on this repo's benchmark, bge-small compressed the score
# range badly (an off-domain nurse resume scored 0.52 cosine against a backend
# JD, versus 0.10 for MiniLM) and inverted the top two candidates. MiniLM stays
# the default until a labelled dataset says otherwise. Use
# `accuracy_checker/compare_models.py` to make that call with evidence.
MODEL_REGISTRY = {
    "all-MiniLM-L6-v2": {
        "semantic_floor": 15.0,
        "semantic_ceiling": 65.0,
        "skill_floor": 15.0,
        "skill_ceiling": 70.0,
        "query_prefix": "",
        "normalize": False,
    },
    "BAAI/bge-small-en-v1.5": {
        # Higher floors: BGE's cosine distribution is compressed toward the top,
        # so unrelated text starts around 0.50 rather than 0.10.
        "semantic_floor": 45.0,
        "semantic_ceiling": 88.0,
        "skill_floor": 40.0,
        "skill_ceiling": 90.0,
        "query_prefix": "Represent this sentence for searching relevant passages: ",
        "normalize": True,
    },
    "BAAI/bge-base-en-v1.5": {
        "semantic_floor": 45.0,
        "semantic_ceiling": 88.0,
        "skill_floor": 40.0,
        "skill_ceiling": 90.0,
        "query_prefix": "Represent this sentence for searching relevant passages: ",
        "normalize": True,
    },
    "sentence-transformers/all-mpnet-base-v2": {
        "semantic_floor": 15.0,
        "semantic_ceiling": 70.0,
        "skill_floor": 15.0,
        "skill_ceiling": 75.0,
        "query_prefix": "",
        "normalize": False,
    },
}

DEFAULT_MODEL = "all-MiniLM-L6-v2"
MODEL_NAME = os.environ.get("EMBEDDING_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

_MODEL_CONFIG = MODEL_REGISTRY.get(MODEL_NAME)
if _MODEL_CONFIG is None:
    # An unregistered model still loads, but its calibration is a guess. Warn
    # rather than fail: pinning a fine-tuned in-house model is a legitimate use.
    import logging
    logging.warning(
        "EMBEDDING_MODEL=%s is not in MODEL_REGISTRY; falling back to the "
        "default calibration band. Scores will not be comparable to a "
        "registered model until you add an entry and re-run "
        "accuracy_checker/compare_models.py.",
        MODEL_NAME,
    )
    _MODEL_CONFIG = MODEL_REGISTRY[DEFAULT_MODEL]

model = SentenceTransformer(MODEL_NAME)

QUERY_PREFIX = _MODEL_CONFIG["query_prefix"]
NORMALIZE = _MODEL_CONFIG["normalize"]


# ── Score calibration ─────────────────────────────────────────────────────────
# Raw cosine similarity does not span [0, 1] in practice. Unrelated professional
# text still scores well above zero because it shares register and vocabulary,
# and genuinely well-matched resume/JD pairs plateau below 1.0. Mapping the raw
# range directly onto [0, 100] compresses every real candidate into a narrow mid
# band, which makes the output useless for ranking.
#
# Defaults come from the active model's registry entry; environment variables
# override them. These are heuristic, NOT fitted to a labelled dataset — treat
# the numbers as ordinal, not as calibrated probabilities.
SEMANTIC_FLOOR = float(os.environ.get("SEMANTIC_FLOOR", _MODEL_CONFIG["semantic_floor"]))
SEMANTIC_CEILING = float(os.environ.get("SEMANTIC_CEILING", _MODEL_CONFIG["semantic_ceiling"]))
SKILL_FLOOR = float(os.environ.get("SKILL_FLOOR", _MODEL_CONFIG["skill_floor"]))
SKILL_CEILING = float(os.environ.get("SKILL_CEILING", _MODEL_CONFIG["skill_ceiling"]))


def _encode(texts: list, is_query: bool = False):
    """
    Encode text with the active model's conventions applied.

    Asymmetric retrieval models expect an instruction prefix on the query side
    only; applying it to documents (or omitting it from queries) costs real
    ranking accuracy.
    """
    if is_query and QUERY_PREFIX:
        texts = [QUERY_PREFIX + t for t in texts]
    return model.encode(texts, convert_to_tensor=True, normalize_embeddings=NORMALIZE)


def _calibrate(raw_score: float, floor: float, ceiling: float) -> float:
    """Stretch a raw 0-100 cosine onto [0, 100] across the usable band."""
    if ceiling <= floor:
        return round(min(100.0, max(0.0, raw_score)), 2)
    scaled = ((raw_score - floor) / (ceiling - floor)) * 100.0
    return round(min(100.0, max(0.0, scaled)), 2)


# How much the single best-matching chunk counts versus the candidate's average
# across all chunks. Pure max rewards one lucky paragraph; pure mean punishes
# long resumes, since irrelevant-but-real sections (education, interests) drag
# the average down. Weighting toward max reflects how a recruiter reads: they
# look for the strongest relevant evidence, then sanity-check the rest.
CHUNK_MAX_WEIGHT = float(os.environ.get("CHUNK_MAX_WEIGHT", "0.7"))


def compute_semantic_similarity(job_description: str, candidate_summary: str,
                                candidate_chunks: list = None) -> float:
    """
    Semantic similarity between the job description and the candidate.

    When `candidate_chunks` is supplied, each section is embedded separately and
    the score blends the best-matching chunk with the mean across chunks. This
    exists because the previous approach compared the JD against the resume's
    first 1500 characters only: for a multi-page CV that is the header and the
    most recent role, so a candidate whose relevant experience appears later was
    invisible to the strongest-weighted component in the whole system.

    Falls back to whole-text comparison when no chunks are given, which keeps
    older callers and the test suite working unchanged.
    """
    if not job_description:
        return 0.0

    chunks = [c.strip() for c in (candidate_chunks or []) if c and c.strip()]
    if not chunks:
        if not candidate_summary:
            return 0.0
        chunks = [candidate_summary]

    job_embedding = _encode([job_description], is_query=True)
    chunk_embeddings = _encode(chunks)

    # Shape: (1, num_chunks)
    cosine_scores = util.pytorch_cos_sim(job_embedding, chunk_embeddings)[0]

    best = float(torch.max(cosine_scores))
    mean = float(torch.mean(cosine_scores))
    blended = (best * CHUNK_MAX_WEIGHT) + (mean * (1.0 - CHUNK_MAX_WEIGHT))

    return _calibrate(blended * 100.0, SEMANTIC_FLOOR, SEMANTIC_CEILING)


def compute_batch_skill_similarity(required_skills: list, candidate_skills: list,
                                   candidate_summary: str = "",
                                   skill_weights: dict = None) -> float:
    """
    Dense-context semantic skill matching.

    Builds a compact candidate context from extracted skill tokens plus a short
    profile excerpt, then uses max-then-mean aggregation: each required skill
    takes its best conceptual match among the candidate's items, and those
    maxima are averaged.

    `skill_weights` maps a required skill to its importance multiplier (see
    core.skill_weights). Without it every requirement counts equally, so a
    must-have language and a nice-to-have ticketing tool move the score by the
    same amount — which is not how anyone actually hires.
    """
    if not required_skills:
        return 100.0

    # Build a list of candidate context items for semantic matching
    cand_items = [s.strip() for s in candidate_skills if s.strip()]

    summary_str = candidate_summary[:300].strip() if candidate_summary else ""
    if summary_str:
        cand_items.append(summary_str)

    if not cand_items:
        return 0.0

    # Add the canonical form of each extracted skill so that vocabulary variants
    # ("k8s", "ReactJS") are compared against the same anchor the JD would use.
    canonical_extras = canonicalize_skills(candidate_skills) - {c.strip().lower() for c in cand_items}
    cand_items.extend(sorted(canonical_extras))

    req_embeddings = _encode(required_skills, is_query=True)
    # Shape: (num_candidate_items, D)
    cand_embeddings = _encode(cand_items)

    # Shape: (num_required_skills, num_candidate_items)
    cosine_scores = util.pytorch_cos_sim(req_embeddings, cand_embeddings)

    # max-then-mean: each required skill takes its best cosine match among
    # candidate items, then those are averaged across required skills.
    max_scores, _ = torch.max(cosine_scores, dim=1)

    if skill_weights:
        weights = torch.tensor(
            [float(skill_weights.get(s, 1.0)) for s in required_skills],
            dtype=max_scores.dtype,
        )
        total = float(torch.sum(weights))
        if total <= 0:
            average_match = torch.mean(max_scores)
        else:
            average_match = torch.sum(max_scores * weights) / total
    else:
        average_match = torch.mean(max_scores)

    raw_score = float(average_match) * 100.0
    return _calibrate(raw_score, SKILL_FLOOR, SKILL_CEILING)


def compute_semantic_similarity_batch(job_description: str, candidate_summaries: list) -> list:
    """
    Score many candidates against one JD in a single forward pass.

    Encoding one candidate at a time wastes most of the throughput the model can
    deliver; batching is what makes a 50-CV screening run finish in reasonable
    time. Returns scores positionally aligned with `candidate_summaries`.
    """
    if not job_description or not candidate_summaries:
        return [0.0] * len(candidate_summaries or [])

    usable = [(i, s) for i, s in enumerate(candidate_summaries) if s and s.strip()]
    scores = [0.0] * len(candidate_summaries)
    if not usable:
        return scores

    job_embedding = _encode([job_description], is_query=True)
    cand_embeddings = _encode([s for _, s in usable])
    cosine_scores = util.pytorch_cos_sim(job_embedding, cand_embeddings)[0]

    for (idx, _), raw in zip(usable, cosine_scores):
        scores[idx] = _calibrate(float(raw) * 100.0, SEMANTIC_FLOOR, SEMANTIC_CEILING)
    return scores
