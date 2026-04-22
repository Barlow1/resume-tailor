import { Form, Link } from '@remix-run/react'
import {
	ChevronDown,
	Search,
	Sun,
	Moon,
	Download,
	Check,
	AlertTriangle,
	Palette,
	LogOut,
	User as UserIcon,
	CreditCard,
	HelpCircle,
} from 'lucide-react'
import { getUserImgSrc } from '~/utils/misc.ts'

export interface BuilderNavUser {
	id: string
	username: string
	name: string | null
	imageId: string | null
}

export interface BuilderNavTheme {
	border: string
	bgEl: string
	bgSurf: string
	borderSub: string
	dim: string
	muted: string
	text: string
}

export interface BuilderNavProps {
	c: BuilderNavTheme
	isDark: boolean
	scorePanel: boolean
	setScorePanel: (v: boolean) => void
	showCommandPalette: boolean
	setShowCommandPalette: (v: boolean) => void
	setCmdSearch: (v: string) => void
	setCmdSelected: (v: number) => void
	setShowTemplateGallery: (v: boolean) => void
	saveStatus: 'idle' | 'saving' | 'saved' | 'error'
	toggleDarkMode: () => void
	handleClickDownloadPDF: () => void
	user: BuilderNavUser | null | undefined
	profileOpen: boolean
	setProfileOpen: (v: boolean) => void
	profileRef: React.RefObject<HTMLDivElement>
	logoutFormRef: React.RefObject<HTMLFormElement>
	manageSubFormRef: React.RefObject<HTMLFormElement>
	submitForm: (form: HTMLFormElement | null) => void
	navigate: (to: string) => void
	onReplayWalkthrough?: () => void
	BRAND: string
	AMBER: string
	SUCCESS: string
}

