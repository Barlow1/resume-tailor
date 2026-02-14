/**
 * Keyword Extraction using OpenAI
 *
 * PROBLEM WE'RE SOLVING:
 * - ATS systems match resumes against job descriptions using keyword matching
 * - Not all words in a JD are "keywords" - some are noise (company jargon, repeated terms)
 * - We need to extract DIFFERENTIATING terms that signal candidate fit
 * - Most JDs are 70% boilerplate — the real substance is only 3-5 "non-generic must-haves"
 *
 * ARCHITECTURE:
 * - Pre-process JD into structured sections + term frequency metadata
 * - Use GPT with structured output (response_format: json_object) for consistency
 * - Implement validation layer to ensure extracted keywords actually exist in JD
 * - Programmatic post-validation: role-title demotion + section-based tier overrides
 * - Temperature=0.4 for deterministic results across same JD inputs
 * - Returns tiered keywords: 3-5 primary must-haves + 5-7 secondary supporting
 */

import OpenAI from 'openai'

export interface ExtractedKeywordsResult {
	keywords: string[]   // full flat list (primary + secondary)
	primary: string[]    // 3-5 must-haves
}

// Boilerplate JD phrases that should never surface as keywords.
// Checked as normalized lowercase exact matches (single words) or
// substring containment (multi-word phrases within the keyword).
const BOILERPLATE_PHRASES = new Set([
	'team player',
	'excellent communication',
	'strong communication',
	'good communication',
	'effective communication',
	'verbal communication',
	'written communication',
	'excellent written',
	'communication skills',
	'interpersonal skills',
	'organizational skills',
	'fast-paced environment',
	'fast paced environment',
	'dynamic environment',
	'self-starter',
	'self starter',
	'detail-oriented',
	'detail oriented',
	'strong work ethic',
	'work ethic',
	'collaborative',
	'passion for',
	'passionate',
	'ability to multitask',
	'multitask',
	'results-driven',
	'results driven',
	'go-getter',
	'go getter',
	'proactive',
	'motivated',
	'hard-working',
	'hard working',
	'positive attitude',
	'can-do attitude',
	'think outside the box',
	'works well under pressure',
	'attention to detail',
	'strong communicator',
	'work independently',
	'critical thinking',
	'problem solving',
	'problem-solving',
	'time management',
])

const STOP_WORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
	'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
	'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
	'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must',
	'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very',
	'just', 'about', 'above', 'after', 'again', 'all', 'also', 'am',
	'any', 'because', 'before', 'below', 'between', 'both', 'during',
	'each', 'few', 'further', 'get', 'got', 'he', 'her', 'here', 'him',
	'his', 'how', 'i', 'into', 'it', 'its', 'me', 'more', 'most', 'my',
	'new', 'now', 'only', 'other', 'our', 'out', 'over', 'own', 'same',
	'she', 'some', 'such', 'that', 'their', 'them', 'these', 'they',
	'this', 'those', 'through', 'under', 'until', 'up', 'us', 'we',
	'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
	'you', 'your',
])

const CREDENTIAL_TERMS = new Set([
	"bachelor's degree", "master's degree", "mba", "phd",
	"bachelor's", "master's", "associate's degree",
])

const EXPERIENCE_YEARS_REGEX = /^\d+\+?\s*years?$/i

const ROLE_TITLE_TERMS = new Set([
	'product management', 'project management', 'software engineering',
	'software development', 'data science', 'data engineering',
	'program management', 'engineering management', 'design',
	'marketing', 'sales',
])

const TITLE_MODIFIER_WORDS = new Set([
	'senior', 'lead', 'principal', 'staff', 'junior', 'associate',
	'manager', 'director', 'vp', 'head',
])

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
})

// ─── JD Pre-processor ────────────────────────────────────────────────

interface JdMetadata {
	jobTitle: string
	sections: {
		responsibilities: string
		requiredQualifications: string
		preferredQualifications: string
		other: string
	}
	termFrequency: Record<string, { count: number; appearsIn: string[] }>
}

