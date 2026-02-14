/**
 * Client-side Resume Scoring Engine
 *
 * Provides instant feedback on resume quality with 5 scoring dimensions:
 * 1. Keyword Match (0-100): How well resume matches job description keywords
 * 2. Quantifiable Metrics (0-100): Presence of numbers, percentages, metrics
 * 3. Action Verbs (0-100): Strong action verbs at start of bullets
 * 4. Length Appropriateness (0-100): Optimal content density
 * 5. Formatting Quality (0-100): Completeness of sections
 *
 * Overall score is weighted average with keyword match having highest weight.
 */

import type { ResumeData } from './builder-resume.server.ts'

// Common action verbs for resume bullets
const ACTION_VERBS = new Set([
	'achieved', 'accelerated', 'accomplished', 'acquired', 'analyzed', 'architected',
	'built', 'created', 'collaborated', 'conducted', 'developed', 'designed',
	'delivered', 'drove', 'enabled', 'engineered', 'enhanced', 'established',
	'executed', 'expanded', 'generated', 'grew', 'implemented', 'improved',
	'increased', 'initiated', 'launched', 'led', 'managed', 'optimized',
	'organized', 'orchestrated', 'pioneered', 'produced', 'reduced', 'resolved',
	'scaled', 'spearheaded', 'streamlined', 'transformed', 'upgraded',
])

// Stop words to ignore when extracting keywords
const STOP_WORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
	'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
	'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
	'might', 'can', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you',
	'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why',
	'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'such',
])

