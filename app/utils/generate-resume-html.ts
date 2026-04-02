import type { ResumeData } from './builder-resume.server.ts'
import { sanitizeColor } from './templates/shared.ts'
import { getTemplate, getPairing } from './templates/registry.ts'

export type { TemplateOptions } from './templates/shared.ts'

export function generateResumeHtml(
	formData: ResumeData,
	sectionOrder: string[],
	options: { editable: boolean } = { editable: false }
): string {
	const template = getTemplate(formData.layout)
	const pairing = getPairing(formData.font) ?? getPairing(template.defaultPairing)!
	const theme = {
		headingFont: pairing.headingFamily,
		bodyFont: pairing.bodyFamily,
		accentColor: sanitizeColor(formData.nameColor || '', template.defaultAccent),
		// Calibrated to Word pt sizes for bullet text: small=11pt, medium=12pt, large=14pt
		textScale: formData.textSize === 'small' ? 0.917 : formData.textSize === 'large' ? 1.167 : 1,
		fontLinks: pairing.googleFontLinks.join('\n\t'),
	}
	return template.generate(formData, sectionOrder, options, theme)
}
