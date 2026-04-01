import { describe, it, expect } from 'vitest'
import { injectContent } from './inject-content'
import type { BlockTree, HeaderContent, ExperienceContent } from './types'

const SAMPLE_TEMPLATE = `<!DOCTYPE html>
<html><body>
<h1 data-block-id="header-0" data-field="name">Old Name</h1>
<p data-block-id="header-0" data-field="role">Old Role</p>
<span data-block-id="header-0" data-field="contact.0.value">old@email.com</span>
<p data-block-id="summary-1" data-field="text">Old summary text.</p>
<strong data-block-id="experience-2" data-field="entries.0.company">Old Company</strong>
<span data-block-id="experience-2" data-field="entries.0.title">Old Title</span>
<li data-block-id="experience-2" data-field="entries.0.bullets.0">Old bullet 1</li>
<li data-block-id="experience-2" data-field="entries.0.bullets.1">Old bullet 2</li>
</body></html>`

const SAMPLE_BLOCK_TREE: BlockTree = {
	layout: 'single-column',
	globalTokens: {
		fontFamily: 'Inter', fontSize: 11, fontWeight: 400, color: '#333',
		paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, textAlign: 'left',
	},
	fonts: [],
	blocks: [
		{
			id: 'header-0', type: 'header', region: 'main', order: 0,
			content: {
				name: 'New Name',
				role: 'New Role',
				contact: [{ type: 'email', value: 'new@email.com' }],
			} as HeaderContent,
			tokens: {}, decorations: [],
		},
		{
			id: 'summary-1', type: 'summary', region: 'main', order: 1,
			content: { text: 'New summary text.' },
			tokens: {}, decorations: [],
		},
		{
			id: 'experience-2', type: 'experience', region: 'main', order: 2,
			content: {
				entries: [{
					company: 'New Company',
					title: 'New Title',
					dateStart: '2024',
					bullets: [
						[{ text: 'New bullet 1' }],
						[{ text: 'New bullet 2' }],
					],
				}],
			} as ExperienceContent,
			tokens: {}, decorations: [],
		},
	],
	pageSettings: { width: 816, height: 1056, margins: { top: 48, right: 48, bottom: 48, left: 48 } },
}

describe('injectContent', () => {
	it('replaces header name', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('data-field="name">New Name<')
		expect(result).not.toContain('Old Name')
	})

	it('replaces header role', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('data-field="role">New Role<')
	})

	it('replaces contact values', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('data-field="contact.0.value">new@email.com<')
	})

	it('replaces summary text', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('data-field="text">New summary text.<')
	})

	it('replaces experience company and title', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('data-field="entries.0.company">New Company<')
		expect(result).toContain('data-field="entries.0.title">New Title<')
	})

	it('replaces experience bullets', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('data-field="entries.0.bullets.0">New bullet 1<')
		expect(result).toContain('data-field="entries.0.bullets.1">New bullet 2<')
	})

	it('preserves HTML structure and attributes', () => {
		const result = injectContent(SAMPLE_TEMPLATE, SAMPLE_BLOCK_TREE)
		expect(result).toContain('<!DOCTYPE html>')
		expect(result).toContain('data-block-id="header-0"')
		expect(result).toContain('data-block-id="experience-2"')
	})
})
