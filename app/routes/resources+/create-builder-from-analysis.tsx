import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { createBuilderResume } from '~/utils/builder-resume.server.ts'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'

const defaultVisibleSections = {
	about: true,
	experience: true,
	education: true,
	skills: true,
	hobbies: true,
	personalDetails: true,
	photo: true,
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { analysisId, selectedBulletIds, bulletExperienceMap } = await request.json() as {
		analysisId: string
		selectedBulletIds: string[]
		bulletExperienceMap?: Record<string, number>
	}

	// Get analysis with resume data and feedback
	const analysis = await prisma.analysis.findUnique({
		where: { id: analysisId },
		select: {
			id: true,
			resumeData: true,
			feedback: true,
		},
	})

	if (!analysis || !analysis.resumeData) {
		return json({ error: 'Analysis or resume data not found' }, { status: 404 })
	}

	const resumeData = JSON.parse(analysis.resumeData)
	const feedback = analysis.feedback ? JSON.parse(analysis.feedback) : null

	console.log('=== CREATE BUILDER FROM ANALYSIS ===')
	console.log('Resume Data:', JSON.stringify(resumeData, null, 2))
	console.log('Number of experiences:', resumeData.experiences?.length)

	// Get selected bullets from feedback
	const selectedBullets = feedback?.suggestedBullets?.filter(
		(b: any) => selectedBulletIds.includes(b.id)
	) || []

	console.log('Selected bullets:', selectedBullets)

	// Add selected bullets to their respective experiences
	const updatedExperiences = resumeData.experiences.map((exp: any, idx: number) => {
		const bulletsForThisExp = selectedBullets.filter((b: any) => {
			// Use user's selection from bulletExperienceMap if available, otherwise fall back to AI's suggestion
			const targetExpIndex = bulletExperienceMap?.[b.id] ?? b.addToExperience
			return targetExpIndex === idx
		})

		console.log(`Experience ${idx} (${exp.company}):`)
		console.log('  Original descriptions:', exp.descriptions)
		console.log('  New bullets:', bulletsForThisExp.map((b: any) => b.content))

		// Ensure descriptions is an array of {content, order} objects
		const existingDescriptions = Array.isArray(exp.descriptions)
			? exp.descriptions
			: []

		// Get the next order number
		const nextOrder = existingDescriptions.length

		// Combine existing descriptions with new bullets
		const formattedDescriptions = [
			...existingDescriptions,
			...bulletsForThisExp.map((b: any, index: number) => ({
				content: b.content,
				order: nextOrder + index,
			}))
		]

		console.log('  Combined descriptions count:', formattedDescriptions.length)
		console.log('  Formatted descriptions:', formattedDescriptions)

		return {
			role: exp.role,
			company: exp.company,
			startDate: exp.startDate,
			endDate: exp.endDate,
			descriptions: formattedDescriptions,
		}
	})

	// Create builder resume with updated experiences
	const builderResumeData = {
		name: resumeData.name || '',
		role: resumeData.experiences?.[0]?.role || '',
		email: resumeData.email || '',
		phone: resumeData.phone || '',
		location: resumeData.location || '',
		about: resumeData.about || '',
		experiences: updatedExperiences,
		education: resumeData.education || [],
		skills: resumeData.skills?.length > 0 ? resumeData.skills : [{ name: '' }],
		hobbies: resumeData.hobbies?.length > 0 ? resumeData.hobbies : [{ name: '' }],
		visibleSections: defaultVisibleSections,
	}

	console.log('=== SENDING TO CREATEBUILDERRESUME ===')
	console.log('Builder Resume Data:', JSON.stringify(builderResumeData, null, 2))

	const builderResume = await createBuilderResume(userId, builderResumeData)

	console.log('=== CREATED BUILDER RESUME ===')
	console.log('Resume ID:', builderResume.id)
	console.log('Experiences count:', builderResume.experiences?.length)

	// Set cookie
	const cookie = await resumeCookie.serialize({
		resumeId: builderResume.id,
		downloadPDFRequested: false,
		subscribe: false,
	})

	return json(
		{ resumeId: builderResume.id },
		{
			headers: {
				'Set-Cookie': cookie,
			},
		}
	)
}
