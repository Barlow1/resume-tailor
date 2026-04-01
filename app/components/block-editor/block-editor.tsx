import { useRef, useEffect, useCallback } from 'react'
import type { BlockTree } from '~/utils/block-tree/types.ts'

interface BlockEditorProps {
	templateHtml: string | null
	blockTree: BlockTree | null
	className?: string
	onFieldChange?: (blockId: string, field: string, value: string) => void
}

const EDITABLE_CSS = `
[data-field] { cursor: text; }
[data-field]:hover { box-shadow: inset 0 0 0 1px rgba(107, 69, 255, 0.25); }
[data-field]:focus { background: rgba(107, 69, 255, 0.04); box-shadow: inset 0 0 0 1px rgba(107, 69, 255, 0.4); outline: none; }
`

const EDITABLE_SCRIPT = `
(function() {
  // Make all data-field elements editable
  document.querySelectorAll('[data-field]').forEach(function(el) {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
  });

  // Handle input — post changes to parent
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.field) return;
    var blockId = el.dataset.blockId || '';
    var field = el.dataset.field;
    var value = el.textContent || '';
    window.parent.postMessage({
      type: 'block-editor-field-edit',
      blockId: blockId,
      field: field,
      value: value
    }, '*');
  });

  // Handle paste — strip HTML, insert plain text
  document.addEventListener('paste', function(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.field) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // Handle keydown — block formatting, handle Escape
  document.addEventListener('keydown', function(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.field) return;

    // Block Ctrl+B/I/U formatting
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i' || e.key === 'u')) {
      e.preventDefault();
      return;
    }

    // Escape blurs the field
    if (e.key === 'Escape') {
      el.blur();
      return;
    }

    // Enter on single-line fields (not bullets/descriptions) — blur instead of newline
    if (e.key === 'Enter' && !e.shiftKey) {
      var field = el.dataset.field;
      var isMultiline = field.indexOf('bullets') !== -1 || field === 'text';
      if (!isMultiline) {
        e.preventDefault();
        el.blur();
      }
    }
  });
})();
`

export function BlockEditor({ templateHtml, blockTree, className, onFieldChange }: BlockEditorProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null)

	useEffect(() => {
		if (!templateHtml || !iframeRef.current) return

		const doc = iframeRef.current.contentDocument
		if (!doc) return

		doc.open()
		doc.write(templateHtml)
		doc.close()

		// Inject editable CSS
		const style = doc.createElement('style')
		style.textContent = EDITABLE_CSS
		doc.head.appendChild(style)

		// Inject editable script
		const script = doc.createElement('script')
		script.textContent = EDITABLE_SCRIPT
		doc.body.appendChild(script)
	}, [templateHtml])

	// Listen for postMessage from iframe
	useEffect(() => {
		if (!onFieldChange) return

		function handleMessage(e: MessageEvent) {
			if (e.data?.type !== 'block-editor-field-edit') return
			const { blockId, field, value } = e.data
			if (typeof field === 'string' && typeof value === 'string') {
				onFieldChange!(blockId, field, value)
			}
		}

		window.addEventListener('message', handleMessage)
		return () => window.removeEventListener('message', handleMessage)
	}, [onFieldChange])

	if (!templateHtml) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: '#999' }}>
				No design template loaded. Upload a resume to get started.
			</div>
		)
	}

	return (
		<div className={className} style={{ display: 'flex', justifyContent: 'center', padding: '24px', overflow: 'auto', flex: 1, background: '#f0f0f0' }}>
			<iframe
				ref={iframeRef}
				title="Resume Preview"
				style={{
					width: blockTree?.pageSettings.width ?? 816,
					minHeight: blockTree?.pageSettings.height ?? 1056,
					border: 'none',
					boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
					backgroundColor: '#fff',
				}}
			/>
		</div>
	)
}
