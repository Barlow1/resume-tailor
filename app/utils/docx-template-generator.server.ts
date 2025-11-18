import * as fs from 'fs'
import * as path from 'path'
import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	AlignmentType,
	TabStopType,
	TabStopPosition,
} from 'docx'

interface TailoredExperience {
	title: string
	company: string
	date_start: string
	date_end: string | null
	location?: string
	bullet_points: string[]
}

interface PersonalInfo {
	full_name?: string
	first_name?: string
	last_name?: string
	email?: string
	phone?: string
	location?: string
	linkedin?: string
	github?: string
	portfolio?: string
}

interface Education {
	school: string
	degree: string
	major?: string
	date_start?: string
	date_end?: string
	location?: string
}

interface TailoredResumeData {
	personal_info: PersonalInfo
	summary?: string
	experiences: TailoredExperience[]
	education: Education[]
	skills: string[]
	certifications?: Array<{ name: string; issuer: string; date?: string }>
	projects?: Array<{
		name: string
		description: string
		link?: string
		technologies?: string[]
	}>
}

/**
 * Generate resume DOCX based on the exact formatting from Final_Brayan Londono.docx
 * This replicates the structure observed in the template file
 */
export async function generateResumeDocxFromTemplate(
	resumeData: TailoredResumeData,
): Promise<Buffer> {
	const { personal_info, summary, experiences, education, skills } = resumeData

	const sections: Paragraph[] = []

	// NAME - Centered, Garamond Bold 20pt
	sections.push(
		new Paragraph({
			children: [
				new TextRun({
					text:
						personal_info.full_name ||
						`${personal_info.first_name} ${personal_info.last_name}`,
					font: 'Garamond',
					bold: true,
					size: 40, // 20pt
				}),
			],
			alignment: AlignmentType.CENTER,
		}),
	)

	// CONTACT INFO - Centered, Garamond Regular 10pt
	const contactParts: string[] = []
	if (personal_info.location) contactParts.push(personal_info.location)
	if (personal_info.phone) contactParts.push(personal_info.phone)
	if (personal_info.email) contactParts.push(personal_info.email)
	if (personal_info.linkedin) contactParts.push(personal_info.linkedin)

	sections.push(
		new Paragraph({
			children: [
				new TextRun({
					text: contactParts.join(' | '),
					font: 'Garamond',
					size: 20, // 10pt
				}),
			],
			alignment: AlignmentType.CENTER,
		}),
	)

	// Empty paragraph
	sections.push(new Paragraph({ text: '' }))

	// SUMMARY SECTION
	if (summary) {
		// Section header - Garamond Bold 12pt
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'PRODUCT LEADERSHIP SUMMARY',
						font: 'Garamond',
						bold: true,
						size: 24, // 12pt
					}),
				],
			}),
		)

		// Summary text - appears to be default font/size
		sections.push(
			new Paragraph({
				text: summary,
			}),
		)

		// Empty paragraph
		sections.push(new Paragraph({ text: '' }))
	}

	// PROFESSIONAL EXPERIENCE SECTION
	if (experiences && experiences.length > 0) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'PROFESSIONAL EXPERIENCE',
						font: 'Garamond',
						bold: true,
						size: 24, // 12pt
					}),
				],
			}),
		)

		experiences.forEach((exp) => {
			// Company and dates line with tab - Garamond Bold 12pt for company, Regular 12pt for dates
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: exp.company,
							font: 'Garamond',
							bold: true,
							size: 24, // 12pt
						}),
						new TextRun({
							text: '\t',
						}),
						new TextRun({
							text: `${exp.date_start} – ${exp.date_end || 'Present'}`,
							font: 'Garamond',
							size: 24, // 12pt
						}),
					],
					tabStops: [
						{
							type: TabStopType.RIGHT,
							position: TabStopPosition.MAX,
						},
					],
				}),
			)

			// Job title - Garamond Bold 12pt
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: exp.title,
							font: 'Garamond',
							bold: true,
							size: 24, // 12pt
						}),
					],
				}),
			)

			// Bullet points
			exp.bullet_points.forEach((bullet) => {
				sections.push(
					new Paragraph({
						text: bullet,
						bullet: {
							level: 0,
						},
					}),
				)
			})

			// Empty paragraph after each experience
			sections.push(new Paragraph({ text: '' }))
		})
	}

	// EDUCATION SECTION
	if (education && education.length > 0) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'EDUCATION',
						font: 'Garamond',
						bold: true,
						size: 24, // 12pt
					}),
				],
			}),
		)

		education.forEach((edu) => {
			const degreeText = `${edu.degree}${edu.major ? ', ' + edu.major : ''}`
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: edu.school,
							font: 'Garamond',
							bold: true,
							size: 24, // 12pt
						}),
						new TextRun({
							text: ' ',
						}),
						new TextRun({
							text: degreeText,
							font: 'Garamond',
						}),
					],
				}),
			)
		})

		// Empty paragraph
		sections.push(new Paragraph({ text: '' }))
	}

	// SKILLS SECTION
	if (skills && skills.length > 0) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'SKILLS',
						font: 'Garamond',
						bold: true,
						size: 24, // 12pt
					}),
				],
			}),
		)

		sections.push(
			new Paragraph({
				text: skills.join(', '),
			}),
		)
	}

	// Create document
	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 720, // 0.5"
							right: 720, // 0.5"
							bottom: 720, // 0.5"
							left: 720, // 0.5"
						},
					},
				},
				children: sections,
			},
		],
	})

	return await Packer.toBuffer(doc)
}
