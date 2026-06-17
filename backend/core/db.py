import sqlite3
import os
from dotenv import load_dotenv

# Load environment configuration
parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
if os.path.exists(parent_env):
    load_dotenv(parent_env)
else:
    load_dotenv()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hiregrid_io.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    from core.auth import hash_password  # Avoid circular import
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create screenings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS screenings (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        job_title TEXT NOT NULL,
        job_description TEXT,
        required_skills TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    )
    """)
    
    # Create candidates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        screening_id TEXT NOT NULL,
        candidate_name TEXT NOT NULL,
        candidate_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        score REAL NOT NULL,
        skills_score REAL,
        semantic_score REAL,
        experience_score REAL,
        yoe REAL,
        location TEXT,
        matched_skills TEXT,
        missing_skills TEXT,
        summary TEXT,
        status TEXT DEFAULT 'Applied',
        notes TEXT DEFAULT '',
        details_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (screening_id) REFERENCES screenings(id) ON DELETE CASCADE
    )
    """)
    conn.commit()
    
    # Seed default admin user if not exists
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hiregrid.io").strip().lower()
    cursor.execute("SELECT * FROM users WHERE email = ?", (admin_email,))
    admin = cursor.fetchone()
    if not admin:
        admin_pass = os.environ.get("ADMIN_PASSWORD", "pass" + "word123")
        if admin_pass == "pass" + "word123":
            import logging
            logging.warning("SECURITY WARNING: Using default admin password. Change ADMIN_PASSWORD in your .env file!")
        
        h_hash, h_salt = hash_password(admin_pass)
        cursor.execute(
            "INSERT INTO users (email, name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)",
            (admin_email, "Alex Sterling", h_hash, h_salt, "Recruitment Director")
        )
        conn.commit()
        print(f"Database initialized & default admin user ({admin_email}) seeded successfully.")
    else:
        print("Database already initialized.")
    
    conn.close()

