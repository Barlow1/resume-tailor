/**
 * Utilities for applying tailor suggestions to resumes
 */

import type { ResumeData } from './builder-resume.server.ts'
import type {
	AcceptedChange,
	EnhancedBullet,
	SuggestedBullet,
	TailorSuggestions,
	RawTailorResponse,
} from './tailor-types.ts'

/**
 * Parse experience index from section string
 * "experiences[0]" -> 0
 * "experiences[2]" -> 2
 */
export function parseExperienceIndex(section: string): number | null {
	const match = section.match(/experiences\[(\d+)\]/)
	return match ? parseInt(match[1], 10) : null
}

/**
 * Find bullet index by matching original text content
 * Returns -1 if not found
 */
export function findBulletIndex(
	resume: ResumeData,
	experienceIndex: number,
	originalText: string,
): number {
	const exp = resume.experiences?.[experienceIndex]
	if (!exp?.descriptions) return -1

	// Normalize text for comparison (trim, lowercase)
	const normalizedOriginal = originalText.trim().toLowerCase()

	return exp.descriptions.findIndex(
		(desc: any) =>
			desc.content?.trim().toLowerCase() === normalizedOriginal,
	)
}

/**
 * Process raw AI response into structured suggestions with IDs and indices
 */
export function processRawSuggestions(
	raw: RawTailorResponse,
	resume: ResumeData,
): TailorSuggestions {
	const enhanced_bullets: EnhancedBullet[] = raw.enhanced_bullets.map(
		(b, i) => {
			const experienceIndex = parseExperienceIndex(b.section) ?? 0
			const bulletIndex = findBulletIndex(resume, experienceIndex, b.original)

			return {
				id: `enhanced-${i}`,
				section: b.section,
				experienceIndex,
				bulletIndex,
				original: b.original,
				enhanced: b.enhanced,
				changes: b.changes,
				added_keywords: b.added_keywords,
			}
		},
	)

	const suggested_bullets: SuggestedBullet[] = raw.suggested_bullets.map(
		(b, i) => {
			const experienceIndex = parseExperienceIndex(b.section) ?? 0

			return {
				id: `suggested-${i}`,
				section: b.section,
				experienceIndex,
				bullet: b.bullet,
				evidence: b.evidence,
				confidence: b.confidence,
				placeholders: b.placeholders,
			}
		},
	)

	return {
		enhanced_bullets,
		suggested_bullets,
		gaps: raw.gaps || [],
		enhanced_summary: raw.enhanced_summary,
	}
}

/**
 * Derive preview resume by applying ALL suggestions to original
 * Used to show what the resume will look like if user accepts everything
 */
export function derivePreview(
	original: ResumeData,
	suggestions: TailorSuggestions,
): ResumeData {
	const preview = structuredClone(original) as ResumeData

	// Apply enhanced bullets (replacements)
	for (const bullet of suggestions.enhanced_bullets) {
		if (bullet.bulletIndex === -1) continue // Couldn't find original

		const exp = preview.experiences?.[bullet.experienceIndex]
		if (!exp?.descriptions?.[bullet.bulletIndex]) continue

		exp.descriptions[bullet.bulletIndex].content = bullet.enhanced
	}

	// Apply enhanced summary if present
	if (suggestions.enhanced_summary) {
		preview.about = suggestions.enhanced_summary.enhanced
	}

	// Note: suggested_bullets are NOT applied to preview
	// They require user to fill XX placeholders first

	return preview
}

/**
 * Apply accepted changes to original resume
 *
 * Logic:
 * 1. Start with clone of original
 * 2. For each accepted enhanced_bullet:
 *    - Find experience by experienceIndex
 *    - Replace description at bulletIndex with finalText
 * 3. For each accepted suggested_bullet:
 *    - Find experience by experienceIndex
 *    - Append new description with finalText
 * 4. For enhanced_summary:
 *    - Replace about field with finalText
 * 5. Return modified resume
 */
