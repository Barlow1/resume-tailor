import { json, type ActionFunctionArgs } from '@remix-run/node'
import {
	createBuilderResume,
	type ResumeData,
	updateBuilderResume,
	getBuilderResume,
} from '~/utils/builder-resume.server.ts'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

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

	let resumeData: ResumeData
	try {
		resumeData = JSON.parse(
			formData.get('formData') as string,
		) as ResumeData
	} catch {
		return json(
			{ success: false, error: 'Invalid resume data' },
			{ status: 400 },
		)
	}

	const downloadPDFRequested = formData.get('downloadPDFRequested') === 'true'
	const subscribe = formData.get('subscribe') === 'true'

	// Get existing cookie data
	const { resumeId } = (await resumeCookie.parse(cookieHeader)) || {}

	// Create or update resume in database
	// Check if resume exists before trying to update (defensive against stale cookies)
	let resume
	try {
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
	} catch (error) {
		console.error('save-resume: database error', error)
		return json(
			{ success: false, error: 'Failed to save resume. Please try again.' },
			{ status: 500 },
		)
	}

	// Track onboarding progress - mark resume as saved (non-critical, don't fail the save)
	if (userId) {
		try {
			await prisma.gettingStartedProgress.upsert({
				where: { ownerId: userId },
				update: { hasSavedResume: true },
				create: {
					ownerId: userId,
					hasSavedResume: true,
					hasSavedJob: false,
					hasTailoredResume: false,
					hasGeneratedResume: false,
				},
			})
		} catch (error) {
			console.error('save-resume: failed to track onboarding progress', error)
		}
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
