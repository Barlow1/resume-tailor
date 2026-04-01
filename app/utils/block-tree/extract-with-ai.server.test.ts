import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BlockTree, DesignTokens, FontMapping } from './types'

// --- Test data ---

const VALID_AI_RESPONSE: BlockTree = {
	layout: 'single-column',
	globalTokens: {
		fontFamily: 'Garamond',
		fontSize: 11,
		fontWeight: 400,
		color: '#333333',
		paddingTop: 0,
		paddingBottom: 0,
		marginTop: 0,
		marginBottom: 0,
		textAlign: 'left',
		lineHeight: 1.15,
	},
	fonts: [],
	blocks: [
		{
			id: 'header-1',
			type: 'header',
			region: 'main',
			order: 0,
			content: {
				name: 'Brayan Londono',
				contact: [{ type: 'email', value: 'brayan@example.com' }],
			},
			tokens: { fontFamily: 'Garamond', textAlign: 'center' },
			decorations: [],
		},
		{
			id: 'experience-1',
			type: 'experience',
			region: 'main',
			order: 1,
			sectionHeader: 'Experience',
			content: {
				entries: [
					{
						company: 'Acme Corp',
						title: 'Senior Engineer',
						dateStart: '2020',
						dateEnd: 'Present',
						bullets: [[{ text: 'Built systems' }]],
					},
				],
			},
			tokens: {},
			decorations: [
				{
					type: 'horizontal-rule' as const,
					position: 'below' as const,
					renderAs: 'css' as const,
					css: { borderBottom: '1px solid #000000' },
					relativeTo: 'block' as const,
				},
			],
		},
	],
	pageSettings: { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } },
}

const FAKE_DOCUMENT_XML = `<w:document><w:body>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="40"/><w:rFonts w:ascii="Garamond"/></w:rPr><w:t>Brayan Londono</w:t></w:r></w:p>
<w:p><w:r><w:t>brayan@example.com</w:t></w:r></w:p>
<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="000000"/></w:pBdr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Experience</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Senior Engineer</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Built systems</w:t></w:r></w:p>
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
</w:body></w:document>`
const FAKE_FONT_TABLE_XML = `<w:fonts><w:font w:name="Garamond"/></w:fonts>`
const FAKE_STYLES_XML = `<w:styles></w:styles>`

const MOCK_PAGE_SETTINGS = { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } }
const MOCK_DOCX_RESULT = {
	globalTokens: {
		fontFamily: 'EB Garamond', fontSize: 11, fontWeight: 400,
		color: '#333333', paddingTop: 0, paddingBottom: 0,
		marginTop: 0, marginBottom: 0, textAlign: 'left' as const, lineHeight: 1.15,
	},
	fonts: [{ originalFont: 'Garamond', matchedFont: 'EB Garamond', source: 'google' as const, url: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;700&display=swap', confidence: 0.95 }],
	paragraphs: [
		{ text: 'Brayan Londono', tokens: { fontWeight: 700, fontSize: 20 } },
		{ text: 'brayan@example.com', tokens: {} },
	],
	pageSettings: MOCK_PAGE_SETTINGS,
}

const FALLBACK_TREE: BlockTree = {
	layout: 'single-column',
	globalTokens: MOCK_DOCX_RESULT.globalTokens,
	fonts: MOCK_DOCX_RESULT.fonts,
	blocks: [{
		id: 'header-fallback', type: 'header', region: 'main', order: 0,
		content: { name: 'Fallback Name', contact: [] },
		tokens: {}, decorations: [],
	}],
	pageSettings: MOCK_PAGE_SETTINGS,
}

// --- Mocks ---

let mockAIJsonResponse = JSON.stringify(VALID_AI_RESPONSE)
let mockAIShouldThrow = false

// JSZip — returns fake XML for raw extraction
vi.mock('jszip', () => ({
	default: {
		loadAsync: () => Promise.resolve({
			file: (p: string) => ({
				async: () => {
					const map: Record<string, string> = {
						'word/document.xml': FAKE_DOCUMENT_XML,
						'word/styles.xml': FAKE_STYLES_XML,
						'word/numbering.xml': '',
						'word/fontTable.xml': FAKE_FONT_TABLE_XML,
						'word/theme/theme1.xml': '',
					}
					return Promise.resolve(map[p] ?? '')
				},
			}),
		}),
	},
}))

// extractDocxDesignTokens — returns deterministic page settings and fonts
vi.mock('./extract-docx.server', () => ({
	extractDocxDesignTokens: () => Promise.resolve(MOCK_DOCX_RESULT),
}))

// Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
	default: vi.fn().mockImplementation(() => ({
		messages: {
			create: () => {
				if (mockAIShouldThrow) return Promise.reject(new Error('API rate limit'))
				return Promise.resolve({
					content: [{ type: 'text', text: mockAIJsonResponse }],
				})
			},
		},
	})),
}))

