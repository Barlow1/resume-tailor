import { json, type ActionFunctionArgs } from '@remix-run/node'
import {
	createBuilderResume,
	type ResumeData,
	updateBuilderResume,
} from '~/utils/builder-resume.server.ts'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import { getUserId } from '~/utils/auth.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const userId = await getUserId(request)

	const type = formData.get('type')

	const cookieHeader = request.headers.get('Cookie')

	if (type === 'reset') {
		return json(
			{ success: true },
			{
				headers: {
					'Set-Cookie': await resumeCookie.serialize({
						resumeId: null,
						downloadPDFRequested: false,
						subscribe: false,
					}),
				},
			},
		)
	}

	const resumeData: ResumeData = JSON.parse(
		formData.get('formData') as string,
	) as ResumeData
	const downloadPDFRequested = formData.get('downloadPDFRequested') === 'true'
	const subscribe = formData.get('subscribe') === 'true'

	// Get existing cookie data
	const { resumeId } = (await resumeCookie.parse(cookieHeader)) || {}

	// Create or update resume in database
	const resume = resumeId
		? await updateBuilderResume(userId, resumeId, resumeData)
		: await createBuilderResume(userId, resumeData)

	// Store minimal data in cookie
	const cookieData = {
		resumeId: resume.id,
		downloadPDFRequested,
		subscribe,
	}

	return json(
		{ success: true },
		{
			headers: {
				'Set-Cookie': await resumeCookie.serialize(cookieData),
			},
		},
	)
}
