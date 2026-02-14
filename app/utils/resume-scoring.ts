/**
 * Client-side Resume Scoring Engine
 *
 * Provides instant feedback on resume quality with 4 scoring dimensions:
 * 1. Keyword Match (0-100): Frequency-aware match against job description keywords
 *    - Keywords in 0 sections → 0 points (missing)
 *    - Keywords in 1 section → 0.6 points (partial)
 *    - Keywords in 2+ sections → 1.0 points (full)
 *    - Includes a spread bonus (0-7 pts) for keyword distribution across sections
 * 2. Quantifiable Metrics (0-100): Presence of numbers, percentages, metrics
 * 3. Action Verbs (0-100): Strong action verbs at start of bullets
 * 4. Length Appropriateness (0-100): Optimal content density
 *
 * Overall score is weighted average with keyword match having highest weight.
 * Weights: keyword 50%, metrics 20%, action verbs 20%, length 10%.
 */

import type { ResumeData } from './builder-resume.server.ts'

// Strong action verbs for resume bullets (lowercase, 150+)
const ACTION_VERBS = new Set([
	// Leadership / Strategy
	'led', 'directed', 'managed', 'oversaw', 'headed', 'chaired', 'orchestrated',
	'spearheaded', 'championed', 'pioneered', 'established', 'founded', 'shaped',
	'owned', 'governed',
	// Building / Creating
	'built', 'created', 'designed', 'developed', 'engineered', 'architected',
	'constructed', 'launched', 'shipped', 'deployed', 'implemented', 'prototyped',
	'configured', 'assembled', 'authored', 'produced', 'crafted',
	// Improving / Optimizing
	'improved', 'optimized', 'streamlined', 'revamped', 'redesigned', 'rebuilt',
	'restructured', 'modernized', 'upgraded', 'refined', 'enhanced', 'transformed',
	'overhauled', 'consolidated', 'strengthened', 'elevated', 'repositioned',
	// Analysis / Research
	'analyzed', 'researched', 'evaluated', 'assessed', 'audited', 'benchmarked',
	'investigated', 'mapped', 'identified', 'discovered', 'spotted', 'diagnosed',
	'validated', 'tested', 'surveyed', 'interviewed', 'examined', 'inspected',
	'uncovered', 'surfaced',
	// Growth / Revenue
	'grew', 'increased', 'expanded', 'scaled', 'boosted', 'doubled', 'tripled',
	'accelerated', 'maximized', 'generated', 'monetized', 'captured',
	// Reduction / Efficiency
	'reduced', 'cut', 'decreased', 'eliminated', 'killed', 'removed', 'minimized',
	'shortened', 'simplified', 'automated',
	// Communication / Influence
	'presented', 'pitched', 'negotiated', 'persuaded', 'advocated', 'communicated',
	'published', 'documented', 'reported', 'briefed', 'advised', 'coached',
	'mentored', 'trained', 'educated', 'informed',
	// Execution / Delivery
	'delivered', 'executed', 'completed', 'achieved', 'accomplished', 'fulfilled',
	'resolved', 'solved', 'fixed', 'addressed', 'handled', 'processed',
	'facilitated', 'coordinated', 'organized', 'prioritized', 'triaged',
	// Acquisition / Growth
	'recruited', 'hired', 'sourced', 'acquired', 'secured', 'won', 'closed',
	'converted', 'attracted', 'onboarded',
	// Data / Technical
	'migrated', 'integrated', 'debugged', 'programmed', 'coded', 'scripted',
	'queried', 'modeled', 'forecasted', 'calculated', 'quantified', 'measured',
	'tracked', 'monitored', 'instrumented',
	// Collaboration
	'partnered', 'collaborated', 'aligned', 'unified', 'mobilized', 'rallied',
	'supported', 'enabled', 'empowered',
	// Process / Operations
	'standardized', 'formalized', 'systematized', 'instituted', 'introduced',
	'initiated', 'defined', 'scoped', 'planned', 'budgeted', 'allocated',
	'distributed', 'maintained', 'sustained',
	// Common resume verbs often missed
	'ran', 'turned', 'found', 'drove', 'conducted', 'navigated', 'transitioned',
	'synthesized', 'distilled', 'leveraged', 'utilized', 'translated',
])

/**
 * Extract the leading verb from a bullet, stripping markdown/list prefixes.
 * Handles "- Built...", "* Shipped...", "• Ran...", etc.
 */
