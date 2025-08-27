// app/lib/careerfit.server.ts
import OpenAI from 'openai'
import { z } from 'zod'

// ⬇️ Make sure you put extractKeywords in app/lib/keywords/keywords.ts
// (avoid a filename collision with the folder name)
import { extractKeywords } from './keywords.ts'
import { rankCandidates } from './keywords/rank.ts'
import { attachEvidence } from './keywords/evidence.ts'
import { toSnippets } from './keywords/snippets.ts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/* --------------------------- Schemas & Types --------------------------- */

const KeywordSnippetSchema = z.object({
  term: z.string(),
  priority: z.enum(['critical', 'important', 'nice']),
  where: z.array(z.enum(['skills', 'summary', 'bullet'])),
  supported: z.boolean(),
  proof: z.string().optional(),
  proofSuggestion: z.string().optional(),
  synonyms: z.array(z.string()).max(2).optional(),
  snippets: z.object({
    skills: z.string().optional(),
    summary: z.string().max(140).optional(),
    bullet: z.string().max(200).optional(),
  }),
})

const ResultSchema = z.object({
  fitPct: z.number().min(0).max(100),
  summary: z.string(),
  redFlags: z.array(z.string()).default([]),
  improveBullets: z
    .array(
      z.object({
        current: z.string().default(''),
        suggest: z.string(),
        why: z.string(),
      }),
    )
    .max(5),
  keywords: z
    .object({
      resume: z.array(z.string()).default([]),
      jd: z.array(z.string()).default([]),
      missing: z.array(z.string()).default([]),
    })
    .optional(),
  keywordPlan: z
    .object({
      top10: z.array(KeywordSnippetSchema).max(10),
    })
    .optional(),
  keywordBullets: z
    .array(
      z.object({
        suggest: z.string(),
        why: z.string(),
      }),
    )
    .max(5)
    .optional(),
})
export type Result = z.infer<typeof ResultSchema>

/* --------------------------- Pre-pass utilities --------------------------- */

function buildPrepass(jdText: string, resumeTxt: string, roleTitle?: string) {
  const { jdKeywords, resumeKeywords, missingInResume } = extractKeywords(
    resumeTxt,
    jdText,
  )
  // Rank uses tokens (keyword strings are fine as tokens for now)
  const ranked = rankCandidates(jdKeywords, resumeKeywords)
  const withEvidence = attachEvidence(ranked, resumeTxt)
  const planTop10 = toSnippets(withEvidence, { roleTitle }).slice(0, 10)
  return {
    simple: { jdKeywords, resumeKeywords, missingInResume },
    planTop10,
    csv: toCsv(withEvidence.slice(0, 30)), // compact candidate table for the model
  }
}

function toCsv(rows: ReturnType<typeof attachEvidence>) {
  // term,jdTf,section,type,resumePresent,supported,evidence
  const header = 'term,jdTf,section,type,resumePresent,supported,evidence'
  const lines = rows.map((r) =>
    [
      r.term,
      r.jdTf,
      r.jdSection,
      r.type,
      r.resumePresent ? 1 : 0,
      r.evidence?.supported ? 1 : 0,
      (r.evidence?.excerpt ?? '').replace(/[\r\n,]+/g, ' ').slice(0, 120),
    ].join(','),
  )
  return [header, ...lines].join('\n')
}

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenced ? fenced[1] : s
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  return start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw
}

function cleanInline(s: string) {
  return (s || '—').replace(/[\r\n]+/g, ' ').slice(0, 120)
}

/* ------------------------------ Prompts ------------------------------ */

