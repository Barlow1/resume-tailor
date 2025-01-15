import { useEffect, useState } from 'react'

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

	useEffect(() => {
		if (rerenderRef?.current) {
			setInitialValue(content ?? '')
			rerenderRef.current = false
		}
	}, [rerenderRef, content])

	return (
		<div
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
			onInput={onInput}
			suppressContentEditableWarning
			className={`cursor-text hover:bg-gray-100 ${className}`}
			placeholder={placeholder}
			dangerouslySetInnerHTML={{ __html: initialValue }}
			id={id}
		></div>
	)
}
