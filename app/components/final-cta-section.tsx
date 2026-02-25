import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { PrimaryBtn } from './landing-buttons.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'
import { trackCtaClick } from '~/lib/analytics.client.ts'

export function FinalCtaSection() {
	const mobile = useMobile()
	return (
		<section
			style={{
				padding: mobile ? '80px 20px' : '100px 24px',
				textAlign: 'center',
				background:
					'radial-gradient(ellipse at 50% 50%,rgba(107,69,255,0.1) 0%,transparent 60%)',
			}}
		>
			<div style={{ maxWidth: 600, margin: '0 auto' }}>
				<FadeUp>
					<p
						style={{
							color: lc.sec,
							fontSize: 15,
							marginBottom: 24,
							lineHeight: 1.6,
						}}
					>
						Every generic resume you send is another application lost to a
						filter.
					</p>
					<h2
						style={{
							color: lc.text,
							fontSize: 'clamp(28px,4vw,42px)',
							fontWeight: 700,
							letterSpacing: '-0.035em',
							marginBottom: 16,
							lineHeight: 1.15,
						}}
					>
						Your next interview is{!mobile && <br />} one resume away.
					</h2>
					<p
						style={{
							color: lc.mut,
							fontSize: 15,
							marginBottom: 36,
						}}
					>
						Free to start. No credit card required.
					</p>
					<PrimaryBtn
						to="/builder"
						style={{ padding: '14px 32px', fontSize: 16 }}
						onClick={() =>
							trackCtaClick(
								'Build your resume now',
								'final_cta',
								'/builder',
							)
						}
					>
						Build your resume now
					</PrimaryBtn>
				</FadeUp>
			</div>
		</section>
	)
}
