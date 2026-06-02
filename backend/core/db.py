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
    conn.commit()
    
    # Seed default admin user if not exists
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hiregrid.io").strip().lower()
    cursor.execute("SELECT * FROM users WHERE email = ?", (admin_email,))
    admin = cursor.fetchone()
    if not admin:
        admin_pass = os.environ.get("ADMIN_PASSWORD", "password123")
        if admin_pass == "password123":
            import logging
            logging.warning("SECURITY WARNING: Using default admin password 'password123'. Change ADMIN_PASSWORD in your .env file!")
        
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
