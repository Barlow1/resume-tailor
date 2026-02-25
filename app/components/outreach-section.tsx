import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { FeatureBtn } from './landing-buttons.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'
import { trackCtaClick } from '~/lib/analytics.client.ts'

export function OutreachSection() {
	const mobile = useMobile()
	return (
		<section style={{ padding: mobile ? '80px 20px' : '100px 24px' }}>
			<div
				style={{
					maxWidth: 1120,
					margin: '0 auto',
					display: 'grid',
					gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
					gap: mobile ? 40 : 64,
					alignItems: 'center',
				}}
			>
				{/* Left — email preview card */}
				<FadeUp style={{ order: mobile ? 2 : 1 }}>
					<div
						style={{
							background: lc.card,
							border: `1px solid ${lc.brd}`,
							borderRadius: 16,
							padding: mobile ? 24 : 32,
						}}
					>
						<div
							style={{
								color: lc.mut,
								fontSize: 11,
								fontWeight: 600,
								textTransform: 'uppercase',
								letterSpacing: '0.05em',
								marginBottom: 16,
							}}
						>
							Generated Email
						</div>
						<div
							style={{
								background: lc.bg,
								borderRadius: 8,
								padding: 16,
								marginBottom: 16,
							}}
						>
							<div
								style={{
									color: lc.sec,
									fontSize: 12,
									marginBottom: 4,
								}}
							>
								Subject
							</div>
							<div style={{ color: lc.text, fontSize: 14 }}>
								Re: Senior Frontend Role — Acme Corp
							</div>
						</div>
						<div
							style={{
								background: lc.bg,
								borderRadius: 8,
								padding: 16,
								marginBottom: 16,
							}}
						>
							{[100, 92, 88, 95, 70].map((w, i) => (
								<div
									key={i}
									style={{
										height: 7,
										width: `${w}%`,
										borderRadius: 4,
										background: lc.el,
										marginBottom: i < 4 ? 6 : 0,
									}}
								/>
							))}
						</div>
						<div
							style={{
								display: 'flex',
								gap: 8,
								marginBottom: 16,
								flexWrap: 'wrap',
							}}
						>
							{['Professional', 'Warm', 'Concise'].map((t, i) => (
								<span
									key={t}
									style={{
										padding: '5px 12px',
										borderRadius: 6,
										fontSize: 12,
										background:
											i === 0
												? 'rgba(107,69,255,0.12)'
												: lc.bg,
										color: i === 0 ? lc.brandL : lc.mut,
										border: `1px solid ${i === 0 ? 'rgba(107,69,255,0.2)' : lc.brd}`,
									}}
								>
									{t}
								</span>
							))}
						</div>
						<div style={{ display: 'flex', gap: 8 }}>
							<button
								type="button"
								style={{
									padding: '7px 16px',
									borderRadius: 6,
									background: lc.brand,
									color: '#fff',
									border: 'none',
									fontSize: 13,
									cursor: 'pointer',
								}}
							>
								Copy
							</button>
							<button
								type="button"
								style={{
									padding: '7px 16px',
									borderRadius: 6,
									background: 'transparent',
									color: lc.sec,
									border: `1px solid ${lc.brd}`,
									fontSize: 13,
									cursor: 'pointer',
								}}
							>
								Regenerate
							</button>
						</div>
					</div>
				</FadeUp>

				{/* Right — copy */}
				<FadeUp delay={0.15} style={{ order: mobile ? 1 : 2 }}>
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
						AI Outreach
					</span>
					<h2
						style={{
							color: lc.text,
							fontSize: 'clamp(26px,3.5vw,38px)',
							fontWeight: 700,
							letterSpacing: '-0.035em',
							marginBottom: 16,
							lineHeight: 1.15,
						}}
					>
						Don't just apply. Reach out.
					</h2>
					<p
						style={{
							color: lc.sec,
							fontSize: 16,
							lineHeight: 1.6,
							marginBottom: 28,
						}}
					>
						Generate personalized cold emails and LinkedIn messages that
						reference the job and your experience. Sound human, not
						templated.
					</p>
					<FeatureBtn
						to="/builder"
						onClick={() =>
							trackCtaClick(
								'Generate outreach',
								'outreach_section',
								'/builder',
							)
						}
					>
						Generate outreach
					</FeatureBtn>
				</FadeUp>
			</div>
		</section>
	)
}
