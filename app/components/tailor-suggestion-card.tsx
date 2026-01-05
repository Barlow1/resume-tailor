/**
 * TailorSuggestionCard - Individual suggestion with accept/reject/regenerate controls
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button.tsx'
import { cn } from '~/utils/misc.ts'
import type {
	EnhancedBullet,
	SuggestedBullet,
	SuggestionStatus,
} from '~/utils/tailor-types.ts'

interface SuggestionCardProps {
	type: 'enhanced' | 'suggested'
	suggestion: EnhancedBullet | SuggestedBullet
	status: SuggestionStatus
	editedText?: string
	experienceLabel: string
	onAccept: (finalText: string) => void
	onReject: () => void
	onEditText: (text: string) => void
	// Regenerate
	isRegenerating: boolean
	regenerateOptions: string[] | null
	onRequestRegenerate: () => void
	onSelectRegenerateOption: (text: string) => void
}

export function TailorSuggestionCard({
	type,
	suggestion,
	status,
	editedText,
	experienceLabel,
	onAccept,
	onReject,
	onEditText,
	isRegenerating,
	regenerateOptions,
	onRequestRegenerate,
	onSelectRegenerateOption,
}: SuggestionCardProps) {
	const [showRegenerateOptions, setShowRegenerateOptions] = useState(false)
	const [selectedOption, setSelectedOption] = useState<number | null>(null)

	// Get display text
	const displayText =
		editedText ??
		(type === 'enhanced'
			? (suggestion as EnhancedBullet).enhanced
			: (suggestion as SuggestedBullet).bullet)

	// Check for XX placeholders
	const hasPlaceholders = /XX/.test(displayText)
	const canAccept = !hasPlaceholders

	// Handle regenerate click
	const handleRegenerateClick = () => {
		if (regenerateOptions === null) {
			onRequestRegenerate()
		}
		setShowRegenerateOptions(true)
	}

	// Confirm selection
	const handleConfirmSelection = () => {
		if (selectedOption !== null && regenerateOptions) {
			onSelectRegenerateOption(regenerateOptions[selectedOption])
			setShowRegenerateOptions(false)
			setSelectedOption(null)
		}
	}

	// Card styling based on status
	const cardStyles = {
		pending: 'border-gray-200 bg-white',
		accepted: 'border-green-300 bg-green-50',
		rejected: 'border-gray-200 bg-gray-50 opacity-60',
	}

	return (
		<div
			className={cn(
				'rounded-lg border p-4 mb-3 transition-colors',
				cardStyles[status],
			)}
		>
			{/* Location header */}
			<div className="text-xs text-gray-500 mb-2 font-medium">
				{experienceLabel}
			</div>

			{/* Before text - only for enhanced */}
			{type === 'enhanced' && (
				<div className="flex items-start gap-2 mb-2">
					<span className="text-red-500 font-bold text-sm mt-0.5">-</span>
					<span className="text-sm text-gray-500 line-through">
						{(suggestion as EnhancedBullet).original}
					</span>
				</div>
			)}

			{/* After text with XX highlighting */}
			<div className="flex items-start gap-2 mb-3">
				<span className="text-green-500 font-bold text-sm mt-0.5">+</span>
				<div className="flex-1">
					<EditablePlaceholderText
						text={displayText}
						onChange={onEditText}
						disabled={status !== 'pending'}
					/>
				</div>
			</div>

			{/* Reasoning */}
			<div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-3">
				<span className="font-medium">Why: </span>
				{type === 'enhanced'
					? (suggestion as EnhancedBullet).changes
					: (suggestion as SuggestedBullet).evidence}
			</div>

			{/* Keywords - only for enhanced */}
			{type === 'enhanced' &&
				(suggestion as EnhancedBullet).added_keywords.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-3">
						{(suggestion as EnhancedBullet).added_keywords.map((kw, i) => (
							<span
								key={i}
								className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
							>
								+{kw}
							</span>
						))}
					</div>
				)}

			{/* Confidence badge - only for suggested */}
			{type === 'suggested' && (
				<div className="mb-3">
					<ConfidenceBadge
						level={(suggestion as SuggestedBullet).confidence}
					/>
				</div>
			)}

			{/* Regenerate options dropdown */}
			{showRegenerateOptions && status === 'pending' && (
				<div className="border rounded-lg p-3 mb-3 bg-blue-50">
					<div className="text-sm font-medium mb-2">Choose a variation:</div>

					{isRegenerating ? (
						<div className="flex items-center gap-2 text-gray-500 py-2">
							<Spinner />
							<span className="text-sm">Generating alternatives...</span>
						</div>
					) : regenerateOptions ? (
						<div className="space-y-2">
							{regenerateOptions.map((option, i) => (
								<label
									key={i}
									className={cn(
										'flex items-start gap-2 p-2 rounded cursor-pointer border',
										selectedOption === i
											? 'bg-blue-100 border-blue-300'
											: 'bg-white border-gray-200 hover:bg-gray-50',
									)}
								>
									<input
										type="radio"
										name={`regen-${suggestion.id}`}
										checked={selectedOption === i}
										onChange={() => setSelectedOption(i)}
										className="mt-1"
									/>
									<span className="text-sm">{option}</span>
								</label>
							))}

							<div className="flex gap-2 mt-3">
								<Button
									size="sm"
									onClick={handleConfirmSelection}
									disabled={selectedOption === null}
								>
									Use Selected
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setShowRegenerateOptions(false)
										setSelectedOption(null)
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : null}
				</div>
			)}

			{/* Action buttons */}
			{status === 'pending' && !showRegenerateOptions && (
				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={() => onAccept(displayText)}
						disabled={!canAccept}
						title={hasPlaceholders ? 'Fill or remove XX placeholders first' : ''}
					>
						Accept
					</Button>
					<Button size="sm" variant="outline" onClick={onReject}>
						Skip
					</Button>
					<Button size="sm" variant="ghost" onClick={handleRegenerateClick}>
						Regenerate
					</Button>
				</div>
			)}

			{/* Status indicators for accepted/rejected */}
			{status === 'accepted' && (
				<div className="flex items-center gap-2">
					<span className="text-green-600 text-sm font-medium">Accepted</span>
					<Button
						size="sm"
						variant="ghost"
						className="text-gray-500 text-xs"
						onClick={onReject}
					>
						Undo
					</Button>
				</div>
			)}
			{status === 'rejected' && (
				<div className="flex items-center gap-2">
					<span className="text-gray-400 text-sm">Skipped</span>
					<Button
						size="sm"
						variant="ghost"
						className="text-gray-500 text-xs"
						onClick={() => onAccept(displayText)}
						disabled={hasPlaceholders}
					>
						Undo
					</Button>
				</div>
			)}
		</div>
	)
}

