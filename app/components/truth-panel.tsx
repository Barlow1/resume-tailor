import { useEffect, useRef } from 'react'
import { useFetcher } from '@remix-run/react'
import { CheckCircle2, Circle } from 'lucide-react'
import type { ResumeData, BuilderJob } from '~/utils/builder-resume.server.ts'
import type { ExperienceMatch, BestMove } from '~/utils/ai/experience-match.server.ts'

const BRAND = '#6B45FF'
const SUCCESS = '#30A46C'
const WARN = '#F76B15'
const ERROR = '#E5484D'

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
	onScrollToSection?: (section: string) => void
	hasCoverLetter?: boolean
	hasTailored?: boolean
}

function getLevelColor(level: ExperienceMatch['level']): string {
	switch (level) {
		case 'strong':
			return SUCCESS
		case 'moderate':
			return BRAND
		case 'weak':
			return WARN
		case 'mismatch':
			return ERROR
	}
}

function getLevelLabel(level: ExperienceMatch['level']): string {
	switch (level) {
		case 'strong':
			return 'Strong match'
		case 'moderate':
			return 'Moderate match'
		case 'weak':
			return 'Weak match'
		case 'mismatch':
			return 'Mismatch'
	}
}

function getBorderColor(type: BestMove['type'], dim: string): string {
	switch (type) {
		case 'cover_letter':
			return BRAND
		case 'address_gap':
			return WARN
		case 'referral':
			return dim
		default:
			return BRAND
	}
}

function SkeletonBlock({ width, height, c }: { width: string | number; height: number; c: TruthPanelProps['theme'] }) {
	return (
		<div
			style={{
				width,
				height,
				borderRadius: 6,
				background: c.border,
				animation: 'pulse 1.5s ease-in-out infinite',
			}}
		/>
	)
}

