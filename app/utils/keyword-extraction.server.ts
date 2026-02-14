/**
 * Keyword Extraction using OpenAI
 *
 * PROBLEM WE'RE SOLVING:
 * - ATS systems match resumes against job descriptions using keyword matching
 * - Not all words in a JD are "keywords" - some are noise (company jargon, repeated terms)
 * - We need to extract DIFFERENTIATING terms that signal candidate fit
 *
 * ARCHITECTURE:
 * - Use GPT-4.1 with structured output (response_format: json_object) for consistency
 * - Implement validation layer to ensure extracted keywords actually exist in JD
 * - Programmatic boilerplate filter removes generic JD filler after extraction
 * - Temperature=0.1 for deterministic results across same JD inputs
 * - Capped at 12 keywords — the most specific, substantive requirements
 */

import OpenAI from 'openai'

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

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
})

/**
 * Extract up to 12 high-signal keywords from a job description.
 *
 * Pipeline: GPT extraction → JD validation → boilerplate filter → cap at 12.
 *
 * @param jobDescription - Raw job description text from any industry/role
 * @returns Array of keyword strings (max 12)
 */
export async function extractKeywordsFromJobDescription(
	jobDescription: string
): Promise<string[]> {
	if (!jobDescription || jobDescription.trim().length === 0) {
		return []
	}

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-5.2',
			messages: [
				{
					role: 'system',
					content: `You are a keyword extraction engine for ATS (Applicant Tracking System) optimization.

YOUR JOB: Extract keywords that differentiate qualified candidates from unqualified ones.

WHY THIS MATTERS:
- ATS systems scan resumes for keyword matches against the job description
- Candidates need these EXACT terms in their resume/skills section to pass screening
- But not every word in a JD is a "keyword" - many are just noise

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION ALGORITHM (4-tier priority system):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1: HARD REQUIREMENTS (always extract these first)
- Years of experience: "5+ years", "3-7 years", "10+ years in management"
- Education: "bachelor's degree", "MBA", "PhD", "high school diploma"
- Certifications: "PMP", "CPA", "AWS Certified", "Six Sigma Black Belt"
- Licenses: "driver's license", "RN license", "bar admission"
- Required skills explicitly stated in requirements/qualifications section

TIER 2: CORE JOB FUNCTIONS (what they actually do day-to-day)
- Extract 5-8 action-oriented phrases: "budget planning", "patient care", "software development", "sales forecasting"
- Focus on verb + object combinations that describe the work
- Skip generic terms that just restate the job title (e.g., don't extract "sales" for a "Sales Manager" role)

TIER 3: SPECIALIZED KNOWLEDGE (tools, technologies, domain expertise)
- Extract 8-12 terms that require specific training or experience
- Examples: "Python", "Salesforce", "GAAP", "HVAC systems", "EHR software", "forklift operation", "CAD software"
- Include industry-specific terminology
- Include specific methodologies, frameworks, or standards

TIER 4: EMPHASIZED SOFT SKILLS (only if repeatedly mentioned)
- Extract 2-4 max, and only if mentioned multiple times OR in requirements
- Examples: "leadership", "client relationships", "negotiation", "team collaboration"
- Skip generic terms everyone claims: "communication", "problem solving", "team player"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILTERING RULES (what NOT to extract):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ NEVER extract:
1. The job title itself when it appears in its own description
2. The company name or internal department names
3. Location/city names (unless it's a license requirement like "California PE license")
4. Terms that appear 5+ times (it's the topic, not a differentiator)
5. Generic corporate values: "integrity", "innovation", "customer focus", "teamwork"
6. Vague action verbs without context: "manage", "lead", "develop", "collaborate"
7. Company-specific program names or internal frameworks

✅ ONLY extract if:
1. It's measurable: "5+ years", "bachelor's degree", "$1M quota"
2. It's a named tool, technology, or system: "Excel", "Python", "Salesforce", "MRI machines"
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

- Preserve exact phrasing as it appears: "5+ years" not "five years"
- Keep acronyms uppercase: AWS, API, SQL, HVAC, RN, CPA
- Multi-word terms stay together: "machine learning", "project management", "supply chain"
- Proper nouns capitalized: Python, Salesforce, Medicare, JavaScript
- Generic terms lowercase: "leadership", "budgeting", "planning"
- Preserve special characters: "C++", "C#", "Node.js", "3+ years"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT QUANTITY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return exactly 10-12 keywords regardless of role type. Pick the 12 most
specific, substantive requirements — the ones a hiring manager deliberately
wrote into this JD. Prioritize Tier 1-3 keywords. Only include Tier 4 soft
skills if you have fewer than 10 keywords from Tiers 1-3.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return valid JSON:
{
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

CRITICAL: Every keyword must appear verbatim in the job description. Do NOT invent, generalize, or infer terms not explicitly stated.`,
				},
				{
					role: 'user',
					content: jobDescription,
				},
			],
			temperature: 0.4,
			response_format: { type: 'json_object' },
		})

		const content = response.choices[0]?.message?.content
		if (!content) {
			return []
		}

		const parsed = JSON.parse(content) as { keywords?: unknown }
		const keywords = parsed.keywords || []

		if (!Array.isArray(keywords)) {
			return []
		}

		// VALIDATION LAYER: Ensure extracted keywords actually exist in JD
		// WHY: Prevents LLM hallucinations that would mislead candidates
		const jdLower = jobDescription.toLowerCase()
		const validKeywords: string[] = []

		keywords.forEach((kw: any) => {
			const keyword = String(kw)
			if (jdLower.includes(keyword.toLowerCase())) {
				validKeywords.push(keyword)
			}
		})

		// BOILERPLATE FILTER: Remove generic JD filler that slipped past the prompt
		const filteredKeywords = validKeywords.filter(kw => {
			const kwLower = kw.toLowerCase()
			// Exact match for single-word boilerplate
			if (BOILERPLATE_PHRASES.has(kwLower)) return false
			// Substring match for multi-word boilerplate within the keyword
			for (const phrase of BOILERPLATE_PHRASES) {
				if (phrase.includes(' ') && kwLower.includes(phrase)) return false
			}
			return true
		})

		// Cap at 12 keywords — the most specific, substantive requirements
		const finalKeywords = filteredKeywords.slice(0, 12)

		return finalKeywords

	} catch (error) {
		return []
	}
}
