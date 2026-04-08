import type { ResumeData } from '../builder-resume.server.ts'
import type { TemplateOptions, TemplateTheme } from './shared.ts'
import { escapeHtml, editableAttrs, getEditableCss, makeTs } from './shared.ts'

function sectionHeader(title: string, accentColor: string, headingFont: string, ts: (n: number) => number, options: TemplateOptions, headerField: string, placeholder: string): string {
	return `<div style="font-size: ${ts(15)}px; font-weight: 600; color: ${accentColor}; font-style: italic; margin-bottom: 10px; font-family: ${headingFont};" ${editableAttrs(options, headerField, placeholder)}>${escapeHtml(title)}</div>`
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

	// ── Contact ──
	const contactFields = [
		{ field: 'location', placeholder: 'Location', value: formData.location },
		{ field: 'email', placeholder: 'Email', value: formData.email },
		{ field: 'phone', placeholder: 'Phone', value: formData.phone },
		{ field: 'website', placeholder: 'Website', value: formData.website },
	]
	const visibleContacts = options.editable ? contactFields : contactFields.filter(c => c.value)
	const contactHtml = visibleContacts.length > 0 || options.editable
		? `<div style="font-size: ${ts(12.5)}px; color: #777; margin-top: 8px; text-align: center; font-family: ${body};">${visibleContacts.map((c, idx) => {
			const sep = idx > 0 ? '<span class="contact-sep" style="margin: 0 6px; color: #ccc;">&middot;</span>' : ''
			return `${sep}<span ${editableAttrs(options, c.field, c.placeholder)}>${escapeHtml(c.value || '')}</span>`
		}).join('')}</div>` : ''

	// Centered header
	const headerHtml = `
		<div style="margin-bottom: 28px; text-align: center;">
			<div style="font-size: ${ts(30)}px; font-weight: 800; color: ${accent}; letter-spacing: -0.01em; font-family: ${heading};" ${editableAttrs(options, 'name', 'Your Name')}>${escapeHtml(formData.name || '')}</div>
			${(formData.role || options.editable) ? `<div style="font-size: ${ts(16)}px; color: #555; margin-top: 6px; font-style: italic; font-family: ${body};" ${editableAttrs(options, 'role', 'Job Title')}>${escapeHtml(formData.role || '')}</div>` : ''}
			${contactHtml}
		</div>`

	// ── Sections with decorative left vertical rule ──
	function summarySection(): string {
		if (!formData.about && !options.editable) return ''
		const h = formData.headers?.aboutHeader || 'Summary'
		return `
		<div style="margin-bottom: 22px;" data-section-id="about">
			${sectionHeader(h, accent, heading, ts, options, 'headers.aboutHeader', 'Summary')}
			<div style="font-size: ${ts(16)}px; line-height: 1.7; color: #333; font-family: ${body};" ${editableAttrs(options, 'about', 'Write a professional summary...', { multiline: true })}>${escapeHtml(formData.about || '')}</div>
		</div>`
	}

	function experienceSection(): string {
		const all = formData.experiences || []
		const exps = options.editable ? all : all.filter(e => e.role || e.company)
		if (exps.length === 0) return ''
		const h = formData.headers?.experienceHeader || 'Experience'
		return `
		<div style="margin-bottom: 22px;" data-section-id="experience">
			${sectionHeader(h, accent, heading, ts, options, 'headers.experienceHeader', 'Experience')}
			${exps.map((exp, i) => {
				const bullets = options.editable ? (exp.descriptions || []) : (exp.descriptions || []).filter(b => b.content)
				// Job divider between entries (not before first)
				const divider = i > 0 ? `<hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">` : ''
				return `${divider}
			<div style="margin-bottom: 4px; break-inside: avoid;" ${options.editable ? `data-experience-id="${exp.id}"` : ''}>
				<div style="display: flex; justify-content: space-between; align-items: baseline;">
					<div>
						<span style="font-size: ${ts(16)}px; font-weight: 700; color: #222; font-family: ${heading};" ${editableAttrs(options, `experiences.${i}.role`, 'Job Title')}>${escapeHtml(exp.role || '')}</span>
						${(exp.company || options.editable) ? `<span style="font-size: ${ts(15)}px; color: #555; font-family: ${body}; margin-left: 6px;" ${editableAttrs(options, `experiences.${i}.company`, 'Company Name')}>${escapeHtml(exp.company || '')}</span>` : ''}
					</div>
					${(exp.startDate || exp.endDate || options.editable) ? `<span style="font-size: ${ts(12.5)}px; color: #888; font-style: italic; font-family: ${body}; flex-shrink: 0; white-space: nowrap;"><span ${editableAttrs(options, `experiences.${i}.startDate`, 'Start')}>${escapeHtml(exp.startDate || '')}</span>${(exp.startDate || exp.endDate || options.editable) ? ' \u2013 ' : ''}<span ${editableAttrs(options, `experiences.${i}.endDate`, 'End')}>${escapeHtml(exp.endDate || '')}</span></span>` : ''}
				</div>
				${bullets.length > 0 ? `
				<ul style="margin: 6px 0 0; padding-left: 16px; list-style: none;">
					${bullets.map((b, j) => `<li style="font-size: ${ts(16)}px; line-height: 1.6; color: #333; margin-bottom: 3px; padding-left: 6px; position: relative; font-family: ${body};" ${options.editable ? `data-bullet-index="${j}"` : ''} ${b.id ? `data-description-id="${b.id}"` : ''}><span style="position: absolute; left: -12px; color: ${accent}; font-size: 8px; top: 6px;">&#9632;</span><span ${editableAttrs(options, `experiences.${i}.descriptions.${j}.content`, 'Describe what you did...', { multiline: true })}>${escapeHtml(b.content || '')}</span></li>`).join('\n\t\t\t\t\t')}
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
		<div style="margin-bottom: 22px;" data-section-id="education">
			${sectionHeader(h, accent, heading, ts, options, 'headers.educationHeader', 'Education')}
			${edu.map((e, i) => `
			<div style="display: flex; justify-content: space-between; margin-bottom: 10px; break-inside: avoid;" ${options.editable ? `data-education-id="${e.id}"` : ''}>
				<div>
					<div style="font-size: ${ts(16)}px; font-weight: 700; color: #222; font-family: ${heading};" ${editableAttrs(options, `education.${i}.school`, 'School Name')}>${escapeHtml(e.school || '')}</div>
					<div style="font-size: ${ts(15)}px; color: #555; font-family: ${body};" ${editableAttrs(options, `education.${i}.degree`, 'Degree')}>${escapeHtml(e.degree || '')}</div>
				</div>
				${(e.startDate || e.endDate || options.editable) ? `<span style="font-size: ${ts(12.5)}px; color: #888; font-style: italic; font-family: ${body}; white-space: nowrap;"><span ${editableAttrs(options, `education.${i}.startDate`, 'Start')}>${escapeHtml(e.startDate || '')}</span>${(e.startDate || e.endDate || options.editable) ? ' \u2013 ' : ''}<span ${editableAttrs(options, `education.${i}.endDate`, 'End')}>${escapeHtml(e.endDate || '')}</span></span>` : ''}
			</div>`).join('\n')}
		</div>`
	}

	function skillsSection(): string {
		const all = formData.skills || []
		const skills = options.editable ? all : all.filter(s => s.name)
		if (skills.length === 0) return ''
		const h = formData.headers?.skillsHeader || 'Skills'
		return `
		<div style="margin-bottom: 22px;" data-section-id="skills">
			${sectionHeader(h, accent, heading, ts, options, 'headers.skillsHeader', 'Skills')}
			${skills.map((s, i) => `<div style="font-size: ${ts(16)}px; color: #333; line-height: 1.6; font-family: ${body};" ${options.editable ? `data-skill-id="${s.id}"` : ''} ${editableAttrs(options, `skills.${i}.name`, 'Skill')}>${escapeHtml(s.name || '')}</div>`).join('\n\t\t\t')}
		</div>`
	}

	function hobbiesSection(): string {
		const all = formData.hobbies || []
		const hobbies = options.editable ? all : all.filter(h => h.name)
		if (hobbies.length === 0) return ''
		const h = formData.headers?.hobbiesHeader || 'Interests & Activities'
		return `
		<div style="margin-bottom: 22px;" data-section-id="hobbies">
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
		/* Decorative left vertical rule on body content */
		.editorial-body {
			border-left: 3px solid ${accent}18;
			padding-left: 22px;
		}
		[data-experience-id],
		[data-education-id] {
			break-inside: avoid;
		}
		li span[contenteditable]:empty::before {
			content: 'Add a bullet point...';
			color: #9CA3AF;
			font-style: italic;
			pointer-events: none;
		}
		@media print {
			.page-gap { display: none; }
		}${options.editable ? getEditableCss() : ''}
	</style>
</head>
<body>
	<div class="resume">
		${headerHtml}
		<div class="editorial-body">
			${sectionsHtml}
		</div>
	</div>
</body>
</html>`
}
