import { json, type ActionFunctionArgs } from '@remix-run/node'
import {
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/node'
import { parseResumeWithOpenAI } from '~/utils/openai-resume-parser.server.ts'
import moment from 'moment'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

export async function action({ request }: ActionFunctionArgs) {
	const formData = await unstable_parseMultipartFormData(
		request,
		unstable_createMemoryUploadHandler({ maxPartSize: MAX_SIZE }),
	)

	const resumeFile = formData.get('resumeFile') as File
	if (!resumeFile) {
		return json({ error: 'No file uploaded' }, { status: 400 })
	}

	try {
		const parsedResume = await parseResumeWithOpenAI(resumeFile)

		// Convert parsed resume to analysis format
		const resumeData = {
			name: parsedResume.personal_info.full_name,
			email: parsedResume.personal_info.email ?? '',
			phone: parsedResume.personal_info.phone ?? '',
			location: parsedResume.personal_info.location ?? '',
			about: parsedResume.summary || '',
			experiences: parsedResume.experiences.map(exp => ({
				role: exp.title,
				company: exp.company,
				startDate: exp.date_start ? moment(exp.date_start).format('MMM YYYY') : '',
				endDate: exp.date_end ? moment(exp.date_end).format('MMM YYYY') : 'Present',
				descriptions: exp.bullet_points.map((bullet, index) => ({
					content: bullet,
					order: index,
				})),
			})),
			education: parsedResume.education.map(ed => ({
				school: ed.school,
				degree: ed.major ? `${ed.degree} in ${ed.major}` : ed.degree,
				startDate: ed.date_start ? moment(ed.date_start).format('MMM YYYY') : '',
				endDate: ed.date_end ? moment(ed.date_end).format('MMM YYYY') : '',
				description: [
					ed.gpa ? `GPA: ${ed.gpa}` : null,
					ed.honors?.join('\n'),
				].filter(Boolean).join('\n') || '',
			})),
			skills: parsedResume.skills.map(name => ({ name })),
			hobbies: [],
		}

		// Build plain text for AI analysis (fallback)
		const resumeTxt = [
			parsedResume.personal_info.full_name,
			parsedResume.summary,
			...parsedResume.experiences.map(e =>
				`${e.title} at ${e.company}\n${e.bullet_points.join('\n')}`
			),
			...parsedResume.education.map(e => `${e.degree} at ${e.school}`),
			parsedResume.skills.join(', '),
		].filter(Boolean).join('\n\n')

		return json({ resumeData, resumeTxt })
	} catch (error: any) {
		console.error('Failed to parse resume:', error)
		return json(
			{ error: error.message || 'Failed to parse resume. Please try again.' },
			{ status: 500 },
		)
	}
}
