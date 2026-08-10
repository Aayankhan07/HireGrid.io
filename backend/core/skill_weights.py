"""
Required-skill importance weighting.

Every required skill previously counted equally, so a role's core language and a
peripheral ticketing tool moved the score by exactly the same amount. That is
not how hiring works: missing the one non-negotiable skill should cost far more
than missing a convenience.

Recruiters express this with a suffix on the skill name:

    "Python!, PostgreSQL, Jira?"
      Python!      must-have    (weight 2.0)
      PostgreSQL   standard     (weight 1.0)
      Jira?        nice-to-have (weight 0.5)

The syntax is deliberately lightweight — it survives a plain comma-separated
text input, needs no new UI control, and degrades gracefully: a JD written
without any markers behaves exactly as before.
"""

from typing import Dict, List, Tuple

MUST_HAVE_SUFFIX = "!"
NICE_TO_HAVE_SUFFIX = "?"

WEIGHT_MUST_HAVE = 2.0
WEIGHT_STANDARD = 1.0
WEIGHT_NICE_TO_HAVE = 0.5

# A must-have that the candidate lacks entirely caps the skills sub-score. A
# weighted average alone cannot express "this one is disqualifying" — with four
# other strong matches, a missing must-have still leaves a comfortable score.
MISSING_MUST_HAVE_CAP = float(75.0)


def parse_skill_weights(raw_skills) -> Tuple[List[str], Dict[str, float]]:
    """
    Split a raw skill list into clean names and their importance weights.

    Accepts either a comma-separated string or an iterable of strings. Returns
    `(clean_names, weights_by_name)`; the names have their markers stripped so
    everything downstream (matching, display, storage) sees ordinary skill text.
    """
    if isinstance(raw_skills, str):
        items = [s for s in raw_skills.split(",")]
    else:
        items = list(raw_skills or [])

    names: List[str] = []
    weights: Dict[str, float] = {}

    for item in items:
        token = str(item).strip()
        if not token:
            continue

        weight = WEIGHT_STANDARD
        # Trailing markers only; a '?' inside a skill name is left alone.
        while token and token[-1] in (MUST_HAVE_SUFFIX, NICE_TO_HAVE_SUFFIX):
            weight = WEIGHT_MUST_HAVE if token[-1] == MUST_HAVE_SUFFIX else WEIGHT_NICE_TO_HAVE
            token = token[:-1].strip()

        if not token:
            continue

        names.append(token)
        weights[token] = weight

    return names, weights


def get_must_have_skills(weights: Dict[str, float]) -> List[str]:
    """Skills the role treats as non-negotiable."""
    return [name for name, w in (weights or {}).items() if w >= WEIGHT_MUST_HAVE]


def missing_must_haves(weights: Dict[str, float], matched_skills) -> List[str]:
    """Must-have skills absent from the candidate's matched set."""
    if not weights:
        return []
    from core.skill_aliases import canonicalize_skills, canonicalize_skill

    matched_canonical = canonicalize_skills(matched_skills)
    return [
        name
        for name in get_must_have_skills(weights)
        if canonicalize_skill(name) not in matched_canonical
    ]


def format_weight_label(weight: float) -> str:
    """Human-readable importance, for audit logs and UI."""
    if weight >= WEIGHT_MUST_HAVE:
        return "must-have"
    if weight <= WEIGHT_NICE_TO_HAVE:
        return "nice-to-have"
    return "standard"
