import { useState, useEffect, useRef } from 'react'
import {
	ArrowLeft,
	Sparkles,
	AlertTriangle,
	Check,
	X,
	Undo2,
	Zap,
	Loader2,
	Plus,
} from 'lucide-react'
import { type ResumeData, type BuilderJob } from '~/utils/builder-resume.server.ts'

/* ═══ TYPES ═══ */

export type TailorFlowStep = 'idle' | 'translation-map' | 'guided-tailoring'

export interface Requirement {
	id: string
	category: string
	requirement: string
	matchType: 'strong' | 'partial' | 'gap'
	matchedBullet: string | null
	matchedExpId: string | null
	matchSource: string | null
}

export interface TailoringChange {
	id: string
	section: 'Summary' | 'Experience' | 'Skills'
	targetExpId: string | null
	targetBulletIndex: number | null
	original: string | null
	reason: string
	suggested: string
	isAddition?: boolean
	status: 'pending' | 'accepted' | 'skipped'
}

export interface TailorFlowData {
	requirements: Requirement[]
	changes: TailoringChange[] | null // null while changes are still loading
	jobTitle: string
	company: string
	matchScore: number
}

/* ═══ DESIGN TOKENS (local to overlay) ═══ */

const STRONG = '#30A46C'
const PARTIAL = '#F76B15'
const GAP = '#E5484D'

const matchColor = (t: 'strong' | 'partial' | 'gap') =>
	t === 'strong' ? STRONG : t === 'partial' ? PARTIAL : GAP
const matchLabel = (t: 'strong' | 'partial' | 'gap') =>
	t === 'strong' ? 'Strong' : t === 'partial' ? 'Partial' : 'Gap'

/* ═══ THEME TYPE (mirrors builder) ═══ */

type Theme = {
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

/* ═══ PROPS ═══ */

interface TailorOverlayProps {
	step: TailorFlowStep
	data: TailorFlowData | null
	error: string | null
	formData: ResumeData
	selectedJob: BuilderJob | null | undefined
	c: Theme
	brand: string
	onStartTailor: () => void
	onBack: () => void
	onRetry: () => void
	onApplyChanges: (changes: TailoringChange[]) => void
	onSetStep: (step: TailorFlowStep) => void
}

/* ═══ LOADING SCREEN ═══ */

const STAGES = [
	'Reading job description...',
	'Extracting requirements...',
	'Mapping your experience...',
	'Generating tailored rewrites...',
	'Finalizing...',
]

function LoadingScreen({ c, brand }: { c: Theme; brand: string }) {
	const [stageIdx, setStageIdx] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setStageIdx(prev => (prev < STAGES.length - 1 ? prev + 1 : prev))
		}, 3000)
		return () => clearInterval(interval)
	}, [])

	const dotCount = 4
	const activeDots = Math.min(stageIdx, dotCount - 1)

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 20,
				background: c.bg,
				zIndex: 20,
			}}
		>
			<Loader2
				size={32}
				color={brand}
				strokeWidth={2}
				style={{ animation: 'spin 1s linear infinite' }}
			/>
			<div style={{ fontSize: 18, fontWeight: 600, color: c.text }}>
				Analyzing your fit
			</div>
			<div style={{ fontSize: 14, color: c.muted, minHeight: 20 }}>
				{STAGES[stageIdx]}
			</div>
			<div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
				{Array.from({ length: dotCount }).map((_, i) => (
					<div
						key={i}
						style={{
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: i <= activeDots ? brand : c.border,
							transition: 'background 0.3s',
							animation:
								stageIdx >= STAGES.length - 1 && i === dotCount - 1
									? 'pulse 1.5s ease-in-out infinite'
									: undefined,
						}}
					/>
				))}
			</div>
			<style>{`
				@keyframes spin { to { transform: rotate(360deg) } }
				@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
			`}</style>
		</div>
	)
}

/* ═══ SCORE RING ═══ */

