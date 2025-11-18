import {
	Document,
	Paragraph,
	TextRun,
	AlignmentType,
	Packer,
	TabStopPosition,
	TabStopType,
	convertInchesToTwip,
} from 'docx'
import type { OpenAIResumeData } from './openai-resume-parser.server.ts'

interface TailoredExperience {
	title: string
	company: string
	date_start: string
	date_end: string | null
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

export async function generateResumeDocx(
	resumeData: TailoredResumeData,
): Promise<Buffer> {
	const { personal_info, summary, experiences, education, skills, certifications, projects } = resumeData

	const sections: Paragraph[] = []

	// NAME - Bold, centered
	sections.push(
		new Paragraph({
			children: [
				new TextRun({
					text: personal_info.full_name || `${personal_info.first_name} ${personal_info.last_name}`,
					bold: true,
				}),
			],
			alignment: AlignmentType.CENTER,
		}),
	)

	// CONTACT INFO - Centered
	const contactParts: string[] = []
	if (personal_info.location) contactParts.push(personal_info.location)
	if (personal_info.phone) contactParts.push(personal_info.phone)
	if (personal_info.email) contactParts.push(personal_info.email)
	if (personal_info.linkedin) contactParts.push(personal_info.linkedin)
	if (personal_info.github) contactParts.push(personal_info.github)
	if (personal_info.portfolio) contactParts.push(personal_info.portfolio)

	sections.push(
		new Paragraph({
			text: contactParts.join(' | '),
			alignment: AlignmentType.CENTER,
		}),
	)

	// Empty paragraph
	sections.push(new Paragraph({ text: '' }))

	// SUMMARY
	if (summary) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'PRODUCT LEADERSHIP SUMMARY',
						bold: true,
					}),
				],
			}),
		)

		sections.push(new Paragraph({ text: summary }))
		sections.push(new Paragraph({ text: '' }))
	}

	// EXPERIENCE
	if (experiences && experiences.length > 0) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'PROFESSIONAL EXPERIENCE',
						bold: true,
					}),
				],
			}),
		)

		experiences.forEach((exp) => {
			// Company and dates on same line with tab
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: exp.company,
							bold: true,
						}),
						new TextRun({ text: '\t' }),
						new TextRun({
							text: `${exp.date_start} – ${exp.date_end || 'Present'}`,
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

			// Job title - bold
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: exp.title,
							bold: true,
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

			// Empty paragraph after experience
			sections.push(new Paragraph({ text: '' }))
		})
	}

	// EDUCATION
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
				spacing: {
					after: 0,
				},
			}),
		)

		education.forEach((edu: TailoredResumeData['education'][0], index: number) => {
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
							font: 'Garamond',
						}),
						new TextRun({
							text: degreeText,
							font: 'Garamond',
							size: 22, // 11pt (default)
						}),
					],
					spacing: {
						after: 0,
					},
				}),
			)
		})

		// Empty paragraph after education
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: '',
						font: 'Garamond',
					}),
				],
				spacing: {
					after: 0,
				},
			}),
		)
	}

	// SKILLS
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
				spacing: {
					after: 0,
				},
			}),
		)

		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: skills.join(', '),
						font: 'Garamond',
						size: 22, // 11pt (default)
					}),
				],
				alignment: AlignmentType.LEFT,
				spacing: {
					after: 0,
				},
			}),
		)
	}

	// CERTIFICATIONS
	if (certifications && certifications.length > 0) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'CERTIFICATIONS',
						font: 'Garamond',
						bold: true,
						size: 24, // 12pt
					}),
				],
				spacing: {
					after: 0,
				},
			}),
		)

		certifications.forEach((cert: NonNullable<TailoredResumeData['certifications']>[0]) => {
			const certText = cert.date
				? `${cert.name} - ${cert.issuer} (${cert.date})`
				: `${cert.name} - ${cert.issuer}`

			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: certText,
							font: 'Garamond',
							size: 22, // 11pt (default)
						}),
					],
					bullet: {
						level: 0,
					},
					alignment: AlignmentType.LEFT,
					spacing: {
						after: 0,
					},
				}),
			)
		})

		// Empty paragraph after certifications
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: '',
						font: 'Garamond',
					}),
				],
				spacing: {
					after: 0,
				},
			}),
		)
	}

	// PROJECTS
	if (projects && projects.length > 0) {
		sections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'PROJECTS',
						font: 'Garamond',
						bold: true,
						size: 24, // 12pt
					}),
				],
				spacing: {
					after: 0,
				},
			}),
		)

		projects.forEach((project: NonNullable<TailoredResumeData['projects']>[0]) => {
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: project.name,
							font: 'Garamond',
							bold: true,
							size: 22, // 11pt (default)
						}),
						project.link
							? new TextRun({
									text: ` (${project.link})`,
									font: 'Garamond',
									size: 22, // 11pt (default)
							  })
							: new TextRun({ text: '' }),
					],
					spacing: {
						after: 0,
					},
				}),
			)

			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: project.description,
							font: 'Garamond',
							size: 22, // 11pt (default)
						}),
					],
					alignment: AlignmentType.LEFT,
					spacing: {
						after: 0,
					},
				}),
			)

			if (project.technologies && project.technologies.length > 0) {
				sections.push(
					new Paragraph({
						children: [
							new TextRun({
								text: `Technologies: ${project.technologies.join(', ')}`,
								font: 'Garamond',
								italics: true,
								size: 22, // 11pt (default)
							}),
						],
						spacing: {
							after: 0,
						},
					}),
				)
			}

			// Empty paragraph after each project
			sections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: '',
							font: 'Garamond',
						}),
					],
					spacing: {
						after: 0,
					},
				}),
			)
		})
	}

	// Create document
	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: convertInchesToTwip(0.5),
							right: convertInchesToTwip(0.5),
							bottom: convertInchesToTwip(0.5),
							left: convertInchesToTwip(0.5),
						},
					},
				},
				children: sections,
			},
		],
	})

	// Generate buffer
	return await Packer.toBuffer(doc)
}
