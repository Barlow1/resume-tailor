import { Link } from '@remix-run/react'
import { lc } from './landing-colors.ts'
import { useState } from 'react'
import { useMobile } from '~/hooks/use-mobile.ts'

export function AgentBanner() {
	const [dismissed, setDismissed] = useState(false)
	const mobile = useMobile()

	if (dismissed) return null

	return (
		<div
			style={{
				background:
					'linear-gradient(90deg, rgba(107,69,255,0.15) 0%, rgba(107,69,255,0.08) 50%, rgba(107,69,255,0.15) 100%)',
				borderBottom: `1px solid rgba(107,69,255,0.2)`,
				padding: mobile ? '16px 16px' : '16px 24px',
				marginTop: 60,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: mobile ? 10 : 16,
				position: 'relative',
				zIndex: 50,
			}}
		>
			<span
				style={{
					width: 6,
					height: 6,
					borderRadius: '50%',
					background: lc.brandL,
					flexShrink: 0,
					animation: 'agentPulse 2.5s ease infinite',
				}}
			/>
			<span
				style={{
					color: lc.sec,
					fontSize: mobile ? 13 : 14,
					lineHeight: 1.4,
				}}
			>
				<strong style={{ color: lc.text, fontWeight: 600 }}>NEW</strong>
				{mobile
					? ' — Stop applying. Let your agent do it.'
					: ' — Stop applying to jobs. Your AI career agent finds, tailors, and applies for you.'}
			</span>
			<Link
				to="/agent"
				reloadDocument
				style={{
					flexShrink: 0,
					padding: mobile ? '6px 14px' : '7px 18px',
					borderRadius: 6,
					background: lc.brand,
					color: '#fff',
					fontSize: 13,
					fontWeight: 600,
					textDecoration: 'none',
					transition: 'all 0.2s',
					boxShadow: '0 0 16px rgba(107,69,255,0.3)',
				}}
				onMouseEnter={e => {
					e.currentTarget.style.background = lc.brandL
					e.currentTarget.style.transform = 'translateY(-1px)'
				}}
				onMouseLeave={e => {
					e.currentTarget.style.background = lc.brand
					e.currentTarget.style.transform = 'translateY(0)'
				}}
			>
				Learn more
			</Link>
			<button
				onClick={() => setDismissed(true)}
				style={{
					position: 'absolute',
					right: mobile ? 8 : 16,
					top: '50%',
					transform: 'translateY(-50%)',
					background: 'none',
					border: 'none',
					color: lc.mut,
					fontSize: 18,
					cursor: 'pointer',
					padding: 4,
					lineHeight: 1,
				}}
				aria-label="Dismiss banner"
			>
				&times;
			</button>
			<style>{`
				@keyframes agentPulse {
					0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(107,69,255,0.4); }
					50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(107,69,255,0); }
				}
			`}</style>
		</div>
	)
}