function ScoreRing({
	score,
	brand,
	c,
}: {
	score: number
	brand: string
	c: Theme
}) {
	const r = 28
	const circ = 2 * Math.PI * r
	const offset = circ - (score / 100) * circ
	return (
		<svg width={72} height={72} viewBox="0 0 72 72">
			<circle
				cx={36}
				cy={36}
				r={r}
				fill="none"
				stroke={c.border}
				strokeWidth={5}
			/>
			<circle
				cx={36}
				cy={36}
				r={r}
				fill="none"
				stroke={brand}
				strokeWidth={5}
				strokeLinecap="round"
				strokeDasharray={circ}
				strokeDashoffset={offset}
				transform="rotate(-90 36 36)"
				style={{ transition: 'stroke-dashoffset 0.8s ease' }}
			/>
			<text
				x={36}
				y={36}
				textAnchor="middle"
				dominantBaseline="central"
				fontSize={16}
				fontWeight={700}
				fill={c.text}
			>
				{score}
			</text>
		</svg>
	)
}

/* ═══ TRANSLATION MAP ═══ */

function TranslationMap({
	data,
	c,
	brand,
	onBack,
	onContinue,
}: {
	data: TailorFlowData
	c: Theme
	brand: string
	onBack: () => void
	onContinue: () => void
}) {
	const grouped = data.requirements.reduce(
		(acc, r) => {
			const cat = r.category.toUpperCase()
			if (!acc[cat]) acc[cat] = []
			acc[cat].push(r)
			return acc
		},
		{} as Record<string, Requirement[]>,
	)

	const strong = data.requirements.filter(r => r.matchType === 'strong').length
	const partial = data.requirements.filter(
		r => r.matchType === 'partial',
	).length
	const gaps = data.requirements.filter(r => r.matchType === 'gap').length

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				display: 'flex',
				flexDirection: 'column',
				background: c.bg,
				zIndex: 20,
				overflow: 'hidden',
			}}
		>
			{/* Scrollable content */}
			<div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 100px' }}>
				{/* Back link */}
				<button
					onClick={onBack}
					style={{
						background: 'none',
						border: 'none',
						color: c.muted,
						fontSize: 13,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: 4,
						padding: 0,
						marginBottom: 20,
					}}
				>
					<ArrowLeft size={14} strokeWidth={1.75} />
					Back to builder
				</button>

				{/* Header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 20,
						marginBottom: 24,
					}}
				>
					<ScoreRing score={data.matchScore} brand={brand} c={c} />
					<div>
						<div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>
							Translation Map
						</div>
						<div
							style={{
								fontSize: 14,
								color: c.muted,
								marginTop: 2,
								lineHeight: 1.4,
							}}
						>
							How your resume maps to{' '}
							{data.company ? `${data.company}'s` : 'the'} requirements
						</div>
						<div
							style={{
								display: 'flex',
								gap: 12,
								marginTop: 8,
								fontSize: 12,
								fontWeight: 500,
							}}
						>
							<span style={{ color: STRONG }}>
								{strong} strong
							</span>
							<span style={{ color: PARTIAL }}>
								{partial} partial
							</span>
							<span style={{ color: GAP }}>
								{gaps} gap{gaps !== 1 ? 's' : ''}
							</span>
						</div>
					</div>
				</div>

				{/* Requirement groups */}
				{Object.entries(grouped).map(([category, reqs]) => (
					<div key={category} style={{ marginBottom: 24 }}>
						<div
							style={{
								fontSize: 11,
								fontWeight: 700,
								color: c.dim,
								textTransform: 'uppercase',
								letterSpacing: '0.06em',
								marginBottom: 10,
							}}
						>
							{category}
						</div>
						{reqs.map((req, i) => (
							<div
								key={req.id}
								style={{
									padding: '12px 14px',
									borderRadius: 7,
									border: `1px solid ${c.border}`,
									background: c.bgEl,
									marginBottom: 8,
									animation: `fadeSlideIn 0.3s ease ${i * 70}ms both`,
								}}
							>
								<div
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										justifyContent: 'space-between',
										gap: 10,
									}}
								>
									<div
										style={{
											fontSize: 14,
											color: c.text,
											lineHeight: 1.45,
											flex: 1,
										}}
									>
										{req.requirement}
									</div>
									<span
										style={{
											fontSize: 11,
											fontWeight: 600,
											color: matchColor(req.matchType),
											padding: '2px 8px',
											borderRadius: 4,
											background: `${matchColor(req.matchType)}14`,
											whiteSpace: 'nowrap',
											flexShrink: 0,
										}}
									>
										{matchLabel(req.matchType)}
									</span>
								</div>
								{req.matchedBullet && (
									<div style={{ marginTop: 8 }}>
										<div
											style={{
												fontSize: 12,
												color: c.dim,
												marginBottom: 3,
											}}
										>
											{req.matchSource || 'Matched bullet'}
										</div>
										<div
											style={{
												fontSize: 13,
												color: c.muted,
												lineHeight: 1.4,
												fontStyle: 'italic',
												paddingLeft: 8,
												borderLeft: `2px solid ${c.border}`,
											}}
										>
											{req.matchedBullet}
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				))}
			</div>

			{/* Sticky CTA */}
			<div
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					padding: '16px 28px',
					background: `linear-gradient(transparent, ${c.bg} 30%)`,
					paddingTop: 40,
				}}
			>
				{data.changes === null ? (
					<button
						disabled
						style={{
							width: '100%',
							padding: '12px 20px',
							borderRadius: 8,
							border: 'none',
							background: c.border,
							color: c.muted,
							fontSize: 15,
							fontWeight: 600,
							cursor: 'default',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 8,
						}}
					>
						<Loader2
							size={16}
							strokeWidth={2}
							style={{ animation: 'spin 1s linear infinite' }}
						/>
						Generating rewrites...
					</button>
				) : (
					<button
						onClick={onContinue}
						style={{
							width: '100%',
							padding: '12px 20px',
							borderRadius: 8,
							border: 'none',
							background: brand,
							color: '#fff',
							fontSize: 15,
							fontWeight: 600,
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 8,
						}}
					>
						<Sparkles size={16} strokeWidth={2} />
						Tailor My Resume ({data.changes.length} change
						{data.changes.length !== 1 ? 's' : ''})
					</button>
				)}
			</div>

			<style>{`
				@keyframes fadeSlideIn {
					from { opacity: 0; transform: translateY(6px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes spin { to { transform: rotate(360deg) } }
			`}</style>
		</div>
	)
}

