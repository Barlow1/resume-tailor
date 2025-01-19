import { type DataFunctionArgs, redirectDocument } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { parseResume } from '~/utils/hrflowai.server.ts'
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
		if (!resumeFile) {
			throw new Error('No file uploaded')
		}

		const parsedResume = await parseResume(resumeFile)

		// Convert parsed resume to builder format
		const builderResume = {
			name: `${parsedResume.profile.info.first_name} ${parsedResume.profile.info.last_name}`,
			role: parsedResume.parsing.experiences[0]?.title ?? '',
			email: parsedResume.parsing.emails[0] ?? '',
			phone: parsedResume.parsing.phones[0] ?? '',
			location: `${parsedResume.profile.info.location.fields.city}, ${parsedResume.profile.info.location.fields.state}`,
			experiences: parsedResume.profile.experiences.map(exp => ({
				role: exp.title,
				company: exp.company,
				startDate: moment(exp.date_start).format('MMM YYYY'),
				endDate: moment(exp.date_end).format('MMM YYYY'),
				descriptions: exp.tasks.map((task, index) => ({
					// capitalize first letter of each task
					content: capitalizeFirstLetter(task.name),
					order: index,
				})),
			})),
			education: parsedResume.profile.educations.map(ed => ({
				school: ed.school,
				degree: ed.title,
				startDate: moment(ed.date_start).format('MMM YYYY'),
				endDate: moment(ed.date_end).format('MMM YYYY'),
				description: ed.tasks.map(t => t.name).join('\n'),
			})),
			skills: parsedResume.profile.skills.length > 0 ? parsedResume.profile.skills.map(skill => ({
				name: skill.name,
					}))
				: [{ name: '' }],
			hobbies: parsedResume.profile.interests.length > 0
				? parsedResume.profile.interests.map(hobby => ({	
						name: hobby.name,
				  }))
				: [{ name: '' }],
		}

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

		const builderResume = await createBuilderResume(userId, resumeCopy)

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

function capitalizeFirstLetter(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
