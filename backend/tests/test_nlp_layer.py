import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.nlp_layer import extract_all

def test_extract_all_basic():
    sample_text = """
    Jane Doe
    Email: jane.doe@example.com
    Phone: +1 555-0199
    Location: San Francisco, CA
    
    Education:
    Master of Science in Computer Science, Stanford University
    
    Experience:
    Senior Software Engineer at TechCorp (2020 - 2024)
    - Developed backend APIs using Python, FastAPI, and PostgreSQL.
    - Containerized microservices using Docker and Kubernetes on AWS.
    
    Skills:
    Python, FastAPI, PostgreSQL, Docker, Kubernetes, AWS, React, Git.
    """
    
    extracted = extract_all(sample_text)
    
    assert "email" in extracted
    assert extracted["email"] == "jane.doe@example.com"
    
    assert "phone" in extracted
    assert "555-0199" in extracted["phone"]
    
    assert "education" in extracted
    assert extracted["education"] in ["Master", "Bachelor", "PhD"]
    
    assert "skills" in extracted
    skills_found = [s.lower() for s in extracted["skills"]]
    assert "python" in skills_found
    assert "fastapi" in skills_found
    
    assert "skills_density" in extracted
    assert extracted["skills_density"].get("Python", 0) >= 1
    
    assert "experience" in extracted
    assert extracted["experience"] >= 3.0
