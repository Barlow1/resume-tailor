import { useState, useRef, useEffect } from 'react'
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useFetcher, Link } from '@remix-run/react'
import { MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { getUserId } from '~/utils/auth.server.ts'
import { getUserApplications } from '~/utils/application.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return redirect('/login')
	const applications = await getUserApplications(userId)
	return json({ applications })
}

const statusOptions = [
	{ value: 'applied', label: 'Applied' },
	{ value: 'interviewing', label: 'Interviewing' },
	{ value: 'offered', label: 'Offered' },
	{ value: 'rejected', label: 'Rejected' },
	{ value: 'no_response', label: 'No Response' },
] as const

const statusDotColors: Record<string, string> = {
	applied: '#c9c3d9',
	interviewing: '#5e34f2',
	offered: '#8c3900',
	rejected: '#ba1a1a',
	no_response: '#797488',
}

const matchBadgeStyles: Record<string, React.CSSProperties> = {
	strong: {
		background: '#6B45FF',
		color: 'white',
		padding: '2px 10px',
		borderRadius: 6,
		fontSize: 12,
		fontWeight: 600,
		display: 'inline-block',
	},
	moderate: {
		background: '#e6e0ef',
		color: '#484456',
		padding: '2px 10px',
		borderRadius: 6,
		fontSize: 12,
		fontWeight: 600,
		display: 'inline-block',
	},
	weak: {
		background: '#ffdad6',
		color: '#93000a',
		padding: '2px 10px',
		borderRadius: 6,
		fontSize: 12,
		fontWeight: 600,
		display: 'inline-block',
	},
	mismatch: {
		background: '#e6e0ef',
		color: '#484456',
		padding: '2px 10px',
		borderRadius: 6,
		fontSize: 12,
		fontWeight: 600,
		display: 'inline-block',
	},
}

