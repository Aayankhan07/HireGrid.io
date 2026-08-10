import re
from datetime import datetime

from core.skill_aliases import expand_skill_lexicon

# NOTE: extraction in this module is entirely regex//rule-based.
#
# A spaCy model (en_core_web_sm) used to be loaded here and was never called --
# `extract_candidate_name` documents why NER was abandoned for name detection
# (it tags section headers like "PROFESSIONAL SUMMARY" as PERSON entities), and
# no other function ever used it. Loading it cost ~50MB of resident memory and
# an install-time model download for nothing, so the load was removed.
#
# If NER is reintroduced, import spacy lazily inside the function that needs it
# rather than at module import.

EDUCATION_KEYWORDS = {
    "phd": "PhD", "ph.d": "PhD", "doctorate": "PhD",
    "master": "Master", "msc": "Master", "m.sc": "Master", "mba": "Master",
    "bachelor": "Bachelor", "bsc": "Bachelor", "b.sc": "Bachelor", "b.e": "Bachelor", "b.tech": "Bachelor",
    "high school": "High School", "secondary": "High School", "matriculation": "High School"
}

# Ordering used to pick the highest level when several are mentioned.
EDUCATION_RANK = {"Unknown": 0, "High School": 1, "Bachelor": 2, "Master": 3, "PhD": 4}

# Work-arrangement keywords are matched separately from place names.
WORK_ARRANGEMENT_PATTERN = r'\b(remote|on-site|onsite|hybrid)\b'

# A fixed city list can only ever recognise the cities on it. It is kept as a
# fast path for common cases; anything not listed falls through to the
# "City, Region" structural pattern below, so unlisted locations still resolve.
KNOWN_CITIES = [
    "karachi", "lahore", "islamabad", "rawalpindi", "peshawar", "quetta", "faisalabad",
    "multan", "hyderabad", "sialkot", "gujranwala", "abbottabad",
    "new york", "san francisco", "los angeles", "seattle", "austin", "boston", "chicago",
    "denver", "atlanta", "toronto", "vancouver", "montreal",
    "london", "manchester", "edinburgh", "dublin", "berlin", "munich", "amsterdam",
    "paris", "madrid", "barcelona", "lisbon", "warsaw", "stockholm", "zurich",
    "dubai", "abu dhabi", "doha", "riyadh", "istanbul", "cairo",
    "singapore", "hong kong", "tokyo", "seoul", "sydney", "melbourne",
    "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai",
    "sao paulo", "mexico city", "buenos aires", "nairobi", "lagos", "johannesburg",
]

# Explicitly labelled location lines, e.g. "Location: Rotterdam, NL".
LOCATION_LABEL_PATTERN = r'(?:location|based in|address|city)\s*[:\-]\s*([A-Z][a-zA-Z\.\- ]{2,40}(?:,\s*[A-Za-z\.\- ]{2,30})?)'

# Structural fallback: "Rotterdam, Netherlands" / "Austin, TX".
CITY_REGION_PATTERN = r'\b([A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?),\s*([A-Z]{2,3}|[A-Z][a-z]+(?:[ \-][A-Z][a-z]+)?)\b'

CERTIFICATION_KEYWORDS = [
    "aws certified", "azure certified", "google cloud", "pmp", "cissp", "ceh",
    "comptia", "ccna", "ccnp", "oracle certified", "certified scrum", "pmi",
    "tensorflow certificate", "pytorch certified", "databricks", "snowflake"
]

# Phrases that negate a skill mention. A resume saying "no Kubernetes exposure"
# or "looking to learn Rust" was previously credited with the skill, because
# matching was a bare substring search. That inflates scores for exactly the
# candidates a recruiter most needs filtered out.
NEGATION_CUES = (
    "no ", "not ", "never ", "without ", "lacking ", "lack of ", "minimal ",
    "limited ", "little ", "zero ", "none ", "no direct ", "no hands-on ",
    "willing to learn ", "wanting to learn ", "looking to learn ", "eager to learn ",
    "keen to learn ", "hoping to learn ", "plan to learn ", "planning to learn ",
    "would like to learn ", "interested in learning ", "currently learning ",
    "beginning to learn ", "yet to ", "have not ", "haven't ", "hasn't ", "hasn t ",
)

