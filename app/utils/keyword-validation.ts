/**
 * Keyword Validation Utilities
 *
 * Validates that extracted keywords actually appear in the job description
 * and provides debugging information for keyword matching.
 */

export interface KeywordValidationResult {
	valid: string[]
	invalid: string[]
	warnings: string[]
}

/**
 * Validate that extracted keywords appear in the job description
 */
export function validateExtractedKeywords(
	keywords: string[],
	jobDescription: string,
): KeywordValidationResult {
	const jdLower = jobDescription.toLowerCase()

	const valid: string[] = []
	const invalid: string[] = []
	const warnings: string[] = []

	keywords.forEach(kw => {
		const kwLower = kw.toLowerCase()

		if (jdLower.includes(kwLower)) {
			valid.push(kw)
		} else {
			invalid.push(kw)
			warnings.push(`Keyword "${kw}" not found in job description`)
			console.warn(`[Keyword Validation] Keyword "${kw}" not found in job description`)
		}
	})

	if (invalid.length > 0) {
		console.log(
			`[Keyword Validation] Found ${invalid.length} invalid keywords out of ${keywords.length} total`,
		)
	}

	return { valid, invalid, warnings }
}

/**
 * Check if a keyword is present in resume text using hybrid matching
 */
export function isKeywordPresent(
	keyword: string,
	resumeText: string,
	resumeTokens: Set<string>,
): boolean {
	const kwLower = keyword.toLowerCase()
	const resumeLower = resumeText.toLowerCase()

	// Multi-word phrases: exact match
	if (kwLower.includes(' ')) {
		return resumeLower.includes(kwLower)
	}

	// Single words: token match
	return resumeTokens.has(kwLower)
}

/**
 * Categorize a keyword by type for better UX
 */
export function categorizeKeyword(keyword: string): string {
	if (/\d+\+?\s*years?/i.test(keyword)) {
		return 'experience'
	}

	if (/^[A-Z]{2,}$/.test(keyword) || /API|SDK|CLI|UI|UX/i.test(keyword)) {
		return 'technical'
	}

	if (
		/docker|kubernetes|jira|hubspot|salesforce|aws|azure|gcp|react|python|javascript|typescript|node\.?js/i.test(
			keyword,
		)
	) {
		return 'tools'
	}

	if (
		/leadership|communication|agile|remote|team|collaboration|scrum|kanban/i.test(
			keyword,
		)
	) {
		return 'soft'
	}

	if (
		/saas|b2b|b2c|fintech|insurtech|healthtech|edtech|ml|ai|cloud|devops|frontend|backend|fullstack/i.test(
			keyword,
		)
	) {
		return 'domain'
	}

	return 'domain' // Default
}

/**
 * Debug keyword matching issues
 */
export function debugKeywordMatch(
	keyword: string,
	resumeText: string,
	resumeTokens: Set<string>,
): {
	keyword: string
	found: boolean
	strategy: 'exact-phrase' | 'token'
	details: string
} {
	const kwLower = keyword.toLowerCase()
	const resumeLower = resumeText.toLowerCase()

	if (kwLower.includes(' ')) {
		// Multi-word phrase
		const found = resumeLower.includes(kwLower)
		return {
			keyword,
			found,
			strategy: 'exact-phrase',
			details: found
				? `Found exact phrase "${keyword}" in resume`
				: `Phrase "${keyword}" not found. Resume may have partial matches only.`,
		}
	} else {
		// Single word
		const found = resumeTokens.has(kwLower)
		return {
			keyword,
			found,
			strategy: 'token',
			details: found
				? `Found token "${keyword}" in resume`
				: `Token "${keyword}" not found. Check for variations or synonyms.`,
		}
	}
}

/**
 * Get suggestions for adding a missing keyword
 */
export function getSuggestionForKeyword(keyword: string): string {
	const category = categorizeKeyword(keyword)

	const suggestions: Record<string, string> = {
		experience: `Add "${keyword}" to your job descriptions or summary to show you meet the experience requirement.`,
		technical: `Add "${keyword}" to your skills section or mention it in relevant experience bullet points.`,
		tools: `Add "${keyword}" to your skills section or describe projects where you used this tool.`,
		soft: `Demonstrate "${keyword}" through specific examples in your experience descriptions.`,
		domain: `Show "${keyword}" expertise by mentioning relevant projects, industries, or technologies in your experience.`,
	}

	return suggestions[category] || `Add "${keyword}" naturally to your resume where relevant.`
}
