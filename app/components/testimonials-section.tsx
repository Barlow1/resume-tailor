import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'

const testimonials = [
	{
		quote:
			'I was mass-applying with the same resume for months. After tailoring with Resume Tailor, I got 3 interview callbacks in my first week.',
		name: 'Sarah M.',
		role: 'Product Designer \u2192 hired at a Series B startup',
	},
	{
		quote:
			"The ATS score feature is a game-changer. I could finally see why my applications were getting filtered out.",
		name: 'James K.',
		role: 'Software Engineer \u2192 hired at a Fortune 500',
	},
	{
		quote:
			"I used to spend 45 minutes customizing each resume. Now it takes me under a minute. I've applied to 3x more jobs.",
		name: 'Priya R.',
		role: 'Marketing Manager \u2192 hired at a tech unicorn',
	},
]

export function TestimonialsSection() {
	const mobile = useMobile()
	return (
		<section style={{ padding: mobile ? '80px 20px' : '100px 24px' }}>
			<div style={{ maxWidth: 1120, margin: '0 auto' }}>
				<FadeUp>
					<h2
						style={{
							color: lc.text,
							fontSize: 'clamp(28px,4vw,42px)',
							fontWeight: 700,
							letterSpacing: '-0.035em',
							textAlign: 'center',
							marginBottom: 60,
						}}
					>
						From rejected to interviewed.
					</h2>
				</FadeUp>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)',
						gap: 20,
					}}
				>
					{testimonials.map((t, i) => (
						<FadeUp key={t.name} delay={i * 0.1}>
							<div
								style={{
									background: lc.card,
									border: `1px solid ${lc.brd}`,
									borderRadius: 12,
									padding: 32,
									height: '100%',
									display: 'flex',
									flexDirection: 'column',
									transition: 'all 0.2s',
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
								<div
									style={{
										color: lc.brand,
										fontSize: 14,
										marginBottom: 16,
										letterSpacing: 2,
									}}
								>
									★★★★★
								</div>
								<p
									style={{
										color: lc.sec,
										fontSize: 15,
										lineHeight: 1.6,
										flex: 1,
										marginBottom: 20,
									}}
								>
									&ldquo;{t.quote}&rdquo;
								</p>
								<div>
									<div
										style={{
											color: lc.text,
											fontSize: 14,
											fontWeight: 600,
										}}
									>
										{t.name}
									</div>
									<div
										style={{
											color: lc.mut,
											fontSize: 13,
										}}
									>
										{t.role}
									</div>
								</div>
							</div>
						</FadeUp>
					))}
				</div>
			</div>
		</section>
	)
}
