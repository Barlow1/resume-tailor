import { type DataFunctionArgs } from '@remix-run/node'
import * as XLSX from 'xlsx'
import { prisma } from '~/utils/db.server.ts'
import { requireAdmin } from '~/utils/permissions.server.ts'

export async function loader({ request }: DataFunctionArgs) {
	await requireAdmin(request)

	const url = new URL(request.url)
	const actionFilter = url.searchParams.get('action') ?? 'all'
	const startDate = url.searchParams.get('startDate')
	const endDate = url.searchParams.get('endDate')

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
			const end = new Date(endDate)
			end.setDate(end.getDate() + 1)
			;(where.createdAt as Record<string, Date>).lt = end
		}
	}

	const logs = await prisma.bulletTailorLog.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		include: {
			user: { select: { email: true, username: true } },
		},
	})

	// Transform data for Excel
	const data = logs.map(log => {
		let aiOptions: string[] = []
		let angles: string[] = []
		let keywordCoverage = ''
		let weakBulletFlag = ''
		let coverageGapFlag = ''
		try {
			const parsed = JSON.parse(log.aiOutput) as Record<string, unknown>
			if (parsed.options && Array.isArray(parsed.options)) {
				// v2 format: { options: [{ angle, bullet }], keyword_coverage_note, ... }
				const options = parsed.options as Array<{ angle?: string; bullet?: string }>
				aiOptions = options.map(o => o.bullet ?? '')
				angles = options.map(o => o.angle ?? '')
				keywordCoverage = (parsed.keyword_coverage_note as string) ?? ''
				weakBulletFlag = (parsed.weak_bullet_flag as string) ?? ''
				coverageGapFlag = (parsed.coverage_gap_flag as string) ?? ''
			} else if (parsed.experiences && Array.isArray(parsed.experiences)) {
				// v1 format: { experiences: string[] }
				aiOptions = parsed.experiences as string[]
			}
		} catch {
			// ignore
		}

		return {
			Date: new Date(log.createdAt).toLocaleString(),
			User: log.user.username,
			Email: log.user.email,
			'Job Title': log.jobTitle ?? '',
			'Current Role': log.currentJobTitle ?? '',
			'Current Company': log.currentJobCompany ?? '',
			'Original Bullet': log.originalBullet,
			'AI Option 1': aiOptions[0] ?? '',
			'Angle 1': angles[0] ?? '',
			'AI Option 2': aiOptions[1] ?? '',
			'Angle 2': angles[1] ?? '',
			'AI Option 3': aiOptions[2] ?? '',
			'Angle 3': angles[2] ?? '',
			'Weak Bullet Flag': weakBulletFlag,
			'Coverage Gap Flag': coverageGapFlag,
			'Keyword Coverage': keywordCoverage,
			'Selected Option': log.selectedOption != null ? log.selectedOption + 1 : '',
			'User Action': log.userAction ?? 'pending',
			'Prompt Version': log.promptVersion ?? '',
			'Job Description': log.jobDescription,
		}
	})

	// Create workbook
	const worksheet = XLSX.utils.json_to_sheet(data)
	const workbook = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Bullet QA')

	// Set column widths
	worksheet['!cols'] = [
		{ wch: 18 }, // Date
		{ wch: 15 }, // User
		{ wch: 25 }, // Email
		{ wch: 25 }, // Job Title
		{ wch: 20 }, // Current Role
		{ wch: 20 }, // Current Company
		{ wch: 60 }, // Original Bullet
		{ wch: 60 }, // AI Option 1
		{ wch: 14 }, // Angle 1
		{ wch: 60 }, // AI Option 2
		{ wch: 14 }, // Angle 2
		{ wch: 60 }, // AI Option 3
		{ wch: 14 }, // Angle 3
		{ wch: 50 }, // Weak Bullet Flag
		{ wch: 50 }, // Coverage Gap Flag
		{ wch: 60 }, // Keyword Coverage
		{ wch: 12 }, // Selected Option
		{ wch: 12 }, // User Action
		{ wch: 12 }, // Prompt Version
		{ wch: 80 }, // Job Description
	]

	// Generate buffer
	const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

	// Create filename with date range
	const dateStr = new Date().toISOString().split('T')[0]
	let filename = `bullet-qa-export-${dateStr}`
	if (startDate) filename += `-from-${startDate}`
	if (endDate) filename += `-to-${endDate}`
	filename += '.xlsx'

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	})
}
