/**
 * Onboarding stage calculation utilities
 *
 * Pure functions to determine onboarding state from server data.
 * No side effects, no state management - just logic.
 */

import type { GettingStartedProgress } from '@prisma/client'
import type { Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'

export type OnboardingStage =
	| 'needs_resume'
	| 'needs_job'
	| 'needs_bullet_tailor'
	| 'needs_tailor_click'
	| 'complete'

export interface OnboardingState {
	stage: OnboardingStage
	isComplete: boolean
}

/**
 * Calculate the current onboarding stage from server progress data.
 *
 * Flow:
 * 1. needs_resume - User hasn't created/uploaded a resume yet
 * 2. needs_job - Has resume, needs to paste a job description
 * 3. needs_bullet_tailor - Has both, should click sparkle to open AI modal
 * 4. needs_tailor_click - Modal open, should click "Tailor Achievement" button
 * 5. complete - User clicked "Tailor Achievement", free to explore
 *
 * Note: needs_tailor_click is set manually when modal opens, not computed here.
 */
export function getOnboardingStage(
	progress: Jsonify<GettingStartedProgress> | null,
	hasResume: boolean,
	hasJob: boolean,
	hasTailored: boolean,
): OnboardingState {
	// If user has clicked Tailor Achievement, onboarding is complete
	if (hasTailored) {
		return { stage: 'complete', isComplete: true }
	}

	// Also complete if user has downloaded (legacy check)
	if (progress?.downloadCount && progress.downloadCount > 0) {
		return { stage: 'complete', isComplete: true }
	}

	// Step 1: Need a resume
	if (!hasResume) {
		return { stage: 'needs_resume', isComplete: false }
	}

	// Step 2: Need a job description
	if (!hasJob) {
		return { stage: 'needs_job', isComplete: false }
	}

	// Step 3: Need to click sparkle to open AI modal
	return { stage: 'needs_bullet_tailor', isComplete: false }
}

/**
 * Get the spotlight target selector for the current stage
 */
export function getSpotlightTarget(stage: OnboardingStage): string | null {
	switch (stage) {
		case 'needs_bullet_tailor':
			return '[data-first-bullet-ai]'
		case 'needs_tailor_click':
			return '[data-tailor-achievement-button]'
		default:
			return null
	}
}

/**
 * Get the hint text for the current spotlight
 */
export function getSpotlightHint(stage: OnboardingStage): string | null {
	switch (stage) {
		case 'needs_bullet_tailor':
			return 'Click to improve this achievement with AI (~5 seconds)'
		case 'needs_tailor_click':
			return 'Click to generate improved versions of this achievement'
		default:
			return null
	}
}
