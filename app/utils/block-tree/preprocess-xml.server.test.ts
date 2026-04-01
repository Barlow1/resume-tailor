import { describe, it, expect } from 'vitest'
import { preprocessXml } from './preprocess-xml.server'
import type { RawDocxXml } from './preprocess-xml.server'
import JSZip from 'jszip'
import * as fs from 'fs'
import * as path from 'path'

function makeRaw(overrides: Partial<RawDocxXml> = {}): RawDocxXml {
	return {
		documentXml: overrides.documentXml ?? '<w:document><w:body></w:body></w:document>',
		stylesXml: overrides.stylesXml ?? '<w:styles></w:styles>',
		numberingXml: overrides.numberingXml ?? '<w:numbering/>',
		fontTableXml: overrides.fontTableXml ?? '<w:fonts/>',
		themeXml: overrides.themeXml ?? '<a:theme/>',
	}
}

describe('preprocessXml', () => {
	it('strips rsid attributes', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p w:rsidR="00A123" w:rsidRDefault="00B456" w:rsidRPr="00C789" w14:paraId="12345678" w14:textId="9ABCDEF0">
      <w:r><w:t>Hello</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`

		const result = preprocessXml(makeRaw({ documentXml }))

		expect(result.cleanedDocumentXml).not.toContain('w:rsidR=')
		expect(result.cleanedDocumentXml).not.toContain('w:rsidRDefault=')
		expect(result.cleanedDocumentXml).not.toContain('w:rsidRPr=')
		expect(result.cleanedDocumentXml).not.toContain('w14:paraId=')
		expect(result.cleanedDocumentXml).not.toContain('w14:textId=')
		expect(result.cleanedDocumentXml).toContain('<w:t>Hello</w:t>')
	})

	it('strips proofErr elements', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p>
      <w:proofErr w:type="spellStart"/>
      <w:r><w:t>teh</w:t></w:r>
      <w:proofErr w:type="spellEnd"/>
    </w:p>
  </w:body>
</w:document>`

		const result = preprocessXml(makeRaw({ documentXml }))

		expect(result.cleanedDocumentXml).not.toContain('w:proofErr')
		expect(result.cleanedDocumentXml).toContain('<w:t>teh</w:t>')
	})

	it('strips bookmarkStart/End elements', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p>
      <w:bookmarkStart w:id="0" w:name="_GoBack"/>
      <w:r><w:t>Text</w:t></w:r>
      <w:bookmarkEnd w:id="0"/>
    </w:p>
  </w:body>
</w:document>`

		const result = preprocessXml(makeRaw({ documentXml }))

		expect(result.cleanedDocumentXml).not.toContain('w:bookmarkStart')
		expect(result.cleanedDocumentXml).not.toContain('w:bookmarkEnd')
		expect(result.cleanedDocumentXml).toContain('<w:t>Text</w:t>')
	})

	it('strips lastRenderedPageBreak', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p>
      <w:r>
        <w:lastRenderedPageBreak/>
        <w:t>Page two</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`

		const result = preprocessXml(makeRaw({ documentXml }))

		expect(result.cleanedDocumentXml).not.toContain('w:lastRenderedPageBreak')
		expect(result.cleanedDocumentXml).toContain('<w:t>Page two</w:t>')
	})

	it('removes empty rPr elements', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p>
      <w:r>
        <w:rPr></w:rPr>
        <w:t>A</w:t>
      </w:r>
      <w:r>
        <w:rPr/>
        <w:t>B</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`

		const result = preprocessXml(makeRaw({ documentXml }))

		expect(result.cleanedDocumentXml).not.toMatch(/<w:rPr\s*\/>/)
		expect(result.cleanedDocumentXml).not.toMatch(/<w:rPr>\s*<\/w:rPr>/)
		expect(result.cleanedDocumentXml).toContain('<w:t>A</w:t>')
		expect(result.cleanedDocumentXml).toContain('<w:t>B</w:t>')
	})

	it('removes latentStyles from styles.xml', () => {
		const stylesXml = `
<w:styles>
  <w:latentStyles w:defLockedState="0" w:defUIPriority="99">
    <w:lsdException w:name="Normal" w:uiPriority="0" w:qFormat="1"/>
    <w:lsdException w:name="heading 1" w:uiPriority="9" w:qFormat="1"/>
  </w:latentStyles>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`

		const result = preprocessXml(makeRaw({ stylesXml }))

		expect(result.cleanedStylesXml).not.toContain('w:latentStyles')
		expect(result.cleanedStylesXml).not.toContain('w:lsdException')
		expect(result.cleanedStylesXml).toContain('w:styleId="Normal"')
	})

	it('removes unreferenced styles but keeps referenced and default ones', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Title</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`

		const stylesXml = `
<w:styles>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
  </w:style>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`

		const result = preprocessXml(makeRaw({ documentXml, stylesXml }))

		expect(result.cleanedStylesXml).toContain('w:styleId="Heading1"')
		expect(result.cleanedStylesXml).not.toContain('w:styleId="Heading2"')
		expect(result.cleanedStylesXml).toContain('w:styleId="Normal"')
	})

	it('preserves design-relevant content', () => {
		const documentXml = `
<w:document>
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
        <w:t>Hello World</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`

		const result = preprocessXml(makeRaw({ documentXml }))

		expect(result.cleanedDocumentXml).toContain('<w:t>Hello World</w:t>')
		expect(result.cleanedDocumentXml).toContain('<w:b/>')
		expect(result.cleanedDocumentXml).toContain('w:val="24"')
		expect(result.cleanedDocumentXml).toContain('w:val="center"')
	})

	it('achieves at least 50% token reduction on real DOCX', async () => {
		const fixturePath = path.resolve(
			__dirname,
			'../../../tests/fixtures/docx/Final_Brayan Londono.docx',
		)
		const docxBuffer = fs.readFileSync(fixturePath)
		const zip = await JSZip.loadAsync(docxBuffer)

		const documentXml =
			(await zip.file('word/document.xml')?.async('string')) ?? ''
		const stylesXml =
			(await zip.file('word/styles.xml')?.async('string')) ?? ''
		const numberingXml =
			(await zip.file('word/numbering.xml')?.async('string')) ?? ''
		const fontTableXml =
			(await zip.file('word/fontTable.xml')?.async('string')) ?? ''
		const themeXml =
			(await zip.file('word/theme/theme1.xml')?.async('string')) ?? ''

		const raw: RawDocxXml = {
			documentXml,
			stylesXml,
			numberingXml,
			fontTableXml,
			themeXml,
		}

		const result = preprocessXml(raw)

		const inputSize = documentXml.length + stylesXml.length
		const outputSize =
			result.cleanedDocumentXml.length + result.cleanedStylesXml.length

		expect(outputSize).toBeLessThan(inputSize * 0.5)
	})

	it('passes through numberingXml, fontTableXml, and themeXml unchanged', () => {
		const raw = makeRaw({
			numberingXml: '<w:numbering><w:abstractNum w:abstractNumId="0"/></w:numbering>',
			fontTableXml: '<w:fonts><w:font w:name="Arial"/></w:fonts>',
			themeXml: '<a:theme name="Office"><a:themeElements/></a:theme>',
		})

		const result = preprocessXml(raw)

		expect(result.numberingXml).toBe(raw.numberingXml)
		expect(result.fontTableXml).toBe(raw.fontTableXml)
		expect(result.themeXml).toBe(raw.themeXml)
	})
})
