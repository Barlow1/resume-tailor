import { getPdfFromHtml, uint8ArrayToBase64 } from '~/utils/pdf.server.ts'
import { type ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const html = formData.get('html')

	if (!html) {
		return json({ error: 'HTML is required' }, { status: 400 })
	}

	const pdf = await getPdfFromHtml(html as string)

	return json({
		fileData: uint8ArrayToBase64(pdf),
		fileType: 'application/pdf',
	})
}
