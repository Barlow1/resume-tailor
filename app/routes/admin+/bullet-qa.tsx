import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData, Form } from '@remix-run/react'
import { useState } from 'react'
import { prisma } from '~/utils/db.server.ts'
import { requireAdmin } from '~/utils/permissions.server.ts'

export async function loader({ request }: DataFunctionArgs) {
	await requireAdmin(request)

	const url = new URL(request.url)
	const actionFilter = url.searchParams.get('action') ?? 'all'

	const where =
		actionFilter === 'all'
			? {}
			: actionFilter === 'pending'
				? { userAction: null }
				: { userAction: actionFilter }

	const logs = await prisma.bulletTailorLog.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		take: 50,
		include: {
			user: { select: { email: true, username: true } },
		},
	})

	return json({ logs, actionFilter })
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

function parseAiOutput(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw) as { experiences?: string[] }
		return parsed.experiences ?? []
	} catch {
		return []
	}
}

export default function BulletQAPage() {
	const { logs, actionFilter } = useLoaderData<typeof loader>()
	const [expandedId, setExpandedId] = useState<string | null>(null)
	return (
		<div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
			<h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
				Bullet Tailor QA
			</h1>

			<Form method="get" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
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
			</Form>

			<p style={{ marginBottom: '12px', color: '#666' }}>
				Showing {logs.length} records
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
						const options = parseAiOutput(log.aiOutput)

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
												options={options}
											/>
										</td>
									</tr>
								)}
							</>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

function ExpandedRow({
	log,
	options,
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
	options: string[]
}) {
	const [showJD, setShowJD] = useState(false)

	let keywords: string[] = []
	try {
		if (log.extractedKeywords) {
			keywords = JSON.parse(log.extractedKeywords) as string[]
		}
	} catch {
		// ignore
	}

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
					AI Output ({options.length} options)
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
					{options.map((option, i) => (
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
							<span>{option}</span>
							{log.selectedOption === i && (
								<span style={{ marginLeft: 'auto', color: '#16a34a' }}>
									selected
								</span>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
