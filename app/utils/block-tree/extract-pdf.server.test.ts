import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// --- Mock child_process ---

type SpawnFactory = () => {
	stdout: EventEmitter
	stderr: EventEmitter
	on: (event: string, cb: (...args: unknown[]) => void) => void
}

let spawnFactory: SpawnFactory | null = null

vi.mock('child_process', () => {
	return {
		spawn: (..._args: unknown[]) => {
			if (!spawnFactory) throw new Error('spawnFactory not set')
			return spawnFactory()
		},
	}
})

// --- Mock fs so we can track unlink calls without touching the filesystem ---

const mockWriteFileSync = vi.fn()
const mockUnlinkSync = vi.fn()

vi.mock('fs', () => ({
	writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
	unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
}))

// --- Helpers ---

const VALID_RESULT = {
	pages: [
		{
			pageNumber: 1,
			width: 612,
			height: 792,
			lines: [
				{
					text: 'Jane Doe',
					x: 72,
					y: 60,
					width: 100,
					height: 14,
					fontFamily: 'Helvetica',
					fontSize: 14,
					fontWeight: 700,
					fontStyle: 'normal',
					color: '#000000',
					column: 'full',
				},
			],
			rectangles: [],
			fonts: [{ family: 'Helvetica', weight: 700, style: 'normal' }],
		},
	],
	pageSettings: {
		width: 816,
		height: 1056,
		margins: { top: 48, right: 48, bottom: 48, left: 48 },
	},
	detectedColumns: {
		count: 1,
		splitX: null,
		leftWidth: null,
		rightWidth: null,
	},
}

/**
 * Creates a mock child process that emits stdout data then closes cleanly.
 */
function makeSuccessProcess(jsonOutput: string) {
	const stdout = new EventEmitter()
	const stderr = new EventEmitter()
	const proc = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter
		stderr: EventEmitter
	}
	proc.stdout = stdout
	proc.stderr = stderr

	// Emit after microtask so listeners are attached first
	setTimeout(() => {
		stdout.emit('data', Buffer.from(jsonOutput))
		proc.emit('close', 0)
	}, 0)

	return proc
}

/**
 * Creates a mock child process that emits stderr then closes with a non-zero code.
 */
function makeErrorProcess(exitCode: number, stderrMessage: string) {
	const stdout = new EventEmitter()
	const stderr = new EventEmitter()
	const proc = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter
		stderr: EventEmitter
	}
	proc.stdout = stdout
	proc.stderr = stderr

	setTimeout(() => {
		stderr.emit('data', Buffer.from(stderrMessage))
		proc.emit('close', exitCode)
	}, 0)

	return proc
}

/**
 * Creates a mock child process that emits an 'error' event (e.g. ENOENT).
 */
function makeSpawnErrorProcess(errCode: string) {
	const stdout = new EventEmitter()
	const stderr = new EventEmitter()
	const proc = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter
		stderr: EventEmitter
	}
	proc.stdout = stdout
	proc.stderr = stderr

	setTimeout(() => {
		const err = Object.assign(new Error(`spawn python ENOENT`), { code: errCode })
		proc.emit('error', err)
	}, 0)

	return proc
}

// Import the module under test AFTER mocks are registered
import { extractPdfData, PdfExtractionError } from './extract-pdf.server'

// --- Tests ---

describe('extractPdfData', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		spawnFactory = null
	})

	it('parses valid Python output and returns typed result', async () => {
		spawnFactory = () => makeSuccessProcess(JSON.stringify(VALID_RESULT))

		const result = await extractPdfData(Buffer.from('fake-pdf'))

		expect(result.pages).toHaveLength(1)
		expect(result.pages[0].pageNumber).toBe(1)
		expect(result.pages[0].width).toBe(612)
		expect(result.pages[0].lines[0].text).toBe('Jane Doe')
		expect(result.pages[0].lines[0].fontStyle).toBe('normal')
		expect(result.pageSettings.width).toBe(816)
		expect(result.detectedColumns.count).toBe(1)
		expect(result.detectedColumns.splitX).toBeNull()
	})

	it('throws PdfExtractionError when Python outputs an error JSON', async () => {
		spawnFactory = () => makeSuccessProcess(JSON.stringify({ error: 'File not found' }))

		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(PdfExtractionError)
		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow('File not found')
	})

	it('throws PdfExtractionError when Python is not installed (ENOENT)', async () => {
		spawnFactory = () => makeSpawnErrorProcess('ENOENT')

		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(PdfExtractionError)
		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(/Python is not installed/)
	})

	it('throws PdfExtractionError on non-zero exit code with stderr message', async () => {
		spawnFactory = () => makeErrorProcess(1, 'ModuleNotFoundError: No module named pdfplumber')

		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(PdfExtractionError)
		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(/exited with code 1/)
		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(/pdfplumber/)
	})

	it('cleans up temp file on success', async () => {
		spawnFactory = () => makeSuccessProcess(JSON.stringify(VALID_RESULT))

		await extractPdfData(Buffer.from('fake-pdf'))

		expect(mockUnlinkSync).toHaveBeenCalledOnce()
		// The temp file path written must match the one unlinked
		const writtenPath = mockWriteFileSync.mock.calls[0][0] as string
		const unlinkedPath = mockUnlinkSync.mock.calls[0][0] as string
		expect(writtenPath).toBe(unlinkedPath)
	})

	it('cleans up temp file on error (Python error JSON)', async () => {
		spawnFactory = () => makeSuccessProcess(JSON.stringify({ error: 'PDF has no pages' }))

		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(PdfExtractionError)

		expect(mockUnlinkSync).toHaveBeenCalledOnce()
	})

	it('cleans up temp file when Python is not installed', async () => {
		spawnFactory = () => makeSpawnErrorProcess('ENOENT')

		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(PdfExtractionError)

		expect(mockUnlinkSync).toHaveBeenCalledOnce()
	})

	it('cleans up temp file on non-zero exit code', async () => {
		spawnFactory = () => makeErrorProcess(1, 'crash')

		await expect(extractPdfData(Buffer.from('fake-pdf'))).rejects.toThrow(PdfExtractionError)

		expect(mockUnlinkSync).toHaveBeenCalledOnce()
	})
})
