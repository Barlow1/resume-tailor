import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from '@remix-run/react'
import { CheckCircle2, ChevronDown, Loader2 } from 'lucide-react'
import type { ResumeData, BuilderJob } from '~/utils/builder-resume.server.ts'
import type { ExperienceMatch, BestMove } from '~/utils/ai/experience-match.server.ts'
import type { GeneratedBullet } from '~/utils/openai.server.ts'
import { track } from '~/lib/analytics.client.ts'

const BRAND = '#6B45FF'
const SUCCESS = '#30A46C'
const WARN = '#F76B15'
const ERROR = '#E5484D'

export interface BulletChange {
	action: 'rewrite' | 'new'
	experienceId: string
	descriptionId: string
	content: string
	existingBulletId: string | null
	originalText: string | null
}

interface TruthPanelProps {
	formData: ResumeData
	selectedJob: BuilderJob | null
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
	onGenerateCoverLetter: () => void
	onMatchLoaded?: () => void
	onBulletsGenerated?: (changes: BulletChange[], gaps: string[], summary?: string | null) => void
	onUndoBullets?: () => void
	onSkipRole?: () => void
	onDownload?: () => void
	onNextJob?: () => void
	hasCoverLetter?: boolean
	refetchKey?: number
	resumeChanged?: boolean
	onRefreshMatch?: () => void
	/** When true, skip conversation and show summary-only verdict after re-analysis */
	postTailorMode?: boolean
}

type Layer = 'verdict' | 'conversation' | 'generating' | 'done' | 'analysis' | 'post-tailor-loading' | 'post-tailor-result'

function getLevelColor(level: ExperienceMatch['level']): string {
	switch (level) {
		case 'strong': return SUCCESS
		case 'moderate': return BRAND
		case 'weak': return WARN
		case 'mismatch': return ERROR
	}
}

function getLevelLabel(level: ExperienceMatch['level']): string {
	switch (level) {
		case 'strong': return 'Strong match'
		case 'moderate': return 'Moderate match'
		case 'weak': return 'Weak match'
		case 'mismatch': return 'Mismatch'
	}
}

function getBorderColor(type: BestMove['type'], dim: string): string {
	switch (type) {
		case 'cover_letter': return BRAND
		case 'address_gap': return WARN
		case 'rewrite_bullets': return BRAND
		case 'dont_apply': return ERROR
		case 'referral': return dim
		default: return BRAND
	}
}