export function TruthPanel({
	formData,
	selectedJob,
	theme: c,
	onGenerateCoverLetter,
	onScrollToSection,
	hasCoverLetter,
	hasTailored,
}: TruthPanelProps) {
	const fetcher = useFetcher<ExperienceMatch>()
	const prevJobIdRef = useRef<string | null>(null)

	useEffect(() => {
		if (!selectedJob?.id || !formData.id) return
		if (prevJobIdRef.current === selectedJob.id && fetcher.data) return
		prevJobIdRef.current = selectedJob.id

		fetcher.submit(
			JSON.stringify({ resumeId: formData.id, jobId: selectedJob.id }),
			{
				method: 'POST',
				action: '/resources/experience-match',
				encType: 'application/json',
			},
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedJob?.id, formData.id])

	const isLoading = fetcher.state !== 'idle'
	const isError = !isLoading && fetcher.data === undefined && fetcher.state === 'idle' && prevJobIdRef.current !== null && selectedJob !== null
	const match = fetcher.data as ExperienceMatch | undefined

	if (!selectedJob) {
		return (
			<div
				style={{
					padding: 32,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					textAlign: 'center',
					gap: 8,
				}}
			>
				<div style={{ fontSize: 15, fontWeight: 500, color: c.muted }}>
					Select a job to see your match analysis
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
				<style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
				<SkeletonBlock width="40%" height={14} c={c} />
				<SkeletonBlock width="70%" height={40} c={c} />
				<SkeletonBlock width="100%" height={16} c={c} />
				<SkeletonBlock width="90%" height={16} c={c} />
				<div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
					<SkeletonBlock width="100%" height={80} c={c} />
					<SkeletonBlock width="100%" height={80} c={c} />
				</div>
			</div>
		)
	}

	if (isError || !match) {
		return (
			<div
				style={{
					padding: 32,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					textAlign: 'center',
					gap: 12,
				}}
			>
				<div style={{ fontSize: 14, color: c.muted }}>
					Failed to load match analysis.
				</div>
				<button
					onClick={() => {
						if (!selectedJob?.id || !formData.id) return
						fetcher.submit(
							JSON.stringify({ resumeId: formData.id, jobId: selectedJob.id }),
							{
								method: 'POST',
								action: '/resources/experience-match',
								encType: 'application/json',
							},
						)
					}}
					style={{
						padding: '8px 16px',
						borderRadius: 8,
						border: `1px solid ${c.border}`,
						background: c.bgEl,
						color: c.text,
						fontSize: 13,
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					Retry
				</button>
			</div>
		)
	}

	const levelColor = getLevelColor(match.level)

	// Build task status checklist
	const tasks: { label: string; done: boolean }[] = [
		{ label: 'Resume uploaded', done: !!(formData.name || formData.role) },
		{ label: 'Target job selected', done: !!selectedJob },
		{ label: 'Tailored with AI', done: !!hasTailored },
		{ label: 'Cover letter', done: !!hasCoverLetter },
	]

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				padding: '32px 24px',
				gap: 0,
			}}
		>
			{/* Section 1: Experience Match */}
			<div>
				<div
					style={{
						fontSize: 11,
						fontWeight: 600,
						textTransform: 'uppercase',
						letterSpacing: '0.06em',
						color: c.dim,
					}}
				>
					Experience Match
				</div>
				<div
					style={{
						fontSize: 36,
						fontWeight: 800,
						fontFamily: 'Manrope, sans-serif',
						color: levelColor,
						marginTop: 8,
					}}
				>
					{getLevelLabel(match.level)}
				</div>
				<div
					style={{
						fontSize: 14,
						color: c.muted,
						marginTop: 8,
						lineHeight: 1.5,
					}}
				>
					{match.summary}
				</div>
				{match.requirementsTotal > 0 && (
					<div
						style={{
							fontSize: 12,
							color: c.dim,
							marginTop: 6,
						}}
					>
						{match.requirementsCovered} of {match.requirementsTotal} requirements covered
					</div>
				)}
			</div>

			{/* Section 2: Best Moves */}
			<div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
				<div
					style={{
						fontSize: 11,
						fontWeight: 600,
						textTransform: 'uppercase',
						letterSpacing: '0.06em',
						color: c.dim,
					}}
				>
					Best Moves
				</div>
				{match.bestMoves.map((move) => {
					const borderColor = getBorderColor(move.type, c.dim)
					return (
						<div
							key={move.id}
							style={{
								padding: 20,
								background: c.bgEl,
								borderRadius: 12,
								borderLeft: `4px solid ${borderColor}`,
							}}
						>
							<div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
								{move.headline}
							</div>
							<div
								style={{
									fontSize: 12,
									color: c.muted,
									lineHeight: 1.5,
									marginTop: 6,
								}}
							>
								{move.explanation}
							</div>
							{move.evidenceNote && (
								<div
									style={{
										fontSize: 11,
										color: c.dim,
										marginTop: 6,
										fontStyle: 'italic',
									}}
								>
									{move.evidenceNote}
								</div>
							)}
							{move.type === 'cover_letter' && !hasCoverLetter && (
								<button
									onClick={onGenerateCoverLetter}
									style={{
										marginTop: 12,
										background: BRAND,
										color: '#fff',
										fontSize: 12,
										fontWeight: 700,
										padding: '8px 16px',
										borderRadius: 8,
										border: 'none',
										cursor: 'pointer',
									}}
								>
									Generate with AI
								</button>
							)}
							{move.type === 'cover_letter' && hasCoverLetter && (
								<div
									style={{
										marginTop: 8,
										fontSize: 12,
										color: SUCCESS,
										fontWeight: 600,
										display: 'flex',
										alignItems: 'center',
										gap: 4,
									}}
								>
									<CheckCircle2 size={14} strokeWidth={2} /> Done
								</div>
							)}
							{move.type === 'referral' && (
								<button
									onClick={() => {
										/* could show a tooltip or detail */
									}}
									style={{
										marginTop: 8,
										background: 'none',
										border: 'none',
										color: c.brandText,
										fontSize: 12,
										fontWeight: 600,
										cursor: 'pointer',
										padding: 0,
										textDecoration: 'underline',
									}}
								>
									Why?
								</button>
							)}
							{move.type === 'rewrite_bullets' && onScrollToSection && (
								<button
									onClick={() => onScrollToSection('experience')}
									style={{
										marginTop: 8,
										background: 'none',
										border: 'none',
										color: c.brandText,
										fontSize: 12,
										fontWeight: 600,
										cursor: 'pointer',
										padding: 0,
										textDecoration: 'underline',
									}}
								>
									Go to experience
								</button>
							)}
						</div>
					)
				})}
			</div>

			{/* Section 3: Task Status */}
			<div
				style={{
					marginTop: 'auto',
					borderTop: `1px solid ${c.border}`,
					paddingTop: 32,
					background: c.bgSurf,
					marginLeft: -24,
					marginRight: -24,
					marginBottom: -32,
					padding: '32px 24px',
				}}
			>
				<div
					style={{
						fontSize: 11,
						fontWeight: 600,
						textTransform: 'uppercase',
						letterSpacing: '0.06em',
						color: c.dim,
						marginBottom: 14,
					}}
				>
					Task Status
				</div>
				{tasks.map((task) => (
					<div
						key={task.label}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 10,
							padding: '7px 0',
						}}
					>
						{task.done ? (
							<CheckCircle2 size={18} color={SUCCESS} strokeWidth={1.75} />
						) : (
							<Circle size={18} color={c.dim} strokeWidth={1.75} />
						)}
						<span
							style={{
								fontSize: 14,
								color: task.done ? c.muted : c.text,
								textDecoration: task.done ? 'line-through' : 'none',
							}}
						>
							{task.label}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