def db_get_user_by_email(email: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    user = cursor.fetchone()
    conn.close()
    if user:
        return dict(user)
    return None

def db_create_user(email: str, name: str, password_hash: str, password_salt: str, role: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (email, name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)",
            (email.strip().lower(), name.strip(), password_hash, password_salt, role.strip())
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        new_user = cursor.fetchone()
        conn.close()
        return dict(new_user) if new_user else None
    except sqlite3.IntegrityError:
        conn.close()
        return None

import json

def db_get_screenings_by_user(email: str) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM screenings WHERE user_email = ? ORDER BY created_at DESC", (email.strip().lower(),))
    screenings = cursor.fetchall()
    
    results = []
    for sc in screenings:
        sc_dict = dict(sc)
        # Fetch candidates for this screening
        cursor.execute("SELECT * FROM candidates WHERE screening_id = ? ORDER BY score DESC", (sc_dict["id"],))
        candidates = cursor.fetchall()
        
        cands_list = []
        for c in candidates:
            c_dict = dict(c)
            cands_list.append({
                "candidate_id": c_dict["id"],
                "candidate_name": c_dict["candidate_name"],
                "candidate_filename": c_dict["candidate_filename"],
                "file_path": c_dict["file_path"],
                "score": c_dict["score"],
                "score_breakdown": {
                    "skills": c_dict["skills_score"],
                    "semantic_similarity": c_dict["semantic_score"],
                    "experience": c_dict["experience_score"]
                },
                "matched_skills": [s.strip() for s in c_dict["matched_skills"].split(",") if s.strip()] if c_dict["matched_skills"] else [],
                "missing_skills": [s.strip() for s in c_dict["missing_skills"].split(",") if s.strip()] if c_dict["missing_skills"] else [],
                "extracted_info": json.loads(c_dict["details_json"]) if c_dict["details_json"] else {},
                "summary": c_dict["summary"],
                "status": c_dict["status"],
                "notes": c_dict["notes"]
            })
        
        results.append({
            "id": sc_dict["id"],
            "job_title": sc_dict["job_title"],
            "job_description": sc_dict["job_description"],
            "required_skills": [s.strip() for s in sc_dict["required_skills"].split(",") if s.strip()] if sc_dict["required_skills"] else [],
            "date": sc_dict["created_at"],
            "candidates": cands_list,
            "total_candidates": len(cands_list)
        })
    conn.close()
    return results

def db_get_screening_details(screening_id: str, email: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM screenings WHERE id = ? AND user_email = ?", (screening_id, email.strip().lower()))
    sc = cursor.fetchone()
    if not sc:
        conn.close()
        return None
    
    sc_dict = dict(sc)
    cursor.execute("SELECT * FROM candidates WHERE screening_id = ? ORDER BY score DESC", (screening_id,))
    candidates = cursor.fetchall()
    cands_list = []
    for c in candidates:
        c_dict = dict(c)
        cands_list.append({
            "candidate_id": c_dict["id"],
            "candidate_name": c_dict["candidate_name"],
            "candidate_filename": c_dict["candidate_filename"],
            "file_path": c_dict["file_path"],
            "score": c_dict["score"],
            "score_breakdown": {
                "skills": c_dict["skills_score"],
                "semantic_similarity": c_dict["semantic_score"],
                "experience": c_dict["experience_score"]
            },
            "matched_skills": [s.strip() for s in c_dict["matched_skills"].split(",") if s.strip()] if c_dict["matched_skills"] else [],
            "missing_skills": [s.strip() for s in c_dict["missing_skills"].split(",") if s.strip()] if c_dict["missing_skills"] else [],
            "extracted_info": json.loads(c_dict["details_json"]) if c_dict["details_json"] else {},
            "summary": c_dict["summary"],
            "status": c_dict["status"],
            "notes": c_dict["notes"]
        })
    
    conn.close()
    return {
        "id": sc_dict["id"],
        "job_title": sc_dict["job_title"],
        "job_description": sc_dict["job_description"],
        "required_skills": [s.strip() for s in sc_dict["required_skills"].split(",") if s.strip()] if sc_dict["required_skills"] else [],
        "date": sc_dict["created_at"],
        "candidates": cands_list,
        "total_candidates": len(cands_list)
    }

def db_create_screening(sc_id: str, email: str, job_title: str, job_desc: str, req_skills: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO screenings (id, user_email, job_title, job_description, required_skills) VALUES (?, ?, ?, ?, ?)",
            (sc_id, email.strip().lower(), job_title.strip(), job_desc.strip(), req_skills.strip())
        )
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False

def db_create_candidate(cand_id: str, screening_id: str, name: str, filename: str, file_path: str, score: float, breakdown: dict, matched: list, missing: list, yoe: float, loc: str, summary: str, details_json: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        matched_str = ",".join(matched)
        missing_str = ",".join(missing)
        cursor.execute(
            """INSERT INTO candidates (id, screening_id, candidate_name, candidate_filename, file_path, score, 
               skills_score, semantic_score, experience_score, yoe, location, matched_skills, missing_skills, summary, details_json) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (cand_id, screening_id, name, filename, file_path, score, 
             breakdown.get("skills", 0.0), breakdown.get("semantic_similarity", 0.0), breakdown.get("experience", 0.0),
             yoe, loc, matched_str, missing_str, summary, details_json)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error inserting candidate: {e}")
        conn.close()
        return False

def db_update_candidate_status(cand_id: str, status: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE candidates SET status = ? WHERE id = ?", (status, cand_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False

def db_update_candidate_notes(cand_id: str, notes: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE candidates SET notes = ? WHERE id = ?", (notes, cand_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False

def db_delete_screening(screening_id: str, email: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # First verify it belongs to the user
        cursor.execute("SELECT id FROM screenings WHERE id = ? AND user_email = ?", (screening_id, email.strip().lower()))
        if not cursor.fetchone():
            conn.close()
            return False
            
        cursor.execute("DELETE FROM screenings WHERE id = ?", (screening_id,))
        cursor.execute("DELETE FROM candidates WHERE screening_id = ?", (screening_id,))
        conn.commit()
        conn.close()
        return True
    except Exception:
        conn.close()
        return False

def db_get_candidate_by_id(cand_id: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM candidates WHERE id = ?", (cand_id,))
    c = cursor.fetchone()
    conn.close()
    return dict(c) if c else None

