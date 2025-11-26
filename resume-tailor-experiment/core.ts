import OpenAI from 'openai';

// =============================================================================
// OPENAI CLIENT (lazy initialization)
// =============================================================================

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// =============================================================================
// TYPES
// =============================================================================

export interface ResumeExperienceEntry {
  role: string;
  company: string;
  location?: string | null;
  start?: string | null;
  end?: string | null;
  bullets: string[];
}

export interface ResumeEducationEntry {
  school: string;
  degree: string;
  details?: string | null;
}

export interface ResumeSkills {
  product?: string[];
  technical?: string[];
  domain?: string[];
  [key: string]: string[] | undefined;
}

export interface ResumeJSON {
  summary?: string | null;
  experience: ResumeExperienceEntry[];
  education?: ResumeEducationEntry[];
  skills?: ResumeSkills;
  projects?: string[];
  certifications?: string[];
}

export interface TailoredResumeResult {
  finalResume: ResumeJSON;
  matchScore?: number;
  keyChanges: string[];
  issues?: { type: string; description: string }[];
}

// =============================================================================
// HUMAN-FIRST STYLE CONSTANT
// =============================================================================

const HUMAN_FIRST_STYLE = `
You write resume bullets that are clear, human, and credible.

NON-NEGOTIABLE RULES:
- Max 24 words per bullet.
- Max 2 clauses (split by commas/semicolons).
- Structure: Problem → Action → Result.
- Preserve ALL metrics from original bullets (%, $, user counts, time reductions, Xx).
- Do NOT invent new metrics or specific numbers.
- Do NOT invent context (no "rough idea", "urgent crisis", etc. unless present).
- Tone: crisp, analytical, founder-like, professional.

FORBIDDEN LANGUAGE (remove or replace if present):
- "alignment", "stakeholders", "workflows", "ceremonies", "synergy", "end-to-end",
  "leveraged", "utilized", "spearheaded", "orchestrated".

If an original bullet is already clear, short, and metric-driven, keep it close to the original.
Clarity > keyword density.
`;

// =============================================================================
// CALL #1: PARSE RESUME TO JSON
// =============================================================================

async function parseResumeToJSON(rawResume: string): Promise<ResumeJSON> {
  const systemPrompt = `You are an expert resume parser.

Your job is to convert a free-form resume into a strict JSON structure.

RULES:
- Do NOT invent accomplishments, companies, or dates. Only use what is present.
- If a field is missing (e.g., no summary), omit it or set it to null.
- Preserve bullets as separate strings. Do not merge or rewrite them.
- Try to extract start/end dates when available. Use ISO-like "YYYY-MM" when possible.
- Use this JSON shape:

{
  "summary": string | null,
  "experience": [
    {
      "role": string,
      "company": string,
      "location": string | null,
      "start": string | null,
      "end": string | null,
      "bullets": string[]
    }
  ],
  "education": [
    {
      "school": string,
      "degree": string,
      "details": string | null
    }
  ],
  "skills": {
    "product": string[],
    "technical": string[],
    "domain": string[]
  },
  "projects": string[],
  "certifications": string[]
}

- It's OK if some arrays are empty or missing.
- Only include fields you can infer from the text.`;

  const userPrompt = `RESUME:\n${rawResume}\n\nConvert this resume into the JSON format specified.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI in parseResumeToJSON');

  const parsed = JSON.parse(content);

  // Basic normalization: ensure experience array exists
  if (!parsed.experience || !Array.isArray(parsed.experience)) {
    parsed.experience = [];
  }

  return parsed as ResumeJSON;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function extractMetrics(text: string): string[] {
  const metrics: string[] = [];

  // Percentages: 15%, 30%, etc.
  const percentages = text.match(/\d+(?:\.\d+)?%/g) || [];
  metrics.push(...percentages);

  // Dollar values: $4.1M, $200K, $12M ARR
  const dollars = text.match(/\$[\d,.]+[KMB]?(?:\s*ARR)?/gi) || [];
  metrics.push(...dollars);

  // User counts: 100K users, 110K MAU, 50k daily users
  const users = text.match(/\d+[KMk]?\+?\s*(?:users|MAU|DAU|daily users)/gi) || [];
  metrics.push(...users);

  // Time reductions: 45 to 12 days, 4s to 1s
  const timeReductions = text.match(/\d+\s*(?:to|→)\s*\d+\s*(?:days?|hours?|minutes?|seconds?|s|min)/gi) || [];
  metrics.push(...timeReductions);

  // Counts with context: 100+ interviews, 8-user test
  const counts = text.match(/\d+\+?\s*(?:interviews?|users?|tests?|features?|engineers?|sprints?|weeks?)/gi) || [];
  metrics.push(...counts);

  // Plain large numbers: 100K+, 10M+
  const largeNumbers = text.match(/\d+[KMB]\+?/g) || [];
  metrics.push(...largeNumbers);

  // X improvements: 2x, 3x
  const multipliers = text.match(/\d+x/gi) || [];
  metrics.push(...multipliers);

  return [...new Set(metrics)];
}

function checkMetricPreservation(
  original: string,
  enhanced: string
): { preserved: boolean; missing: string[] } {
  const originalMetrics = extractMetrics(original);
  const enhancedText = enhanced.toLowerCase();

  const missing: string[] = [];
  for (const metric of originalMetrics) {
    const coreNumber = metric.match(/[\d,.]+/)?.[0];
    if (coreNumber && !enhancedText.includes(coreNumber.toLowerCase())) {
      missing.push(metric);
    }
  }

  return { preserved: missing.length === 0, missing };
}

function detectInventedContext(original: string, enhanced: string): string[] {
  const inventedPhrases: string[] = [];
  const enhancedLower = enhanced.toLowerCase();
  const originalLower = original.toLowerCase();

  const casualPhrases = [
    'rough idea', 'vague idea', 'unclear direction', 'chaotic', 'messy',
    'random', 'figured it out', 'scrappy', 'from scratch', 'ground up'
  ];

  const contextQualifiers = [
    'urgent crisis', 'critical issue', 'major problem', 'significant challenge',
    'complex situation', 'difficult environment', 'high-pressure'
  ];

  for (const phrase of [...casualPhrases, ...contextQualifiers]) {
    if (enhancedLower.includes(phrase) && !originalLower.includes(phrase)) {
      inventedPhrases.push(phrase);
    }
  }

  return inventedPhrases;
}

function validateEnhancedBullets(
  rawEnhancedBullets: { original: string; enhanced: string }[]
): { issues: { type: string; description: string }[] } {
  const issues: { type: string; description: string }[] = [];

  rawEnhancedBullets.forEach((b, i) => {
    const metricsCheck = checkMetricPreservation(b.original, b.enhanced);
    if (!metricsCheck.preserved) {
      issues.push({
        type: 'metric_removed',
        description: `Bullet #${i + 1}: removed metrics: ${metricsCheck.missing.join(', ')}`,
      });
    }

    const invented = detectInventedContext(b.original, b.enhanced);
    if (invented.length > 0) {
      issues.push({
        type: 'invented_context',
        description: `Bullet #${i + 1}: added new qualifiers: ${invented.join(', ')}`,
      });
    }
  });

  return { issues };
}

