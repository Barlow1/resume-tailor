import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { PrimaryBtn } from './landing-buttons.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'
import { trackCtaClick } from '~/lib/analytics.client.ts'

const steps = [
	{
		n: '01',
		title: 'Upload or start fresh',
		desc: 'Drop your existing resume or build one from scratch. We handle formatting.',
	},
	{
		n: '02',
		title: 'Paste any job description',
		desc: 'Add the role you want. Our AI analyzes keywords, skills, and requirements in seconds.',
	},
	{
		n: '03',
		title: 'Tailor and apply',
		desc: 'One click. Your resume is rewritten to match. Download as PDF and apply with confidence.',
	},
]

export function StepsSection() {
	const mobile = useMobile()
	return (
		<section
			id="how-it-works"
			style={{
				padding: mobile ? '80px 20px' : '100px 24px',
				scrollMarginTop: 96,
			}}
		>
			<div style={{ maxWidth: 1120, margin: '0 auto' }}>
				<FadeUp>
					<div style={{ textAlign: 'center', marginBottom: 64 }}>
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
							How it works
						</span>
						<h2
							style={{
								color: lc.text,
								fontSize: 'clamp(28px,4vw,42px)',
								fontWeight: 700,
								letterSpacing: '-0.035em',
								lineHeight: 1.15,
							}}
						>
							Three steps. One perfect resume.
						</h2>
					</div>
				</FadeUp>

				{/* Stepped flow */}
				<div
					style={{
						position: 'relative',
						maxWidth: 800,
						margin: '0 auto',
					}}
				>
					{/* Connecting line */}
					{!mobile && (
						<div
							style={{
								position: 'absolute',
								top: 24,
								left: 24,
								right: 24,
								height: 2,
								background: `linear-gradient(90deg,${lc.brand}40,${lc.brand}20,${lc.brand}40)`,
								zIndex: 0,
							}}
						/>
					)}
					<div
						style={{
							display: 'flex',
							flexDirection: mobile ? 'column' : 'row',
							gap: mobile ? 40 : 0,
							justifyContent: 'space-between',
							position: 'relative',
							zIndex: 1,
						}}
					>
						{steps.map((s, i) => (
							<FadeUp
								key={s.n}
								delay={i * 0.12}
								style={{
									flex: 1,
									textAlign: mobile ? 'left' : 'center',
									display: 'flex',
									flexDirection: mobile ? 'row' : 'column',
									alignItems: mobile ? 'flex-start' : 'center',
									gap: mobile ? 16 : 0,
								}}
							>
								{/* Number circle */}
								<div
									style={{
										width: 48,
										height: 48,
										borderRadius: '50%',
										background: lc.bg,
										border: `2px solid ${lc.brand}`,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										flexShrink: 0,
										boxShadow: `0 0 0 6px ${lc.bg}, 0 0 16px rgba(107,69,255,0.15)`,
									}}
								>
									<span
										style={{
											color: lc.brandL,
											fontSize: 16,
											fontWeight: 700,
											fontFamily: 'monospace',
										}}
									>
										{s.n}
									</span>
								</div>
								<div
									style={{
										marginTop: mobile ? 0 : 20,
										maxWidth: mobile ? undefined : 220,
									}}
								>
									<div
										style={{
											color: lc.text,
											fontSize: 17,
											fontWeight: 600,
											marginBottom: 6,
										}}
									>
										{s.title}
									</div>
									<div
										style={{
											color: lc.sec,
											fontSize: 14,
											lineHeight: 1.6,
										}}
									>
										{s.desc}
									</div>
								</div>
							</FadeUp>
						))}
					</div>
				</div>

				<FadeUp delay={0.35}>
					<div style={{ textAlign: 'center', marginTop: 56 }}>
						<PrimaryBtn
							to="/builder"
							onClick={() =>
								trackCtaClick(
									'Start tailoring free',
									'steps_section',
									'/builder',
								)
							}
						>
							Start tailoring free
						</PrimaryBtn>
					</div>
				</FadeUp>
			</div>
		</section>
	)
}
