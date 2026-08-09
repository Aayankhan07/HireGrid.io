import re
from datetime import datetime

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    nlp = None

EDUCATION_KEYWORDS = {
    "phd": "PhD", "ph.d": "PhD", "doctorate": "PhD",
    "master": "Master", "msc": "Master", "m.sc": "Master", "mba": "Master",
    "bachelor": "Bachelor", "bsc": "Bachelor", "b.sc": "Bachelor", "b.e": "Bachelor", "b.tech": "Bachelor",
    "high school": "High School", "secondary": "High School", "matriculation": "High School"
}

LOCATION_PATTERNS = [
    r'\b(karachi|lahore|islamabad|rawalpindi|peshawar|quetta|faisalabad|multan|hyderabad|sialkot)\b',
    r'\b(remote|on-site|hybrid|new york|san francisco|london|dubai|toronto|berlin|singapore)\b'
]

CERTIFICATION_KEYWORDS = [
    "aws certified", "azure certified", "google cloud", "pmp", "cissp", "ceh",
    "comptia", "ccna", "ccnp", "oracle certified", "certified scrum", "pmi",
    "tensorflow certificate", "pytorch certified", "databricks", "snowflake"
]

def extract_skills(text: str, skill_lexicon: set) -> list:
    text_lower = text.lower()
    extracted = set()
    for skill in skill_lexicon:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            extracted.add(skill)
    return list(extracted)

def extract_skills_with_density(text: str, skill_lexicon: set) -> dict:
    """Returns a dict of skill -> mention_count for density-weighted scoring."""
    text_lower = text.lower()
    extracted = {}
    for skill in skill_lexicon:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        matches = re.findall(pattern, text_lower)
        count = len(matches)
        if count > 0:
            extracted[skill] = count
    return extracted

def extract_candidate_name(text: str, filename: str = "") -> str:
    """
    Strict top-of-document regex name extractor.
    Avoids spaCy NER which is notorious for tagging resume section headers
    (e.g. "CAREER OPPORTUNITY", "PROFESSIONAL SUMMARY") as PERSON entities.

    Strategy:
      1. Scan only the first 500 characters (the resume header zone).
      2. Reject any line that contains common resume-header vocabulary.
      3. Accept the first line that matches the pattern for a human name:
         2–4 words, each starting with a capital letter.
      4. Fall back to a cleaned version of the filename.
    """
    BAD_KEYWORDS = {
        'resume', 'cv', 'curriculum', 'vitae', 'career', 'opportunity',
        'email', 'phone', 'mobile', 'tel', 'address', 'linkedin', 'github',
        'objective', 'summary', 'profile', 'experience', 'education',
        'skills', 'page', 'portfolio', 'contact', 'http', 'www', '@',
        'rag', 'pipeline', 'jalali', 'languages', 'certifications', 'projects'
    }

    top_lines = text[:500].splitlines()

    for line in top_lines:
        clean = line.strip()
        # Skip blank, very short, or very long lines
        if not clean or len(clean) < 4 or len(clean) > 40:
            continue
        # Skip if any bad keyword appears anywhere in the line
        if any(kw in clean.lower() for kw in BAD_KEYWORDS):
            continue
        # Skip lines with digits (phone numbers, years, addresses)
        if re.search(r'\d', clean):
            continue
        # Skip lines with punctuation that names don't have
        if re.search(r'[|@#<>/\\]', clean):
            continue
        # Match: 2–4 capitalised words (allows hyphens, e.g. "Mary-Jane Watson")
        if re.match(r'^[A-Z][a-zA-Z\-]+(?:\s+[A-Z][a-zA-Z\-]+){1,3}$', clean):
            return clean

    # Fallback: derive a readable name from the filename
    if filename:
        name = re.sub(r'\.(pdf|docx?|txt)$', '', filename, flags=re.IGNORECASE)
        name = re.sub(r'[_\-+\.]+', ' ', name).strip().title()
        if name:
            return name

    return ""


