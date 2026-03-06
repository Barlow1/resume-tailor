import { Link } from '@remix-run/react'
import { lc } from './landing-colors.ts'
import { useMobile } from '~/hooks/use-mobile.ts'

export function LandingFooter() {
	const mobile = useMobile()
	return (
		<footer
			style={{
				borderTop: '1px solid rgba(255,255,255,0.04)',
				padding: mobile ? '32px 20px' : '48px 24px',
			}}
		>
			<div
				style={{
					maxWidth: 1120,
					margin: '0 auto',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					flexWrap: 'wrap',
					gap: 16,
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
					}}
				>
					<img
						src="/RT_Logo_icon.png"
						alt="Resume Tailor"
						style={{
							height: 22,
							width: 'auto',
							filter: 'brightness(0) invert(1)',
						}}
					/>
					<span style={{ color: lc.mut, fontSize: 13 }}>
						&copy; {new Date().getFullYear()} Resume Tailor
					</span>
				</div>
				<div style={{ display: 'flex', gap: 24 }}>
					{[
						{ label: 'Pricing', to: '/pricing' },
						{ label: 'Blog', to: '/blog' },
					].map(link => (
						<Link
							key={link.label}
							to={link.to}
							style={{
								color: lc.mut,
								fontSize: 13,
								textDecoration: 'none',
								transition: 'color 0.2s',
							}}
							onMouseEnter={e =>
								((e.target as HTMLElement).style.color =
									lc.text)
							}
							onMouseLeave={e =>
								((e.target as HTMLElement).style.color =
									lc.mut)
							}
						>
							{link.label}
						</Link>
					))}
				</div>
			</div>
		</footer>
	)
}
