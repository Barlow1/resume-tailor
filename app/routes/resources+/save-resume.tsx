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

	// Determine whether to create or update based on resumeData.id
	// If resumeData.id exists, update that resume
	// If resumeData.id is missing/empty, create a new resume (ignore cookie)
	let resume
	try {
		if (resumeData.id) {
			const existingResume = await getBuilderResume(resumeData.id)

			if (existingResume) {
				// Resume exists, update it
				resume = await updateBuilderResume(userId, resumeData.id, resumeData)
			} else {
				// Resume doesn't exist, create new one
				console.log(`Resume ${resumeData.id} not found, creating new one`)
				resume = await createBuilderResume(userId, resumeData)
			}
		} else {
			// No id in data - always create a new resume
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
