import os
import sys
import uuid
import json

# Ensure root backend dir is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.db import init_db, db_get_user_by_email, db_create_user, db_create_screening, db_create_candidate
from core.auth import hash_password

def seed():
    print("[+] Initializing HireGrid.io Database Seeder...")
    init_db()
    
    # 1. Seed Demo Recruiter Account
    demo_email = "demo.recruiter@hiregrid.io"
    existing_user = db_get_user_by_email(demo_email)
    
    if not existing_user:
        h_hash, h_salt = hash_password("demo1234")
        user = db_create_user(
            email=demo_email,
            name="Demo Recruiter",
            password_hash=h_hash,
            password_salt=h_salt,
            role="Recruitment Lead"
        )
        print(f"[OK] Created demo user: {demo_email}")
    else:
        print(f"[INFO] Demo user already exists: {demo_email}")
        
    # 2. Seed Sample Job Screening Run
    screening_id = "scr_seed_demo_01"
    job_title = "Senior Full-Stack Engineer (Python & React)"
    job_description = "Seeking an experienced Senior Full-Stack Engineer skilled in Python, FastAPI, React, Next.js, Docker, and PostgreSQL."
    required_skills = "Python, FastAPI, React, Next.js, Docker, PostgreSQL"
    
    db_create_screening(
        sc_id=screening_id,
        email=demo_email,
        job_title=job_title,
        job_desc=job_description,
        req_skills=required_skills
    )
    print(f"[OK] Created screening run: {screening_id} - '{job_title}'")

    
    # 3. Seed Sample Candidates
    sample_candidates = [
        {
            "candidate_name": "Sarah Jenkins",
            "filename": "sarah_jenkins_resume.pdf",
            "score": 92.5,
            "breakdown": {
                "skills": 95.0,
                "semantic_similarity": 90.0,
                "experience": 100.0,
                "education": 100.0,
                "certifications": 80.0,
                "location": 100.0,
                "language": 100.0
            },
            "yoe": 6.5,
            "location": "San Francisco, CA",
            "matched_skills": ["Python", "FastAPI", "React", "Docker", "PostgreSQL"],
            "missing_skills": ["Next.js"],
            "summary": "Sarah Jenkins shows strong overall fit. Matches 5 required skills."
        },
        {
            "candidate_name": "Marcus Vance",
            "filename": "marcus_vance_resume.pdf",
            "score": 84.0,
            "breakdown": {
                "skills": 83.3,
                "semantic_similarity": 85.0,
                "experience": 80.0,
                "education": 100.0,
                "certifications": 50.0,
                "location": 100.0,
                "language": 100.0
            },
            "yoe": 4.0,
            "location": "Austin, TX",
            "matched_skills": ["Python", "FastAPI", "Next.js", "Docker"],
            "missing_skills": ["React", "PostgreSQL"],
            "summary": "Marcus Vance shows strong fit. Solid backend expertise."
        }
    ]
    
    for cand in sample_candidates:
        cand_id = f"cand_{uuid.uuid4().hex[:8]}"
        db_create_candidate(
            cand_id=cand_id,
            screening_id=screening_id,
            name=cand["candidate_name"],
            filename=cand["filename"],
            file_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", cand["filename"]),
            score=cand["score"],
            breakdown=cand["breakdown"],
            matched=cand["matched_skills"],
            missing=cand["missing_skills"],
            yoe=cand["yoe"],
            loc=cand["location"],
            summary=cand["summary"],
            details_json=json.dumps({"email": f"{cand['candidate_name'].lower().replace(' ', '.')}@example.com"})
        )
        print(f"  |- Saved candidate: {cand['candidate_name']} ({cand['score']}%)")

    print("[DONE] Database seeding complete!")

if __name__ == "__main__":
    seed()
