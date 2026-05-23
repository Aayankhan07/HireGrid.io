import sys
import os
import json
import glob
import re

# Resolve the absolute path of this script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Adjust path to import backend components (going up one level to workspace root, then into backend)
sys.path.insert(0, os.path.abspath(os.path.join(SCRIPT_DIR, "..", "backend")))

try:
    from core.parser import extract_text_from_pdf
    from core.nlp_layer import extract_all
    from core.similarity import compute_semantic_similarity, compute_batch_skill_similarity, model as semantic_model
    from core.rules_engine import compute_final_score, get_matched_missing_skills
    IMPORT_SUCCESS = True
except ImportError as e:
    IMPORT_SUCCESS = False
    import_error_msg = str(e)

# Master list of skills for keyword density tracking
MASTER_SKILL_LEXICON = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "react", "next.js",
    "fastapi", "django", "flask", "postgresql", "mysql", "mongodb", "redis", "docker", "kubernetes",
    "aws", "azure", "gcp", "pytorch", "tensorflow", "git", "linux", "rest api", "microservices"
}

# Define relative file paths within the accuracy_checker directory
RESUMES_DIR = os.path.join(SCRIPT_DIR, "test_resumes")
JD_PATH = os.path.join(SCRIPT_DIR, "job_description.txt")
GT_PATH = os.path.join(SCRIPT_DIR, "ground_truth.json")
REPORT_PATH = os.path.join(SCRIPT_DIR, "accuracy_report.json")

def bootstrap_test_files():
    """Bootstraps a folder of mock resumes and job description if they do not exist."""
    os.makedirs(RESUMES_DIR, exist_ok=True)
    
    # 1. Create Job Description
    if not os.path.exists(JD_PATH):
        with open(JD_PATH, "w", encoding="utf-8") as f:
            f.write("""JOB TITLE: Senior Python & FastAPI Developer
REQUIRED EXPERIENCE: 6 Years
REQUIRED EDUCATION: Bachelor
REQUIRED SKILLS: Python, FastAPI, PostgreSQL, Docker, AWS
PREFERRED LOCATION: Remote

DESCRIPTION:
We are looking for a Senior Developer to spearhead development of our screening pipeline.
The ideal candidate will optimize databases, design microservices, and deploy on AWS using Docker.
""")
        print(f"[BOOTSTRAP] Created default job description at: {JD_PATH}")

    # 2. Create Candidate Resumes (Senior, Mid-progression, Junior, Mismatch)
    candidates = {
        "candidate_1_senior.txt": """NAME: Sarah Jenkins
EMAIL: sarah@example.com
EDUCATION: Master of Computer Science - Stanford University
EXPERIENCE:
Senior Backend Engineer - TechCorp: Jan 2020 - Present (Working on Python, FastAPI, AWS)
Software Engineer - CloudSystems: Jun 2017 - Dec 2019 (Working on Python, Docker, Postgres)
Junior Developer - InternCo: 2015 - 2016
PROJECTS:
- Spearheaded development of a high-performance screening core using FastAPI.
- Optimized PostgreSQL queries by 45% using replicas.
- Deployed scalable Docker containers on AWS ECS.
SKILLS: Python, FastAPI, PostgreSQL, Docker, AWS, Git, Microservices, REST API
""",
        "candidate_2_mid_progression.txt": """NAME: Alex Carter
EMAIL: alex@example.com
EDUCATION: Bachelor of Science in Information Technology - University of Lahore
EXPERIENCE:
Software Engineer - AppLab: Jun 2021 - Present (Using Python, FastAPI, PostgreSQL)
Junior Intern - StartUpCo: 2020 - 2021
PROJECTS:
- Developed backend microservices using FastAPI and SQLite.
- Integrated PostgreSQL databases with Python apps.
SKILLS: Python, FastAPI, PostgreSQL, Git, Linux, Docker
""",
        "candidate_3_junior_deficit.txt": """NAME: Ryan Flores
EMAIL: ryan@example.com
EDUCATION: Associate Degree in Coding - Community College
EXPERIENCE:
Junior Developer - InternCo: Jan 2025 - Present (Just starting)
SKILLS: Python, HTML, CSS, Git
PROJECTS:
- Created simple web layouts using HTML and CSS.
""",
        "candidate_4_non_tech_mismatch.txt": """NAME: Emma Stone
EMAIL: emma@example.com
EDUCATION: Bachelor of Arts in History
EXPERIENCE:
Store Manager - retail outlets: 2018 - 2024
SKILLS: Communication, Team Leadership, Sales, Excel
PROJECTS:
- Led a team of 15 retail sales associates.
"""
    }

    for name, content in candidates.items():
        path = os.path.join(RESUMES_DIR, name)
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                f.write(content.strip())
            print(f"[BOOTSTRAP] Created sample resume at: {path}")

    # 3. Create Ground Truth Rank Map (recruiter grades out of 100)
    if not os.path.exists(GT_PATH):
        gt_data = {
            "candidate_1_senior.txt": 95,
            "candidate_2_mid_progression.txt": 75,
            "candidate_3_junior_deficit.txt": 35,
            "candidate_4_non_tech_mismatch.txt": 10
        }
        with open(GT_PATH, "w", encoding="utf-8") as f:
            json.dump(gt_data, f, indent=4)
        print(f"[BOOTSTRAP] Created default ground truth map at: {GT_PATH}")

