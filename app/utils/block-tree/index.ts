export { blockTreeSchema } from './schemas'
export type {
	BlockTree,
	Block,
	BlockContent,
	BlockType,
	MacroLayout,
	Region,
	DesignTokens,
	FontMapping,
	HeaderContent,
	ExperienceContent,
	EducationContent,
	SkillsContent,
	GenericContent,
	Decoration,
	LayoutConfig,
	RegionStyles,
	InlineSegment,
} from './types'
export { matchFont } from './font-matching'
export { renderBlockTreeToHtml } from './render-html'
export { extractDocxDesignTokens } from './extract-docx.server'
export { classifyParagraphs } from './classify-content.server'
export { assembleBlockTree } from './assemble-block-tree.server'
export { serializeBlockTree, deserializeBlockTree } from './persistence.server'
export { extractBlockTreeWithAI, extractBlockTreeFromPdf } from './extract-with-ai.server'
export { preprocessXml } from './preprocess-xml.server'
export { validateBlockTree, validateBlockTreeForPdf } from './validate-block-tree.server'
export { mergeBlockTree } from './merge-block-tree.server'
export { generateResumeTemplate } from './generate-template.server'
export { injectContent } from './inject-content'
export {
	extractPdfData,
	PdfExtractionError,
	type PdfExtractionResult,
	type PdfLine,
	type PdfPage,
	type PdfRectangle,
} from './extract-pdf.server'
