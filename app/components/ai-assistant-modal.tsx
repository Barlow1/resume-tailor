import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button.tsx'
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { cn } from '~/utils/misc.ts'
import { type GettingStartedProgress, type Subscription } from '@prisma/client'
import { SlideoutModal } from '~/components/ui/slideout-modal.tsx'
import {
	type BuilderExperience,
	type BuilderJob,
	type ResumeData,
} from '~/utils/builder-resume.server.ts'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { useFetcher } from '@remix-run/react'
import type OpenAI from 'openai'

// v2: Type for the new structured tailor response
interface TailorOption {
	angle: 'Impact' | 'Alignment' | 'Transferable'
	bullet: string
}

interface TailorResponse {
	options: TailorOption[]
	keyword_coverage_note: string
	weak_bullet_flag: string | null
	coverage_gap_flag: string | null
}

const ANGLE_META: Record<
	TailorOption['angle'],
	{ description: string; color: string; bgClass: string; textClass: string; icon: string }
> = {
	Impact: {
		description: 'Leads with results & outcomes',
		color: '#059669',
		bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
		textClass: 'text-emerald-800 dark:text-emerald-400',
		icon: '📈',
	},
	Alignment: {
		description: 'Matches JD language & keywords',
		color: '#6B45FF',
		bgClass: 'bg-violet-100 dark:bg-violet-900/30',
		textClass: 'text-violet-800 dark:text-violet-400',
		icon: '🎯',
	},
	Transferable: {
		description: 'Highlights underlying skills',
		color: '#F76B15',
		bgClass: 'bg-orange-100 dark:bg-orange-900/30',
		textClass: 'text-orange-800 dark:text-orange-400',
		icon: '⚡',
	},
}

/** Simple word-level diff: marks words in revised that differ from original */
function wordDiff(
	original: string,
	revised: string,
): { type: 'same' | 'added' | 'removed'; text: string }[] {
	const origWords = original.split(/\s+/).filter(Boolean)
	const revWords = revised.split(/\s+/).filter(Boolean)
	const origLower = new Set(origWords.map(w => w.toLowerCase()))
	const revLower = new Set(revWords.map(w => w.toLowerCase()))

	const result: { type: 'same' | 'added' | 'removed'; text: string }[] = []

	// Show removed words first (from original not in revised)
	for (const w of origWords) {
		if (!revLower.has(w.toLowerCase())) {
			result.push({ type: 'removed', text: w })
		}
	}

	// Then show revised words, marking new ones
	for (const w of revWords) {
		result.push({
			type: origLower.has(w.toLowerCase()) ? 'same' : 'added',
			text: w,
		})
	}

	return result
}

interface AIAssistantModalProps {
	isOpen: boolean
	onClose: () => void
	onUpdate: (content: string) => void
	onMultipleUpdate: (contents: string[]) => void
	content?: string
	experience?: BuilderExperience
	job?: BuilderJob | null | undefined
	resumeData?: ResumeData | null
	subscription: Subscription | null
	gettingStartedProgress: Jsonify<GettingStartedProgress> | null
	setShowSubscribeModal: (show: boolean) => void
	onTailorClick?: () => void
}

