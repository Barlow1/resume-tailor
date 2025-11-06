import { getPdfFromHtml, uint8ArrayToBase64 } from '~/utils/pdf.server.ts'
import { type ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const html = formData.get('html')

	if (!html) {
		return json({ error: 'HTML is required' }, { status: 400 })
	}

	const pdf = await getPdfFromHtml(html as string)

	// Increment download count when PDF is successfully generated
	const userId = await getUserId(request)
	if (userId) {
		await prisma.gettingStartedProgress.upsert({
			where: { ownerId: userId },
			update: { downloadCount: { increment: 1 } },
			create: {
				ownerId: userId,
				downloadCount: 1,
				hasSavedJob: false,
				hasSavedResume: false,
				hasTailoredResume: false,
				hasGeneratedResume: false,
				tailorCount: 0,
				generateCount: 0,
			},
		})
	}

	return json({
		fileData: uint8ArrayToBase64(pdf),
		fileType: 'application/pdf',
	})
}
