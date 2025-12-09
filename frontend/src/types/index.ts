export interface Candidate {
  id: number;
  name: string;
  email: string;
  resume_path: string | null;
  extracted_skills: string[] | null;
  test_duration_hours: number;
  categories: string[];
  difficulty: string;
  created_at: string;
  updated_at: string;
  tests?: TestSummary[];
}

export interface TestSummary {
  id: number;
  access_token: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  overall_score: number | null;
  created_at?: string;
}

export interface Test {
  id: number;
  candidate_id: number;
  access_token: string;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number;
  status: string;
  current_section: string | null;
  created_at: string;
}

export interface TestWithQuestions extends Test {
  candidate_name: string;
  candidate_email: string;
  categories: string[];
  difficulty: string;
  questions_by_section: Record<string, Question[]>;
  time_remaining_seconds: number | null;
}

export interface Question {
  id: number;
  test_id?: number;
  category: string;
  section_order?: number;
  question_order: number;
  question_text: string;
  question_code: string | null;
  hints?: string[] | null;
  max_score: number;
  is_answered?: boolean;
  expected_answer?: string | null;
  answer?: Answer | null;
  created_at?: string;
  // Draft auto-save fields
  draft_answer?: string | null;
  draft_code?: string | null;
}

export interface Answer {
  id: number;
  question_id?: number;
  candidate_answer: string | null;
  candidate_code: string | null;
  score: number | null;
  feedback: string | null;
  ai_evaluation?: string | null;
  submitted_at: string | null;
  evaluated_at?: string | null;
  time_spent_seconds?: number | null;
  is_suspiciously_fast?: boolean | null;
  previous_score?: number | null;
}

export interface Report {
  id: number;
  test_id: number;
  overall_score: number | null;
  recommendation: string | null;
  brain_teaser_score: number | null;
  coding_score: number | null;
  code_review_score: number | null;
  system_design_score: number | null;
  signal_processing_score: number | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  detailed_feedback: string | null;
  ai_summary: string | null;
  generated_at: string;
  candidate_name?: string;
  candidate_email?: string;
  test_duration_hours?: number;
  categories?: string[];
  difficulty?: string;
  // Anti-cheat data
  tab_switch_count?: number | null;
  tab_switch_timestamps?: string[] | null;
  paste_attempt_count?: number | null;
}

export type TestStatus = "pending" | "in_progress" | "completed" | "expired";

export type Difficulty = "junior" | "mid" | "senior";

export type Category =
  | "backend"
  | "ml"
  | "fullstack"
  | "python"
  | "react"
  | "signal_processing";

export type QuestionCategory =
  | "brain_teaser"
  | "coding"
  | "code_review"
  | "system_design"
  | "signal_processing";

// Challenge-based assessment types
export type Track = "signal_processing" | "llm";

export interface ChallengeTask {
  id: string;
  title: string;
  description: string;
  requirements: string[];
}

export interface AutoPresentation {
  enabled: boolean;
  sections: string[];
}

export interface ChallengeSpec {
  track: Track;
  title: string;
  short_summary: string;
  tasks: ChallengeTask[];
  deliverables: string[];
  auto_presentation: AutoPresentation;
  estimated_time_hours: number;
}

export interface TaskResponse {
  id: number;
  task_id: string;
  response_text: string | null;
  response_code: string | null;
  is_submitted: boolean;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  version: number;
  edit_count: number;
  previous_score: number | null;
  needs_resubmit: boolean;
}

export interface Deliverable {
  id: number;
  deliverable_type: string;
  title: string | null;
  file_name: string | null;
  content_type: string | null;
  inline_content: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface ChallengeSubmission {
  id: number;
  test_id: number;
  track: Track;
  is_submitted: boolean;
  submitted_at: string | null;
  overall_score: number | null;
  overall_feedback: string | null;
  presentation_generated_at: string | null;
  task_responses: TaskResponse[];
  deliverables: Deliverable[];
  created_at: string;
}

export interface PresentationSlide {
  title: string;
  content: string;
  notes: string | null;
}

export interface PresentationData {
  title: string;
  candidate_name: string;
  track: Track;
  slides: PresentationSlide[];
  generated_at: string | null;
}

// Extended test type with challenge support
export interface TestWithChallenge extends Test {
  candidate_name: string;
  candidate_email: string;
  track: Track | null;
  challenge_spec: ChallengeSpec | null;
  challenge_submission: ChallengeSubmission | null;
  time_remaining_seconds: number | null;
}
