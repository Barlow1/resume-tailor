/**
 * Custom Hook: useResumeScore
 *
 * Calculates resume score in real-time with optimized performance:
 * - Debounced calculation (500ms delay)
 * - Memoized results
 * - Automatic checklist generation
 */

import { useState, useEffect, useMemo } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import type { ResumeData } from '~/utils/builder-resume.server.ts'
import {
	calculateResumeScore,
	generateChecklist,
	type ScoreBreakdown,
	type ChecklistItem,
} from '~/utils/resume-scoring.ts'

interface UseResumeScoreOptions {
	resumeData: ResumeData
	jobDescription?: string
	extractedKeywords?: string[] | null
	primaryKeywords?: string[] | null
	debounceMs?: number
}

export function useResumeScore({
	resumeData,
	jobDescription,
	extractedKeywords,
	primaryKeywords,
	debounceMs = 500,
}: UseResumeScoreOptions) {
	const [scores, setScores] = useState<ScoreBreakdown>(() =>
		calculateResumeScore(resumeData, jobDescription, extractedKeywords, primaryKeywords)
	)
	const [previousScore, setPreviousScore] = useState<number | undefined>(undefined)

	// Debounced score calculation
	const debouncedCalculateScore = useDebouncedCallback(() => {
		const newScores = calculateResumeScore(resumeData, jobDescription, extractedKeywords, primaryKeywords)

		// Track improvement
		if (scores.overall !== newScores.overall) {
			setPreviousScore(scores.overall)
		}

		setScores(newScores)
	}, debounceMs)

	// Recalculate when resume data or job changes
	useEffect(() => {
		debouncedCalculateScore()
	}, [resumeData, jobDescription, extractedKeywords, primaryKeywords, debouncedCalculateScore])

	// Generate checklist (memoized)
	const checklist = useMemo<ChecklistItem[]>(
		() => generateChecklist(resumeData, scores, jobDescription, extractedKeywords, primaryKeywords),
		[resumeData, scores, jobDescription, extractedKeywords, primaryKeywords]
	)

	return {
		scores,
		previousScore,
		checklist,
	}
}