export function BuilderNav({
	c,
	isDark,
	scorePanel,
	setScorePanel,
	showCommandPalette,
	setShowCommandPalette,
	setCmdSearch,
	setCmdSelected,
	setShowTemplateGallery,
	saveStatus,
	toggleDarkMode,
	handleClickDownloadPDF,
	user,
	profileOpen,
	setProfileOpen,
	profileRef,
	logoutFormRef,
	manageSubFormRef,
	submitForm,
	navigate,
	onReplayWalkthrough,
	BRAND,
	AMBER,
	SUCCESS,
}: BuilderNavProps) {
	const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
	return (
		<div
			style={{
				height: 48,
				borderBottom: `1px solid ${c.border}`,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '0 16px',
				flexShrink: 0,
				background: c.bgEl,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
				<Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
					<img
						src="/RT_Logo_stacked.png"
						alt="Resume Tailor"
						style={{ height: 28 }}
						className="dark:brightness-0 dark:invert"
					/>
				</Link>
				<Link to="/resumes" style={{ fontSize: 14, color: c.muted, textDecoration: 'none' }}>
					Resumes
				</Link>
				{/* TODO: unhide once tracker is ironed out
				<Link to="/tracker" style={{ fontSize: 14, color: c.muted, textDecoration: 'none' }}>
					Tracker
				</Link>
				*/}
			</div>
			{/* ⌘K Quick Actions */}
			<div
				onClick={() => {
					setShowCommandPalette(true)
					setCmdSearch('')
					setCmdSelected(0)
				}}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					padding: '5px 12px',
					borderRadius: 6,
					border: `1px solid ${c.border}`,
					background: c.bgSurf,
					cursor: 'pointer',
					minWidth: 200,
				}}
				onMouseEnter={e => {
					;(e.currentTarget as HTMLElement).style.borderColor = BRAND + '60'
				}}
				onMouseLeave={e => {
					;(e.currentTarget as HTMLElement).style.borderColor = c.border
				}}
			>
				<Search size={13} color={c.dim} strokeWidth={1.75} />
				<span style={{ fontSize: 12, color: c.dim, flex: 1 }}>
					Quick actions...
				</span>
				<span
					style={{
						fontSize: 10,
						color: c.dim,
						background: c.bgSurf,
						border: `1px solid ${c.borderSub}`,
						borderRadius: 3,
						padding: '1px 5px',
						fontFamily: 'system-ui',
					}}
				>
					{isMac ? '⌘K' : 'Ctrl+K'}
				</span>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<span
					style={{
						fontSize: 11,
						color:
							saveStatus === 'saving'
								? AMBER
								: saveStatus === 'saved'
								? SUCCESS
								: saveStatus === 'error'
								? '#ef4444'
								: c.dim,
						display: 'flex',
						alignItems: 'center',
						gap: 4,
						transition: 'color 300ms',
					}}
				>
					{saveStatus === 'saved' && <Check size={12} strokeWidth={2} />}
					{saveStatus === 'error' && <AlertTriangle size={12} strokeWidth={2} />}
					{saveStatus === 'saving'
						? 'Saving...'
						: saveStatus === 'saved'
						? 'Saved'
						: saveStatus === 'error'
						? 'Error'
						: ''}
				</span>
				<button
					onClick={() => setShowTemplateGallery(true)}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 6,
						padding: '5px 10px',
						borderRadius: 5,
						border: `1px solid ${c.border}`,
						background: 'transparent',
						color: c.muted,
						fontSize: 12,
						cursor: 'pointer',
					}}
				>
					<Palette size={14} color={c.dim} strokeWidth={1.75} />
					Customize
				</button>
				{onReplayWalkthrough && (
					<button
						onClick={onReplayWalkthrough}
						title="Replay walkthrough"
						style={{
							width: 32,
							height: 32,
							borderRadius: 6,
							border: 'none',
							background: 'transparent',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<HelpCircle size={16} color={c.dim} strokeWidth={1.75} />
					</button>
				)}
				<button
					onClick={toggleDarkMode}
					style={{
						width: 32,
						height: 32,
						borderRadius: 6,
						border: 'none',
						background: 'transparent',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					{isDark ? (
						<Sun size={16} color={c.dim} strokeWidth={1.75} />
					) : (
						<Moon size={16} color={c.dim} strokeWidth={1.75} />
					)}
				</button>
				<div
					style={{
						width: 1,
						height: 20,
						background: c.border,
						margin: '0 4px',
					}}
				/>
				<button
					onClick={handleClickDownloadPDF}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 6,
						padding: '6px 14px',
						borderRadius: 5,
						border: 'none',
						background: BRAND,
						color: '#fff',
						fontSize: 13,
						fontWeight: 500,
						cursor: 'pointer',
					}}
				>
					<Download size={14} strokeWidth={2} />
					Download & Track
				</button>
				{user ? (
					<div ref={profileRef} style={{ position: 'relative' }}>
						<button
							onClick={() => setProfileOpen(!profileOpen)}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								padding: '4px 10px 4px 4px',
								borderRadius: 6,
								border: `1px solid ${c.border}`,
								background: 'transparent',
								cursor: 'pointer',
								color: c.text,
								fontSize: 13,
								fontWeight: 500,
							}}
						>
							<img
								src={getUserImgSrc(user.imageId)}
								alt={user.name ?? user.username}
								style={{
									width: 28,
									height: 28,
									borderRadius: '50%',
									objectFit: 'cover' as const,
								}}
							/>
							<span
								style={{
									maxWidth: 120,
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap' as const,
								}}
							>
								{user.name ?? user.username}
							</span>
							<ChevronDown size={12} color={c.dim} />
						</button>
						{profileOpen && (
							<div
								style={{
									position: 'absolute',
									top: '100%',
									right: 0,
									marginTop: 4,
									width: 200,
									background: c.bgEl,
									border: `1px solid ${c.border}`,
									borderRadius: 8,
									boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
									zIndex: 250,
									overflow: 'hidden',
									padding: '4px 0',
								}}
							>
								<Link
									to={`/users/${user.username}`}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 8,
										padding: '8px 12px',
										color: c.text,
										fontSize: 13,
										textDecoration: 'none',
										cursor: 'pointer',
									}}
									onMouseEnter={e => {
										;(e.currentTarget as HTMLElement).style.background =
											c.bgSurf
									}}
									onMouseLeave={e => {
										;(e.currentTarget as HTMLElement).style.background =
											'transparent'
									}}
								>
									<UserIcon size={14} color={c.dim} strokeWidth={1.75} />
									Profile
								</Link>
								<Form
									action={`/resources/stripe/manage-subscription?redirectTo=${encodeURIComponent(
										'/builder',
									)}`}
									method="POST"
									ref={manageSubFormRef}
									style={{ display: 'contents' }}
								>
									<input type="hidden" name="userId" value={user.id} />
									<button
										type="button"
										onClick={() => {
											submitForm(manageSubFormRef.current)
											setProfileOpen(false)
										}}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 8,
											padding: '8px 12px',
											color: c.text,
											fontSize: 13,
											background: 'transparent',
											border: 'none',
											width: '100%',
											textAlign: 'left' as const,
											cursor: 'pointer',
										}}
										onMouseEnter={e => {
											;(e.currentTarget as HTMLElement).style.background =
												c.bgSurf
										}}
										onMouseLeave={e => {
											;(e.currentTarget as HTMLElement).style.background =
												'transparent'
										}}
									>
										<CreditCard size={14} color={c.dim} strokeWidth={1.75} />
										Manage Subscription
									</button>
								</Form>
								<div
									style={{ height: 1, background: c.border, margin: '4px 0' }}
								/>
								<Form
									action="/logout"
									method="POST"
									ref={logoutFormRef}
									style={{ display: 'contents' }}
								>
									<button
										type="button"
										onClick={() => {
											submitForm(logoutFormRef.current)
											setProfileOpen(false)
										}}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 8,
											padding: '8px 12px',
											color: c.text,
											fontSize: 13,
											background: 'transparent',
											border: 'none',
											width: '100%',
											textAlign: 'left' as const,
											cursor: 'pointer',
										}}
										onMouseEnter={e => {
											;(e.currentTarget as HTMLElement).style.background =
												c.bgSurf
										}}
										onMouseLeave={e => {
											;(e.currentTarget as HTMLElement).style.background =
												'transparent'
										}}
									>
										<LogOut size={14} color={c.dim} strokeWidth={1.75} />
										Logout
									</button>
								</Form>
							</div>
						)}
					</div>
				) : (
					<button
						onClick={() => navigate('/login?redirectTo=/builder')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							padding: '6px 14px',
							borderRadius: 5,
							border: `1px solid ${c.border}`,
							background: 'transparent',
							color: c.text,
							fontSize: 13,
							fontWeight: 500,
							cursor: 'pointer',
						}}
					>
						Log in
					</button>
				)}
			</div>
		</div>
	)
}