def parse_date_flexible(date_str: str, is_end_of_year: bool = False) -> datetime:
    date_str = date_str.strip().lower()
    
    if date_str in ['present', 'current', 'now', 'ongoing', 'active']:
        return datetime.now()
        
    # MM/YYYY, MM-YYYY, MM.YYYY
    m = re.match(r'^(\d{1,2})[/\-\.](\d{4})$', date_str)
    if m:
        month = int(m.group(1))
        year = int(m.group(2))
        if 1 <= month <= 12:
            return datetime(year, month, 1)
            
    # YYYY/MM, YYYY-MM, YYYY.MM
    m = re.match(r'^(\d{4})[/\-\.](\d{1,2})$', date_str)
    if m:
        year = int(m.group(1))
        month = int(m.group(2))
        if 1 <= month <= 12:
            return datetime(year, month, 1)
            
    # Month Name + Year
    month_mapping = {
        'jan': 1, 'january': 1,
        'feb': 2, 'february': 2,
        'mar': 3, 'march': 3,
        'apr': 4, 'april': 4,
        'may': 5,
        'jun': 6, 'june': 6,
        'jul': 7, 'july': 7,
        'aug': 8, 'august': 8,
        'sep': 9, 'september': 9, 'sept': 9,
        'oct': 10, 'october': 10,
        'nov': 11, 'november': 11,
        'dec': 12, 'december': 12
    }
    m = re.match(r'^([a-z]+)\.?\s+(\d{4})$', date_str)
    if m:
        mon_str = m.group(1)
        year = int(m.group(2))
        if mon_str in month_mapping:
            return datetime(year, month_mapping[mon_str], 1)
            
    # Standalone Year (e.g. "2020")
    m = re.match(r'^(\d{4})$', date_str)
    if m:
        year = int(m.group(1))
        month = 12 if is_end_of_year else 1
        return datetime(year, month, 1)
        
    raise ValueError(f"Could not parse date: {date_str}")

def merge_intervals(intervals: list) -> list:
    if not intervals:
        return []
    # Sort by start date
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for current in intervals[1:]:
        prev_start, prev_end = merged[-1]
        curr_start, curr_end = current
        if curr_start <= prev_end:
            # Overlap: merge by taking the maximum end date
            merged[-1] = (prev_start, max(prev_end, curr_end))
        else:
            merged.append(current)
    return merged

def calculate_total_experience(text: str) -> float:
    months_pattern = r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-zA-Z]*\.?'
    date_expr_pattern = (
        r'(?:' + months_pattern + r'\s+\d{4}'
        r'|\d{1,2}[/\-\.]\d{4}'
        r'|\d{4}[/\-\.]\d{1,2}'
        r'|\b\d{4}\b)'
    )
    end_date_expr_pattern = (
        r'(?:' + months_pattern + r'\s+\d{4}'
        r'|\d{1,2}[/\-\.]\d{4}'
        r'|\d{4}[/\-\.]\d{1,2}'
        r'|\b\d{4}\b'
        r'|Present|Current|Now|Ongoing|Active)'
    )
    range_pattern = rf'({date_expr_pattern})\s*(?:-|–|—|to|until)\s*({end_date_expr_pattern})'
    
    matches = re.finditer(range_pattern, text, re.IGNORECASE)
    intervals = []
    
    for match in matches:
        try:
            start_str = match.group(1).strip()
            end_str = match.group(2).strip()
            
            start_date = parse_date_flexible(start_str, is_end_of_year=False)
            end_date = parse_date_flexible(end_str, is_end_of_year=True)
            
            if start_date <= end_date:
                intervals.append((start_date, end_date))
        except ValueError:
            continue
            
    if not intervals:
        return 0.0
        
    merged = merge_intervals(intervals)
    total_months = 0
    for start_date, end_date in merged:
        delta = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
        if delta >= 0:
            # Include the end month itself
            total_months += (delta + 1)
            
    return round(total_months / 12.0, 1)

