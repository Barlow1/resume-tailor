import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'

const cards = [
	{
		icon: (
			<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
				<circle
					cx="16"
					cy="16"
					r="12"
					stroke={lc.brand}
					strokeWidth="2.5"
					strokeDasharray="60 15.4"
					strokeLinecap="round"
					transform="rotate(-90 16 16)"
				/>
				<text
					x="16"
					y="18"
					textAnchor="middle"
					fill={lc.brandL}
					fontSize="9"
					fontWeight="700"
				>
					87
				</text>
			</svg>
		),
		title: 'ATS match scoring',
		body: 'See exactly how your resume scores against the job description. Keywords matched, skills gaps flagged, 0\u2013100 fit score.',
	},
	{
		icon: (
			<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
				<rect
					x="4"
					y="6"
					width="10"
					height="20"
					rx="2"
					stroke={lc.brand}
					strokeWidth="2"
				/>
				<rect
					x="18"
					y="6"
					width="10"
					height="20"
					rx="2"
					stroke={lc.brand}
					strokeWidth="2"
				/>
				<path
					d="M14 16h4"
					stroke={lc.brandL}
					strokeWidth="2"
					strokeLinecap="round"
				/>
			</svg>
		),
		title: 'One-click tailoring',
		body: "Edit directly in a real resume builder with live preview, formatting, and instant PDF export. No copy-pasting from ChatGPT.",
	},
	{
		icon: (
			<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
				<rect
					x="6"
					y="4"
					width="16"
					height="12"
					rx="2"
					stroke={lc.brand}
					strokeWidth="2"
				/>
				<rect
					x="10"
					y="10"
					width="16"
					height="12"
					rx="2"
					stroke={lc.brand}
					strokeWidth="2"
					fill={lc.bg}
				/>
				<rect
					x="14"
					y="16"
					width="16"
					height="12"
					rx="2"
					stroke={lc.brand}
					strokeWidth="2"
					fill={lc.bg}
				/>
			</svg>
		),
		title: 'Every version, saved',
		body: "One base resume. Unlimited tailored versions. Each linked to a specific job so you never lose track.",
	},
]

export function FeatureSection() {
	const mobile = useMobile()
	return (
		<section
			style={{
				padding: mobile ? '60px 20px' : '80px 24px',
			}}
		>
			<div style={{ maxWidth: 1120, margin: '0 auto' }}>
				<FadeUp>
					<div style={{ textAlign: 'center' }}>
						<span
							style={{
								display: 'inline-block',
								padding: '6px 14px',
								borderRadius: 999,
								background: 'rgba(107,69,255,0.1)',
								color: lc.brandL,
								fontSize: 13,
								fontWeight: 500,
								border: '1px solid rgba(107,69,255,0.18)',
								marginBottom: 16,
							}}
						>
							Why Resume Tailor
						</span>
						<h2
							style={{
								color: lc.text,
								fontSize: 'clamp(28px,4vw,42px)',
								fontWeight: 700,
								letterSpacing: '-0.035em',
								lineHeight: 1.15,
								marginBottom: 12,
							}}
						>
							ChatGPT can rewrite your resume.
						</h2>
						<h2
							style={{
								fontSize: 'clamp(28px,4vw,42px)',
								fontWeight: 700,
								letterSpacing: '-0.035em',
								marginBottom: 60,
							}}
						>
							<span
								style={{
									background: `linear-gradient(135deg,${lc.brandL},${lc.brandP})`,
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
								}}
							>
								It can't do this.
							</span>
						</h2>
					</div>
				</FadeUp>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)',
						gap: 20,
					}}
				>
					{cards.map((card, i) => (
						<FadeUp key={card.title} delay={i * 0.1}>
							<div
								style={{
									background: lc.card,
									border: `1px solid ${lc.brd}`,
									borderRadius: 12,
									padding: 32,
									transition: 'all 0.2s',
									height: '100%',
								}}
								onMouseEnter={e => {
									const el = e.currentTarget
									el.style.borderColor = lc.brdH
									el.style.transform = 'translateY(-2px)'
								}}
								onMouseLeave={e => {
									const el = e.currentTarget
									el.style.borderColor = lc.brd
									el.style.transform = 'translateY(0)'
								}}
							>
								<div style={{ marginBottom: 16 }}>{card.icon}</div>
								<div
									style={{
										color: lc.text,
										fontSize: 18,
										fontWeight: 600,
										marginBottom: 8,
									}}
								>
									{card.title}
								</div>
								<div
									style={{
										color: lc.sec,
										fontSize: 15,
										lineHeight: 1.6,
									}}
								>
									{card.body}
								</div>
							</div>
						</FadeUp>
					))}
				</div>
			</div>
		</section>
	)
}
