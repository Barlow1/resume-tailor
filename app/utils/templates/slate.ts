import type { ResumeData } from '../builder-resume.server.ts'
import type { TemplateOptions, TemplateTheme } from './shared.ts'
import { escapeHtml, editableAttrs, getEditableCss, makeTs } from './shared.ts'

function sectionHeader(title: string, accentColor: string, fontFamily: string, ts: (n: number) => number, options: TemplateOptions, headerField: string, placeholder: string): string {
	return `<div style="font-size: ${ts(13)}px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${accentColor}; border-bottom: 1.5px solid ${accentColor}20; padding-bottom: 5px; margin-bottom: 12px; font-family: ${fontFamily};" ${editableAttrs(options, headerField, placeholder)}>${escapeHtml(title)}</div>`
}

function generateContactLine(formData: ResumeData, fontFamily: string, ts: (n: number) => number, options: TemplateOptions): string {
	const contactFields = [
		{ field: 'location', placeholder: 'Location', value: formData.location },
		{ field: 'email', placeholder: 'Email', value: formData.email },
		{ field: 'phone', placeholder: 'Phone', value: formData.phone },
		{ field: 'website', placeholder: 'Website', value: formData.website },
	]
	const nonEmpty = contactFields.filter(c => c.value)
	if (nonEmpty.length === 0 && !options.editable) return ''
	const fields = options.editable ? contactFields : nonEmpty
	return fields.map((c, idx) => {
		const sep = idx > 0 ? '<span class="contact-sep" style="color: #bbb; margin: 0 6px;">|</span>' : ''
		return `${sep}<span ${editableAttrs(options, c.field, c.placeholder)} style="font-family: ${fontFamily};">${escapeHtml(c.value || '')}</span>`
	}).join('')
}

