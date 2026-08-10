import sqlite3
import os
import json
import threading
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment configuration
parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
if os.path.exists(parent_env):
    load_dotenv(parent_env)
else:
    load_dotenv()

DB_URL = os.environ.get("DATABASE_URL")


def _is_sqlite_url(url: str) -> bool:
    return not url or url.startswith("sqlite://") or "sqlite" in url.lower()


USE_SQLITE = _is_sqlite_url(DB_URL)

# psycopg2 is only needed for Postgres deployments. Importing it unconditionally
# makes it a hard install dependency even for the SQLite path.
if USE_SQLITE:
    RealDictCursor = None
else:
    from psycopg2.extras import RealDictCursor
    from psycopg2 import pool as _pg_pool


def _sqlite_path() -> str:
    """Absolute path to the SQLite file, so the DB does not follow the CWD."""
    if DB_URL:
        clean_url = DB_URL.replace("sqlite:///", "").replace("sqlite://", "")
        if clean_url:
            return clean_url
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hiregrid.db")


# ── Postgres connection pool ──────────────────────────────────────────────────
# One connection per call exhausts the server's connection limit under load.
_pg_connection_pool = None
_pool_lock = threading.Lock()


def _get_pg_pool():
    global _pg_connection_pool
    if _pg_connection_pool is None:
        with _pool_lock:
            if _pg_connection_pool is None:
                _pg_connection_pool = _pg_pool.ThreadedConnectionPool(
                    minconn=1,
                    maxconn=int(os.environ.get("DB_POOL_MAX", "10")),
                    dsn=DB_URL,
                )
    return _pg_connection_pool


def get_db_connection():
    """
    Raw connection handle.

    Prefer the `db_session()` context manager, which guarantees the connection
    is returned to the pool and rolled back on error.
    """
    if USE_SQLITE:
        conn = sqlite3.connect(_sqlite_path())
        # SQLite ignores ON DELETE CASCADE unless foreign keys are switched on
        # per-connection.
        conn.execute("PRAGMA foreign_keys = ON")
        return conn
    return _get_pg_pool().getconn()


def release_db_connection(conn):
    if conn is None:
        return
    if USE_SQLITE:
        conn.close()
    else:
        _get_pg_pool().putconn(conn)


@contextmanager
def db_session(commit: bool = False):
    """
    Scoped connection. Commits once on clean exit when `commit=True`, rolls back
    on any exception, and always returns the connection to the pool.
    """
    conn = get_db_connection()
    try:
        yield conn
        if commit:
            conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_db_connection(conn)


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


# ── Skill list serialisation ──────────────────────────────────────────────────
# Skills were stored comma-joined, which corrupts any skill containing a comma
# (e.g. "C++, STL"). JSON round-trips exactly; the reader still understands the
# legacy comma format so existing rows keep working.

def _serialize_skills(skills: list) -> str:
    return json.dumps(list(skills or []))


def _deserialize_skills(raw) -> list:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    text = str(raw).strip()
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(s).strip() for s in parsed if str(s).strip()]
        except json.JSONDecodeError:
            pass
    return [s.strip() for s in text.split(",") if s.strip()]


def init_db():
    from core.auth import hash_password  # Avoid circular import
    conn = get_db_connection()
    try:
        _init_schema(conn, hash_password)
    finally:
        release_db_connection(conn)


def _init_schema(conn, hash_password):
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
        import logging
        is_production = os.environ.get("ENV", "development").strip().lower() == "production"
        admin_pass = os.environ.get("ADMIN_PASSWORD", "").strip()

        if not admin_pass:
            # Seeding a known-password account is how demo deployments get taken
            # over. In production, refuse; elsewhere, seed with a random password
            # that is printed once so local development still works.
            if is_production:
                logging.warning(
                    "ADMIN_PASSWORD is not set; skipping admin seed. "
                    "Create the first account via /api/auth/signup."
                )
                print("Database initialized (no admin seeded).")
                return
            import secrets as _secrets
            admin_pass = _secrets.token_urlsafe(16)
            logging.warning(
                "ADMIN_PASSWORD not set. Seeded %s with a random password: %s\n"
                "Set ADMIN_PASSWORD in your .env to choose your own.",
                admin_email, admin_pass,
            )
        elif admin_pass == "password123":
            if is_production:
                raise RuntimeError(
                    "ADMIN_PASSWORD is set to the shipped example value 'password123'. "
                    "Choose a real password before running with ENV=production."
                )
            logging.warning("SECURITY WARNING: Using the example admin password. Change ADMIN_PASSWORD in your .env file!")

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



# ──────────────────────────────────────────────────────────────────────────────
# Row mapping
# ──────────────────────────────────────────────────────────────────────────────

