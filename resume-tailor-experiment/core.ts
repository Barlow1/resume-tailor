// core.ts

import OpenAI from 'openai';

// =============================================================================
// OPENAI CLIENT
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

// A gap is something the JD wants that the resume doesn't clearly show
export interface Gap {
  skill: string;
  jdContext: string;
  question: string; // The question to ask the human
}

// Human's response to a gap question
export interface GapResponse {
  skill: string;
  hasExperience: boolean;
  context?: string; // Optional context provided by user
}

// A language pattern: resume already has the experience, but phrased differently than JD
export interface JDLanguagePattern {
  jdTerm: string; // How the JD phrases it
  resumeEquivalent: string; // What in the resume maps to this
  bulletLocations: { company: string; bulletIndex: number }[];
}

export interface AnalysisResult {
  parsedResume: ResumeJSON;
  gaps: Gap[];
  languagePatterns: JDLanguagePattern[];
}

export interface HumanReviewInput {
  gapResponses: GapResponse[];
  languagePatterns: JDLanguagePattern[];
}

// A single bullet change for diff review
export interface BulletChange {
  company: string;
  role: string;
  bulletIndex: number;
  original: string;
  tailored: string;
}

export interface TailoredResumeResult {
  finalResume: ResumeJSON;
  bulletChanges: BulletChange[];
}

// =============================================================================
// STAGE 1: PARSE RESUME
// =============================================================================

