import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData, Form, Link } from '@remix-run/react'
import { useState } from 'react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { prisma } from '~/utils/db.server.ts'
import { requireAdmin } from '~/utils/permissions.server.ts'
import { parseKeywordsFlat } from '~/utils/keyword-utils.ts'

const PAGE_SIZE = 50

export async function loader({ request }: DataFunctionArgs) {
	await requireAdmin(request)

	const url = new URL(request.url)
	const actionFilter = url.searchParams.get('action') ?? 'all'
	const startDate = url.searchParams.get('startDate')
	const endDate = url.searchParams.get('endDate')
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))

	const where: Record<string, unknown> = {}

	// Action filter
	if (actionFilter === 'pending') {
		where.userAction = null
	} else if (actionFilter !== 'all') {
		where.userAction = actionFilter
	}

	// Date range filter
	if (startDate || endDate) {
		where.createdAt = {}
		if (startDate) {
			;(where.createdAt as Record<string, Date>).gte = new Date(startDate)
		}
		if (endDate) {
			// Add 1 day to include the end date fully
			const end = new Date(endDate)
			end.setDate(end.getDate() + 1)
			;(where.createdAt as Record<string, Date>).lt = end
		}
	}

	const [logs, totalCount] = await Promise.all([
		prisma.bulletTailorLog.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: PAGE_SIZE,
			skip: (page - 1) * PAGE_SIZE,
			include: {
				user: { select: { email: true, username: true } },
			},
		}),
		prisma.bulletTailorLog.count({ where }),
	])

	const totalPages = Math.ceil(totalCount / PAGE_SIZE)

	return json({ logs, actionFilter, startDate, endDate, page, totalPages, totalCount })
}

function formatDate(dateStr: string) {
	const d = new Date(dateStr)
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

interface ParsedAiOutput {
	options: Array<{ angle?: string; bullet: string }>
	keyword_coverage_note: string
	weak_bullet_flag: string | null
	coverage_gap_flag: string | null
}

function parseAiOutput(raw: string): ParsedAiOutput {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>
		if (parsed.options && Array.isArray(parsed.options)) {
			// v2 format
			return {
				options: (parsed.options as Array<{ angle?: string; bullet?: string }>).map(o => ({
					angle: o.angle,
					bullet: o.bullet ?? '',
				})),
				keyword_coverage_note: (parsed.keyword_coverage_note as string) ?? '',
				weak_bullet_flag: (parsed.weak_bullet_flag as string) ?? null,
				coverage_gap_flag: (parsed.coverage_gap_flag as string) ?? null,
			}
		} else if (parsed.experiences && Array.isArray(parsed.experiences)) {
			// v1 format
			return {
				options: (parsed.experiences as string[]).map(bullet => ({ bullet })),
				keyword_coverage_note: '',
				weak_bullet_flag: null,
				coverage_gap_flag: null,
			}
		}
	} catch {
		// ignore
	}
	return { options: [], keyword_coverage_note: '', weak_bullet_flag: null, coverage_gap_flag: null }
}