/* ═══ GUIDED TAILORING ═══ */

function GuidedTailoring({
	data,
	c,
	brand,
	onBackToMap,
	onApplyChanges,
}: {
	data: TailorFlowData
	c: Theme
	brand: string
	onBackToMap: () => void
	onApplyChanges: (changes: TailoringChange[]) => void
}) {
	// Copy initialChanges into local state on mount.
	// NOTE: This won't update if parent re-renders with new data
	// (relevant for future streaming support).
	const [changes, setChanges] = useState<TailoringChange[]>(() =>
		(data.changes ?? []).map(ch => ({ ...ch })),
	)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')
	const editRef = useRef<HTMLTextAreaElement>(null!)

	const accepted = changes.filter(ch => ch.status === 'accepted').length
	const skipped = changes.filter(ch => ch.status === 'skipped').length
	const pending = changes.filter(ch => ch.status === 'pending').length

	const updateChange = (id: string, status: TailoringChange['status']) => {
		setChanges(prev =>
			prev.map(ch => (ch.id === id ? { ...ch, status } : ch)),
		)
	}

	const updateSuggested = (id: string, text: string) => {
		setChanges(prev =>
			prev.map(ch =>
				ch.id === id ? { ...ch, suggested: text, status: 'accepted' } : ch,
			),
		)
		setEditingId(null)
	}

	const acceptAll = () => {
		setChanges(prev =>
			prev.map(ch =>
				ch.status === 'pending' ? { ...ch, status: 'accepted' } : ch,
			),
		)
	}

	const startEdit = (ch: TailoringChange) => {
		setEditingId(ch.id)
		setEditValue(ch.suggested)
		setTimeout(() => editRef.current?.focus(), 50)
	}

	const grouped = changes.reduce(
		(acc, ch) => {
			if (!acc[ch.section]) acc[ch.section] = []
			acc[ch.section].push(ch)
			return acc
		},
		{} as Record<string, TailoringChange[]>,
	)

	const sectionOrder: TailoringChange['section'][] = [
		'Summary',
		'Experience',
		'Skills',
	]

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				display: 'flex',
				flexDirection: 'column',
				background: c.bg,
				zIndex: 20,
				overflow: 'hidden',
			}}
		>
			{/* Scrollable content */}
			<div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 100px' }}>
				{/* Back link */}
				<button
					onClick={onBackToMap}
					style={{
						background: 'none',
						border: 'none',
						color: c.muted,
						fontSize: 13,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: 4,
						padding: 0,
						marginBottom: 20,
					}}
				>
					<ArrowLeft size={14} strokeWidth={1.75} />
					Translation Map
				</button>

				{/* Header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						marginBottom: 20,
					}}
				>
					<div>
						<div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>
							Guided Tailoring
						</div>
						<div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>
							{accepted} accepted · {skipped} skipped · {pending} remaining
						</div>
					</div>
					<button
						onClick={acceptAll}
						disabled={pending === 0}
						style={{
							padding: '7px 14px',
							borderRadius: 6,
							border: `1px solid ${c.border}`,
							background: c.bgSurf,
							color: pending === 0 ? c.dim : c.text,
							fontSize: 13,
							fontWeight: 500,
							cursor: pending === 0 ? 'default' : 'pointer',
							opacity: pending === 0 ? 0.5 : 1,
						}}
					>
						Accept All
					</button>
				</div>

				{/* Change cards by section */}
				{sectionOrder.map(section => {
					const sectionChanges = grouped[section]
					if (!sectionChanges || sectionChanges.length === 0) return null
					return (
						<div key={section} style={{ marginBottom: 24 }}>
							<div
								style={{
									fontSize: 11,
									fontWeight: 700,
									color: c.dim,
									textTransform: 'uppercase',
									letterSpacing: '0.06em',
									marginBottom: 10,
								}}
							>
								{section}
							</div>
							{sectionChanges.map(ch => (
								<ChangeCard
									key={ch.id}
									change={ch}
									c={c}
									brand={brand}
									isEditing={editingId === ch.id}
									editValue={editValue}
									editRef={editRef}
									onAccept={() => updateChange(ch.id, 'accepted')}
									onSkip={() => updateChange(ch.id, 'skipped')}
									onUndo={() => updateChange(ch.id, 'pending')}
									onStartEdit={() => startEdit(ch)}
									onEditChange={setEditValue}
									onEditSave={() => updateSuggested(ch.id, editValue)}
									onEditCancel={() => setEditingId(null)}
								/>
							))}
						</div>
					)
				})}

				{changes.length === 0 && (
					<div
						style={{
							textAlign: 'center',
							padding: '40px 0',
							color: c.muted,
							fontSize: 14,
						}}
					>
						No changes suggested — your resume already matches well.
					</div>
				)}
			</div>

			{/* Sticky bottom bar */}
			<div
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					padding: '16px 28px',
					background: `linear-gradient(transparent, ${c.bg} 30%)`,
					paddingTop: 40,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<div style={{ fontSize: 13, color: c.muted }}>
					{accepted} accepted · {skipped} skipped
				</div>
				<button
					onClick={() =>
						onApplyChanges(changes.filter(ch => ch.status === 'accepted'))
					}
					disabled={accepted === 0}
					style={{
						padding: '10px 22px',
						borderRadius: 8,
						border: 'none',
						background: accepted === 0 ? c.border : brand,
						color: accepted === 0 ? c.dim : '#fff',
						fontSize: 14,
						fontWeight: 600,
						cursor: accepted === 0 ? 'not-allowed' : 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: 7,
						opacity: accepted === 0 ? 0.5 : 1,
					}}
				>
					<Zap size={15} strokeWidth={2} />
					Apply {accepted} Change{accepted !== 1 ? 's' : ''}
				</button>
			</div>
		</div>
	)
}