// Inline XX placeholder editing
function EditablePlaceholderText({
	text,
	onChange,
	disabled,
}: {
	text: string
	onChange: (text: string) => void
	disabled: boolean
}) {
	// Split text by XX placeholders
	const parts = text.split(/(XX)/g)
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])

	// Track edited values
	const [editedParts, setEditedParts] = useState<string[]>(parts)

	// Reset when text changes externally
	useEffect(() => {
		setEditedParts(text.split(/(XX)/g))
	}, [text])

	const handlePartChange = (index: number, value: string) => {
		const newParts = [...editedParts]
		newParts[index] = value
		setEditedParts(newParts)
		onChange(newParts.join(''))
	}

	return (
		<span className="text-sm leading-relaxed">
			{editedParts.map((part, i) =>
				part === 'XX' ? (
					<input
						key={i}
						ref={(el) => {
							inputRefs.current[i] = el
						}}
						type="text"
						defaultValue="XX"
						className={cn(
							'inline-block w-16 px-1 mx-0.5 bg-yellow-100 border border-yellow-300 rounded text-center text-sm',
							'focus:outline-none focus:ring-2 focus:ring-yellow-400',
							disabled && 'opacity-50 cursor-not-allowed',
						)}
						disabled={disabled}
						onChange={(e) => handlePartChange(i, e.target.value)}
						onFocus={(e) => {
							if (e.target.value === 'XX') {
								e.target.select()
							}
						}}
					/>
				) : (
					<span key={i}>{part}</span>
				),
			)}
		</span>
	)
}

