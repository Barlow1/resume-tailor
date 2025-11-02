import { type DataFunctionArgs, redirectDocument, json } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { parseResumeWithOpenAI } from '~/utils/openai-resume-parser.server.ts'
import {
	createBuilderResume,
	getBuilderResume,
} from '~/utils/builder-resume.server.ts'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import {
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/node'
import moment from 'moment'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

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

		try {
			// Parse resume with OpenAI
			const parsedResume = await parseResumeWithOpenAI(resumeFile)

			// Transform OpenAI format to builder format
			const builderResume = {
				name: parsedResume.personal_info.full_name,
				role: parsedResume.experiences[0]?.title ?? '',
				email: parsedResume.personal_info.email,
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
						ed.honors?.join('\n'),
						ed.relevant_coursework?.length
							? `Relevant Coursework: ${ed.relevant_coursework.join(', ')}`
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
			}

			// Save to database
			const resume = await createBuilderResume(userId, builderResume)

			return redirectDocument('/builder', {
				headers: {
					'Set-Cookie': await resumeCookie.serialize({
						resumeId: resume.id,
						downloadPDFRequested: false,
						subscribe: false,
					}),
				},
			})
		} catch (error: any) {
			console.error('Resume parsing error:', error)
			return json(
				{
					error:
						error.message ||
						'Failed to parse resume. Please try again or contact support.',
				},
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

		const resumeCopy = { ...resume } as any
		// Remove userId and id from resume
		delete resumeCopy.userId
		delete resumeCopy.id
		delete resumeCopy.jobId
		delete resumeCopy.job
		delete resumeCopy.createdAt
		delete resumeCopy.updatedAt
		// delete ids from experience
		resumeCopy.experiences.forEach((exp: any) => {
			delete exp.id
			delete exp.resumeId
			exp.descriptions.forEach((desc: any) => {
				delete desc.id
				delete desc.experienceId
			})
		})
		// delete ids from education
		resumeCopy.education.forEach((ed: any) => {
			delete ed.id
			delete ed.resumeId
		})
		// delete ids from skills
		resumeCopy.skills.forEach((skill: any) => {
			delete skill.id
			delete skill.resumeId
		})
		// delete ids from hobbies
		resumeCopy.hobbies.forEach((hobby: any) => {
			delete hobby.id
			delete hobby.resumeId
		})
		// delete ids from headers
		delete resumeCopy.headers.id
		delete resumeCopy.headers.resumeId

		delete resumeCopy.visibleSections.id
		delete resumeCopy.visibleSections.resumeId

		const builderResume = await createBuilderResume(
			userId,
			resumeCopy,
		)

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
