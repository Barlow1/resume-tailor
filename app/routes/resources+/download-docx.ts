import { type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'
import { generateResumeDocx } from '~/utils/docx-generator.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const resumeId = url.searchParams.get('id')

	if (!resumeId) {
		throw new Response('Missing resume ID', { status: 400 })
	}

	// Fetch tailored resume from DB
	const quickResume = await prisma.quickTailoredResume.findUnique({
		where: { id: resumeId },
	})

	if (!quickResume) {
		throw new Response('Resume not found', { status: 404 })
	}

	const tailoredResume = JSON.parse(quickResume.tailoredResumeJson) as any

	// Generate DOCX
	const buffer = await generateResumeDocx(tailoredResume as any)

	// Create filename with timestamp
	const timestamp = new Date().toISOString().split('T')[0]
	const fileName = `resume-tailored-${timestamp}.docx`

	// Return as download
	return new Response(buffer, {
		headers: {
			'Content-Type':
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Content-Length': buffer.length.toString(),
		},
	})
}
