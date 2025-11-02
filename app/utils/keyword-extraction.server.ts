/**
 * Keyword Extraction using OpenAI
 *
 * Extracts meaningful keywords and key phrases from job descriptions
 * to improve resume scoring accuracy.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
})

/**
 * Extract 15-20 key technical skills, tools, and qualifications from a job description
 *
 * @param jobDescription - The job description text
 * @returns Array of keyword strings (can be multi-word phrases)
 */
export async function extractKeywordsFromJobDescription(
	jobDescription: string
): Promise<string[]> {
	if (!jobDescription || jobDescription.trim().length === 0) {
		return []
	}

	try {
		console.log('[Keyword Extraction] Starting OpenAI extraction for job description...')
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{
					role: 'system',
					content: `Extract the most important keywords and phrases from this job description for ATS matching.

EXTRACTION RULES:

1. PRESERVE EXACT PHRASES - Do not split these:
   - Multi-word technical terms: "machine learning", "natural language processing"
   - Experience requirements: "5+ years experience", "3-5 years"
   - Job titles: "Senior Software Engineer", "Product Manager"
   - Degree requirements: "bachelor's degree", "master's degree"
   - Compound tools: "REST API", "CI/CD", "AWS Lambda"

2. PRIORITIZATION (extract 15-30 keywords based on job complexity):
   - Hard technical skills (Python, React, AWS, Kubernetes)
   - Tools and frameworks (Docker, Jira, HubSpot, Salesforce)
   - Certifications (AWS Certified, PMP)
   - Experience levels (5+ years, senior, lead)
   - Domain knowledge (insurtech, SaaS, B2B, compliance)
   - Key soft skills only if emphasized (leadership, communication)

3. FORMATTING:
   - Keep acronyms uppercase: AWS, API, SDK, CI/CD, OCR, LLM
   - Keep proper nouns capitalized: Python, JavaScript, React, TypeScript
   - Keep multi-word phrases intact: "machine learning" not ["machine", "learning"]
   - Preserve special characters in version/experience: "5+ years", "Node.js", "C#"
   - Use lowercase for generic terms: leadership, agile, remote

4. QUANTITY GUIDANCE:
   - Technical roles (SWE, Data, DevOps): Extract 20-30 keywords (more tools/frameworks)
   - Product/Business roles: Extract 15-20 keywords (fewer technical, more domain)
   - Executive/Leadership roles: Extract 10-15 keywords (focus on experience/domain)

OUTPUT FORMAT - Return valid JSON:
{"keywords": ["Python", "5+ years experience", "machine learning", "AWS", ...]}

CRITICAL: Each keyword must appear as-is in the job description. Do not invent or generalize terms.`,
				},
				{
					role: 'user',
					content: jobDescription,
				},
			],
			temperature: 0.1, // Lower temperature for consistency
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

		// Validate keywords appear in job description
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
					`[Keyword Extraction] ⚠️ Keyword "${keyword}" not found in job description`,
				)
			}
		})

		if (invalidKeywords.length > 0) {
			console.log(
				`[Keyword Extraction] Filtered out ${invalidKeywords.length} invalid keywords`,
			)
		}

		// Allow up to 30 keywords
		const finalKeywords = validKeywords.slice(0, 30)
		console.log(
			`[Keyword Extraction] ✅ Extracted ${finalKeywords.length} valid keywords:`,
			finalKeywords,
		)

		return finalKeywords
	} catch (error) {
		console.error('[Keyword Extraction] ❌ Error extracting keywords:', error)
		return []
	}
}
