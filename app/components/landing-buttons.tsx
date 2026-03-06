import { Link } from '@remix-run/react'
import { lc } from './landing-colors.ts'
import type { CSSProperties, ReactNode } from 'react'

export function PrimaryBtn({
	to,
	children,
	onClick,
	style: extra = {},
}: {
	to: string
	children: ReactNode
	onClick?: () => void
	style?: CSSProperties
}) {
	const base: CSSProperties = {
		display: 'inline-block',
		background: lc.brand,
		color: '#fff',
		border: 'none',
		borderRadius: 8,
		padding: '12px 24px',
		fontSize: 15,
		fontWeight: 500,
		cursor: 'pointer',
		transition: 'all 0.2s',
		textDecoration: 'none',
		boxShadow:
			'0 0 0 1px rgba(107,69,255,0.3),0 4px 16px rgba(107,69,255,0.25)',
		...extra,
	}

	return (
		<Link
			to={to}
			style={base}
			onClick={onClick}
			onMouseEnter={e => {
				const el = e.currentTarget
				el.style.transform = 'translateY(-1px)'
				el.style.boxShadow =
					'0 0 0 1px rgba(107,69,255,0.4),0 6px 24px rgba(107,69,255,0.35)'
			}}
			onMouseLeave={e => {
				const el = e.currentTarget
				el.style.transform = 'translateY(0)'
				el.style.boxShadow =
					'0 0 0 1px rgba(107,69,255,0.3),0 4px 16px rgba(107,69,255,0.25)'
			}}
		>
			{children}
		</Link>
	)
}

export function SecondaryBtn({
	href,
	children,
	style: extra = {},
}: {
	href: string
	children: ReactNode
	style?: CSSProperties
}) {
	const base: CSSProperties = {
		display: 'inline-block',
		background: 'transparent',
		color: lc.sec,
		border: `1px solid ${lc.brd}`,
		borderRadius: 8,
		padding: '12px 24px',
		fontSize: 15,
		fontWeight: 500,
		cursor: 'pointer',
		transition: 'all 0.2s',
		textDecoration: 'none',
		...extra,
	}

	return (
		<a
			href={href}
			style={base}
			onMouseEnter={e => {
				const el = e.currentTarget
				el.style.transform = 'translateY(-1px)'
				el.style.borderColor = lc.brdH
				el.style.color = lc.text
			}}
			onMouseLeave={e => {
				const el = e.currentTarget
				el.style.transform = 'translateY(0)'
				el.style.borderColor = lc.brd
				el.style.color = lc.sec
			}}
		>
			{children}
		</a>
	)
}

export function FeatureBtn({
	to,
	children,
	onClick,
	style: extra = {},
}: {
	to: string
	children: ReactNode
	onClick?: () => void
	style?: CSSProperties
}) {
	const base: CSSProperties = {
		display: 'inline-block',
		background: 'transparent',
		color: lc.brandL,
		border: '1px solid rgba(107,69,255,0.3)',
		borderRadius: 8,
		padding: '10px 20px',
		fontSize: 14,
		fontWeight: 500,
		textDecoration: 'none',
		transition: 'all 0.2s',
		cursor: 'pointer',
		...extra,
	}

	return (
		<Link
			to={to}
			style={base}
			onClick={onClick}
			onMouseEnter={e => {
				const el = e.currentTarget
				el.style.borderColor = lc.brand
				el.style.color = lc.text
			}}
			onMouseLeave={e => {
				const el = e.currentTarget
				el.style.borderColor = 'rgba(107,69,255,0.3)'
				el.style.color = lc.brandL
			}}
		>
			{children}
		</Link>
	)
}
