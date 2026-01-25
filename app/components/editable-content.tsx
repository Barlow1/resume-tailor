import { useEffect, useState, useRef } from 'react'

interface EditableContentProps {
	content: string | null | undefined
	onInput: (e: React.FormEvent<HTMLDivElement>) => void
	className?: string
	placeholder?: string
	multiline?: boolean
	id?: string
	onEnter?: () => void
	rerenderRef?: React.MutableRefObject<boolean>
	style?: React.CSSProperties
}

// editable content component for about me
export function EditableContent({
	content,
	onInput,
	placeholder,
	className,
	multiline,
	id,
	onEnter,
	rerenderRef,
	style,
}: EditableContentProps) {
	const [initialValue, setInitialValue] = useState(content ?? '')
	const divRef = useRef<HTMLDivElement>(null)
	const previousContentRef = useRef<string>(content ?? '')

	useEffect(() => {
		const newValue = content ?? ''
		const isFocused = document.activeElement === divRef.current
		const contentChanged = newValue !== previousContentRef.current
		
		// Only update initialValue (which triggers dangerouslySetInnerHTML update) when:
		// 1. rerenderRef is true (forced rerender from layout change), OR
		// 2. Content changed externally and element is not focused (not user typing)
		// This prevents cursor jumping during normal typing
		if (rerenderRef?.current) {
			setInitialValue(newValue)
			previousContentRef.current = newValue
			rerenderRef.current = false
		} else if (contentChanged && !isFocused) {
			// External change (not from user typing) - update state
			setInitialValue(newValue)
			previousContentRef.current = newValue
		} else if (contentChanged) {
			// Content changed but element is focused - just update the ref, don't update state
			// This prevents cursor jumping while user is typing
			previousContentRef.current = newValue
		}
	}, [content, rerenderRef])

	return (
		<div
			ref={divRef}
			style={style}
			contentEditable
			onKeyDown={e => {
				if (e.key === 'Enter') {
					e.preventDefault()
					if (onEnter) {
						onEnter()
					} else if (multiline) {
						document.execCommand('insertLineBreak')
					}
				}
			}}
			onPaste={e => {
				e.preventDefault()
				// Get plain text from clipboard
				const text = e.clipboardData.getData('text/plain')
				// Insert at cursor position
				document.execCommand('insertText', false, text)
			}}
			onInput={onInput}
			suppressContentEditableWarning
			className={`cursor-text hover:bg-gray-100 ${className}`}
			placeholder={placeholder}
			dangerouslySetInnerHTML={{ __html: initialValue }}
			id={id}
		></div>
	)
}