def extract_education(text: str) -> str:
    text_lower = text.lower()
    for keyword, level in EDUCATION_KEYWORDS.items():
        if keyword in text_lower:
            return level
    return "Unknown"

def extract_detailed_education(text: str) -> dict:
    level = extract_education(text)
    field = "Unknown"
    institution = "Unknown"
    
    # Pattern: Bachelor/Master/Degree in/of [Field]
    # Optionally skip science/arts/engineering to get the specific field (e.g. computer science)
    field_pattern = r'\b(?:bachelor|master|doctorate|phd|degree|major|specialization|bs|ms|bsc|msc|b\.e|b\.tech|mba|bba)\s+(?:of\s+)?(?:science|arts|engineering|commerce|laws|philosophy)?\s*(?:in|:)?\s*([a-z \t&]{3,50})\b'
    m_field = re.search(field_pattern, text.lower())
    if m_field:
        candidate_field = m_field.group(1).strip().title()
        candidate_field = re.split(r'[\n,;\.\-\(|]', candidate_field)[0].strip()
        if candidate_field and len(candidate_field) > 3:
            field = candidate_field
            
    # Try to find university/institution, making sure not to span across newlines (use [ \t] instead of \s)
    # Support both "Stanford University" and "University of Lahore" style names
    inst_pattern = r'\b(?:[A-Z][a-zA-Z \t,\.\-&]*(?:University|Institute|College|School|Academy|Polytechnic)|(?:University|Institute|College|School|Academy|Polytechnic)\s+(?:of|for|at)?\s*[A-Z][a-zA-Z \t,\.\-&]+)\b'
    m_inst = re.search(inst_pattern, text)
    if m_inst:
        institution = m_inst.group(0).strip()
    else:
        inst_pattern_fallback = r'\b(?:at|from)\s+([A-Z][a-zA-Z \t,\-&]{5,50})\b'
        m_inst_fb = re.search(inst_pattern_fallback, text)
        if m_inst_fb:
            institution = m_inst_fb.group(1).strip()
            
    # Quick sanity check: make sure institution is not just a newline or has newlines
    if institution != "Unknown":
        institution = re.split(r'[\n\r]', institution)[0].strip()
        
    return {
        "level": level,
        "field": field,
        "institution": institution
    }

def extract_location(text: str) -> str:
    text_lower = text.lower()
    for pattern in LOCATION_PATTERNS:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            return match.group(0).title()
    return ""

def extract_certifications(text: str) -> list:
    text_lower = text.lower()
    found = []
    for cert in CERTIFICATION_KEYWORDS:
        if cert in text_lower:
            found.append(cert.title())
    return found

def extract_languages(text: str) -> list:
    lang_section = re.search(
        r'(?:languages?|spoken|fluent in)[:\s]+([^\n\.]+)',
        text, re.IGNORECASE
    )
    if lang_section:
        langs = [l.strip() for l in re.split(r'[,;/|]', lang_section.group(1)) if l.strip()]
        return langs[:5]
    return []

def extract_projects(text: str) -> list:
    project_section = ""
    section_match = re.search(
        r'(?:projects|selected projects|key projects|academic projects|personal projects)[:\s\n]+(.*?)(?:\n\n[A-Z][A-Z\s]{4,15}(?:\n|:)|$)',
        text, re.IGNORECASE | re.DOTALL
    )
    if section_match:
        project_section = section_match.group(1)
        
    source_text = project_section if project_section else text
    
    verbs = r'(?:spearheaded|architected|engineered|optimized|designed|developed|implemented|built|created|led|integrated|migrated|deployed)'
    bullet_pattern = rf'(?:^\s*[\-\*•\d\.]*\s*)({verbs}\s+[^\n\.]{{15,120}})'
    
    highlights = []
    seen = set()
    
    for line in source_text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(bullet_pattern, line, re.IGNORECASE)
        if m:
            hl = m.group(1).strip()
            hl = re.sub(r'\s+', ' ', hl)
            hl_lower = hl.lower()
            if hl_lower not in seen:
                seen.add(hl_lower)
                highlights.append(hl)
                if len(highlights) >= 5:
                    break
                    
    if len(highlights) < 2:
        fallback_projects = re.findall(
            r'(?:project|built|developed|created|designed)[:\s]+([^\n\.]{15,80})',
            text, re.IGNORECASE
        )
        for fp in fallback_projects:
            fp_clean = fp.strip()
            fp_lower = fp_clean.lower()
            if fp_lower not in seen:
                seen.add(fp_lower)
                highlights.append(fp_clean)
                if len(highlights) >= 5:
                    break
                    
    return highlights[:5]

