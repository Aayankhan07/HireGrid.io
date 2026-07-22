import psycopg2
from psycopg2.extras import RealDictCursor
import sqlite3
import os
import json
from dotenv import load_dotenv

# Load environment configuration
parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
if os.path.exists(parent_env):
    load_dotenv(parent_env)
else:
    load_dotenv()

DB_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    if not DB_URL or DB_URL.startswith("sqlite://") or "sqlite" in DB_URL.lower():
        db_path = "hiregrid.db"
        if DB_URL:
            clean_url = DB_URL.replace("sqlite:///", "").replace("sqlite://", "")
            if clean_url:
                db_path = clean_url
        conn = sqlite3.connect(db_path)
        return conn
    
    conn = psycopg2.connect(DB_URL)
    return conn

def execute_query(conn, query, params=None, commit=False):
    is_sqlite = isinstance(conn, sqlite3.Connection)
    if is_sqlite:
        conn.row_factory = sqlite3.Row
        query = query.replace("%s", "?")
        cursor = conn.cursor()
    else:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
    cursor.execute(query, params or ())
    if commit:
        conn.commit()
    return cursor


def init_db():
    from core.auth import hash_password  # Avoid circular import
    conn = get_db_connection()
    is_sqlite = isinstance(conn, sqlite3.Connection)
    
    id_type = "INTEGER PRIMARY KEY AUTOINCREMENT" if is_sqlite else "SERIAL PRIMARY KEY"
    
    # Create users table
    execute_query(conn, f"""
    CREATE TABLE IF NOT EXISTS users (
        id {id_type},
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """, commit=True)
    
    # Create screenings table
    execute_query(conn, """
    CREATE TABLE IF NOT EXISTS screenings (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        job_title TEXT NOT NULL,
        job_description TEXT,
        required_skills TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
    )
    """, commit=True)
    
    # Create candidates table
    execute_query(conn, """
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
        education_score REAL,
        certifications_score REAL,
        location_score REAL,
        language_score REAL,
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
    """, commit=True)
    
    # Run migrations/alter table check to ensure existing installations get the new columns
    new_cols = [
        ("education_score", "REAL"),
        ("certifications_score", "REAL"),
        ("location_score", "REAL"),
        ("language_score", "REAL")
    ]
    cursor = conn.cursor()
    for col_name, col_type in new_cols:
        try:
            if is_sqlite:
                cursor.execute(f"ALTER TABLE candidates ADD COLUMN {col_name} {col_type}")
                conn.commit()
            else:
                cursor.execute(f"ALTER TABLE candidates ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                conn.commit()
        except Exception:
            pass
    cursor.close()
    
    # Seed default admin user if not exists
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hiregrid.io").strip().lower()
    cursor_admin = execute_query(conn, "SELECT * FROM users WHERE email = %s", (admin_email,))
    admin = cursor_admin.fetchone()
    cursor_admin.close()
    
    if not admin:
        admin_pass = os.environ.get("ADMIN_PASSWORD", "password123")
        if admin_pass == "password123":
            import logging
            logging.warning("SECURITY WARNING: Using default admin password. Change ADMIN_PASSWORD in your .env file!")
        
        h_hash, h_salt = hash_password(admin_pass)
        cursor_insert = execute_query(
            conn,
            "INSERT INTO users (email, name, password_hash, password_salt, role) VALUES (%s, %s, %s, %s, %s)",
            (admin_email, "Alex Sterling", h_hash, h_salt, "Recruitment Director"),
            commit=True
        )
        cursor_insert.close()
        print(f"Database initialized & default admin user ({admin_email}) seeded successfully.")
    else:
        print("Database already initialized.")
    
    conn.close()

def db_get_user_by_email(email: str):
    conn = get_db_connection()
    cursor = execute_query(conn, "SELECT * FROM users WHERE email = %s", (email.strip().lower(),))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return dict(user) if user else None

def db_create_user(email: str, name: str, password_hash: str, password_salt: str, role: str):
    conn = get_db_connection()
    is_sqlite = isinstance(conn, sqlite3.Connection)
    try:
        query = "INSERT INTO users (email, name, password_hash, password_salt, role) VALUES (%s, %s, %s, %s, %s)"
        params = (email.strip().lower(), name.strip(), password_hash, password_salt, role.strip())
        
        if is_sqlite:
            cursor = execute_query(conn, query, params, commit=True)
            user_id = cursor.lastrowid
        else:
            query += " RETURNING id"
            cursor = execute_query(conn, query, params, commit=True)
            user_id = cursor.fetchone()["id"]
            
        cursor.close()
        
        cursor = execute_query(conn, "SELECT * FROM users WHERE id = %s", (user_id,))
        new_user = cursor.fetchone()
        cursor.close()
        conn.close()
        return dict(new_user) if new_user else None
    except Exception as e:
        print(f"Error creating user: {e}")
        conn.close()
        return None

def db_get_screenings_by_user(email: str) -> list:
    conn = get_db_connection()
    cursor = execute_query(conn, "SELECT * FROM screenings WHERE user_email = %s ORDER BY created_at DESC", (email.strip().lower(),))
    screenings = cursor.fetchall()
    cursor.close()
    
    results = []
    for sc in screenings:
        sc_dict = dict(sc)
        # Fetch candidates for this screening
        cursor_cands = execute_query(conn, "SELECT * FROM candidates WHERE screening_id = %s ORDER BY score DESC", (sc_dict["id"],))
        candidates = cursor_cands.fetchall()
        cursor_cands.close()
        
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
                    "skills": c_dict.get("skills_score", 0.0),
                    "semantic_similarity": c_dict.get("semantic_score", 0.0),
                    "experience": c_dict.get("experience_score", 0.0),
                    "education": c_dict.get("education_score", 0.0) or 0.0,
                    "certifications": c_dict.get("certifications_score", 0.0) or 0.0,
                    "location": c_dict.get("location_score", 0.0) or 0.0,
                    "language": c_dict.get("language_score", 0.0) or 0.0
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
            "date": str(sc_dict["created_at"]),
            "candidates": cands_list,
            "total_candidates": len(cands_list)
        })
    conn.close()
    return results

