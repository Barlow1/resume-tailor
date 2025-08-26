// app/lib/careerfit.server.ts
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
      })
    )
    .max(5),
})
export type Result = z.infer<typeof ResultSchema>

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

function buildSystemPrompt(title: string, company: string) {
  const t = cleanInline(title)
  const c = cleanInline(company)
  return `
You are a senior hiring manager with 20+ years hiring for the role of **${t}** ${c !== '—' ? `at **${c}**` : ''}.
Evaluate a candidate strictly against the provided Job Description (JD) and the candidate's résumé.

Rules:
- Use only information present in the JD and résumé; do not invent facts.
- Consider must-have vs nice-to-have skills, certifications, soft skills, leadership, impact, domain fit.
- Be concise and actionable.
- **Return UP TO 5 distinct "improveBullets" items** that are actionable résumé edits mapped to the JD.
- Output JSON ONLY matching this schema (no extra fields, no prose outside JSON):

{
  "fitPct": 87,
  "summary": "short paragraph…",
  "redFlags": ["..."],
  "improveBullets": [
    { "current": "…", "suggest": "…", "why": "…" }
  ]
}

"fitPct" must be an integer 0..100 reflecting how well the résumé covers the JD.
`.trim()
}

function buildUserPrompt(jdText: string, resumeTxt: string) {
  return [
    `=== JOB DESCRIPTION (BEGIN) ===`,
    (jdText || '(none provided)').trim(),
    `=== JOB DESCRIPTION (END) ===`,
    ``,
    `=== RESUME (BEGIN) ===`,
    (resumeTxt || '(none provided)').trim(),
    `=== RESUME (END) ===`,
  ].join('\n')
}

function mockResult(): Result {
  return {
    fitPct: 48,
    summary:
      'Mock result used because the AI call failed or API key is missing. Provide a JD and résumé for best results.',
    redFlags: ['Missing measurable impact in key responsibilities.'],
    improveBullets: [
      {
        current: '',
        suggest: 'Quantify outcomes (e.g., “Improved conversion by 12% in 3 months”).',
        why: 'Hiring managers prefer measurable impact.',
      },
    ],
  }
}

export async function getAiFeedback(
  jdText: string,
  resumeTxt: string,
  title: string,
  company: string
): Promise<Result> {
  // If no API key, return a mock (prevents 500s)
  if (!process.env.OPENAI_API_KEY) {
    return mockResult()
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'o3',
      temperature: 1,
      messages: [
        { role: 'system', content: buildSystemPrompt(title, company) },
        { role: 'user', content: buildUserPrompt(jdText, resumeTxt) },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const cleaned = extractJson(raw)
    const parsed = JSON.parse(cleaned)
    const result = ResultSchema.safeParse(parsed)

    if (result.success) return result.data
    // schema mismatch
    return mockResult()
  } catch (err) {
    // Log once on server; return mock so UX doesn’t crash
    console.error('getAiFeedback error:', err)
    return mockResult()
  }
}
