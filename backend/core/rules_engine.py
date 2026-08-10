from core.skill_aliases import canonicalize_skill, canonicalize_skills
from core.skill_weights import (
    MISSING_MUST_HAVE_CAP,
    format_weight_label,
    missing_must_haves,
)

EDUCATION_LEVELS = {
    "Unknown": 0, "High School": 1, "Bachelor": 2, "Master": 3, "PhD": 4
}

# ──────────────────────────────────────────────
# Individual component scoring helpers
# ──────────────────────────────────────────────

def calculate_experience_score(required_exp: int, candidate_exp: float) -> float:
    if required_exp <= 0:
        return 100.0
    if candidate_exp >= required_exp:
        return 100.0
    return round((candidate_exp / required_exp) * 100.0, 2)

def calculate_location_score(preferred_location: str, candidate_location: str) -> float:
    if not preferred_location:
        return 100.0
    if not candidate_location:
        return 50.0
    pref_clean = preferred_location.lower().strip()
    cand_clean = candidate_location.lower().strip()
    if pref_clean in cand_clean or cand_clean in pref_clean:
        return 100.0
    if "remote" in pref_clean or "remote" in cand_clean:
        return 80.0
    return 0.0

def calculate_education_score(required_education: str, candidate_education: str) -> float:
    if not required_education or required_education == "Any":
        return 100.0
    req_level = EDUCATION_LEVELS.get(required_education, 0)
    cand_level = EDUCATION_LEVELS.get(candidate_education, 0)
    if cand_level >= req_level:
        return 100.0
    if req_level == 0:
        return 100.0
    return round((cand_level / req_level) * 100.0, 2)

def calculate_certification_score(required_certs: list, candidate_certs: list) -> float:
    if not required_certs:
        return 100.0
    if not candidate_certs:
        return 0.0
    req_lower = [c.lower() for c in required_certs]
    cand_lower = [c.lower() for c in candidate_certs]
    matched = sum(1 for c in req_lower if any(c in cc or cc in c for cc in cand_lower))
    return round((matched / len(required_certs)) * 100.0, 2)

def calculate_language_score(preferred_languages: list, candidate_languages: list) -> float:
    if not preferred_languages:
        return 100.0
    if not candidate_languages:
        return 50.0
    pref_lower = [l.lower() for l in preferred_languages]
    cand_lower = [l.lower() for l in candidate_languages]
    matched = sum(1 for l in pref_lower if l in cand_lower)
    return round((matched / len(preferred_languages)) * 100.0, 2)

def calculate_skills_score(required_skills: list, candidate_skills: list) -> float:
    """Exact-match skills score, compared on canonical skill names."""
    if not required_skills:
        return 100.0
    if not candidate_skills:
        return 0.0
    req_canonical = canonicalize_skills(required_skills)
    cand_canonical = canonicalize_skills(candidate_skills)
    matched = len(req_canonical & cand_canonical)
    return round((matched / len(req_canonical)) * 100.0, 2)

def calculate_weighted_skills_score(required_skills: list, candidate_skills: list,
                                    skill_weights: dict = None) -> float:
    """
    Exact-match skills score with per-skill importance.

    An unweighted average treats a role's core language and a peripheral tool
    identically. Weighting lets a job description say which requirements
    actually decide the hire.
    """
    if not required_skills:
        return 100.0
    if not candidate_skills:
        return 0.0

    cand_canonical = canonicalize_skills(candidate_skills)

    total_weight = 0.0
    matched_weight = 0.0
    for skill in required_skills:
        weight = float((skill_weights or {}).get(skill, 1.0))
        total_weight += weight
        if canonicalize_skill(skill) in cand_canonical:
            matched_weight += weight

    if total_weight <= 0:
        return 0.0
    return round((matched_weight / total_weight) * 100.0, 2)


