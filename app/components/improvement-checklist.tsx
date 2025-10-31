/**
 * Improvement Checklist Component
 *
 * Displays dynamic, prioritized list of resume improvements
 * with explanations and auto-check functionality.
 */

import { useState } from 'react'
import type { ChecklistItem } from '~/utils/resume-scoring.ts'
import {
	ExclamationCircleIcon,
	InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid'

interface ImprovementChecklistProps {
	items: ChecklistItem[]
	className?: string
}

export function ImprovementChecklist({
	items,
	className = '',
}: ImprovementChecklistProps) {
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

	const toggleExpanded = (id: string) => {
		const newExpanded = new Set(expandedItems)
		if (newExpanded.has(id)) {
			newExpanded.delete(id)
		} else {
			newExpanded.add(id)
		}
		setExpandedItems(newExpanded)
	}

	const completedCount = items.filter(item => item.completed).length
	const totalCount = items.length

	return (
		<div className={`rounded-lg border bg-background p-4 shadow-sm ${className}`}>
			{/* Header */}
			<div className="mb-4 flex items-center justify-between">
				<h3 className="text-lg font-semibold text-foreground">
					Improvement Checklist
				</h3>
				<div className="text-sm text-muted-foreground">
					{completedCount} / {totalCount}
				</div>
			</div>

			{/* Progress bar */}
			<div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					className="h-full bg-brand-800 transition-all duration-300"
					style={{ width: `${(completedCount / totalCount) * 100}%` }}
				/>
			</div>

			{/* Checklist items */}
			<div className="space-y-2">
				{items.map(item => (
					<div
						key={item.id}
						className={`rounded-md border p-3 transition-all ${
							item.completed
								? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
								: 'border-border bg-background hover:bg-muted/50'
						}`}
					>
						<button
							type="button"
							onClick={() => toggleExpanded(item.id)}
							className="w-full text-left"
						>
							<div className="flex items-start gap-3">
								{/* Checkbox icon */}
								<div className="mt-0.5 flex-shrink-0">
									{item.completed ? (
										<CheckCircleIconSolid className="h-5 w-5 text-green-600" />
									) : (
										<div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
									)}
								</div>

								{/* Content */}
								<div className="flex-1">
									<div className="flex items-start justify-between gap-2">
										<p
											className={`text-sm font-medium ${
												item.completed
													? 'text-green-700 dark:text-green-400 line-through'
													: 'text-foreground'
											}`}
										>
											{item.text}
										</p>
										<PriorityBadge priority={item.priority} />
									</div>

									{/* Explanation (expandable) */}
									{expandedItems.has(item.id) && (
										<div className="mt-3">
											{item.id === 'keywords-missing' ? (
												<KeywordsList explanation={item.explanation} />
											) : (
												<p className="text-xs text-muted-foreground">
													{item.explanation}
												</p>
											)}
										</div>
									)}
								</div>
							</div>
						</button>
					</div>
				))}
			</div>

			{/* Completion message */}
			{completedCount === totalCount && totalCount > 0 && (
				<div className="mt-4 flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-400">
					<CheckCircleIconSolid className="h-5 w-5" />
					<span className="font-medium">
						Great work! Your resume is optimized. Download it and start applying!
					</span>
				</div>
			)}
		</div>
	)
}

function KeywordsList({ explanation }: { explanation: string }) {
	// Extract keywords from explanation
	const lines = explanation.split('\n')
	const keywords = lines
		.filter(line => line.trim().startsWith('•'))
		.map(line => line.trim().substring(1).trim())

	const introText = lines[0] // First line is the intro text

	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">{introText}</p>
			<div className="flex flex-wrap gap-2">
				{keywords.map((keyword, index) => (
					<span
						key={index}
						className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-600/20 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-400/30"
					>
						{keyword}
					</span>
				))}
			</div>
		</div>
	)
}

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
	if (priority === 'high') {
		return (
			<span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
				<ExclamationCircleIcon className="h-3 w-3" />
				High
			</span>
		)
	}

	if (priority === 'medium') {
		return (
			<span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
				<InformationCircleIcon className="h-3 w-3" />
				Medium
			</span>
		)
	}

	return null // Don't show badge for low priority
}
