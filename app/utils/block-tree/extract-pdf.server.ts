import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export interface PdfLine {
	text: string
	x: number
	y: number
	width: number
	height: number
	fontFamily: string
	fontSize: number
	fontWeight: number
	fontStyle: 'normal' | 'italic'
	color: string
	column: 'left' | 'right' | 'full'
}

export interface PdfPageImage {
	pageNumber: number
	base64: string
	width: number
	height: number
}

export interface PdfRectangle {
	x: number
	y: number
	width: number
	height: number
	color: string
	classification: 'divider' | 'sidebar-bg' | 'accent-bar' | 'vertical-line' | 'background'
}

export interface PdfPage {
	pageNumber: number
	width: number
	height: number
	lines: PdfLine[]
	rectangles: PdfRectangle[]
	fonts: { family: string; weight: number; style: string }[]
}

export interface PdfExtractionResult {
	pages: PdfPage[]
	pageImages?: PdfPageImage[]
	pageSettings: {
		width: number
		height: number
		margins: { top: number; right: number; bottom: number; left: number }
	}
	detectedColumns: {
		count: number
		splitX: number | null
		leftWidth: number | null
		rightWidth: number | null
	}
}

export class PdfExtractionError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PdfExtractionError'
	}
}

export function getPythonCommand(): string {
	return process.platform === 'win32' ? 'python' : 'python3'
}

/**
 * Render PDF pages as PNG images using pymupdf. Always produces images
 * regardless of whether the PDF has extractable text. Used for visual
 * template generation where the AI needs to SEE the design.
 */
export async function renderPdfPages(pdfPathOrBuffer: string | Buffer): Promise<PdfPageImage[]> {
	let tmpFile: string | null = null
	let pdfPath: string

	if (Buffer.isBuffer(pdfPathOrBuffer)) {
		tmpFile = path.join(os.tmpdir(), `resume-render-${Date.now()}.pdf`)
		fs.writeFileSync(tmpFile, pdfPathOrBuffer)
		pdfPath = tmpFile
	} else {
		pdfPath = pdfPathOrBuffer
	}

	try {
		return await new Promise<PdfPageImage[]>((resolve, reject) => {
			const pythonCmd = getPythonCommand()
			const script = `
import fitz, json, base64, sys
doc = fitz.open(sys.argv[1])
images = []
for i, page in enumerate(doc):
    mat = fitz.Matrix(200/72, 200/72)
    pix = page.get_pixmap(matrix=mat)
    b64 = base64.b64encode(pix.tobytes("png")).decode("ascii")
    images.append({"pageNumber": i+1, "base64": b64, "width": pix.width, "height": pix.height})
doc.close()
print(json.dumps(images))
`
			const child = spawn(pythonCmd, ['-c', script, pdfPath])
			let stdout = ''
			let stderr = ''
			child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
			child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
			child.on('close', (code) => {
				if (code !== 0) return reject(new PdfExtractionError(`Image rendering failed: ${stderr}`))
				try {
					resolve(JSON.parse(stdout))
				} catch (e) {
					reject(new PdfExtractionError(`Failed to parse image output: ${(e as Error).message}`))
				}
			})
		})
	} finally {
		if (tmpFile) {
			try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
		}
	}
}

export async function extractPdfData(pdfBuffer: Buffer): Promise<PdfExtractionResult> {
	const tmpFile = path.join(os.tmpdir(), `resume-pdf-${Date.now()}.pdf`)

	try {
		fs.writeFileSync(tmpFile, pdfBuffer)

		const result = await spawnPython(tmpFile)
		return result
	} finally {
		try {
			fs.unlinkSync(tmpFile)
		} catch {
			// ignore cleanup errors
		}
	}
}

function spawnPython(tmpFile: string): Promise<PdfExtractionResult> {
	return new Promise((resolve, reject) => {
		const pythonCmd = getPythonCommand()
		const scriptPath = path.resolve(process.cwd(), 'scripts', 'extract-pdf.py')

		let child: ReturnType<typeof spawn>
		try {
			child = spawn(pythonCmd, [scriptPath, tmpFile])
		} catch (err) {
			return reject(err)
		}

		let stdout = ''
		let stderr = ''

		child.stdout?.on('data', (chunk: Buffer) => {
			stdout += chunk.toString()
		})

		child.stderr?.on('data', (chunk: Buffer) => {
			stderr += chunk.toString()
		})

		child.on('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'ENOENT') {
				reject(
					new PdfExtractionError(
						`Python is not installed or not found in PATH. ` +
							`Please install Python and ensure it is accessible as '${pythonCmd}'.`,
					),
				)
			} else {
				reject(new PdfExtractionError(`Failed to spawn Python process: ${err.message}`))
			}
		})

		child.on('close', (code: number | null) => {
			if (code !== 0) {
				reject(
					new PdfExtractionError(
						`Python script exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
					),
				)
				return
			}

			let parsed: Record<string, unknown>
			try {
				parsed = JSON.parse(stdout) as Record<string, unknown>
			} catch {
				reject(new PdfExtractionError(`Failed to parse Python output as JSON: ${stdout.slice(0, 200)}`))
				return
			}

			if (parsed.error) {
				reject(new PdfExtractionError(String(parsed.error)))
				return
			}

			resolve(parsed as unknown as PdfExtractionResult)
		})
	})
}
