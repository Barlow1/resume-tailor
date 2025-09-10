import { KeywordCandidate, KeywordSnippet } from './types.ts'

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function toSnippets(
  cands: KeywordCandidate[],
  opts: { roleTitle?: string } = {},
): KeywordSnippet[] {
  return cands.map((c) => {
    const supported = !!c.evidence?.supported
    const proof = c.evidence?.excerpt
    const proofSuggestion = supported ? undefined : quickProof(c)
    return {
      term: c.term,
      priority: c.priority,
      where: c.where,
      supported,
      proof,
      proofSuggestion,
      synonyms: suggestSynonyms(c.term),
      snippets: {
        skills: c.where.includes('skills') ? c.term : undefined,
        summary: c.where.includes('summary') ? summaryLine(c, opts.roleTitle) : undefined,
        // ✅ XYZ-style bullet, role-agnostic, always includes the keyword
        bullet: c.where.includes('bullet') ? bulletLineXYZ(c) : undefined,
      },
    }
  })
}

/** Role-agnostic summary lines that still feel specific. */
function summaryLine(c: KeywordCandidate, roleTitle?: string) {
  const prefix = roleTitle ? `${roleTitle} with ` : ''
  switch (c.type) {
    case 'domain':
      return clamp(`${prefix}${c.term} experience and rapid, results-driven execution.`, 140)
    case 'method':
      return clamp(`${prefix}hands-on ${c.term} with data-driven iteration.`, 140)
    case 'tool':
      return clamp(`${prefix}practical ${c.term} usage to analyze, automate, and ship improvements.`, 140)
    case 'metric':
      return clamp(`${prefix}focus on tracking and improving ${c.term} through experimentation and ops.`, 140)
    default: // 'soft'
      return clamp(`${prefix}strength in ${c.term} applied to cross-functional delivery.`, 140)
  }
}

/** XYZ pattern: Achieved X by doing Y using Z (the keyword). */
function bulletLineXYZ(c: KeywordCandidate) {
  const k = c.term
  switch (c.type) {
    case 'metric':
      // Example: “Increased conversion rate by 12% by prioritizing experiments and UX fixes aligned to feedback.”
      return clamp(
        `Increased ${k} by [X%/value] by prioritizing targeted initiatives and process improvements informed by data.`,
        200,
      )
    case 'method':
      // Example: “Drove +8 NPS by applying A/B testing to onboarding and iterating weekly on learnings.”
      return clamp(
        `Drove [result/metric] by applying ${k} to priority flows and iterating on findings on a regular cadence.`,
        200,
      )
    case 'tool':
      // Example: “Reduced cycle time by 22% by building dashboards in SQL and automating alerts.”
      return clamp(
        `Delivered [result/metric] by building/automating in ${k} and shipping changes tied to those insights.`,
        200,
      )
    case 'domain':
      // Example: “Improved claim throughput by 15% in healthcare by launching targeted workflow updates.”
      return clamp(
        `Delivered [result] in ${k} by launching targeted improvements and validating outcomes with before/after metrics.`,
        200,
      )
    default: // 'soft'
      // Example: “Achieved 98% on-time delivery by driving stakeholder alignment and clear prioritization.”
      return clamp(
        `Achieved [result] by leveraging ${k} across stakeholders and unblocking delivery with clear priorities.`,
        200,
      )
  }
}

/** Truth-first nudges if a keyword isn’t supported yet. */
function quickProof(c: KeywordCandidate) {
  switch (c.type) {
    case 'method':
      return `Run a small ${c.term} pilot and record one measurable change.`
    case 'tool':
      return `Create a mini demo or analysis using ${c.term} and cite the outcome.`
    case 'domain':
      return `Add a brief project/course tied to ${c.term} and summarize what you built or learned.`
    case 'metric':
      return `Document a before/after for ${c.term} on a scoped change.`
    default:
      return `Add a concrete example demonstrating ${c.term} with a measurable result.`
  }
}

/** Light synonym help without stuffing. */
function suggestSynonyms(term: string) {
  if (/lead nurture/i.test(term)) return ['nurture sequences']
  if (/consumer conversion/i.test(term)) return ['funnel optimization']
  return []
}