export function AIAssistantModal({
	isOpen,
	onClose,
	onUpdate,
	onMultipleUpdate,
	content,
	experience,
	job,
	resumeData,
	subscription,
	gettingStartedProgress,
	setShowSubscribeModal,
	onTailorClick,
}: AIAssistantModalProps) {
	const [activeTab, setActiveTab] = useState<'tailor' | 'generate'>('tailor')
	const [selectedItems, setSelectedItems] = useState<number[]>([])
	const [rawContent, setRawContent] = useState<string>('')
	const [tailorLogId, setTailorLogId] = useState<string | null>(null)
	const [expandedOption, setExpandedOption] = useState<number | null>(null)
	const [showDiff, setShowDiff] = useState<Record<number, boolean>>({})
	const logActionFetcher = useFetcher()

	useEffect(() => {
		if (!isOpen) {
			setSelectedItems([])
			setExpandedOption(null)
			setShowDiff({})
		}
	}, [isOpen])

	const resetState = () => {
		setSelectedItems([])
		setRawContent('')
		setTailorLogId(null)
		setExpandedOption(null)
		setShowDiff({})
	}

	const builderCompletionsFetcher = useFetcher<
		OpenAI.Chat.Completions.ChatCompletion & {
			_request_id?: string | null
		}
	>()

	const handleCompletion = async (type: 'tailor' | 'generate') => {
		if (!subscription) {
			const MAX_AI_TRIAL_COUNT = 6
			const currentCount =
				(gettingStartedProgress?.generateCount ?? 0) +
				(gettingStartedProgress?.tailorCount ?? 0)
			if (currentCount >= MAX_AI_TRIAL_COUNT) {
				setShowSubscribeModal(true)
				return
			}
		}
		setSelectedItems([])
		setExpandedOption(null)
		setShowDiff({})

		if (type === 'tailor' && onTailorClick) {
			onTailorClick()
		}

		const endpoint = type === 'tailor' ? 'experience' : 'generated-experience'
		const formData = new FormData()
		formData.append('jobTitle', job?.title ?? '')
		formData.append('jobDescription', job?.content ?? '')
		formData.append('currentJobTitle', experience?.role ?? '')
		formData.append('currentJobCompany', experience?.company ?? '')
		formData.append('experience', content ?? '')
		formData.append('type', endpoint)

		if (job?.extractedKeywords) {
			formData.append('extractedKeywords', job.extractedKeywords)
		}

		// v2: Pass full resume data for holistic tailoring
		if (type === 'tailor' && resumeData) {
			formData.append('resumeData', JSON.stringify(resumeData))
		}

		builderCompletionsFetcher.submit(formData, {
			method: 'POST',
			action: '/resources/builder-completions',
		})
	}

	useEffect(() => {
		if (builderCompletionsFetcher.state === 'idle' && builderCompletionsFetcher.data) {
			setRawContent(
				builderCompletionsFetcher.data?.choices[0].message.content ?? '{}',
			)
			const logId = (builderCompletionsFetcher.data as any)?.tailorLogId
			if (logId) {
				setTailorLogId(logId)
			}
		}
	}, [builderCompletionsFetcher.state, builderCompletionsFetcher.data])

	// v2: Parse response based on active tab
	let parsedTailorResponse: TailorResponse | null = null
	let parsedGenerateOptions: string[] = []

	try {
		if (rawContent) {
			if (activeTab === 'tailor') {
				const parsed = JSON.parse(rawContent) as Record<string, unknown>
				// Handle both v2 format (options array) and legacy v1 format (experiences array)
				if (parsed.options && Array.isArray(parsed.options)) {
					parsedTailorResponse = parsed as unknown as TailorResponse
				} else if (parsed.experiences) {
					// Fallback: convert v1 format to v2 display
					parsedTailorResponse = {
						options: (parsed.experiences as string[]).slice(0, 3).map(
							(bullet: string, i: number) => ({
								angle: (['Impact', 'Alignment', 'Transferable'] as const)[i],
								bullet,
							})
						),
						keyword_coverage_note: '',
						weak_bullet_flag: null,
						coverage_gap_flag: null,
					}
				}
			} else {
				parsedGenerateOptions =
					(JSON.parse(rawContent) as { experiences: string[] }).experiences ?? []
			}
		}
	} catch {
		// Invalid JSON from API — treat as empty
	}

	// Unified list for selection logic
	const displayOptions: string[] =
		activeTab === 'tailor'
			? (parsedTailorResponse?.options ?? []).map(o => o.bullet)
			: parsedGenerateOptions

	const isLoading = builderCompletionsFetcher.state === 'submitting'

	const handleItemSelect = (index: number) => {
		if (activeTab === 'tailor') {
			setSelectedItems([index])
		} else {
			setSelectedItems(prev =>
				prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
			)
		}
	}

	const handleAccept = (index: number) => {
		const bullet = displayOptions[index]
		if (!bullet) return

		onUpdate(bullet)

		if (tailorLogId) {
			const formData = new FormData()
			formData.append('logId', tailorLogId)
			formData.append('action', 'accepted')
			formData.append('selectedOption', String(index))
			logActionFetcher.submit(formData, {
				method: 'POST',
				action: '/resources/tailor-log-action',
			})
		}

		resetState()
		onClose()
	}

	const handleSave = () => {
		const selectedContent = selectedItems
			.sort((a, b) => a - b)
			.map(index => displayOptions[index])

		if (activeTab === 'tailor') {
			onUpdate(selectedContent[0])

			if (tailorLogId) {
				const formData = new FormData()
				formData.append('logId', tailorLogId)
				formData.append('action', 'accepted')
				formData.append('selectedOption', String(selectedItems[0]))
				logActionFetcher.submit(formData, {
					method: 'POST',
					action: '/resources/tailor-log-action',
				})
			}
		} else {
			onMultipleUpdate(selectedContent)
		}

		resetState()
		onClose()
	}

	const handleClose = () => {
		if (tailorLogId && displayOptions.length > 0) {
			const formData = new FormData()
			formData.append('logId', tailorLogId)
			formData.append('action', 'abandoned')
			logActionFetcher.submit(formData, {
				method: 'POST',
				action: '/resources/tailor-log-action',
			})
		}
		resetState()
		onClose()
	}

	return (
		<SlideoutModal
			isOpen={isOpen}
			onClose={handleClose}
			title={
				<h2
					className={cn(
						'text-xl font-semibold text-foreground transition-colors',
						isLoading && 'animate-rainbow-text',
					)}
				>
					AI Assistant
				</h2>
			}
		>
			<div className="border-b border-border">
				<div className="flex px-4">
					<button
						className={`px-4 py-3 ${
							activeTab === 'tailor'
								? 'border-b-2 border-primary text-primary'
								: 'text-muted-foreground'
						}`}
						onClick={() => {
							setActiveTab('tailor')
							resetState()
						}}
					>
						Tailor
					</button>
					<button
						className={`px-4 py-3 ${
							activeTab === 'generate'
								? 'border-b-2 border-primary text-primary'
								: 'text-muted-foreground'
						}`}
						onClick={() => {
							setActiveTab('generate')
							resetState()
						}}
					>
						Generate
					</button>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Original bullet */}
				<div className="flex-shrink-0 space-y-3 p-4">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Original
					</h3>
					<div className="rounded-lg border-l-4 border-border bg-muted/50 px-4 py-3">
						<p className="text-sm italic text-muted-foreground">{content}</p>
					</div>
				</div>

				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div className="space-y-4">
						{!job ? (
							<div className="rounded-lg border border-border p-4">
								<p className="text-sm text-muted-foreground">
									Please select a job to get AI-powered suggestions.
								</p>
							</div>
						) : (
							<>
								{/* Tailor/Generate button */}
								{(!parsedTailorResponse && activeTab === 'tailor' && !isLoading) ||
								(!parsedGenerateOptions.length && activeTab === 'generate' && !isLoading) ? (
									<div className="rounded-lg border border-border p-4">
										<Button
											onClick={() => handleCompletion(activeTab)}
											disabled={isLoading}
											className={cn(
												'w-full',
												isLoading && 'animate-rainbow-text font-semibold',
											)}
											{...(activeTab === 'tailor'
												? { 'data-tailor-achievement-button': true }
												: {})}
										>
											{activeTab === 'tailor'
												? 'Tailor Achievement'
												: 'Generate Achievements'}
										</Button>
									</div>
								) : null}

								{isLoading && (
									<div className="flex flex-col items-center gap-3 py-8">
										<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
										<p className="animate-pulse text-sm text-muted-foreground">
											Generating alternatives...
										</p>
									</div>
								)}

								<div className="space-y-3">
									{/* v2: Tailor tab — accordion cards */}
									{activeTab === 'tailor' && parsedTailorResponse ? (
										<>
											{parsedTailorResponse.options.map((option, index) => {
												const meta = ANGLE_META[option.angle]
												const isExpanded = expandedOption === index
												const isDiffShown = showDiff[index] ?? false
												const diff = isDiffShown && content
													? wordDiff(content, option.bullet)
													: null

												return (
													<div
														key={index}
														className="overflow-hidden rounded-lg border border-border transition-all hover:border-primary/40"
													>
														{/* Collapsed header — always visible */}
														<button
															onClick={() =>
																setExpandedOption(
																	isExpanded ? null : index,
																)
															}
															className="flex w-full items-start gap-3 p-4 text-left"
														>
															<span className="mt-0.5 text-lg">
																{meta.icon}
															</span>
															<div className="min-w-0 flex-1">
																<div className="mb-1 flex items-center gap-2">
																	<span
																		className={cn(
																			'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
																			meta.bgClass,
																			meta.textClass,
																		)}
																	>
																		{option.angle} Focus
																	</span>
																	<span className="text-xs text-muted-foreground">
																		{meta.description}
																	</span>
																</div>
																{!isExpanded && (
																	<p className="truncate text-sm text-muted-foreground">
																		{option.bullet}
																	</p>
																)}
															</div>
															{isExpanded ? (
																<ChevronUpIcon className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
															) : (
																<ChevronDownIcon className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
															)}
														</button>

														{/* Expanded body */}
														{isExpanded && (
															<div className="border-t border-border px-4 pb-4 pt-3">
																{/* Full bullet text or diff view */}
																{diff ? (
																	<div className="mb-3 rounded-md bg-muted/50 p-3">
																		<div className="mb-2 text-xs font-medium text-muted-foreground">
																			Removed:
																		</div>
																		<p className="mb-2 text-sm leading-relaxed">
																			{diff
																				.filter(
																					d =>
																						d.type ===
																						'removed',
																				)
																				.map((d, di) => (
																					<span
																						key={di}
																						className="mr-1 text-red-600 line-through dark:text-red-400"
																					>
																						{d.text}
																					</span>
																				))}
																		</p>
																		<div className="mb-2 text-xs font-medium text-muted-foreground">
																			New version:
																		</div>
																		<p className="text-sm leading-relaxed">
																			{diff
																				.filter(
																					d =>
																						d.type !==
																						'removed',
																				)
																				.map((d, di) => (
																					<span
																						key={di}
																						className={cn(
																							'mr-1',
																							d.type ===
																								'added' &&
																								'font-medium text-emerald-600 dark:text-emerald-400',
																						)}
																					>
																						{d.text}
																					</span>
																				))}
																		</p>
																	</div>
																) : (
																	<p className="mb-3 text-sm leading-relaxed text-foreground">
																		{option.bullet}
																	</p>
																)}

																{/* Action buttons */}
																<div className="flex flex-wrap items-center gap-2">
																	<Button
																		size="sm"
																		onClick={() =>
																			handleAccept(index)
																		}
																		className="gap-1"
																	>
																		<CheckIcon className="h-3.5 w-3.5" />
																		Accept
																	</Button>
																	<Button
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			setShowDiff(prev => ({
																				...prev,
																				[index]:
																					!prev[index],
																			}))
																		}
																	>
																		{isDiffShown
																			? 'Hide Changes'
																			: 'See What Changed'}
																	</Button>
																	<Button
																		size="sm"
																		variant="ghost"
																		onClick={() =>
																			handleCompletion(
																				'tailor',
																			)
																		}
																		disabled={isLoading}
																	>
																		↻ Retry
																	</Button>
																</div>
															</div>
														)}
													</div>
												)
											})}

											{/* Flags — rendered as callout cards below options */}
											{parsedTailorResponse.weak_bullet_flag && (
												<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
													<p className="text-sm text-amber-800 dark:text-amber-300">
														<span className="font-medium">
															Suggestion:{' '}
														</span>
														{parsedTailorResponse.weak_bullet_flag}
													</p>
												</div>
											)}

											{parsedTailorResponse.coverage_gap_flag && (
												<div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20">
													<p className="text-sm text-rose-800 dark:text-rose-300">
														<span className="font-medium">Gap: </span>
														{parsedTailorResponse.coverage_gap_flag}
													</p>
												</div>
											)}

											{/* Keyword coverage — collapsed by default */}
											{parsedTailorResponse.keyword_coverage_note && (
												<details className="rounded-lg border border-border p-3">
													<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
														Keyword coverage
													</summary>
													<p className="mt-2 text-sm text-muted-foreground">
														{parsedTailorResponse.keyword_coverage_note}
													</p>
												</details>
											)}
										</>
									) : activeTab === 'generate' &&
									  parsedGenerateOptions.length > 0 ? (
										<div className="space-y-2">
											{parsedGenerateOptions.map(
												(option: string, index: number) => (
													<div
														key={index}
														onClick={() => handleItemSelect(index)}
														className={`group relative cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
															selectedItems.includes(index)
																? 'border-primary bg-accent'
																: 'border-border'
														}`}
													>
														<p className="pr-8 text-muted-foreground">
															{option}
														</p>
														{selectedItems.includes(index) && (
															<CheckIcon className="absolute right-2 top-2 h-5 w-5 text-primary" />
														)}
													</div>
												),
											)}
										</div>
									) : !isLoading ? (
										<p className="text-sm text-muted-foreground">
											Click &quot;
											{activeTab === 'tailor'
												? 'Tailor Achievement'
												: 'Generate Achievements'}
											&quot; to get AI-powered suggestions...
										</p>
									) : null}
								</div>
							</>
						)}
					</div>
				</div>

				{/* Footer — only for generate tab with selections */}
				{activeTab === 'generate' && selectedItems.length > 0 && (
					<div className="flex-shrink-0 border-t border-border bg-muted p-4">
						<div className="flex justify-start gap-2">
							<Button variant="secondary" onClick={handleClose}>
								Cancel
							</Button>
							<Button onClick={handleSave}>
								Use {selectedItems.length} Selected
							</Button>
						</div>
					</div>
				)}
			</div>
		</SlideoutModal>
	)
}
