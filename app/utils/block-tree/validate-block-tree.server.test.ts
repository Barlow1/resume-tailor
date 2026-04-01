import { describe, it, expect } from 'vitest'
import { validateBlockTree } from './validate-block-tree.server'
import type { BlockTree, DesignTokens, InlineSegment } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeFontTableXml(fonts: string[]): string {
	return (
		'<w:fonts>' +
		fonts.map(f => `<w:font w:name="${f}"/>`).join('') +
		'</w:fonts>'
	)
}

function fakeDocumentXml(opts: {
	name: string
	fonts: string[]
	boldBulletPairs: number
	bulletTexts: string[]
	firstFontSizeHalfPt: number
	sectionBorders: number
}): string {
	const paragraphs: string[] = []

	// Name paragraph with font size
	paragraphs.push(
		`<w:p>` +
			`<w:pPr><w:rPr><w:sz w:val="${opts.firstFontSizeHalfPt}"/></w:rPr></w:pPr>` +
			`<w:r><w:rPr><w:b/><w:sz w:val="${opts.firstFontSizeHalfPt}"/></w:rPr>` +
			`<w:t>${opts.name}</w:t></w:r>` +
		`</w:p>`,
	)

	// Bold + bullet pairs (experience pattern)
	for (let i = 0; i < opts.boldBulletPairs; i++) {
		const bulletText = opts.bulletTexts[i] ?? `Bullet text for entry ${i}`
		// Bold title paragraph
		paragraphs.push(
			`<w:p>` +
				`<w:r><w:rPr><w:b/></w:rPr><w:t>Company ${i} — Engineer</w:t></w:r>` +
			`</w:p>`,
		)
		// Bulleted paragraph
		paragraphs.push(
			`<w:p>` +
				`<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>` +
				`<w:r><w:t>${bulletText}</w:t></w:r>` +
			`</w:p>`,
		)
	}

	// Section borders
	for (let i = 0; i < opts.sectionBorders; i++) {
		paragraphs.push(
			`<w:p>` +
				`<w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4"/></w:pBdr></w:pPr>` +
				`<w:r><w:t>Section ${i}</w:t></w:r>` +
			`</w:p>`,
		)
	}

	return '<w:document><w:body>' + paragraphs.join('\n') + '</w:body></w:document>'
}

function seg(text: string, bold?: boolean): InlineSegment {
	return { text, ...(bold ? { bold: true } : {}) }
}

const defaultTokens: DesignTokens = {
	fontFamily: 'Garamond',
	fontSize: 10,
	fontWeight: 400,
	color: '#000000',
	paddingTop: 0,
	paddingBottom: 0,
	marginTop: 0,
	marginBottom: 0,
	textAlign: 'left' as const,
}