def db_get_screening_details(screening_id: str, email: str) -> dict:
    conn = get_db_connection()
    cursor = execute_query(conn, "SELECT * FROM screenings WHERE id = %s AND user_email = %s", (screening_id, email.strip().lower()))
    sc = cursor.fetchone()
    cursor.close()
    if not sc:
        conn.close()
        return None
    
    sc_dict = dict(sc)
    cursor_cands = execute_query(conn, "SELECT * FROM candidates WHERE screening_id = %s ORDER BY score DESC", (screening_id,))
    candidates = cursor_cands.fetchall()
    cursor_cands.close()
    
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
                "skills": c_dict.get("skills_score", 0.0),
                "semantic_similarity": c_dict.get("semantic_score", 0.0),
                "experience": c_dict.get("experience_score", 0.0),
                "education": c_dict.get("education_score", 0.0) or 0.0,
                "certifications": c_dict.get("certifications_score", 0.0) or 0.0,
                "location": c_dict.get("location_score", 0.0) or 0.0,
                "language": c_dict.get("language_score", 0.0) or 0.0
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
        "date": str(sc_dict["created_at"]),
        "candidates": cands_list,
        "total_candidates": len(cands_list)
    }

def db_create_screening(sc_id: str, email: str, job_title: str, job_desc: str, req_skills: str) -> bool:
    conn = get_db_connection()
    try:
        cursor = execute_query(
            conn,
            "INSERT INTO screenings (id, user_email, job_title, job_description, required_skills) VALUES (%s, %s, %s, %s, %s)",
            (sc_id, email.strip().lower(), job_title.strip(), job_desc.strip(), req_skills.strip()),
            commit=True
        )
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error creating screening: {e}")
        conn.close()
        return False

def db_create_candidate(cand_id: str, screening_id: str, name: str, filename: str, file_path: str, score: float, breakdown: dict, matched: list, missing: list, yoe: float, loc: str, summary: str, details_json: str) -> bool:
    conn = get_db_connection()
    try:
        matched_str = ",".join(matched)
        missing_str = ",".join(missing)
        cursor = execute_query(
            conn,
            """INSERT INTO candidates (id, screening_id, candidate_name, candidate_filename, file_path, score, 
               skills_score, semantic_score, experience_score, education_score, certifications_score, location_score, language_score,
               yoe, location, matched_skills, missing_skills, summary, details_json) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (cand_id, screening_id, name, filename, file_path, score, 
             breakdown.get("skills", 0.0), breakdown.get("semantic_similarity", 0.0), breakdown.get("experience", 0.0),
             breakdown.get("education", 0.0), breakdown.get("certifications", 0.0), breakdown.get("location", 0.0), breakdown.get("language", 0.0),
             yoe, loc, matched_str, missing_str, summary, details_json),
            commit=True
        )
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error inserting candidate: {e}")
        conn.close()
        return False

def db_update_candidate_status(cand_id: str, status: str) -> bool:
    conn = get_db_connection()
    try:
        cursor = execute_query(conn, "UPDATE candidates SET status = %s WHERE id = %s", (status, cand_id), commit=True)
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating status: {e}")
        conn.close()
        return False

def db_update_candidate_notes(cand_id: str, notes: str) -> bool:
    conn = get_db_connection()
    try:
        cursor = execute_query(conn, "UPDATE candidates SET notes = %s WHERE id = %s", (notes, cand_id), commit=True)
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating notes: {e}")
        conn.close()
        return False

def db_delete_screening(screening_id: str, email: str) -> bool:
    conn = get_db_connection()
    try:
        # First verify it belongs to the user
        cursor = execute_query(conn, "SELECT id FROM screenings WHERE id = %s AND user_email = %s", (screening_id, email.strip().lower()))
        row = cursor.fetchone()
        cursor.close()
        if not row:
            conn.close()
            return False
            
        cursor_del_sc = execute_query(conn, "DELETE FROM screenings WHERE id = %s", (screening_id,), commit=True)
        cursor_del_sc.close()
        cursor_del_cand = execute_query(conn, "DELETE FROM candidates WHERE screening_id = %s", (screening_id,), commit=True)
        cursor_del_cand.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error deleting screening: {e}")
        conn.close()
        return False

def db_get_candidate_by_id(cand_id: str) -> dict:
    conn = get_db_connection()
    cursor = execute_query(conn, "SELECT * FROM candidates WHERE id = %s", (cand_id,))
    c = cursor.fetchone()
    cursor.close()
    conn.close()
    return dict(c) if c else None