function buildSystemPrompt(title: string, company: string) {
  const t = cleanInline(title)
  const c = cleanInline(company)
  return `
You are a senior hiring manager with 20+ years hiring for the role of **${t}** ${c !== '—' ? `at **${c}**` : ''}.
Evaluate a candidate strictly against the provided Job Description (JD) and the candidate's résumé.

1) Analyse MUST-have & NICE-to-have skills, certs, soft skills, leadership, impact, culture fit, strengths. Cite red flags.
2) Score overall fitPct (0-100).
3) Suggest ≤5 *bullet-point* résumé improvements (plain text).
4) Keyword task:
   - You will receive a deterministic pre-pass (lists, candidate CSV, draft Top-10). Validate, then **re-rank or replace** terms based on the **role (“${title}”${company ? ` at “${company}”` : ''})**, the **candidate’s experience/seniority inferred from the résumé**, and **what’s most critical to the JD**.
   - Return a **"keywords"** object { jd, resume, missing } **capped at 10 items each** (≤10).
   - Return a **"keywordPlan.top10"** where each item includes:
       • **priority** ("critical"/"important"/"nice") based on JD,
       • **where** (["skills"|"summary"|"bullet"]) placements,
       • **supported** boolean + **proof** excerpt if true, else **proofSuggestion**,
       • **snippets.bullet**: **exactly ONE** ≤200-char **XYZ bullet** that **includes the keyword** and matches the candidate’s role/seniority. Use real metrics if present; if none, use short placeholders like **[X%]**/**[value]**. Never invent experience.
       • optional **snippets.summary** (≤140) and **snippets.skills** (single term).
   - Keep language **role-agnostic** (not PM-specific) unless the title clearly implies a function.
   - Avoid keyword stuffing; use synonyms sparingly.
5) Return JSON matching this schema ONLY:
{
  "fitPct": 87,
  "summary": "...",
  "redFlags": ["..."],
  "improveBullets": [{ "current": "", "suggest": "...", "why": "..." }],
  "keywords": { "jd": ["..."], "resume": ["..."], "missing": ["..."] },
  "keywordPlan": { "top10": [{
    "term": "...",
    "priority": "critical"|"important"|"nice",
    "where": ["skills"|"summary"|"bullet"],
    "supported": true|false,
    "proof": "...?",
    "proofSuggestion": "...?",
    "synonyms": ["..."]?,
    "snippets": { "skills"?: "...", "summary"?: "...", "bullet"?: "..." }
  }]},
  "keywordBullets": [{ "suggest": "...", "why": "..." }]
}
STRICT JSON. No prose.
`.trim()
}

type Pre = ReturnType<typeof buildPrepass>
function buildUserPrompt(jdText: string, resumeTxt: string, pre: Pre, title: string, company: string) {
   return [
    `=== CONTEXT ===`,
    `Role Title: ${title || '(unknown)'}`,
    `Company: ${company || '(unknown)'}`,
     '=== JD ===',
     (jdText || '(none provided)').trim(),
     '=== RESUME ===',
     (resumeTxt || '(none provided)').trim(),
     '=== KEYWORDS (pre-pass) ===',
    `jd: ${pre.simple.jdKeywords.slice(0, 40).join(', ')}`,
    `resume: ${pre.simple.resumeKeywords.slice(0, 40).join(', ')}`,
    `missing: ${pre.simple.missingInResume.slice(0, 25).join(', ')}`,
    `jd: ${pre.simple.jdKeywords.slice(0, 10).join(', ')}`,
    `resume: ${pre.simple.resumeKeywords.slice(0, 10).join(', ')}`,
    `missing: ${pre.simple.missingInResume.slice(0, 10).join(', ')}`,
     '=== CANDIDATES CSV (top 30) ===',
     pre.csv,
     '=== DRAFT TOP10 (deterministic) ===',
     JSON.stringify({ top10: pre.planTop10 }),
   ].join('\n')
}

/* ------------------------------ Mock ------------------------------ */

function mockResult(): Result {
  return {
    fitPct: 48,
    summary:
      'Mock result used because the AI call failed or API key is missing. Provide a JD and résumé for best results.',
    redFlags: ['Missing measurable impact in key responsibilities.'],
    improveBullets: [
      {
        current: '',
        suggest:
          'Quantify outcomes (e.g., “Improved conversion by 12% in 3 months”).',
        why: 'Hiring managers prefer measurable impact.',
      },
    ],
  }
}

/* ------------------------------ Main ------------------------------ */

export async function getAiFeedback(
  jdText: string,
  resumeTxt: string,
  title: string,
  company: string,
): Promise<Result> {
  if (!process.env.OPENAI_API_KEY) return mockResult()

  try {
    const pre = buildPrepass(jdText, resumeTxt, title)

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'o3',
      temperature: 1,
      messages: [
        { role: 'system', content: buildSystemPrompt(title, company) },
        { role: 'user', content: buildUserPrompt(jdText, resumeTxt, pre, title, company) },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const cleaned = extractJson(raw) // belt & suspenders; response_format should already be JSON
    const parsed = JSON.parse(cleaned)
    const result = ResultSchema.safeParse(parsed)
    if (result.success) return result.data

    // Schema mismatch
    return mockResult()
  } catch (err) {
    console.error('getAiFeedback error:', err)
    return mockResult()
  }
}
