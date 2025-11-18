/**
 * Keyword Extraction using OpenAI
 *
 * PROBLEM WE'RE SOLVING:
 * - ATS systems match resumes against job descriptions using keyword matching
 * - Not all words in a JD are "keywords" - some are noise (company jargon, repeated terms)
 * - We need to extract DIFFERENTIATING terms that signal candidate fit
 *
 * ARCHITECTURE:
 * - Use GPT-4o with structured output (response_format: json_object) for consistency
 * - Implement validation layer to ensure extracted keywords actually exist in JD
 * - Temperature=0.1 for deterministic results across same JD inputs
 */

import OpenAI from 'openai'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
})

/**
 * Extract 15-30 keywords from any job description that maximize ATS match rate
 *
 * WHY THIS APPROACH:
 * - Tiered extraction ensures we prioritize hard requirements over generic terms
 * - Filtering rules prevent extracting company jargon or over-represented terms
 * - Works across industries (tech, finance, healthcare, retail, etc.)
 * - Works across role types (IC, manager, executive, technical, non-technical)
 *
 * @param jobDescription - Raw job description text from any industry/role
 * @returns Array of keyword strings (can be multi-word phrases like "5+ years experience")
 */
export async function extractKeywordsFromJobDescription(
	jobDescription: string
): Promise<string[]> {
	if (!jobDescription || jobDescription.trim().length === 0) {
		return []
	}

	try {
		console.log('[Keyword Extraction] Starting OpenAI extraction...')

		const response = await openai.chat.completions.create({
			model: 'gpt-4.1',
			messages: [
				{
					role: 'system',
					content: `You are a keyword extraction engine for ATS (Applicant Tracking System) optimization.

YOUR JOB: Extract ONLY skills and technologies that would actually appear in a resume's experience bullets or skills section.

WHY THIS MATTERS:
- ATS systems scan resumes for keyword matches against the job description
- Candidates need these EXACT terms in their resume/skills section to pass screening
- But not every word in a JD is a "keyword" - many are just requirements or noise

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: DO NOT EXTRACT (these appear in requirements but NOT in resumes):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Education requirements: "bachelor's degree", "computer science degree", "engineering degree", "MBA", "PhD", "high school diploma"
❌ Years of experience: "4+ years", "5 years of experience", "10+ years in management"
❌ Broad categories: "engineering", "technology", "software", "business"
❌ Company benefits or perks: "401k", "health insurance", "remote work"
❌ Generic soft skills: "communication", "teamwork", "problem solving" (unless VERY specific like "executive presence")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ EXTRACTION ALGORITHM (3-tier priority system):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1: SPECIFIC TOOLS & PLATFORMS (highest value)
- Extract 8-15 specific tools, platforms, and software
- Examples: "JIRA", "Figma", "Salesforce", "AWS", "Python", "SQL", "Tableau", "Excel", "React"
- Certifications that ARE skills: "PMP", "CPA", "AWS Certified", "Six Sigma Black Belt"
- Licenses that ARE credentials: "RN license", "bar admission", "PE license"

TIER 2: METHODOLOGIES & DOMAIN EXPERTISE (medium value)
- Extract 5-10 methodologies, frameworks, and domain areas
- Examples: "agile", "scrum", "waterfall", "design thinking", "SaaS", "fintech", "healthcare", "machine learning", "API design"
- Include specific processes: "A/B testing", "user research", "roadmap planning", "budget forecasting"

TIER 3: CONCRETE RESPONSIBILITIES (if very specific)
- Extract 3-5 specific, action-oriented responsibilities
- Examples: "roadmap planning", "stakeholder management", "vendor negotiation", "SQL query optimization"
- Skip vague terms: "manage", "lead", "develop", "collaborate"

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
OUTPUT QUANTITY (return 15-25 keywords maximum):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Focus on QUALITY over quantity
- Aim for 15-25 highly relevant keywords that would actually appear in a resume
- Prioritize specific tools, platforms, and methodologies over generic terms
- If the job is very technical (engineering, data science), lean towards 20-25
- If the job is non-technical (sales, operations), lean towards 15-20

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
			temperature: 0.1,
			response_format: { type: 'json_object' },
		})

		const content = response.choices[0]?.message?.content
		if (!content) {
			console.error('[Keyword Extraction] No content returned from OpenAI')
			return []
		}

		const parsed = JSON.parse(content) as { keywords?: unknown }
		const keywords = parsed.keywords || []

		if (!Array.isArray(keywords)) {
			console.log('[Keyword Extraction] ⚠️ No keywords array found in response')
			return []
		}

		// VALIDATION LAYER: Ensure extracted keywords actually exist in JD
		// WHY: Prevents LLM hallucinations that would mislead candidates
		const jdLower = jobDescription.toLowerCase()
		const validKeywords: string[] = []
		const invalidKeywords: string[] = []

		keywords.forEach((kw: any) => {
			const keyword = String(kw)
			if (jdLower.includes(keyword.toLowerCase())) {
				validKeywords.push(keyword)
			} else {
				invalidKeywords.push(keyword)
				console.warn(
					`[Keyword Extraction] ⚠️ Keyword "${keyword}" not found in JD (filtered out)`,
				)
			}
		})

		if (invalidKeywords.length > 0) {
			console.log(
				`[Keyword Extraction] Filtered out ${invalidKeywords.length} invalid keywords`,
			)
		}

		// Cap at 30 keywords - beyond this you get diminishing returns
		const finalKeywords = validKeywords.slice(0, 30)

		console.log(
			`[Keyword Extraction] ✅ Extracted ${finalKeywords.length} keywords`,
		)

		return finalKeywords

	} catch (error) {
		console.error('[Keyword Extraction] ❌ Error extracting keywords:', error)
		return []
	}
}
