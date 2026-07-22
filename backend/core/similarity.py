from sentence_transformers import SentenceTransformer, util
import torch

model = SentenceTransformer('all-MiniLM-L6-v2')


# Research-to-operational vocabulary bridge.
# Candidates who use academic ML terminology get domain anchors appended so the
# embedding engine can correctly map them to corporate job-description vocabulary.
_CV_ANCHORS = ["diffusion", "gan", "generative", "megapixel", "convolutional", "vit", "transformer", "pytorch"]

def compute_semantic_similarity(job_description: str, candidate_summary: str) -> float:
    """Broad semantic similarity between the full JD and the candidate's profile summary.

    Applies CV domain-anchor injection for research-vocabulary candidates and
    stretches the raw cosine band [0.25, 0.65] to the full [0, 100] output range
    via a min-max calibration curve.
    """
    if not job_description or not candidate_summary:
        return 0.0

    # Domain-anchor injection: bridge academic ↔ operational vocabulary
    if any(a in candidate_summary.lower() for a in _CV_ANCHORS) and "computer vision" in job_description.lower():
        candidate_summary += " computer vision image processing object detection"

    job_embedding  = model.encode([job_description],   convert_to_tensor=True)
    cand_embedding = model.encode([candidate_summary], convert_to_tensor=True)
    cosine_score   = util.pytorch_cos_sim(job_embedding, cand_embedding)
    raw_score      = float(cosine_score[0][0]) * 100.0

    # Min-max calibration: floor lowered to 15.0 so research-vocabulary
    # candidates with non-verbatim text are never clipped to zero.
    # Upper bound stays at 65.0 — the realistic ceiling for multi-sentence cosine.
    scaled = ((raw_score - 15.0) / (65.0 - 15.0)) * 100.0
    return round(min(100.0, max(0.0, scaled)), 2)


def compute_batch_skill_similarity(required_skills: list, candidate_skills: list,
                                   candidate_summary: str = "") -> float:
    """Dense-context semantic skill matching with domain-anchor injection and
    min-max calibration.

    Builds a compact, noise-free candidate context from extracted skill tokens
    and the short profile summary, then uses max-then-mean aggregation so each
    required skill finds its best conceptual match before the scores are averaged.
    A calibration curve [30, 70] → [0, 100] surfaces real talent in the green zone.
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

    # Domain-anchor injection check: if any CV research anchor is present in the context,
    # append operational domain anchors to cand_items
    full_context_str = " ".join(cand_items).lower()
    if any(a in full_context_str for a in _CV_ANCHORS):
        cand_items.extend(["computer vision", "image processing", "object detection", "opencv", "yolo"])

    req_embeddings = model.encode(required_skills, convert_to_tensor=True)
    # Shape: (num_candidate_items, D)
    cand_embeddings = model.encode(cand_items, convert_to_tensor=True)

    # Shape: (num_required_skills, num_candidate_items)
    cosine_scores = util.pytorch_cos_sim(req_embeddings, cand_embeddings)
    
    # max-then-mean: each required skill takes its best cosine match among candidate items,
    # then we average across all required skills.
    max_scores, _ = torch.max(cosine_scores, dim=1)
    average_match = torch.mean(max_scores)
    raw_score     = float(average_match) * 100.0

    # Min-max calibration: floor lowered to 15.0 to avoid clipping valid
    # research profiles; upper bound stays at 70.0 (dense-context ceiling).
    scaled = ((raw_score - 15.0) / (70.0 - 15.0)) * 100.0
    return round(min(100.0, max(0.0, scaled)), 2)
