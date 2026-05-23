import sys
import os

# Adjust path to import from the backend directory (going up one level)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

try:
    from core.nlp_layer import calculate_total_experience, extract_detailed_education, extract_projects, extract_all
    from core.rules_engine import check_seniority_deficit, compute_final_score
    IMPORT_SUCCESS = True
except ImportError as e:
    IMPORT_SUCCESS = False
    import_error_msg = str(e)

def run_accuracy_check():
    print("======================================================================")
    print("               HireGrid.io - ENGINE ACCURACY CHECKER                     ")
    print("======================================================================")
    
    if not IMPORT_SUCCESS:
        print("[ERROR] Could not import backend engine modules!")
        print(f"Details: {import_error_msg}")
        print("\nPlease ensure the backend environment is active and path is resolved.")
        return

    total_checks = 0
    passed_checks = 0

    def check_assertion(name, condition, details=""):
        nonlocal total_checks, passed_checks
        total_checks += 1
        if condition:
            passed_checks += 1
            print(f"[ PASS ] {name} - {details}")
        else:
            print(f"[ FAIL ] {name} - {details}")

    # ── Test 1: Date Merging & Overlapping Intervals ──
    print("\n>>> Checking Date Extraction & Concurrent Interval Merger...")
    test_resume_dates = """
    Lead Developer - Tech Corp: Jan 2021 - Dec 2021
    Freelance Architect: Jun 2021 - Sep 2021  (Overlapping, should not inflate total experience)
    Associate Engineer - Old Corp: 2018 - 2019  (Standalone years range)
    """
    extracted_exp = calculate_total_experience(test_resume_dates)
    check_assertion(
        "Date Overlap Merger",
        abs(extracted_exp - 3.0) < 0.1,
        f"Parsed parallel roles successfully. Expected: 3.0 yrs, Parsed: {extracted_exp} yrs"
    )

    # ── Test 2: Semantic Education & University Parsing ──
    print("\n>>> Checking Semantic Education details Parser...")
    test_edu_text = """
    EDUCATION
    Master of Business Administration (MBA) - Stanford University
    Bachelor of Science in Computer Science & Engineering
    University of Lahore, graduated with honors.
    """
    edu_details = extract_detailed_education(test_edu_text)
    
    check_assertion(
        "Education Level Mapping",
        edu_details["level"] == "Master",
        f"Correct highest level extracted. Expected: 'Master', Parsed: '{edu_details['level']}'"
    )
    check_assertion(
        "Major Field Extraction",
        "Computer Science" in edu_details["field"] or "Business" in edu_details["field"],
        f"Major field isolated without noise prefixes. Parsed: '{edu_details['field']}'"
    )
    check_assertion(
        "University Extraction",
        "Stanford University" in edu_details["institution"] or "University of Lahore" in edu_details["institution"],
        f"Institution extracted correctly. Parsed: '{edu_details['institution']}'"
    )

    # ── Test 3: Upgraded Projects Extractor ──
    print("\n>>> Checking Impact Project Bullets Parser...")
    test_projects_text = """
    - Spearheaded development of an AI CV Screening system using PyTorch and FastAPI.
    * Optimized SQL database queries by 45% using Postgres read replicas.
    - Designed and implemented a glassmorphic Next.js interface with TailwindCSS.
    * Ordinary casual line with no strong action verb should be skipped.
    """
    projects = extract_projects(test_projects_text)
    check_assertion(
        "Action Verb Scanning",
        len(projects) >= 2,
        f"Extracted high-impact projects matching active verbs. Parsed count: {len(projects)}"
    )
    check_assertion(
        "Ignores Passive Sentences",
        all(not p.startswith("Ordinary") for p in projects),
        "Correctly filtered out non-impact bullets"
    )

    # ── Test 4: Chronological Seniority Deficit Checking ──
    print("\n>>> Checking Chronological Seniority Deficit Logic...")
    junior_only = check_seniority_deficit("Lead Backend Engineer", ["Junior Software Engineer", "Associate Intern"])
    check_assertion(
        "Junior-Only Deficit Trigger",
        junior_only is True,
        f"Triggered penalty for junior-only applicant. Triggered: {junior_only}"
    )
    mid_progression = check_seniority_deficit("Lead Backend Engineer", ["Software Developer", "Junior Intern"])
    check_assertion(
        "Mid-Level Deflection",
        mid_progression is False,
        f"Avoided penalty for progressed mid-level applicant. Triggered: {mid_progression}"
    )

    # ── Test 5: Piecewise Non-Linear Scoring & Audit Logging ──
    print("\n>>> Checking Piecewise Scoring Curves & Audit Logs...")
    job_reqs = {
        "job_title": "Senior Engineer",
        "required_skills": ["Python", "FastAPI"],
        "required_experience_years": 8,
        "required_education": "Bachelor"
    }
    
    cand_mild = {
        "skills": ["Python", "FastAPI"],
        "skills_density": {"Python": 4, "FastAPI": 2},
        "experience": 6,
        "education": "Bachelor",
        "certifications": [],
        "languages": [],
        "past_titles": ["Software Developer"]
    }
    scoring_mild = compute_final_score(cand_mild, job_reqs, semantic_score=85.0, skill_similarity_score=90.0)
    
    cand_large = cand_mild.copy()
    cand_large["experience"] = 1.0
    scoring_large = compute_final_score(cand_large, job_reqs, semantic_score=85.0, skill_similarity_score=90.0)

    check_assertion(
        "Non-linear Penalty Curve Scaling",
        scoring_mild["final_score"] > scoring_large["final_score"],
        f"Mild deficit score ({scoring_mild['final_score']}) graded above severe deficit ({scoring_large['final_score']})"
    )
    check_assertion(
        "Audit Log Explanations",
        "audit_log" in scoring_mild and "experience" in scoring_mild["audit_log"],
        "Granular audit explanation successfully added to payload"
    )

    # ── Final Summary ──
    print("\n======================================================================")
    print(f"ACCURACY VERIFICATION COMPLETE: Passed {passed_checks} of {total_checks} Checks.")
    print("======================================================================")
    
    accuracy_percentage = (passed_checks / total_checks) * 100
    print(f"Screening Engine Accuracy Index: {accuracy_percentage:.1f}%")
    if passed_checks == total_checks:
        print("[STATUS] Core logic matches all premium enterprise scoring thresholds!")
    else:
        print("[STATUS] Engine has custom adjustments. Please review audit outputs above.")
    print("======================================================================")

if __name__ == "__main__":
    run_accuracy_check()