/* ═══ CHANGE CARD ═══ */

function ChangeCard({
	change,
	c,
	brand,
	isEditing,
	editValue,
	editRef,
	onAccept,
	onSkip,
	onUndo,
	onStartEdit,
	onEditChange,
	onEditSave,
	onEditCancel,
}: {
	change: TailoringChange
	c: Theme
	brand: string
	isEditing: boolean
	editValue: string
	editRef: React.RefObject<HTMLTextAreaElement>
	onAccept: () => void
	onSkip: () => void
	onUndo: () => void
	onStartEdit: () => void
	onEditChange: (v: string) => void
	onEditSave: () => void
	onEditCancel: () => void
}) {
	const isPending = change.status === 'pending'
	const isAccepted = change.status === 'accepted'
	const isSkipped = change.status === 'skipped'

	return (
		<div
			style={{
				borderRadius: 7,
				border: `1px solid ${c.border}`,
				background: c.bgEl,
				marginBottom: 8,
				overflow: 'hidden',
				opacity: isSkipped ? 0.5 : 1,
				transition: 'opacity 0.2s',
			}}
		>
			{/* Reason bar */}
			<div
				style={{
					padding: '8px 14px',
					fontSize: 12,
					color: c.muted,
					fontStyle: 'italic',
					borderBottom: `1px solid ${c.borderSub}`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<span>{change.reason}</span>
				{change.isAddition && (
					<span
						style={{
							fontSize: 10,
							fontWeight: 700,
							color: brand,
							background: `${brand}18`,
							padding: '1px 6px',
							borderRadius: 3,
							textTransform: 'uppercase',
							letterSpacing: '0.05em',
						}}
					>
						New
					</span>
				)}
			</div>

			<div style={{ padding: '10px 14px' }}>
				{/* Original text */}
				{change.original && isPending && (
					<div
						style={{
							fontSize: 13,
							color: c.muted,
							lineHeight: 1.45,
							padding: '6px 10px',
							borderRadius: 5,
							background: `${PARTIAL}0A`,
							border: `1px solid ${PARTIAL}18`,
							marginBottom: 8,
						}}
					>
						{change.original}
					</div>
				)}

				{/* Suggested text or edit mode */}
				{isEditing ? (
					<div>
						<textarea
							ref={editRef}
							value={editValue}
							onChange={e => onEditChange(e.target.value)}
							style={{
								width: '100%',
								minHeight: 60,
								padding: '8px 10px',
								borderRadius: 5,
								border: `1px solid ${brand}50`,
								background: c.bgSurf,
								color: c.text,
								fontSize: 13,
								lineHeight: 1.45,
								resize: 'vertical',
								outline: 'none',
								fontFamily: 'inherit',
							}}
						/>
						<div
							style={{
								display: 'flex',
								gap: 6,
								marginTop: 6,
								justifyContent: 'flex-end',
							}}
						>
							<button
								onClick={onEditCancel}
								style={{
									padding: '4px 12px',
									borderRadius: 5,
									border: `1px solid ${c.border}`,
									background: 'transparent',
									color: c.muted,
									fontSize: 12,
									cursor: 'pointer',
								}}
							>
								Cancel
							</button>
							<button
								onClick={onEditSave}
								style={{
									padding: '4px 12px',
									borderRadius: 5,
									border: 'none',
									background: brand,
									color: '#fff',
									fontSize: 12,
									fontWeight: 500,
									cursor: 'pointer',
								}}
							>
								Save
							</button>
						</div>
					</div>
				) : (
					<div
						style={{
							fontSize: 13,
							color: c.text,
							lineHeight: 1.45,
							padding: '6px 10px',
							borderRadius: 5,
							background: isAccepted
								? `${STRONG}0A`
								: isPending
									? `${brand}08`
									: 'transparent',
							border: isAccepted
								? `1px solid ${STRONG}18`
								: isPending
									? `1px solid ${brand}15`
									: `1px solid transparent`,
						}}
					>
						{change.suggested}
					</div>
				)}

				{/* Actions */}
				{!isEditing && (
					<div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
						{isPending ? (
							<>
								<ActionButton
									onClick={onAccept}
									icon={<Check size={13} strokeWidth={2} />}
									label="Accept"
									color={STRONG}
									c={c}
								/>
								<ActionButton
									onClick={onStartEdit}
									icon={<Plus size={13} strokeWidth={2} style={{ transform: 'rotate(45deg)' }} />}
									label="Edit"
									color={c.brandText}
									c={c}
								/>
								<ActionButton
									onClick={onSkip}
									icon={<X size={13} strokeWidth={2} />}
									label="Skip"
									color={c.dim}
									c={c}
								/>
							</>
						) : (
							<ActionButton
								onClick={onUndo}
								icon={<Undo2 size={13} strokeWidth={1.75} />}
								label="Undo"
								color={c.dim}
								c={c}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

function ActionButton({
	onClick,
	icon,
	label,
	color,
	c,
}: {
	onClick: () => void
	icon: React.ReactNode
	label: string
	color: string
	c: Theme
}) {
	return (
		<button
			onClick={onClick}
			style={{
				padding: '4px 10px',
				borderRadius: 5,
				border: `1px solid ${c.border}`,
				background: 'transparent',
				color,
				fontSize: 12,
				cursor: 'pointer',
				display: 'flex',
				alignItems: 'center',
				gap: 4,
			}}
		>
			{icon}
			{label}
		</button>
	)
}

/* ═══ ERROR SCREEN ═══ */

function ErrorScreen({
	error,
	c,
	brand,
	onRetry,
	onBack,
}: {
	error: string
	c: Theme
	brand: string
	onRetry: () => void
	onBack: () => void
}) {
	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 16,
				background: c.bg,
				zIndex: 20,
			}}
		>
			<AlertTriangle size={36} color={GAP} strokeWidth={1.5} />
			<div style={{ fontSize: 18, fontWeight: 600, color: c.text }}>
				Something went wrong
			</div>
			<div
				style={{
					fontSize: 14,
					color: c.muted,
					textAlign: 'center',
					maxWidth: 340,
					lineHeight: 1.4,
				}}
			>
				{error}
			</div>
			<div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
				<button
					onClick={onBack}
					style={{
						padding: '9px 20px',
						borderRadius: 7,
						border: `1px solid ${c.border}`,
						background: 'transparent',
						color: c.text,
						fontSize: 14,
						fontWeight: 500,
						cursor: 'pointer',
					}}
				>
					Back to Builder
				</button>
				<button
					onClick={onRetry}
					style={{
						padding: '9px 20px',
						borderRadius: 7,
						border: 'none',
						background: brand,
						color: '#fff',
						fontSize: 14,
						fontWeight: 500,
						cursor: 'pointer',
					}}
				>
					Try Again
				</button>
			</div>
		</div>
	)
}

/* ═══ MAIN OVERLAY ═══ */

export function TailorOverlay({
	step,
	data,
	error,
	formData,
	selectedJob,
	c,
	brand,
	onStartTailor,
	onBack,
	onRetry,
	onApplyChanges,
	onSetStep,
}: TailorOverlayProps) {
	if (step === 'idle') return null

	// Error takes priority
	if (error) {
		return <ErrorScreen error={error} c={c} brand={brand} onRetry={onRetry} onBack={onBack} />
	}

	// Loading: step is set but no data yet
	if (!data) {
		return <LoadingScreen c={c} brand={brand} />
	}

	if (step === 'translation-map') {
		return (
			<TranslationMap
				data={data}
				c={c}
				brand={brand}
				onBack={onBack}
				onContinue={() => onSetStep('guided-tailoring')}
			/>
		)
	}

	if (step === 'guided-tailoring') {
		return (
			<GuidedTailoring
				data={data}
				c={c}
				brand={brand}
				onBackToMap={() => onSetStep('translation-map')}
				onApplyChanges={onApplyChanges}
			/>
		)
	}

	return null
}
