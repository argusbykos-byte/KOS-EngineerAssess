import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds default
});

// Separate instance for long-running operations (AI question generation takes 60-90 seconds)
const longRunningApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 180000, // 3 minutes for AI generation
});

// Extra-long timeout for operations that involve Kimi2 skill extraction (2-4 minutes)
const skillExtractionApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 300000, // 5 minutes for skill extraction
});

// Very long timeout for test generation (10-30 minutes - multiple Kimi2 API calls)
const testGenerationApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 1800000, // 30 minutes for test generation (multiple AI calls)
});

// Candidates
export const candidatesApi = {
  list: () => api.get("/candidates"),
  get: (id: number) => api.get(`/candidates/${id}`),
  // Use skillExtractionApi for create - Kimi2 skill extraction takes 2-4 minutes
  create: (data: FormData) =>
    skillExtractionApi.post("/candidates", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: number, data: object) => api.put(`/candidates/${id}`, data),
  delete: (id: number) => api.delete(`/candidates/${id}`),
  // Use skillExtractionApi for resume upload - Kimi2 skill extraction takes 2-4 minutes
  uploadResume: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("resume", file);
    return skillExtractionApi.post(`/candidates/${id}/upload-resume`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Tests
export const testsApi = {
  list: (status?: string) => api.get("/tests", { params: { status } }),
  get: (id: number) => api.get(`/tests/${id}`),
  getByToken: (token: string) => api.get(`/tests/token/${token}`),
  // Use testGenerationApi for test creation - Kimi2 question generation takes 10-30 minutes (multiple AI calls)
  create: (candidateId: number) =>
    testGenerationApi.post("/tests", { candidate_id: candidateId }),
  delete: (id: number) => api.delete(`/tests/${id}`),
  start: (token: string) => api.post(`/tests/token/${token}/start`),
  complete: (token: string) => api.post(`/tests/token/${token}/complete`),
  logAntiCheatEvent: (token: string, event: {
    event_type: "tab_switch" | "paste_attempt" | "code_copy" | "code_paste" | "copy_attempt" | "right_click" | "dev_tools_open" | "focus_loss";
    timestamp: string;
    chars?: number;
    lines?: number;
    details?: string;
  }) => api.post<{
    success: boolean;
    tab_switch_count: number;
    paste_attempt_count: number;
    copy_attempt_count: number;
    right_click_count: number;
    dev_tools_open_count: number;
    focus_loss_count: number;
    violation_score: number;
    warning_count: number;
    should_warn: boolean;
    is_disqualified: boolean;
    disqualification_reason: string | null;
  }>(`/tests/token/${token}/anti-cheat`, event),

  getAntiCheatConfig: () => api.get<{
    warning_threshold: number;
    disqualification_threshold: number;
    violation_weights: Record<string, number>;
  }>("/tests/anti-cheat/config"),

  // Break management
  startBreak: (token: string) => api.post<{
    success: boolean;
    message: string;
    remaining_break_time_seconds: number;
    max_single_break_seconds: number;
    break_start_time: string;
  }>(`/tests/token/${token}/break/start`),

  endBreak: (token: string) => api.post<{
    success: boolean;
    message: string;
    break_duration_seconds: number;
    remaining_break_time_seconds: number;
    total_used_break_time_seconds: number;
  }>(`/tests/token/${token}/break/end`),

  // NDA and Testing Integrity Agreement
  signAgreement: (token: string, data: {
    signature: string;
    integrity_agreed: boolean;
    nda_agreed: boolean;
  }) => api.post<{
    success: boolean;
    message: string;
    signed_at: string;
  }>(`/tests/token/${token}/agreement`, data),

  // Download signed NDA PDF
  downloadNdaPdf: (testId: number) => api.get(`/tests/${testId}/nda-pdf`, {
    responseType: 'blob'
  }),

  // Admin: Reset integrity monitoring counters
  resetTabSwitches: (testId: number) => api.post<{
    success: boolean;
    message: string;
    previous_count: number;
  }>(`/tests/${testId}/reset-tab-switches`),

  resetPasteAttempts: (testId: number) => api.post<{
    success: boolean;
    message: string;
    previous_count: number;
  }>(`/tests/${testId}/reset-paste-attempts`),

  // Admin: Reinstate a disqualified test (give candidate another chance)
  reinstateTest: (testId: number) => api.post<{
    success: boolean;
    message: string;
    previous_status: string;
    previous_reason: string | null;
    new_status: string;
    all_violations_cleared: boolean;
  }>(`/tests/${testId}/reinstate`),

  // Admin: Mark a test as completed (when in_progress but already scored)
  markCompleted: (testId: number) => api.post<{
    success: boolean;
    message: string;
    previous_status: string;
    new_status: string;
  }>(`/tests/${testId}/mark-completed`),
};

// Questions
export const questionsApi = {
  getByTest: (testId: number) => api.get(`/questions/test/${testId}`),
  get: (id: number) => api.get(`/questions/${id}`),
};

// Answers
export const answersApi = {
  submit: (data: {
    question_id: number;
    candidate_answer?: string;
    candidate_code?: string;
    time_spent_seconds?: number;
  }) => api.post("/answers/submit", data),
  saveDraft: (data: {
    question_id: number;
    candidate_answer?: string;
    candidate_code?: string;
  }) => api.post("/answers/draft", data),
  get: (id: number) => api.get(`/answers/${id}`),

  // Batch operations for better performance
  batchSaveDrafts: (drafts: Array<{
    question_id: number;
    candidate_answer?: string;
    candidate_code?: string;
  }>) => api.post("/answers/batch/draft", { drafts }),

  batchSubmit: (answers: Array<{
    question_id: number;
    candidate_answer?: string;
    candidate_code?: string;
    time_spent_seconds?: number;
  }>) => api.post("/answers/batch/submit", { answers }),

  // Real-time AI feedback
  getFeedback: (data: {
    question_id: number;
    candidate_answer?: string;
    candidate_code?: string;
  }) => api.post<{
    hints: string[];
    missing_points: string[];
    strengths: string[];
    status: string;
  }>("/answers/feedback", data),
};

// Reports
export const reportsApi = {
  list: () => api.get("/reports"),
  get: (id: number) => api.get(`/reports/${id}`),
  getByTest: (testId: number) => api.get(`/reports/test/${testId}`),
  // Use longRunningApi for report generation - Kimi2 evaluation takes 1-2 minutes
  generate: (testId: number) => longRunningApi.post(`/reports/generate/${testId}`),

  getRoleFit: (reportId: number) => api.get<{
    report_id: number;
    candidate_name: string;
    role_fits: Array<{
      role_id: string;
      role_title: string;
      fit_score: number;
      explanation: string;
      skill_dimensions: string[];
      is_current_role: boolean;
    }>;
    top_recommendation: {
      role_id: string;
      role_title: string;
      fit_score: number;
      explanation: string;
    } | null;
    ai_recommendation: {
      primary_recommendation: string;
      recommendation_summary: string;
      development_areas: string[];
      career_path_suggestions: string[];
    } | null;
  }>(`/reports/${reportId}/role-fit`),

  getCheatingLogs: (params?: { skip?: number; limit?: number; severity?: string }) =>
    api.get<{
      total: number;
      logs: Array<{
        test_id: number;
        candidate_name: string;
        candidate_email: string;
        test_status: string;
        tab_switch_count: number;
        paste_attempt_count: number;
        copy_attempt_count: number;
        right_click_count: number;
        dev_tools_open_count: number;
        focus_loss_count: number;
        total_violations: number;
        warning_count: number;
        is_disqualified: boolean;
        disqualification_reason: string | null;
        disqualified_at: string | null;
        violation_events: Array<{
          type: string;
          timestamp: string;
          details: string;
        }>;
        severity: "low" | "medium" | "high" | "critical";
        created_at: string;
        updated_at: string;
      }>;
    }>("/reports/cheating-logs", { params }),
};

// Certificates
export const certificatesApi = {
  generate: (reportId: number) => api.post<{
    id: number;
    report_id: number;
    certificate_id: string;
    candidate_name: string;
    test_date: string;
    track: string | null;
    score_tier: string;
    overall_score: number;
    verification_url: string | null;
    created_at: string;
    has_pdf: boolean;
  }>(`/certificates/generate/${reportId}`),

  getByReport: (reportId: number) => api.get<{
    id: number;
    report_id: number;
    certificate_id: string;
    candidate_name: string;
    test_date: string;
    track: string | null;
    score_tier: string;
    overall_score: number;
    verification_url: string | null;
    created_at: string;
    has_pdf: boolean;
  }>(`/certificates/report/${reportId}`),

  download: (reportId: number) => api.get(`/certificates/download/${reportId}`, {
    responseType: 'blob'
  }),

  verify: (certificateId: string) => api.get<{
    valid: boolean;
    certificate_id: string;
    candidate_name: string | null;
    test_date: string | null;
    track: string | null;
    score_tier: string | null;
    overall_score: number | null;
    issued_by: string;
    message: string | null;
  }>(`/certificates/verify/${certificateId}`),

  list: () => api.get("/certificates"),
};

// Feedback / Improvement Suggestions
export const feedbackApi = {
  submit: (data: {
    raw_feedback: string;
    test_access_token?: string;
  }) => api.post<{
    id: number;
    message: string;
    analysis: {
      is_valid: boolean;
      category: string;
      priority: string;
      can_auto_implement: boolean;
      suggested_action: string;
      extracted_content?: Record<string, unknown>;
      reasoning: string;
    } | null;
    auto_implemented: boolean;
    auto_implement_result?: {
      success: boolean;
      message: string;
      changes_made?: string[];
    };
  }>("/feedback/suggestion", data),

  // Admin endpoints
  list: (params?: {
    status?: string;
    category?: string;
    priority?: string;
    skip?: number;
    limit?: number;
  }) => api.get("/feedback/admin/suggestions", { params }),

  get: (id: number) => api.get(`/feedback/admin/suggestions/${id}`),

  update: (id: number, data: {
    status?: string;
    implementation_notes?: string;
  }) => api.put(`/feedback/admin/suggestions/${id}`, data),

  retryAutoImplement: (id: number) =>
    api.post(`/feedback/admin/suggestions/${id}/retry-auto-implement`),

  delete: (id: number) => api.delete(`/feedback/admin/suggestions/${id}`),
};

// Code Execution
export const codeApi = {
  execute: (data: {
    code: string;
    sample_data_key?: string;
  }) => api.post<{
    success: boolean;
    output: string;
    error: string | null;
    execution_time_ms: number;
    sample_data_used: string | null;
  }>("/code/execute", data),

  listSamples: () => api.get<{
    samples: Record<string, {
      description: string;
      variables: string[];
    }>;
  }>("/code/samples"),

  getSample: (key: string) => api.get<{
    key: string;
    data: Record<string, unknown>;
  }>(`/code/samples/${key}`),
};

// Challenges
export const challengesApi = {
  // Get challenge spec by track
  getSpec: (track: string) => api.get(`/challenges/spec/${track}`),

  // Get challenge submission for a test
  getSubmission: (testId: number) => api.get(`/challenges/submission/${testId}`),

  // Save task draft (auto-save)
  saveTaskDraft: (testId: number, data: {
    task_id: string;
    response_text?: string;
    response_code?: string;
  }) => api.post(`/challenges/task/draft?test_id=${testId}`, data),

  // Submit task for evaluation
  submitTask: (testId: number, data: {
    task_id: string;
    response_text?: string;
    response_code?: string;
  }) => api.post(`/challenges/task/submit?test_id=${testId}`, data),

  // Upload file deliverable
  uploadDeliverable: (testId: number, deliverableType: string, file: File, title?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    return api.post(
      `/challenges/deliverable/upload?test_id=${testId}&deliverable_type=${deliverableType}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  // Save text deliverable
  saveTextDeliverable: (testId: number, data: {
    deliverable_type: string;
    title?: string;
    inline_content?: string;
  }) => api.post(`/challenges/deliverable/text?test_id=${testId}`, data),

  // Delete deliverable
  deleteDeliverable: (deliverableId: number) =>
    api.delete(`/challenges/deliverable/${deliverableId}`),

  // Submit entire challenge
  submitChallenge: (testId: number) => api.post(`/challenges/submit/${testId}`),

  // Get presentation
  getPresentation: (testId: number) => api.get(`/challenges/presentation/${testId}`),
};

// Competitions
export const competitionsApi = {
  // List all competitions
  list: (status?: string) => api.get("/competitions", { params: { status } }),

  // Get competition by ID
  get: (id: number) => api.get(`/competitions/${id}`),

  // Create competition (admin)
  create: (data: {
    name: string;
    description?: string;
    screening_start_date?: string;
    screening_deadline?: string;
    live_competition_date?: string;
    max_participants?: number;
    qualified_count?: number;
    test_duration_minutes?: number;
    questions_count?: number;
  }) => api.post("/competitions", data),

  // Update competition (admin)
  update: (id: number, data: {
    name?: string;
    description?: string;
    screening_start_date?: string;
    screening_deadline?: string;
    live_competition_date?: string;
    max_participants?: number;
    qualified_count?: number;
    status?: string;
    test_duration_minutes?: number;
    questions_count?: number;
  }) => api.put(`/competitions/${id}`, data),

  // Delete competition
  delete: (id: number) => api.delete(`/competitions/${id}`),

  // Register for competition (public)
  register: (competitionId: number, data: { name: string; email: string }) =>
    api.post(`/competitions/${competitionId}/register`, data),

  // Get screening test (uses longRunningApi as it may trigger AI question generation)
  getScreening: (competitionId: number, token: string) =>
    longRunningApi.get(`/competitions/${competitionId}/screening/${token}`),

  // Start screening test (uses longRunningApi for AI question generation which takes 60-90 seconds)
  startScreening: (competitionId: number, token: string) =>
    longRunningApi.post(`/competitions/${competitionId}/screening/${token}/start`),

  // Submit screening test
  submitScreening: (competitionId: number, token: string, data: {
    answers: Array<{
      question_id: number;
      candidate_answer?: string;
      candidate_code?: string;
      time_spent_seconds: number;
    }>;
    time_per_question: Array<{
      question_id: number;
      time_seconds: number;
      question_category?: string;
    }>;
  }) => api.post(`/competitions/${competitionId}/screening/${token}/submit`, data),

  // Get screening results
  getResults: (competitionId: number, token: string) =>
    api.get(`/competitions/${competitionId}/results/${token}`),

  // Get rankings (admin)
  getRankings: (competitionId: number, skip?: number, limit?: number) =>
    api.get(`/competitions/${competitionId}/rankings`, { params: { skip, limit } }),

  // Qualify top candidates (admin)
  qualifyTopCandidates: (competitionId: number) =>
    api.post(`/competitions/${competitionId}/qualify`),
};

// Roles
export const rolesApi = {
  list: () => api.get<{
    roles: Array<{
      id: string;
      title: string;
      description: string;
      categories: string[];
      skill_dimensions: string[];
    }>;
  }>("/roles"),

  get: (roleId: string) => api.get<{
    id: string;
    title: string;
    description: string;
    categories: Record<string, { weight: number; count: number }>;
    focus_areas: string[];
    skill_dimensions: string[];
  }>(`/roles/${roleId}`),

  getCategories: (roleId: string) => api.get<{
    role_id: string;
    categories: string[];
    category_details: Record<string, string>;
  }>(`/roles/${roleId}/categories`),

  getSkillDimensions: (roleId: string) => api.get<{
    role_id: string;
    dimensions: string[];
  }>(`/roles/${roleId}/skill-dimensions`),

  getAllCategories: () => api.get<{
    categories: Record<string, string>;
  }>("/roles/categories/all"),
};

// Applications (Public Application Portal)
export const applicationsApi = {
  // Public endpoints
  submit: (formData: FormData) =>
    api.post<{
      application_token: string;
      message: string;
      next_step: string;
    }>("/applications/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  get: (token: string) =>
    api.get<{
      id: number;
      full_name: string;
      email: string;
      application_token: string;
      status: string;
      self_description: string | null;
      has_resume: boolean;
      skills_completed: boolean;
      skills_submitted_at: string | null;
      suggested_position: string | null;
      position_fit_score: number | null;
      created_at: string;
      updated_at: string;
      phone: string | null;
      location: string | null;
      graduation_date: string | null;
      preferred_start_date: string | null;
      availability: string | null;
      preferred_trial_date: string | null;
      motivation: string | null;
      admired_engineers: string | null;
      overall_self_rating: number | null;
      unique_trait: string | null;
      resume_filename: string | null;
      resume_text: string | null;
      skill_assessments: Array<{
        id: number;
        category: string;
        skill_name: string;
        self_rating: number | null;
        kimi_rating: number | null;
        kimi_confidence: number | null;
        kimi_evidence: string | null;
        created_at: string;
      }>;
    }>(`/applications/${token}`),

  getSkillsForm: (token: string) =>
    api.get<{
      categories: Record<
        string,
        Array<{
          category: string;
          skill_name: string;
          current_rating: number | null;
        }>
      >;
      total_skills: number;
      completed_skills: number;
    }>(`/applications/${token}/skills`),

  submitSkills: (
    token: string,
    assessments: Array<{
      category: string;
      skill_name: string;
      self_rating: number;
    }>
  ) =>
    api.post<{
      success: boolean;
      created: number;
      updated: number;
      message: string;
    }>(`/applications/${token}/skills`, { assessments }),

  analyze: (token: string, forceReanalyze: boolean = false) =>
    longRunningApi.post<{
      success: boolean;
      message: string;
      analysis: {
        suggested_position: string;
        position_fit_score: number;
        skill_ratings: Array<{
          skill_name: string;
          rating: number;
          confidence: number;
          evidence: string | null;
        }>;
        strengths: string[];
        areas_for_growth: string[];
        overall_assessment: string;
        recommendation: string;
        analysis_timestamp: string;
      } | null;
    }>(`/applications/${token}/analyze`, { force_reanalyze: forceReanalyze }),

  // Admin endpoints
  list: (params?: { status?: string; search?: string; page?: number; page_size?: number }) =>
    api.get<{
      items: Array<{
        id: number;
        full_name: string;
        email: string;
        self_description: string | null;
        status: string;
        suggested_position: string | null;
        position_fit_score: number | null;
        created_at: string;
        updated_at: string;
        has_resume: boolean;
        skills_completed: boolean;
      }>;
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>("/applications/admin/list", { params }),

  getAdmin: (id: number) =>
    api.get<{
      id: number;
      full_name: string;
      email: string;
      application_token: string;
      status: string;
      self_description: string | null;
      has_resume: boolean;
      skills_completed: boolean;
      skills_submitted_at: string | null;
      suggested_position: string | null;
      position_fit_score: number | null;
      created_at: string;
      updated_at: string;
      phone: string | null;
      location: string | null;
      graduation_date: string | null;
      preferred_start_date: string | null;
      availability: string | null;
      preferred_trial_date: string | null;
      motivation: string | null;
      admired_engineers: string | null;
      overall_self_rating: number | null;
      unique_trait: string | null;
      resume_filename: string | null;
      resume_text: string | null;
      kimi_analysis: Record<string, unknown> | null;
      admin_notes: string | null;
      reviewed_by: string | null;
      reviewed_at: string | null;
      candidate_id: number | null;
      skill_assessments: Array<{
        id: number;
        category: string;
        skill_name: string;
        self_rating: number | null;
        kimi_rating: number | null;
        kimi_confidence: number | null;
        kimi_evidence: string | null;
        created_at: string;
      }>;
    }>(`/applications/admin/${id}`),

  update: (
    id: number,
    data: {
      status?: string;
      admin_notes?: string;
      reviewed_by?: string;
      suggested_position?: string;
      position_fit_score?: number;
    }
  ) => api.put(`/applications/admin/${id}`, data),

  // Delete an application (admin only)
  delete: (id: number) =>
    api.delete<{
      success: boolean;
      message: string;
    }>(`/applications/admin/${id}`),

  // Use testGenerationApi for createCandidate - makes multiple Kimi2 API calls (90+ seconds)
  createCandidate: (
    id: number,
    data: {
      test_duration_hours?: number;
      categories?: string[];
      difficulty?: string;
    }
  ) =>
    testGenerationApi.post<{
      success: boolean;
      candidate_id: number;
      test_id: number;
      access_token: string;
      message: string;
    }>(`/applications/admin/${id}/create-candidate`, data),

  // Import candidates from Excel file
  importFromExcel: () =>
    longRunningApi.post<{
      success: boolean;
      message: string;
      stats: {
        new_candidates: number;
        updated_candidates: number;
        resumes_matched: number;
        resumes_missing: number;
        skills_imported: number;
        errors: number;
      };
      output: string;
    }>("/applications/admin/import"),

  // Get application by email (for checking Kimi2 analysis)
  getByEmail: (email: string) =>
    api.get<{
      id: number;
      email: string;
      has_kimi_analysis: boolean;
      fit_score: number | null;
      suggested_position: string | null;
      motivation: string | null;
      admired_engineers: string | null;
      unique_trait: string | null;
      overall_self_rating: number | null;
    }>(`/applications/by-email/${encodeURIComponent(email)}`),
};

// Specialization Tests
export const specializationApi = {
  // List available focus areas
  getFocusAreas: () =>
    api.get<Array<{
      id: string;
      name: string;
      description: string;
      sub_specialties: string[];
    }>>("/specialization/focus-areas"),

  // Generate a specialization test
  generate: (data: {
    candidate_id: number;
    focus_area: string;
    duration_minutes?: number;
    parent_test_id?: number;  // Optional: link to completed test for richer context
  }) =>
    testGenerationApi.post<{
      success: boolean;
      message: string;
      test_id: number | null;
      access_token: string | null;
      questions_generated: number;
    }>("/specialization/generate", data),

  // Get specialization results for a test
  getResults: (testId: number) =>
    api.get<{
      id: number;
      test_id: number;
      candidate_id: number;
      candidate_name: string | null;
      focus_area: string;
      primary_specialty: string | null;
      specialty_score: number | null;
      confidence: number | null;
      sub_specialties: Array<{
        name: string;
        score: number;
        rank: number;
        evidence: string | null;
      }>;
      recommended_tasks: string[];
      team_fit_analysis: string | null;
      created_at: string;
    }>(`/specialization/${testId}/results`),

  // Analyze completed specialization test
  analyze: (testId: number) =>
    longRunningApi.post<{
      success: boolean;
      message: string;
      primary_specialty: string | null;
      specialty_score: number | null;
    }>(`/specialization/${testId}/analyze`),

  // List all specialization results
  listResults: (params?: { focus_area?: string; page?: number; page_size?: number }) =>
    api.get<{
      items: Array<{
        id: number;
        test_id: number;
        access_token: string;
        candidate_id: number;
        candidate_name: string;
        focus_area: string;
        primary_specialty: string | null;
        specialty_score: number | null;
        status: string;
        created_at: string;
      }>;
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>("/specialization/results", { params }),

  // Get team builder data
  getTeamBuilder: (focusArea?: string) =>
    api.get<{
      candidates: Array<{
        id: number;
        test_id: number;
        candidate_id: number;
        candidate_name: string | null;
        focus_area: string;
        primary_specialty: string | null;
        specialty_score: number | null;
        confidence: number | null;
        sub_specialties: Array<{
          name: string;
          score: number;
          rank: number;
          evidence: string | null;
        }>;
        recommended_tasks: string[];
        team_fit_analysis: string | null;
        created_at: string;
      }>;
      composition_suggestions: Array<{
        candidate_id: number;
        candidate_name: string;
        primary_specialty: string;
        recommended_role: string;
        team_fit_notes: string;
        synergy_with: string[];
      }>;
      focus_area_groups: Record<string, number[]>;
    }>("/specialization/team-builder", { params: focusArea ? { focus_area: focusArea } : {} }),

  // Get candidate's specialization results
  getCandidateSpecializations: (candidateId: number) =>
    api.get<Array<{
      id: number;
      test_id: number;
      candidate_id: number;
      candidate_name: string | null;
      focus_area: string;
      primary_specialty: string | null;
      specialty_score: number | null;
      confidence: number | null;
      sub_specialties: Array<{
        name: string;
        score: number;
        rank: number;
        evidence: string | null;
      }>;
      recommended_tasks: string[];
      team_fit_analysis: string | null;
      created_at: string;
    }>>(`/specialization/candidate/${candidateId}`),
};

export default api;
