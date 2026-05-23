export interface User {
  email: string;
  name: string;
  role: string;
}

export interface Candidate {
  candidate_id: string;
  candidate_name: string;
  score: number;
  score_breakdown: Record<string, number>;
  matched_skills: string[];
  missing_skills: string[];
  extracted_info: Record<string, any>;
  summary: string;
}

export interface Screening {
  id: string;
  job_title: string;
  total_candidates: number;
  date: string;
  required_skills: string[];
  candidates: Candidate[];
}
