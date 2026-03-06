import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { FeatureBtn } from './landing-buttons.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'
import { trackCtaClick } from '~/lib/analytics.client.ts'

const keywords = [
	{ name: 'React', matched: true },
	{ name: 'TypeScript', matched: true },
	{ name: 'Node.js', matched: true },
	{ name: 'GraphQL', matched: false },
	{ name: 'CI/CD', matched: false },
	{ name: 'AWS', matched: true },
]

export function ResumeAnalyzerSection() {
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
				{/* Left — copy */}
				<FadeUp>
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
						Resume Analyzer
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
						Know your score before you apply.
					</h2>
					<p
						style={{
							color: lc.sec,
							fontSize: 16,
							lineHeight: 1.6,
							marginBottom: 28,
						}}
					>
						Run any resume against any job description. Get an instant ATS
						readiness score, see matched vs. missing keywords, and know
						exactly what to fix.
					</p>
					<FeatureBtn
						to="/builder"
						onClick={() =>
							trackCtaClick(
								'Analyze your resume',
								'analyzer_section',
								'/builder',
							)
						}
					>
						Analyze your resume
					</FeatureBtn>
				</FadeUp>

				{/* Right — score visualization */}
				<FadeUp delay={0.15}>
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
								display: 'flex',
								alignItems: 'center',
								gap: 20,
								marginBottom: 24,
							}}
						>
							<svg width="80" height="80" viewBox="0 0 80 80">
								<circle
									cx="40"
									cy="40"
									r="34"
									fill="none"
									stroke={lc.el}
									strokeWidth="6"
								/>
								<circle
									cx="40"
									cy="40"
									r="34"
									fill="none"
									stroke={lc.brand}
									strokeWidth="6"
									strokeDasharray={`${(87 / 100) * 213.6} 213.6`}
									strokeLinecap="round"
									transform="rotate(-90 40 40)"
								/>
								<text
									x="40"
									y="38"
									textAnchor="middle"
									fill={lc.text}
									fontSize="20"
									fontWeight="700"
								>
									87
								</text>
								<text
									x="40"
									y="52"
									textAnchor="middle"
									fill={lc.mut}
									fontSize="10"
								>
									/100
								</text>
							</svg>
							<div>
								<div
									style={{
										color: lc.text,
										fontSize: 16,
										fontWeight: 600,
									}}
								>
									ATS Match Score
								</div>
								<div style={{ color: '#28C840', fontSize: 13 }}>
									Strong match
								</div>
							</div>
						</div>
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: 8,
							}}
						>
							{keywords.map(k => (
								<div
									key={k.name}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										padding: '8px 12px',
										borderRadius: 8,
										background: lc.bg,
									}}
								>
									<span style={{ color: lc.text, fontSize: 14 }}>
										{k.name}
									</span>
									<span
										style={{
											color: k.matched ? '#28C840' : '#EF4444',
											fontSize: 13,
											fontWeight: 500,
										}}
									>
										{k.matched ? '✓ matched' : '✗ missing'}
									</span>
								</div>
							))}
						</div>
					</div>
				</FadeUp>
			</div>
		</section>
	)
}
