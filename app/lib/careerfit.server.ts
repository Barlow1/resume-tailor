import OpenAI from 'openai';
import { z } from 'zod';

// ---- OpenAI client ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // throws if missing in your env util
});

// ---- Result schema (strict) ----
const ResultSchema = z.object({
  fitPct: z.number().min(0).max(100),
  summary: z.string(),
  redFlags: z.array(z.string()).default([]),
  improveBullets: z.array(
    z.object({
      current: z.string().default(''),
      suggest: z.string(),
      why: z.string(),
    })
  ).max(5),
});

type Result = z.infer<typeof ResultSchema>;

// ---- JSON sanitizer (handles ```json fences etc.) ----
function extractJson(s: string): string {
  // Remove markdown fences if present
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : s;
  // Trim leading junk before first { and trailing after last }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
}

export async function getAiFeedback(
  jdText: string,
  resumeTxt: string,
  title: string,
  company: string
): Promise<Result> {
  const systemPrompt = `
Act as a senior hiring manager with over 20 years in the *${title}* domain.
Your goal: evaluate a candidate’s résumé **for this specific JD**.

1. Analyse MUST-have & NICE-to-have skills, certs, soft skills, leadership,
   impact, culture fit. Cite red flags.
2. Score overall fitPct (0-100).
3. Suggest ≤ 5 *bullet-point* résumé improvements (plain text).
4. Return JSON:
     {
       "fitPct": 87,
       "summary": "...short paragraph…",
       "redFlags": ["…"],
       "improveBullets": [
          { "current": "Managed UI…", "suggest": "Revamped React…", "why": "Quantify impact" }
       ]
     }
STRICTLY return only valid JSON.
`.trim();

  const userPrompt = [
    `Title: ${title || '—'}`,
    `Company: ${company || '—'}`,
    ``,
    `=== JOB DESCRIPTION ===`,
    jdText?.trim() || '(none provided)',
    ``,
    `=== RESUME ===`,
    resumeTxt?.trim() || '(none provided)',
  ].join('\n');

  // Call OpenAI (no streaming; we need a single JSON blob)
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'o3',
    temperature: 1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'text' }, // let’s normalize ourselves
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  const cleaned = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // last-ditch fallback; return safe defaults to avoid 500s
    return {
      fitPct: 50,
      summary:
        'Could not parse model output strictly as JSON. Returned a safe fallback. Try again or adjust your prompt.',
      redFlags: [],
      improveBullets: [],
    };
  }

  const result = ResultSchema.safeParse(parsed);
  if (!result.success) {
    // schema mismatch → fallback with minimal data (helps UI keep working)
    return {
      fitPct: 50,
      summary:
        'Model output did not match the expected schema. Returned a safe fallback. Try again or adjust your prompt.',
      redFlags: [],
      improveBullets: [],
    };
  }

  return result.data;
}

// ---- People lookup ----
// Uses Proxycurl company employees endpoint IF PEOPLE_API_KEY is set.
// Otherwise returns a tiny static list.
export async function findPeople(company: string, title: string) {
  const key = process.env.PEOPLE_API_KEY;
  if (!key) {
    return [
      { name: 'Alice Smith', role: 'Product Lead', linkedin: 'https://www.linkedin.com/in/example1' },
      { name: 'Bob Johnson', role: 'Eng Manager', linkedin: 'https://www.linkedin.com/in/example2' },
    ];
  }

  // NOTE: The real Proxycurl company employees endpoint typically expects a LinkedIn company profile URL.
  // If you only have a name, you may need an enrichment step (not included here).
  // Below is a best-effort example that falls back gracefully.

  const url = new URL('https://nubela.co/proxycurl/api/v2/linkedin/company/employees/');
  // If you have a company LinkedIn URL, set it as `url.searchParams.set('linkedin_company_url', ...)`
  // As a lightweight fallback, pass a query param your server can map if you proxy this request.
  url.searchParams.set('employment_status', 'current');

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!res.ok) throw new Error(`people lookup ${res.status}`);

    const payload = (await res.json()) as any[];
    // Map to the UI shape and filter by role keywords if title provided
    const mapped = (payload || [])
      .map((p: any) => ({
        name: p?.name || p?.full_name || 'Unknown',
        role: p?.title || p?.occupation || 'Employee',
        linkedin: p?.linkedin_profile_url || '#',
      }))
      .filter((p) =>
        title ? (p.role || '').toLowerCase().includes(title.toLowerCase().split(' ')[0]) : true
      )
      .slice(0, 6);

    return mapped.length ? mapped : [
      { name: 'Alice Smith', role: 'Product Lead', linkedin: 'https://www.linkedin.com/in/example1' },
      { name: 'Bob Johnson', role: 'Eng Manager', linkedin: 'https://www.linkedin.com/in/example2' },
    ];
  } catch {
    // Never fail the UX on people lookup
    return [
      { name: 'Alice Smith', role: 'Product Lead', linkedin: 'https://www.linkedin.com/in/example1' },
      { name: 'Bob Johnson', role: 'Eng Manager', linkedin: 'https://www.linkedin.com/in/example2' },
    ];
  }
}
