import type { ResumeData } from '../builder-resume.server.ts'

export type TemplateOptions = {
	editable: boolean
}

export type TemplateTheme = {
	headingFont: string
	bodyFont: string
	accentColor: string
	textScale: number
	fontLinks: string
}

export type GenerateFn = (
	formData: ResumeData,
	sectionOrder: string[],
	options: TemplateOptions,
	theme: TemplateTheme,
) => string

export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export function sanitizeColor(color: string, fallback: string): string {
	return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color) ? color : fallback
}

export function editableAttrs(
	options: TemplateOptions,
	field: string,
	placeholder: string,
	extra?: { multiline?: boolean; sectionId?: string; experienceId?: string; educationId?: string; bulletIndex?: number }
): string {
	if (!options.editable) return ''

	let attrs = `contenteditable="true" data-field="${field}" data-placeholder="${placeholder}"`
	if (extra?.multiline) attrs += ` data-multiline="true"`
	if (extra?.sectionId) attrs += ` data-section-id="${extra.sectionId}"`
	if (extra?.experienceId) attrs += ` data-experience-id="${extra.experienceId}"`
	if (extra?.educationId) attrs += ` data-education-id="${extra.educationId}"`
	if (extra?.bulletIndex !== undefined) attrs += ` data-bullet-index="${extra.bulletIndex}"`
	return attrs
}

export function getEditableCss(): string {
	return `
		[contenteditable] {
			cursor: text;
			min-width: 20px;
			min-height: 1em;
		}
		[contenteditable]:focus {
			outline: none;
			background: rgba(107, 69, 255, 0.04);
			box-shadow: inset 0 0 0 1px rgba(107, 69, 255, 0.4);
			border-radius: 2px;
		}
		[contenteditable]:empty::before {
			content: attr(data-placeholder);
			color: #9ca3af;
			font-style: italic;
			pointer-events: none;
		}
		.contact-sep {
			pointer-events: none;
			user-select: none;
		}`
}

/** Scaling helper: applies textScale to a base font size, rounded to 1dp */
export function makeTs(textScale: number): (base: number) => number {
	return (base: number) => Math.round(base * textScale * 10) / 10
}
