import pdf from 'pdf-parse-fork'
import mammoth from 'mammoth'
import { OpenAI } from 'openai'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY ?? 'test-key',
	timeout: 60000, // 60 second timeout
})

export interface OpenAIResumeData {
	personal_info: {
		full_name: string
		first_name: string
		last_name: string
		email: string
		phone: string
		location: string
		linkedin?: string
		portfolio?: string
		github?: string
	}
	summary?: string
	experiences: Array<{
		title: string
		company: string
		date_start: string
		date_end: string | null
		date_start_precision?: 'day' | 'month' | 'year'
		date_end_precision?: 'day' | 'month' | 'year'
		location?: string
		description: string
		bullet_points: string[]
		skills: string[]
	}>
	education: Array<{
		school: string
		degree: string
		major: string
		minor?: string
		gpa?: string
		honors?: string[]
		relevant_coursework?: string[]
		date_start: string | null
		date_end: string | null
		date_start_precision?: 'day' | 'month' | 'year'
		date_end_precision?: 'day' | 'month' | 'year'
		location?: string
	}>
	skills: string[]
	skills_extracted?: string[]
	certifications?: Array<{
		name: string
		issuer: string
		date?: string
	}>
	projects?: Array<{
		name: string
		description: string
		technologies: string[]
		link?: string
	}>
	awards?: string[]
	publications?: string[]
	volunteer?: Array<{
		role: string
		organization: string
		description: string
		date_start: string | null
		date_end: string | null
	}>
}

function getFileExtension(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop() || ''
	return ext
}

async function extractTextFromFile(file: File): Promise<string> {
	const buffer = Buffer.from(await file.arrayBuffer())
	const ext = getFileExtension(file.name)

	if (ext === 'pdf') {
		const pdfData = await pdf(buffer)
		return pdfData.text
	}

	if (ext === 'docx' || ext === 'doc') {
		const result = await mammoth.extractRawText({ buffer })
		return result.value
	}

	throw new Error(
		`Unsupported file type: .${ext}. Please upload a PDF or DOCX file.`,
	)
}

export async function parseResumeWithOpenAI(
	file: File,
): Promise<OpenAIResumeData> {
	try {
		// Extract text from PDF or DOCX
		const resumeText = await extractTextFromFile(file)

		if (!resumeText || resumeText.trim().length === 0) {
			throw new Error('No text content found in file')
		}

		// Call OpenAI API
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{
					role: 'system',
					content: `You are a comprehensive resume parser. Extract ALL information from resumes into structured JSON format with maximum detail preservation.
Return ONLY valid JSON with no markdown formatting or code blocks.

CRITICAL: Capture EVERY detail, metric, number, and story from the resume. Do not summarize or condense.

Parse the following fields with COMPLETE information:

- personal_info: full_name, first_name, last_name, email, phone, location, linkedin, portfolio, github (extract ALL URLs)

- summary: professional summary or objective (preserve exact wording)

- experiences: array of jobs with:
  * title: exact job title
  * company: company name
  * date_start, date_end: ISO format (null if "Present")
  * date_start_precision, date_end_precision: 'day', 'month', or 'year' to indicate precision of the date
  * location: job location if mentioned
  * description: full job description if present
  * bullet_points: COMPLETE array of ALL bullet points exactly as written, preserving every detail, metric, percentage, dollar amount, and specific achievement. Do NOT summarize.
  * skills: technical skills explicitly mentioned in these specific bullet points

- education: array with:
  * school, degree, major, minor, gpa, honors, relevant_coursework, location
  * date_start, date_end: ISO format or null
  * date_start_precision, date_end_precision: 'day', 'month', or 'year' to indicate precision

- skills: Array of skill CATEGORY STRINGS in the format "Category: skill1, skill2, skill3". Group related skills together by category. Examples:
  * "Product: A/B Testing, Cross-Functional Leadership, Funnel Optimization, PRDs & Specs"
  * "Tools: Figma, GA4, JIRA, Python, React, TypeScript"
  * "Languages: JavaScript, Python, SQL"
  * "Technical: AWS, Docker, Kubernetes, CI/CD"
  Extract skills from the dedicated SKILLS section ONLY. Do NOT include skills extracted from job descriptions.

- skills_extracted: array of technical skills mentioned in job descriptions that are NOT already listed in the main skills section

- certifications: array with name, issuer, date

- projects: array with name, description, technologies, link

- awards: array of awards/honors

- publications: array of publications

- volunteer: array with role, organization, description, dates

Date formatting rules:
- If day, month, and year are specified: YYYY-MM-DD (precision: 'day')
- If only month and year: YYYY-MM-01 (precision: 'month')
- If only year: YYYY-01-01 (precision: 'year')
- If "Present" or current: null for date_end
- Always include precision indicator

REMEMBER: Extract EVERY detail. Never summarize or condense bullet points. Preserve exact wording, all metrics, and complete context. Keep skills and skills_extracted completely separate.`,
				},
				{
					role: 'user',
					content: `Parse this resume and extract EVERY detail:\n\n${resumeText}`,
				},
			],
			response_format: { type: 'json_object' },
			temperature: 0.1,
			max_tokens: 16384,
		})

		const content = response.choices[0]?.message?.content
		if (!content) {
			throw new Error('No content returned from OpenAI')
		}

		const result = JSON.parse(content) as OpenAIResumeData

		// Ensure personal_info exists with safe defaults
		if (!result.personal_info) {
			result.personal_info = {
				full_name: '',
				first_name: '',
				last_name: '',
				email: '',
				phone: '',
				location: '',
			}
		}

		// Coerce email to string (OpenAI sometimes returns an array when multiple emails exist)
		if (Array.isArray(result.personal_info.email)) {
			result.personal_info.email = result.personal_info.email[0] ?? ''
		}

		// Coerce full_name to string
		result.personal_info.full_name = result.personal_info.full_name ?? ''
		result.personal_info.first_name = result.personal_info.first_name ?? ''
		result.personal_info.last_name = result.personal_info.last_name ?? ''

		// Sanitize education fields that OpenAI may return as wrong types
		if (result.education) {
			result.education = result.education.map(ed => ({
				...ed,
				honors: Array.isArray(ed.honors)
					? ed.honors
					: ed.honors
						? [String(ed.honors)]
						: undefined,
				relevant_coursework: Array.isArray(ed.relevant_coursework)
					? ed.relevant_coursework
					: ed.relevant_coursework
						? [String(ed.relevant_coursework)]
						: undefined,
			}))
		}

		// Validation: ensure skills_extracted doesn't duplicate skills
		if (result.skills && result.skills_extracted) {
			const skillsLower = result.skills.map(s => s.toLowerCase())
			result.skills_extracted = result.skills_extracted.filter(
				skill => !skillsLower.includes(skill.toLowerCase()),
			)

			if (result.skills_extracted.length === 0) {
				delete result.skills_extracted
			}
		}

		// Ensure arrays exist (defaults)
		result.experiences = result.experiences || []
		result.education = result.education || []
		result.skills = result.skills || []

		return result
	} catch (error: any) {
		throw new Error(
			`Failed to parse resume: ${error.message || 'Unknown error'}`,
		)
	}
}
