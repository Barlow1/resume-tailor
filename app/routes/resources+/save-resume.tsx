import { json, type ActionFunctionArgs } from '@remix-run/node'
import {
	createBuilderResume,
	type ResumeData,
	updateBuilderResume,
	getBuilderResume,
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
	// Check if resume exists before trying to update (defensive against stale cookies)
	let resume
	if (resumeId) {
		const existingResume = await getBuilderResume(resumeId)

		if (existingResume) {
			// Resume exists, update it
			resume = await updateBuilderResume(userId, resumeId, resumeData)
		} else {
			// Resume doesn't exist (stale cookie), create new one instead
			console.log(`Resume ${resumeId} not found, creating new one`)
			resume = await createBuilderResume(userId, resumeData)
		}
	} else {
		// No resumeId in cookie, create new resume
		resume = await createBuilderResume(userId, resumeData)
	}

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