export default function BulletQAPage() {
	const { logs, actionFilter, startDate, endDate, page, totalPages, totalCount } = useLoaderData<typeof loader>()
	const [expandedId, setExpandedId] = useState<string | null>(null)

	// Build export URL with current filters
	const exportParams = new URLSearchParams()
	if (actionFilter && actionFilter !== 'all') exportParams.set('action', actionFilter)
	if (startDate) exportParams.set('startDate', startDate)
	if (endDate) exportParams.set('endDate', endDate)
	const exportUrl = `/admin/bullet-qa-export?${exportParams.toString()}`

	// Build pagination URL helper
	const buildPageUrl = (pageNum: number) => {
		const params = new URLSearchParams()
		params.set('page', String(pageNum))
		if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter)
		if (startDate) params.set('startDate', startDate)
		if (endDate) params.set('endDate', endDate)
		return `/admin/bullet-qa?${params.toString()}`
	}

	return (
		<div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
					Bullet Tailor QA
				</h1>
				<a
					href={exportUrl}
					style={{
						padding: '8px 16px',
						background: '#16a34a',
						color: '#fff',
						borderRadius: '4px',
						textDecoration: 'none',
						fontWeight: 500,
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
					}}
				>
					<ArrowDownTrayIcon style={{ width: '18px', height: '18px' }} />
					Export to Excel
				</a>
			</div>

			<Form method="get" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
				{/* Date Range */}
				<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
					<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						From:
						<input
							type="date"
							name="startDate"
							defaultValue={startDate ?? ''}
							style={{
								padding: '6px 10px',
								border: '1px solid #ccc',
								borderRadius: '4px',
							}}
						/>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						To:
						<input
							type="date"
							name="endDate"
							defaultValue={endDate ?? ''}
							style={{
								padding: '6px 10px',
								border: '1px solid #ccc',
								borderRadius: '4px',
							}}
						/>
					</label>
					<button
						type="submit"
						style={{
							padding: '6px 12px',
							background: '#333',
							color: '#fff',
							border: 'none',
							borderRadius: '4px',
							cursor: 'pointer',
						}}
					>
						Apply
					</button>
					{(startDate || endDate) && (
						<Link
							to={`/admin/bullet-qa?action=${actionFilter}`}
							style={{ color: '#666', fontSize: '14px' }}
						>
							Clear dates
						</Link>
					)}
				</div>

				{/* Action Filter */}
				<div style={{ display: 'flex', gap: '8px' }}>
					{/* Preserve date params when changing action filter */}
					{startDate && <input type="hidden" name="startDate" value={startDate} />}
					{endDate && <input type="hidden" name="endDate" value={endDate} />}
					{['all', 'accepted', 'abandoned', 'pending'].map(action => (
						<button
							key={action}
							type="submit"
							name="action"
							value={action}
							style={{
								padding: '6px 12px',
								border: '1px solid #ccc',
								borderRadius: '4px',
								background: actionFilter === action ? '#333' : '#fff',
								color: actionFilter === action ? '#fff' : '#333',
								cursor: 'pointer',
							}}
						>
							{action}
						</button>
					))}
				</div>
			</Form>

			<p style={{ marginBottom: '12px', color: '#666' }}>
				Showing {logs.length} of {totalCount} records (page {page} of {totalPages})
				{(startDate || endDate) && (
					<span>
						{' '}from {startDate || 'beginning'} to {endDate || 'now'}
					</span>
				)}
			</p>

			<table style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead>
					<tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
						<th style={{ padding: '8px' }}>Date</th>
						<th style={{ padding: '8px' }}>User</th>
						<th style={{ padding: '8px' }}>Job Title</th>
						<th style={{ padding: '8px' }}>Role</th>
						<th style={{ padding: '8px' }}>Action</th>
						<th style={{ padding: '8px' }}>Pick</th>
					</tr>
				</thead>
				<tbody>
					{logs.map(log => {
						const isExpanded = expandedId === log.id
						const aiOutput = parseAiOutput(log.aiOutput)

						return (
							<>
								<tr
									key={log.id}
									onClick={() =>
										setExpandedId(isExpanded ? null : log.id)
									}
									style={{
										borderBottom: '1px solid #eee',
										cursor: 'pointer',
										background: isExpanded ? '#f9f9f9' : 'transparent',
									}}
								>
									<td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
										{formatDate(log.createdAt)}
									</td>
									<td style={{ padding: '8px' }}>
										{log.user.username}
									</td>
									<td
										style={{
											padding: '8px',
											maxWidth: '200px',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{log.jobTitle ?? '-'}
									</td>
									<td
										style={{
											padding: '8px',
											maxWidth: '150px',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{log.currentJobTitle ?? '-'}
									</td>
									<td style={{ padding: '8px' }}>
										<span
											style={{
												padding: '2px 8px',
												borderRadius: '12px',
												fontSize: '12px',
												fontWeight: 500,
												background:
													log.userAction === 'accepted'
														? '#dcfce7'
														: log.userAction === 'abandoned'
															? '#fee2e2'
															: '#f3f4f6',
												color:
													log.userAction === 'accepted'
														? '#166534'
														: log.userAction === 'abandoned'
															? '#991b1b'
															: '#6b7280',
											}}
										>
											{log.userAction ?? 'pending'}
										</span>
									</td>
									<td style={{ padding: '8px' }}>
										{log.selectedOption != null
											? `#${log.selectedOption + 1}`
											: '-'}
									</td>
								</tr>
								{isExpanded && (
									<tr key={`${log.id}-detail`}>
										<td
											colSpan={6}
											style={{
												padding: '16px',
												background: '#fafafa',
												borderBottom: '2px solid #ddd',
											}}
										>
											<ExpandedRow
												log={log}
												aiOutput={aiOutput}
											/>
										</td>
									</tr>
								)}
							</>
						)
					})}
				</tbody>
			</table>

			{/* Pagination */}
			{totalPages > 1 && (
				<div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
					{page > 1 && (
						<Link
							to={buildPageUrl(page - 1)}
							style={{
								padding: '8px 12px',
								border: '1px solid #ccc',
								borderRadius: '4px',
								textDecoration: 'none',
								color: '#333',
							}}
						>
							← Previous
						</Link>
					)}

					{/* Page numbers */}
					{Array.from({ length: totalPages }, (_, i) => i + 1)
						.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
						.map((p, idx, arr) => {
							// Add ellipsis if there's a gap
							const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1
							return (
								<span key={p} style={{ display: 'flex', gap: '8px' }}>
									{showEllipsisBefore && <span style={{ padding: '8px 4px' }}>...</span>}
									<Link
										to={buildPageUrl(p)}
										style={{
											padding: '8px 12px',
											border: '1px solid #ccc',
											borderRadius: '4px',
											textDecoration: 'none',
											background: p === page ? '#333' : '#fff',
											color: p === page ? '#fff' : '#333',
										}}
									>
										{p}
									</Link>
								</span>
							)
						})}

					{page < totalPages && (
						<Link
							to={buildPageUrl(page + 1)}
							style={{
								padding: '8px 12px',
								border: '1px solid #ccc',
								borderRadius: '4px',
								textDecoration: 'none',
								color: '#333',
							}}
						>
							Next →
						</Link>
					)}
				</div>
			)}
		</div>
	)
}

const ANGLE_COLORS: Record<string, { bg: string; text: string }> = {
	Impact: { bg: '#d1fae5', text: '#065f46' },
	Alignment: { bg: '#dbeafe', text: '#1e40af' },
	Transferable: { bg: '#ede9fe', text: '#5b21b6' },
}

function ExpandedRow({
	log,
	aiOutput,
}: {
	log: {
		originalBullet: string
		jobDescription: string
		jobTitle: string | null
		currentJobTitle: string | null
		currentJobCompany: string | null
		extractedKeywords: string | null
		selectedOption: number | null
		promptVersion: string | null
	}
	aiOutput: ParsedAiOutput
}) {
	const [showJD, setShowJD] = useState(false)

	const keywords: string[] = parseKeywordsFlat(log.extractedKeywords) ?? []

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			{/* Original bullet */}
			<div>
				<h4 style={{ fontWeight: 600, marginBottom: '4px' }}>
					Original Bullet
					{log.currentJobTitle && (
						<span style={{ fontWeight: 400, color: '#666' }}>
							{' '}
							({log.currentJobTitle}
							{log.currentJobCompany
								? ` at ${log.currentJobCompany}`
								: ''}
							)
						</span>
					)}
				</h4>
				<p
					style={{
						padding: '8px',
						background: '#fff',
						border: '1px solid #ddd',
						borderRadius: '4px',
					}}
				>
					{log.originalBullet}
				</p>
			</div>

			{/* Job description (collapsible) */}
			<div>
				<button
					onClick={() => setShowJD(!showJD)}
					style={{
						fontWeight: 600,
						cursor: 'pointer',
						background: 'none',
						border: 'none',
						padding: 0,
						textDecoration: 'underline',
					}}
				>
					{showJD ? 'Hide' : 'Show'} Job Description
					{log.jobTitle && ` (${log.jobTitle})`}
				</button>
				{showJD && (
					<pre
						style={{
							marginTop: '8px',
							padding: '8px',
							background: '#fff',
							border: '1px solid #ddd',
							borderRadius: '4px',
							whiteSpace: 'pre-wrap',
							fontSize: '13px',
							maxHeight: '300px',
							overflow: 'auto',
						}}
					>
						{log.jobDescription}
					</pre>
				)}
			</div>

			{/* Keywords */}
			{keywords.length > 0 && (
				<div>
					<h4 style={{ fontWeight: 600, marginBottom: '4px' }}>
						Extracted Keywords
					</h4>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
						{keywords.map((kw, i) => (
							<span
								key={i}
								style={{
									padding: '2px 8px',
									background: '#e0e7ff',
									borderRadius: '4px',
									fontSize: '12px',
								}}
							>
								{kw}
							</span>
						))}
					</div>
				</div>
			)}

			{/* AI Options */}
			<div>
				<h4 style={{ fontWeight: 600, marginBottom: '4px' }}>
					AI Output ({aiOutput.options.length} options)
					{log.promptVersion && (
						<span
							style={{ fontWeight: 400, color: '#666', fontSize: '12px' }}
						>
							{' '}
							prompt: {log.promptVersion}
						</span>
					)}
				</h4>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '4px',
					}}
				>
					{aiOutput.options.map((option, i) => {
						const angleColors = option.angle ? ANGLE_COLORS[option.angle] : null
						return (
							<div
								key={i}
								style={{
									padding: '8px',
									background:
										log.selectedOption === i ? '#dcfce7' : '#fff',
									border:
										log.selectedOption === i
											? '2px solid #16a34a'
											: '1px solid #ddd',
									borderRadius: '4px',
									display: 'flex',
									gap: '8px',
									alignItems: 'flex-start',
								}}
							>
								<span
									style={{
										fontWeight: 600,
										color: '#999',
										minWidth: '20px',
									}}
								>
									{i + 1}.
								</span>
								{option.angle && angleColors && (
									<span
										style={{
											padding: '2px 8px',
											borderRadius: '12px',
											fontSize: '11px',
											fontWeight: 600,
											background: angleColors.bg,
											color: angleColors.text,
											whiteSpace: 'nowrap',
										}}
									>
										{option.angle}
									</span>
								)}
								<span style={{ flex: 1 }}>{option.bullet}</span>
								{log.selectedOption === i && (
									<span style={{ marginLeft: 'auto', color: '#16a34a', whiteSpace: 'nowrap' }}>
										selected
									</span>
								)}
							</div>
						)
					})}
				</div>
			</div>

			{/* v2 flags */}
			{aiOutput.weak_bullet_flag && (
				<div
					style={{
						padding: '8px 12px',
						background: '#fffbeb',
						border: '1px solid #fde68a',
						borderRadius: '4px',
						fontSize: '13px',
					}}
				>
					<strong>Suggestion:</strong> {aiOutput.weak_bullet_flag}
				</div>
			)}
			{aiOutput.coverage_gap_flag && (
				<div
					style={{
						padding: '8px 12px',
						background: '#fff1f2',
						border: '1px solid #fecdd3',
						borderRadius: '4px',
						fontSize: '13px',
					}}
				>
					<strong>Gap:</strong> {aiOutput.coverage_gap_flag}
				</div>
			)}
			{aiOutput.keyword_coverage_note && (
				<div
					style={{
						padding: '8px 12px',
						background: '#f0f9ff',
						border: '1px solid #bae6fd',
						borderRadius: '4px',
						fontSize: '13px',
					}}
				>
					<strong>Keyword coverage:</strong> {aiOutput.keyword_coverage_note}
				</div>
			)}
		</div>
	)
}