function buildBlockTree(overrides?: {
	name?: string
	fontFamily?: string
	entries?: { company: string; bullets: InlineSegment[][] }[]
	headerFontSize?: number
	sectionHeaders?: string[]
}): BlockTree {
	const name = overrides?.name ?? 'John Doe'
	const fontFamily = overrides?.fontFamily ?? 'Garamond'
	const entries = overrides?.entries ?? [
		{
			company: 'Acme Corp',
			bullets: [[seg('Led migration of legacy systems to cloud infrastructure')]],
		},
		{
			company: 'Widgets Inc',
			bullets: [[seg('Increased revenue by 42% through optimization')]],
		},
	]
	const sectionHeaders = overrides?.sectionHeaders ?? ['Experience', 'Education']
	const headerFontSize = overrides?.headerFontSize ?? 18

	const blocks: BlockTree['blocks'] = [
		{
			id: 'header-1',
			type: 'header',
			region: 'main',
			order: 0,
			content: {
				name,
				role: 'Software Engineer',
				contact: [{ type: 'email', value: 'john@example.com' }],
				headerTokens: {
					name: { fontSize: headerFontSize },
				},
			},
			tokens: { fontFamily },
			decorations: [],
		},
		{
			id: 'experience-1',
			type: 'experience',
			region: 'main',
			order: 1,
			sectionHeader: sectionHeaders[0],
			content: {
				entries: entries.map((e, i) => ({
					company: e.company,
					title: 'Engineer',
					dateStart: '2020',
					dateEnd: '2024',
					bullets: e.bullets,
				})),
			},
			tokens: { fontFamily },
			decorations: sectionHeaders[0]
				? [{ type: 'horizontal-rule' as const, position: 'above' as const, renderAs: 'css' as const, relativeTo: 'block' as const }]
				: [],
		},
		{
			id: 'education-1',
			type: 'education',
			region: 'main',
			order: 2,
			sectionHeader: sectionHeaders[1],
			content: {
				entries: [{ school: 'MIT', degree: 'BS', major: 'CS', dates: '2016-2020' }],
			},
			tokens: { fontFamily },
			decorations: sectionHeaders[1]
				? [{ type: 'horizontal-rule' as const, position: 'above' as const, renderAs: 'css' as const, relativeTo: 'block' as const }]
				: [],
		},
	]

	return {
		layout: 'single-column',
		globalTokens: { ...defaultTokens, fontFamily },
		fonts: [
			{ originalFont: fontFamily, matchedFont: fontFamily, source: 'google', confidence: 1 },
		],
		blocks,
		pageSettings: {
			width: 816,
			height: 1056,
			margins: { top: 48, right: 48, bottom: 48, left: 48 },
		},
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateBlockTree', () => {
	it('correct BlockTree → confidence > 0.9', () => {
		const tree = buildBlockTree()
		const docXml = fakeDocumentXml({
			name: 'John Doe',
			fonts: ['Garamond'],
			boldBulletPairs: 2,
			bulletTexts: [
				'Led migration of legacy systems to cloud infrastructure',
				'Increased revenue by 42% through optimization',
			],
			firstFontSizeHalfPt: 36, // 36 half-pt = 18pt
			sectionBorders: 2,
		})
		const fontXml = fakeFontTableXml(['Garamond', 'Cardo'])

		const result = validateBlockTree(tree, docXml, fontXml)

		expect(result.confidence).toBeGreaterThan(0.9)
		expect(result.issues).toHaveLength(0)
	})

	it('wrong name → confidence drops', () => {
		const tree = buildBlockTree({ name: 'Jane Smith' })
		const docXml = fakeDocumentXml({
			name: 'John Doe',
			fonts: ['Garamond'],
			boldBulletPairs: 2,
			bulletTexts: [
				'Led migration of legacy systems to cloud infrastructure',
				'Increased revenue by 42% through optimization',
			],
			firstFontSizeHalfPt: 36,
			sectionBorders: 2,
		})
		const fontXml = fakeFontTableXml(['Garamond', 'Cardo'])

		const result = validateBlockTree(tree, docXml, fontXml)

		// Name check has weight 0.2, should lose most of that
		expect(result.confidence).toBeLessThanOrEqual(0.9)
		expect(result.issues.some(i => i.includes('Jane Smith'))).toBe(true)
	})

	it('hallucinated font → confidence drops', () => {
		const tree = buildBlockTree({ fontFamily: 'Foobar Sans' })
		const docXml = fakeDocumentXml({
			name: 'John Doe',
			fonts: ['Garamond'],
			boldBulletPairs: 2,
			bulletTexts: [
				'Led migration of legacy systems to cloud infrastructure',
				'Increased revenue by 42% through optimization',
			],
			firstFontSizeHalfPt: 36,
			sectionBorders: 2,
		})
		const fontXml = fakeFontTableXml(['Garamond', 'Cardo'])

		const result = validateBlockTree(tree, docXml, fontXml)

		// Font check has weight 0.2, should lose that
		expect(result.confidence).toBeLessThanOrEqual(0.9)
		expect(result.issues.some(i => i.includes('Foobar Sans'))).toBe(true)
	})

	it('wrong experience count → confidence drops', () => {
		// BlockTree claims 5 experience entries, XML only has patterns for 2
		const tree = buildBlockTree({
			entries: Array.from({ length: 5 }, (_, i) => ({
				company: `Company ${i}`,
				bullets: [[seg(`Did something important at company ${i} that was significant`)]],
			})),
		})
		const docXml = fakeDocumentXml({
			name: 'John Doe',
			fonts: ['Garamond'],
			boldBulletPairs: 2,
			bulletTexts: [
				'Did something important at company 0 that was significant',
				'Did something important at company 1 that was significant',
			],
			firstFontSizeHalfPt: 36,
			sectionBorders: 2,
		})
		const fontXml = fakeFontTableXml(['Garamond', 'Cardo'])

		const result = validateBlockTree(tree, docXml, fontXml)

		// Experience check has weight 0.2, should lose it with diff of 3
		expect(result.confidence).toBeLessThanOrEqual(0.9)
		expect(result.issues.some(i => i.includes('Experience entries'))).toBe(true)
	})

	it('all wrong → confidence < 0.7', () => {
		const tree = buildBlockTree({
			name: 'Jane Smith',
			fontFamily: 'Foobar Sans',
			headerFontSize: 48,
			entries: Array.from({ length: 5 }, (_, i) => ({
				company: `Phantom Corp ${i}`,
				bullets: [[seg(`Hallucinated accomplishment number ${i} that never happened`)]],
			})),
		})
		const docXml = fakeDocumentXml({
			name: 'John Doe',
			fonts: ['Garamond'],
			boldBulletPairs: 1,
			bulletTexts: ['Real accomplishment that actually exists in the document'],
			firstFontSizeHalfPt: 36, // 18pt, tree claims 48pt
			sectionBorders: 0,
		})
		const fontXml = fakeFontTableXml(['Garamond', 'Cardo'])

		const result = validateBlockTree(tree, docXml, fontXml)

		expect(result.confidence).toBeLessThan(0.7)
		expect(result.issues.length).toBeGreaterThanOrEqual(3)
	})

	it('returns issues array with descriptive strings for each failing check', () => {
		const tree = buildBlockTree({
			name: 'Nobody Real',
			fontFamily: 'Comic Sans MS',
			headerFontSize: 72,
		})
		const docXml = fakeDocumentXml({
			name: 'John Doe',
			fonts: ['Garamond'],
			boldBulletPairs: 2,
			bulletTexts: [
				'Led migration of legacy systems to cloud infrastructure',
				'Increased revenue by 42% through optimization',
			],
			firstFontSizeHalfPt: 36,
			sectionBorders: 2,
		})
		const fontXml = fakeFontTableXml(['Garamond', 'Cardo'])

		const result = validateBlockTree(tree, docXml, fontXml)

		expect(result.issues.length).toBeGreaterThan(0)
		// Each issue should be a descriptive string
		for (const issue of result.issues) {
			expect(typeof issue).toBe('string')
			expect(issue.length).toBeGreaterThan(10)
		}
		// Should mention the wrong name
		expect(result.issues.some(i => i.includes('Nobody Real'))).toBe(true)
		// Should mention the wrong font
		expect(result.issues.some(i => i.includes('Comic Sans'))).toBe(true)
		// Should mention font size mismatch
		expect(result.issues.some(i => i.includes('font size'))).toBe(true)
	})
})
