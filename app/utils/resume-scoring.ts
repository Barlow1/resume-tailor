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

export interface ChecklistItem {
	id: string
	text: string
	completed: boolean
	explanation: string
	priority: 'high' | 'medium' | 'low'
}

/**
 * Extract keywords from text (simple tokenization)
 */
function extractKeywords(text: string): Set<string> {
	if (!text) return new Set()

	return new Set(
		text
			.toLowerCase()
			.replace(/[^a-z0-9+#.\-\s]/g, ' ') // Keep +, #, ., -
			.split(/\s+/)
			.filter(word => word.length > 2 && !STOP_WORDS.has(word))
	)
}

/**
 * Calculate keyword match score (0-100)
 * Measures overlap between resume and job description
 */
function calculateKeywordScore(
	resumeData: ResumeData,
	jobDescription: string,
	extractedKeywords?: string[] | null
): number {
	if (!jobDescription || jobDescription.trim().length === 0) {
		return 50 // Neutral score when no job selected
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

	const resumeKeywords = extractKeywords(resumeText)

	// ONLY use AI-extracted keywords, no fallback
	if (!extractedKeywords || extractedKeywords.length === 0) {
		console.warn('[Resume Scoring] No extracted keywords available for job, returning neutral score')
		return 50 // Return neutral score if no keywords extracted yet
	}

	// Keep original casing from AI, but do case-insensitive matching
	const jdKeywordsLower = new Set(extractedKeywords.map(k => k.toLowerCase()))

	if (jdKeywordsLower.size === 0) return 50

	// Calculate Jaccard similarity (case-insensitive)
	const intersection = new Set([...resumeKeywords].filter(k => jdKeywordsLower.has(k)))
	const matchRatio = intersection.size / jdKeywordsLower.size

	// Scale to 0-100: 60% match = 90 points, 85%+ match = 100 points
	// Using piecewise linear scaling
	let score: number
	if (matchRatio >= 0.85) {
		score = 100
	} else if (matchRatio >= 0.60) {
		// Linear interpolation between 60% (90pts) and 85% (100pts)
		score = 90 + ((matchRatio - 0.60) / 0.25) * 10
	} else {
		// Below 60%, scale linearly to 90
		score = matchRatio * 150
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

		// Find missing keywords (case-insensitive match, but display with original casing)
		const missingKeywords = extractedKeywords.filter(keyword =>
			!resumeKeywords.has(keyword.toLowerCase())
		)

		if (scores.keyword < 90) {
			const summaryText = `Add ${missingKeywords.length} missing keyword${missingKeywords.length !== 1 ? 's' : ''}`

			// Format all keywords as a nice grid/list
			const keywordsList = missingKeywords
				.map(k => `  • ${k}`)
				.join('\n')

			checklist.push({
				id: 'keywords-missing',
				text: summaryText,
				completed: false,
				explanation: `Add these keywords from the job description to improve your ATS match score:\n\n${keywordsList}`,
				priority: 'high',
			})
		} else {
			checklist.push({
				id: 'keywords-good',
				text: `Strong keyword match (${scores.keyword}/100)`,
				completed: true,
				explanation: 'Your resume has excellent keyword alignment with the job description.',
				priority: 'high',
			})
		}
	}

	// Quantifiable metrics (based on percentage, not absolute count)
	const bulletCount = resumeData.experiences?.flatMap((exp: any) => exp.descriptions || []).length || 0

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
				})
			} else {
				checklist.push({
					id: 'metrics',
					text: `Add metrics to ${metricsNeeded} more bullet${metricsNeeded !== 1 ? 's' : ''} (currently ${currentPercent}%, target 30%+)`,
					completed: false,
					explanation: 'Quantified achievements are 40% more likely to get interviews. Add numbers, percentages, or dollar amounts to show impact (e.g., "increased revenue by 25%" or "managed team of 10").',
					priority: 'high',
				})
			}
		}
	}

	// Action verbs (based on percentage)
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
				})
			} else {
				checklist.push({
					id: 'action-verbs',
					text: `Start ${actionVerbsNeeded} more bullet${actionVerbsNeeded !== 1 ? 's' : ''} with action verbs (currently ${currentPercent}%, target 50%+)`,
					completed: false,
					explanation: 'Action verbs (like "built", "led", "increased") make accomplishments more impactful. Avoid weak starts like "responsible for" or "helped with".',
					priority: 'medium',
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


	// Skills section
	const skillCount = resumeData.skills?.filter((s: any) => s.name && s.name.trim().length > 0).length || 0
	if (skillCount < 8) {
		checklist.push({
			id: 'skills',
			text: `Add ${8 - skillCount} more relevant skills`,
			completed: false,
			explanation: 'Include 8-15 skills to improve keyword matching and show breadth of expertise.',
			priority: 'medium',
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
