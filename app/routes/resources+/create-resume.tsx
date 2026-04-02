import { type DataFunctionArgs, redirectDocument, json } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { parseResumeWithOpenAI, ResumeParseError } from '~/utils/openai-resume-parser.server.ts'
import {
	createBuilderResume,
	getBuilderResume,
} from '~/utils/builder-resume.server.ts'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import { prisma } from '~/utils/db.server.ts'
import {
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/node'
import moment from 'moment'
import {
	trackResumeUploaded,
	trackResumeParsed,
	trackResumeCreated,
	trackError,
} from '~/lib/analytics.server.ts'
import { tryActivateUser } from '~/lib/activation.server.ts'
import { trackUserActivity } from '~/lib/retention.server.ts'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

/** Strip database IDs from a resume for cloning */
function stripResumeIds(resume: any) {
	const copy = { ...resume } as any
	delete copy.userId
	delete copy.id
	delete copy.jobId
	delete copy.job
	delete copy.createdAt
	delete copy.updatedAt
	copy.experiences?.forEach((exp: any) => {
		delete exp.id
		delete exp.resumeId
		exp.descriptions?.forEach((desc: any) => {
			delete desc.id
			delete desc.experienceId
		})
	})
	copy.education?.forEach((ed: any) => {
		delete ed.id
		delete ed.resumeId
	})
	copy.skills?.forEach((skill: any) => {
		delete skill.id
		delete skill.resumeId
	})
	copy.hobbies?.forEach((hobby: any) => {
		delete hobby.id
		delete hobby.resumeId
	})
	if (copy.headers) {
		delete copy.headers.id
		delete copy.headers.resumeId
	}
	if (copy.visibleSections) {
		delete copy.visibleSections.id
		delete copy.visibleSections.resumeId
	}
	return copy
}

export async function action({ request }: DataFunctionArgs) {
	const userId = await getUserId(request)
	const url = new URL(request.url)

	const type = url.searchParams.get('type')

	if (type === 'upload') {
		const formData = await unstable_parseMultipartFormData(
			request,
			unstable_createMemoryUploadHandler({ maxPartSize: MAX_SIZE }),
		)

		const resumeFile = formData.get('resumeFile') as File
		if (!resumeFile || resumeFile.size === 0) {
			return json({ error: 'No file uploaded' }, { status: 400 })
		}

		const parseStartTime = Date.now()

		try {
			// Parse resume with OpenAI
			const parsedResume = await parseResumeWithOpenAI(resumeFile)

			// Transform OpenAI format to builder format
			const builderResume = {
				name: parsedResume.personal_info.full_name ?? '',
				role: parsedResume.experiences[0]?.title ?? '',
				email: Array.isArray(parsedResume.personal_info.email)
					? parsedResume.personal_info.email[0] ?? null
					: parsedResume.personal_info.email ?? null,
				phone: parsedResume.personal_info.phone,
				location: parsedResume.personal_info.location,
				website:
					parsedResume.personal_info.linkedin ||
					parsedResume.personal_info.portfolio ||
					parsedResume.personal_info.github ||
					null,
				about: parsedResume.summary || null,

				experiences: parsedResume.experiences.map(exp => ({
					role: exp.title,
					company: exp.company,
					startDate: formatDate(exp.date_start, exp.date_start_precision),
					endDate: exp.date_end
						? formatDate(exp.date_end, exp.date_end_precision)
						: 'Present',
					descriptions: exp.bullet_points.map((bullet, index) => ({
						content: bullet,
						order: index,
					})),
				})),

				education: parsedResume.education.map(ed => ({
					school: ed.school,
					degree: ed.major ? `${ed.degree} in ${ed.major}` : ed.degree,
					startDate: ed.date_start
						? formatDate(ed.date_start, ed.date_start_precision)
						: null,
					endDate: ed.date_end
						? formatDate(ed.date_end, ed.date_end_precision)
						: null,
					description: [
						ed.gpa ? `GPA: ${ed.gpa}` : null,
						Array.isArray(ed.honors)
							? ed.honors.join('\n')
							: ed.honors
								? String(ed.honors)
								: null,
						Array.isArray(ed.relevant_coursework) && ed.relevant_coursework.length
							? `Relevant Coursework: ${ed.relevant_coursework.join(', ')}`
							: ed.relevant_coursework
								? `Relevant Coursework: ${String(ed.relevant_coursework)}`
								: null,
					]
						.filter(Boolean)
						.join('\n') || null,
				})),

				skills:
					parsedResume.skills.length > 0
						? parsedResume.skills.map(skill => ({ name: skill }))
						: [{ name: '' }],

				hobbies: [{ name: '' }], // OpenAI parser doesn't extract hobbies by default

				visibleSections: {
					about: !!parsedResume.summary,
					experience: parsedResume.experiences.length > 0,
					education: parsedResume.education.length > 0,
					skills: parsedResume.skills.length > 0,
					hobbies: false,
					personalDetails: true,
					photo: false,
				},

				layout: 'slate',
				font: 'inter',
				textSize: 'medium',
			}

			// Save to database
			const resume = await createBuilderResume(userId, builderResume)

			// Track resume uploaded event
			const fileExtension = resumeFile.name.split('.').pop()?.toLowerCase() || 'pdf'
			const fileType = fileExtension === 'docx' || fileExtension === 'doc' ? fileExtension : 'pdf'
			if (userId) {
				trackResumeUploaded(
					userId,
					fileType as 'pdf' | 'docx' | 'doc',
					Math.round(resumeFile.size / 1024),
					request,
				)

				// Track resume parsed success
				const sectionsFound = [
					parsedResume.experiences?.length ? 'experience' : null,
					parsedResume.education?.length ? 'education' : null,
					parsedResume.skills?.length ? 'skills' : null,
					parsedResume.summary ? 'summary' : null,
				].filter(Boolean) as string[]

				trackResumeParsed(
					userId,
					true,
					sectionsFound,
					Date.now() - parseStartTime,
					request,
				)

				// Get resume count for resume_number (includes the one just created)
				const resumeCount = await prisma.builderResume.count({ where: { userId } })

				// Track resume created with resume_number for multi-resume analysis
				trackResumeCreated(userId, 'upload', resume.id, request, resumeCount)

				// Track return visit if applicable
				await trackUserActivity({ userId, trigger: 'resume_upload', request })

				// Check for activation
				await tryActivateUser(userId, 'resume_created', request)
			}

			// Get subscription status for GA4 tracking
			const subscription = await prisma.subscription.findFirst({
				where: { ownerId: userId, active: true },
				select: { id: true },
			})
			const planType = subscription ? 'pro' : 'free'

			return redirectDocument('/builder', {
				headers: {
					'Set-Cookie': await resumeCookie.serialize({
						resumeId: resume.id,
						downloadPDFRequested: false,
						subscribe: false,
						resumeUploadedTracking: {
							user_id: userId,
							plan_type: planType,
						},
					}),
				},
			})
		} catch (error: any) {
			console.error('Resume parsing error:', error)

			const userMessage = error instanceof ResumeParseError
				? error.userMessage
				: 'Failed to parse resume. Please try again or contact support.'

			// Track error
			if (userId) {
				trackError(
					error.message,
					'resume_upload',
					userId,
					error.stack,
					request,
				)
			}

			return json(
				{ error: userMessage },
				{ status: 500 },
			)
		}
	}

	if (type === 'existing') {
		const formData = await request.formData()
		const existingResumeId = formData.get('existingResumeId')
		if (!existingResumeId) {
			throw new Error('No resume ID provided')
		}

		let resume = await getBuilderResume(existingResumeId as string)

		if (!resume) {
			throw new Error('Resume not found')
		}

		// Ownership check: only allow cloning own resumes
		if (resume.userId && resume.userId !== userId) {
			throw new Response('Forbidden', { status: 403 })
		}

		const resumeCopy = stripResumeIds(resume)

		const builderResume = await createBuilderResume(
			userId,
			resumeCopy,
		)

		// Track resume created with resume_number for multi-resume analysis
		if (userId) {
			const resumeCount = await prisma.builderResume.count({ where: { userId } })
			trackResumeCreated(userId, 'clone', builderResume.id, request, resumeCount)

			// Track return visit if applicable
			await trackUserActivity({ userId, trigger: 'resume_clone', request })
		}

		return redirectDocument('/builder', {
			headers: {
				'Set-Cookie': await resumeCookie.serialize({
					resumeId: builderResume.id as string,
					downloadPDFRequested: false,
					subscribe: false,
				}),
			},
		})
	}

	if (type === 'clone-for-job') {
		const formData = await request.formData()
		const existingResumeId = formData.get('existingResumeId') as string
		const jobId = formData.get('jobId') as string

		if (!existingResumeId || !jobId) {
			return json({ error: 'Missing required fields' }, { status: 400 })
		}

		if (!userId) {
			return json({ error: 'Authentication required' }, { status: 401 })
		}

		// Idempotency: if a resume already exists for this user+job, return it
		const existing = await prisma.builderResume.findFirst({
			where: { userId, jobId },
			select: { id: true },
		})
		if (existing) {
			return json({ resumeId: existing.id })
		}

		const resume = await getBuilderResume(existingResumeId)
		if (!resume) {
			return json({ error: 'Resume not found' }, { status: 404 })
		}

		// Ownership check
		if (resume.userId && resume.userId !== userId) {
			return json({ error: 'Forbidden' }, { status: 403 })
		}

		const resumeCopy = stripResumeIds(resume)

		// Clear job-specific data; keep person's name unchanged
		resumeCopy.coverLetterDrafts = null
		resumeCopy.jobId = jobId

		const builderResume = await createBuilderResume(userId, resumeCopy)

		// Analytics
		const resumeCount = await prisma.builderResume.count({ where: { userId } })
		trackResumeCreated(userId, 'clone_for_job', builderResume.id, request, resumeCount)
		await trackUserActivity({ userId, trigger: 'resume_clone_for_job', request })

		return json({ resumeId: builderResume.id })
	}

	throw new Error('Invalid creation type')
}

// Helper function for date formatting
function formatDate(
	dateStr: string | null,
	precision?: 'day' | 'month' | 'year',
): string | null {
	if (!dateStr) return null

	try {
		return moment(dateStr).format('MMM YYYY')
	} catch {
		return null
	}
}
