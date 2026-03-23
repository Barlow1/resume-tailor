import type { ResumeData } from '../builder-resume.server.ts'
import type { TemplateOptions, TemplateTheme } from './shared.ts'
import { escapeHtml, editableAttrs, getEditableCss, makeTs } from './shared.ts'

function sectionHeader(title: string, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions, headerField: string, placeholder: string): string {
	return `<div style="font-size: ${ts(13)}px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid ${accentColor}; padding-bottom: 4px; margin-bottom: 10px; font-family: ${fontFamily};" ${editableAttrs(options, headerField, placeholder)}>${escapeHtml(title)}</div>`
}

function generateContactLine(formData: ResumeData, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	const contactFields: { key: string; field: string; placeholder: string; value: string | null | undefined }[] = [
		{ key: 'location', field: 'location', placeholder: 'Location', value: formData.location },
		{ key: 'email', field: 'email', placeholder: 'Email', value: formData.email },
		{ key: 'phone', field: 'phone', placeholder: 'Phone', value: formData.phone },
		{ key: 'website', field: 'website', placeholder: 'Website', value: formData.website },
	]

	const nonEmpty = contactFields.filter(c => c.value)
	if (nonEmpty.length === 0 && !options.editable) return ''

	const parts = (options.editable ? contactFields : nonEmpty).map((c, idx) => {
		const sep = idx > 0 ? '<span class="contact-sep"> &middot; </span>' : ''
		return `${sep}<span ${editableAttrs(options, c.field, c.placeholder)} style="font-family: ${fontFamily};">${escapeHtml(c.value || '')}</span>`
	})

	return `<div style="font-size: ${ts(13)}px; color: #555; margin-top: 6px; font-family: ${fontFamily};">${parts.join('')}</div>`
}

function generateHeader(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	return `
		<div style="margin-bottom: 24px;">
			<div style="font-size: ${ts(28)}px; font-weight: 700; color: ${accentColor}; letter-spacing: -0.01em; font-family: ${fontFamily};" ${editableAttrs(options, 'name', 'Your Name')}>${escapeHtml(formData.name || '')}</div>
			${(formData.role || options.editable) ? `<div style="font-size: ${ts(16)}px; color: #444; margin-top: 4px; font-family: ${fontFamily};" ${editableAttrs(options, 'role', 'Job Title')}>${escapeHtml(formData.role || '')}</div>` : ''}
			${generateContactLine(formData, fontFamily, ts, options)}
		</div>`
}

function generateSummarySection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	if (!formData.about && !options.editable) return ''
	const header = formData.headers?.aboutHeader || 'Summary'
	return `
		<div style="margin-bottom: 20px;" data-section-id="about">
			${sectionHeader(header, accentColor, fontFamily, ts, options, 'headers.aboutHeader', 'Summary')}
			<div style="font-size: ${ts(15)}px; line-height: 1.6; color: #333; font-family: ${fontFamily};" ${editableAttrs(options, 'about', 'Write a professional summary...', { multiline: true })}>${escapeHtml(formData.about || '')}</div>
		</div>`
}

function generateExperienceSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	const allExperiences = formData.experiences || []
	const experiences = options.editable ? allExperiences : allExperiences.filter(exp => exp.role || exp.company)
	if (experiences.length === 0) return ''
	const header = formData.headers?.experienceHeader || 'Experience'
	return `
		<div style="margin-bottom: 20px;" data-section-id="experience">
			${sectionHeader(header, accentColor, fontFamily, ts, options, 'headers.experienceHeader', 'Experience')}
			${experiences.map((exp, i) => {
				const allBullets = exp.descriptions || []
				const bullets = options.editable ? allBullets : allBullets.filter(b => b.content)
				const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' \u2013 ')
				return `
			<div style="margin-bottom: 14px;" ${options.editable ? `data-experience-id="${exp.id}"` : ''}>
				<div style="display: flex; justify-content: space-between; align-items: baseline;">
					<div style="display: flex; gap: 4px; align-items: baseline;">
						<span style="font-size: ${ts(16)}px; font-weight: 700; color: #111; font-family: ${fontFamily};" ${editableAttrs(options, `experiences.${i}.role`, 'Job Title')}>${escapeHtml(exp.role || '')}</span>
						${(exp.company || options.editable) ? `<span style="font-size: ${ts(15)}px; color: #444; font-family: ${fontFamily};"> &middot; </span><span style="font-size: ${ts(15)}px; color: #444; font-family: ${fontFamily};" ${editableAttrs(options, `experiences.${i}.company`, 'Company Name')}>${escapeHtml(exp.company || '')}</span>` : ''}
					</div>
					${(dates || options.editable) ? `<span style="font-size: ${ts(12.5)}px; color: #666; font-family: ${fontFamily}; flex-shrink: 0; white-space: nowrap;"><span ${editableAttrs(options, `experiences.${i}.startDate`, 'Start Date')}>${escapeHtml(exp.startDate || '')}</span>${(exp.startDate || exp.endDate || options.editable) ? ' \u2013 ' : ''}<span ${editableAttrs(options, `experiences.${i}.endDate`, 'End Date')}>${escapeHtml(exp.endDate || '')}</span></span>` : ''}
				</div>
				${bullets.length > 0 ? `
				<ul style="margin: 0; padding-left: 16px; margin-top: 4px; list-style-type: disc;">
					${bullets.map((b, j) => `<li style="font-size: ${ts(16)}px; line-height: 1.55; color: #333; margin-bottom: 3px; font-family: ${fontFamily};" ${options.editable ? `data-bullet-index="${j}"` : ''} ${b.id ? `data-description-id="${b.id}"` : ''}><span ${editableAttrs(options, `experiences.${i}.descriptions.${j}.content`, 'Describe what you did...', { multiline: true })}>${escapeHtml(b.content || '')}</span></li>`).join('\n\t\t\t\t\t')}
				</ul>` : ''}
			</div>`
			}).join('\n')}
		</div>`
}

function generateEducationSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	const allEducation = formData.education || []
	const education = options.editable ? allEducation : allEducation.filter(edu => edu.school || edu.degree)
	if (education.length === 0) return ''
	const header = formData.headers?.educationHeader || 'Education'
	return `
		<div style="margin-bottom: 20px;" data-section-id="education">
			${sectionHeader(header, accentColor, fontFamily, ts, options, 'headers.educationHeader', 'Education')}
			${education.map((edu, i) => {
				const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' \u2013 ')
				return `
			<div style="display: flex; justify-content: space-between; margin-bottom: 8px;" ${options.editable ? `data-education-id="${edu.id}"` : ''}>
				<div>
					<div style="font-size: ${ts(16)}px; font-weight: 700; color: #111; font-family: ${fontFamily};" ${editableAttrs(options, `education.${i}.school`, 'School Name')}>${escapeHtml(edu.school || '')}</div>
					<div style="font-size: ${ts(16)}px; color: #444; font-family: ${fontFamily};" ${editableAttrs(options, `education.${i}.degree`, 'Degree')}>${escapeHtml(edu.degree || '')}</div>
				</div>
				${(dates || options.editable) ? `<span style="font-size: ${ts(12.5)}px; color: #666; font-family: ${fontFamily}; white-space: nowrap;"><span ${editableAttrs(options, `education.${i}.startDate`, 'Start Date')}>${escapeHtml(edu.startDate || '')}</span>${(edu.startDate || edu.endDate || options.editable) ? ' \u2013 ' : ''}<span ${editableAttrs(options, `education.${i}.endDate`, 'End Date')}>${escapeHtml(edu.endDate || '')}</span></span>` : ''}
			</div>`
			}).join('\n')}
		</div>`
}

function generateSkillsSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	const allSkills = formData.skills || []
	const skills = options.editable ? allSkills : allSkills.filter(s => s.name)
	if (skills.length === 0) return ''
	const header = formData.headers?.skillsHeader || 'Skills'
	return `
		<div style="margin-bottom: 20px;" data-section-id="skills">
			${sectionHeader(header, accentColor, fontFamily, ts, options, 'headers.skillsHeader', 'Skills')}
			${skills.map((s, i) => `<div style="font-size: ${ts(16)}px; color: #333; line-height: 1.6; font-family: ${fontFamily};" ${options.editable ? `data-skill-id="${s.id}"` : ''} ${editableAttrs(options, `skills.${i}.name`, 'Skill')}>${escapeHtml(s.name || '')}</div>`).join('\n\t\t\t')}
		</div>`
}

function generateHobbiesSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	const allHobbies = formData.hobbies || []
	const hobbies = options.editable ? allHobbies : allHobbies.filter(h => h.name)
	if (hobbies.length === 0) return ''
	const header = formData.headers?.hobbiesHeader || 'Interests & Activities'
	return `
		<div style="margin-bottom: 20px;" data-section-id="hobbies">
			${sectionHeader(header, accentColor, fontFamily, ts, options, 'headers.hobbiesHeader', 'Interests')}
			${hobbies.map((h, i) => `<div style="font-size: ${ts(16)}px; color: #333; line-height: 1.6; font-family: ${fontFamily};" ${options.editable ? `data-hobby-id="${h.id}"` : ''} ${editableAttrs(options, `hobbies.${i}.name`, 'Interest')}>${escapeHtml(h.name || '')}</div>`).join('\n\t\t\t')}
		</div>`
}

function generateSection(secId: string, formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	switch (secId) {
		case 'summary':
			if (formData.visibleSections?.about === false) return ''
			return generateSummarySection(formData, accentColor, fontFamily, ts, options)
		case 'experience':
			if (formData.visibleSections?.experience === false) return ''
			return generateExperienceSection(formData, accentColor, fontFamily, ts, options)
		case 'education':
			if (formData.visibleSections?.education === false) return ''
			return generateEducationSection(formData, accentColor, fontFamily, ts, options)
		case 'skills':
			if (formData.visibleSections?.skills === false) return ''
			return generateSkillsSection(formData, accentColor, fontFamily, ts, options)
		case 'hobbies':
			if (formData.visibleSections?.hobbies === false) return ''
			return generateHobbiesSection(formData, accentColor, fontFamily, ts, options)
		default:
			return ''
	}
}

export function generate(
	formData: ResumeData,
	sectionOrder: string[],
	options: TemplateOptions,
	theme: TemplateTheme,
): string {
	const fontFamily = theme.bodyFont
	const accentColor = theme.accentColor
	const ts = makeTs(theme.textScale)

	const sectionsHtml = sectionOrder
		.map(secId => generateSection(secId, formData, accentColor, fontFamily, ts, options))
		.filter(Boolean)
		.join('\n')

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	${theme.fontLinks}
	<style>
		@page { margin: 0; }
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: ${fontFamily};
			font-size: ${ts(16)}px;
			line-height: 1.5;
			color: #1a1a1a;
			-webkit-font-smoothing: antialiased;
		}
		.resume {
			padding: 48px 48px;
		}
		[data-experience-id],
		[data-education-id] {
			break-inside: avoid;
		}
		@media print {
			.page-gap {
				display: none;
			}
		}${options.editable ? getEditableCss() : ''}
	</style>
</head>
<body>
	<div class="resume">
		${generateHeader(formData, accentColor, fontFamily, ts, options)}
		${sectionsHtml}
	</div>
</body>
</html>`
}
