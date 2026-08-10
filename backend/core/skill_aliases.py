"""
Skill name normalisation.

Resumes and job descriptions rarely spell a technology the same way. Matching
raw strings means "ReactJS" fails against a "React" requirement, which then
trips the zero-match auto-reject and discards a qualified candidate before the
semantic layer ever runs.

This maps surface forms onto a single canonical token so exact matching happens
on normalised names. It is a general lookup covering the whole lexicon, not a
special case for one domain.
"""

# canonical name -> surface forms that mean the same thing
_ALIAS_GROUPS = {
    "javascript": ["js", "ecmascript", "es6", "es2015"],
    "typescript": ["ts"],
    "react": ["reactjs", "react.js", "react js"],
    "vue": ["vuejs", "vue.js", "vue js"],
    "angular": ["angularjs", "angular.js", "angular 2+"],
    "node.js": ["node", "nodejs", "node js"],
    "next.js": ["next", "nextjs", "next js"],
    "express": ["expressjs", "express.js"],
    "postgresql": ["postgres", "psql", "postgre sql", "postgresql db"],
    "mongodb": ["mongo"],
    "kubernetes": ["k8s", "kube"],
    "docker": ["containerization", "containerisation"],
    "amazon web services": ["aws"],
    "google cloud": ["gcp", "google cloud platform"],
    "microsoft azure": ["azure"],
    "ci/cd": ["cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
    "machine learning": ["ml"],
    "deep learning": ["dl", "neural networks", "neural network"],
    "natural language processing": ["nlp"],
    "computer vision": [
        "cv", "opencv", "image processing", "object detection", "image recognition",
        "convolutional", "cnn", "vit", "vision transformer", "yolo", "segmentation",
        "diffusion", "gan", "generative adversarial",
    ],
    "scikit-learn": ["sklearn", "scikit learn"],
    "tensorflow": ["tf", "keras"],
    "pytorch": ["torch"],
    "rest api": ["rest", "restful", "restful api", "rest apis"],
    "graphql": ["gql"],
    "c#": ["csharp", "c sharp", ".net", "dotnet"],
    "c++": ["cpp", "cplusplus"],
    "golang": ["go"],
    "sql": ["t-sql", "tsql", "pl/sql", "plsql"],
    "agile": ["scrum", "kanban", "agile methodology"],
    "github actions": ["gh actions"],
    "objective-c": ["objc", "objective c"],
    "ruby on rails": ["rails", "ror"],
    "spring boot": ["springboot", "spring"],
}

# Flattened surface form -> canonical, built once at import.
_SURFACE_TO_CANONICAL = {}
for _canonical, _surfaces in _ALIAS_GROUPS.items():
    _SURFACE_TO_CANONICAL[_canonical] = _canonical
    for _s in _surfaces:
        _SURFACE_TO_CANONICAL[_s] = _canonical


def canonicalize_skill(skill: str) -> str:
    """Normalise one skill name. Unknown skills pass through lowercased."""
    if not skill:
        return ""
    key = skill.strip().lower()
    return _SURFACE_TO_CANONICAL.get(key, key)


def canonicalize_skills(skills) -> set:
    """Normalise a collection of skill names into a set of canonical tokens."""
    return {canonicalize_skill(s) for s in (skills or []) if s and s.strip()}


def expand_skill_lexicon(lexicon) -> set:
    """
    Widen a lexicon with every known surface form of the skills it contains.

    Extraction scans the resume for literal lexicon entries, so the surface
    forms have to be in the lexicon for "ReactJS" in a CV to be found at all.

    The caller's original spelling is preserved (callers and tests index results
    by the name they supplied, e.g. "Python" not "python"); only the additional
    alias forms are introduced in lowercase.
    """
    expanded = set()
    for skill in (lexicon or []):
        original = skill.strip()
        if not original:
            continue
        expanded.add(original)

        key = original.lower()
        canonical = _SURFACE_TO_CANONICAL.get(key)
        if canonical:
            for form in {canonical, *_ALIAS_GROUPS.get(canonical, [])}:
                if form != key:
                    expanded.add(form)
    return expanded


def skills_intersect(required, candidate) -> set:
    """Canonical-aware intersection of two skill collections."""
    return canonicalize_skills(required) & canonicalize_skills(candidate)
