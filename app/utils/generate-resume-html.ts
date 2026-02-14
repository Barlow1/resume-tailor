import type { ResumeData } from './builder-resume.server.ts'

const FONT_OPTIONS = [
	{ value: 'font-crimson', family: "'Crimson Pro', Georgia, serif" },
	{ value: 'font-sans', family: 'Arial, Helvetica, sans-serif' },
	{ value: 'font-serif', family: 'Georgia, "Times New Roman", serif' },
	{ value: 'font-mono', family: '"Courier New", Courier, monospace' },
	{ value: 'font-garamond', family: "'EB Garamond', Garamond, 'Times New Roman', serif" },
	{ value: 'font-trebuchet', family: '"Trebuchet MS", Helvetica, sans-serif' },
	{ value: 'font-verdana', family: 'Verdana, Geneva, sans-serif' },
]

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function getGoogleFontsLinks(fontValue: string): string {
	const links = [
		'<link rel="preconnect" href="https://fonts.googleapis.com">',
		'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
	]
	if (fontValue === 'font-crimson') {
		links.push('<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;700;800&display=swap" rel="stylesheet">')
	}
	if (fontValue === 'font-garamond') {
		links.push('<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;700;800&display=swap" rel="stylesheet">')
	}
	return links.join('\n\t')
}

function sectionHeader(title: string, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	return `<div style="font-size: ${ts(12)}px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid ${accentColor}; padding-bottom: 4px; margin-bottom: 10px; font-family: ${fontFamily};">${escapeHtml(title)}</div>`
}

function generateHeader(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	const contactParts = [formData.location, formData.email, formData.phone, formData.website].filter(Boolean) as string[]
	return `
		<div style="margin-bottom: 24px;">
			<div style="font-size: ${ts(24)}px; font-weight: 700; color: ${accentColor}; letter-spacing: -0.01em; font-family: ${fontFamily};">${escapeHtml(formData.name || '')}</div>
			${formData.role ? `<div style="font-size: ${ts(14)}px; color: #444; margin-top: 4px; font-family: ${fontFamily};">${escapeHtml(formData.role)}</div>` : ''}
			${contactParts.length > 0 ? `<div style="font-size: ${ts(11.5)}px; color: #555; margin-top: 6px; font-family: ${fontFamily};">${contactParts.map(p => escapeHtml(p)).join(' &middot; ')}</div>` : ''}
		</div>`
}

function generateSummarySection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	if (!formData.about) return ''
	const header = formData.headers?.aboutHeader || 'Summary'
	return `
		<div style="margin-bottom: 20px;">
			${sectionHeader(header, accentColor, fontFamily, ts)}
			<div style="font-size: ${ts(12.5)}px; line-height: 1.6; color: #333; font-family: ${fontFamily};">${escapeHtml(formData.about)}</div>
		</div>`
}

function generateExperienceSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	const experiences = formData.experiences?.filter(exp => exp.role || exp.company) || []
	if (experiences.length === 0) return ''
	const header = formData.headers?.experienceHeader || 'Experience'
	return `
		<div style="margin-bottom: 20px;">
			${sectionHeader(header, accentColor, fontFamily, ts)}
			${experiences.map(exp => {
				const bullets = exp.descriptions?.filter(b => b.content) || []
				const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' \u2013 ')
				return `
			<div style="margin-bottom: 14px;">
				<div style="display: flex; justify-content: space-between; align-items: baseline;">
					<div style="display: flex; gap: 4px; align-items: baseline;">
						<span style="font-size: ${ts(13)}px; font-weight: 700; color: #111; font-family: ${fontFamily};">${escapeHtml(exp.role || '')}</span>
						${exp.company ? `<span style="font-size: ${ts(12.5)}px; color: #444; font-family: ${fontFamily};"> &middot; </span><span style="font-size: ${ts(12.5)}px; color: #444; font-family: ${fontFamily};">${escapeHtml(exp.company)}</span>` : ''}
					</div>
					${dates ? `<span style="font-size: ${ts(11)}px; color: #666; font-family: ${fontFamily}; flex-shrink: 0; white-space: nowrap;">${escapeHtml(dates)}</span>` : ''}
				</div>
				${bullets.length > 0 ? `
				<ul style="margin: 0; padding-left: 16px; margin-top: 4px; list-style-type: disc;">
					${bullets.map(b => `<li style="font-size: ${ts(12)}px; line-height: 1.55; color: #333; margin-bottom: 3px; font-family: ${fontFamily};">${escapeHtml(b.content!)}</li>`).join('\n\t\t\t\t\t')}
				</ul>` : ''}
			</div>`
			}).join('\n')}
		</div>`
}

function generateEducationSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	const education = formData.education?.filter(edu => edu.school || edu.degree) || []
	if (education.length === 0) return ''
	const header = formData.headers?.educationHeader || 'Education'
	return `
		<div style="margin-bottom: 20px;">
			${sectionHeader(header, accentColor, fontFamily, ts)}
			${education.map(edu => {
				const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' \u2013 ')
				return `
			<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
				<div>
					<div style="font-size: ${ts(13)}px; font-weight: 700; color: #111; font-family: ${fontFamily};">${escapeHtml(edu.school || '')}</div>
					<div style="font-size: ${ts(12)}px; color: #444; font-family: ${fontFamily};">${escapeHtml(edu.degree || '')}</div>
				</div>
				${dates ? `<span style="font-size: ${ts(11)}px; color: #666; font-family: ${fontFamily}; white-space: nowrap;">${escapeHtml(dates)}</span>` : ''}
			</div>`
			}).join('\n')}
		</div>`
}

function generateSkillsSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	const skills = formData.skills?.filter(s => s.name) || []
	if (skills.length === 0) return ''
	const header = formData.headers?.skillsHeader || 'Skills'
	return `
		<div style="margin-bottom: 20px;">
			${sectionHeader(header, accentColor, fontFamily, ts)}
			${skills.map(s => `<div style="font-size: ${ts(12)}px; color: #333; line-height: 1.6; font-family: ${fontFamily};">${escapeHtml(s.name!)}</div>`).join('\n\t\t\t')}
		</div>`
}

function generateHobbiesSection(formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	const hobbies = formData.hobbies?.filter(h => h.name) || []
	if (hobbies.length === 0) return ''
	const header = formData.headers?.hobbiesHeader || 'Interests & Activities'
	return `
		<div style="margin-bottom: 20px;">
			${sectionHeader(header, accentColor, fontFamily, ts)}
			${hobbies.map(h => `<div style="font-size: ${ts(12)}px; color: #333; line-height: 1.6; font-family: ${fontFamily};">${escapeHtml(h.name!)}</div>`).join('\n\t\t\t')}
		</div>`
}

function generateSection(secId: string, formData: ResumeData, accentColor: string, fontFamily: string, ts: (n: number) => number): string {
	switch (secId) {
		case 'summary':
			if (formData.visibleSections?.about === false) return ''
			return generateSummarySection(formData, accentColor, fontFamily, ts)
		case 'experience':
			if (formData.visibleSections?.experience === false) return ''
			return generateExperienceSection(formData, accentColor, fontFamily, ts)
		case 'education':
			if (formData.visibleSections?.education === false) return ''
			return generateEducationSection(formData, accentColor, fontFamily, ts)
		case 'skills':
			if (formData.visibleSections?.skills === false) return ''
			return generateSkillsSection(formData, accentColor, fontFamily, ts)
		case 'hobbies':
			if (formData.visibleSections?.hobbies === false) return ''
			return generateHobbiesSection(formData, accentColor, fontFamily, ts)
		default:
			return ''
	}
}

export function generateResumeHtml(formData: ResumeData, sectionOrder: string[]): string {
	const fontObj = FONT_OPTIONS.find(f => f.value === formData.font) || FONT_OPTIONS[0]
	const fontFamily = fontObj.family
	const accentColor = formData.nameColor || '#111'
	const textScale = formData.textSize === 'small' ? 0.833 : formData.textSize === 'large' ? 1.167 : 1
	const ts = (base: number) => Math.round(base * textScale * 10) / 10
	const fontLinks = getGoogleFontsLinks(formData.font || 'font-crimson')

	const sectionsHtml = sectionOrder
		.map(secId => generateSection(secId, formData, accentColor, fontFamily, ts))
		.filter(Boolean)
		.join('\n')

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	${fontLinks}
	<style>
		@page { margin: 0; }
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: ${fontFamily};
			font-size: ${ts(12)}px;
			line-height: 1.5;
			color: #1a1a1a;
			-webkit-font-smoothing: antialiased;
		}
		.resume {
			padding: 48px 48px;
		}
	</style>
</head>
<body>
	<div class="resume">
		${generateHeader(formData, accentColor, fontFamily, ts)}
		${sectionsHtml}
	</div>
</body>
</html>`
}
