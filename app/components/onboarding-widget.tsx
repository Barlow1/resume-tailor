import {
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Circle,
	Rocket,
	X,
} from 'lucide-react'

const BRAND = '#6B45FF'
const SUCCESS = '#30A46C'

export interface OnboardingWidgetProps {
	isComplete: boolean
	dismissed: boolean
	collapsed: boolean
	setDismissed: (v: boolean) => void
	setCollapsed: (v: boolean) => void
	hasResume: boolean
	hasJob: boolean
	hasTailored: boolean
	onResumeClick: () => void
	onJobClick: () => void
	onTailorClick: () => void
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
	hasTailored,
	onResumeClick,
	onJobClick,
	onTailorClick,
	c,
}: OnboardingWidgetProps) {
	if (isComplete || dismissed) return null

	const steps = [
		{
			id: 'resume',
			label: 'Create a resume',
			done: hasResume,
			action: onResumeClick,
		},
		{
			id: 'job',
			label: 'Add a target job',
			done: hasJob,
			action: onJobClick,
		},
		{
			id: 'tailor',
			label: 'Tailor with AI',
			done: hasTailored,
			action: onTailorClick,
		},
	]

	return (
		<div
			style={{
				position: 'fixed',
				bottom: 20,
				right: 20,
				zIndex: 150,
				width: collapsed ? 48 : 280,
				background: c.bgEl,
				borderRadius: 12,
				border: `1px solid ${c.border}`,
				boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
				overflow: 'hidden',
				transition: 'width 200ms',
			}}
		>
			{collapsed ? (
				<div
					onClick={() => setCollapsed(false)}
					style={{
						width: 48,
						height: 48,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
					}}
				>
					<Rocket size={20} color={c.brandText} strokeWidth={1.75} />
				</div>
			) : (
				<>
					<div
						style={{
							padding: '12px 16px 8px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<Rocket size={16} color={c.brandText} strokeWidth={1.75} />
							<span
								style={{ fontSize: 13, fontWeight: 600, color: c.text }}
							>
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
						{steps.map(step => (
							<div
								key={step.id}
								onClick={!step.done ? step.action : undefined}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 10,
									padding: '8px 0',
									cursor: step.done ? 'default' : 'pointer',
									opacity: step.done ? 0.6 : 1,
								}}
							>
								{step.done ? (
									<CheckCircle2
										size={16}
										color={SUCCESS}
										strokeWidth={1.75}
									/>
								) : (
									<Circle size={16} color={c.dim} strokeWidth={1.75} />
								)}
								<span
									style={{
										fontSize: 13,
										color: step.done ? c.dim : c.text,
										textDecoration: step.done ? 'line-through' : 'none',
									}}
								>
									{step.label}
								</span>
								{!step.done && (
									<ChevronRight
										size={12}
										color={c.dim}
										style={{ marginLeft: 'auto' }}
									/>
								)}
							</div>
						))}
						{/* Progress bar */}
						<div
							style={{
								marginTop: 8,
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
									width: `${
										(steps.filter(s => s.done).length / 3) * 100
									}%`,
								}}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	)
}
