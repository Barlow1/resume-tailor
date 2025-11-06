declare module 'pdf-parse-fork' {
	interface PDFData {
		text: string
		numpages: number
		numrender: number
		info: any
		metadata: any
		version: string
	}

	function pdf(dataBuffer: Buffer): Promise<PDFData>

	export = pdf
}
