import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import fs from 'fs'
import path from 'path'

/**
 * Admin endpoint to download the SQLite database file
 *
 * Usage:
 * https://resumetailor.ai/admin/download-db?token=your-internal-command-token
 *
 * Or use the STUDIO_PASSWORD:
 * https://resumetailor.ai/admin/download-db?password=kodylovesyou87$
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const token = url.searchParams.get('token')
	const password = url.searchParams.get('password')

	const internalToken = process.env.INTERNAL_COMMAND_TOKEN
	const studioPassword = process.env.STUDIO_PASSWORD

	const isAuthorized =
		(token && token === internalToken) ||
		(password && password === studioPassword)

	if (!isAuthorized) {
		// Rick roll unauthorized users
		return redirect('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
	}

	// Determine database path from environment
	const dbPath = process.env.LITEFS_DIR
		? path.join(process.env.LITEFS_DIR, 'data.db')
		: process.env.DATABASE_PATH || './prisma/data.db'

	// Check if file exists
	if (!fs.existsSync(dbPath)) {
		return new Response(`Database file not found at: ${dbPath}`, {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
			},
		})
	}

	// Read the database file
	const fileBuffer = fs.readFileSync(dbPath)

	// Generate filename with timestamp
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const filename = `resumetailor-db-${timestamp}.db`

	// Return the file as a download
	return new Response(fileBuffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-sqlite3',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': fileBuffer.length.toString(),
		},
	})
}
