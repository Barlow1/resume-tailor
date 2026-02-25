import { lc } from './landing-colors.ts'

const BRAND = '#6B45FF'
const bg = '#0C0C0E'
const panel = '#111113'
const surf = '#18181B'
const brd = '#2B2B31'
const dim = '#636366'
const mut = '#8B8B8F'
const txt = '#ECECEE'

function arcPath(startDeg: number, endDeg: number, r: number) {
	const cx = 36
	const cy = 36
	const toR = (d: number) => (d * Math.PI) / 180
	const p1 = {
		x: cx + r * Math.cos(toR(startDeg)),
		y: cy + r * Math.sin(toR(startDeg)),
	}
	const p2 = {
		x: cx + r * Math.cos(toR(endDeg)),
		y: cy + r * Math.sin(toR(endDeg)),
	}
	return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${p2.x} ${p2.y}`
}

export function BuilderMockup({ mobile }: { mobile: boolean }) {
	return (
		<div
			style={{
				borderRadius: 20,
				border: `1px solid ${lc.brd}`,
				boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
				overflow: 'hidden',
				maxWidth: 1120,
				margin: '0 auto',
				background: panel,
			}}
		>
			{/* Browser chrome */}
			<div
				style={{
					padding: '15px 21px',
					display: 'flex',
					alignItems: 'center',
					gap: 9,
					borderBottom: `1px solid ${brd}`,
					background: panel,
				}}
			>
				<div style={{ display: 'flex', gap: 9 }}>
					{['#FF5F57', '#FFBD2E', '#28C840'].map(col => (
						<div
							key={col}
							style={{
								width: 15,
								height: 15,
								borderRadius: '50%',
								background: col,
							}}
						/>
					))}
				</div>
				<div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
					<div
						style={{
							background: bg,
							borderRadius: 9,
							padding: '6px 48px',
							fontSize: 16,
							color: dim,
						}}
					>
						resumetailor.ai/builder
					</div>
				</div>
			</div>

			{/* Top bar */}
			<div
				style={{
					height: 54,
					background: panel,
					borderBottom: `1px solid ${brd}`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '0 18px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
					<img
						src="/RT_Logo_icon.png"
						alt="Resume Tailor"
						style={{
							width: 24,
							height: 24,
							borderRadius: 6,
						}}
					/>
					<span style={{ fontSize: 15, color: mut }}>Resume Tailor</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
					<div
						style={{
							padding: '5px 12px',
							borderRadius: 6,
							background: surf,
							border: `1px solid ${brd}`,
							fontSize: 13,
							color: dim,
							display: 'flex',
							alignItems: 'center',
							gap: 6,
						}}
					>
						<span style={{ opacity: 0.6 }}>⌘K</span> Quick actions
					</div>
					<div
						style={{
							padding: '5px 15px',
							borderRadius: 6,
							background: BRAND,
							color: '#fff',
							fontSize: 13,
							fontWeight: 600,
						}}
					>
						Download
					</div>
				</div>
			</div>

			{/* Main panel */}
			<div style={{ display: 'flex', minHeight: mobile ? 300 : 420 }}>
				{/* Sidebar */}
				{!mobile && (
					<div
						style={{
							width: 270,
							background: panel,
							borderRight: `1px solid ${brd}`,
							padding: '15px 12px',
							display: 'flex',
							flexDirection: 'column',
							gap: 3,
						}}
					>
						<div
							style={{
								fontSize: 12,
								fontWeight: 700,
								color: dim,
								textTransform: 'uppercase',
								letterSpacing: '0.06em',
								padding: '6px 12px',
							}}
						>
							Resumes
						</div>
						{['Product Manager — Stripe', 'Frontend — Vercel'].map(
							(r, i) => (
								<div
									key={r}
									style={{
										padding: '9px 12px',
										borderRadius: 7,
										fontSize: 13,
										color: i === 0 ? txt : mut,
										background: i === 0 ? surf : 'transparent',
										borderLeft:
											i === 0
												? `3px solid ${BRAND}`
												: '3px solid transparent',
										display: 'flex',
										alignItems: 'center',
										gap: 9,
									}}
								>
									<div
										style={{
											width: 27,
											height: 33,
											borderRadius: 3,
											background: '#fafafa',
											border: `1px solid ${i === 0 ? BRAND + '50' : brd}`,
											flexShrink: 0,
										}}
									/>
									<span
										style={{
											whiteSpace: 'nowrap',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
										}}
									>
										{r}
									</span>
								</div>
							),
						)}
						<div
							style={{
								fontSize: 12,
								fontWeight: 700,
								color: dim,
								textTransform: 'uppercase',
								letterSpacing: '0.06em',
								padding: '12px 12px 6px',
								marginTop: 6,
							}}
						>
							Target Job
						</div>
						<div
							style={{
								padding: '8px 12px',
								borderRadius: 7,
								background: surf,
								border: `1px solid ${brd}`,
								fontSize: 13,
								color: txt,
							}}
						>
							<div style={{ fontWeight: 500 }}>Product Manager</div>
							<div style={{ fontSize: 12, color: dim, marginTop: 2 }}>
								Stripe, Inc.
							</div>
						</div>
						<div
							style={{
								fontSize: 12,
								fontWeight: 700,
								color: dim,
								textTransform: 'uppercase',
								letterSpacing: '0.06em',
								padding: '12px 12px 6px',
								marginTop: 6,
							}}
						>
							Sections
						</div>
						{['Summary', 'Experience', 'Education', 'Skills'].map(
							(s, i) => (
								<div
									key={s}
									style={{
										padding: '8px 12px',
										borderRadius: 7,
										fontSize: 13,
										color: i === 1 ? txt : mut,
										background: i === 1 ? `${BRAND}15` : 'transparent',
										borderLeft:
											i === 1
												? `3px solid ${BRAND}`
												: '3px solid transparent',
									}}
								>
									{s}
								</div>
							),
						)}
					</div>
				)}

				{/* Center — resume preview */}
				<div
					style={{
						flex: 1,
						background: bg,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						padding: mobile ? 18 : 30,
					}}
				>
					<div
						style={{
							width: mobile ? '100%' : 450,
							background: '#FAFAFA',
							borderRadius: 9,
							padding: mobile ? 27 : 32,
							boxShadow: '0 5px 36px rgba(0,0,0,0.3)',
						}}
					>
						<div
							style={{
								width: '60%',
								height: 14,
								borderRadius: 5,
								background: BRAND,
								marginBottom: 8,
								opacity: 0.8,
							}}
						/>
						<div
							style={{
								width: '45%',
								height: 9,
								borderRadius: 5,
								background: '#999',
								marginBottom: 18,
								opacity: 0.5,
							}}
						/>
						<div
							style={{
								width: '100%',
								height: 8,
								borderRadius: 5,
								background: '#ddd',
								marginBottom: 8,
							}}
						/>
						<div
							style={{
								width: '90%',
								height: 8,
								borderRadius: 5,
								background: '#ddd',
								marginBottom: 18,
							}}
						/>
						<div
							style={{
								fontSize: 12,
								fontWeight: 700,
								color: BRAND,
								textTransform: 'uppercase',
								letterSpacing: '0.05em',
								marginBottom: 9,
							}}
						>
							Experience
						</div>
						{(
							[
								['Senior PM', 'Stripe', '2022–Present'],
								['Product Lead', 'Notion', '2019–2022'],
							] as const
						).map(([role, co, date]) => (
							<div key={role} style={{ marginBottom: 14 }}>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
									}}
								>
									<span
										style={{
											fontSize: 12,
											fontWeight: 600,
											color: '#222',
										}}
									>
										{role}
									</span>
									<span style={{ fontSize: 9, color: '#999' }}>
										{date}
									</span>
								</div>
								<div
									style={{
										fontSize: 9,
										color: '#666',
										marginBottom: 5,
									}}
								>
									{co}
								</div>
								{[95, 85, 75].map((w, i) => (
									<div
										key={i}
										style={{
											width: `${w}%`,
											height: 6,
											borderRadius: 3,
											background: '#e5e5e5',
											marginBottom: 3,
										}}
									/>
								))}
							</div>
						))}
						<div
							style={{
								fontSize: 12,
								fontWeight: 700,
								color: BRAND,
								textTransform: 'uppercase',
								letterSpacing: '0.05em',
								marginBottom: 8,
								marginTop: 9,
							}}
						>
							Skills
						</div>
						<div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
							{['Product Strategy', 'SQL', 'A/B Testing', 'Figma'].map(
								s => (
									<span
										key={s}
										style={{
											padding: '3px 9px',
											borderRadius: 5,
											background: `${BRAND}15`,
											color: BRAND,
											fontSize: 9,
										}}
									>
										{s}
									</span>
								),
							)}
						</div>
					</div>
				</div>

				{/* Score panel */}
				{!mobile && (
					<div
						style={{
							width: 240,
							background: panel,
							borderLeft: `1px solid ${brd}`,
							padding: '15px 15px',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
						}}
					>
						<div
							style={{
								fontSize: 13,
								fontWeight: 600,
								color: txt,
								marginBottom: 12,
							}}
						>
							Fit Score
						</div>
						<svg width="108" height="84" viewBox="0 0 72 56">
							<path
								d={arcPath(-220, 40, 32)}
								fill="none"
								stroke={brd}
								strokeWidth="5"
								strokeLinecap="round"
							/>
							<path
								d={arcPath(-220, -220 + (260 * 87) / 100, 32)}
								fill="none"
								stroke={BRAND}
								strokeWidth="5"
								strokeLinecap="round"
								style={{
									filter: `drop-shadow(0 0 4px ${BRAND}44)`,
								}}
							/>
							<text
								x="36"
								y="32"
								textAnchor="middle"
								fill={txt}
								fontSize="18"
								fontWeight="600"
								fontFamily="system-ui"
							>
								87
							</text>
							<text
								x="36"
								y="44"
								textAnchor="middle"
								fill={dim}
								fontSize="8"
								fontFamily="system-ui"
							>
								/ 100
							</text>
						</svg>
						<span
							style={{
								fontSize: 12,
								fontWeight: 600,
								color: BRAND,
								marginTop: 3,
							}}
						>
							Great match
						</span>
						<div style={{ width: '100%', marginTop: 15 }}>
							{(
								[
									['Keywords', 90],
									['Metrics', 78],
									['Verbs', 85],
									['Length', 92],
								] as const
							).map(([l, v]) => (
								<div
									key={l}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										padding: '5px 0',
									}}
								>
									<span style={{ fontSize: 12, color: mut }}>{l}</span>
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 6,
										}}
									>
										<div
											style={{
												width: 48,
												height: 5,
												borderRadius: 3,
												background: brd,
												overflow: 'hidden',
											}}
										>
											<div
												style={{
													width: `${v}%`,
													height: '100%',
													borderRadius: 3,
													background:
														v >= 85 ? BRAND : '#30A46C',
												}}
											/>
										</div>
										<span
											style={{
												fontSize: 12,
												color: v >= 85 ? BRAND : '#30A46C',
												fontWeight: 500,
												width: 24,
												textAlign: 'right',
											}}
										>
											{v}
										</span>
									</div>
								</div>
							))}
						</div>
						<div
							style={{
								width: '100%',
								height: 1,
								background: brd,
								margin: '12px 0',
							}}
						/>
						<div
							style={{
								width: '100%',
								fontSize: 12,
								fontWeight: 600,
								color: dim,
								textTransform: 'uppercase',
								letterSpacing: '0.05em',
								marginBottom: 6,
							}}
						>
							Keywords
						</div>
						<div
							style={{
								display: 'flex',
								flexWrap: 'wrap',
								gap: 5,
								width: '100%',
							}}
						>
							{(
								[
									['SQL', '✓', '#30A46C'],
									['Figma', '✓', '#30A46C'],
									['A/B Tests', '✓', '#30A46C'],
									['GraphQL', '✗', '#E5484D'],
								] as const
							).map(([k, icon, col]) => (
								<span
									key={k}
									style={{
										fontSize: 11,
										padding: '3px 8px',
										borderRadius: 4,
										background: `${col}15`,
										color: col,
										fontWeight: 500,
										display: 'flex',
										alignItems: 'center',
										gap: 3,
									}}
								>
									{icon} {k}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