const SECTION_PATTERNS: { key: keyof JdMetadata['sections']; patterns: string[] }[] = [
	{
		key: 'requiredQualifications',
		patterns: [
			'Required Qualifications', 'Requirements', "What You'll Need", 'Must Have',
			'Minimum Qualifications', 'Basic Qualifications', "What We're Looking For", 'Required Skills',
		],
	},
	{
		key: 'preferredQualifications',
		patterns: [
			'Preferred Qualifications', 'Nice to Have', 'Preferred Skills', 'Bonus Points',
			'Desired Qualifications', 'Preferred', 'Nice-to-Have', 'Plus',
		],
	},
	{
		key: 'responsibilities',
		patterns: [
			'Responsibilities', "What You'll Do", 'Key Responsibilities', 'The Role',
			'About the Role', 'Job Duties', 'Your Impact', 'What You Will Do',
		],
	},
]

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseJobDescription(rawJd: string, jobTitle: string): JdMetadata {
	const sections: JdMetadata['sections'] = {
		responsibilities: '',
		requiredQualifications: '',
		preferredQualifications: '',
		other: '',
	}

	// Build all pattern entries, sorted longest first so "Preferred Qualifications"
	// matches before "Preferred"
	const allPatterns = SECTION_PATTERNS.flatMap(s =>
		s.patterns.map(p => ({ pattern: p, key: s.key }))
	)
	allPatterns.sort((a, b) => b.pattern.length - a.pattern.length)

	// Build combined regex: match header at start of line, optional markdown #, optional trailing colon/dash
	const escapedPatterns = allPatterns.map(p => escapeRegex(p.pattern))
	const headerRegex = new RegExp(
		`(?:^|\\n)[ \\t]*(?:#{1,4}[ \\t]+)?(?:${escapedPatterns.join('|')})[ \\t]*[:—\\-]?[ \\t]*(?=\\n|$)`,
		'gi'
	)

	// Find all header matches with positions
	const headerMatches: { index: number; end: number; key: keyof JdMetadata['sections'] }[] = []
	let match: RegExpExecArray | null
	while ((match = headerRegex.exec(rawJd)) !== null) {
		const matchedText = match[0].replace(/^[\n\s#]+/, '').replace(/[\s:\-—]+$/, '').toLowerCase()
		// Find which section this header belongs to (check longest patterns first)
		let key: keyof JdMetadata['sections'] | null = null
		for (const p of allPatterns) {
			if (matchedText.includes(p.pattern.toLowerCase())) {
				key = p.key
				break
			}
		}
		if (key) {
			headerMatches.push({
				index: match.index + (match[0].startsWith('\n') ? 1 : 0),
				end: match.index + match[0].length,
				key,
			})
		}
	}

	if (headerMatches.length === 0) {
		// Graceful fallback: entire JD goes to other — LLM gets raw text like today
		sections.other = rawJd
	} else {
		headerMatches.sort((a, b) => a.index - b.index)

		// Text before first header → other
		const beforeFirst = rawJd.slice(0, headerMatches[0].index).trim()
		if (beforeFirst) {
			sections.other = beforeFirst
		}

		// Each header's content runs from end of header match to start of next header (or end of string)
		for (let i = 0; i < headerMatches.length; i++) {
			const start = headerMatches[i].end
			const end = i + 1 < headerMatches.length ? headerMatches[i + 1].index : rawJd.length
			const text = rawJd.slice(start, end).trim()
			const key = headerMatches[i].key
			sections[key] = sections[key] ? sections[key] + '\n' + text : text
		}
	}

	const termFrequency = computeTermFrequency(rawJd, sections)
	return { jobTitle, sections, termFrequency }
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\s+/)
		.map(w => {
			// Strip leading non-alphanumeric chars
			w = w.replace(/^[^a-z0-9]+/, '')
			// Strip trailing punctuation, but preserve + and # (for C++, C#)
			w = w.replace(/[^a-z0-9+#]+$/, '')
			return w
		})
		.filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

function computeTermFrequency(
	rawJd: string,
	sections: JdMetadata['sections'],
): Record<string, { count: number; appearsIn: string[] }> {
	const words = tokenize(rawJd)

	// Generate unigrams, bigrams, trigrams
	const ngrams: string[] = []
	for (let i = 0; i < words.length; i++) {
		ngrams.push(words[i])
		if (i + 1 < words.length) {
			ngrams.push(`${words[i]} ${words[i + 1]}`)
		}
		if (i + 2 < words.length) {
			ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
		}
	}

	// Count occurrences
	const counts: Record<string, number> = {}
	for (const ng of ngrams) {
		counts[ng] = (counts[ng] || 0) + 1
	}

	// Filter to 2+ occurrences and track which sections each term appears in
	const freq: Record<string, { count: number; appearsIn: string[] }> = {}
	const sectionEntries: [string, string][] = [
		['responsibilities', sections.responsibilities],
		['requiredQualifications', sections.requiredQualifications],
		['preferredQualifications', sections.preferredQualifications],
		['other', sections.other],
	]

	for (const [term, count] of Object.entries(counts)) {
		if (count < 2) continue

		const appearsIn: string[] = []
		for (const [name, text] of sectionEntries) {
			if (text && text.toLowerCase().includes(term)) {
				appearsIn.push(name)
			}
		}

		freq[term] = { count, appearsIn }
	}

	return freq
}

function buildUserMessage(metadata: JdMetadata): string {
	const { jobTitle, sections, termFrequency } = metadata

	// Sort term frequency descending by count, cap at top 30
	const sortedTerms = Object.entries(termFrequency)
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 30)

	const termFreqStr = sortedTerms
		.map(([term, { count, appearsIn }]) => `  "${term}" (${count}x, in: ${appearsIn.join(', ')})`)
		.join('\n')

	return `JOB TITLE: ${jobTitle || '(not provided)'}

=== REQUIRED QUALIFICATIONS ===
${sections.requiredQualifications || '(not identified)'}

=== PREFERRED QUALIFICATIONS ===
${sections.preferredQualifications || '(not identified)'}

=== RESPONSIBILITIES ===
${sections.responsibilities || '(not identified)'}

=== OTHER ===
${sections.other || '(none)'}

=== TERM FREQUENCY (2+ occurrences) ===
${termFreqStr || '(no repeated terms)'}`
}

// ─── Validation ──────────────────────────────────────────────────────

/**
 * Validate and filter an array of keywords against the JD.
 * Pipeline: JD existence check → word count filter → boilerplate filter
 */
function validateKeywords(keywords: unknown[], jdLower: string): string[] {
	if (!Array.isArray(keywords)) return []

	// Ensure extracted keywords actually exist in JD
	const valid: string[] = []
	keywords.forEach((kw: unknown) => {
		const keyword = String(kw)
		if (jdLower.includes(keyword.toLowerCase())) {
			valid.push(keyword)
		}
	})

	// Word count filter: 1-3 words
	const concise = valid.filter(kw => {
		const wordCount = kw.trim().split(/\s+/).length
		return wordCount <= 3
	})

	// Boilerplate filter
	return concise.filter(kw => {
		const kwLower = kw.toLowerCase()
		if (BOILERPLATE_PHRASES.has(kwLower)) return false
		for (const phrase of BOILERPLATE_PHRASES) {
			if (phrase.includes(' ') && kwLower.includes(phrase)) return false
		}
		return true
	})
}

// ─── Post-extraction validation ──────────────────────────────────────

function keywordExistsInText(keyword: string, text: string): boolean {
	if (!text) return false
	if (keyword.length <= 3) {
		// Use word boundary for short keywords to avoid false positives
		// e.g., "AI" inside "maintain"
		const regex = new RegExp('(?:^|\\b|\\s)' + escapeRegex(keyword) + '(?:\\b|\\s|$)', 'i')
		return regex.test(text)
	}
	return text.toLowerCase().includes(keyword.toLowerCase())
}

function isCredentialTerm(keyword: string): boolean {
	const kwLower = keyword.toLowerCase()
	if (CREDENTIAL_TERMS.has(kwLower)) return true
	if (EXPERIENCE_YEARS_REGEX.test(kwLower)) return true
	return false
}

function removeCredentialTerms(
	primary: string[],
	secondary: string[],
): { primary: string[]; secondary: string[] } {
	return {
		primary: primary.filter(kw => !isCredentialTerm(kw)),
		secondary: secondary.filter(kw => !isCredentialTerm(kw)),
	}
}

function demoteRoleTitleKeywords(
	primary: string[],
	secondary: string[],
	jobTitle: string,
): { primary: string[]; secondary: string[] } {
	if (!jobTitle) return { primary, secondary }

	const titleWords = new Set(
		jobTitle.toLowerCase().split(/\s+/).filter(w => !TITLE_MODIFIER_WORDS.has(w))
	)

	const newPrimary: string[] = []
	const demoted: string[] = []

	for (const kw of primary) {
		const kwWords = kw.toLowerCase().split(/\s+/)
		// Layer 1: programmatic title match — every keyword word exists in title's core words
		const allInTitle = titleWords.size > 0 && kwWords.every(w => titleWords.has(w))
		// Layer 2: hardcoded safety net
		const isRoleTitleTerm = ROLE_TITLE_TERMS.has(kw.toLowerCase())

		if (allInTitle || isRoleTitleTerm) {
			demoted.push(kw)
		} else {
			newPrimary.push(kw)
		}
	}

	return { primary: newPrimary, secondary: [...secondary, ...demoted] }
}

function applySectionOverrides(
	primary: string[],
	secondary: string[],
	sections: JdMetadata['sections'],
): { primary: string[]; secondary: string[] } {
	// Demote primary → secondary if keyword ONLY appears in preferredQualifications
	const newPrimary: string[] = []
	const demoted: string[] = []

	for (const kw of primary) {
		const inPreferred = keywordExistsInText(kw, sections.preferredQualifications)
		const inRequired = keywordExistsInText(kw, sections.requiredQualifications)
		const inResponsibilities = keywordExistsInText(kw, sections.responsibilities)
		const inOther = keywordExistsInText(kw, sections.other)

		if (inPreferred && !inRequired && !inResponsibilities && !inOther) {
			demoted.push(kw)
		} else {
			newPrimary.push(kw)
		}
	}

	const resultPrimary = [...newPrimary]
	const resultSecondary = [...secondary, ...demoted]

	// Promote secondary → primary if it appears in requiredQualifications (respect cap of 5)
	const promoted: string[] = []
	const remaining: string[] = []

	for (const kw of resultSecondary) {
		if (resultPrimary.length + promoted.length >= 5) {
			remaining.push(kw)
			continue
		}
		if (keywordExistsInText(kw, sections.requiredQualifications)) {
			promoted.push(kw)
		} else {
			remaining.push(kw)
		}
	}

	return {
		primary: [...resultPrimary, ...promoted],
		secondary: remaining,
	}
}

// ─── Main extraction ─────────────────────────────────────────────────

/**
 * Extract tiered keywords from a job description.
 *
 * Pipeline: JD pre-processing → GPT extraction → JD validation → boilerplate filter
 *         → deduplicate → credential removal → role-title demotion → section overrides → cap & tier.
 *
 * @param jobDescription - Raw job description text from any industry/role
 * @param jobTitle - Job title (optional, used for role-title filtering)
 * @returns { keywords: string[], primary: string[] } — tiered keyword result
 */
export async function extractKeywordsFromJobDescription(
	jobDescription: string,
	jobTitle?: string,
): Promise<ExtractedKeywordsResult> {
	if (!jobDescription || jobDescription.trim().length === 0) {
		return { keywords: [], primary: [] }
	}

	const title = jobTitle || ''
	const metadata = parseJobDescription(jobDescription, title)

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-5.2',
			messages: [
				{
					role: 'system',
					content: `You are a keyword extraction engine for ATS (Applicant Tracking System) optimization.

YOUR JOB: Extract concise 1-3 word keywords that differentiate qualified candidates,
split into two tiers: PRIMARY must-haves and SECONDARY supporting keywords.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULE — KEYWORD LENGTH:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every keyword MUST be 1-3 words. NEVER extract full phrases or sentences.
Distill long JD phrases down to their core keyword:
  ❌ "Full lifecycle development experience using Agile/Scrum methodologies" → ✅ "Agile/Scrum"
  ❌ "3+ years of experience in Product Management" → ✅ "Product Management"
  ❌ "Deliver PRDs with prioritized features and capabilities" → ✅ "PRDs"
  ❌ "Client facing or consulting experience" → ✅ "consulting"
  ❌ "Healthcare platforms & HIPAA security standards" → ✅ "HIPAA"
  ❌ "Use Figma and AI-powered tools to support wireframing" → ✅ "Figma", "wireframing"
  ❌ "Perform product demos to customers" → ✅ "product demos"
  ❌ "bachelor's degree or equivalent" → ✅ Do NOT extract (eligibility filter, not keyword)

WHY THIS MATTERS:
- ATS systems match on concise terms, not full sentences
- Candidates need these terms in their resume/skills section to pass screening
- Long phrases are noise — the actual keyword is the specific noun or skill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORD TIERING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Most job descriptions are 70% boilerplate. Your job is to separate the signal
from the noise by identifying the TRUE must-haves vs supporting nice-to-haves.

PRIMARY (3-5 keywords): Non-generic must-haves that a recruiter would REJECT
a candidate for lacking. These are the dealbreakers — the skills, tools, or
qualifications that are absolutely required. Ask: "Would a recruiter toss this
resume if this keyword were completely missing?" If YES → primary.
Keywords that appear in REQUIRED QUALIFICATIONS should strongly bias toward primary.

SECONDARY (5-7 keywords): Supporting terms that STRENGTHEN a resume but aren't
dealbreakers. These include nice-to-have skills, preferred qualifications,
domain knowledge that's helpful but not required, and tools that could be
learned on the job.
Keywords that ONLY appear in PREFERRED QUALIFICATIONS should bias toward secondary.

The job title is provided above. Do NOT include the job title or its direct synonyms
as a primary keyword. Every applicant for a ${title || 'this'} role will have this —
it does not differentiate.

Do NOT extract degree requirements (e.g. "bachelor's degree", "MBA", "PhD"),
years-of-experience requirements (e.g. "5+ years", "8+ years"), or other eligibility
filters as keywords. These are handled separately by ATS structured fields, not keyword matching.

Context qualifiers like "enterprise scale", "large organizations", "global teams" describe
where someone worked, not what they can do. These belong in secondary unless they are the
core differentiator of the role.

Terms with higher frequency across multiple sections are stronger signals. A term
appearing in both responsibilities AND required qualifications is a stronger must-have
than one appearing only once.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION ALGORITHM (4-tier priority system):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1: HARD REQUIREMENTS (always extract these first → usually PRIMARY)
- Certifications: "PMP", "CPA", "AWS Certified"
- Licenses: "RN license", "PE license"
- Required skills explicitly stated in requirements/qualifications section
- NOTE: Do NOT extract degrees or years-of-experience — those are eligibility filters, not keywords

TIER 2: CORE JOB FUNCTIONS (distilled to 1-3 word noun phrases → PRIMARY or SECONDARY)
- Extract the core skill/activity, NOT the full sentence
- Examples: "budget planning", "patient care", "sales forecasting", "wireframing"
- Skip generic terms that just restate the job title

TIER 3: SPECIALIZED KNOWLEDGE (tools, technologies, domain expertise → PRIMARY or SECONDARY)
- Named tools & technologies: "Python", "Salesforce", "Azure DevOps", "Figma"
- Domain terms: "GAAP", "HIPAA", "OSHA", "SEO"
- Methodologies: "Agile/Scrum", "Six Sigma", "CI/CD"

TIER 4: EMPHASIZED SOFT SKILLS (only if repeatedly mentioned → SECONDARY)
- Extract 2-4 max: "leadership", "negotiation", "client relationships"
- Skip generic terms everyone claims: "communication", "problem solving", "team player"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILTERING RULES (what NOT to extract):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ NEVER extract:
1. The job title itself when it appears in its own description
2. The company name or internal department names
3. Location/city names (unless it's a license requirement like "California PE license")
4. High-frequency terms that describe the core domain (e.g. 'AI' in an AI role) SHOULD be extracted as primary — they are the topic AND the must-have.
5. Generic corporate values: "integrity", "innovation", "customer focus", "teamwork"
6. Vague action verbs without context: "manage", "lead", "develop", "collaborate"
7. Company-specific program names or internal frameworks

✅ ONLY extract if:
1. It's a named tool, technology, or system: "Excel", "Python", "Salesforce", "MRI machines"
3. It requires specialized knowledge: "OSHA compliance", "GAAP", "SEO", "welding"
4. It appears in requirements AND job duties sections (strong signal)
5. Less than 30% of general applicants would naturally have it

THE DIFFERENTIATION TEST:
Ask yourself: "Would 100% of applicants for this role have this keyword?"
- If YES → Don't extract it (it's noise)
- If NO → Extract it (it's a differentiator)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATTING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- MAXIMUM 3 WORDS per keyword. If a JD phrase is longer, extract only the core term.
- Keep acronyms uppercase: AWS, API, SQL, HVAC, RN, CPA
- Multi-word terms (2-3 words max): "machine learning", "project management", "supply chain"
- Proper nouns capitalized: Python, Salesforce, Medicare, JavaScript
- Generic terms lowercase: "leadership", "budgeting", "planning"
- Preserve special characters: "C++", "C#", "Node.js", "3+ years"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT QUANTITY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return 3-5 PRIMARY keywords and 5-7 SECONDARY keywords (8-12 total).
Pick the most specific, substantive requirements — the ones a hiring manager
deliberately wrote into this JD. Prioritize Tier 1-3 keywords. Only include
Tier 4 soft skills as SECONDARY if you have fewer than 5 secondary keywords.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return valid JSON:
{
  "primary": ["must-have1", "must-have2", "must-have3"],
  "secondary": ["supporting1", "supporting2", "supporting3", "supporting4", "supporting5"]
}

CRITICAL: Every keyword must be 1-3 words and appear in the job description. Do NOT return full sentences or phrases longer than 3 words. Do NOT invent or infer terms not stated. Do NOT put the same keyword in both arrays.`,
				},
				{
					role: 'user',
					content: buildUserMessage(metadata),
				},
			],
			temperature: 0.4,
			response_format: { type: 'json_object' },
		})

		const content = response.choices[0]?.message?.content
		if (!content) {
			return { keywords: [], primary: [] }
		}

		const parsed = JSON.parse(content) as { primary?: unknown[]; secondary?: unknown[] }
		const jdLower = jobDescription.toLowerCase()

		// Validate both arrays
		let primary = validateKeywords(parsed.primary ?? [], jdLower)
		let secondary = validateKeywords(parsed.secondary ?? [], jdLower)

		// Remove duplicates between primary and secondary (primary wins)
		const primarySet = new Set(primary.map(k => k.toLowerCase()))
		secondary = secondary.filter(k => !primarySet.has(k.toLowerCase()))

		// Post-validation: remove credential/experience terms entirely
		const credentialResult = removeCredentialTerms(primary, secondary)
		primary = credentialResult.primary
		secondary = credentialResult.secondary

		// Post-validation: role-title demotion
		const roleTitleResult = demoteRoleTitleKeywords(primary, secondary, title)
		primary = roleTitleResult.primary
		secondary = roleTitleResult.secondary

		// Post-validation: section-based tier overrides
		const sectionResult = applySectionOverrides(primary, secondary, metadata.sections)
		primary = sectionResult.primary
		secondary = sectionResult.secondary

		// Cap: max 5 primary, max 7 secondary
		primary = primary.slice(0, 5)
		secondary = secondary.slice(0, 7)

		// If <3 primary returned, promote top secondary keywords
		while (primary.length < 3 && secondary.length > 0) {
			primary.push(secondary.shift()!)
		}

		const keywords = [...primary, ...secondary]

		return { keywords, primary }

	} catch (error) {
		return { keywords: [], primary: [] }
	}
}
