/**
 * Resume Score Card Component
 *
 * Displays real-time resume score with circular progress indicator
 * and detailed breakdown of scoring dimensions.
 */

import { useState } from 'react'
import {
	type ScoreBreakdown,
	getScoreColor,
	getScoreRingColor,
} from '~/utils/resume-scoring.ts'
import { ChevronDownIcon, ChevronUpIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Link } from '@remix-run/react'

interface ResumeScoreCardProps {
	scores: ScoreBreakdown
	previousScore?: number
	hasJobDescription?: boolean
	className?: string
}

export function ResumeScoreCard({
	scores,
	previousScore,
	hasJobDescription = false,
	className = '',
}: ResumeScoreCardProps) {
	const [showBreakdown, setShowBreakdown] = useState(false)

	const scoreImprovement = previousScore ? scores.overall - previousScore : null
	const hasImproved = scoreImprovement && scoreImprovement > 0

	return (
		<div className={`rounded-lg border bg-white p-4 shadow-sm ${className}`}>
			{/* Header */}
			<div className="mb-4 flex items-center justify-between">
				<h3 className="text-lg font-semibold text-foreground">
					Resume Fit Score
				</h3>
				<button
					type="button"
					onClick={() => setShowBreakdown(!showBreakdown)}
					className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					Details
					{showBreakdown ? (
						<ChevronUpIcon className="h-4 w-4" />
					) : (
						<ChevronDownIcon className="h-4 w-4" />
					)}
				</button>
			</div>

			{/* Circular Score */}
			<div className="flex items-center justify-center">
				<div className="relative h-32 w-32">
					{/* Background circle */}
					<svg className="h-32 w-32 -rotate-90 transform">
						<circle
							cx="64"
							cy="64"
							r="56"
							stroke="currentColor"
							strokeWidth="8"
							fill="none"
							className="text-muted"
						/>
						{/* Progress circle */}
						<circle
							cx="64"
							cy="64"
							r="56"
							stroke="currentColor"
							strokeWidth="8"
							fill="none"
							strokeDasharray={`${scores.overall * 3.51} 351`}
							strokeLinecap="round"
							className={getScoreRingColor(scores.overall)}
						/>
					</svg>
					{/* Score text */}
					<div className="absolute inset-0 flex flex-col items-center justify-center">
						<span className={`text-3xl font-bold ${getScoreColor(scores.overall)}`}>
							{scores.overall}
						</span>
						<span className="text-xs text-muted-foreground">/ 100</span>
					</div>
				</div>
			</div>

			{/* Improvement indicator */}
			{hasImproved && (
				<div className="mt-3 flex items-center justify-center gap-1 text-sm">
					<span className="text-green-600">↑ +{scoreImprovement}</span>
					<span className="text-muted-foreground">from previous</span>
				</div>
			)}

			{/* Score interpretation */}
			<div className="mt-3 text-center text-sm">
				{!hasJobDescription && (
					<p className="text-muted-foreground mb-2">
						Add a job description to see your fit score
					</p>
				)}
				{scores.overall >= 90 && (
					<p className="text-green-600 font-medium">
						{hasJobDescription ? 'Excellent fit! Strong match for this role.' : 'Excellent quality! Well-written resume.'}
					</p>
				)}
				{scores.overall >= 70 && scores.overall < 90 && (
					<p className="text-yellow-600 font-medium">
						{hasJobDescription ? 'Good fit. A few improvements will help.' : 'Good quality. Some improvements will help.'}
					</p>
				)}
				{scores.overall < 70 && (
					<p className="text-red-600 font-medium">
						{hasJobDescription ? 'Needs work. Follow the checklist to improve fit.' : 'Needs work. Follow the checklist below.'}
					</p>
				)}
			</div>

			{/* Detailed breakdown (collapsible) */}
			{showBreakdown && (
				<div className="mt-4 space-y-2 border-t pt-4">
					<ScoreDimension
						label="Keyword Match"
						score={scores.keyword}
						description="Alignment with job description"
					/>
					<ScoreDimension
						label="Quantifiable Metrics"
						score={scores.metrics}
						description="Numbers, percentages, achievements"
					/>
					<ScoreDimension
						label="Action Verbs"
						score={scores.actionVerbs}
						description="Strong, impactful language"
					/>
					<ScoreDimension
						label="Content Length"
						score={scores.length}
						description="Optimal amount of detail"
					/>

					{/* Link to Resume Analyzer for deeper insights */}
					{hasJobDescription && (
						<div className="mt-4 pt-3 border-t">
							<Link
								to="/analyzer"
								className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
							>
								<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
								<span>Get comprehensive job fit analysis</span>
							</Link>
							<p className="mt-1 text-xs text-muted-foreground">
								Deeper insights on skills, experience, and overall match
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

function ScoreDimension({
	label,
	score,
	description,
}: {
	label: string
	score: number
	description: string
}) {
	return (
		<div className="flex items-center justify-between text-sm">
			<div className="flex-1">
				<div className="font-medium text-foreground">{label}</div>
				<div className="text-xs text-muted-foreground">{description}</div>
			</div>
			<div className="flex items-center gap-2">
				<div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
					<div
						className={`h-full transition-all duration-300 ${
							score >= 90 ? 'bg-green-600' : score >= 70 ? 'bg-yellow-600' : 'bg-red-600'
						}`}
						style={{ width: `${score}%` }}
					/>
				</div>
				<span className={`w-8 text-right font-medium ${getScoreColor(score)}`}>
					{score}
				</span>
			</div>
		</div>
	)
}
