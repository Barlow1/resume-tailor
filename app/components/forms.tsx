import { useInputEvent } from '@conform-to/react'
import React, { useCallback, useId, useRef } from 'react'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import { Checkbox, type CheckboxProps } from '~/components/ui/checkbox.tsx'
import { Textarea } from '~/components/ui/textarea.tsx'
import clsx from 'clsx'
import useEventListener from '~/utils/useEventListener.ts'
import useIsomorphicLayoutEffect from '~/utils/useIsomorphicLayoutEffect.tsx'

export type ListOfErrors = Array<string | null | undefined> | null | undefined

export function ErrorList({
	id,
	errors,
}: {
	errors?: ListOfErrors
	id?: string
}) {
	const errorsToRender = errors?.filter(Boolean)
	if (!errorsToRender?.length) return null
	return (
		<ul id={id} className="flex flex-col gap-1">
			{errorsToRender.map(e => (
				<li key={e} className="text-[10px] text-foreground-danger">
					{e}
				</li>
			))}
		</ul>
	)
}

export function Field({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: React.InputHTMLAttributes<HTMLInputElement>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = inputProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<Input
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			/>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function TextareaField({
	labelProps,
	textareaProps,
	errors,
	className,
	truncate = false,
	isAutoSize = false,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	textareaProps: React.InputHTMLAttributes<HTMLTextAreaElement>
	errors?: ListOfErrors
	className?: string
	isAutoSize?: boolean
	truncate?: boolean
}) {
	const fallbackId = useId()
	const id = textareaProps.id ?? textareaProps.name ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	const textAreaRef = useAutosizeTextArea(textareaProps.value)
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			{isAutoSize ? (
				<Textarea
					ref={textAreaRef as any}
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					placeholder=" "
					{...textareaProps}
					className={clsx({ 'max-h-[400px]': truncate })}
				/>
			) : (
				<Textarea
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					{...textareaProps}
				/>
			)}
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function CheckboxField({
	labelProps,
	buttonProps,
	errors,
	className,
}: {
	labelProps: JSX.IntrinsicElements['label']
	buttonProps: CheckboxProps
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const buttonRef = useRef<HTMLButtonElement>(null)
	// To emulate native events that Conform listen to:
	// See https://conform.guide/integrations
	const control = useInputEvent({
		// Retrieve the checkbox element by name instead as Radix does not expose the internal checkbox element
		// See https://github.com/radix-ui/primitives/discussions/874
		ref: () =>
			buttonRef.current?.form?.elements.namedItem(buttonProps.name ?? ''),
		onFocus: () => buttonRef.current?.focus(),
	})
	const id = buttonProps.id ?? buttonProps.name ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<div className="flex gap-2">
				<Checkbox
					id={id}
					ref={buttonRef}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					{...buttonProps}
					onCheckedChange={state => {
						control.change(Boolean(state.valueOf()))
						buttonProps.onCheckedChange?.(state)
					}}
					onFocus={event => {
						control.focus()
						buttonProps.onFocus?.(event)
					}}
					onBlur={event => {
						control.blur()
						buttonProps.onBlur?.(event)
					}}
					type="button"
				/>
				<label
					htmlFor={id}
					{...labelProps}
					className="self-center text-body-xs text-muted-foreground"
				/>
			</div>
			<div className="px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

// Updates the height of a <textarea> when the value changes.
export const useAutosizeTextArea = (
	value: string | number | readonly string[] | undefined,
) => {
	const [textAreaRef, setRef] = React.useState<HTMLTextAreaElement | null>(null)
	const handleResize = useCallback(() => {
		if (textAreaRef) {
			// We need to reset the height momentarily to get the correct scrollHeight for the textarea
			textAreaRef.style.height = '0px'
			const scrollHeight = textAreaRef.scrollHeight + 10

			// We then set the height directly, outside of the render loop
			// Trying to set this with state or a ref will product an incorrect value.
			textAreaRef.style.height = scrollHeight + 'px'
		}
	}, [textAreaRef])
	useEventListener('input', handleResize)
	useIsomorphicLayoutEffect(() => {
		handleResize()
	}, [textAreaRef, textAreaRef?.value, value])

	return setRef
}