export function generate(
	formData: ResumeData,
	sectionOrder: string[],
	options: TemplateOptions,
	theme: TemplateTheme,
): string {
	const body = theme.bodyFont
	const heading = theme.headingFont
	const accent = theme.accentColor
	const ts = makeTs(theme.textScale)

	const contactHtml = generateContactLine(formData, body, ts, options)
	const rolePart = (formData.role || options.editable)
		? `<span ${editableAttrs(options, 'role', 'Job Title')} style="font-family: ${body};">${escapeHtml(formData.role || '')}</span>`
		: ''
	const barParts: string[] = []
	if (rolePart) barParts.push(rolePart)
	if (contactHtml) barParts.push(contactHtml)
	const barContent = barParts.join('<span class="contact-sep" style="color: #bbb; margin: 0 6px;">|</span>')

	const headerHtml = `
		<div style="margin-bottom: 28px;">
			<div style="font-size: ${ts(28)}px; font-weight: 700; color: ${accent}; letter-spacing: -0.02em; font-family: ${heading};" ${editableAttrs(options, 'name', 'Your Name')}>${escapeHtml(formData.name || '')}</div>
			${barContent ? `<div style="font-size: ${ts(13)}px; color: #555; margin-top: 8px; padding: 8px 0; border-top: 1.5px solid ${accent}30; border-bottom: 1.5px solid ${accent}30; font-family: ${body};">${barContent}</div>` : ''}
		</div>`

	// ── Sections ──
	function summarySection(): string {
		if (!formData.about && !options.editable) return ''
		const h = formData.headers?.aboutHeader || 'Summary'
		return `
		<div style="margin-bottom: 20px;" data-section-id="about">
			${sectionHeader(h, accent, heading, ts, options, 'headers.aboutHeader', 'Summary')}
			<div style="font-size: ${ts(16)}px; line-height: 1.6; color: #333; font-family: ${body};" ${editableAttrs(options, 'about', 'Write a professional summary...', { multiline: true })}>${escapeHtml(formData.about || '')}</div>
		</div>`
	}

	function experienceSection(): string {
		const all = formData.experiences || []
		const exps = options.editable ? all : all.filter(e => e.role || e.company)
		if (exps.length === 0) return ''
		const h = formData.headers?.experienceHeader || 'Experience'
		return `
		<div style="margin-bottom: 20px;" data-section-id="experience">
			${sectionHeader(h, accent, heading, ts, options, 'headers.experienceHeader', 'Experience')}
			${exps.map((exp, i) => {
				const bullets = options.editable ? (exp.descriptions || []) : (exp.descriptions || []).filter(b => b.content)
				return `
			<div style="margin-bottom: 16px; break-inside: avoid;" ${options.editable ? `data-experience-id="${exp.id}"` : ''}>
				<div style="display: flex; justify-content: space-between; align-items: baseline;">
					<div style="display: flex; gap: 6px; align-items: baseline;">
						<span style="font-size: ${ts(16)}px; font-weight: 700; color: #111; font-family: ${body};" ${editableAttrs(options, `experiences.${i}.role`, 'Job Title')}>${escapeHtml(exp.role || '')}</span>
						${(exp.company || options.editable) ? `<span style="font-size: ${ts(15)}px; color: ${accent}; font-family: ${body};">&middot;</span> <span style="font-size: ${ts(15)}px; color: #444; font-family: ${body};" ${editableAttrs(options, `experiences.${i}.company`, 'Company Name')}>${escapeHtml(exp.company || '')}</span>` : ''}
					</div>
					${(exp.startDate || exp.endDate || options.editable) ? `<span style="font-size: ${ts(12.5)}px; color: #888; font-family: ${body}; flex-shrink: 0; white-space: nowrap;"><span ${editableAttrs(options, `experiences.${i}.startDate`, 'Start')}>${escapeHtml(exp.startDate || '')}</span>${(exp.startDate || exp.endDate || options.editable) ? ' \u2013 ' : ''}<span ${editableAttrs(options, `experiences.${i}.endDate`, 'End')}>${escapeHtml(exp.endDate || '')}</span></span>` : ''}
				</div>
				${bullets.length > 0 ? `
				<ul style="margin: 6px 0 0; padding-left: 18px; list-style-type: disc;">
					${bullets.map((b, j) => `<li style="font-size: ${ts(16)}px; line-height: 1.55; color: #333; margin-bottom: 3px; font-family: ${body};" ${options.editable ? `data-bullet-index="${j}"` : ''} ${b.id ? `data-description-id="${b.id}"` : ''}><span ${editableAttrs(options, `experiences.${i}.descriptions.${j}.content`, 'Describe what you did...', { multiline: true })}>${escapeHtml(b.content || '')}</span></li>`).join('\n\t\t\t\t\t')}
				</ul>` : ''}
			</div>`
			}).join('\n')}
		</div>`
	}

	function educationSection(): string {
		const all = formData.education || []
		const edu = options.editable ? all : all.filter(e => e.school || e.degree)
		if (edu.length === 0) return ''
		const h = formData.headers?.educationHeader || 'Education'
		return `
		<div style="margin-bottom: 20px;" data-section-id="education">
			${sectionHeader(h, accent, heading, ts, options, 'headers.educationHeader', 'Education')}
			${edu.map((e, i) => `
			<div style="display: flex; justify-content: space-between; margin-bottom: 10px; break-inside: avoid;" ${options.editable ? `data-education-id="${e.id}"` : ''}>
				<div>
					<div style="font-size: ${ts(16)}px; font-weight: 700; color: #111; font-family: ${body};" ${editableAttrs(options, `education.${i}.school`, 'School Name')}>${escapeHtml(e.school || '')}</div>
					<div style="font-size: ${ts(15)}px; color: #444; font-family: ${body};" ${editableAttrs(options, `education.${i}.degree`, 'Degree')}>${escapeHtml(e.degree || '')}</div>
				</div>
				${(e.startDate || e.endDate || options.editable) ? `<span style="font-size: ${ts(12.5)}px; color: #888; font-family: ${body}; white-space: nowrap;"><span ${editableAttrs(options, `education.${i}.startDate`, 'Start')}>${escapeHtml(e.startDate || '')}</span>${(e.startDate || e.endDate || options.editable) ? ' \u2013 ' : ''}<span ${editableAttrs(options, `education.${i}.endDate`, 'End')}>${escapeHtml(e.endDate || '')}</span></span>` : ''}
			</div>`).join('\n')}
		</div>`
	}

	function skillsSection(): string {
		const all = formData.skills || []
		const skills = options.editable ? all : all.filter(s => s.name)
		if (skills.length === 0) return ''
		const h = formData.headers?.skillsHeader || 'Skills'
		return `
		<div style="margin-bottom: 20px;" data-section-id="skills">
			${sectionHeader(h, accent, heading, ts, options, 'headers.skillsHeader', 'Skills')}
			<div style="display: flex; flex-wrap: wrap; gap: 6px 12px;">
				${skills.map((s, i) => `<span style="font-size: ${ts(15)}px; color: #333; background: ${accent}08; padding: 3px 10px; border-radius: 4px; font-family: ${body};" ${options.editable ? `data-skill-id="${s.id}"` : ''} ${editableAttrs(options, `skills.${i}.name`, 'Skill')}>${escapeHtml(s.name || '')}</span>`).join('\n\t\t\t\t')}
			</div>
		</div>`
	}

	function hobbiesSection(): string {
		const all = formData.hobbies || []
		const hobbies = options.editable ? all : all.filter(h => h.name)
		if (hobbies.length === 0) return ''
		const h = formData.headers?.hobbiesHeader || 'Interests & Activities'
		return `
		<div style="margin-bottom: 20px;" data-section-id="hobbies">
			${sectionHeader(h, accent, heading, ts, options, 'headers.hobbiesHeader', 'Interests')}
			${hobbies.map((hob, i) => `<div style="font-size: ${ts(16)}px; color: #333; line-height: 1.6; font-family: ${body};" ${options.editable ? `data-hobby-id="${hob.id}"` : ''} ${editableAttrs(options, `hobbies.${i}.name`, 'Interest')}>${escapeHtml(hob.name || '')}</div>`).join('\n\t\t\t')}
		</div>`
	}

	function renderSection(secId: string): string {
		switch (secId) {
			case 'summary': return formData.visibleSections?.about === false ? '' : summarySection()
			case 'experience': return formData.visibleSections?.experience === false ? '' : experienceSection()
			case 'education': return formData.visibleSections?.education === false ? '' : educationSection()
			case 'skills': return formData.visibleSections?.skills === false ? '' : skillsSection()
			case 'hobbies': return formData.visibleSections?.hobbies === false ? '' : hobbiesSection()
			default: return ''
		}
	}

	const sectionsHtml = sectionOrder.map(renderSection).filter(Boolean).join('\n')

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	${theme.fontLinks}
	<style>
		@page { margin: 0; }
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: ${body};
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
			.page-gap { display: none; }
		}${options.editable ? getEditableCss() : ''}
	</style>
</head>
<body>
	<div class="resume">
		${headerHtml}
		${sectionsHtml}
	</div>
</body>
</html>`
}