export function applyChangesToResume(
	original: ResumeData,
	acceptedChanges: AcceptedChange[],
): ResumeData {
	const result = structuredClone(original) as ResumeData

	// Group changes by type for ordered processing
	const enhancedBullets = acceptedChanges.filter(
		(c) => c.type === 'enhanced_bullet',
	)
	const suggestedBullets = acceptedChanges.filter(
		(c) => c.type === 'suggested_bullet',
	)
	const summaryChange = acceptedChanges.find(
		(c) => c.type === 'enhanced_summary',
	)

	// 1. Apply enhanced bullets (replacements)
	for (const change of enhancedBullets) {
		const exp = result.experiences?.[change.experienceIndex]
		if (!exp?.descriptions) continue

		if (
			change.bulletIndex !== undefined &&
			exp.descriptions[change.bulletIndex]
		) {
			exp.descriptions[change.bulletIndex].content = change.finalText
		}
	}

	// 2. Apply suggested bullets (additions)
	// Group by experience to add in order
	const suggestionsByExp = new Map<number, AcceptedChange[]>()
	for (const change of suggestedBullets) {
		if (!suggestionsByExp.has(change.experienceIndex)) {
			suggestionsByExp.set(change.experienceIndex, [])
		}
		suggestionsByExp.get(change.experienceIndex)!.push(change)
	}

	for (const [expIndex, changes] of suggestionsByExp) {
		const exp = result.experiences?.[expIndex]
		if (!exp) continue

		if (!exp.descriptions) {
			exp.descriptions = []
		}

		// Add new bullets at end of experience
		for (const change of changes) {
			exp.descriptions.push({
				id: crypto.randomUUID(),
				content: change.finalText,
			})
		}
	}

	// 3. Apply summary change
	if (summaryChange) {
		result.about = summaryChange.finalText
	}

	return result
}

/**
 * Build AcceptedChange from a suggestion and user's edits
 */
export function buildAcceptedChange(
	suggestion: EnhancedBullet | SuggestedBullet,
	type: 'enhanced_bullet' | 'suggested_bullet',
	editedText?: string,
): AcceptedChange {
	const isEnhanced = type === 'enhanced_bullet'
	const defaultText = isEnhanced
		? (suggestion as EnhancedBullet).enhanced
		: (suggestion as SuggestedBullet).bullet

	return {
		id: suggestion.id,
		type,
		section: suggestion.section,
		experienceIndex: suggestion.experienceIndex,
		bulletIndex: isEnhanced
			? (suggestion as EnhancedBullet).bulletIndex
			: undefined,
		finalText: editedText ?? defaultText,
	}
}

/**
 * Build AcceptedChange for enhanced summary
 */
export function buildSummaryChange(
	enhanced: string,
	editedText?: string,
): AcceptedChange {
	return {
		id: 'summary',
		type: 'enhanced_summary',
		section: 'summary',
		experienceIndex: -1,
		finalText: editedText ?? enhanced,
	}
}

/**
 * Check if text contains XX placeholders
 */
export function hasPlaceholders(text: string): boolean {
	return /XX/.test(text)
}

/**
 * Get list of XX placeholders in text
 */
export function extractPlaceholders(text: string): string[] {
	const matches: string[] = []
	// Match XX and surrounding context (up to 3 words before/after)
	const regex = /(?:\S+\s+){0,2}XX(?:\s+\S+){0,2}/g
	let match
	while ((match = regex.exec(text)) !== null) {
		matches.push(match[0].trim())
	}
	return matches
}

/**
 * Format experience location for display
 * "experiences[0]" + resume -> "Software Engineer at Acme Corp"
 */
export function formatExperienceLocation(
	section: string,
	resume: ResumeData,
): string {
	const expIndex = parseExperienceIndex(section)
	if (expIndex === null) return section

	const exp = resume.experiences?.[expIndex]
	if (!exp) return `Experience ${expIndex + 1}`

	const role = exp.role || 'Untitled Role'
	const company = exp.company || 'Unknown Company'

	return `${role} at ${company}`
}