function SkeletonBlock({ width, height, c }: { width: string | number; height: number; c: TruthPanelProps['theme'] }) {
	return <div style={{ width, height, borderRadius: 6, background: c.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
}

/* ═══ Conversation ═══ */
function ConversationLayer({
	requirements,
	experiences,
	c,
	onDone,
	onBack,
	resumeId,
	jobId,
}: {
	requirements: string[]
	experiences: Array<{ id: string; label: string }>
	c: TruthPanelProps['theme']
	onDone: (yesItems: Array<{ requirement: string; experienceId: string }>, noItems: string[]) => void
	onBack: () => void
	resumeId: string
	jobId: string
}) {
	const [answers, setAnswers] = useState<Map<number, { yes: boolean; experienceId?: string }>>(new Map())
	const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

	const markNo = (i: number) => {
		setAnswers(prev => { const next = new Map(prev); next.set(i, { yes: false }); return next })
		setExpandedIdx(null)
		track('match_requirement_answered', {
			resume_id: resumeId,
			job_id: jobId,
			answer: 'no',
			requirement_index: i,
			total_requirements: requirements.length,
		})
	}

	const markYes = (i: number, experienceId: string) => {
		setAnswers(prev => { const next = new Map(prev); next.set(i, { yes: true, experienceId }); return next })
		setExpandedIdx(null)
		track('match_requirement_answered', {
			resume_id: resumeId,
			job_id: jobId,
			answer: 'yes',
			requirement_index: i,
			total_requirements: requirements.length,
		})
	}

	const clear = (i: number) => {
		setAnswers(prev => { const next = new Map(prev); next.delete(i); return next })
	}

	const yesItems = requirements
		.map((req, i) => ({ req, ans: answers.get(i) }))
		.filter((x): x is { req: string; ans: { yes: true; experienceId: string } } => !!x.ans?.yes && !!x.ans.experienceId)
		.map(x => ({ requirement: x.req, experienceId: x.ans.experienceId }))
	// Unanswered questions are treated as "No" when proceeding
	const noItems = requirements.filter((_, i) => {
		const ans = answers.get(i)
		return !ans || ans.yes === false
	})
	const canProceed = yesItems.length > 0

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			{requirements.map((req, i) => {
				const ans = answers.get(i)
				const matchedExp = ans?.yes ? experiences.find(e => e.id === ans.experienceId) : null
				return (
					<div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div style={{ fontSize: 14, color: c.text, lineHeight: 1.5 }}>
							Do you have experience with <strong>{req}</strong>?
						</div>
						{!ans ? (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
								{expandedIdx === i ? (
									<>
										<div style={{ fontSize: 12, color: c.dim, marginBottom: 2 }}>Which role?</div>
										{experiences.map(exp => (
											<button
												key={exp.id}
												onClick={() => markYes(i, exp.id)}
												style={{
													padding: '8px 12px',
													borderRadius: 8,
													border: `1px solid ${c.border}`,
													background: c.bgSurf,
													color: c.text,
													fontSize: 13,
													cursor: 'pointer',
													textAlign: 'left',
												}}
											>
												Yes, at {exp.label}
											</button>
										))}
										<button
											onClick={() => setExpandedIdx(null)}
											style={{ background: 'none', border: 'none', color: c.dim, fontSize: 12, cursor: 'pointer', padding: 0 }}
										>
											Cancel
										</button>
									</>
								) : (
									<div style={{ display: 'flex', gap: 8 }}>
										<button
											onClick={() => {
												if (experiences.length === 0) return
												if (experiences.length === 1) {
													markYes(i, experiences[0].id)
												} else {
													setExpandedIdx(i)
												}
											}}
											style={{
												padding: '8px 16px',
												borderRadius: 8,
												border: `1px solid ${c.border}`,
												background: 'transparent',
												color: c.text,
												fontSize: 13,
												fontWeight: 600,
												cursor: 'pointer',
											}}
										>
											{experiences.length === 1 ? `Yes, at ${experiences[0].label}` : 'Yes'}
										</button>
										<button
											onClick={() => markNo(i)}
											style={{
												padding: '8px 16px',
												borderRadius: 8,
												border: `1px solid ${c.border}`,
												background: 'transparent',
												color: c.text,
												fontSize: 13,
												fontWeight: 600,
												cursor: 'pointer',
											}}
										>
											No
										</button>
									</div>
								)}
							</div>
						) : (
							<div style={{ fontSize: 13, fontWeight: 600, color: ans.yes ? SUCCESS : c.dim }}>
								{ans.yes ? `✓ Yes, at ${matchedExp?.label ?? ''}` : '— No'}
								<button
									onClick={() => clear(i)}
									style={{
										marginLeft: 8,
										background: 'none',
										border: 'none',
										color: c.dim,
										fontSize: 11,
										cursor: 'pointer',
										textDecoration: 'underline',
										padding: 0,
									}}
								>
									change
								</button>
							</div>
						)}
						{i < requirements.length - 1 && (
							<div style={{ borderBottom: `1px solid ${c.borderSub}`, marginTop: 4 }} />
						)}
					</div>
				)
			})}

			{canProceed && (
				<button
					onClick={() => onDone(yesItems, noItems)}
					style={{
						marginTop: 8,
						background: BRAND,
						color: '#fff',
						fontSize: 14,
						fontWeight: 700,
						padding: '12px 20px',
						borderRadius: 10,
						border: 'none',
						cursor: 'pointer',
						width: '100%',
					}}
				>
					Add {yesItems.length} to my resume →
				</button>
			)}
			{answers.size === requirements.length && yesItems.length === 0 && (
				<div style={{ fontSize: 13, color: c.dim, marginTop: 4 }}>
					These appear to be genuine gaps in your background for this role.
				</div>
			)}
			<button
				onClick={onBack}
				style={{ background: 'none', border: 'none', color: c.brandText, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 4 }}
			>
				← Back
			</button>
		</div>
	)
}

/* ═══ Full analysis ═══ */
function FullAnalysis({
	match, c, onGenerateCoverLetter, hasCoverLetter, resumeId, jobId,
}: {
	match: ExperienceMatch; c: TruthPanelProps['theme']; onGenerateCoverLetter: () => void; hasCoverLetter?: boolean; resumeId?: string | null; jobId?: string | null
}) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<div style={{ fontSize: 14, color: c.muted, lineHeight: 1.6 }}>{match.summary}</div>
			{match.requirementsTotal > 0 && (
				<div style={{ fontSize: 13, color: c.dim }}>
					{match.requirementsCovered} of {match.requirementsTotal} requirements covered
				</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				<div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.dim }}>
					All Recommendations
				</div>
				{match.bestMoves.map((move) => (
					<div key={move.id} style={{ padding: 16, background: c.bgEl, borderRadius: 10, borderLeft: `3px solid ${getBorderColor(move.type, c.dim)}` }}>
						<div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{move.headline}</div>
						<div style={{ fontSize: 13, color: c.muted, lineHeight: 1.5, marginTop: 4 }}>{move.explanation}</div>
						{move.evidenceNote && <div style={{ fontSize: 12, color: c.dim, marginTop: 4, fontStyle: 'italic' }}>{move.evidenceNote}</div>}
						{move.type === 'cover_letter' && !hasCoverLetter && (
							<button
								onClick={() => {
									if (resumeId && jobId) {
										track('best_move_clicked', {
											resume_id: resumeId,
											job_id: jobId,
											move_type: 'cover_letter',
											source: 'analysis',
										})
									}
									onGenerateCoverLetter()
								}}
								style={{ marginTop: 10, background: BRAND, color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
							>
								Generate with AI
							</button>
						)}
						{move.type === 'cover_letter' && hasCoverLetter && (
							<div style={{ marginTop: 6, fontSize: 13, color: SUCCESS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
								<CheckCircle2 size={14} strokeWidth={2} /> Done
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	)
}

/* ═══ MAIN ═══ */
export function TruthPanel({
	formData,
	selectedJob,
	theme: c,
	onGenerateCoverLetter,
	onMatchLoaded,
	onBulletsGenerated,
	onUndoBullets,
	onSkipRole,
	onDownload,
	onNextJob,
	hasCoverLetter,
	refetchKey,
	resumeChanged,
	onRefreshMatch,
	postTailorMode,
}: TruthPanelProps) {
	const fetcher = useFetcher<ExperienceMatch>()
	const bulletFetcher = useFetcher<{ bullets: GeneratedBullet[] }>()
	const prevJobIdRef = useRef<string | null>(null)
	const matchLoadedCalledRef = useRef(false)
	const hasAutoExpandedRef = useRef(false)
	const [layer, setLayer] = useState<Layer>('verdict')
	const [lastGaps, setLastGaps] = useState<string[]>([])
	const [lastAlreadyCovered, setLastAlreadyCovered] = useState<string[]>([])
	const [lastAddedCount, setLastAddedCount] = useState(0)
	const [lastWarnings, setLastWarnings] = useState<string[]>([])
	const conversationNoItemsRef = useRef<string[]>([])

	useEffect(() => {
		setLayer('verdict')
		setLastGaps([])
		setLastAlreadyCovered([])
		setLastAddedCount(0)
		setLastWarnings([])
		hasAutoExpandedRef.current = false
	}, [selectedJob?.id])

	useEffect(() => {
		if (!selectedJob?.id || !formData.id) return
		if (prevJobIdRef.current === selectedJob.id && fetcher.data) return
		prevJobIdRef.current = selectedJob.id
		matchLoadedCalledRef.current = false
		fetcher.submit(
			JSON.stringify({ resumeId: formData.id, jobId: selectedJob.id }),
			{ method: 'POST', action: '/resources/experience-match', encType: 'application/json' },
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedJob?.id, formData.id])

	// Capture the match state that existed just before a post-tailor refetch
	// so the server can compare old → new level and fire post_tailor_match_loaded.
	const previousMatchRef = useRef<{ level: ExperienceMatch['level']; covered: number } | null>(null)
	useEffect(() => {
		if (fetcher.data && !('error' in (fetcher.data as { error?: string }))) {
			const m = fetcher.data as ExperienceMatch
			previousMatchRef.current = {
				level: m.level,
				covered: m.requirementsCovered ?? 0,
			}
		}
	}, [fetcher.data])

	useEffect(() => {
		if (!refetchKey || !selectedJob?.id || !formData.id) return
		prevJobIdRef.current = null
		matchLoadedCalledRef.current = false
		fetcher.submit(
			JSON.stringify({
				resumeId: formData.id,
				jobId: selectedJob.id,
				isPostTailor: true,
				previousLevel: previousMatchRef.current?.level,
				previousCovered: previousMatchRef.current?.covered,
			}),
			{ method: 'POST', action: '/resources/experience-match', encType: 'application/json' },
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refetchKey])

	// Post-tailor: auto re-analyze after tailor changes are applied
	const postTailorTriggeredRef = useRef(false)
	const awaitingPostTailorRef = useRef(false)
	useEffect(() => {
		if (postTailorMode && !postTailorTriggeredRef.current && selectedJob?.id && formData.id) {
			postTailorTriggeredRef.current = true
			awaitingPostTailorRef.current = true
			setLayer('post-tailor-loading')
			prevJobIdRef.current = null
			fetcher.submit(
				JSON.stringify({ resumeId: formData.id, jobId: selectedJob.id }),
				{ method: 'POST', action: '/resources/experience-match', encType: 'application/json' },
			)
		}
		if (!postTailorMode) {
			postTailorTriggeredRef.current = false
		}
	}, [postTailorMode, selectedJob?.id, formData.id, fetcher])

	// Watch fetcher state transitions to detect when NEW data arrives
	const prevFetcherStateRef = useRef(fetcher.state)
	useEffect(() => {
		const wasLoading = prevFetcherStateRef.current !== 'idle'
		const isNowIdle = fetcher.state === 'idle'
		prevFetcherStateRef.current = fetcher.state

		// Only fire when transitioning from loading → idle (new data arrived)
		if (!wasLoading || !isNowIdle || !fetcher.data) return

		// Post-tailor: skip conversation, show result
		if (awaitingPostTailorRef.current) {
			awaitingPostTailorRef.current = false
			onMatchLoaded?.()
			setLayer('post-tailor-result')
			return
		}

		if (!matchLoadedCalledRef.current) {
			matchLoadedCalledRef.current = true
			onMatchLoaded?.()

			// Auto-expand into conversation if there are missing requirements to address
			const data = fetcher.data as ExperienceMatch & { error?: string } | undefined
			if (data && !('error' in data)) {
				const missing = data.missingRequirements ?? []
				if (missing.length > 0 && data.level !== 'mismatch' && !hasAutoExpandedRef.current) {
					hasAutoExpandedRef.current = true
					setLayer('conversation')
				}
			}
		}
	}, [fetcher.state, fetcher.data, onMatchLoaded])

	// When bullets arrive, convert and call parent
	const bulletDataProcessedRef = useRef<unknown>(null)
	useEffect(() => {
		if (bulletFetcher.state !== 'idle') return
		const data = bulletFetcher.data as { bullets?: GeneratedBullet[]; summary?: string | null; warnings?: string[]; error?: string } | undefined
		if (!data || data === bulletDataProcessedRef.current) return
		bulletDataProcessedRef.current = data

		if (data.error || !data.bullets) {
			console.error('Bullet generation failed:', data.error ?? 'No bullets in response')
			setLayer('verdict')
			return
		}

		const changes: BulletChange[] = []
		const alreadyCovered: string[] = []
		const apiGaps: string[] = []
		for (const b of data.bullets) {
			if (b.action === 'not_a_bullet') {
				alreadyCovered.push(b.requirement)
			} else if (b.isGap || !b.experienceId || !b.bulletText) {
				apiGaps.push(b.requirement)
			} else {
				changes.push({
					action: b.action as 'rewrite' | 'new',
					experienceId: b.experienceId,
					descriptionId: b.action === 'rewrite' && b.existingBulletId ? b.existingBulletId : crypto.randomUUID(),
					content: b.bulletText,
					existingBulletId: b.existingBulletId ?? null,
					originalText: b.originalText ?? null,
				})
			}
		}
		setLastAddedCount(changes.length)
		setLastAlreadyCovered(alreadyCovered)
		setLastWarnings(data.warnings ?? [])
		// Merge user's "No" answers with any API-reported gaps
		const allGaps = [...conversationNoItemsRef.current, ...apiGaps]
		setLastGaps(allGaps)
		onBulletsGenerated?.(changes, allGaps, data.summary)
		setLayer('done')
	}, [bulletFetcher.state, bulletFetcher.data]) // eslint-disable-line react-hooks/exhaustive-deps

	const handleConversationDone = useCallback((
		yesItems: Array<{ requirement: string; experienceId: string }>,
		noItems: string[],
	) => {
		if (!formData.id || !selectedJob?.id) return
		conversationNoItemsRef.current = noItems
		const total = yesItems.length + noItems.length
		track('match_conversation_proceeded', {
			resume_id: formData.id,
			job_id: selectedJob.id,
			yes_count: yesItems.length,
			no_count: noItems.length,
			total_requirements: total,
			fraction_answered: total > 0 ? 1 : 0,
			all_no: yesItems.length === 0,
		})
		bulletFetcher.submit(
			JSON.stringify({
				resumeId: formData.id,
				jobId: selectedJob.id,
				requirements: yesItems.map(y => y.requirement),
				requirementExperienceMap: Object.fromEntries(yesItems.map(y => [y.requirement, y.experienceId])),
				clientResume: {
					about: formData.about,
					experiences: (formData.experiences ?? []).map(e => ({
						id: e.id,
						role: e.role,
						company: e.company,
						startDate: e.startDate,
						endDate: e.endDate,
						descriptions: (e.descriptions ?? []).map(d => ({ id: d.id, content: d.content })),
					})),
					education: (formData.education ?? []).map(e => ({
						id: e.id,
						school: e.school,
						degree: e.degree,
						startDate: e.startDate,
						endDate: e.endDate,
						description: e.description,
					})),
					skills: (formData.skills ?? []).map(s => ({ id: s.id, name: s.name })),
				},
			}),
			{ method: 'POST', action: '/resources/generate-requirement-bullets', encType: 'application/json' },
		)
		setLayer('generating')
	}, [formData.id, selectedJob?.id, bulletFetcher])

	const isLoading = fetcher.state !== 'idle'
	const rawData = fetcher.data as (ExperienceMatch & { error?: string }) | undefined
	const isError = !isLoading && (!rawData || 'error' in rawData) && fetcher.state === 'idle' && prevJobIdRef.current !== null && selectedJob !== null
	const match = rawData && !('error' in rawData) ? rawData as ExperienceMatch : undefined

	/* ═══ Empty-state matrix ═══ */
	const hasContent = !!(
		(formData.about && formData.about.trim().length > 0) ||
		(formData.experiences ?? []).some(exp =>
			(exp.descriptions ?? []).some(d => d.content && d.content.trim().length > 0)
		)
	)
	const hasJob = !!selectedJob

	if (!hasContent || !hasJob) {
		const message = !hasContent && !hasJob
			? 'Add your experience and a target job to see your match analysis'
			: hasContent && !hasJob
				? 'Add a target job to see your match'
				: 'Add your experience to see your match'
		return (
			<div style={{
				padding: 32,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				height: '100%',
				textAlign: 'center',
			}}>
				<div style={{
					fontSize: 15,
					fontWeight: 500,
					color: c.muted,
					lineHeight: 1.6,
				}}>
					{message}
				</div>
			</div>
		)
	}

	/* ═══ Loading ═══ */
	if (isLoading) {
		return (
			<div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
				<style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
				<SkeletonBlock width="40%" height={14} c={c} />
				<SkeletonBlock width="70%" height={40} c={c} />
				<SkeletonBlock width="100%" height={16} c={c} />
				<div style={{ marginTop: 12 }}><SkeletonBlock width="80%" height={36} c={c} /></div>
				<div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>
					Analyzing your resume against this job...
				</div>
			</div>
		)
	}

	/* ═══ Error ═══ */
	if (isError || !match) {
		return (
			<div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 12 }}>
				<div style={{ fontSize: 15, color: c.muted }}>Failed to load match analysis.</div>
				<button
					onClick={() => {
						if (!selectedJob?.id || !formData.id) return
						fetcher.submit(
							JSON.stringify({ resumeId: formData.id, jobId: selectedJob.id }),
							{ method: 'POST', action: '/resources/experience-match', encType: 'application/json' },
						)
					}}
					style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgEl, color: c.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
				>
					Retry
				</button>
			</div>
		)
	}

	// #28-29: Resume changed banner
	const refreshBanner = resumeChanged && onRefreshMatch && !postTailorMode && layer !== 'post-tailor-loading' && layer !== 'post-tailor-result' ? (
		<div style={{
			padding: '10px 16px',
			background: '#FFF7ED',
			borderBottom: `1px solid ${c.border}`,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: 8,
		}}>
			<span style={{ fontSize: 13, color: '#9A3412', fontWeight: 500 }}>Resume changed since last analysis</span>
			<button
				onClick={onRefreshMatch}
				style={{
					padding: '5px 12px',
					borderRadius: 6,
					border: 'none',
					background: BRAND,
					color: '#fff',
					fontSize: 12,
					fontWeight: 600,
					cursor: 'pointer',
					whiteSpace: 'nowrap',
				}}
			>
				Refresh
			</button>
		</div>
	) : null

	const levelColor = getLevelColor(match.level)
	const coveredReqs = match.coveredRequirements ?? []
	const missingReqs = match.missingRequirements ?? []
	const experiences = (formData.experiences ?? [])
		.filter((e): e is typeof e & { id: string } => !!e.id)
		.map(e => ({ id: e.id, label: `${e.role} at ${e.company}` }))
	const hasMissingReqs = missingReqs.length > 0
	const isMismatch = match.level === 'mismatch'

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
			{refreshBanner}
			<div style={{ padding: '32px 28px', flex: 1 }}>
			{/* ═══ VERDICT ═══ */}
			<div>
				<div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.dim }}>
					Experience Match
				</div>
				<div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: levelColor, marginTop: 8 }}>
					{getLevelLabel(match.level)}
				</div>
				<div style={{ fontSize: 15, color: c.muted, marginTop: 12, lineHeight: 1.6 }}>
					{match.oneLineSummary || match.summary}
				</div>
			</div>

			{/* ═══ VERDICT actions ═══ */}
			{layer === 'verdict' && (
				<div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
					{coveredReqs.length > 0 && (
						<div style={{ fontSize: 13, color: SUCCESS, lineHeight: 1.5, marginBottom: 4 }}>
							Already on your resume: {coveredReqs.join(', ')}
						</div>
					)}
					{hasMissingReqs && !isMismatch && (
						<>
							<div style={{ fontSize: 14, color: c.muted, marginBottom: 4 }}>
								{missingReqs.length} thing{missingReqs.length > 1 ? 's' : ''} could strengthen this. Do you have experience with any of them?
							</div>
							<button
								onClick={() => {
									if (formData.id && selectedJob?.id) {
										track('match_conversation_started', {
											resume_id: formData.id,
											job_id: selectedJob.id,
											match_level: match.level,
											missing_count: missingReqs.length,
										})
									}
									setLayer('conversation')
								}}
								style={{ background: BRAND, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%' }}
							>
								Let's find out →
							</button>
						</>
					)}
					{match.level === 'strong' && (
						<button
							onClick={() => {
								if (formData.id && selectedJob?.id) {
									track('best_move_clicked', {
										resume_id: formData.id,
										job_id: selectedJob.id,
										move_type: 'cover_letter',
										source: 'verdict',
									})
								}
								onGenerateCoverLetter()
							}}
							style={{ background: BRAND, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%' }}
						>
							{hasCoverLetter ? 'Regenerate cover letter' : 'Write a cover letter →'}
						</button>
					)}
					<button
						onClick={() => {
							track('match_conversation_skipped', {
								resume_id: formData.id ?? undefined,
								job_id: selectedJob?.id ?? undefined,
								match_level: match.level,
							})
							onSkipRole?.()
						}}
						style={{ background: 'none', color: c.dim, fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 10, border: `1px solid ${c.border}`, cursor: 'pointer', width: '100%' }}
					>
						Skip{selectedJob?.company ? ` ${selectedJob.company}` : ' this role'}
					</button>
					{match.skipSuggestion && isMismatch && (
						<div style={{ fontSize: 13, color: c.dim, marginTop: 4, lineHeight: 1.5 }}>
							{match.skipSuggestion}
						</div>
					)}
					{onUndoBullets && (
						<button
							onClick={() => {
								if (formData.id) {
									track('tailor_undone', {
										resume_id: formData.id,
										job_id: selectedJob?.id ?? undefined,
										source: 'full_snapshot',
									})
								}
								onUndoBullets()
							}}
							style={{ background: 'none', border: 'none', color: c.dim, fontSize: 13, cursor: 'pointer', padding: 0, marginTop: 8, textDecoration: 'underline' }}
						>
							Undo last changes
						</button>
					)}
				</div>
			)}

			{/* ═══ CONVERSATION ═══ */}
			{layer === 'conversation' && formData.id && selectedJob?.id && (
				<div style={{ marginTop: 24 }}>
					<ConversationLayer
						requirements={missingReqs}
						experiences={experiences}
						c={c}
						onDone={handleConversationDone}
						onBack={() => setLayer('verdict')}
						resumeId={formData.id}
						jobId={selectedJob.id}
					/>
				</div>
			)}

			{/* ═══ GENERATING ═══ */}
			{layer === 'generating' && (
				<div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
					<style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
					{bulletFetcher.state !== 'idle' ? (
						<>
							<Loader2 size={24} color={BRAND} style={{ animation: 'spin 1s linear infinite' }} />
							<div style={{ fontSize: 15, color: c.muted, textAlign: 'center' }}>Updating your resume...</div>
						</>
					) : (
						<>
							<div style={{ fontSize: 15, color: ERROR, textAlign: 'center' }}>Something went wrong generating bullets.</div>
							<button
								onClick={() => setLayer('conversation')}
								style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgEl, color: c.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
							>
								Try again
							</button>
						</>
					)}
				</div>
			)}

			{/* ═══ DONE — post-generation ═══ */}
			{layer === 'done' && (
				<div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
					{lastAddedCount > 0 && (
						<div style={{ fontSize: 15, color: c.muted, lineHeight: 1.6 }}>
							Updated {lastAddedCount} bullet{lastAddedCount > 1 ? 's' : ''}. Check the highlights on your resume.
						</div>
					)}
					{lastAlreadyCovered.length > 0 && (
						<div style={{ fontSize: 13, color: SUCCESS, lineHeight: 1.5 }}>
							Already on your resume: {lastAlreadyCovered.join(', ')}
						</div>
					)}
					{lastGaps.length > 0 && (
						<div style={{ fontSize: 13, color: c.dim, lineHeight: 1.5 }}>
							Not added: {lastGaps.join(', ')} — {lastGaps.length > 1 ? 'genuine gaps' : 'a genuine gap'}.
						</div>
					)}
					{lastWarnings.length > 0 && lastWarnings.map((w, i) => (
						<div key={i} style={{ fontSize: 13, color: WARN, lineHeight: 1.5 }}>
							{w}
						</div>
					))}

					{/* Next steps */}
					<div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
						{!hasCoverLetter && (
							<button
								onClick={() => {
									if (formData.id && selectedJob?.id) {
										track('best_move_clicked', {
											resume_id: formData.id,
											job_id: selectedJob.id,
											move_type: 'cover_letter',
											source: 'done',
										})
									}
									onGenerateCoverLetter()
								}}
								style={{ background: BRAND, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%' }}
							>
								Write a cover letter →
							</button>
						)}
						<button
							onClick={onDownload}
							style={{
								background: hasCoverLetter ? BRAND : 'transparent',
								color: hasCoverLetter ? '#fff' : c.text,
								fontSize: 14,
								fontWeight: 700,
								padding: '12px 20px',
								borderRadius: 10,
								border: hasCoverLetter ? 'none' : `1px solid ${c.border}`,
								cursor: 'pointer',
								width: '100%',
							}}
						>
							Download
						</button>
						{!hasCoverLetter && (
							<button
								onClick={onDownload}
								style={{ background: 'none', border: 'none', color: c.dim, fontSize: 13, cursor: 'pointer', padding: 0 }}
							>
								Skip cover letter, just download
							</button>
						)}
						<button
							onClick={onNextJob}
							style={{ background: 'none', border: `1px solid ${c.border}`, color: c.muted, fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 10, cursor: 'pointer', width: '100%', marginTop: 4 }}
						>
							Next job →
						</button>
					</div>

					{onUndoBullets && (
						<button
							onClick={() => {
								if (formData.id) {
									track('tailor_undone', {
										resume_id: formData.id,
										job_id: selectedJob?.id ?? undefined,
										source: 'full_snapshot',
									})
								}
								onUndoBullets()
							}}
							style={{ background: 'none', border: 'none', color: c.dim, fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 4 }}
						>
							Undo all changes
						</button>
					)}
				</div>
			)}

			{/* ═══ FULL ANALYSIS ═══ */}
			{layer === 'analysis' && (
				<div style={{ marginTop: 24 }}>
					<FullAnalysis match={match} c={c} onGenerateCoverLetter={onGenerateCoverLetter} hasCoverLetter={hasCoverLetter} resumeId={formData.id} jobId={selectedJob?.id} />
					<button
						onClick={() => setLayer('verdict')}
						style={{ background: 'none', border: 'none', color: c.brandText, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 16 }}
					>
						← Back
					</button>
				</div>
			)}

			{/* ═══ POST-TAILOR LOADING ═══ */}
			{layer === 'post-tailor-loading' && (
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
					<Loader2 size={24} color={BRAND} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
					<style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
					<div style={{ fontSize: 14, color: c.muted, fontWeight: 500 }}>Updating your match score...</div>
				</div>
			)}

			{/* ═══ POST-TAILOR RESULT ═══ */}
			{layer === 'post-tailor-result' && match && (
				<div style={{ marginTop: 20 }}>
					<div style={{
						padding: '16px 20px',
						borderRadius: 10,
						background: getLevelColor(match.level) + '10',
						border: `1px solid ${getLevelColor(match.level)}30`,
					}}>
						<div style={{ fontSize: 28, fontWeight: 800, color: getLevelColor(match.level), fontFamily: 'Manrope, sans-serif' }}>
							{match.level.charAt(0).toUpperCase() + match.level.slice(1)}
						</div>
						<div style={{ fontSize: 14, color: c.text, lineHeight: 1.6, marginTop: 8 }}>
							{match.oneLineSummary || match.summary}
						</div>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
						{!hasCoverLetter && (
							<button
								onClick={onGenerateCoverLetter}
								style={{
									padding: '10px 16px',
									borderRadius: 8,
									border: 'none',
									background: BRAND,
									color: '#fff',
									fontSize: 14,
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								Write a cover letter
							</button>
						)}
						<button
							onClick={onDownload}
							style={{
								padding: '10px 16px',
								borderRadius: 8,
								border: `1px solid ${c.border}`,
								background: hasCoverLetter ? BRAND : c.bgEl,
								color: hasCoverLetter ? '#fff' : c.text,
								fontSize: 14,
								fontWeight: 600,
								cursor: 'pointer',
							}}
						>
							Download
						</button>
					</div>
				</div>
			)}

			{/* ═══ Footer ═══ */}
			{layer !== 'analysis' && layer !== 'generating' && layer !== 'post-tailor-loading' && layer !== 'post-tailor-result' && (
				<div style={{ marginTop: 'auto', paddingTop: 24 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<button
							onClick={() => setLayer('analysis')}
							style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: c.dim, fontSize: 13, cursor: 'pointer', padding: 0 }}
						>
							See full analysis <ChevronDown size={12} />
						</button>
						{lastAddedCount > 0 && (
							<span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
								<CheckCircle2 size={12} strokeWidth={2} /> {lastAddedCount} change{lastAddedCount > 1 ? 's' : ''} applied
							</span>
						)}
					</div>
				</div>
			)}
		</div>
		</div>
	)
}