// =============================================================================
// CALL #2: ALL-IN-ONE TAILOR AND SYNTHESIZE
// =============================================================================

async function tailorAndSynthesize(
  baseResume: ResumeJSON,
  jobDescription: string
): Promise<{
  finalResume: ResumeJSON;
  matchScore?: number;
  keyChanges: string[];
  rawEnhancedBullets: { original: string; enhanced: string }[];
}> {
  const systemPrompt = `${HUMAN_FIRST_STYLE}

You are an expert recruiter + resume writer.

You will:
1) Analyze the job description to understand what actually matters.
2) Improve or rewrite bullets in the resume to match the role, obeying the rules above.
3) Produce a new ResumeJSON that is tailored but honest.
4) Return a simple matchScore (0-100) and a short list of keyChanges.

DO NOT fabricate experience, companies, or metrics.
Only rephrase or surface what is already present or clearly implied.

IMPORTANT:
- Keep the same roles and companies as the original resume.
- You may drop obviously low-value bullets if you replace them with stronger ones.
- Bullets must obey the HUMAN-FIRST rules above.
- The finalResume must be valid JSON matching the ResumeJSON schema.`;

  const userPrompt = `JOB DESCRIPTION:
${jobDescription}

PARSED RESUME JSON:
${JSON.stringify(baseResume, null, 2)}

TASK:
1) Briefly infer what the role cares about (no need to return this explicitly).
2) Decide which bullets to keep as-is and which to improve.
3) Rewrite or add bullets to better match the role, following the HUMAN-FIRST rules.
4) Return a JSON object with this exact shape:

{
  "finalResume": {
    "summary": string | null,
    "experience": [
      {
        "role": string,
        "company": string,
        "location": string | null,
        "start": string | null,
        "end": string | null,
        "bullets": string[]
      }
    ],
    "education": [
      {
        "school": string,
        "degree": string,
        "details": string | null
      }
    ],
    "skills": {
      "product": string[],
      "technical": string[],
      "domain": string[]
    },
    "projects": string[],
    "certifications": string[]
  },
  "matchScore": number,
  "keyChanges": [
    "string description of a notable change",
    "another notable change"
  ],
  "rawEnhancedBullets": [
    {
      "original": "original bullet text from resume",
      "enhanced": "final bullet text you used"
    }
  ]
}

Rules:
- matchScore should be 0-100 reflecting how well the tailored resume matches the job.
- keyChanges should list 3-6 notable improvements you made.
- rawEnhancedBullets should include EVERY bullet you changed (original vs final version).
- If you kept a bullet unchanged, do NOT include it in rawEnhancedBullets.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI in tailorAndSynthesize');

  const parsed = JSON.parse(content) as {
    finalResume: ResumeJSON;
    matchScore?: number;
    keyChanges?: string[];
    rawEnhancedBullets?: { original: string; enhanced: string }[];
  };

  // Ensure finalResume has required fields
  if (!parsed.finalResume || !parsed.finalResume.experience) {
    throw new Error('Invalid response: finalResume missing or malformed');
  }

  return {
    finalResume: parsed.finalResume,
    matchScore: parsed.matchScore,
    keyChanges: parsed.keyChanges ?? [],
    rawEnhancedBullets: parsed.rawEnhancedBullets ?? [],
  };
}

// =============================================================================
// MAIN API: tailorResumeForJob
// =============================================================================

export async function tailorResumeForJob(
  rawResume: string,
  jobDescription: string
): Promise<TailoredResumeResult> {
  // Call #1: Parse resume into structured JSON
  const baseResume = await parseResumeToJSON(rawResume);

  // Call #2: All-in-one tailor + synthesize
  const {
    finalResume,
    matchScore,
    keyChanges,
    rawEnhancedBullets,
  } = await tailorAndSynthesize(baseResume, jobDescription);

  // Validate enhanced bullets for quality issues
  const { issues } = validateEnhancedBullets(rawEnhancedBullets);

  return {
    finalResume,
    matchScore,
    keyChanges,
    issues: issues.length > 0 ? issues : undefined,
  };
}
