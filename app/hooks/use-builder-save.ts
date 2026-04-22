import { useEffect, useRef, useState } from 'react'
import { useFetcher } from '@remix-run/react'
import { useDebouncedCallback } from 'use-debounce'
import { toast } from '~/components/ui/use-toast.ts'
import { type ResumeData } from '~/utils/builder-resume.server.ts'

export function useBuilderSave() {
	const fetcher = useFetcher<{ success: boolean; error?: string }>()
	const [saveStatus, setSaveStatus] = useState<
		'idle' | 'saving' | 'saved' | 'error'
	>('idle')
	const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

	const debouncedSave = useDebouncedCallback(async (data: ResumeData) => {
		const form = new FormData()
		form.append('formData', JSON.stringify(data))
		form.append('downloadPDFRequested', 'false')
		form.append('subscribe', 'false')
		await fetcher.submit(form, {
			method: 'POST',
			action: '/resources/save-resume',
		})
	}, 1000)

	useEffect(() => {
		if (fetcher.state === 'submitting') {
			setSaveStatus('saving')
			return
		}
		if (fetcher.state === 'idle' && fetcher.data) {
			if (fetcher.data.success === false) {
				setSaveStatus('error')
				toast({
					variant: 'destructive',
					title: 'Failed to save',
					description:
						fetcher.data.error ||
						'Your changes could not be saved. Please try again.',
				})
			} else {
				setSaveStatus('saved')
			}
			clearTimeout(saveStatusTimeoutRef.current)
			saveStatusTimeoutRef.current = setTimeout(
				() => setSaveStatus('idle'),
				3000,
			)
		}
	}, [fetcher.state, fetcher.data])

	return { debouncedSave, saveStatus, saveFetcher: fetcher }
}
