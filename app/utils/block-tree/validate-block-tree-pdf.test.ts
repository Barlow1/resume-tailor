import { describe, it, expect } from 'vitest'
import { validateBlockTreeForPdf } from './validate-block-tree.server'
import type { BlockTree } from './types'

// --- Test Data Helpers ---

function makePdfData(overrides?: Record<string, unknown>) {
	return {
		pages: [
			{
				lines: [
					{ text: 'John Doe', x: 72, y: 36, fontFamily: 'Crimson Pro', fontSize: 24, fontWeight: 700, color: '#000000' },
					{ text: 'Software Engineer', x: 72, y: 65, fontFamily: 'Inter', fontSize: 12, fontWeight: 400, color: '#333333' },
					{ text: 'EXPERIENCE', x: 72, y: 100, fontFamily: 'Inter', fontSize: 14, fontWeight: 700, color: '#0E539E' },
					{ text: 'Acme Corp', x: 72, y: 125, fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: '#333333' },
					{ text: 'Built scalable APIs serving 1M requests/day', x: 72, y: 145, fontFamily: 'Inter', fontSize: 11, fontWeight: 400, color: '#333333' },
				],
				fonts: [
					{ family: 'Crimson Pro', weight: 700, style: 'normal' },
					{ family: 'Inter', weight: 400, style: 'normal' },
					{ family: 'Inter', weight: 700, style: 'normal' },
				],
			},
		],
		...overrides,
	}
}

function makeBlockTree(overrides?: Partial<BlockTree>): BlockTree {
	return {
		layout: 'single-column',
		globalTokens: {
			fontFamily: 'Inter',
			fontSize: 11,
			fontWeight: 400,
			color: '#333333',
			paddingTop: 0,
			paddingBottom: 0,
			marginTop: 0,
			marginBottom: 0,
			textAlign: 'left',
		},
		fonts: [],
		pageSettings: {
			width: 816,
			height: 1056,
			margins: { top: 48, right: 48, bottom: 48, left: 48 },
		},
		blocks: [
			{
				id: 'header-1',
				type: 'header',
				region: 'main',
				order: 0,
				tokens: { fontFamily: 'Crimson Pro', fontSize: 24 },
				decorations: [],
				content: {
					name: 'John Doe',
					role: 'Software Engineer',
					contact: [],
					headerTokens: {
						name: { fontSize: 24, fontFamily: 'Crimson Pro' },
					},
				},
			},
			{
				id: 'exp-1',
				type: 'experience',
				region: 'main',
				order: 1,
				sectionHeader: 'EXPERIENCE',
				tokens: {},
				decorations: [],
				content: {
					entries: [
						{
							company: 'Acme Corp',
							title: 'Senior Engineer',
							dateStart: '2020',
							dateEnd: '2024',
							bullets: [
								[{ text: 'Built scalable APIs serving 1M requests/day' }],
							],
						},
					],
				},
			},
		],
		...overrides,
	}
}

// --- Tests ---

describe('validateBlockTreeForPdf', () => {
	it('returns high confidence when all data matches', () => {
		const blockTree = makeBlockTree()
		const pdfData = makePdfData()

		const result = validateBlockTreeForPdf(blockTree, pdfData)

		// All weighted checks pass or are near-pass; overall confidence should be high
		expect(result.confidence).toBeGreaterThanOrEqual(0.7)
	})

	it('catches wrong name — name does not appear in page text', () => {
		const blockTree = makeBlockTree({
			blocks: [
				{
					id: 'header-1',
					type: 'header',
					region: 'main',
					order: 0,
					tokens: {},
					decorations: [],
					content: {
						name: 'Completely Wrong Name XYZ',
						contact: [],
					},
				},
			],
		})
		const pdfData = makePdfData()

		const result = validateBlockTreeForPdf(blockTree, pdfData)

		// Name check has 0.2 weight; wrong name reduces confidence from 1.0
		expect(result.confidence).toBeLessThan(1.0)
		expect(result.issues.some(i => i.includes('Completely Wrong Name XYZ'))).toBe(true)
	})

	it('catches hallucinated font families not in PDF data', () => {
		const blockTree = makeBlockTree({
			globalTokens: {
				fontFamily: 'FakeFont That Does Not Exist',
				fontSize: 11,
				fontWeight: 400,
				color: '#333333',
				paddingTop: 0,
				paddingBottom: 0,
				marginTop: 0,
				marginBottom: 0,
				textAlign: 'left',
			},
			blocks: [
				{
					id: 'header-1',
					type: 'header',
					region: 'main',
					order: 0,
					tokens: { fontFamily: 'AnotherFakeFont' },
					decorations: [],
					content: {
						name: 'John Doe',
						contact: [],
					},
				},
			],
		})
		const pdfData = makePdfData()

		const result = validateBlockTreeForPdf(blockTree, pdfData)

		expect(result.issues.some(i => i.toLowerCase().includes('font'))).toBe(true)
		// Confidence should be penalized (0.2 weight for fonts)
		expect(result.confidence).toBeLessThan(0.9)
	})

	it('catches hallucinated bullet text not in page lines', () => {
		const blockTree = makeBlockTree({
			blocks: [
				{
					id: 'header-1',
					type: 'header',
					region: 'main',
					order: 0,
					tokens: {},
					decorations: [],
					content: { name: 'John Doe', contact: [] },
				},
				{
					id: 'exp-1',
					type: 'experience',
					region: 'main',
					order: 1,
					sectionHeader: 'EXPERIENCE',
					tokens: {},
					decorations: [],
					content: {
						entries: [
							{
								company: 'Acme Corp',
								title: 'Senior Engineer',
								dateStart: '2020',
								dateEnd: '2024',
								bullets: [
									[{ text: 'This bullet text was completely made up by the AI and is not in the PDF document at all' }],
								],
							},
						],
					},
				},
			],
		})
		const pdfData = makePdfData()

		const result = validateBlockTreeForPdf(blockTree, pdfData)

		expect(result.issues.some(i => i.toLowerCase().includes('hallucinated'))).toBe(true)
		// Confidence should be penalized (0.1 weight for phantom content)
		expect(result.confidence).toBeLessThan(1.0)
	})

	it('detects wrong font size on name element', () => {
		const blockTree = makeBlockTree({
			blocks: [
				{
					id: 'header-1',
					type: 'header',
					region: 'main',
					order: 0,
					tokens: {},
					decorations: [],
					content: {
						name: 'John Doe',
						contact: [],
						headerTokens: {
							name: { fontSize: 8 }, // Wrong — PDF has 24pt
						},
					},
				},
			],
		})
		const pdfData = makePdfData()

		const result = validateBlockTreeForPdf(blockTree, pdfData)

		expect(result.issues.some(i => i.includes('font size') || i.includes('fontSize'))).toBe(true)
		// Confidence should be penalized (0.15 weight for font size check)
		expect(result.confidence).toBeLessThan(0.9)
	})
})
