import type { GenerateFn } from './shared.ts'
import { generate as simpleGenerate } from './simple.ts'
import { generate as slateGenerate } from './slate.ts'
import { generate as warmGenerate } from './warm.ts'
import { generate as editorialGenerate } from './editorial.ts'
import { generate as modernistGenerate } from './modernist.ts'

// ─── Template Definitions ────────────────────────────────────

export type TemplateDefinition = {
	id: string
	name: string
	defaultPairing: string
	defaultAccent: string
	generate: GenerateFn
}

export const TEMPLATES: TemplateDefinition[] = [
	{
		id: 'slate',
		name: 'Slate',
		defaultPairing: 'inter',
		defaultAccent: '#1b3a5c',
		generate: slateGenerate,
	},
	{
		id: 'warm',
		name: 'Warm',
		defaultPairing: 'dm-serif-ibm-plex',
		defaultAccent: '#5c4a3a',
		generate: warmGenerate,
	},
	{
		id: 'editorial',
		name: 'Editorial',
		defaultPairing: 'playfair-source-sans',
		defaultAccent: '#3d3d3d',
		generate: editorialGenerate,
	},
	{
		id: 'modernist',
		name: 'Modernist',
		defaultPairing: 'space-grotesk',
		defaultAccent: '#111111',
		generate: modernistGenerate,
	},
	{
		id: 'simple',
		name: 'Simple',
		defaultPairing: 'crimson-pro',
		defaultAccent: '#111',
		generate: simpleGenerate,
	},
]

/**
 * Resolve template by layout ID.
 * - null, undefined, 'traditional', or unknown → Simple (backward compat: existing resumes unchanged)
 * - New resumes should explicitly set layout='slate' in getDefaultFormData()
 */
export function getTemplate(layoutId: string | null | undefined): TemplateDefinition {
	if (!layoutId || layoutId === 'traditional' || layoutId === 'professional' || layoutId === 'modern') {
		return TEMPLATES.find(t => t.id === 'simple')!
	}
	return TEMPLATES.find(t => t.id === layoutId) || TEMPLATES.find(t => t.id === 'simple')!
}

// ─── Font Pairings ───────────────────────────────────────────

export type FontPairing = {
	id: string
	label: string
	headingFamily: string
	bodyFamily: string
	googleFontLinks: string[]
	legacy?: boolean
}

const GOOGLE_PRECONNECT = [
	'<link rel="preconnect" href="https://fonts.googleapis.com">',
	'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
]

export const FONT_PAIRINGS: FontPairing[] = [
	// ── Active pairings (shown in UI) ──
	{
		id: 'inter',
		label: 'Inter',
		headingFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
		bodyFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">'],
	},
	{
		id: 'dm-serif-ibm-plex',
		label: 'DM Serif + IBM Plex',
		headingFamily: "'DM Serif Display', Georgia, serif",
		bodyFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'],
	},
	{
		id: 'playfair-source-sans',
		label: 'Playfair + Source Sans',
		headingFamily: "'Playfair Display', Georgia, serif",
		bodyFamily: "'Source Sans 3', 'Helvetica Neue', Arial, sans-serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">'],
	},
	{
		id: 'space-grotesk',
		label: 'Space Grotesk',
		headingFamily: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
		bodyFamily: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">'],
	},
	{
		id: 'crimson-pro',
		label: 'Crimson Pro',
		headingFamily: "'Crimson Pro', Georgia, serif",
		bodyFamily: "'Crimson Pro', Georgia, serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;700;800&display=swap" rel="stylesheet">'],
	},
	// ── Legacy pairings (resolve old font values, hidden from picker) ──
	{
		id: 'font-crimson',
		label: 'Crimson Pro',
		headingFamily: "'Crimson Pro', Georgia, serif",
		bodyFamily: "'Crimson Pro', Georgia, serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;700;800&display=swap" rel="stylesheet">'],
		legacy: true,
	},
	{
		id: 'font-sans',
		label: 'Arial',
		headingFamily: 'Arial, Helvetica, sans-serif',
		bodyFamily: 'Arial, Helvetica, sans-serif',
		googleFontLinks: [...GOOGLE_PRECONNECT],
		legacy: true,
	},
	{
		id: 'font-serif',
		label: 'Georgia',
		headingFamily: 'Georgia, "Times New Roman", serif',
		bodyFamily: 'Georgia, "Times New Roman", serif',
		googleFontLinks: [...GOOGLE_PRECONNECT],
		legacy: true,
	},
	{
		id: 'font-mono',
		label: 'Courier',
		headingFamily: '"Courier New", Courier, monospace',
		bodyFamily: '"Courier New", Courier, monospace',
		googleFontLinks: [...GOOGLE_PRECONNECT],
		legacy: true,
	},
	{
		id: 'font-garamond',
		label: 'EB Garamond',
		headingFamily: "'EB Garamond', Garamond, 'Times New Roman', serif",
		bodyFamily: "'EB Garamond', Garamond, 'Times New Roman', serif",
		googleFontLinks: [...GOOGLE_PRECONNECT, '<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;700;800&display=swap" rel="stylesheet">'],
		legacy: true,
	},
	{
		id: 'font-trebuchet',
		label: 'Trebuchet',
		headingFamily: '"Trebuchet MS", Helvetica, sans-serif',
		bodyFamily: '"Trebuchet MS", Helvetica, sans-serif',
		googleFontLinks: [...GOOGLE_PRECONNECT],
		legacy: true,
	},
	{
		id: 'font-verdana',
		label: 'Verdana',
		headingFamily: 'Verdana, Geneva, sans-serif',
		bodyFamily: 'Verdana, Geneva, sans-serif',
		googleFontLinks: [...GOOGLE_PRECONNECT],
		legacy: true,
	},
]

export function getPairing(fontId: string | null | undefined): FontPairing | undefined {
	if (!fontId) return undefined
	return FONT_PAIRINGS.find(p => p.id === fontId)
}

// ─── Color Palette ───────────────────────────────────────────

export type ColorOption = {
	id: string
	name: string
	hex: string
}

export const COLOR_PALETTE: ColorOption[] = [
	{ id: 'navy', name: 'Navy', hex: '#1b3a5c' },
	{ id: 'charcoal', name: 'Charcoal', hex: '#3d3d3d' },
	{ id: 'warm', name: 'Warm', hex: '#5c4a3a' },
	{ id: 'black', name: 'Black', hex: '#111111' },
	{ id: 'forest', name: 'Forest', hex: '#2d5a3d' },
	{ id: 'burgundy', name: 'Burgundy', hex: '#6b2d3e' },
	{ id: 'blue', name: 'Blue', hex: '#2563EB' },
	{ id: 'green', name: 'Green', hex: '#059669' },
]

// ─── Template Metadata (lightweight, safe for client import) ─

export type TemplateMeta = {
	id: string
	name: string
	defaultPairing: string
	defaultAccent: string
}

export const TEMPLATE_META: TemplateMeta[] = TEMPLATES.map(t => ({
	id: t.id,
	name: t.name,
	defaultPairing: t.defaultPairing,
	defaultAccent: t.defaultAccent,
}))
