export type Role = "admin" | "hr" | "viewer";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Keyword {
  term: string;
  weight: number;
}

export interface Job {
  id: number;
  title: string;
  slug: string;
  area: string;
  description: string;
  keywords: Keyword[];
  min_years: number;
  is_open: boolean;
  candidate_count?: number;
}

export interface CandidateSummary {
  id: number;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  job_id: number;
  job_title: string;
  source_platform: string;
  vetting_status: string;
  pipeline_status: string;
  screening_score: number | null;
  preselection_outcome: string;
  latest_score_pct: number | null;
  latest_outcome: string | null;
  processing_state: string;
  referred: boolean;
}

export interface Scorecard {
  id: number;
  stage: string;
  scores: Record<string, number>;
  rationale: Record<string, string>;
  summary: string;
  norms_total: number;
  attitude_total: number;
  competency_total: number;
  total: number;
  percentage: number;
  outcome: string;
  scored_by: string;
  created_at: string;
}

export interface DemoProject {
  name: string;
  description: string;
  candidate_role: string;
  outcomes: string;
  tags: string[];
  tools_mentioned: string[];
  business_areas: string[];
  company_tools: string[];
  relevance: "high" | "medium" | "low";
  relevance_score: number;
  relevance_rationale: string;
}

export interface TranscriptAnalysis {
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  recommendation?: string;
  recommendation_rationale?: string;
  projects?: DemoProject[];
  key_strengths?: string[];
  gaps?: string[];
}

export interface Transcript {
  id: number;
  kind: "interview" | "demo";
  recording_url: string;
  status: string;
  error: string;
  analysis: TranscriptAnalysis;
  report_drive_url: string;
  text_preview: string;
  created_by: string;
  created_at: string;
}

export interface CandidateDetail extends CandidateSummary {
  previous_employment: string;
  employment_status: string;
  experience_years: number | null;
  notice_period: string;
  profile_url: string;
  linkedin_url: string;
  upwork_url: string;
  has_vpn: string;
  qca: Record<string, string | number>;
  trait_answers: Record<string, string>;
  cv_filename: string;
  has_cv_file: boolean;
  cv_text_preview: string;
  keyword_score: number | null;
  ai_skill_score: number | null;
  matched_keywords: string[];
  missing_keywords: string[];
  screening_summary: string;
  screening_details: {
    red_flags?: string[];
    matched_skills?: string[];
    missing_skills?: string[];
    relevant_years_experience?: number;
    meets_minimum_experience?: boolean;
    keyword_weight?: number;
  };
  interview_link: string;
  onboarding_link: string;
  drive_folder_url: string;
  cv_drive_url: string;
  notes: string;
  recruiter_name: string;
  referred_from_job: string | null;
  processing_error: string;
  sync_error: string;
  interviewed_on: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  contracted_on: string | null;
  scorecards: Scorecard[];
  transcripts: Transcript[];
  questionnaires: {
    id: number;
    status: string;
    questions: { id: string; criterion: string; question: string }[];
    answers: Record<string, string>;
    link: string;
    created_at: string;
    submitted_at: string | null;
  }[];
  referrals: {
    id: number;
    from_job: string;
    to_job: string | null;
    to_job_id: number | null;
    fit_score: number;
    reason: string;
    status: string;
    created_at: string;
  }[];
  events: {
    participant_id: number;
    event_id: number;
    title: string;
    kind: string;
    starts_at: string;
    meeting_link: string;
    status: string;
  }[];
  invites: { id: number; kind: string; status: string; link: string; created_at: string }[];
  activities: { id: number; actor: string; action: string; detail: string; created_at: string }[];
}

export interface EventParticipant {
  id: number;
  candidate_id: number;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  pipeline_status: string;
  status: string;
  note: string;
}

export interface RecruitmentEvent {
  id: number;
  title: string;
  kind: "interview" | "onboarding";
  job_id: number | null;
  job_title: string;
  starts_at: string;
  duration_minutes: number;
  meeting_link: string;
  capacity: number;
  seats_left: number;
  notes: string;
  status: string;
  created_by: string;
  participants?: EventParticipant[];
}

export interface Meta {
  pipeline_statuses: string[];
  vetting_statuses: string[];
  criteria: Record<string, string>;
}

export const SCORECARD_SECTIONS: { key: string; label: string; criteria: string[] }[] = [
  {
    key: "norms",
    label: "Norms & Values",
    criteria: ["intellectual_honesty", "integrity", "trustworthiness", "innovation", "continuous_improvement"],
  },
  {
    key: "attitude",
    label: "Attitudinal Traits",
    criteria: ["positivity", "proactiveness", "commitment", "reliable", "team_player"],
  },
  {
    key: "competency",
    label: "Competency",
    criteria: ["years_of_experience", "expertise", "achievements", "strengths", "method"],
  },
];
