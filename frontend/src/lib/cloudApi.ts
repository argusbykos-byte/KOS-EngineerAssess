// Cloud API client for public-facing endpoints (Vercel serverless functions)
// This bypasses the local backend and goes directly to Neon cloud database

export const cloudApplicationsApi = {
  submit: async (data: {
    full_name: string;
    email: string;
    phone?: string;
    location?: string;
    graduation_date?: string;
    preferred_start_date?: string;
    available_for_trial?: string;
    preferred_trial_date?: string;
    primary_role?: string;
    motivation?: string;
    engineers_admired?: string;
    self_rating?: number;
    unique_qualities?: string;
    resume_filename?: string;
    resume_data?: string;
    skills?: Record<string, number>;
  }) => {
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit application');
    }
    
    return result;
  },

  list: async () => {
    const response = await fetch('/api/applications');
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch applications');
    }
    
    return result;
  },

  healthCheck: async () => {
    const response = await fetch('/api/health');
    return response.json();
  },
};
