export type Priority = 'critical' | 'important' | 'nice';
export type WhereToAdd = Array<'skills' | 'summary' | 'bullet'>;

export type KeywordCandidate = {
  term: string;
  jdTf: number;                  // JD term frequency
  jdSection: 'requirements' | 'responsibilities' | 'preferred' | 'other';
  type: 'tool' | 'method' | 'domain' | 'metric' | 'soft';
  resumePresent: boolean;
  resumeFreq: number;
  evidence?: { supported: boolean; excerpt?: string }; // excerpt from resume
  synonyms?: string[];           // 0–2 normalized alternatives
  score: number;                 // deterministic score
  priority: Priority;
  where: WhereToAdd;             // suggested placement(s)
};

export type KeywordSnippet = {
  term: string;
  priority: Priority;
  where: WhereToAdd;
  supported: boolean;
  proof?: string;                // resume excerpt if supported
  proofSuggestion?: string;      // if not supported
  synonyms?: string[];
  snippets: {
    skills?: string;             // "A/B testing"
    summary?: string;            // ≤120 chars
    bullet?: string;             // ≤180 chars, quantified if possible
  };
};

export type KeywordPlan = {
  top10: KeywordSnippet[];
  // simple, familiar object the old panel can still show:
  keywords?: { jd: string[]; resume: string[]; missing: string[] };
};