// OpenAI SDK
vi.mock('openai', () => ({
	OpenAI: vi.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: () => {
					if (mockAIShouldThrow) return Promise.reject(new Error('API rate limit'))
					return Promise.resolve({
						choices: [{ message: { content: mockAIJsonResponse } }],
					})
				},
			},
		},
	})),
}))

// Fallback pipeline
vi.mock('./classify-content.server', () => ({
	classifyParagraphs: () => Promise.resolve([
		{ type: 'header', sectionHeader: null, paragraphs: [{ text: 'Fallback Name', tokens: {} }] },
	]),
}))
vi.mock('./assemble-block-tree.server', () => ({
	assembleBlockTree: () => FALLBACK_TREE,
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { extractBlockTreeWithAI } from './extract-with-ai.server'

describe('extractBlockTreeWithAI', () => {
	beforeEach(() => {
		mockAIJsonResponse = JSON.stringify(VALID_AI_RESPONSE)
		mockAIShouldThrow = false
		process.env.AI_EXTRACTION_PROVIDER = 'anthropic'
		process.env.ANTHROPIC_API_KEY = 'test-key'
		process.env.OPENAI_API_KEY = 'test-key'
	})

	it('full pipeline: preprocess → AI → validate → merge', async () => {
		const result = await extractBlockTreeWithAI(Buffer.from('fake'))

		// pageSettings from XML parser, not AI's zeros
		expect(result.pageSettings).toEqual(MOCK_PAGE_SETTINGS)

		// fonts populated by matchFont()
		expect(result.fonts.length).toBeGreaterThan(0)
		expect(result.fonts.some(f => f.originalFont === 'Garamond')).toBe(true)
		expect(result.fonts[0].url).toBeTruthy()

		// AI content preserved
		expect(result.blocks[0].type).toBe('header')
		const header = result.blocks[0].content as { name: string }
		expect(header.name).toBe('Brayan Londono')
		expect(result.layout).toBe('single-column')
	})

	it('handles AI response wrapped in markdown fences', async () => {
		mockAIJsonResponse = '```json\n' + JSON.stringify(VALID_AI_RESPONSE) + '\n```'
		const result = await extractBlockTreeWithAI(Buffer.from('fake'))
		expect(result.blocks.length).toBe(2)
		expect((result.blocks[0].content as { name: string }).name).toBe('Brayan Londono')
	})

	it('falls back on invalid JSON from AI', async () => {
		mockAIJsonResponse = 'not valid json {{{'
		const result = await extractBlockTreeWithAI(Buffer.from('fake'))
		// Should use fallback tree
		expect((result.blocks[0].content as { name: string }).name).toBe('Fallback Name')
	})

	it('falls back on Zod validation failure', async () => {
		mockAIJsonResponse = JSON.stringify({ layout: 'single-column', blocks: [{ id: 'x' }] })
		const result = await extractBlockTreeWithAI(Buffer.from('fake'))
		expect((result.blocks[0].content as { name: string }).name).toBe('Fallback Name')
	})

	it('switches provider based on env var', async () => {
		process.env.AI_EXTRACTION_PROVIDER = 'openai'
		const result = await extractBlockTreeWithAI(Buffer.from('fake'))
		expect(result.blocks.length).toBe(2)
		expect((result.blocks[0].content as { name: string }).name).toBe('Brayan Londono')
	})

	it('falls back when AI call throws', async () => {
		mockAIShouldThrow = true
		const result = await extractBlockTreeWithAI(Buffer.from('fake'))
		expect((result.blocks[0].content as { name: string }).name).toBe('Fallback Name')
	})
})
