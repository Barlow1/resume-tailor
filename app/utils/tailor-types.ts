/**
 * Shared types for the tailor-to-job feature
 */

import type { ResumeData } from './builder-resume.server.ts'

// --- Suggestion Types (from AI response) ---

export interface EnhancedBullet {
	id: string
	section: string // "experiences[0]" - experience index
	experienceIndex: number // parsed from section
	bulletIndex: number // found by matching original text
	original: string
	enhanced: string
	changes: string // "why" explanation
	added_keywords: string[]
}

export interface SuggestedBullet {
	id: string
	section: string // "experiences[0]" - where to add
	experienceIndex: number // parsed from section
	bullet: string // may contain XX placeholders
	evidence: string
	confidence: 'high' | 'medium' | 'low'
	placeholders: string[] // ["XX engineers", "XX features"]
}

export interface Gap {
	category:
		| 'technical_skill'
		| 'domain'
		| 'tool'
		| 'certification'
		| 'experience_level'
	missing: string
	required_by_jd: string
	severity: 'critical' | 'moderate' | 'minor'
	reasoning: string
	suggestion: string
}

export interface EnhancedSummary {
	original: string
	enhanced: string
	changes: string
}

export interface TailorSuggestions {
	enhanced_bullets: EnhancedBullet[]
	suggested_bullets: SuggestedBullet[]
	gaps: Gap[]
	enhanced_summary?: EnhancedSummary
}

// --- Hybrid Response (from API) ---

export interface HybridTailorResponse {
	tailored_resume: ResumeData // preview with all suggestions applied
	suggestions: TailorSuggestions // for granular control
	score_before: number
	score_after: number
}

// --- Suggestion State (for UI tracking) ---

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected'

export interface SuggestionState {
	id: string
	status: SuggestionStatus
	editedText?: string // for XX placeholder edits or regenerate selection
}

// --- Applied Changes (for final commit) ---

export interface AcceptedChange {
	id: string
	type: 'enhanced_bullet' | 'suggested_bullet' | 'enhanced_summary'
	section: string // "experiences[0]"
	experienceIndex: number
	bulletIndex?: number // for enhanced bullets
	finalText: string // user's edited text (XX replaced or deleted)
}

// --- Raw AI Response (before processing) ---

export interface RawTailorResponse {
	enhanced_bullets: Array<{
		section: string
		original: string
		enhanced: string
		changes: string
		added_keywords: string[]
	}>
	suggested_bullets: Array<{
		section: string
		bullet: string
		evidence: string
		confidence: 'high' | 'medium' | 'low'
		placeholders: string[]
	}>
	gaps: Gap[]
	enhanced_summary?: EnhancedSummary
}

// --- Utility Types ---

export interface RegenerateState {
	suggestionId: string
	isLoading: boolean
	options: string[] | null // null = not fetched yet
}