# Negations that follow the skill instead of preceding it: "Kubernetes was not
# used", "Rust — no experience". Checked in a short forward window.
TRAILING_NEGATION_CUES = (
    " was not ", " were not ", " is not ", " are not ", " not used",
    " no experience", " no exposure", " not required", " never used",
    " wasn't ", " weren't ", " isn't ", " aren't ",
)

# How far to look for a negation cue around a skill mention. Long enough to
# catch "no direct Kubernetes exposure", short enough that a negation in a
# neighbouring clause does not suppress an unrelated mention.
NEGATION_WINDOW = 40
TRAILING_NEGATION_WINDOW = 25


def _clip_to_clause(window: str, from_end: bool) -> str:
    """
    Trim a context window at the nearest sentence or bullet boundary.

    A negation in a different sentence says nothing about this mention, so the
    window must not read across one.
    """
    boundaries = (".", ";", "\n", "•", "|")
    if from_end:
        # Preceding context: keep only what follows the last boundary.
        for b in boundaries:
            idx = window.rfind(b)
            if idx != -1:
                window = window[idx + 1:]
    else:
        # Following context: keep only what precedes the first boundary.
        cut = len(window)
        for b in boundaries:
            idx = window.find(b)
            if idx != -1:
                cut = min(cut, idx)
        window = window[:cut]
    return window


def _is_negated(text_lower: str, match_start: int, match_end: int = None) -> bool:
    """Whether a skill mention sits inside a negating phrase, before or after."""
    before = text_lower[max(0, match_start - NEGATION_WINDOW):match_start]
    if any(cue in _clip_to_clause(before, from_end=True) for cue in NEGATION_CUES):
        return True

    if match_end is not None:
        after = text_lower[match_end:match_end + TRAILING_NEGATION_WINDOW]
        if any(cue in _clip_to_clause(after, from_end=False) for cue in TRAILING_NEGATION_CUES):
            return True

    return False


def extract_skills(text: str, skill_lexicon: set) -> list:
    """
    Find lexicon skills in the text, ignoring negated mentions.

    Every occurrence is checked: a skill negated once but claimed elsewhere
    ("no Kubernetes at Acme" ... "ran Kubernetes at Northwind") still counts.
    """
    text_lower = text.lower()
    extracted = set()
    for skill in skill_lexicon:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        for m in re.finditer(pattern, text_lower):
            if not _is_negated(text_lower, m.start(), m.end()):
                extracted.add(skill)
                break
    return list(extracted)

def extract_skills_with_density(text: str, skill_lexicon: set) -> dict:
    """
    Skill -> mention count, for density-weighted scoring.

    Negated mentions are excluded, so "no Kubernetes experience" does not push a
    candidate toward the "core expertise" density tier.
    """
    text_lower = text.lower()
    extracted = {}
    for skill in skill_lexicon:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        count = sum(
            1 for m in re.finditer(pattern, text_lower)
            if not _is_negated(text_lower, m.start(), m.end())
        )
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

EDUCATION_SECTION_PATTERN = re.compile(
    r'^\s*(education|academic background|academic qualifications|qualifications|'
    r'certifications?|courses?|training)\s*:?\s*$',
    re.IGNORECASE,
)

WORK_SECTION_PATTERN = re.compile(
    r'^\s*(experience|work experience|professional experience|employment|'
    r'employment history|career history|work history|projects?)\s*:?\s*$',
    re.IGNORECASE,
)


