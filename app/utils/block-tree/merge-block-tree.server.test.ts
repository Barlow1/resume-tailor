import { describe, it, expect } from 'vitest'
import { mergeBlockTree } from './merge-block-tree.server'
import type { BlockTree } from './types'

/**
 * Build a minimal AI-generated BlockTree with sensible defaults.
 * Override any field via the `overrides` parameter.
 */
function buildAIBlockTree(overrides: Partial<BlockTree> = {}): BlockTree {
	return {
		layout: 'single-column',
		layoutConfig: undefined,
		regionStyles: undefined,
		globalTokens: {
			fontFamily: 'Inter',
			fontSize: 10,
			fontWeight: 400,
			color: '#000000',
			paddingTop: 0,
			paddingBottom: 0,
			marginTop: 0,
			marginBottom: 0,
			textAlign: 'left',
		},
		fonts: [],
		blocks: [],
		pageSettings: { width: 0, height: 0, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
		...overrides,
	}
}

describe('mergeBlockTree', () => {
	it('pageSettings always comes from docxData', () => {
		const aiTree = buildAIBlockTree({
			pageSettings: { width: 0, height: 0, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
		})

		const docxData = {
			pageSettings: {
				width: 816,
				height: 1056,
				margins: { top: 48, right: 48, bottom: 48, left: 48 },
			},
		}

		const merged = mergeBlockTree(aiTree, docxData)

		expect(merged.pageSettings).toEqual({
			width: 816,
			height: 1056,
			margins: { top: 48, right: 48, bottom: 48, left: 48 },
		})
	})

	it('font URLs populated via matchFont()', () => {
		const aiTree = buildAIBlockTree({
			globalTokens: {
				fontFamily: 'Garamond',
				fontSize: 10,
				fontWeight: 400,
				color: '#000000',
				paddingTop: 0,
				paddingBottom: 0,
				marginTop: 0,
				marginBottom: 0,
				textAlign: 'left',
			},
			blocks: [
				{
					id: 'exp-1',
					type: 'experience',
					region: 'main',
					order: 1,
					content: {
						entries: [
							{
								company: 'Acme',
								title: 'Engineer',
								dateStart: '2024',
								bullets: [[{ text: 'Did stuff' }]],
							},
						],
					} as BlockTree['blocks'][number]['content'],
					tokens: { fontFamily: 'Cardo' },
					decorations: [],
				},
			],
		})

		const docxData = {
			pageSettings: { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } },
		}

		const merged = mergeBlockTree(aiTree, docxData)

		expect(merged.fonts).toHaveLength(2)

		const garamondEntry = merged.fonts.find(f => f.originalFont === 'Garamond')
		expect(garamondEntry).toBeDefined()
		expect(garamondEntry!.matchedFont).toBe('EB Garamond')
		expect(garamondEntry!.url).toContain('fonts.googleapis.com')
		expect(garamondEntry!.source).toBe('google')

		const cardoEntry = merged.fonts.find(f => f.originalFont === 'Cardo')
		expect(cardoEntry).toBeDefined()
		// Cardo is not in the curated map, so it falls back to default
		expect(cardoEntry!.url).toContain('fonts.googleapis.com')
	})

	it('AI content and tokens are preserved', () => {
		const aiTree = buildAIBlockTree({
			layout: 'sidebar-left',
			layoutConfig: { sidebarWidth: 200, columnGap: 16 },
			regionStyles: { sidebar: { backgroundColor: '#1a1a2e' } },
			globalTokens: {
				fontFamily: 'Inter',
				fontSize: 10,
				fontWeight: 400,
				color: '#333333',
				paddingTop: 4,
				paddingBottom: 4,
				marginTop: 0,
				marginBottom: 8,
				textAlign: 'left',
				lineHeight: 1.4,
			},
			blocks: [
				{
					id: 'header-1',
					type: 'header',
					region: 'main',
					order: 0,
					content: {
						name: 'Jane Doe',
						role: 'Software Engineer',
						contact: [{ type: 'email', value: 'jane@example.com' }],
					},
					tokens: { fontSize: 24, fontWeight: 700 },
					decorations: [
						{
							type: 'horizontal-rule',
							position: 'below',
							renderAs: 'css',
							css: { borderBottom: '2px solid #333' },
							relativeTo: 'block',
						},
					],
				},
				{
					id: 'exp-1',
					type: 'experience',
					region: 'main',
					order: 1,
					content: {
						entries: [
							{
								company: 'Acme Corp',
								title: 'Senior Engineer',
								dateStart: '2022',
								dateEnd: 'Present',
								bullets: [[{ text: 'Led a team of 5' }], [{ text: 'Shipped v2.0' }]],
							},
						],
					},
					tokens: { fontSize: 10 },
					decorations: [],
				},
			],
		})

		const docxData = {
			pageSettings: { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } },
		}

		const merged = mergeBlockTree(aiTree, docxData)

		// Layout preserved
		expect(merged.layout).toBe('sidebar-left')
		expect(merged.layoutConfig).toEqual({ sidebarWidth: 200, columnGap: 16 })

		// Region styles preserved
		expect(merged.regionStyles).toEqual({ sidebar: { backgroundColor: '#1a1a2e' } })

		// Global tokens preserved
		expect(merged.globalTokens.fontFamily).toBe('Inter')
		expect(merged.globalTokens.color).toBe('#333333')
		expect(merged.globalTokens.lineHeight).toBe(1.4)

		// Blocks preserved
		expect(merged.blocks).toHaveLength(2)

		const header = merged.blocks[0]
		expect(header.type).toBe('header')
		expect((header.content as { name: string }).name).toBe('Jane Doe')
		expect(header.tokens.fontSize).toBe(24)
		expect(header.decorations).toHaveLength(1)
		expect(header.decorations[0].type).toBe('horizontal-rule')

		const experience = merged.blocks[1]
		expect(experience.type).toBe('experience')
		const entries = (experience.content as { entries: { company: string; bullets: { text: string }[][] }[] }).entries
		expect(entries[0].company).toBe('Acme Corp')
		expect(entries[0].bullets).toHaveLength(2)
	})

	it('fonts[] includes every unique font from AI output', () => {
		const aiTree = buildAIBlockTree({
			globalTokens: {
				fontFamily: 'Inter',
				fontSize: 10,
				fontWeight: 400,
				color: '#000000',
				paddingTop: 0,
				paddingBottom: 0,
				marginTop: 0,
				marginBottom: 0,
				textAlign: 'left',
			},
			blocks: [
				{
					id: 'exp-1',
					type: 'experience',
					region: 'main',
					order: 1,
					content: {
						entries: [
							{
								company: 'Acme',
								title: 'Engineer',
								dateStart: '2024',
								bullets: [[{ text: 'Built things' }]],
							},
						],
					} as BlockTree['blocks'][number]['content'],
					tokens: { fontFamily: 'Montserrat' },
					decorations: [],
				},
				{
					id: 'header-1',
					type: 'header',
					region: 'main',
					order: 0,
					content: {
						name: 'John Doe',
						contact: [],
						headerTokens: {
							name: { fontFamily: 'Playfair Display' },
						},
					},
					tokens: {},
					decorations: [],
				},
			],
		})

		const docxData = {
			pageSettings: { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } },
		}

		const merged = mergeBlockTree(aiTree, docxData)

		expect(merged.fonts).toHaveLength(3)

		const fontOriginals = merged.fonts.map(f => f.originalFont).sort()
		expect(fontOriginals).toEqual(['Inter', 'Montserrat', 'Playfair Display'])
	})

	it('deduplicated fonts — same font in globalTokens and block tokens produces one entry', () => {
		const aiTree = buildAIBlockTree({
			globalTokens: {
				fontFamily: 'Inter',
				fontSize: 10,
				fontWeight: 400,
				color: '#000000',
				paddingTop: 0,
				paddingBottom: 0,
				marginTop: 0,
				marginBottom: 0,
				textAlign: 'left',
			},
			blocks: [
				{
					id: 'exp-1',
					type: 'experience',
					region: 'main',
					order: 1,
					content: {
						entries: [
							{
								company: 'Acme',
								title: 'Engineer',
								dateStart: '2024',
								bullets: [[{ text: 'Built things' }]],
							},
						],
					} as BlockTree['blocks'][number]['content'],
					tokens: { fontFamily: 'Inter' },
					decorations: [],
				},
			],
		})

		const docxData = {
			pageSettings: { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } },
		}

		const merged = mergeBlockTree(aiTree, docxData)

		expect(merged.fonts).toHaveLength(1)
		expect(merged.fonts[0].originalFont).toBe('Inter')
	})
})
