import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from '@remix-run/react'
import { X, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import {
	type ResumeData,
	type BuilderExperienceDescription,
} from '~/utils/builder-resume.server.ts'
import type { TailorSuggestion } from '~/utils/openai.server.ts'

// ─── Types ───

type PanelStep = 'input' | 'loading' | 'preview' | 'error' | 'empty'

interface TailorPanelProps {
	open: boolean
	onClose: () => void
	formData: ResumeData
	onApply: (mergedData: ResumeData) => void
	theme: {
		bg: string
		bgEl: string
		bgSurf: string
		border: string
		borderSub: string
		text: string
		muted: string
		dim: string
		canvas: string
		white: string
		brandText: string
	}
}

interface Annotation {
	reason: string
	isGap: boolean
	gapRequirement?: string
}

interface MergeResult {
	mergedData: ResumeData
	annotations: Map<string, Annotation>
}

// ─── Merge Logic ───

function mergeSuggestions(
	formData: ResumeData,
	suggestions: TailorSuggestion[],
): MergeResult {
	const annotations = new Map<string, Annotation>()

	// Deep clone
	const merged = JSON.parse(JSON.stringify(formData)) as ResumeData

	for (const s of suggestions) {
		if (s.sectionType === 'summary' && !s.isGap) {
			annotations.set('about', {
				reason: s.reason,
				isGap: false,
			})
			merged.about = s.suggestedText
		} else if (s.sectionType === 'experience' && !s.isGap) {
			const expIdx = merged.experiences?.findIndex(
				e => e.id === s.experienceId,
			)
			if (expIdx !== undefined && expIdx >= 0 && merged.experiences) {
				const exp = merged.experiences[expIdx]
				if (
					s.bulletIndex !== undefined &&
					s.bulletIndex !== null &&
					exp.descriptions?.[s.bulletIndex]
				) {
					exp.descriptions[s.bulletIndex].content = s.suggestedText
					annotations.set(
						`experiences[${expIdx}].descriptions[${s.bulletIndex}].content`,
						{ reason: s.reason, isGap: false },
					)
				}
			}
		} else if (s.sectionType === 'skills' && !s.isGap) {
			// Skills are category groups (e.g., "Product: A/B Testing, Leadership, ...")
			// Each suggestion targets a specific skill line by skillIndex
			const idx = s.skillIndex ?? 0
			if (merged.skills && idx < merged.skills.length) {
				merged.skills[idx].name = s.suggestedText
				annotations.set(`skills[${idx}]`, {
					reason: s.reason,
					isGap: false,
				})
			}
		} else if (s.isGap && s.sectionType === 'experience') {
			// Find the target experience to add a gap bullet
			const targetId = s.targetExperienceId || merged.experiences?.[0]?.id
			const expIdx = merged.experiences?.findIndex(e => e.id === targetId)
			if (expIdx !== undefined && expIdx >= 0 && merged.experiences) {
				const exp = merged.experiences[expIdx]
				const newDesc: BuilderExperienceDescription = {
					id: crypto.randomUUID(),
					content: s.suggestedText,
					order: exp.descriptions?.length ?? 0,
				}
				if (!exp.descriptions) exp.descriptions = []
				exp.descriptions.push(newDesc)
				const bulletIdx = exp.descriptions.length - 1
				annotations.set(
					`experiences[${expIdx}].descriptions[${bulletIdx}].content`,
					{
						reason: s.reason,
						isGap: true,
						gapRequirement: s.gapRequirement,
					},
				)
			}
		} else if (s.isGap && s.sectionType === 'skills') {
			// Gap in skills — add a new skill category group line
			if (!merged.skills) merged.skills = []
			merged.skills.push({ id: crypto.randomUUID(), name: s.suggestedText })
			const newIdx = merged.skills.length - 1
			annotations.set(`skills[${newIdx}]`, {
				reason: s.reason,
				isGap: true,
				gapRequirement: s.gapRequirement,
			})
		} else if (s.isGap && s.sectionType === 'summary') {
			// Gap in summary — append to existing or create
			annotations.set('about', {
				reason: s.reason,
				isGap: true,
				gapRequirement: s.gapRequirement,
			})
			merged.about = s.suggestedText
		}
	}

	return { mergedData: merged, annotations }
}

// ─── Colors ───

const BRAND = '#6B45FF'
const CHANGE_BG_LIGHT = '#e8f5e9'
const CHANGE_BG_DARK = '#1a2e1a'
const GAP_BORDER_LIGHT = '#90caf9'
const GAP_BORDER_DARK = '#1565c0'

// ─── Loading messages ───

const LOADING_STAGES = [
	'Reading job description...',
	'Mapping your experience to requirements...',
	'Identifying translation opportunities...',
	'Generating suggestions...',
]

// ─── Component ───

export function TailorPanel({
	open,
	onClose,
	formData,
	onApply,
	theme: c,
}: TailorPanelProps) {
	const [step, setStep] = useState<PanelStep>('input')
	const [jobDescription, setJobDescription] = useState('')
	const [loadingStage, setLoadingStage] = useState(0)
	const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
	const [errorMsg, setErrorMsg] = useState('')
	const [suggestions, setSuggestions] = useState<TailorSuggestion[]>([])

	const fetcher = useFetcher<{
		suggestions?: TailorSuggestion[]
		error?: string
	}>()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const loadingIntervalRef = useRef<ReturnType<typeof setInterval>>()
	const isDark =
		c.bg === '#111113' || c.bg === '#09090b' || c.bgEl === '#18181B'

	// Pre-fill from linked job
	useEffect(() => {
		if (open && formData.job?.content && !jobDescription) {
			setJobDescription(formData.job.content)
		}
	}, [open, formData.job?.content])

	// Reset when closing
	useEffect(() => {
		if (!open) {
			// Delay reset so close animation can play
			const timeout = setTimeout(() => {
				setStep('input')
				setLoadingStage(0)
				setMergeResult(null)
				setErrorMsg('')
				setSuggestions([])
			}, 300)
			return () => clearTimeout(timeout)
		}
	}, [open])

	// Loading stage animation
	useEffect(() => {
		if (step === 'loading') {
			setLoadingStage(0)
			loadingIntervalRef.current = setInterval(() => {
				setLoadingStage(prev => {
					if (prev < LOADING_STAGES.length - 1) return prev + 1
					return prev
				})
			}, 2000)
			return () => clearInterval(loadingIntervalRef.current)
		}
		clearInterval(loadingIntervalRef.current)
	}, [step])

	// Handle fetcher response
	useEffect(() => {
		if (fetcher.state !== 'idle') return
		if (!fetcher.data) return

		if (fetcher.data.error) {
			setErrorMsg(fetcher.data.error)
			setStep('error')
			return
		}

		if (fetcher.data.suggestions) {
			const sug = fetcher.data.suggestions
			setSuggestions(sug)

			if (sug.length === 0) {
				setStep('empty')
				return
			}

			const result = mergeSuggestions(formData, sug)
			setMergeResult(result)
			setStep('preview')
		}
	}, [fetcher.state, fetcher.data, formData])

	const handleTailor = useCallback(() => {
		if (!jobDescription.trim()) return

		setStep('loading')
		const fd = new FormData()
		fd.append('resumeData', JSON.stringify(formData))
		fd.append('jobDescription', jobDescription)
		fetcher.submit(fd, {
			method: 'POST',
			action: '/resources/tailor-suggestions',
		})
	}, [jobDescription, formData, fetcher])

	const handleApply = useCallback(() => {
		if (!mergeResult) return
		onApply(mergeResult.mergedData)
	}, [mergeResult, onApply])

	if (!open) return null

	const changeBg = isDark ? CHANGE_BG_DARK : CHANGE_BG_LIGHT
	const gapBorder = isDark ? GAP_BORDER_DARK : GAP_BORDER_LIGHT

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 400,
				display: 'flex',
				justifyContent: 'flex-end',
			}}
		>
			{/* Backdrop */}
			<div
				onClick={onClose}
				style={{
					position: 'absolute',
					inset: 0,
					background: 'rgba(0,0,0,0.4)',
					backdropFilter: 'blur(4px)',
				}}
			/>

			{/* Panel */}
			<div
				style={{
					position: 'relative',
					width: 520,
					maxWidth: '95vw',
					background: c.bgEl,
					borderLeft: `1px solid ${c.border}`,
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
				}}
			>
				{/* Header */}
				<div
					style={{
						padding: '16px 20px',
						borderBottom: `1px solid ${c.border}`,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						flexShrink: 0,
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Sparkles size={16} color={c.brandText} strokeWidth={2} />
						<span
							style={{ fontSize: 15, fontWeight: 600, color: c.text }}
						>
							Tailor for this job
						</span>
					</div>
					<button
						onClick={onClose}
						style={{
							width: 28,
							height: 28,
							borderRadius: 5,
							border: 'none',
							background: 'transparent',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<X size={16} color={c.dim} />
					</button>
				</div>

				{/* Body */}
				<div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
					{step === 'input' && (
						<InputView
							c={c}
							jobDescription={jobDescription}
							setJobDescription={setJobDescription}
							onTailor={handleTailor}
							textareaRef={textareaRef}
							hasLinkedJob={!!formData.job?.content}
						/>
					)}

					{step === 'loading' && (
						<LoadingView c={c} stage={loadingStage} />
					)}

					{step === 'preview' && mergeResult && (
						<PreviewView
							c={c}
							isDark={isDark}
							original={formData}
							merged={mergeResult.mergedData}
							annotations={mergeResult.annotations}
							changeBg={changeBg}
							gapBorder={gapBorder}
							suggestionCount={suggestions.length}
						/>
					)}

					{step === 'error' && (
						<ErrorView c={c} message={errorMsg} onRetry={() => setStep('input')} />
					)}

					{step === 'empty' && (
						<EmptyView c={c} onClose={onClose} />
					)}
				</div>

				{/* Footer */}
				{step === 'preview' && (
					<div
						style={{
							padding: '16px 20px',
							borderTop: `1px solid ${c.border}`,
							display: 'flex',
							gap: 10,
							flexShrink: 0,
						}}
					>
						<button
							onClick={onClose}
							style={{
								flex: 1,
								padding: '10px 16px',
								borderRadius: 6,
								border: `1px solid ${c.border}`,
								background: 'transparent',
								color: c.text,
								fontSize: 13,
								fontWeight: 500,
								cursor: 'pointer',
							}}
						>
							Cancel
						</button>
						<button
							onClick={handleApply}
							style={{
								flex: 2,
								padding: '10px 16px',
								borderRadius: 6,
								border: 'none',
								background: BRAND,
								color: '#fff',
								fontSize: 13,
								fontWeight: 600,
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 6,
							}}
						>
							<Sparkles size={14} strokeWidth={2} />
							Apply {suggestions.length} change{suggestions.length !== 1 ? 's' : ''}
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

// ─── Sub-views ───

function InputView({
	c,
	jobDescription,
	setJobDescription,
	onTailor,
	textareaRef,
	hasLinkedJob,
}: {
	c: TailorPanelProps['theme']
	jobDescription: string
	setJobDescription: (v: string) => void
	onTailor: () => void
	textareaRef: React.RefObject<HTMLTextAreaElement>
	hasLinkedJob: boolean
}) {
	return (
		<div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
			<label
				style={{
					fontSize: 13,
					fontWeight: 500,
					color: c.text,
					marginBottom: 8,
					display: 'block',
				}}
			>
				Paste the job description
			</label>
			{hasLinkedJob && jobDescription && (
				<div
					style={{
						fontSize: 12,
						color: c.dim,
						marginBottom: 8,
						display: 'flex',
						alignItems: 'center',
						gap: 4,
					}}
				>
					Pre-filled from your linked job
				</div>
			)}
			<textarea
				ref={textareaRef}
				value={jobDescription}
				onChange={e => setJobDescription(e.target.value)}
				placeholder="Paste the full job posting here — title, requirements, responsibilities, qualifications..."
				style={{
					flex: 1,
					minHeight: 300,
					padding: 14,
					borderRadius: 8,
					border: `1px solid ${c.border}`,
					background: c.bgSurf,
					color: c.text,
					fontSize: 13,
					lineHeight: 1.6,
					resize: 'none',
					fontFamily: 'inherit',
					outline: 'none',
				}}
				onFocus={e => {
					e.currentTarget.style.borderColor = BRAND
				}}
				onBlur={e => {
					e.currentTarget.style.borderColor = c.border
				}}
			/>
			<button
				onClick={onTailor}
				disabled={!jobDescription.trim()}
				style={{
					marginTop: 14,
					padding: '12px 20px',
					borderRadius: 8,
					border: 'none',
					background: jobDescription.trim() ? BRAND : c.bgSurf,
					color: jobDescription.trim() ? '#fff' : c.dim,
					fontSize: 14,
					fontWeight: 600,
					cursor: jobDescription.trim() ? 'pointer' : 'not-allowed',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 8,
				}}
			>
				<Sparkles size={16} strokeWidth={2} />
				Tailor my resume
			</button>
		</div>
	)
}

function LoadingView({
	c,
	stage,
}: {
	c: TailorPanelProps['theme']
	stage: number
}) {
	return (
		<div
			style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: 40,
				gap: 24,
			}}
		>
			<Loader2
				size={32}
				color={c.brandText}
				strokeWidth={2}
				style={{ animation: 'spin 1s linear infinite' }}
			/>
			<div style={{ textAlign: 'center' }}>
				{LOADING_STAGES.map((msg, i) => (
					<div
						key={i}
						style={{
							fontSize: 14,
							color: i === stage ? c.text : i < stage ? c.dim : 'transparent',
							fontWeight: i === stage ? 500 : 400,
							transition: 'all 400ms',
							marginBottom: 6,
							height: i > stage + 1 ? 0 : 'auto',
							overflow: 'hidden',
						}}
					>
						{i < stage ? '\u2713 ' : ''}
						{msg}
					</div>
				))}
			</div>
			<style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
		</div>
	)
}

function PreviewView({
	c,
	isDark,
	original,
	merged,
	annotations,
	changeBg,
	gapBorder,
	suggestionCount,
}: {
	c: TailorPanelProps['theme']
	isDark: boolean
	original: ResumeData
	merged: ResumeData
	annotations: Map<string, Annotation>
	changeBg: string
	gapBorder: string
	suggestionCount: number
}) {
	const gapCount = Array.from(annotations.values()).filter(a => a.isGap).length
	const changeCount = suggestionCount - gapCount

	return (
		<div style={{ padding: 20, flex: 1 }}>
			{/* Summary line */}
			<div
				style={{
					marginBottom: 20,
					padding: '10px 14px',
					borderRadius: 8,
					background: `${BRAND}08`,
					border: `1px solid ${BRAND}20`,
					fontSize: 13,
					color: c.text,
					lineHeight: 1.5,
				}}
			>
				{changeCount > 0 && (
					<span>
						<strong>{changeCount}</strong> bullet{changeCount !== 1 ? 's' : ''} rewritten in the employer's language
					</span>
				)}
				{changeCount > 0 && gapCount > 0 && <span> · </span>}
				{gapCount > 0 && (
					<span>
						<strong>{gapCount}</strong> gap{gapCount !== 1 ? 's' : ''} addressed with new bullets
					</span>
				)}
			</div>

			{/* Summary section */}
			{merged.about && (
				<PreviewSection
					title="Summary"
					c={c}
				>
					{annotations.has('about') ? (
						<AnnotatedBlock
							text={merged.about}
							annotation={annotations.get('about')!}
							changeBg={changeBg}
							gapBorder={gapBorder}
							c={c}
						/>
					) : (
						<div style={{ fontSize: 13, color: c.muted, lineHeight: 1.6 }}>
							{merged.about}
						</div>
					)}
				</PreviewSection>
			)}

			{/* Experience sections */}
			{merged.experiences?.map((exp, expIdx) => {
				const hasChanges = Array.from(annotations.keys()).some(
					k => k.startsWith(`experiences[${expIdx}]`),
				)
				// Skip experiences with no changes for a cleaner view
				// Actually, show all to give context

				return (
					<PreviewSection
						key={exp.id || expIdx}
						title={
							[exp.role, exp.company].filter(Boolean).join(' at ') ||
							'Experience'
						}
						c={c}
					>
						{exp.descriptions?.map((desc, bulletIdx) => {
							const key = `experiences[${expIdx}].descriptions[${bulletIdx}].content`
							const annotation = annotations.get(key)
							const content = desc.content || ''

							if (!content.trim()) return null

							if (annotation) {
								return (
									<AnnotatedBlock
										key={desc.id || bulletIdx}
										text={content}
										annotation={annotation}
										changeBg={changeBg}
										gapBorder={gapBorder}
										c={c}
										isBullet
									/>
								)
							}

							return (
								<div
									key={desc.id || bulletIdx}
									style={{
										fontSize: 13,
										color: c.muted,
										lineHeight: 1.6,
										padding: '4px 0',
										paddingLeft: 16,
										position: 'relative',
									}}
								>
									<span
										style={{
											position: 'absolute',
											left: 0,
											top: 4,
											color: c.dim,
										}}
									>
										•
									</span>
									{content}
								</div>
							)
						})}
					</PreviewSection>
				)
			})}

			{/* Skills section */}
			{merged.skills?.length && Array.from(annotations.keys()).some(k => k.startsWith('skills[')) && (
				<PreviewSection title="Skills" c={c}>
					{merged.skills.map((skill, idx) => {
						const key = `skills[${idx}]`
						const annotation = annotations.get(key)
						const name = skill.name || ''
						if (!name.trim()) return null

						if (annotation) {
							return (
								<AnnotatedBlock
									key={idx}
									text={name}
									annotation={annotation}
									changeBg={changeBg}
									gapBorder={gapBorder}
									c={c}
								/>
							)
						}

						return (
							<div
								key={idx}
								style={{
									fontSize: 13,
									color: c.muted,
									lineHeight: 1.6,
									padding: '4px 0',
								}}
							>
								{name}
							</div>
						)
					})}
				</PreviewSection>
			)}
		</div>
	)
}

function PreviewSection({
	title,
	c,
	children,
}: {
	title: string
	c: TailorPanelProps['theme']
	children: React.ReactNode
}) {
	return (
		<div style={{ marginBottom: 20 }}>
			<div
				style={{
					fontSize: 11,
					fontWeight: 600,
					color: c.dim,
					textTransform: 'uppercase',
					letterSpacing: '0.04em',
					marginBottom: 8,
					paddingBottom: 6,
					borderBottom: `1px solid ${c.borderSub}`,
				}}
			>
				{title}
			</div>
			{children}
		</div>
	)
}

function AnnotatedBlock({
	text,
	annotation,
	changeBg,
	gapBorder,
	c,
	isBullet,
}: {
	text: string
	annotation: Annotation
	changeBg: string
	gapBorder: string
	c: TailorPanelProps['theme']
	isBullet?: boolean
}) {
	return (
		<div
			style={{
				marginBottom: 10,
				borderRadius: 6,
				overflow: 'hidden',
				border: annotation.isGap
					? `1.5px dashed ${gapBorder}`
					: `1px solid ${changeBg}`,
			}}
		>
			{/* The text */}
			<div
				style={{
					padding: '8px 12px',
					background: changeBg,
					fontSize: 13,
					color: c.text,
					lineHeight: 1.6,
					position: 'relative',
					paddingLeft: isBullet ? 26 : 12,
				}}
			>
				{isBullet && (
					<span
						style={{
							position: 'absolute',
							left: 12,
							top: 8,
							color: c.dim,
						}}
					>
						•
					</span>
				)}
				{annotation.isGap && (
					<span
						style={{
							display: 'inline-block',
							fontSize: 10,
							fontWeight: 700,
							color: gapBorder,
							background: `${gapBorder}18`,
							padding: '1px 6px',
							borderRadius: 3,
							marginRight: 6,
							verticalAlign: 'middle',
							letterSpacing: '0.04em',
						}}
					>
						NEW
					</span>
				)}
				{text}
			</div>

			{/* The reason — always visible */}
			<div
				style={{
					padding: '6px 12px',
					background: `${changeBg}80`,
					fontSize: 12,
					color: c.dim,
					lineHeight: 1.4,
					borderTop: `1px solid ${c.borderSub}`,
					fontStyle: 'italic',
				}}
			>
				{annotation.isGap && annotation.gapRequirement
					? `JD asks for "${annotation.gapRequirement}" — you don't have a bullet addressing this`
					: annotation.reason}
			</div>
		</div>
	)
}

function ErrorView({
	c,
	message,
	onRetry,
}: {
	c: TailorPanelProps['theme']
	message: string
	onRetry: () => void
}) {
	return (
		<div
			style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: 40,
				gap: 16,
				textAlign: 'center',
			}}
		>
			<AlertCircle size={32} color="#E5484D" strokeWidth={1.5} />
			<div style={{ fontSize: 14, color: c.text, fontWeight: 500 }}>
				{message}
			</div>
			<button
				onClick={onRetry}
				style={{
					padding: '8px 20px',
					borderRadius: 6,
					border: `1px solid ${c.border}`,
					background: 'transparent',
					color: c.text,
					fontSize: 13,
					cursor: 'pointer',
				}}
			>
				Try again
			</button>
		</div>
	)
}

function EmptyView({
	c,
	onClose,
}: {
	c: TailorPanelProps['theme']
	onClose: () => void
}) {
	return (
		<div
			style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: 40,
				gap: 16,
				textAlign: 'center',
			}}
		>
			<div
				style={{
					width: 48,
					height: 48,
					borderRadius: '50%',
					background: '#30A46C12',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Sparkles size={22} color="#30A46C" strokeWidth={2} />
			</div>
			<div style={{ fontSize: 15, color: c.text, fontWeight: 500 }}>
				Your resume already looks well-targeted
			</div>
			<div style={{ fontSize: 13, color: c.muted, maxWidth: 300, lineHeight: 1.5 }}>
				The AI didn't find meaningful changes to suggest for this job description. Your bullets already map well to the requirements.
			</div>
			<button
				onClick={onClose}
				style={{
					padding: '8px 20px',
					borderRadius: 6,
					border: `1px solid ${c.border}`,
					background: 'transparent',
					color: c.text,
					fontSize: 13,
					cursor: 'pointer',
					marginTop: 8,
				}}
			>
				Close
			</button>
		</div>
	)
}
