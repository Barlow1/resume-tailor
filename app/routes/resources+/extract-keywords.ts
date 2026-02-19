import { json, type DataFunctionArgs } from '@remix-run/node'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { extractKeywordsFromJobDescription } from '~/utils/keyword-extraction.server.ts'

export async function action({ request }: DataFunctionArgs) {
	await requireUserId(request, { redirectTo: '/builder' })

	const formData = await request.formData()
	const jobId = formData.get('jobId') as string
	if (!jobId) return json({ error: 'Missing jobId' }, { status: 400 })

	const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, content: true, extractedKeywords: true } })
	if (!job) return json({ error: 'Job not found' }, { status: 404 })

	// Already has keywords — return them
	if (job.extractedKeywords) {
		return json({ extractedKeywords: job.extractedKeywords })
	}

	// No content to extract from
	if (!job.content || !job.content.trim()) {
		return json({ extractedKeywords: null })
	}

	try {
		const result = await extractKeywordsFromJobDescription(job.content, job.title)
		const extractedKeywords = result.keywords.length > 0
			? JSON.stringify({ keywords: result.keywords, primary: result.primary })
			: null

		if (extractedKeywords) {
			await prisma.job.update({ where: { id: jobId }, data: { extractedKeywords } })
		}

		return json({ extractedKeywords })
	} catch {
		return json({ error: 'Keyword extraction failed' }, { status: 500 })
	}
}