def strip_education_sections(text: str) -> str:
    """
    Remove education/certification blocks before date-range scanning.

    Degree date ranges ("BSc 2016 - 2020") look identical to employment ranges,
    so counting them inflates years-of-experience by the whole length of a
    candidate's schooling. Sections are detected by heading line, and scanning
    resumes at the next work-related heading.
    """
    lines = text.splitlines()
    kept = []
    in_education = False
    for line in lines:
        if EDUCATION_SECTION_PATTERN.match(line):
            in_education = True
            continue
        if WORK_SECTION_PATTERN.match(line):
            in_education = False
        if not in_education:
            kept.append(line)
    return "\n".join(kept)


def calculate_total_experience(text: str, exclude_education: bool = True) -> float:
    if exclude_education:
        text = strip_education_sections(text)
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
    """
    Highest education level mentioned anywhere in the document.

    Returning the first keyword hit made the result depend on dict ordering, so
    a resume mentioning "supervised master's students" while holding only a
    Bachelor reported Master. Scanning all matches and taking the maximum is
    order-independent.
    """
    text_lower = text.lower()
    best_level = "Unknown"
    best_rank = 0
    for keyword, level in EDUCATION_KEYWORDS.items():
        if keyword in text_lower:
            rank = EDUCATION_RANK.get(level, 0)
            if rank > best_rank:
                best_rank = rank
                best_level = level
    return best_level

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
    """
    Best-effort location, tried most reliable signal first:
      1. an explicit "Location:" label
      2. a known city name
      3. a "City, Region" pair in the header zone
      4. a bare work-arrangement keyword (remote/hybrid)
    """
    # 1. Explicit label wins — it is unambiguous when present.
    m_label = re.search(LOCATION_LABEL_PATTERN, text, re.IGNORECASE)
    if m_label:
        value = m_label.group(1).strip().rstrip(",").strip()
        if value:
            return value.title()

    text_lower = text.lower()

    # 2. Known city list.
    for city in KNOWN_CITIES:
        if re.search(r'\b' + re.escape(city) + r'\b', text_lower):
            return city.title()

    # 3. Structural "City, Region", restricted to the header where contact
    #    details live, so body prose does not produce false positives.
    m_city = re.search(CITY_REGION_PATTERN, text[:600])
    if m_city:
        return f"{m_city.group(1)}, {m_city.group(2)}".strip()

    # 4. Work arrangement only.
    m_arrangement = re.search(WORK_ARRANGEMENT_PATTERN, text_lower)
    if m_arrangement:
        return m_arrangement.group(0).title()

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

# Headings that mark the start of a new resume section. Used to split a CV into
# semantically coherent pieces for embedding.
SECTION_HEADING_PATTERN = re.compile(
    r'^\s*(summary|profile|objective|about(?:\s+me)?|experience|work\s+experience|'
    r'professional\s+experience|employment(?:\s+history)?|career\s+history|'
    r'work\s+history|education|academic\s+background|qualifications|skills|'
    r'technical\s+skills|core\s+competencies|projects?|selected\s+projects|'
    r'key\s+projects|certifications?|licenses?|publications?|awards?|'
    r'languages?|interests|volunteering|references)\s*:?\s*$',
    re.IGNORECASE,
)

# Chunk sizing. Below the minimum a chunk carries too little signal to embed
# meaningfully; above the maximum the model truncates anyway (most sentence
# transformers cap around 256-512 word pieces) and distinct roles blur together.
MIN_CHUNK_CHARS = 80
MAX_CHUNK_CHARS = 1200


