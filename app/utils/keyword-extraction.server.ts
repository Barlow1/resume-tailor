/**
 * Keyword Extraction using OpenAI
 *
 * Extracts meaningful keywords and key phrases from job descriptions
 * to improve resume scoring accuracy.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
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
			model: 'gpt-4o-mini',
			messages: [
				{
		role: 'system',
		content: `Extract exactly 20 keywords and phrases from the job description that would appear in a candidate's resume.

		PRIORITIZATION (in order):
		1. Technical skills, tools, frameworks (Python, React, Docker)
		2. Certifications and credentials (AWS Certified, PMP)
		3. Specific requirements (5+ years experience, Bachelor's degree)
		4. Domain knowledge (machine learning, cloud architecture)
		5. Soft skills only if explicitly required (leadership, communication)

		FORMATTING RULES:
		- Keep acronyms uppercase (AWS, CI/CD, API)
		- Keep proper nouns capitalized (Python, JavaScript, Salesforce)
		- Use lowercase for common terms (leadership, agile, remote)
		- Prefer multi-word phrases when meaningful ("machine learning" not "machine" + "learning")
		- Remove generic words like "experience with" or "knowledge of" - just extract the skill itself
		- If similar terms appear, pick the most specific one (use "React 18" not both "React" and "React 18")

		OUTPUT FORMAT:
		Return ONLY valid JSON with no additional text:
		{"keywords": ["Python", "AWS", "5+ years experience", "machine learning", "CI/CD", "leadership", "bachelor's degree"]}

		Extract exactly 20 items. If the job description has fewer distinct skills, pad with the most relevant repeated concepts.`
				},
				{
					role: 'user',
					content: jobDescription,
				},
			],
			temperature: 0.3,
			response_format: { type: 'json_object' },
		})

		const content = response.choices[0]?.message?.content
		if (!content) {
			console.error('No content returned from OpenAI')
			return []
		}

		const parsed = JSON.parse(content) as { keywords?: unknown }
		const keywords = parsed.keywords || []

		// Validate and limit to 20 keywords
		if (Array.isArray(keywords)) {
			const extractedKeywords = keywords.slice(0, 20).map((k: any) => String(k))
			console.log(`[Keyword Extraction] ✅ Extracted ${extractedKeywords.length} keywords:`, extractedKeywords)
			return extractedKeywords
		}

		console.log('[Keyword Extraction] ⚠️ No keywords array found in response')
		return []
	} catch (error) {
		console.error('[Keyword Extraction] ❌ Error extracting keywords:', error)
		return []
	}
}