def calculate_density_weighted_skills_score(required_skills: list, skills_density: dict) -> float:
    """
    Density-aware skills score. Penalises single-mention keyword stuffing.
        count == 1  → 0.4  (casual / stuffed mention)
        count == 2  → 0.7  (moderate use)
        count >= 3  → 1.0  (core expertise)
    """
    if not required_skills:
        return 100.0
    if not skills_density:
        return 0.0

    # Fold counts onto canonical names so "React" and "ReactJS" mentions add up
    # instead of being tracked as two unrelated skills.
    density_canonical = {}
    for k, v in skills_density.items():
        key = canonicalize_skill(k)
        density_canonical[key] = density_canonical.get(key, 0) + v

    total_weight = 0.0

    for skill in required_skills:
        count = density_canonical.get(canonicalize_skill(skill), 0)
        if count == 0:
            multiplier = 0.0
        elif count == 1:
            multiplier = 0.4
        elif count == 2:
            multiplier = 0.7
        else:
            multiplier = 1.0
        total_weight += multiplier

    return round((total_weight / len(required_skills)) * 100.0, 2)

def calculate_projects_score(candidate_projects: list) -> float:
    if not candidate_projects:
        return 0.0
    count = len(candidate_projects)
    if count >= 3:
        return 100.0
    return round((count / 3) * 100.0, 2)

# ──────────────────────────────────────────────
# Utility helpers
# ──────────────────────────────────────────────

def get_matched_missing_skills(required_skills: list, candidate_skills: list):
    """
    Split required skills into matched/missing using canonical names, so that
    "ReactJS" on a resume satisfies a "React" requirement.
    """
    cand_canonical = canonicalize_skills(candidate_skills)
    matched, missing = [], []
    for req in required_skills:
        if canonicalize_skill(req) in cand_canonical:
            matched.append(req)
        else:
            missing.append(req)
    return matched, missing

def check_seniority_deficit(job_title: str, past_titles: list) -> bool:
    """
    Checks if a candidate is applying for a senior/lead job while their history
    consists entirely of junior-level titles and contains no mid-level or senior titles.
    """
    if not job_title or not past_titles:
        return False
        
    senior_keywords = {"senior", "lead", "principal", "manager", "architect", "director", "head", "vp", "specialist"}
    junior_modifiers = {"junior", "associate", "intern", "graduate", "trainee", "entry", "entry-level"}
    
    job_lower = job_title.lower()
    is_senior_job = any(k in job_lower for k in senior_keywords)
    if not is_senior_job:
        return False
        
    # Check if they have ANY senior history
    has_any_senior_history = any(any(k in t.lower() for k in senior_keywords) for t in past_titles)
    if has_any_senior_history:
        return False
        
    # Check if they have ANY mid-level history (a title that has neither junior nor senior keywords)
    has_any_mid_level = False
    for title in past_titles:
        t_low = title.lower()
        is_junior = any(k in t_low for k in junior_modifiers)
        is_senior = any(k in t_low for k in senior_keywords)
        if not is_junior and not is_senior:
            has_any_mid_level = True
            break
            
    # Seniority deficit gate triggers ONLY if all extracted titles are junior/intern roles
    all_roles_are_junior = all(any(k in t.lower() for k in junior_modifiers) for t in past_titles)
    
    if all_roles_are_junior and not has_any_senior_history and not has_any_mid_level:
        return True
            
    return False

def generate_summary(candidate_id: str, matched_skills: list, missing_skills: list,
                     exp_score: float, semantic_score: float, final_score: float) -> str:
    strength = "strong" if final_score >= 80 else "moderate" if final_score >= 60 else "limited"
    if matched_skills:
        # Name the matched skills; a bare count gives a recruiter nothing to act on.
        shown = ", ".join(matched_skills[:5])
        overflow = f" (+{len(matched_skills) - 5} more)" if len(matched_skills) > 5 else ""
        skill_note = f"Matches {len(matched_skills)} required skill(s): {shown}{overflow}."
    else:
        skill_note = "No direct skill matches found."
    gap_note = f"Gaps: {', '.join(missing_skills[:3])}." if missing_skills else "No critical skill gaps detected."
    exp_note = "Experience fully meets requirements." if exp_score >= 100 else f"Experience score: {exp_score:.0f}%."
    sem_note = f"Semantic alignment with job description: {semantic_score:.0f}%."
    return f"{candidate_id} shows {strength} overall fit. {skill_note} {gap_note} {exp_note} {sem_note}"

# ──────────────────────────────────────────────
# Final composite scorer — v3 "Soft Veto" with Non-Linear Calibrations
# ──────────────────────────────────────────────