def _map_candidate_row(c_dict: dict) -> dict:
    return {
        "candidate_id": c_dict["id"],
        "candidate_name": c_dict["candidate_name"],
        "candidate_filename": c_dict["candidate_filename"],
        "file_path": c_dict["file_path"],
        "score": c_dict["score"],
        "score_breakdown": {
            "skills": c_dict.get("skills_score", 0.0) or 0.0,
            "semantic_similarity": c_dict.get("semantic_score", 0.0) or 0.0,
            "experience": c_dict.get("experience_score", 0.0) or 0.0,
            "education": c_dict.get("education_score", 0.0) or 0.0,
            "certifications": c_dict.get("certifications_score", 0.0) or 0.0,
            "location": c_dict.get("location_score", 0.0) or 0.0,
            "language": c_dict.get("language_score", 0.0) or 0.0,
        },
        "matched_skills": _deserialize_skills(c_dict.get("matched_skills")),
        "missing_skills": _deserialize_skills(c_dict.get("missing_skills")),
        "extracted_info": json.loads(c_dict["details_json"]) if c_dict.get("details_json") else {},
        "summary": c_dict.get("summary"),
        "status": c_dict.get("status"),
        "notes": c_dict.get("notes"),
    }


def _map_screening_row(sc_dict: dict, cands_list: list) -> dict:
    return {
        "id": sc_dict["id"],
        "job_title": sc_dict["job_title"],
        "job_description": sc_dict["job_description"],
        "required_skills": _deserialize_skills(sc_dict.get("required_skills")),
        "date": str(sc_dict["created_at"]),
        "candidates": cands_list,
        "total_candidates": len(cands_list),
    }


