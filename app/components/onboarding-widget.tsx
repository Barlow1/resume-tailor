import {
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Circle,
	Rocket,
	X,
} from 'lucide-react'

const BRAND = '#6B45FF'
const BRAND_LIGHT = '#A78BFA'
const SUCCESS = '#30A46C'

export interface OnboardingWidgetProps {
	isComplete: boolean
	dismissed: boolean
	collapsed: boolean
	setDismissed: (v: boolean) => void
	setCollapsed: (v: boolean) => void
	hasResume: boolean
	hasJob: boolean
	hasReviewedMatch: boolean
	hasTakenAction: boolean
	onResumeClick: () => void
	onJobClick: () => void
	c: {
		bgEl: string
		border: string
		brandText: string
		text: string
		dim: string
	}
}

export function OnboardingWidget({
	isComplete,
	dismissed,
	collapsed,
	setDismissed,
	setCollapsed,
	hasResume,
	hasJob,
	hasReviewedMatch,
	hasTakenAction,
	onResumeClick,
	onJobClick,
	c,
}: OnboardingWidgetProps) {
	if (isComplete || dismissed) return null

	const steps = [
		{
			id: 'resume',
			label: 'Create a resume',
			done: !!hasResume,
			action: onResumeClick,
			locked: false,
		},
		{
			id: 'job',
			label: 'Add a target job',
			done: !!hasJob,
			action: onJobClick,
			locked: !hasResume,
		},
		{
			id: 'match',
			label: 'Review your match',
			done: hasReviewedMatch,
			action: undefined,
			locked: !hasJob,
		},
		{
			id: 'action',
			label: 'Tailor a bullet with AI',
			done: hasTakenAction,
			action: undefined,
			locked: !hasReviewedMatch,
		},
	]

	// The first incomplete, unlocked step gets the shimmer
	const activeStepId = steps.find(s => !s.done && !s.locked)?.id ?? null

	const doneCount = steps.filter(s => s.done).length
	const progress = (doneCount / steps.length) * 100

	return (
		<div
			style={{
				marginTop: 'auto',
				borderTop: `1px solid ${c.border}`,
				background: c.bgEl,
				overflow: 'hidden',
			}}
		>
			<style>{`
				@keyframes onboarding-shimmer {
					0% { background-position: 100% 0; }
					100% { background-position: -100% 0; }
				}
				.onboarding-shimmer-text {
					background: linear-gradient(
						90deg,
						${BRAND} 0%,
						${BRAND} 40%,
						${BRAND_LIGHT} 50%,
						#C4B5FD 55%,
						${BRAND_LIGHT} 60%,
						${BRAND} 70%,
						${BRAND} 100%
					);
					background-size: 200% 100%;
					-webkit-background-clip: text;
					background-clip: text;
					-webkit-text-fill-color: transparent;
					animation: onboarding-shimmer 2.5s ease-in-out infinite;
					font-weight: 600;
				}
			`}</style>

			{collapsed ? (
				<div
					onClick={() => setCollapsed(false)}
					style={{
						padding: '10px 16px',
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						cursor: 'pointer',
					}}
				>
					<Rocket size={16} color={c.brandText} strokeWidth={1.75} />
					<span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
						Getting Started
					</span>
					<span style={{ fontSize: 12, color: '#454550', marginLeft: 'auto' }}>
						{doneCount}/{steps.length}
					</span>
				</div>
			) : (
				<>
					<div
						style={{
							padding: '14px 16px 8px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<Rocket size={16} color={c.brandText} strokeWidth={1.75} />
							<span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
								Getting Started
							</span>
						</div>
						<div style={{ display: 'flex', gap: 2 }}>
							<button
								onClick={() => setCollapsed(true)}
								style={{
									width: 24,
									height: 24,
									borderRadius: 4,
									border: 'none',
									background: 'transparent',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<ChevronDown size={14} color={c.dim} />
							</button>
							<button
								onClick={() => setDismissed(true)}
								style={{
									width: 24,
									height: 24,
									borderRadius: 4,
									border: 'none',
									background: 'transparent',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<X size={14} color={c.dim} />
							</button>
						</div>
					</div>
					<div style={{ padding: '4px 16px 16px' }}>
						{steps.map(step => {
							const isActive = step.id === activeStepId
							return (
								<div
									key={step.id}
									onClick={!step.done && !step.locked ? step.action : undefined}
									title={step.locked ? 'Complete the previous step first' : undefined}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 10,
										padding: '9px 0',
										cursor: step.done || step.locked ? 'default' : 'pointer',
									}}
								>
									{step.done ? (
										<CheckCircle2
											size={18}
											color={SUCCESS}
											strokeWidth={1.75}
										/>
									) : isActive ? (
										<Circle size={18} color={BRAND} strokeWidth={2} />
									) : (
										<Circle size={18} color={step.locked ? c.border : c.dim} strokeWidth={1.75} />
									)}
									<span
										className={isActive ? 'onboarding-shimmer-text' : undefined}
										style={{
											fontSize: 15,
											color: step.locked ? c.border : step.done ? c.dim : isActive ? BRAND : c.text,
											textDecoration: step.done ? 'line-through' : 'none',
											fontWeight: isActive ? 600 : 500,
											opacity: step.locked ? 0.5 : 1,
										}}
									>
										{step.label}
									</span>
									{isActive && (
										<ChevronRight
											size={13}
											color={BRAND}
											style={{ marginLeft: 'auto' }}
										/>
									)}
								</div>
							)
						})}
						{/* Progress bar */}
						<div
							style={{
								marginTop: 10,
								height: 3,
								borderRadius: 2,
								background: c.border,
								overflow: 'hidden',
							}}
						>
							<div
								style={{
									height: '100%',
									borderRadius: 2,
									background: BRAND,
									transition: 'width 300ms',
									width: `${progress}%`,
								}}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	)
}