async function parseResumeToJSON(rawResume: string): Promise<ResumeJSON> {
  const systemPrompt = `You are an expert resume parser.

Convert the resume into this JSON structure:
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
  "education": [{ "school": string, "degree": string, "details": string | null }],
  "skills": { "product": string[], "technical": string[] },
  "projects": string[],
  "certifications": string[]
}

Rules:
- Do NOT invent anything. Only use what's present.
- Preserve bullets exactly as written.
- Use "YYYY-MM" for dates when possible.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `RESUME:\n${rawResume}\n\nParse this resume into JSON.` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  if (!parsed.experience) parsed.experience = [];

  return parsed as ResumeJSON;
}

// =============================================================================
// STAGE 1: IDENTIFY GAPS AND LANGUAGE PATTERNS
// =============================================================================

async function analyzeGapsAndLanguage(
  jobDescription: string,
  resume: ResumeJSON
): Promise<{ gaps: Gap[]; languagePatterns: JDLanguagePattern[] }> {
  const systemPrompt = `You analyze a job description against a resume to find TWO things:

1. GAPS: Things the JD wants that the resume does NOT demonstrate
2. LANGUAGE PATTERNS: Things the resume ALREADY demonstrates but phrases differently than the JD

## GAPS

A gap is something genuinely missing. Examples:
- JD wants "Kubernetes" but resume only mentions Docker → GAP
- JD requires "healthcare industry" but resume is all fintech → GAP
- JD asks for "team leadership" but resume shows only IC work → GAP

NOT a gap (skip these):
- JD wants SQL and resume mentions SQL → not a gap, exact match
- JD wants "data visualization" and resume shows Tableau dashboards → not a gap, it's a LANGUAGE PATTERN

Return 3-8 gaps maximum. For each, create a direct yes/no question.

## LANGUAGE PATTERNS

These are places where the resume ALREADY has the experience but uses different words than the JD.

Examples:
- JD says "cross-functional collaboration" / Resume says "worked with engineering and design teams" → PATTERN
- JD says "program management" / Resume says "led a team of 5 to launch" → PATTERN
- JD says "data visualization" / Resume says "built Tableau dashboards" → PATTERN
- JD says "stakeholder management" / Resume says "presented to executives" → PATTERN

For each pattern, note which bullets could be reframed.

Return 5-15 language patterns. These are the PRIMARY way to improve a resume without lying.`;

  const userPrompt = `JOB DESCRIPTION:
${jobDescription}

RESUME:
${JSON.stringify(resume, null, 2)}

Analyze and return JSON:
{
  "gaps": [
    {
      "skill": "the missing skill",
      "jdContext": "how JD mentions it",
      "question": "Do you have experience with X?"
    }
  ],
  "languagePatterns": [
    {
      "jdTerm": "cross-functional collaboration",
      "resumeEquivalent": "worked with engineering and design teams",
      "bulletLocations": [{ "company": "Company Name", "bulletIndex": 0 }]
    }
  ]
}`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  return {
    gaps: parsed.gaps ?? [],
    languagePatterns: parsed.languagePatterns ?? [],
  };
}

// =============================================================================
// STAGE 1: PUBLIC API
// =============================================================================

export async function analyzeResumeAndJob(
  rawResume: string,
  jobDescription: string
): Promise<AnalysisResult> {
  const parsedResume = await parseResumeToJSON(rawResume);
  const { gaps, languagePatterns } = await analyzeGapsAndLanguage(jobDescription, parsedResume);

  return {
    parsedResume,
    gaps,
    languagePatterns,
  };
}

// =============================================================================
// STAGE 2: TAILOR WITH HUMAN INPUT
// =============================================================================

export async function tailorWithHumanInput(
  parsedResume: ResumeJSON,
  jobDescription: string,
  humanInput: HumanReviewInput
): Promise<TailoredResumeResult> {
  const confirmedGaps = humanInput.gapResponses.filter((g) => g.hasExperience);
  const languagePatterns = humanInput.languagePatterns;

  const systemPrompt = `You tailor resumes to job descriptions with MINIMAL changes.

YOUR TWO JOBS:

1. MIRROR JD LANGUAGE (PRIMARY)
   Reframe existing bullets to use JD terminology. The candidate already has the experience — just phrase it the way the JD does.

   Example:
   - Resume says: "Led a team of 5 to launch a new product"
   - JD talks about: "program management", "cross-functional coordination"
   - Tailored: "Managed cross-functional team of 5 through full product lifecycle to launch"

   Same experience, JD language. Not lying.

2. INCORPORATE CONFIRMED GAPS (if any)
   The human confirmed certain skills with context. Weave this in naturally.

PHILOSOPHY:
- Change as little as possible while achieving language alignment
- Write like a human, not like an ATS optimizer
- Keywords should be INVISIBLE — integrated naturally
- Preserve the candidate's original voice
- If you can't fit a keyword naturally, skip it

STRICT RULES:

1. BULLETS
   - Reframe to use JD terminology where experience exists
   - Each bullet MUST be ≤25 words. No exceptions.
   - NEVER use slashes like "data pipeline / ETL development"
   - NEVER insert phrases awkwardly
   - Preserve ALL metrics with full context
   - Do NOT add new bullets
   - Do NOT invent experience

2. SKILLS SECTION
   - Add JD terms the resume demonstrates
   - Remove redundancy

3. SUMMARY
   - Light touch. 2-3 sentences max.
   - Mirror key JD language naturally.

4. EDUCATION & CERTIFICATIONS
   - No changes.

RETURN FORMAT:
Return the tailored resume AND a list of bullet changes.
Only include bullets that were actually modified.`;

  // Build language pattern instructions
  const patternInstructions = languagePatterns.length > 0
    ? `LANGUAGE PATTERNS TO APPLY:
These show JD terminology and where the resume already demonstrates this experience. Reframe these bullets:

${languagePatterns.map((p) => `• "${p.jdTerm}" ← currently "${p.resumeEquivalent}" in ${p.bulletLocations.map((b) => `${b.company} bullet ${b.bulletIndex + 1}`).join(', ')}`).join('\n')}`
    : '';

  const gapInstructions = confirmedGaps.length > 0
    ? `CONFIRMED GAP CONTEXT (human verified they have this):
${confirmedGaps.map((g) => `• ${g.skill}${g.context ? `: ${g.context}` : ''}`).join('\n')}`
    : '';

  const userPrompt = `ORIGINAL RESUME:
${JSON.stringify(parsedResume, null, 2)}

JOB DESCRIPTION:
${jobDescription}

${patternInstructions}

${gapInstructions}

Tailor the resume. Return JSON:
{
  "finalResume": { ... same structure as input ... },
  "bulletChanges": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "bulletIndex": 0,
      "original": "original bullet text",
      "tailored": "tailored bullet text"
    }
  ]
}`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);

  return {
    finalResume: parsed.finalResume,
    bulletChanges: parsed.bulletChanges ?? [],
  };
}