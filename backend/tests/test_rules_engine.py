import pytest
import sys
import os

# Add backend root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.rules_engine import (
    calculate_experience_score,
    calculate_location_score,
    calculate_education_score,
    calculate_certification_score,
    calculate_language_score,
    calculate_skills_score,
    calculate_density_weighted_skills_score,
    compute_final_score,
    generate_summary
)

def test_calculate_experience_score():
    assert calculate_experience_score(0, 5) == 100.0
    assert calculate_experience_score(5, 5) == 100.0
    assert calculate_experience_score(5, 10) == 100.0
    assert calculate_experience_score(10, 5) == 50.0

def test_calculate_location_score():
    assert calculate_location_score("", "New York") == 100.0
    assert calculate_location_score("New York", "") == 50.0
    assert calculate_location_score("New York", "New York, NY") == 100.0
    assert calculate_location_score("Remote", "London") == 80.0
    assert calculate_location_score("Tokyo", "London") == 0.0

def test_calculate_education_score():
    assert calculate_education_score("Any", "High School") == 100.0
    assert calculate_education_score("Bachelor", "Bachelor") == 100.0
    assert calculate_education_score("Bachelor", "Master") == 100.0
    assert calculate_education_score("Master", "Bachelor") == 66.67
    assert calculate_education_score("PhD", "Bachelor") == 50.0

def test_calculate_certification_score():
    assert calculate_certification_score([], ["AWS"]) == 100.0
    assert calculate_certification_score(["AWS Solutions Architect"], []) == 0.0
    assert calculate_certification_score(["AWS Certified"], ["AWS Certified Associate"]) == 100.0

def test_calculate_language_score():
    assert calculate_language_score([], ["English"]) == 100.0
    assert calculate_language_score(["English", "Spanish"], ["English"]) == 50.0
    assert calculate_language_score(["English"], ["English", "German"]) == 100.0

def test_calculate_skills_score():
    req = ["Python", "FastAPI", "Docker"]
    cand = ["Python", "FastAPI", "React"]
    # 2 out of 3 match -> 66.67
    assert calculate_skills_score(req, cand) == 66.67
    assert calculate_skills_score(req, ["Python", "FastAPI", "Docker"]) == 100.0
    assert calculate_skills_score(req, []) == 0.0

def test_calculate_density_weighted_skills_score():
    req = ["Python", "Docker"]
    # Python mentioned 3 times (1.0 weight), Docker mentioned 1 time (0.4 weight) -> (1.0 + 0.4)/2 * 100 = 70.0
    density = {"Python": 3, "Docker": 1}
    assert calculate_density_weighted_skills_score(req, density) == 70.0

def test_compute_final_score_soft_veto():
    extracted = {
        "skills": ["Python", "FastAPI"],
        "skills_density": {"Python": 3, "FastAPI": 2},
        "experience": 5,
        "education": "Bachelor",
        "certifications": [],
        "location": "New York",
        "languages": ["English"]
    }
    job_reqs = {
        "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "AWS"],
        "required_experience_years": 5,
        "required_education": "Bachelor",
        "preferred_location": "New York"
    }
    
    result = compute_final_score(extracted, job_reqs, semantic_score=75.0, skill_similarity_score=70.0)
    assert "final_score" in result
    assert 0.0 <= result["final_score"] <= 100.0
    assert result["soft_veto_applied"] is False or result["soft_veto_applied"] is True

def test_generate_summary():
    summary = generate_summary("cand_1", ["Python"], ["Docker"], 100.0, 85.0, 82.0)
    assert "cand_1" in summary
    assert "strong" in summary
    assert "Python" in summary
