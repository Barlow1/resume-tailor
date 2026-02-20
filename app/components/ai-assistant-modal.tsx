import { useState, useEffect, useRef } from 'react'
import {
	CheckIcon,
	ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { type GettingStartedProgress, type Subscription } from '@prisma/client'
import {
	type BuilderExperience,
	type BuilderJob,
	type ResumeData,
} from '~/utils/builder-resume.server.ts'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { useFetcher } from '@remix-run/react'
import type OpenAI from 'openai'
import {
	Sparkles,
	TrendingUp,
	Target,
	Zap,
	Check,
	Pencil,
	RotateCcw,
	X,
} from 'lucide-react'
import { track, trackAiModalOpened, markAiModalResult, trackAiModalClosed } from '~/lib/analytics.client.ts'

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

interface ThemeColors {
	bg: string
	bgEl: string
	bgSurf: string
	border: string
	borderSub: string
	text: string
	muted: string
	dim: string
}

const BRAND = '#6B45FF'
const SUCCESS = '#30A46C'
const WARN = '#F76B15'
const ERROR = '#E5484D'
const METRIC = '#A855F7'

/** Highlight [placeholder] metric tokens in purple so they stand out */
function highlightMetrics(text: string) {
	const parts = text.split(/(\[[^\]]+\])/)
	if (parts.length === 1) return text
	return parts.map((part, i) =>
		/^\[.+\]$/.test(part) ? (
			<span key={i} style={{ color: METRIC, fontWeight: 600 }}>{part}</span>
		) : part
	)
}

const ANGLE_META: Record<
	TailorOption['angle'],
	{
		label: string
		description: string
		color: string
		bgColor: string
		borderColor: string
		icon: typeof TrendingUp
		rationale: string
	}
> = {
	Impact: {
		label: 'Impact Focus',
		description: 'Leads with results & outcomes',
		color: SUCCESS,
		bgColor: `${SUCCESS}18`,
		borderColor: `${SUCCESS}40`,
		icon: TrendingUp,
		rationale:
			'Added quantified context — resumes with metrics get 2.6x more callbacks',
	},
	Alignment: {
		label: 'Alignment Focus',
		description: 'Matches JD language & keywords',
		color: BRAND,
		bgColor: `${BRAND}18`,
		borderColor: `${BRAND}40`,
		icon: Target,
		rationale:
			"Mirrors the job description's emphasis on stakeholder management and strategic thinking",
	},
	Transferable: {
		label: 'Transferable Skills',
		description: 'Highlights underlying skills',
		color: WARN,
		bgColor: `${WARN}18`,
		borderColor: `${WARN}40`,
		icon: Zap,
		rationale:
			'Highlights transferable methodology — valuable across any role',
	},
}

/** Word-level diff: marks words in revised that differ from original */
function wordDiff(
	original: string,
	revised: string,
): { type: 'same' | 'added' | 'removed'; text: string }[] {
	const origWords = original.split(/\s+/).filter(Boolean)
	const revWords = revised.split(/\s+/).filter(Boolean)
	const origLower = new Set(origWords.map(w => w.toLowerCase()))
	const revLower = new Set(revWords.map(w => w.toLowerCase()))

	const result: { type: 'same' | 'added' | 'removed'; text: string }[] = []

	for (const w of origWords) {
		if (!revLower.has(w.toLowerCase())) {
			result.push({ type: 'removed', text: w })
		}
	}

	for (const w of revWords) {
		result.push({
			type: origLower.has(w.toLowerCase()) ? 'same' : 'added',
			text: w,
		})
	}

	return result
}