def _fetch_candidates(conn, screening_id: str) -> list:
    cursor = execute_query(
        conn,
        "SELECT * FROM candidates WHERE screening_id = %s ORDER BY score DESC",
        (screening_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    return [_map_candidate_row(dict(r)) for r in rows]


# ──────────────────────────────────────────────────────────────────────────────
# Users
# ──────────────────────────────────────────────────────────────────────────────

def db_get_user_by_email(email: str):
    with db_session() as conn:
        cursor = execute_query(conn, "SELECT * FROM users WHERE email = %s", (email.strip().lower(),))
        user = cursor.fetchone()
        cursor.close()
        return dict(user) if user else None


def db_create_user(email: str, name: str, password_hash: str, password_salt: str, role: str):
    try:
        with db_session(commit=True) as conn:
            is_sqlite = isinstance(conn, sqlite3.Connection)
            query = "INSERT INTO users (email, name, password_hash, password_salt, role) VALUES (%s, %s, %s, %s, %s)"
            params = (email.strip().lower(), name.strip(), password_hash, password_salt, role.strip())

            if is_sqlite:
                cursor = execute_query(conn, query, params)
                user_id = cursor.lastrowid
            else:
                cursor = execute_query(conn, query + " RETURNING id", params)
                user_id = cursor.fetchone()["id"]
            cursor.close()

            cursor = execute_query(conn, "SELECT * FROM users WHERE id = %s", (user_id,))
            new_user = cursor.fetchone()
            cursor.close()
            return dict(new_user) if new_user else None
    except Exception as e:
        print(f"Error creating user: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Screenings
# ──────────────────────────────────────────────────────────────────────────────

def db_get_screenings_by_user(email: str) -> list:
    with db_session() as conn:
        cursor = execute_query(
            conn,
            "SELECT * FROM screenings WHERE user_email = %s ORDER BY created_at DESC",
            (email.strip().lower(),),
        )
        screenings = [dict(sc) for sc in cursor.fetchall()]
        cursor.close()

        return [
            _map_screening_row(sc, _fetch_candidates(conn, sc["id"]))
            for sc in screenings
        ]


def db_get_screening_details(screening_id: str, email: str) -> dict:
    with db_session() as conn:
        cursor = execute_query(
            conn,
            "SELECT * FROM screenings WHERE id = %s AND user_email = %s",
            (screening_id, email.strip().lower()),
        )
        sc = cursor.fetchone()
        cursor.close()
        if not sc:
            return None

        return _map_screening_row(dict(sc), _fetch_candidates(conn, screening_id))


def db_create_screening(sc_id: str, email: str, job_title: str, job_desc: str, req_skills) -> bool:
    try:
        with db_session(commit=True) as conn:
            if isinstance(req_skills, str):
                req_skills = _deserialize_skills(req_skills)
            cursor = execute_query(
                conn,
                "INSERT INTO screenings (id, user_email, job_title, job_description, required_skills) VALUES (%s, %s, %s, %s, %s)",
                (sc_id, email.strip().lower(), job_title.strip(), job_desc.strip(), _serialize_skills(req_skills)),
            )
            cursor.close()
            return True
    except Exception as e:
        print(f"Error creating screening: {e}")
        return False


def db_delete_screening(screening_id: str, email: str) -> bool:
    """
    Delete a screening and its candidates atomically.

    Children are removed before the parent and both statements share a single
    transaction, so a crash mid-delete cannot leave orphaned candidate rows.
    """
    try:
        with db_session(commit=True) as conn:
            cursor = execute_query(
                conn,
                "SELECT id FROM screenings WHERE id = %s AND user_email = %s",
                (screening_id, email.strip().lower()),
            )
            row = cursor.fetchone()
            cursor.close()
            if not row:
                return False

            cursor = execute_query(conn, "DELETE FROM candidates WHERE screening_id = %s", (screening_id,))
            cursor.close()
            cursor = execute_query(conn, "DELETE FROM screenings WHERE id = %s", (screening_id,))
            cursor.close()
            return True
    except Exception as e:
        print(f"Error deleting screening: {e}")
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Candidates
# ──────────────────────────────────────────────────────────────────────────────

def db_create_candidate(cand_id: str, screening_id: str, name: str, filename: str, file_path: str,
                        score: float, breakdown: dict, matched: list, missing: list, yoe: float,
                        loc: str, summary: str, details_json: str, status: str = "Applied") -> bool:
    try:
        with db_session(commit=True) as conn:
            cursor = execute_query(
                conn,
                """INSERT INTO candidates (id, screening_id, candidate_name, candidate_filename, file_path, score,
                   skills_score, semantic_score, experience_score, education_score, certifications_score, location_score, language_score,
                   yoe, location, matched_skills, missing_skills, summary, details_json, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (cand_id, screening_id, name, filename, file_path, score,
                 breakdown.get("skills", 0.0), breakdown.get("semantic_similarity", 0.0),
                 breakdown.get("experience", 0.0), breakdown.get("education", 0.0),
                 breakdown.get("certifications", 0.0), breakdown.get("location", 0.0),
                 breakdown.get("language", 0.0),
                 yoe, loc, _serialize_skills(matched), _serialize_skills(missing),
                 summary, details_json, status),
            )
            cursor.close()
            return True
    except Exception as e:
        print(f"Error inserting candidate: {e}")
        return False


def db_get_candidate_owned(cand_id: str, email: str) -> dict:
    """
    Fetch a candidate only if it belongs to a screening owned by `email`.

    Every candidate-scoped endpoint must go through this. Looking a candidate up
    by id alone lets any authenticated user read or mutate another user's
    candidates just by knowing the id.
    """
    with db_session() as conn:
        cursor = execute_query(
            conn,
            """SELECT c.* FROM candidates c
               JOIN screenings s ON c.screening_id = s.id
               WHERE c.id = %s AND s.user_email = %s""",
            (cand_id, email.strip().lower()),
        )
        c = cursor.fetchone()
        cursor.close()
        return dict(c) if c else None


def db_update_candidate_status(cand_id: str, status: str, email: str) -> bool:
    """Scoped update: the WHERE clause itself enforces ownership."""
    try:
        with db_session(commit=True) as conn:
            cursor = execute_query(
                conn,
                """UPDATE candidates SET status = %s
                   WHERE id = %s AND screening_id IN (SELECT id FROM screenings WHERE user_email = %s)""",
                (status, cand_id, email.strip().lower()),
            )
            changed = cursor.rowcount
            cursor.close()
            return changed > 0
    except Exception as e:
        print(f"Error updating status: {e}")
        return False


def db_update_candidate_notes(cand_id: str, notes: str, email: str) -> bool:
    """Scoped update: the WHERE clause itself enforces ownership."""
    try:
        with db_session(commit=True) as conn:
            cursor = execute_query(
                conn,
                """UPDATE candidates SET notes = %s
                   WHERE id = %s AND screening_id IN (SELECT id FROM screenings WHERE user_email = %s)""",
                (notes, cand_id, email.strip().lower()),
            )
            changed = cursor.rowcount
            cursor.close()
            return changed > 0
    except Exception as e:
        print(f"Error updating notes: {e}")
        return False


def db_get_analytics(email: str) -> dict:
    """Aggregate counters across every screening owned by the user."""
    with db_session() as conn:
        email_clean = email.strip().lower()

        cursor = execute_query(
            conn, "SELECT COUNT(*) AS n FROM screenings WHERE user_email = %s", (email_clean,)
        )
        total_screenings = int(dict(cursor.fetchone())["n"])
        cursor.close()

        cursor = execute_query(
            conn,
            """SELECT COUNT(*) AS n FROM candidates c
               JOIN screenings s ON c.screening_id = s.id
               WHERE s.user_email = %s""",
            (email_clean,),
        )
        total_candidates = int(dict(cursor.fetchone())["n"])
        cursor.close()

        cursor = execute_query(
            conn,
            """SELECT c.score AS score FROM candidates c
               JOIN screenings s ON c.screening_id = s.id
               WHERE s.user_email = %s AND c.score > 0""",
            (email_clean,),
        )
        scores = [float(dict(r)["score"]) for r in cursor.fetchall()]
        cursor.close()

        shortlisted = sum(1 for s in scores if s >= 80.0)
        return {
            "total_screenings": total_screenings,
            "total_candidates": total_candidates,
            "scored_candidates": len(scores),
            "average_score": round(sum(scores) / len(scores), 2) if scores else 0.0,
            "max_score": round(max(scores), 2) if scores else 0.0,
            "shortlisted_candidates": shortlisted,
            "shortlist_yield_percent": round(shortlisted / len(scores) * 100, 1) if scores else 0.0,
        }
