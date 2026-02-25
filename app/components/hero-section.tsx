import { useState, useEffect } from 'react'
import { lc } from './landing-colors.ts'
import { BuilderMockup } from './builder-mockup.tsx'
import { PrimaryBtn, SecondaryBtn } from './landing-buttons.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'
import { trackCtaClick } from '~/lib/analytics.client.ts'

export function HeroSection() {
	const [mounted, setMounted] = useState(false)
	const mobile = useMobile()
	useEffect(() => {
		setTimeout(() => setMounted(true), 100)
	}, [])

	const fade = (delay: number) => ({
		opacity: mounted ? 1 : 0,
		transform: mounted ? 'translateY(0)' : 'translateY(28px)',
		transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
	})

	return (
		<section
			style={{
				padding: mobile ? '100px 20px 40px' : '120px 24px 48px',
				textAlign: 'center',
				position: 'relative',
				overflow: 'hidden',
				background:
					'radial-gradient(ellipse at 50% 0%,rgba(107,69,255,0.15) 0%,transparent 65%)',
			}}
		>
			<div style={{ maxWidth: 1120, margin: '0 auto' }}>
				{/* Pill badge */}
				<div style={fade(0)}>
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
						16k+ Resumes tailored
					</span>
				</div>

				{/* Headline */}
				<h1
					style={{
						...fade(0.1),
						fontSize: 'clamp(36px,5.5vw,64px)',
						fontWeight: 700,
						letterSpacing: '-0.035em',
						lineHeight: 1.08,
						margin: '0 0 20px',
						color: lc.text,
					}}
				>
					One resume. Every job.
					<br />
					<span
						style={{
							background: `linear-gradient(135deg,${lc.brandL},${lc.brandP},${lc.brand})`,
							WebkitBackgroundClip: 'text',
							WebkitTextFillColor: 'transparent',
						}}
					>
						Perfectly matched.
					</span>
				</h1>

				{/* Subtitle */}
				<p
					style={{
						...fade(0.2),
						color: lc.sec,
						fontSize: 17,
						lineHeight: 1.6,
						maxWidth: 540,
						margin: '0 auto 36px',
					}}
				>
					Paste a job description. Get a resume optimized for it —
					{!mobile && <br />}
					right keywords, right structure, ATS-ready. In 30 seconds.
				</p>

				{/* CTAs */}
				<div
					style={{
						...fade(0.3),
						display: 'flex',
						gap: 12,
						justifyContent: 'center',
						flexWrap: 'wrap',
					}}
				>
					<PrimaryBtn
						to="/builder"
						onClick={() =>
							trackCtaClick(
								'Build your resume now',
								'hero_section',
								'/builder',
							)
						}
					>
						Build your resume now
					</PrimaryBtn>
					<SecondaryBtn href="#how-it-works">
						How it works
					</SecondaryBtn>
				</div>

				{/* Trust line */}
				<div style={{ ...fade(0.4), marginTop: 40 }}>
					<p style={{ color: lc.mut, fontSize: 14 }}>
						Trusted by thousands of job seekers worldwide
					</p>
				</div>

				{/* Builder mockup */}
				<div style={{ ...fade(0.5), marginTop: 48 }}>
					<BuilderMockup mobile={mobile} />
				</div>
			</div>
		</section>
	)
}