def extract_job_titles(text: str) -> list:
    modifiers = r'(?:junior|senior|lead|principal|associate|staff|head|director|manager|specialist|intern|graduate|trainee|entry-level)'
    fields = r'(?:software|backend|frontend|full\s*stack|mobile|cloud|devops|data|systems|qa|test|quality|it|security|operations|ml|ai|embedded|database|network)'
    roles = r'(?:engineer|developer|analyst|consultant|architect|manager|specialist|intern|lead|designer|programmer|practitioner|researcher|scientist|administrator|technician|representative)'
    
    title_pattern = rf'\b{modifiers}\s+(?:{fields}\s+)?{roles}\b|\b{fields}\s+{roles}\b|\b{roles}\b'
    
    matches = re.finditer(title_pattern, text, re.IGNORECASE)
    titles = []
    seen = set()
    BAD_TITLES = {"experience", "skills", "education", "summary", "projects", "certifications", "languages", "contact", "about me", "profile"}
    
    for match in matches:
        title = match.group(0).strip().title()
        title_clean = re.sub(r'\s+', ' ', title)
        title_lower = title_clean.lower()
        
        if len(title_clean) > 5 and title_lower not in BAD_TITLES:
            if title_lower not in seen:
                seen.add(title_lower)
                titles.append(title_clean)
                if len(titles) >= 3:
                    break
                    
    return titles

def extract_email(text: str) -> str:
    match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    return match.group(0) if match else ""

def extract_phone(text: str) -> str:
    pattern = r'\b(?:\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b'
    match = re.search(pattern, text)
    return match.group(0) if match else ""

DEFAULT_SKILL_LEXICON = {
    "Python", "FastAPI", "React", "Next.js", "Docker", "Kubernetes", "PostgreSQL",
    "MongoDB", "Redis", "TypeScript", "JavaScript", "HTML", "CSS", "Node.js", "Express",
    "Django", "Flask", "AWS", "Azure", "GCP", "Git", "GraphQL", "REST", "SQL", "Linux"
}

def extract_all(text: str, skill_lexicon: set = None, filename: str = "") -> dict:
    if skill_lexicon is None:
        skill_lexicon = DEFAULT_SKILL_LEXICON
    skills = extract_skills(text, skill_lexicon)
    experience = calculate_total_experience(text)
    education = extract_education(text)
    education_details = extract_detailed_education(text)
    location = extract_location(text)
    certifications = extract_certifications(text)
    languages = extract_languages(text)
    projects = extract_projects(text)
    past_titles = extract_job_titles(text)
    email = extract_email(text)
    phone = extract_phone(text)

    candidate_summary = text[:1500].strip()
    candidate_name = extract_candidate_name(text, filename)
    skills_density = extract_skills_with_density(text, skill_lexicon)

    return {
        "skills": skills,
        "skills_density": skills_density,
        "experience": experience,
        "education": education,
        "education_details": education_details,
        "location": location,
        "certifications": certifications,
        "languages": languages,
        "projects": projects,
        "past_titles": past_titles,
        "email": email,
        "phone": phone,
        "summary": candidate_summary,
        "candidate_name": candidate_name,
        "raw_text": text
    }