def split_into_chunks(text: str,
                      min_chars: int = MIN_CHUNK_CHARS,
                      max_chars: int = MAX_CHUNK_CHARS) -> list:
    """
    Split a resume into section-aligned chunks for embedding.

    Scoring previously compared the job description against `text[:1500]` — for
    a two-page CV that is the header plus the most recent role, and everything
    after it was invisible to the semantic layer. A candidate whose relevant
    experience sits on page two scored as though it did not exist.

    Sections are detected by heading line. Long sections are split further on
    paragraph boundaries so a single sprawling "Experience" block does not
    exceed what the model can actually read. Short fragments are merged forward
    rather than embedded alone, since a two-word heading carries no signal.
    """
    if not text or not text.strip():
        return []

    lines = text.splitlines()
    sections: list = []
    current: list = []

    for line in lines:
        if SECTION_HEADING_PATTERN.match(line):
            if current:
                sections.append("\n".join(current).strip())
            # Keep the heading: it tells the model what follows.
            current = [line.strip()]
        else:
            current.append(line)
    if current:
        sections.append("\n".join(current).strip())

    # Split anything still too long on blank-line boundaries.
    sized: list = []
    for section in sections:
        if len(section) <= max_chars:
            sized.append(section)
            continue
        buffer = ""
        for para in re.split(r'\n\s*\n', section):
            para = para.strip()
            if not para:
                continue
            if len(buffer) + len(para) + 1 <= max_chars:
                buffer = f"{buffer}\n{para}" if buffer else para
            else:
                if buffer:
                    sized.append(buffer)
                # A single oversized paragraph is hard-split rather than dropped.
                while len(para) > max_chars:
                    sized.append(para[:max_chars])
                    para = para[max_chars:]
                buffer = para
        if buffer:
            sized.append(buffer)

    # Merge undersized fragments forward so every chunk carries real content.
    chunks: list = []
    for piece in sized:
        piece = piece.strip()
        if not piece:
            continue
        if chunks and len(piece) < min_chars:
            merged = f"{chunks[-1]}\n{piece}"
            if len(merged) <= max_chars:
                chunks[-1] = merged
                continue
        chunks.append(piece)

    # A resume with no recognisable headings still needs chunking.
    if not chunks:
        stripped = text.strip()
        return [stripped[i:i + max_chars] for i in range(0, len(stripped), max_chars)]

    return chunks


def extract_email(text: str) -> str:
    match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    return match.group(0) if match else ""

def extract_phone(text: str) -> str:
    """
    Find a contact phone number.

    The previous pattern required a strict 3-3-4 grouping, so common real
    formats such as "+1 555-0199" (3-4) or international numbers with varying
    group lengths were missed entirely. This accepts 7-15 digits with the usual
    separators, then validates the digit count.
    """
    candidates = re.findall(
        r'(?:(?<=\s)|^|(?<=[:|(]))\+?\d(?:[\d\-\.\s()]{5,18}\d)',
        text,
    )
    for raw in candidates:
        digits = re.sub(r'\D', '', raw)
        # E.164 allows up to 15 digits; 7 is the shortest usable local number.
        if 7 <= len(digits) <= 15:
            return raw.strip()
    return ""

DEFAULT_SKILL_LEXICON = {
    "Python", "FastAPI", "React", "Next.js", "Docker", "Kubernetes", "PostgreSQL",
    "MongoDB", "Redis", "TypeScript", "JavaScript", "HTML", "CSS", "Node.js", "Express",
    "Django", "Flask", "AWS", "Azure", "GCP", "Git", "GraphQL", "REST", "SQL", "Linux"
}

def extract_all(text: str, skill_lexicon: set = None, filename: str = "") -> dict:
    if skill_lexicon is None:
        skill_lexicon = DEFAULT_SKILL_LEXICON
    # Scan for alias surface forms too, otherwise a CV saying "ReactJS" yields no
    # React skill at all and the candidate is auto-rejected downstream.
    skill_lexicon = expand_skill_lexicon(skill_lexicon)
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

    # `summary` remains the leading excerpt for display and for callers that
    # want a single blob. `chunks` is what the semantic layer actually scores —
    # see split_into_chunks for why truncating at 1500 chars lost real signal.
    candidate_summary = text[:1500].strip()
    chunks = split_into_chunks(text)
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
        "chunks": chunks,
        "candidate_name": candidate_name,
        "raw_text": text
    }


