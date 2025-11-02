/**
 * Utilities for detecting and displaying changes after resume tailoring
 */

import type { ResumeData } from './builder-resume.server.ts'

export interface TailorChange {
	type: 'added' | 'modified' | 'removed'
	field: string
	before?: string
	after?: string
	location: string // e.g., "Experience: Senior Engineer at Google, Bullet #2"
}

export interface DiffSummary {
	addedKeywords: string[]
	modifiedBullets: Array<{
		location: string
		before: string
		after: string
	}>
	removedBullets: Array<{
		location: string
		content: string
	}>
	addedBullets: Array<{
		location: string
		content: string
	}>
	changedFields: string[]
	totalChanges: number
}

/**
 * Detect all changes between two resume versions
 */
export function detectChanges(
	before: ResumeData,
	after: ResumeData,
): TailorChange[] {
	const changes: TailorChange[] = []

	// Check basic fields
	const basicFields: Array<keyof ResumeData> = [
		'role',
		'about',
		'name',
		'email',
		'phone',
		'location',
		'website',
	]

	basicFields.forEach(field => {
		const beforeValue = before[field]
		const afterValue = after[field]

		if (beforeValue !== afterValue) {
			changes.push({
				type: beforeValue && afterValue ? 'modified' : afterValue ? 'added' : 'removed',
				field: String(field),
				before: beforeValue?.toString(),
				after: afterValue?.toString(),
				location: `Header: ${String(field)}`,
			})
		}
	})

	// Check experiences
	if (before.experiences && after.experiences) {
		// Match experiences by role and company
		before.experiences.forEach((beforeExp: any, index: number) => {
			const matchingAfterExp = after.experiences?.find(
				(exp: any) => exp.role === beforeExp.role && exp.company === beforeExp.company,
			)

			if (!matchingAfterExp) return

			const location = `Experience: ${beforeExp.role || 'Untitled'} at ${beforeExp.company || 'Unknown Company'}`

			// Check each description
			beforeExp.descriptions?.forEach((beforeDesc: any, descIndex: number) => {
				const afterDesc = matchingAfterExp.descriptions?.[descIndex]

				if (!afterDesc) {
					changes.push({
						type: 'removed',
						field: 'description',
						before: beforeDesc.content || '',
						location: `${location}, Bullet #${descIndex + 1}`,
					})
				} else if (beforeDesc.content !== afterDesc.content) {
					changes.push({
						type: 'modified',
						field: 'description',
						before: beforeDesc.content || '',
						after: afterDesc.content || '',
						location: `${location}, Bullet #${descIndex + 1}`,
					})
				}
			})

			// Check for added descriptions
			matchingAfterExp.descriptions?.forEach((afterDesc: any, descIndex: number) => {
				const beforeDesc = beforeExp.descriptions?.[descIndex]

				if (!beforeDesc) {
					changes.push({
						type: 'added',
						field: 'description',
						after: afterDesc.content || '',
						location: `${location}, Bullet #${descIndex + 1}`,
					})
				}
			})
		})
	}

	return changes
}

/**
 * Find new keywords added after tailoring
 */
export function findNewKeywords(
	before: ResumeData,
	after: ResumeData,
	jobKeywords?: string[],
): string[] {
	const beforeText = extractAllText(before).toLowerCase()
	const afterText = extractAllText(after).toLowerCase()

	const newKeywords: string[] = []

	if (jobKeywords) {
		jobKeywords.forEach(keyword => {
			const keywordLower = keyword.toLowerCase()
			const beforeCount = countOccurrences(beforeText, keywordLower)
			const afterCount = countOccurrences(afterText, keywordLower)

			if (afterCount > beforeCount) {
				newKeywords.push(keyword)
			}
		})
	}

	return newKeywords
}

/**
 * Extract all text from a resume for keyword analysis
 */
function extractAllText(resume: ResumeData): string {
	const parts: string[] = []

	if (resume.role) parts.push(resume.role)
	if (resume.about) parts.push(resume.about)

	resume.experiences?.forEach((exp: any) => {
		if (exp.role) parts.push(exp.role)
		if (exp.company) parts.push(exp.company)
		exp.descriptions?.forEach((desc: any) => {
			if (desc.content) parts.push(desc.content)
		})
	})

	resume.skills?.forEach((skill: any) => {
		if (skill.name) parts.push(skill.name)
	})

	return parts.join(' ')
}

/**
 * Count occurrences of a substring
 */
function countOccurrences(text: string, search: string): number {
	const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
	return (text.match(regex) || []).length
}

/**
 * Create a summary of changes for display
 */
export function createDiffSummary(
	before: ResumeData,
	after: ResumeData,
	jobKeywords?: string[],
): DiffSummary {
	const changes = detectChanges(before, after)

	const modifiedBullets = changes
		.filter(c => c.type === 'modified' && c.field === 'description')
		.map(c => ({
			location: c.location,
			before: c.before || '',
			after: c.after || '',
		}))

	const addedBullets = changes
		.filter(c => c.type === 'added' && c.field === 'description')
		.map(c => ({
			location: c.location,
			content: c.after || '',
		}))

	const removedBullets = changes
		.filter(c => c.type === 'removed' && c.field === 'description')
		.map(c => ({
			location: c.location,
			content: c.before || '',
		}))

	const addedKeywords = findNewKeywords(before, after, jobKeywords)

	const changedFields = Array.from(
		new Set(changes.map(c => c.field)),
	)

	return {
		addedKeywords,
		modifiedBullets,
		removedBullets,
		addedBullets,
		changedFields,
		totalChanges: changes.length,
	}
}

/**
 * Extract keywords from job description
 */
export function extractJobKeywords(jobDescription: string): string[] {
	// Simple keyword extraction - split by common delimiters and filter
	const commonWords = new Set([
		'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
		'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
		'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
		'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
		'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
	])

	const words = jobDescription
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter(word => word.length > 3 && !commonWords.has(word))

	// Return unique words, sorted by frequency
	const frequency = new Map<string, number>()
	words.forEach(word => {
		frequency.set(word, (frequency.get(word) || 0) + 1)
	})

	return Array.from(frequency.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([word]) => word)
		.slice(0, 20) // Top 20 keywords
}