export interface DiagnosticContext {
	issueType: 'no-metrics' | 'weak-verb' | 'missing-keywords'
	reason: string
	missingKeywords?: string[]
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
	theme: ThemeColors
	diagnosticContext?: DiagnosticContext | null
	initialTab?: 'tailor' | 'generate'
	onBulletChange?: (content: string, experience: BuilderExperience, bulletIndex: number) => void
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
	theme: c,
	diagnosticContext,
	initialTab,
	onBulletChange,
}: AIAssistantModalProps) {
	const [activeTab, setActiveTab] = useState<'tailor' | 'generate'>(initialTab ?? 'tailor')
	const [selectedItems, setSelectedItems] = useState<number[]>([])
	const [rawContent, setRawContent] = useState<string>('')
	const [tailorLogId, setTailorLogId] = useState<string | null>(null)
	const [expandedOption, setExpandedOption] = useState<number | null>(null)
	const [showDiff, setShowDiff] = useState<Record<number, boolean>>({})
	const [acceptedOption, setAcceptedOption] = useState<number | null>(null)
	const [editingOption, setEditingOption] = useState<number | null>(null)
	const [editValues, setEditValues] = useState<Record<number, string>>({})
	const [tailorContent, setTailorContent] = useState<string | undefined>(content)
	const [tailorExperience, setTailorExperience] = useState<BuilderExperience | undefined>(experience)
	const [showBulletPicker, setShowBulletPicker] = useState(false)
	const editTextareaRef = useRef<HTMLTextAreaElement>(null)
	const logActionFetcher = useFetcher()
	const completionStartTime = useRef<number | null>(null)
	const wasOpenRef = useRef(false)

	useEffect(() => {
		if (isOpen) {
			setTailorContent(content)
			setTailorExperience(experience)
			setShowBulletPicker(!content)
			if (!wasOpenRef.current) {
				// Modal just opened — reset tab and track
				setActiveTab(initialTab ?? 'tailor')
				trackAiModalOpened(initialTab ?? 'tailor', experience?.id ?? undefined)
				wasOpenRef.current = true
			}
		} else {
			wasOpenRef.current = false
			setSelectedItems([])
			setExpandedOption(null)
			setShowDiff({})
			setAcceptedOption(null)
			setEditingOption(null)
			setEditValues({})
			setShowBulletPicker(false)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, initialTab, experience?.id, content])

	const resetState = () => {
		setSelectedItems([])
		setRawContent('')
		setTailorLogId(null)
		setExpandedOption(null)
		setShowDiff({})
		setAcceptedOption(null)
		setEditingOption(null)
		setEditValues({})
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
		setAcceptedOption(null)
		setEditingOption(null)
		setEditValues({})

		if (type === 'tailor' && onTailorClick) {
			onTailorClick()
		}

		completionStartTime.current = Date.now()
		track('ai_tailor_started', {
			experience_id: experience?.id ?? '',
			has_job_context: !!job?.content,
			is_free_tier: !subscription,
			resume_id: resumeData?.id ?? undefined,
			job_id: job?.id ?? undefined,
		})

		const endpoint = type === 'tailor' ? 'experience' : 'generated-experience'
		const activeExp = type === 'tailor' ? tailorExperience : experience
		const activeContent = type === 'tailor' ? tailorContent : content
		const formData = new FormData()
		formData.append('jobTitle', job?.title ?? '')
		formData.append('jobDescription', job?.content ?? '')
		formData.append('currentJobTitle', activeExp?.role ?? '')
		formData.append('currentJobCompany', activeExp?.company ?? '')
		formData.append('experience', activeContent ?? '')
		formData.append('type', endpoint)

		if (job?.extractedKeywords) {
			formData.append('extractedKeywords', job.extractedKeywords)
		}

		if (resumeData) {
			formData.append('resumeData', JSON.stringify(resumeData))
		}

		if (diagnosticContext) {
			formData.append('diagnosticContext', JSON.stringify(diagnosticContext))
		}

		builderCompletionsFetcher.submit(formData, {
			method: 'POST',
			action: '/resources/builder-completions',
		})
	}

	useEffect(() => {
		if (builderCompletionsFetcher.state === 'idle' && builderCompletionsFetcher.data) {
			const responseContent = builderCompletionsFetcher.data?.choices[0].message.content ?? '{}'
			setRawContent(responseContent)
			const logId = (builderCompletionsFetcher.data as any)?.tailorLogId
			if (logId) {
				setTailorLogId(logId)
			}
			const duration = completionStartTime.current ? Date.now() - completionStartTime.current : 0
			track('ai_tailor_completed', {
				experience_id: experience?.id ?? '',
				duration_ms: duration,
				success: !!responseContent && responseContent !== '{}',
				resume_id: resumeData?.id ?? undefined,
				job_id: job?.id ?? undefined,
			})
			markAiModalResult()
			completionStartTime.current = null
		}
	}, [builderCompletionsFetcher.state, builderCompletionsFetcher.data, experience?.id, resumeData?.id, job?.id])

	let parsedTailorResponse: TailorResponse | null = null
	let parsedGenerateOptions: string[] = []

	try {
		if (rawContent) {
			if (activeTab === 'tailor') {
				const parsed = JSON.parse(rawContent) as Record<string, unknown>
				if (parsed.options && Array.isArray(parsed.options)) {
					parsedTailorResponse = parsed as unknown as TailorResponse
				} else if (parsed.experiences) {
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
					((JSON.parse(rawContent) as { experiences: string[] }).experiences ?? []).slice(0, 5)
			}
		}
	} catch {
		// Invalid JSON from API
	}

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
		const bullet = editValues[index] ?? displayOptions[index]
		if (!bullet) return

		setAcceptedOption(index)
		onUpdate(bullet)

		const changeCount = tailorContent ? wordDiff(tailorContent, bullet).filter(d => d.type === 'added').length : 0
		track('ai_tailor_accepted', {
			experience_id: experience?.id ?? '',
			changes_made: changeCount,
		})
		trackAiModalClosed(true)

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

		setTimeout(() => {
			resetState()
			onClose()
		}, 600)
	}

	const handleSave = () => {
		const selectedContent = selectedItems
			.sort((a, b) => a - b)
			.map(index => editValues[index] ?? displayOptions[index])

		if (activeTab === 'tailor') {
			onUpdate(selectedContent[0])

			const changeCount = tailorContent ? wordDiff(tailorContent, selectedContent[0]).filter(d => d.type === 'added').length : 0
			track('ai_tailor_accepted', {
				experience_id: experience?.id ?? '',
				changes_made: changeCount,
			})
			trackAiModalClosed(true)

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
			trackAiModalClosed(true)
		}

		resetState()
		onClose()
	}

	const handleClose = () => {
		if (tailorLogId && displayOptions.length > 0) {
			track('ai_tailor_rejected', {
				experience_id: experience?.id ?? '',
			})
			const formData = new FormData()
			formData.append('logId', tailorLogId)
			formData.append('action', 'abandoned')
			logActionFetcher.submit(formData, {
				method: 'POST',
				action: '/resources/tailor-log-action',
			})
		}
		trackAiModalClosed(false)
		resetState()
		onClose()
	}

	useEffect(() => {
		if (editingOption !== null && editTextareaRef.current) {
			editTextareaRef.current.focus()
			const len = editTextareaRef.current.value.length
			editTextareaRef.current.setSelectionRange(len, len)
		}
	}, [editingOption])

	if (!isOpen) return null

	// Shared button base style
	const btnOutline: React.CSSProperties = {
		display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
		borderRadius: 5, border: `1px solid ${c.border}`, background: 'transparent',
		color: c.muted, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
	}
	const btnPrimary: React.CSSProperties = {
		display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
		borderRadius: 5, border: 'none', background: BRAND, color: '#fff',
		fontSize: 12, fontWeight: 500, cursor: 'pointer',
	}

	return (
		<div style={{
			position: 'fixed', top: 48, right: 0, bottom: 0, width: 380, zIndex: 200,
			background: c.bgEl, borderLeft: `1px solid ${c.border}`,
			boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
			display: 'flex', flexDirection: 'column', overflow: 'hidden',
		}}>
			{/* Header */}
			<div style={{
				padding: '12px 16px', borderBottom: `1px solid ${c.border}`,
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<div style={{
						width: 28, height: 28, borderRadius: 6,
						background: `${BRAND}15`, border: `1px solid ${BRAND}25`,
						display: 'flex', alignItems: 'center', justifyContent: 'center',
					}}>
						<Sparkles size={14} color={BRAND} strokeWidth={1.75} />
					</div>
					<span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>
						Strengthen Bullet
					</span>
				</div>
				<button onClick={handleClose} style={{
					width: 28, height: 28, borderRadius: 6, border: 'none',
					background: 'transparent', cursor: 'pointer',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
				}}>
					<X size={16} color={c.dim} />
				</button>
			</div>

			{/* Tabs */}
			<div style={{ display: 'flex', borderBottom: `1px solid ${c.border}`, padding: '0 16px' }}>
				{(['tailor', 'generate'] as const).map(tab => (
					<button key={tab} onClick={() => { setActiveTab(tab); resetState() }} style={{
						padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
						color: activeTab === tab ? c.text : c.dim,
						background: 'transparent', border: 'none',
						borderBottom: activeTab === tab ? `2px solid ${BRAND}` : '2px solid transparent',
						textTransform: 'capitalize',
					}}>
						{tab}
					</button>
				))}
			</div>

			{/* Scrollable content */}
			<div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
				{/* Original bullet or keyword context */}
				<div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
					{!content && diagnosticContext?.missingKeywords?.length && activeTab === 'generate' ? (
						<>
							<div style={{ fontSize: 11, fontWeight: 600, color: c.dim, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
								Generate
							</div>
							<div style={{
								marginTop: 8, padding: '8px 12px', borderRadius: 6,
								background: `${BRAND}08`, border: `1px solid ${BRAND}20`,
							}}>
								<p style={{ fontSize: 13, lineHeight: 1.5, color: c.text, margin: 0 }}>
									Generate a new bullet for <span style={{ fontWeight: 600 }}>{experience?.role}{experience?.company ? ` at ${experience.company}` : ''}</span> incorporating: "<span style={{ color: BRAND, fontWeight: 600 }}>{diagnosticContext.missingKeywords[0]}</span>"
								</p>
							</div>
						</>
					) : (
						<>
							<div style={{ fontSize: 11, fontWeight: 600, color: c.dim, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								Original
								{activeTab === 'tailor' && (
									<button
										onClick={() => setShowBulletPicker(p => !p)}
										style={{ fontSize: 11, fontWeight: 500, color: BRAND, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
									>
										{showBulletPicker ? 'Cancel' : 'Change'}
									</button>
								)}
							</div>
							{showBulletPicker && activeTab === 'tailor' ? (
								<div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto', borderRadius: 6, border: `1px solid ${c.border}` }}>
									{[...(resumeData?.experiences ?? [])].sort((a, b) => a.id === tailorExperience?.id ? -1 : b.id === tailorExperience?.id ? 1 : 0).filter(exp => (exp.descriptions ?? []).some(d => d.content?.trim())).map(exp => (
										<div key={exp.id}>
											<div style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, color: c.dim, textTransform: 'uppercase', letterSpacing: '0.04em', background: c.bgSurf, borderBottom: `1px solid ${c.border}` }}>
												{exp.role}{exp.company ? ` · ${exp.company}` : ''}
											</div>
											{(exp.descriptions ?? []).filter(d => d.content?.trim()).map((desc, idx) => {
												const isSelected = desc.content === tailorContent && exp.id === tailorExperience?.id
												return (
													<div
														key={desc.id ?? idx}
														onClick={() => {
															if (!desc.content) return
															setTailorContent(desc.content)
															setTailorExperience(exp)
															setShowBulletPicker(false)
															resetState()
															onBulletChange?.(desc.content, exp, idx)
														}}
														style={{
															padding: '7px 10px', fontSize: 12, lineHeight: 1.45, cursor: 'pointer',
															color: isSelected ? BRAND : c.text,
															background: isSelected ? `${BRAND}08` : 'transparent',
															borderBottom: `1px solid ${c.borderSub}`,
														}}
														onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
														onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
													>
														{desc.content}
													</div>
												)
											})}
										</div>
									))}
								</div>
							) : (
								<div style={{
									marginTop: 8, padding: '8px 12px', borderRadius: 6,
									background: c.bgSurf, border: `1px solid ${c.borderSub}`,
								}}>
									<p style={{ fontSize: 13, lineHeight: 1.5, color: c.muted, fontStyle: 'italic', margin: 0 }}>
										"{tailorContent}"
									</p>
									{tailorExperience && tailorExperience.id !== experience?.id && (
										<p style={{ fontSize: 11, color: c.dim, margin: '4px 0 0' }}>
											{tailorExperience.role}{tailorExperience.company ? ` · ${tailorExperience.company}` : ''}
										</p>
									)}
								</div>
							)}
						</>
					)}
				</div>

				{/* Diagnostic context banner */}
				{diagnosticContext && (
					<div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
						<div style={{
							padding: '8px 12px', borderRadius: 6,
							background: diagnosticContext.issueType === 'no-metrics' ? `${WARN}12` : diagnosticContext.issueType === 'weak-verb' ? `${BRAND}12` : `${ERROR}12`,
							border: `1px solid ${diagnosticContext.issueType === 'no-metrics' ? `${WARN}30` : diagnosticContext.issueType === 'weak-verb' ? `${BRAND}30` : `${ERROR}30`}`,
							display: 'flex', alignItems: 'flex-start', gap: 8,
						}}>
							<Target size={14} color={diagnosticContext.issueType === 'no-metrics' ? WARN : diagnosticContext.issueType === 'weak-verb' ? BRAND : ERROR} strokeWidth={1.75} style={{ marginTop: 1, flexShrink: 0 }} />
							<span style={{ fontSize: 12, lineHeight: 1.4, color: c.text }}>
								{diagnosticContext.reason}
							</span>
						</div>
					</div>
				)}

				{/* Main results area */}
				<div style={{ padding: '8px 16px 16px', flex: 1 }}>
					{!job ? (
						<div style={{ padding: 16, borderRadius: 8, border: `1px solid ${c.border}` }}>
							<p style={{ fontSize: 13, color: c.muted, margin: 0 }}>
								Please select a job to get AI-powered suggestions.
							</p>
						</div>
					) : (
						<>
							{/* Action button */}
							{((!parsedTailorResponse && activeTab === 'tailor' && !isLoading) ||
							(!parsedGenerateOptions.length && activeTab === 'generate' && !isLoading)) && (
								<div style={{ padding: 16, borderRadius: 8, border: `1px solid ${c.border}` }}>
									{activeTab === 'tailor' && showBulletPicker && !tailorContent && (
										<p style={{ fontSize: 12, color: c.dim, textAlign: 'center', margin: '0 0 10px' }}>
											Select a bullet above to tailor
										</p>
									)}
									<button
										onClick={() => handleCompletion(activeTab)}
										disabled={isLoading || (activeTab === 'tailor' && showBulletPicker && !tailorContent)}
										data-tailor-achievement-button={activeTab === 'tailor' ? true : undefined}
										style={{
											...btnPrimary, width: '100%', justifyContent: 'center',
											padding: '10px 16px', fontSize: 13, gap: 8,
											opacity: isLoading || (activeTab === 'tailor' && showBulletPicker && !tailorContent) ? 0.45 : 1,
											cursor: isLoading || (activeTab === 'tailor' && showBulletPicker && !tailorContent) ? 'not-allowed' : 'pointer',
										}}
									>
										<Sparkles size={14} />
										{activeTab === 'tailor' ? 'Tailor Achievement' : 'Generate Achievements'}
									</button>
								</div>
							)}

							{/* Loading */}
							{isLoading && (
								<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
									<div style={{
										width: 32, height: 32, borderRadius: '50%',
										border: `2px solid ${BRAND}`, borderTopColor: 'transparent',
										animation: 'spin 1s linear infinite',
									}} />
									<p style={{ fontSize: 13, color: c.muted, margin: 0 }}>
										Generating {activeTab === 'tailor' ? '3 tailored alternatives' : 'achievements'}...
									</p>
									<style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
								</div>
							)}

							{/* Tailor results */}
							{activeTab === 'tailor' && parsedTailorResponse && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
									<div style={{ fontSize: 11, fontWeight: 600, color: c.dim, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
										3 tailored alternatives
									</div>

									{parsedTailorResponse.options.map((option, index) => {
										const meta = ANGLE_META[option.angle]
										const Icon = meta.icon
										const isExpanded = expandedOption === index
										const isDiffShown = showDiff[index] ?? false
										const isAccepted = acceptedOption === index
										const isEditing = editingOption === index
										const currentText = editValues[index] ?? option.bullet
										const diff = isDiffShown && tailorContent ? wordDiff(tailorContent, currentText) : null

										return (
											<div key={index} style={{
												borderRadius: 8, overflow: 'hidden', transition: 'all 150ms',
												border: `1px solid ${isAccepted ? `${SUCCESS}40` : isExpanded ? meta.borderColor : c.border}`,
												background: isAccepted ? `${SUCCESS}08` : isExpanded ? `${meta.color}06` : c.bgSurf,
											}}>
												{/* Header */}
												<div onClick={() => setExpandedOption(isExpanded ? null : index)} style={{
													display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer',
												}}>
													<div style={{
														width: 28, height: 28, borderRadius: 6, flexShrink: 0,
														background: meta.bgColor,
														display: 'flex', alignItems: 'center', justifyContent: 'center',
													}}>
														<Icon size={14} color={meta.color} strokeWidth={1.75} />
													</div>
													<div style={{ flex: 1, minWidth: 0 }}>
														<div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
															{meta.label}
														</div>
														{!isExpanded && (
															<p style={{
																fontSize: 12, color: c.dim, margin: '2px 0 0', overflow: 'hidden',
																textOverflow: 'ellipsis', whiteSpace: 'nowrap',
															}}>
																{highlightMetrics(currentText)}
															</p>
														)}
													</div>
													{isAccepted && (
														<span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: SUCCESS }}>
															<Check size={12} strokeWidth={2.5} /> Applied
														</span>
													)}
													<ChevronDownIcon style={{
														width: 14, height: 14, color: c.dim, flexShrink: 0,
														transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms',
													}} />
												</div>

												{/* Expanded body */}
												{isExpanded && (
													<div style={{ padding: '0 12px 12px', borderTop: `1px solid ${isAccepted ? `${SUCCESS}20` : c.borderSub}`, paddingTop: 12 }}>
														{/* Edit mode */}
														{isEditing ? (
															<div style={{ marginBottom: 10 }}>
																<textarea
																	ref={editTextareaRef}
																	value={currentText}
																	onChange={e => setEditValues(prev => ({ ...prev, [index]: e.target.value }))}
																	style={{
																		width: '100%', minHeight: 80, padding: '8px 10px',
																		borderRadius: 6, border: `1px solid ${meta.borderColor}`,
																		background: c.bg, color: c.text,
																		fontSize: 13, lineHeight: 1.55, fontFamily: 'inherit',
																		resize: 'none', outline: 'none', boxSizing: 'border-box',
																	}}
																/>
																<div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
																	<button onClick={() => setEditingOption(null)} style={{
																		...btnOutline, background: meta.bgColor, color: meta.color, borderColor: meta.borderColor,
																	}}>
																		<Check size={12} strokeWidth={2} /> Done Editing
																	</button>
																	<button onClick={() => {
																		setEditValues(prev => { const next = { ...prev }; delete next[index]; return next })
																		setEditingOption(null)
																	}} style={btnOutline}>
																		<X size={12} /> Discard
																	</button>
																</div>
															</div>
														) : diff ? (
															/* Diff view */
															<div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: c.bg, border: `1px solid ${c.borderSub}` }}>
																<p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 6px' }}>
																	{diff.filter(d => d.type !== 'removed').map((d, di) => (
																		<span key={di} style={{
																			marginRight: 4,
																			...(d.type === 'added' ? { color: SUCCESS, fontWeight: 500 } : { color: c.text }),
																		}}>
																			{d.text}
																		</span>
																	))}
																</p>
																{diff.filter(d => d.type === 'removed').length > 0 && (
																	<p style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
																		{diff.filter(d => d.type === 'removed').map((d, di) => (
																			<span key={di} style={{ marginRight: 4, color: ERROR, textDecoration: 'line-through' }}>
																				{d.text}
																			</span>
																		))}
																	</p>
																)}
															</div>
														) : (
															/* Normal text */
															<p style={{ fontSize: 13, lineHeight: 1.55, color: c.text, margin: '0 0 10px' }}>
																{highlightMetrics(currentText)}
															</p>
														)}

														{/* Rationale */}
														{!isEditing && (
															<p style={{ fontSize: 12, color: c.dim, fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px' }}>
																{meta.rationale}
															</p>
														)}

														{/* Action buttons */}
														{!isEditing && (
															<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
																<button onClick={() => handleAccept(index)} style={btnPrimary}>
																	<Check size={13} strokeWidth={2} /> Accept
																</button>
																<button onClick={() => {
																	if (!(index in editValues)) setEditValues(prev => ({ ...prev, [index]: option.bullet }))
																	setEditingOption(index)
																}} style={btnOutline}>
																	<Pencil size={11} /> Edit
																</button>
																<button onClick={() => setShowDiff(prev => ({ ...prev, [index]: !prev[index] }))} style={btnOutline}>
																	{isDiffShown ? 'Hide Changes' : 'See Changes'}
																</button>
																<button onClick={() => handleCompletion('tailor')} disabled={isLoading}
																	style={{ ...btnOutline, marginLeft: 'auto', opacity: isLoading ? 0.5 : 1 }}>
																	<RotateCcw size={11} /> Retry
																</button>
															</div>
														)}
													</div>
												)}
											</div>
										)
									})}

									{/* Flags */}
									{parsedTailorResponse.weak_bullet_flag && (
										<div style={{ padding: '8px 12px', borderRadius: 8, background: '#F5D90A08', border: '1px solid #F5D90A30' }}>
											<p style={{ fontSize: 13, color: '#b8960c', lineHeight: 1.5, margin: 0 }}>
												<span style={{ fontWeight: 600 }}>Suggestion: </span>
												{parsedTailorResponse.weak_bullet_flag}
											</p>
										</div>
									)}

									{parsedTailorResponse.coverage_gap_flag && (
										<div style={{ padding: '8px 12px', borderRadius: 8, background: `${ERROR}08`, border: `1px solid ${ERROR}25` }}>
											<p style={{ fontSize: 13, color: ERROR, lineHeight: 1.5, margin: 0 }}>
												<span style={{ fontWeight: 600 }}>Gap: </span>
												{parsedTailorResponse.coverage_gap_flag}
											</p>
										</div>
									)}

									{/* Keyword coverage */}
									{parsedTailorResponse.keyword_coverage_note && (
										<details style={{ borderRadius: 8, border: `1px solid ${c.border}`, padding: '8px 12px' }}>
											<summary style={{ fontSize: 13, fontWeight: 500, color: c.muted, cursor: 'pointer' }}>
												Keyword coverage
											</summary>
											<p style={{ fontSize: 13, color: c.muted, marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
												{parsedTailorResponse.keyword_coverage_note}
											</p>
										</details>
									)}
								</div>
							)}

							{/* Generate results */}
							{activeTab === 'generate' && parsedGenerateOptions.length > 0 && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
									{parsedGenerateOptions.map((option, index) => (
										<div key={index} onClick={() => handleItemSelect(index)} style={{
											padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
											border: `1px solid ${selectedItems.includes(index) ? BRAND : c.border}`,
											background: selectedItems.includes(index) ? `${BRAND}08` : c.bgSurf,
											position: 'relative', transition: 'all 150ms',
										}}>
											<p style={{ fontSize: 13, color: c.muted, margin: 0, paddingRight: 20, lineHeight: 1.5 }}>
												{highlightMetrics(option)}
											</p>
											{selectedItems.includes(index) && (
												<CheckIcon style={{ position: 'absolute', right: 10, top: 10, width: 16, height: 16, color: BRAND }} />
											)}
										</div>
									))}
								</div>
							)}

							{/* Empty state */}
							{!isLoading && !parsedTailorResponse && activeTab === 'tailor' && displayOptions.length === 0 && rawContent === '' && (
								<p style={{ fontSize: 13, color: c.dim, margin: 0 }}>
									Click "Tailor Achievement" to get AI-powered suggestions...
								</p>
							)}
							{!isLoading && activeTab === 'generate' && parsedGenerateOptions.length === 0 && rawContent === '' && (
								<p style={{ fontSize: 13, color: c.dim, margin: 0 }}>
									Click "Generate Achievements" to get AI-powered suggestions...
								</p>
							)}
						</>
					)}
				</div>
			</div>

			{/* Footer — generate tab with selections */}
			{activeTab === 'generate' && selectedItems.length > 0 && (
				<div style={{
					padding: '10px 16px', borderTop: `1px solid ${c.border}`, background: c.bgSurf,
					display: 'flex', gap: 8, flexShrink: 0,
				}}>
					<button onClick={handleClose} style={btnOutline}>Cancel</button>
					<button onClick={handleSave} style={btnPrimary}>
						Use {selectedItems.length} Selected
					</button>
				</div>
			)}
		</div>
	)
}