function extractLeadingVerb(bullet: string): string {
	return bullet
		.trim()
		.replace(/^[-*•–—]\s+/, '') // strip list markers
		.toLowerCase()
		.split(/\s+/)[0] || ''
}

// Stop words to ignore when extracting keywords
const STOP_WORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
	'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
	'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
	'might', 'can', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you',
	'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why',
	'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'such',
])

export interface KeywordMatch {
	keyword: string
	sections: string[]
	sectionCount: number
	score: number        // 0 | 0.6 | 1.0
	status: 'missing' | 'partial' | 'full'
}

export interface ScoreBreakdown {
	overall: number
	keyword: number
	metrics: number
	actionVerbs: number
	length: number
	keywordMatches: KeywordMatch[]
}

export interface FlaggedBullet {
	experienceId: string
	bulletIndex: number
	content: string
	reason: string
}

export interface ChecklistItem {
	id: string
	text: string
	completed: boolean
	explanation: string
	priority: 'high' | 'medium' | 'low'
	flaggedBullets?: FlaggedBullet[]
	missingKeywords?: string[]
}

/**
 * Extract keywords from text (handles multi-word phrases)
 */
function extractKeywords(text: string): Set<string> {
	if (!text) return new Set()

	const normalized = text.toLowerCase()

	// First, extract multi-word technical phrases (before tokenizing)
	const multiWordPatterns = [
		/\d+\+?\s*years?\s+(?:of\s+)?experience/g, // "5+ years experience"
		/[a-z]+\s+[a-z]+\s+(?:engineer|developer|manager|analyst|designer|architect|scientist|lead)/g, // "Senior Software Engineer"
		/(?:machine|deep|natural language|computer|data|artificial)\s+(?:learning|processing|science|intelligence|vision)/g, // "machine learning"
		/\b[a-z]+\s+(?:API|SDK|CLI|UI|UX)\b/gi, // "REST API", "AWS SDK"
		/[a-z]+'s\s+degree/g, // "bachelor's degree"
		/full\s+stack|front\s+end|back\s+end/g, // "full stack"
		/product\s+management|project\s+management|program\s+management/g, // PM terms
		/customer\s+success|customer\s+service|sales\s+development/g, // CS/Sales terms
		/\b(?:saas|b2b|b2c|fintech|insurtech|healthtech|edtech)\b/gi, // Industry terms
	]

	const multiWordMatches = new Set<string>()
	multiWordPatterns.forEach(pattern => {
		const matches = normalized.match(pattern)
		if (matches) {
			matches.forEach(m => multiWordMatches.add(m.trim()))
		}
	})

	// Then tokenize remaining text
	const tokens = new Set(
		normalized
			.replace(/[^a-z0-9+#.\-\s]/g, ' ')
			.split(/\s+/)
			.filter(word => word.length > 2 && !STOP_WORDS.has(word)),
	)

	// Combine both sets
	return new Set([...multiWordMatches, ...tokens])
}

/**
 * Check if a keyword exists in a text block using hybrid matching.
 * Multi-word keywords: substring match. Single-word: token set match.
 */
function keywordExistsInText(kwLower: string, textLower: string, tokens: Set<string>): boolean {
	if (kwLower.includes(' ')) {
		return textLower.includes(kwLower)
	}
	return tokens.has(kwLower)
}

/**
 * Build a map of resume sections with their text content and token sets.
 * Each section is a distinct scoring unit for frequency matching.
 */
function buildSectionMap(resumeData: ResumeData): Map<string, { text: string, tokens: Set<string> }> {
	const sections = new Map<string, { text: string, tokens: Set<string> }>()

	// Summary
	const aboutText = resumeData.about || ''
	if (aboutText.trim()) {
		sections.set('Summary', { text: aboutText.toLowerCase(), tokens: extractKeywords(aboutText) })
	}

	// Each experience entry is its own section
	resumeData.experiences?.forEach((exp: any) => {
		const parts = [
			exp.role || '',
			exp.company || '',
			...(exp.descriptions?.map((d: any) => d.content || '') || []),
		]
		const text = parts.join(' ')
		if (text.trim()) {
			const label = exp.company || exp.role || 'Experience'
			sections.set(label, { text: text.toLowerCase(), tokens: extractKeywords(text) })
		}
	})

	// Education (all entries combined as one section)
	const eduText = resumeData.education
		?.map((e: any) => `${e.degree || ''} ${e.school || ''} ${e.description || ''}`)
		.join(' ') || ''
	if (eduText.trim()) {
		sections.set('Education', { text: eduText.toLowerCase(), tokens: extractKeywords(eduText) })
	}

	// Skills (all skills combined as one section)
	const skillsText = resumeData.skills?.map((s: any) => s.name || '').join(' ') || ''
	if (skillsText.trim()) {
		sections.set('Skills', { text: skillsText.toLowerCase(), tokens: extractKeywords(skillsText) })
	}

	return sections
}

/**
 * Match each keyword against individual resume sections.
 * Returns per-keyword match data with section names and frequency score.
 */
function matchKeywordsToSections(
	resumeData: ResumeData,
	extractedKeywords: string[],
): KeywordMatch[] {
	const sections = buildSectionMap(resumeData)

	return extractedKeywords.map(keyword => {
		const kwLower = keyword.toLowerCase()
		const matchedSections: string[] = []

		for (const [sectionName, { text, tokens }] of sections) {
			if (keywordExistsInText(kwLower, text, tokens)) {
				matchedSections.push(sectionName)
			}
		}

		const sectionCount = matchedSections.length
		let score: number
		let status: KeywordMatch['status']

		if (sectionCount === 0) {
			score = 0
			status = 'missing'
		} else if (sectionCount === 1) {
			score = 0.6
			status = 'partial'
		} else {
			score = 1.0
			status = 'full'
		}

		return { keyword, sections: matchedSections, sectionCount, score, status }
	})
}

/**
 * Calculate keyword match score (0-100)
 * Frequency-aware: rewards keywords appearing across multiple sections.
 * Includes spread bonus for keyword distribution.
 */
function calculateKeywordScore(
	resumeData: ResumeData,
	jobDescription: string,
	extractedKeywords?: string[] | null,
): { score: number; matches: KeywordMatch[] } {
	if (!jobDescription || !extractedKeywords || extractedKeywords.length === 0) {
		return { score: 50, matches: [] }
	}

	const matches = matchKeywordsToSections(resumeData, extractedKeywords)

	// Frequency-aware scoring
	const totalScore = matches.reduce((sum, m) => sum + m.score, 0)
	const maxPossible = extractedKeywords.length * 1.0
	const matchRatio = totalScore / maxPossible

	// Scoring curve (same thresholds as before)
	let baseScore: number
	if (matchRatio >= 0.8) {
		baseScore = 100
	} else if (matchRatio >= 0.6) {
		baseScore = 85 + ((matchRatio - 0.6) / 0.2) * 15
	} else if (matchRatio >= 0.4) {
		baseScore = 70 + ((matchRatio - 0.4) / 0.2) * 15
	} else {
		baseScore = matchRatio * 175
	}

	// Spread bonus: reward keyword distribution across sections
	const sectionMap = buildSectionMap(resumeData)
	const totalSections = sectionMap.size
	if (totalSections > 0) {
		const sectionsWithKeywords = new Set<string>()
		for (const m of matches) {
			for (const s of m.sections) {
				sectionsWithKeywords.add(s)
			}
		}
		const spreadRatio = sectionsWithKeywords.size / totalSections
		const spreadBonus = spreadRatio * 7 // 0-7 bonus points
		baseScore = Math.min(100, baseScore + spreadBonus)
	}

	return { score: Math.round(baseScore), matches }
}

/**
 * Calculate quantifiable metrics score (0-100)
 * Looks for numbers, percentages, metrics in experience bullets
 */
function calculateMetricsScore(resumeData: ResumeData): number {
	const bullets = resumeData.experiences?.flatMap((exp: any) =>
		exp.descriptions?.map((d: any) => d.content || '') || []
	) || []

	if (bullets.length === 0) return 0

	// Count bullets with numbers/percentages
	const numberPattern = /\d+[%$]?|\d+[kKmMbB]\+?/
	const bulletsWithMetrics = bullets.filter((b: any) => numberPattern.test(b)).length

	const ratio = bulletsWithMetrics / bullets.length

	// Scale to 0-100: 50% = 90 points, 70%+ = 100 points
	let score: number
	if (ratio >= 0.70) {
		score = 100
	} else if (ratio >= 0.50) {
		// Linear interpolation between 50% (90pts) and 70% (100pts)
		score = 90 + ((ratio - 0.50) / 0.20) * 10
	} else {
		// Below 50%, scale linearly to 90
		score = ratio * 180
	}

	return Math.round(score)
}

/**
 * Calculate action verbs score (0-100)
 * Checks if bullets start with strong action verbs
 */
function calculateActionVerbsScore(resumeData: ResumeData): number {
	const bullets = resumeData.experiences?.flatMap((exp: any) =>
		exp.descriptions?.map((d: any) => d.content || '') || []
	) || []

	if (bullets.length === 0) return 0

	// Count bullets starting with action verbs
	const bulletsWithActionVerbs = bullets.filter((b: any) => {
		return ACTION_VERBS.has(extractLeadingVerb(b))
	}).length

	const ratio = bulletsWithActionVerbs / bullets.length

	// Scale to 0-100: 70% = 90 points, 90%+ = 100 points
	let score: number
	if (ratio >= 0.90) {
		score = 100
	} else if (ratio >= 0.70) {
		// Linear interpolation between 70% (90pts) and 90% (100pts)
		score = 90 + ((ratio - 0.70) / 0.20) * 10
	} else {
		// Below 70%, scale linearly to 90
		score = ratio * 128.57
	}

	return Math.round(score)
}

/**
 * Calculate length appropriateness score (0-100)
 * Optimal resume has 3-5 experiences, 10-15 bullets, concise summary
 */
function calculateLengthScore(resumeData: ResumeData): number {
	let score = 0

	// Experience count (optimal: 3-5)
	const expCount = resumeData.experiences?.filter((exp: any) => exp.role && exp.company).length || 0
	if (expCount >= 3 && expCount <= 5) {
		score += 30
	} else if (expCount >= 2 && expCount <= 6) {
		score += 20
	} else if (expCount >= 1) {
		score += 10
	}

	// Bullet count (optimal: 10-20 total)
	const bulletCount = resumeData.experiences?.flatMap((exp: any) =>
		exp.descriptions?.filter((d: any) => d.content && d.content.trim().length > 0) || []
	).length || 0

	if (bulletCount >= 10 && bulletCount <= 20) {
		score += 30
	} else if (bulletCount >= 6 && bulletCount <= 25) {
		score += 20
	} else if (bulletCount >= 3) {
		score += 10
	}

	// Summary length (optimal: 100-250 chars)
	const summaryLength = resumeData.about?.trim().length || 0
	if (summaryLength >= 100 && summaryLength <= 250) {
		score += 20
	} else if (summaryLength >= 50 && summaryLength <= 350) {
		score += 15
	} else if (summaryLength > 0) {
		score += 5
	}

	// Skills count (optimal: 8-15)
	const skillCount = resumeData.skills?.filter((s: any) => s.name && s.name.trim().length > 0).length || 0
	if (skillCount >= 8 && skillCount <= 15) {
		score += 20
	} else if (skillCount >= 5 && skillCount <= 20) {
		score += 15
	} else if (skillCount >= 3) {
		score += 5
	}

	return score
}


/**
 * Identify bullets that lack quantified metrics
 */
function findBulletsWithoutMetrics(resumeData: ResumeData): FlaggedBullet[] {
	const numberPattern = /\d+[%$]?|\d+[kKmMbB]\+?/
	const flagged: FlaggedBullet[] = []

	resumeData.experiences?.forEach((exp: any) => {
		exp.descriptions?.forEach((d: any, bi: number) => {
			const content = d.content || ''
			if (content.trim().length > 0 && !numberPattern.test(content)) {
				flagged.push({
					experienceId: exp.id,
					bulletIndex: bi,
					content,
					reason: 'Add a number to this bullet — revenue, users, team size, time saved, or a percentage. Even ranges like "20-30%" work.',
				})
			}
		})
	})

	return flagged
}

/**
 * Identify bullets that don't start with a strong action verb
 */
function findBulletsWithoutActionVerbs(resumeData: ResumeData): FlaggedBullet[] {
	const flagged: FlaggedBullet[] = []

	resumeData.experiences?.forEach((exp: any) => {
		exp.descriptions?.forEach((d: any, bi: number) => {
			const content = d.content || ''
			if (content.trim().length > 0) {
				if (!ACTION_VERBS.has(extractLeadingVerb(content))) {
					flagged.push({
						experienceId: exp.id,
						bulletIndex: bi,
						content,
						reason: 'Lead with a strong verb — Shipped, Reduced, Drove, Launched — to grab attention in the first 2 seconds.',
					})
				}
			}
		})
	})

	return flagged
}

/**
 * Calculate overall resume score with weighted average
 */
export function calculateResumeScore(
	resumeData: ResumeData,
	jobDescription?: string,
	extractedKeywords?: string[] | null
): ScoreBreakdown {
	const { score: keyword, matches: keywordMatches } = calculateKeywordScore(
		resumeData, jobDescription || '', extractedKeywords,
	)
	const metrics = calculateMetricsScore(resumeData)
	const actionVerbs = calculateActionVerbsScore(resumeData)
	const length = calculateLengthScore(resumeData)

	// Weighted average
	const hasJob = jobDescription && jobDescription.trim().length > 0
	const overall = hasJob
		? Math.round(keyword * 0.50 + metrics * 0.20 + actionVerbs * 0.20 + length * 0.10)
		: Math.round(metrics * 0.40 + actionVerbs * 0.40 + length * 0.20)

	return {
		overall,
		keyword,
		metrics,
		actionVerbs,
		length,
		keywordMatches,
	}
}

/**
 * Generate improvement checklist based on score breakdown
 */
export function generateChecklist(
	resumeData: ResumeData,
	scores: ScoreBreakdown,
	jobDescription?: string,
	extractedKeywords?: string[] | null
): ChecklistItem[] {
	const checklist: ChecklistItem[] = []

	// Keyword optimization (if job selected)
	if (jobDescription && jobDescription.trim().length > 0) {
		if (!extractedKeywords || extractedKeywords.length === 0) {
			checklist.push({
				id: 'keywords-pending',
				text: 'Keywords are being extracted from job description...',
				completed: false,
				explanation: 'Please wait while AI analyzes the job description. This takes a few seconds.',
				priority: 'high',
			})
			return checklist
		}

		// Use pre-computed keyword matches from scoring
		const { keywordMatches } = scores
		const missing = keywordMatches.filter(m => m.status === 'missing')
		const partial = keywordMatches.filter(m => m.status === 'partial')

		// Categorize missing keywords
		const missingByCategory = {
			technical: [] as string[],
			experience: [] as string[],
			tools: [] as string[],
			domain: [] as string[],
			soft: [] as string[],
		}

		missing.forEach(({ keyword }) => {
			if (/\d+\+?\s*years?/i.test(keyword)) {
				missingByCategory.experience.push(keyword)
			} else if (
				/^[A-Z]{2,}$/.test(keyword) ||
				/API|SDK|CLI|UI|UX/i.test(keyword)
			) {
				missingByCategory.technical.push(keyword)
			} else if (
				/docker|kubernetes|jira|hubspot|salesforce|aws|azure|gcp/i.test(keyword)
			) {
				missingByCategory.tools.push(keyword)
			} else if (
				/leadership|communication|agile|remote|team|collaboration/i.test(keyword)
			) {
				missingByCategory.soft.push(keyword)
			} else {
				missingByCategory.domain.push(keyword)
			}
		})

		const totalMissing = missing.length
		const allMissingKeywords = missing.map(m => m.keyword)

		if (scores.keyword < 90 && totalMissing > 0) {
			let explanation =
				'Add these keywords from the job description to improve your ATS match:\n\n'

			if (missingByCategory.technical.length > 0) {
				explanation +=
					'**Technical Skills:**\n' +
					missingByCategory.technical.map(k => `  • ${k}`).join('\n') +
					'\n\n'
			}
			if (missingByCategory.tools.length > 0) {
				explanation +=
					'**Tools & Platforms:**\n' +
					missingByCategory.tools.map(k => `  • ${k}`).join('\n') +
					'\n\n'
			}
			if (missingByCategory.experience.length > 0) {
				explanation +=
					'**Experience Level:**\n' +
					missingByCategory.experience.map(k => `  • ${k}`).join('\n') +
					'\n\n'
			}
			if (missingByCategory.domain.length > 0) {
				explanation +=
					'**Domain Knowledge:**\n' +
					missingByCategory.domain.map(k => `  • ${k}`).join('\n') +
					'\n\n'
			}
			if (missingByCategory.soft.length > 0) {
				explanation +=
					'**Soft Skills:**\n' +
					missingByCategory.soft.map(k => `  • ${k}`).join('\n')
			}

			checklist.push({
				id: 'keywords-missing',
				text: `Add ${totalMissing} more relevant skill${totalMissing !== 1 ? 's' : ''} to catch ATS keywords that don't appear in your bullets`,
				completed: false,
				explanation: explanation.trim(),
				priority: scores.keyword < 70 ? 'high' : 'medium',
				missingKeywords: allMissingKeywords,
			})
		} else if (scores.keyword >= 90) {
			checklist.push({
				id: 'keywords-good',
				text: `Strong keyword match (${scores.keyword}/100)`,
				completed: true,
				explanation:
					'Your resume has excellent keyword alignment with the job description.',
				priority: 'high',
			})
		}

		// Keyword spread: suggest distributing partial-match keywords
		// Only suggest for broad/transferable keywords (found in Skills or Summary)
		// that would make sense woven into experience bullets — skip niche terms
		// that are only in a single experience section.
		if (partial.length > 0) {
			const experiencesWithContent = resumeData.experiences?.filter(
				(exp: any) => (exp.role || exp.company) && exp.descriptions?.some((d: any) => d.content?.trim())
			) || []

			const spreadCandidates = partial.filter(pm => {
				// Only suggest spreading keywords currently in Skills or Summary —
				// those are broad terms that belong across sections. If a keyword
				// only appears in one experience entry, it's probably role-specific.
				return pm.sections.some(s => s === 'Skills' || s === 'Summary')
			})

			const topPartials = spreadCandidates.slice(0, 3)
			for (const pm of topPartials) {
				const sectionName = pm.sections[0] || 'Skills'
				const targetExp = experiencesWithContent.find(
					(exp: any) => !pm.sections.includes(exp.company || exp.role || '')
				)
				const targetName = targetExp?.company || targetExp?.role || 'an experience entry'

				checklist.push({
					id: `keyword-spread-${pm.keyword}`,
					text: `You mention "${pm.keyword}" only in ${sectionName} — add it to a bullet under ${targetName} too. ATS tools score keywords higher when they appear across multiple sections.`,
					completed: false,
					explanation: `"${pm.keyword}" was found in ${sectionName} but not elsewhere. Keywords that appear in multiple sections (Skills + Experience bullets) score higher in ATS screening.`,
					priority: 'medium',
				})
			}
		}

		// Role-level skill detection: only check the most recent experience.
		// That's the role recruiters focus on — older roles don't need every JD keyword.
		const experiencesWithContent = resumeData.experiences?.filter(
			(exp: any) => (exp.role || exp.company) && exp.descriptions?.some((d: any) => d.content?.trim())
		) || []

		if (experiencesWithContent.length > 0) {
			const mostRecent = experiencesWithContent[0]
			const expLabel = mostRecent.company || mostRecent.role || 'Experience'
			const hasKeywordHit = keywordMatches.some(m =>
				m.sections.includes(expLabel)
			)
			if (!hasKeywordHit) {
				// Find 2-3 specific missing keywords to suggest, preferring technical/tool terms
				const missingFromRole = keywordMatches
					.filter(m => m.status === 'missing' || !m.sections.includes(expLabel))
					.map(m => m.keyword)

				// Prefer technical/tool keywords — they're easiest to add naturally
				const techFirst = missingFromRole.sort((a, b) => {
					const isTechA = /^[A-Z]{2,}$/.test(a) || /API|SDK|CLI|UI|UX/i.test(a) ||
						/docker|kubernetes|jira|salesforce|aws|azure|gcp|python|sql/i.test(a)
					const isTechB = /^[A-Z]{2,}$/.test(b) || /API|SDK|CLI|UI|UX/i.test(b) ||
						/docker|kubernetes|jira|salesforce|aws|azure|gcp|python|sql/i.test(b)
					if (isTechA && !isTechB) return -1
					if (!isTechA && isTechB) return 1
					return 0
				})

				const suggestedKws = techFirst.slice(0, 3)
				if (suggestedKws.length > 0) {
					const kwList = suggestedKws.join(', ')
					checklist.push({
						id: `role-skills-${mostRecent.id}`,
						text: `Your ${expLabel} role is missing key terms from this JD — try adding ${kwList} to your bullets or a skills line under this role.`,
						completed: false,
						explanation: `Your most recent experience at ${expLabel} doesn't mention these target keywords. Adding them to bullet points or a role-specific skills line helps ATS tools score your resume higher.`,
						priority: 'medium',
					})
				}
			}
		}

		// Bullet ordering: check if strongest bullet is first
		for (const exp of experiencesWithContent) {
			const bullets = exp.descriptions?.filter((d: any) => d.content?.trim()) || []
			if (bullets.length < 2) continue

			// Count keyword matches per bullet
			let maxCount = 0
			let maxIndex = 0
			bullets.forEach((d: any, idx: number) => {
				const bulletText = (d.content || '').toLowerCase()
				const bulletTokens = extractKeywords(d.content || '')
				let count = 0
				for (const kw of (extractedKeywords || [])) {
					if (keywordExistsInText(kw.toLowerCase(), bulletText, bulletTokens)) {
						count++
					}
				}
				if (count > maxCount) {
					maxCount = count
					maxIndex = idx
				}
			})

			// Only suggest if there's a clearly strongest bullet not in first position
			if (maxCount > 0 && maxIndex !== 0) {
				const expLabel = exp.company || exp.role || 'Experience'
				checklist.push({
					id: `bullet-order-${exp.id}`,
					text: `Move your strongest bullet to the top of ${expLabel} — recruiters often only read the first 2.`,
					completed: false,
					explanation: `Your bullet #${maxIndex + 1} at ${expLabel} has the most keyword matches (${maxCount}). Moving it to the top position increases visibility.`,
					priority: 'low',
				})
			}
		}
	}

	// Quantifiable metrics (based on percentage, not absolute count)
	const bulletCount = resumeData.experiences?.flatMap((exp: any) => exp.descriptions || []).length || 0
	const bulletsWithoutMetrics = findBulletsWithoutMetrics(resumeData)

	if (bulletCount === 0) {
		// No bullets yet
		checklist.push({
			id: 'metrics',
			text: 'Add experience bullets with quantifiable metrics',
			completed: false,
			explanation: 'Start by adding work experience with measurable achievements (numbers, %, $).',
			priority: 'high',
		})
	} else {
		const bulletsWithMetrics = Math.round((scores.metrics / 100) * bulletCount)
		const currentPercent = Math.round((bulletsWithMetrics / bulletCount) * 100)
		const targetForPerfect = Math.ceil(bulletCount * 0.70) // 70% for perfect score
		const metricsNeededForPerfect = Math.max(0, targetForPerfect - bulletsWithMetrics)

		if (bulletsWithMetrics >= 3 && currentPercent >= 30) {
			const improvementText = metricsNeededForPerfect > 0
				? ` Adding numbers to ${metricsNeededForPerfect} more will boost your score to 100.`
				: ' You have excellent metric coverage!'

			checklist.push({
				id: 'metrics-good',
				text: `${bulletsWithMetrics} of ${bulletCount} bullets have metrics (${currentPercent}%)`,
				completed: true,
				explanation: `Good! You have quantifiable achievements in your resume.${improvementText}`,
				priority: 'high',
				flaggedBullets: bulletsWithoutMetrics,
			})
		} else {
			const targetBasic = Math.max(3, Math.ceil(bulletCount * 0.30))
			const metricsNeeded = targetBasic - bulletsWithMetrics

			if (metricsNeeded <= 0) {
				checklist.push({
					id: 'metrics-good',
					text: `${bulletsWithMetrics} of ${bulletCount} bullets have metrics (${currentPercent}%)`,
					completed: true,
					explanation: `Good! Adding numbers to ${metricsNeededForPerfect} more bullets will boost your score from ${scores.metrics} to 100.`,
					priority: 'high',
					flaggedBullets: bulletsWithoutMetrics,
				})
			} else {
				checklist.push({
					id: 'metrics',
					text: `Add a number to ${metricsNeeded} more bullet${metricsNeeded !== 1 ? 's' : ''} — revenue, users, team size, time saved, or a percentage`,
					completed: false,
					explanation: `Currently ${currentPercent}% of your bullets have metrics (target 30%+). Even ranges like "20-30%" work. Numbers make achievements concrete and 40% more likely to get interviews.`,
					priority: 'high',
					flaggedBullets: bulletsWithoutMetrics,
				})
			}
		}
	}

	// Action verbs (based on percentage)
	const bulletsWithoutActionVerbs = bulletCount > 0 ? findBulletsWithoutActionVerbs(resumeData) : []

	if (bulletCount > 0) {
		const bulletsWithActionVerbs = Math.round((scores.actionVerbs / 100) * bulletCount)
		const currentPercent = Math.round((bulletsWithActionVerbs / bulletCount) * 100)
		const targetForPerfect = Math.ceil(bulletCount * 0.90) // 90% for perfect score
		const actionVerbsNeededForPerfect = Math.max(0, targetForPerfect - bulletsWithActionVerbs)

		if (currentPercent >= 50) {
			const improvementText = actionVerbsNeededForPerfect > 0
				? ` Leading ${actionVerbsNeededForPerfect} more with strong verbs will boost your score to 100.`
				: ' You have excellent action verb usage!'

			checklist.push({
				id: 'action-verbs-good',
				text: `${bulletsWithActionVerbs} of ${bulletCount} bullets use action verbs (${currentPercent}%)`,
				completed: true,
				explanation: `Good! Most of your bullets start with strong action verbs.${improvementText}`,
				priority: 'medium',
				flaggedBullets: bulletsWithoutActionVerbs,
			})
		} else {
			const targetBasic = Math.ceil(bulletCount * 0.50)
			const actionVerbsNeeded = targetBasic - bulletsWithActionVerbs

			if (actionVerbsNeeded <= 0) {
				checklist.push({
					id: 'action-verbs-good',
					text: `${bulletsWithActionVerbs} of ${bulletCount} bullets use action verbs (${currentPercent}%)`,
					completed: true,
					explanation: `Good! Leading ${actionVerbsNeededForPerfect} more bullets with strong verbs will boost your score from ${scores.actionVerbs} to 100.`,
					priority: 'medium',
					flaggedBullets: bulletsWithoutActionVerbs,
				})
			} else {
				checklist.push({
					id: 'action-verbs',
					text: `Lead with a strong verb on ${actionVerbsNeeded} more bullet${actionVerbsNeeded !== 1 ? 's' : ''} — Shipped, Reduced, Drove, Launched — to grab attention in the first 2 seconds`,
					completed: false,
					explanation: `Currently ${currentPercent}% of your bullets start with action verbs (target 50%+). Avoid weak starts like "responsible for" or "helped with."`,
					priority: 'medium',
					flaggedBullets: bulletsWithoutActionVerbs,
				})
			}
		}
	}

	// Content length optimization
	if (scores.length < 60) {
		if (bulletCount < 10) {
			checklist.push({
				id: 'content-length',
				text: `Add ${10 - bulletCount} more experience bullet points`,
				completed: false,
				explanation: 'Aim for 10-20 total bullets across all experiences to properly showcase your qualifications.',
				priority: 'medium',
			})
		} else if (bulletCount > 25) {
			checklist.push({
				id: 'content-length',
				text: `Reduce to 20 bullet points (currently ${bulletCount})`,
				completed: false,
				explanation: 'Resumes with 10-20 bullets are easier to scan. Remove less relevant bullets.',
				priority: 'low',
			})
		}
	}

	// Summary section
	const summaryLength = resumeData.about?.trim().length || 0
	if (summaryLength < 100) {
		checklist.push({
			id: 'summary',
			text: 'Add a summary — your 10-second pitch to hiring managers. 2-3 sentences on why you\'re the one.',
			completed: false,
			explanation: 'A strong summary (100-250 characters) helps recruiters quickly understand your value proposition. Focus on your top skills and what you bring to this specific role.',
			priority: 'medium',
		})
	} else if (summaryLength > 350) {
		checklist.push({
			id: 'summary',
			text: 'Shorten summary to under 250 characters',
			completed: false,
			explanation: 'Keep your summary concise - recruiters spend 7 seconds on initial review.',
			priority: 'low',
		})
	}


	// Sort by priority (high -> medium -> low), then by completion
	return checklist.sort((a, b) => {
		const priorityOrder = { high: 0, medium: 1, low: 2 }
		if (a.priority !== b.priority) {
			return priorityOrder[a.priority] - priorityOrder[b.priority]
		}
		return a.completed === b.completed ? 0 : a.completed ? 1 : -1
	})
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): string {
	if (score >= 90) return 'text-green-600'
	if (score >= 70) return 'text-yellow-600'
	return 'text-red-600'
}

/**
 * Get score background color
 */
export function getScoreBgColor(score: number): string {
	if (score >= 90) return 'bg-green-100'
	if (score >= 70) return 'bg-yellow-100'
	return 'bg-red-100'
}

/**
 * Get score ring color for progress circle
 */
export function getScoreRingColor(score: number): string {
	if (score >= 90) return 'stroke-green-600'
	if (score >= 70) return 'stroke-yellow-600'
	return 'stroke-red-600'
}