function formatDate(dateString: string) {
	const date = new Date(dateString)
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

function formatStatus(status: string) {
	const option = statusOptions.find((o) => o.value === status)
	return option?.label ?? status
}

function StatusDropdown({
	applicationId,
	currentStatus,
}: {
	applicationId: string
	currentStatus: string
}) {
	const fetcher = useFetcher()
	const [isOpen, setIsOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const optimisticStatus =
		fetcher.state !== 'idle' && fetcher.json
			? (fetcher.json as { status: string }).status
			: currentStatus

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	function handleStatusChange(newStatus: string) {
		setIsOpen(false)
		if (newStatus === optimisticStatus) return
		fetcher.submit(
			{ intent: 'update-status', applicationId, status: newStatus },
			{
				method: 'POST',
				action: '/resources/applications',
				encType: 'application/json',
			},
		)
	}

	return (
		<div ref={dropdownRef} style={{ position: 'relative' }}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					padding: '6px 12px',
					background: 'transparent',
					border: '1px solid #e0dce8',
					borderRadius: 8,
					cursor: 'pointer',
					fontSize: 13,
					fontWeight: 500,
					color: '#1c1a25',
					fontFamily: 'Manrope, sans-serif',
				}}
			>
				<span
					style={{
						width: 8,
						height: 8,
						borderRadius: '50%',
						background: statusDotColors[optimisticStatus] ?? '#c9c3d9',
						flexShrink: 0,
					}}
				/>
				{formatStatus(optimisticStatus)}
				<ChevronRight
					size={14}
					style={{
						transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
						transition: 'transform 0.15s',
						color: '#797488',
					}}
				/>
			</button>
			{isOpen && (
				<div
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						marginTop: 4,
						background: '#ffffff',
						border: '1px solid #e0dce8',
						borderRadius: 8,
						boxShadow: '0 8px 24px rgba(28,26,37,0.12)',
						zIndex: 10,
						minWidth: 160,
						overflow: 'hidden',
					}}
				>
					{statusOptions.map((option) => (
						<button
							key={option.value}
							onClick={() => handleStatusChange(option.value)}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								width: '100%',
								padding: '10px 16px',
								background:
									optimisticStatus === option.value
										? '#f7f1ff'
										: 'transparent',
								border: 'none',
								cursor: 'pointer',
								fontSize: 13,
								fontWeight: 500,
								color: '#1c1a25',
								fontFamily: 'Manrope, sans-serif',
								textAlign: 'left',
							}}
							onMouseEnter={(e) => {
								if (optimisticStatus !== option.value) {
									e.currentTarget.style.background = '#f7f1ff'
								}
							}}
							onMouseLeave={(e) => {
								if (optimisticStatus !== option.value) {
									e.currentTarget.style.background = 'transparent'
								}
							}}
						>
							<span
								style={{
									width: 8,
									height: 8,
									borderRadius: '50%',
									background: statusDotColors[option.value],
									flexShrink: 0,
								}}
							/>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

function ActionsDropdown({
	applicationId,
	resumeId,
}: {
	applicationId: string
	resumeId: string
}) {
	const fetcher = useFetcher()
	const [isOpen, setIsOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	function handleDelete() {
		setIsOpen(false)
		fetcher.submit(
			{ intent: 'delete', applicationId },
			{
				method: 'POST',
				action: '/resources/applications',
				encType: 'application/json',
			},
		)
	}

	return (
		<div ref={dropdownRef} style={{ position: 'relative' }}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: 32,
					height: 32,
					background: 'transparent',
					border: 'none',
					borderRadius: 6,
					cursor: 'pointer',
					color: '#797488',
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = '#f7f1ff'
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = 'transparent'
				}}
			>
				<MoreHorizontal size={18} />
			</button>
			{isOpen && (
				<div
					style={{
						position: 'absolute',
						top: '100%',
						right: 0,
						marginTop: 4,
						background: '#ffffff',
						border: '1px solid #e0dce8',
						borderRadius: 8,
						boxShadow: '0 8px 24px rgba(28,26,37,0.12)',
						zIndex: 10,
						minWidth: 150,
						overflow: 'hidden',
					}}
				>
					<Link
						to={`/builder?resumeId=${resumeId}`}
						style={{
							display: 'block',
							padding: '10px 16px',
							fontSize: 13,
							fontWeight: 500,
							color: '#1c1a25',
							textDecoration: 'none',
							fontFamily: 'Manrope, sans-serif',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = '#f7f1ff'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'transparent'
						}}
						onClick={() => setIsOpen(false)}
					>
						View Resume
					</Link>
					<button
						onClick={handleDelete}
						style={{
							display: 'block',
							width: '100%',
							padding: '10px 16px',
							background: 'transparent',
							border: 'none',
							cursor: 'pointer',
							fontSize: 13,
							fontWeight: 500,
							color: '#ba1a1a',
							fontFamily: 'Manrope, sans-serif',
							textAlign: 'left',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = '#ffdad6'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'transparent'
						}}
					>
						Delete
					</button>
				</div>
			)}
		</div>
	)
}

export default function TrackerPage() {
	const { applications } = useLoaderData<typeof loader>()

	const columns = [
		'Company Name',
		'Role Title',
		'Match Level',
		'Date Applied',
		'Status',
		'Actions',
	]

	return (
		<div
			style={{
				minHeight: '100vh',
				background: '#faf9fc',
				fontFamily: 'Manrope, sans-serif',
			}}
		>
			{/* Nav bar */}
			<nav
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '12px 32px',
					background: '#ffffff',
					borderBottom: '1px solid #e0dce8',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
					<Link
						to="/"
						style={{
							fontSize: 18,
							fontWeight: 800,
							color: '#6B45FF',
							textDecoration: 'none',
							letterSpacing: '-0.02em',
						}}
					>
						Resume Tailor
					</Link>
					<div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
						<Link
							to="/builder"
							style={{
								fontSize: 14,
								fontWeight: 500,
								color: '#555f6d',
								textDecoration: 'none',
							}}
						>
							Resumes
						</Link>
						<Link
							to="/tracker"
							style={{
								fontSize: 14,
								fontWeight: 600,
								color: '#6B45FF',
								textDecoration: 'none',
							}}
						>
							Tracker
						</Link>
					</div>
				</div>
			</nav>

			{/* Main content */}
			<main
				style={{
					maxWidth: 1200,
					margin: '0 auto',
					padding: '48px 24px',
				}}
			>
				{/* Header */}
				<div style={{ marginBottom: 32 }}>
					<h1
						style={{
							fontFamily: 'Manrope, sans-serif',
							fontSize: 36,
							fontWeight: 800,
							letterSpacing: '-0.02em',
							color: '#1c1a25',
							margin: 0,
						}}
					>
						Application Tracker
					</h1>
					<p
						style={{
							fontSize: 18,
							color: '#555f6d',
							maxWidth: 600,
							marginTop: 8,
							marginBottom: 0,
						}}
					>
						Track your job applications and stay on top of your search.
					</p>
				</div>

				{applications.length === 0 ? (
					/* Empty state */
					<div
						style={{
							background: '#ffffff',
							borderRadius: 12,
							padding: '64px 24px',
							textAlign: 'center',
							boxShadow:
								'0 32px 48px -12px rgba(28,26,37,0.04)',
						}}
					>
						<p
							style={{
								fontSize: 18,
								fontWeight: 600,
								color: '#484456',
								margin: 0,
							}}
						>
							No applications tracked yet
						</p>
						<Link
							to="/builder"
							style={{
								display: 'inline-block',
								marginTop: 16,
								fontSize: 14,
								fontWeight: 600,
								color: '#6B45FF',
								textDecoration: 'none',
							}}
						>
							Start by tailoring a resume
						</Link>
					</div>
				) : (
					<>
						{/* Table */}
						<div
							style={{
								background: '#ffffff',
								borderRadius: 12,
								overflow: 'hidden',
								boxShadow:
									'0 32px 48px -12px rgba(28,26,37,0.04)',
							}}
						>
							<table
								style={{
									width: '100%',
									borderCollapse: 'collapse',
								}}
							>
								<thead>
									<tr style={{ background: '#f7f1ff' }}>
										{columns.map((col) => (
											<th
												key={col}
												style={{
													padding: '20px 32px',
													fontSize: 11,
													fontWeight: 600,
													textTransform: 'uppercase' as const,
													letterSpacing: '0.06em',
													color: '#484456',
													textAlign: 'left',
													borderBottom: '1px solid #e0dce8',
												}}
											>
												{col}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{applications.map((app) => (
										<tr
											key={app.id}
											style={{ cursor: 'default' }}
											onMouseEnter={(e) => {
												e.currentTarget.style.background =
													'#f7f1ff'
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background =
													'transparent'
											}}
										>
											<td
												style={{
													padding: '24px 32px',
													fontSize: 14,
													fontWeight: 600,
													color: '#1c1a25',
													borderBottom:
														'1px solid #f0ecf5',
												}}
											>
												{app.job.company}
											</td>
											<td
												style={{
													padding: '24px 32px',
													fontSize: 14,
													color: '#484456',
													borderBottom:
														'1px solid #f0ecf5',
												}}
											>
												{app.job.title}
											</td>
											<td
												style={{
													padding: '24px 32px',
													borderBottom:
														'1px solid #f0ecf5',
												}}
											>
												<span
													style={
														matchBadgeStyles[
															app.matchLevel
														] ??
														matchBadgeStyles.moderate
													}
												>
													{app.matchLevel.charAt(0).toUpperCase() +
														app.matchLevel.slice(1)}
												</span>
											</td>
											<td
												style={{
													padding: '24px 32px',
													fontSize: 14,
													color: '#555f6d',
													borderBottom:
														'1px solid #f0ecf5',
												}}
											>
												{formatDate(app.appliedAt)}
											</td>
											<td
												style={{
													padding: '24px 32px',
													borderBottom:
														'1px solid #f0ecf5',
												}}
											>
												<StatusDropdown
													applicationId={app.id}
													currentStatus={app.status}
												/>
											</td>
											<td
												style={{
													padding: '24px 32px',
													borderBottom:
														'1px solid #f0ecf5',
												}}
											>
												<ActionsDropdown
													applicationId={app.id}
													resumeId={app.resumeId}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Pagination footer */}
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								marginTop: 16,
								padding: '0 8px',
							}}
						>
							<span
								style={{
									fontSize: 13,
									color: '#797488',
								}}
							>
								Showing {applications.length} of{' '}
								{applications.length} applications
							</span>
							<div
								style={{
									display: 'flex',
									gap: 8,
								}}
							>
								<button
									disabled
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 4,
										padding: '6px 12px',
										background: 'transparent',
										border: '1px solid #e0dce8',
										borderRadius: 6,
										cursor: 'not-allowed',
										fontSize: 13,
										fontWeight: 500,
										color: '#c9c3d9',
										fontFamily: 'Manrope, sans-serif',
									}}
								>
									<ChevronLeft size={14} />
									Previous
								</button>
								<button
									disabled
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 4,
										padding: '6px 12px',
										background: 'transparent',
										border: '1px solid #e0dce8',
										borderRadius: 6,
										cursor: 'not-allowed',
										fontSize: 13,
										fontWeight: 500,
										color: '#c9c3d9',
										fontFamily: 'Manrope, sans-serif',
									}}
								>
									Next
									<ChevronRight size={14} />
								</button>
							</div>
						</div>
					</>
				)}
			</main>
		</div>
	)
}
