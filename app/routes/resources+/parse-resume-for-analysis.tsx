import { json, type ActionFunctionArgs } from '@remix-run/node'
import {
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/node'
import { parseResume } from '~/utils/hrflowai.server.ts'
import moment from 'moment'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

function capitalizeFirstLetter(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

function parseBulletPoints(description: string): string[] {
	if (!description) return []

	// Split the description into lines
	const lines = description.split('\n')
	const bullets: string[] = []
	let currentBullet = ''

	for (const line of lines) {
		const trimmedLine = line.trim()

		// Skip empty lines and header lines (title, company, etc.)
		if (!trimmedLine || trimmedLine.includes('–') || trimmedLine.match(/^\w+\s+\d{4}/)) {
			continue
		}

		// Check if this line starts with a bullet marker
		if (trimmedLine.match(/^[●•-]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
			// Save the previous bullet if it exists
			if (currentBullet) {
				bullets.push(currentBullet.trim())
			}
			// Start a new bullet, removing the marker
			currentBullet = trimmedLine.replace(/^[●•-]\s+/, '').replace(/^\d+\.\s+/, '')
		} else if (currentBullet) {
			// Continuation of the current bullet
			currentBullet += ' ' + trimmedLine
		}
	}

	// Add the last bullet
	if (currentBullet) {
		bullets.push(currentBullet.trim())
	}

	return bullets
}

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
		const parsedResume = await parseResume(resumeFile)

		console.log('=== HRFLOW PARSING RESULT ===')
		console.log('First experience:', JSON.stringify(parsedResume.profile.experiences[0], null, 2))
		console.log('Experience description:', parsedResume.profile.experiences[0]?.description)
		console.log('Tasks for first experience:')
		parsedResume.profile.experiences[0]?.tasks.forEach((task: any, i: number) => {
			console.log(`  Task ${i}:`)
			console.log(`    name: ${task.name}`)
			console.log(`    value: ${JSON.stringify(task.value)}`)
		})

		// Convert parsed resume to analysis format (similar to builder format)
		const resumeData = {
			name: `${parsedResume.profile.info.first_name} ${parsedResume.profile.info.last_name}`,
			email: parsedResume.parsing.emails[0] ?? '',
			phone: parsedResume.parsing.phones[0] ?? '',
			location: parsedResume.profile.info.location?.fields?.city && parsedResume.profile.info.location?.fields?.state
				? `${parsedResume.profile.info.location.fields.city}, ${parsedResume.profile.info.location.fields.state}`
				: '',
			about: parsedResume.profile.info.summary || '',
			experiences: parsedResume.profile.experiences.map(exp => {
				// Parse bullet points from the full description instead of truncated tasks
				const bulletPoints = parseBulletPoints(exp.description)
				console.log(`Experience: ${exp.company} - Found ${bulletPoints.length} bullet points`)

				return {
					role: exp.title,
					company: exp.company,
					startDate: exp.date_start ? moment(exp.date_start).format('MMM YYYY') : '',
					endDate: exp.date_end ? moment(exp.date_end).format('MMM YYYY') : '',
					descriptions: bulletPoints.map((bullet, index) => ({
						content: capitalizeFirstLetter(bullet),
						order: index,
					})),
				}
			}),
			education: parsedResume.profile.educations.map(ed => ({
				school: ed.school,
				degree: ed.title,
				startDate: ed.date_start ? moment(ed.date_start).format('MMM YYYY') : '',
				endDate: ed.date_end ? moment(ed.date_end).format('MMM YYYY') : '',
				description: ed.tasks.map(t => t.name).join('\n'),
			})),
			skills: parsedResume.profile.skills.length > 0
				? parsedResume.profile.skills.map(skill => ({ name: skill.name }))
				: [],
			hobbies: parsedResume.profile.interests.length > 0
				? parsedResume.profile.interests.map(hobby => ({ name: hobby.name }))
				: [],
		}

		// Extract plain text for AI analysis (fallback)
		const resumeTxt = parsedResume.parsing.text || ''

		return json({ resumeData, resumeTxt })
	} catch (error) {
		console.error('Failed to parse resume:', error)
		return json(
			{ error: 'Failed to parse resume. Please try again.' },
			{ status: 500 },
		)
	}
}