export interface ScoreBreakdown {
	overall: number
	keyword: number
	metrics: number
	actionVerbs: number
	length: number
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
 * Calculate keyword match score (0-100)
 * Measures overlap between resume and job description using hybrid matching
 */
function calculateKeywordScore(
	resumeData: ResumeData,
	jobDescription: string,
	extractedKeywords?: string[] | null,
): number {
	if (!jobDescription || !extractedKeywords || extractedKeywords.length === 0) {
		return 50 // Neutral score when no job selected or no keywords
	}

	// Extract resume text
	const resumeText = [
		resumeData.about || '',
		resumeData.role || '',
		...(resumeData.experiences?.flatMap((exp: any) => [
			exp.role || '',
			exp.company || '',
			...(exp.descriptions?.map((d: any) => d.content || '') || []),
		]) || []),
		...(resumeData.skills?.map((s: any) => s.name || '') || []),
		...(resumeData.education?.map((e: any) => `${e.degree} ${e.school}`) || []),
	].join(' ')

	const resumeLower = resumeText.toLowerCase()
	const resumeKeywords = extractKeywords(resumeText)

	// Match keywords with hybrid approach
	let matchCount = 0

	extractedKeywords.forEach(keyword => {
		const kwLower = keyword.toLowerCase()

		// Strategy 1: Exact phrase match (for multi-word keywords)
		if (kwLower.includes(' ')) {
			if (resumeLower.includes(kwLower)) {
				matchCount++
			}
		}
		// Strategy 2: Token-based match (for single words)
		else {
			if (resumeKeywords.has(kwLower)) {
				matchCount++
			}
		}
	})

	const matchRatio = matchCount / extractedKeywords.length

	// Scoring with adjusted thresholds (more forgiving)
	let score: number
	if (matchRatio >= 0.8) {
		score = 100 // 80%+ match = excellent
	} else if (matchRatio >= 0.6) {
		score = 85 + ((matchRatio - 0.6) / 0.2) * 15 // 60-80% = 85-100
	} else if (matchRatio >= 0.4) {
		score = 70 + ((matchRatio - 0.4) / 0.2) * 15 // 40-60% = 70-85
	} else {
		score = matchRatio * 175 // Below 40% = 0-70
	}

	return Math.round(score)
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
		const firstWord = b.trim().toLowerCase().split(/\s+/)[0]
		return ACTION_VERBS.has(firstWord)
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
					reason: 'No quantified metrics — add numbers, percentages, or dollar amounts to show impact',
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
				const firstWord = content.trim().toLowerCase().split(/\s+/)[0]
				if (!ACTION_VERBS.has(firstWord)) {
					flagged.push({
						experienceId: exp.id,
						bulletIndex: bi,
						content,
						reason: `Starts with "${firstWord}" — use a strong action verb like Led, Built, Increased, or Delivered`,
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
	const keyword = calculateKeywordScore(resumeData, jobDescription || '', extractedKeywords)
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
		// Extract keywords to find what's missing
		const resumeText = [
			resumeData.about || '',
			resumeData.role || '',
			...(resumeData.experiences?.flatMap((exp: any) => [
				exp.role || '',
				exp.company || '',
				...(exp.descriptions?.map((d: any) => d.content || '') || []),
			]) || []),
			...(resumeData.skills?.map((s: any) => s.name || '') || []),
			...(resumeData.education?.map((e: any) => `${e.degree} ${e.school}`) || []),
		].join(' ')

		const resumeKeywords = extractKeywords(resumeText)

		// ONLY use AI-extracted keywords
		if (!extractedKeywords || extractedKeywords.length === 0) {
			// No keywords extracted yet, show a helpful message
			checklist.push({
				id: 'keywords-pending',
				text: 'Keywords are being extracted from job description...',
				completed: false,
				explanation: 'Please wait while AI analyzes the job description. This takes a few seconds.',
				priority: 'high',
			})
			return checklist
		}

		// Find missing keywords with categorization (hybrid matching)
		const resumeLower = resumeText.toLowerCase()
		const missingByCategory = {
			technical: [] as string[],
			experience: [] as string[],
			tools: [] as string[],
			domain: [] as string[],
			soft: [] as string[],
		}

		extractedKeywords.forEach(keyword => {
			const kwLower = keyword.toLowerCase()

			// Check if keyword is present (hybrid matching)
			let isPresent = false
			if (kwLower.includes(' ')) {
				// Multi-word: exact phrase match
				isPresent = resumeLower.includes(kwLower)
			} else {
				// Single word: token match
				isPresent = resumeKeywords.has(kwLower)
			}

			if (!isPresent) {
				// Categorize missing keyword
				if (/\d+\+?\s*years?/i.test(keyword)) {
					missingByCategory.experience.push(keyword)
				} else if (
					/^[A-Z]{2,}$/.test(keyword) ||
					/API|SDK|CLI|UI|UX/i.test(keyword)
				) {
					missingByCategory.technical.push(keyword)
				} else if (
					/docker|kubernetes|jira|hubspot|salesforce|aws|azure|gcp/i.test(
						keyword,
					)
				) {
					missingByCategory.tools.push(keyword)
				} else if (
					/leadership|communication|agile|remote|team|collaboration/i.test(
						keyword,
					)
				) {
					missingByCategory.soft.push(keyword)
				} else {
					missingByCategory.domain.push(keyword)
				}
			}
		})

		const totalMissing = Object.values(missingByCategory).flat().length

		const allMissingKeywords = Object.values(missingByCategory).flat()

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
				text: `Add ${totalMissing} missing keyword${totalMissing !== 1 ? 's' : ''}`,
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
			// Have at least 3 bullets with metrics and 30%+ - show as complete but encourage more
			const improvementText = metricsNeededForPerfect > 0
				? ` Adding ${metricsNeededForPerfect} more will boost your score to 100.`
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
			// Need more metrics to show basic competency
			const targetBasic = Math.max(3, Math.ceil(bulletCount * 0.30))
			const metricsNeeded = targetBasic - bulletsWithMetrics

			if (metricsNeeded <= 0) {
				// Edge case: they technically meet the threshold
				checklist.push({
					id: 'metrics-good',
					text: `${bulletsWithMetrics} of ${bulletCount} bullets have metrics (${currentPercent}%)`,
					completed: true,
					explanation: `Good! Adding metrics to ${metricsNeededForPerfect} more bullets will boost your score from ${scores.metrics} to 100.`,
					priority: 'high',
					flaggedBullets: bulletsWithoutMetrics,
				})
			} else {
				checklist.push({
					id: 'metrics',
					text: `Add metrics to ${metricsNeeded} more bullet${metricsNeeded !== 1 ? 's' : ''} (currently ${currentPercent}%, target 30%+)`,
					completed: false,
					explanation: 'Quantified achievements are 40% more likely to get interviews. Add numbers, percentages, or dollar amounts to show impact (e.g., "increased revenue by 25%" or "managed team of 10").',
					priority: 'high',
					flaggedBullets: bulletsWithoutMetrics,
				})
			}
		}
	}

	// Action verbs (based on percentage)
	const bulletsWithoutActionVerbs = bulletCount > 0 ? findBulletsWithoutActionVerbs(resumeData) : []

	if (bulletCount === 0) {
		// No bullets yet - already covered in metrics section
	} else {
		const bulletsWithActionVerbs = Math.round((scores.actionVerbs / 100) * bulletCount)
		const currentPercent = Math.round((bulletsWithActionVerbs / bulletCount) * 100)
		const targetForPerfect = Math.ceil(bulletCount * 0.90) // 90% for perfect score
		const actionVerbsNeededForPerfect = Math.max(0, targetForPerfect - bulletsWithActionVerbs)

		if (currentPercent >= 50) {
			// Have 50%+ with action verbs - show as complete but encourage more
			const improvementText = actionVerbsNeededForPerfect > 0
				? ` Starting ${actionVerbsNeededForPerfect} more with action verbs will boost your score to 100.`
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
				// Edge case: they technically meet the threshold
				checklist.push({
					id: 'action-verbs-good',
					text: `${bulletsWithActionVerbs} of ${bulletCount} bullets use action verbs (${currentPercent}%)`,
					completed: true,
					explanation: `Good! Starting ${actionVerbsNeededForPerfect} more bullets with action verbs will boost your score from ${scores.actionVerbs} to 100.`,
					priority: 'medium',
					flaggedBullets: bulletsWithoutActionVerbs,
				})
			} else {
				checklist.push({
					id: 'action-verbs',
					text: `Start ${actionVerbsNeeded} more bullet${actionVerbsNeeded !== 1 ? 's' : ''} with action verbs (currently ${currentPercent}%, target 50%+)`,
					completed: false,
					explanation: 'Action verbs (like "built", "led", "increased") make accomplishments more impactful. Avoid weak starts like "responsible for" or "helped with".',
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
			text: 'Write a compelling summary (100-250 characters)',
			completed: false,
			explanation: 'A strong summary helps recruiters quickly understand your value proposition.',
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