def parse_job_description(jd_filepath):
    """Reads and parses job details from the job_description.txt file."""
    with open(jd_filepath, "r", encoding="utf-8") as f:
        text = f.read()
    
    title = "Unknown Position"
    exp = 0
    edu = "Bachelor"
    skills = []
    
    for line in text.splitlines():
        line_lower = line.lower()
        if "job title" in line_lower:
            title = line.split(":")[1].strip()
        elif "experience" in line_lower:
            exp_match = re.search(r'\d+', line)
            if exp_match:
                exp = int(exp_match.group(0))
        elif "education" in line_lower:
            edu = line.split(":")[1].strip()
        elif "skills" in line_lower:
            skills = [s.strip() for s in line.split(":")[1].split(",") if s.strip()]
            
    return {
        "job_title": title,
        "required_skills": skills,
        "required_experience_years": exp,
        "required_education": edu,
        "preferred_location": "",
        "preferred_languages": [],
        "required_certifications": [],
        "job_description_raw": text
    }

def main():
    print("======================================================================")
    print("                HireGrid.io - REAL CV ACCURACY BENCHMARK                ")
    print("======================================================================")
    
    if not IMPORT_SUCCESS:
        print("[ERROR] Could not import backend core modules!")
        print(f"Details: {import_error_msg}")
        return

    # 1. Bootstrap default folders if empty to ensure it works instantly
    bootstrap_test_files()
    
    # 2. Parse Job Description Requirements
    print("\n>>> Parsing Target Job Description...")
    try:
        job_reqs = parse_job_description(JD_PATH)
        print(f"    Title:       {job_reqs['job_title']}")
        print(f"    Required Exp: {job_reqs['required_experience_years']} Years")
        print(f"    Required Edu: {job_reqs['required_education']}")
        print(f"    Required Skills: {', '.join(job_reqs['required_skills'])}")
    except Exception as e:
        print(f"[ERROR] Failed to parse {JD_PATH}: {e}")
        return

    # 3. Find and Process all Resumes
    resume_paths = glob.glob(os.path.join(RESUMES_DIR, "*.txt")) + glob.glob(os.path.join(RESUMES_DIR, "*.pdf"))
    if not resume_paths:
        print(f"[WARNING] No resumes found in {RESUMES_DIR} directory!")
        return

    print(f"\n>>> Analyzing {len(resume_paths)} candidate files in '{os.path.basename(RESUMES_DIR)}/'...")
    
    skill_lexicon = MASTER_SKILL_LEXICON | {s.lower() for s in job_reqs["required_skills"]}
    ranked_candidates = []

    for path in resume_paths:
        filename = os.path.basename(path)
        print(f"    Processing {filename}...")
        
        try:
            if path.endswith(".pdf"):
                with open(path, "rb") as f:
                    file_bytes = f.read()
                raw_text = extract_text_from_pdf(file_bytes)
            else:
                with open(path, "r", encoding="utf-8") as f:
                    raw_text = f.read()

            if not raw_text.strip():
                print(f"    [SKIP] Empty text extracted from {filename}")
                continue

            extracted = extract_all(raw_text, skill_lexicon, filename)

            # Check zero matching required skills intersection
            req_skills_list = job_reqs["required_skills"]
            matched_skills_count = len(set(s.lower() for s in extracted["skills"]) & set(s.lower() for s in req_skills_list))
            if len(req_skills_list) > 0 and matched_skills_count == 0:
                ranked_candidates.append({
                    "filename": filename,
                    "name": extracted.get("candidate_name", "") or filename,
                    "score": 0.0,
                    "parsed_experience": extracted["experience"],
                    "parsed_education": extracted["education"],
                    "skills_matched": [],
                    "reason": "Auto-rejected: Zero required skills matched"
                })
                continue

            # Compute similarity scores
            semantic_score = compute_semantic_similarity(job_reqs["job_description_raw"], extracted["summary"])
            skill_sim_score = compute_batch_skill_similarity(req_skills_list, extracted["skills"], extracted["summary"])

            # Compute final score
            scoring = compute_final_score(extracted, job_reqs, semantic_score, skill_sim_score, semantic_model)
            matched_skills, _ = get_matched_missing_skills(req_skills_list, extracted["skills"])

            ranked_candidates.append({
                "filename": filename,
                "name": extracted.get("candidate_name", "") or filename,
                "score": round(scoring["final_score"], 2),
                "parsed_experience": extracted["experience"],
                "parsed_education": extracted["education"],
                "skills_matched": matched_skills,
                "reason": scoring.get("audit_log", {}).get("experience", "Passed screening threshold")
            })

        except Exception as e:
            print(f"    [ERROR] Failed to process {filename}: {e}")

    # 4. Sort Candidates by Final Score
    ranked_candidates.sort(key=lambda x: x["score"], reverse=True)

    # 5. Output Beautiful Ascii Table
    print("\n==========================================================================")
    print("                    AI CANDIDATE RANKING ASSESSMENT REPORT                 ")
    print("==========================================================================")
    print(f"{'Rank':<5} | {'Candidate Name':<22} | {'Exp (Yrs)':<9} | {'Score':<7} | {'Matched Skills'}")
    print("-" * 80)
    for i, cand in enumerate(ranked_candidates):
        skills_str = ", ".join(cand["skills_matched"]) if cand["skills_matched"] else "None"
        print(f"#{i+1:<4} | {cand['name']:<22} | {cand['parsed_experience']:<9} | {cand['score']:<7} | {skills_str}")
    print("==========================================================================")

    # 6. Accuracy benchmarking against Human Ground Truth
    gt_map = {}
    if os.path.exists(GT_PATH):
        try:
            with open(GT_PATH, "r", encoding="utf-8") as f:
                gt_map = json.load(f)
        except Exception as e:
            print(f"[WARNING] Could not parse ground truth: {e}")

    if gt_map:
        print("\n>>> Comparing AI Scores Against Human Ground Truth...")
        mae_accumulator = 0.0
        matching_count = 0
        
        print(f"{'Filename':<35} | {'AI Score':<8} | {'Human Score':<11} | {'Absolute Error'}")
        print("-" * 80)
        for cand in ranked_candidates:
            fn = cand["filename"]
            if fn in gt_map:
                ai_score = cand["score"]
                human_score = gt_map[fn]
                err = abs(ai_score - human_score)
                mae_accumulator += err
                matching_count += 1
                print(f"{fn:<35} | {ai_score:<8} | {human_score:<11} | {err:.2f}")
                
        if matching_count > 0:
            mae = mae_accumulator / matching_count
            accuracy_index = max(0.0, 100.0 - mae)
            
            print("-" * 80)
            print(f"Mean Absolute Error (MAE):     {mae:.2f} Points")
            print(f"Real-World Ranking Accuracy:    {accuracy_index:.1f}%")
            print("==========================================================================")
            
            # Write final benchmark results to report_data
            report_data = {
                "job_title": job_reqs["job_title"],
                "total_candidates": len(ranked_candidates),
                "ranking_accuracy_index": round(accuracy_index, 2),
                "mean_absolute_error": round(mae, 2),
                "candidates": ranked_candidates
            }
            with open(REPORT_PATH, "w", encoding="utf-8") as rf:
                json.dump(report_data, rf, indent=4)
            print(f"[REPORT] Detailed benchmark report saved to: {os.path.basename(REPORT_PATH)}")
    else:
        print("\n[NOTE] Create a 'ground_truth.json' file mapping CV filenames to recruiter scores to calculate accuracy percentages.")

if __name__ == "__main__":
    main()
