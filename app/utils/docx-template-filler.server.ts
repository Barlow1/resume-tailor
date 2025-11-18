import * as fs from 'fs'
import * as path from 'path'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import type { OpenAIResumeData } from './openai-resume-parser.server.ts'
import { formatResumeDateRange } from './resume-date-formatter.ts'

interface TailoredExperience {
	title: string
	company: string
	date_start: string
	date_end: string | null
	date_start_precision?: 'day' | 'month' | 'year'
	date_end_precision?: 'day' | 'month' | 'year' | null
	location?: string
	bullet_points: string[]
}

interface TailoredResumeData {
	personal_info: OpenAIResumeData['personal_info']
	summary?: string
	experiences: TailoredExperience[]
	education: OpenAIResumeData['education']
	skills: string[]
	certifications?: OpenAIResumeData['certifications']
	projects?: OpenAIResumeData['projects']
}

/**
 * Generates a resume DOCX using the template file with placeholders
 * Template file: app/utils/resume-template-base.docx
 *
 * Placeholder syntax guide:
 * - Simple variables: {variable_name}
 * - Loops: {#array_name}...{/array_name}
 * - Conditionals: {#variable}...{/variable} or {^variable}...{/variable}
 *
 * Example template structure:
 *
 * {full_name}
 * {location} | {phone} | {email} | {linkedin}
 *
 * PROFESSIONAL EXPERIENCE
 * {#experiences}
 * {company}    {date_start} - {date_end}
 * {title}
 * {#bullet_points}
 * • {.}
 * {/bullet_points}
 * {/experiences}
 */
export async function generateResumeFromTemplate(
	resumeData: TailoredResumeData,
): Promise<Buffer> {
	// Load the template
	const templatePath = path.join(
		process.cwd(),
		'app',
		'utils',
		'resume-template-base.docx',
	)

	const content = fs.readFileSync(templatePath, 'binary')
	const zip = new PizZip(content)

	// Create docxtemplater instance
	const doc = new Docxtemplater(zip, {
		paragraphLoop: true,
		linebreaks: true,
	})

	// Prepare data for template
	const templateData = {
		// Personal info - individual fields
		full_name:
			resumeData.personal_info.full_name ||
			`${resumeData.personal_info.first_name} ${resumeData.personal_info.last_name}`,
		first_name: resumeData.personal_info.first_name || '',
		last_name: resumeData.personal_info.last_name || '',
		email: resumeData.personal_info.email || '',
		phone: resumeData.personal_info.phone || '',
		location: resumeData.personal_info.location || '',
		linkedin: resumeData.personal_info.linkedin || '',
		github: resumeData.personal_info.github || '',
		portfolio: resumeData.personal_info.portfolio || '',

		// Contact info - pre-formatted string with pipes
		contact_info: (() => {
			const parts: string[] = []
			if (resumeData.personal_info.location) parts.push(resumeData.personal_info.location)
			if (resumeData.personal_info.phone) parts.push(resumeData.personal_info.phone)
			if (resumeData.personal_info.email) parts.push(resumeData.personal_info.email)
			if (resumeData.personal_info.linkedin) parts.push(resumeData.personal_info.linkedin)
			if (resumeData.personal_info.github) parts.push(resumeData.personal_info.github)
			if (resumeData.personal_info.portfolio) parts.push(resumeData.personal_info.portfolio)
			return parts.join(' | ')
		})(),

		// Summary
		has_summary: !!resumeData.summary,
		summary: resumeData.summary || '',

		// Experiences - formatted for easy template use
		experiences: resumeData.experiences.map((exp) => ({
			...exp,
			date_end: exp.date_end || 'Present',
			date_range: formatResumeDateRange(
				exp.date_start,
				exp.date_start_precision,
				exp.date_end,
				exp.date_end_precision,
			),
		})),

		// Education
		education: resumeData.education.map((edu) => ({
			...edu,
			degree_major: `${edu.degree}${edu.major ? ', ' + edu.major : ''}`,
			date_range: formatResumeDateRange(
				edu.date_start,
				edu.date_start_precision,
				edu.date_end,
				edu.date_end_precision,
			),
		})),

		// Skills - as both array and comma-separated string
		skills: resumeData.skills,
		skills_text: resumeData.skills.join(', '),

		// Certifications
		has_certifications: !!(
			resumeData.certifications && resumeData.certifications.length > 0
		),
		certifications: (resumeData.certifications || []).map((cert) => ({
			...cert,
			cert_text: cert.date
				? `${cert.name} - ${cert.issuer} (${cert.date})`
				: `${cert.name} - ${cert.issuer}`,
		})),

		// Projects
		has_projects: !!(resumeData.projects && resumeData.projects.length > 0),
		projects: (resumeData.projects || []).map((project) => ({
			...project,
			technologies_text: project.technologies
				? project.technologies.join(', ')
				: '',
			has_technologies: !!(
				project.technologies && project.technologies.length > 0
			),
		})),
	}

	// Fill the template with data
	doc.setData(templateData)

	try {
		// Render the document (replace all placeholders)
		doc.render()
	} catch (error) {
		// Catch rendering errors (e.g., tag not closed, bad template syntax)
		if (error instanceof Error) {
			throw new Error(`Error rendering template: ${error.message}`)
		}
		throw error
	}

	// Generate the document as a buffer
	const buf = doc.getZip().generate({
		type: 'nodebuffer',
		compression: 'DEFLATE',
	})

	return buf
}