def compute_final_score(extracted_data: dict, job_reqs: dict, semantic_score: float,
                        skill_similarity_score: float, semantic_model=None) -> dict:
    """
    v3 Scoring with upgraded Non-Linear experience deficit penalty and audit logs.
    """
    weights = {
        "semantic":       0.40,
        "skills":         0.20,
        "experience":     0.15,
        "education":      0.10,
        "certifications": 0.05,
        "location":       0.05,
        "language":       0.05,
    }

    req_skills     = job_reqs.get("required_skills", [])
    cand_skills    = extracted_data.get("skills", [])
    skills_density = extracted_data.get("skills_density", {})
    skill_weights  = job_reqs.get("skill_weights", {}) or {}

    # ── 1. Skill sub-scores ──────────────────────
    # Weighted when the job description marks importance ("Python!", "Jira?"),
    # otherwise identical to the unweighted behaviour.
    exact_score   = calculate_weighted_skills_score(req_skills, cand_skills, skill_weights)
    density_score = calculate_density_weighted_skills_score(req_skills, skills_density)
    sem_skill_score = skill_similarity_score

    # Blend: 40% exact | 30% density | 30% semantic-skills
    blended_skill_score = (exact_score * 0.40) + (density_score * 0.30) + (sem_skill_score * 0.30)

    # A missing must-have caps the skills sub-score. A weighted average alone
    # cannot express "this one is disqualifying": with several other strong
    # matches, a candidate lacking the single non-negotiable skill would still
    # score comfortably.
    matched_for_cap, _ = get_matched_missing_skills(req_skills, cand_skills)
    unmet_must_haves = missing_must_haves(skill_weights, matched_for_cap)
    if unmet_must_haves:
        blended_skill_score = min(blended_skill_score, MISSING_MUST_HAVE_CAP)

    # ── 2. Core tech score (out of 60 possible points) ──
    tech_score = (blended_skill_score * weights["skills"]) + (semantic_score * weights["semantic"])

    # ── 3. Soft Veto ─────────────────────────────
    # Secondary attributes (education, location, certs) should not carry a
    # candidate who fails on the core technical match, so when tech_score is
    # weak they are scaled down rather than counted at face value.
    soft_veto_applied = tech_score < 30.0
    if not soft_veto_applied:
        tech_ratio = 1.0
    else:
        tech_ratio = max(0.4, tech_score / 30.0)

    # ── 4. Secondary scores ──────────────────────
    req_exp_years = job_reqs.get("required_experience_years", 0)
    cand_exp_years = extracted_data.get("experience", 0)
    exp_score  = calculate_experience_score(req_exp_years, cand_exp_years)
    
    required_education = job_reqs.get("required_education", "Any")
    candidate_education = extracted_data.get("education", "Unknown")
    edu_score  = calculate_education_score(required_education, candidate_education)
    
    required_certifications = job_reqs.get("required_certifications", [])
    candidate_certifications = extracted_data.get("certifications", [])
    cert_score = calculate_certification_score(required_certifications, candidate_certifications)
    
    preferred_location = job_reqs.get("preferred_location", "")
    candidate_location = extracted_data.get("location", "")
    loc_score  = calculate_location_score(preferred_location, candidate_location)
    
    preferred_languages = job_reqs.get("preferred_languages", [])
    candidate_languages = extracted_data.get("languages", [])
    lang_score = calculate_language_score(preferred_languages, candidate_languages)

    adjusted_exp_score  = exp_score  * tech_ratio
    adjusted_edu_score  = edu_score  * tech_ratio
    adjusted_cert_score = cert_score
    adjusted_loc_score  = loc_score
    adjusted_lang_score = lang_score

    # ── 5. Final composite ────────────────────────
    final_score = (
        tech_score +
        (adjusted_exp_score  * weights["experience"])     +
        (adjusted_edu_score  * weights["education"])      +
        (adjusted_cert_score * weights["certifications"]) +
        (adjusted_loc_score  * weights["location"])       +
        (adjusted_lang_score * weights["language"])
    )

    # ── 6. Deficit Score Penalties & Gate ──────────
    # Seniority Deficit Gate matching
    job_title_input = job_reqs.get("job_title", "")
    past_titles = extracted_data.get("past_titles", [])
    seniority_deficit = check_seniority_deficit(job_title_input, past_titles)
    
    seniority_explanation = "Seniority history is aligned with requirements."
    if seniority_deficit:
        final_score = final_score * 0.75
        seniority_explanation = "Applied 25% reduction: Candidate is applying for a senior/lead role but their history only contains junior/intern titles."
        
    # Experience Deficit sliding piecewise penalty.
    #
    # Deliberate double-count: `exp_score` already scales the 15% experience
    # weight, and this subtracts additional points on top. Experience is the
    # single strongest signal in senior hiring, and the weighted term alone moves
    # the total by at most 15 points, which does not separate a 1-year applicant
    # from a 6-year one for a 7-year role. The penalty is capped at 25 points so
    # the combined effect stays bounded.
    exp_penalty = 0.0
    exp_explanation = "Experience fully meets or exceeds requirements."

    if cand_exp_years < req_exp_years:
        exp_deficit = req_exp_years - cand_exp_years
        # Piecewise curve
        if exp_deficit <= 2.0:
            exp_penalty = exp_deficit * 3.0
        elif exp_deficit <= 5.0:
            exp_penalty = 6.0 + (exp_deficit - 2.0) * 4.0
        else:
            exp_penalty = 18.0 + (exp_deficit - 5.0) * 1.5
            
        # Cap the maximum experience penalty
        exp_penalty = min(25.0, exp_penalty)
        final_score = final_score - exp_penalty
        exp_explanation = f"Deducted {exp_penalty:.1f} points: Candidate has {cand_exp_years} years, job requires {req_exp_years} years (Applied non-linear gap scaling)."

    final_score = max(0.0, min(100.0, final_score))

    # Compile a highly detailed analytical audit log
    matched_skills, missing_skills = get_matched_missing_skills(req_skills, cand_skills)
    
    edu_explanation = f"Education level meets requirements (Candidate: {candidate_education}, Required: {required_education})."
    if edu_score < 100.0:
        edu_explanation = f"Education deficit: Candidate has {candidate_education}, but role requires {required_education}. Applied soft-veto scaling."
        
    skills_explanation = f"Blended skills match: {blended_skill_score:.1f}% (Composed of 40% keyword intersection, 30% frequency density, and 30% dense-context semantic skill similarity)."
    if skill_weights and any(w != 1.0 for w in skill_weights.values()):
        graded = ", ".join(
            f"{name} ({format_weight_label(w)})"
            for name, w in skill_weights.items()
            if w != 1.0
        )
        skills_explanation += f" Importance weighting applied: {graded}."
    if unmet_must_haves:
        skills_explanation += (
            f" Capped at {MISSING_MUST_HAVE_CAP:.0f}%: missing must-have skill(s) "
            f"{', '.join(unmet_must_haves)}."
        )
    semantic_explanation = f"Semantic alignment with JD: {semantic_score:.1f}%. Represents overall conceptual match."
    
    loc_explanation = "Location check passed."
    if loc_score == 80.0:
        loc_explanation = "Location matched via hybrid/remote settings."
    elif loc_score == 0.0 and preferred_location:
        loc_explanation = f"Location mismatch: Role preferred {preferred_location}, candidate resides in {candidate_location or 'Unknown'}."
        
    cert_explanation = "Certification requirements met."
    if required_certifications and cert_score < 100.0:
        cert_explanation = f"Missing certifications: Candidate matched {len(candidate_certifications)} of {len(required_certifications)} required certs."

    audit_log = {
        "experience": exp_explanation,
        "seniority": seniority_explanation,
        "education": edu_explanation,
        "skills": skills_explanation,
        "semantic_similarity": semantic_explanation,
        "location": loc_explanation,
        "certifications": cert_explanation
    }

    return {
        "final_score": round(final_score, 2),
        "soft_veto_applied": soft_veto_applied,
        "seniority_deficit_applied": seniority_deficit,
        "experience_penalty": round(exp_penalty, 2),
        "missing_must_haves": unmet_must_haves,
        "breakdown": {
            "skills":              round(blended_skill_score, 2),
            "semantic_similarity": round(semantic_score, 2),
            "experience":          round(exp_score, 2),
            "education":           round(edu_score, 2),
            "certifications":      round(cert_score, 2),
            "location":            round(loc_score, 2),
            "language":            round(lang_score, 2),
        },
        "audit_log": audit_log
    }