// Confidence badge component
function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
	const styles = {
		high: 'bg-green-100 text-green-700 border-green-300',
		medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
		low: 'bg-orange-100 text-orange-700 border-orange-300',
	}

	const labels = {
		high: 'High confidence',
		medium: 'Medium confidence',
		low: 'Low confidence',
	}

	return (
		<span
			className={cn(
				'inline-flex items-center text-xs px-2 py-0.5 rounded border',
				styles[level],
			)}
		>
			{labels[level]}
		</span>
	)
}

// Simple spinner
function Spinner() {
	return (
		<svg
			className="animate-spin h-4 w-4 text-gray-500"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	)
}

// Summary change card (for enhanced summary)
interface SummaryCardProps {
	original: string
	enhanced: string
	changes: string
	status: SuggestionStatus
	editedText?: string
	onAccept: (finalText: string) => void
	onReject: () => void
	onEditText: (text: string) => void
}

export function TailorSummaryCard({
	original,
	enhanced,
	changes,
	status,
	editedText,
	onAccept,
	onReject,
	onEditText,
}: SummaryCardProps) {
	const displayText = editedText ?? enhanced
	const hasPlaceholders = /XX/.test(displayText)
	const canAccept = !hasPlaceholders

	const cardStyles = {
		pending: 'border-gray-200 bg-white',
		accepted: 'border-green-300 bg-green-50',
		rejected: 'border-gray-200 bg-gray-50 opacity-60',
	}

	return (
		<div
			className={cn(
				'rounded-lg border p-4 mb-3 transition-colors',
				cardStyles[status],
			)}
		>
			<div className="text-xs text-gray-500 mb-2 font-medium">
				Professional Summary
			</div>

			{/* Before */}
			<div className="flex items-start gap-2 mb-2">
				<span className="text-red-500 font-bold text-sm mt-0.5">-</span>
				<span className="text-sm text-gray-500 line-through">{original}</span>
			</div>

			{/* After */}
			<div className="flex items-start gap-2 mb-3">
				<span className="text-green-500 font-bold text-sm mt-0.5">+</span>
				<div className="flex-1">
					<EditablePlaceholderText
						text={displayText}
						onChange={onEditText}
						disabled={status !== 'pending'}
					/>
				</div>
			</div>

			{/* Reasoning */}
			<div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-3">
				<span className="font-medium">Why: </span>
				{changes}
			</div>

			{/* Action buttons */}
			{status === 'pending' && (
				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={() => onAccept(displayText)}
						disabled={!canAccept}
						title={hasPlaceholders ? 'Fill or remove XX placeholders first' : ''}
					>
						Accept
					</Button>
					<Button size="sm" variant="outline" onClick={onReject}>
						Skip
					</Button>
				</div>
			)}

			{status === 'accepted' && (
				<div className="flex items-center gap-2">
					<span className="text-green-600 text-sm font-medium">Accepted</span>
					<Button
						size="sm"
						variant="ghost"
						className="text-gray-500 text-xs"
						onClick={onReject}
					>
						Undo
					</Button>
				</div>
			)}
			{status === 'rejected' && (
				<div className="flex items-center gap-2">
					<span className="text-gray-400 text-sm">Skipped</span>
					<Button
						size="sm"
						variant="ghost"
						className="text-gray-500 text-xs"
						onClick={() => onAccept(displayText)}
						disabled={hasPlaceholders}
					>
						Undo
					</Button>
				</div>
			)}
		</div>
	)
}
