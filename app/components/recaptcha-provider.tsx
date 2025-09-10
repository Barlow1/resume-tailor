import { createContext, useContext, useEffect, useState } from 'react'
import { useNonce } from '~/utils/nonce-provider.ts'

declare global {
	const grecaptcha: {
		enterprise: {
			ready: (cb: () => void) => void
			execute: (siteKey: string, options: { action: string }) => Promise<string>
		}
	}
}

interface Props {
	siteKey: string
	children: React.ReactNode
}

const providerContext = createContext<{
	token: string | null
	siteKey: string
	setToken: (token: string) => void
	isScriptLoaded: boolean
}>({
	token: null,
	siteKey: '',
	setToken: () => {},
	isScriptLoaded: false,
})

// Custom hook for loading scripts after the page becomes interactive
function useAfterInteractive(src: string, nonce: string, siteKey: string) {
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		if (siteKey === 'test-key') {
			setIsLoaded(true)
			return
		}
		// Check if document is already interactive or complete
		const loadScript = () => {
			// Prevent loading the same script multiple times
			if (document.querySelector(`script[src="${src}"]`)) {
				setIsLoaded(true)
				return
			}

			const script = document.createElement('script')
			script.src = src
			script.nonce = nonce
			script.async = true
			script.defer = true

			script.onload = () => setIsLoaded(true)
			script.onerror = () => setIsLoaded(false)

			document.head.appendChild(script)
		}

		if (
			document.readyState === 'interactive' ||
			document.readyState === 'complete'
		) {
			// Page is already interactive, load immediately
			loadScript()
		} else {
			// Wait for page to become interactive
			const handleReadyStateChange = () => {
				if (document.readyState === 'interactive') {
					loadScript()
					document.removeEventListener(
						'readystatechange',
						handleReadyStateChange,
					)
				}
			}

			document.addEventListener('readystatechange', handleReadyStateChange)

			// Cleanup function
			return () => {
				document.removeEventListener('readystatechange', handleReadyStateChange)
			}
		}
	}, [src, nonce, siteKey])

	return isLoaded
}

export const useRecaptcha = (action: string) => {
	const { token, siteKey, setToken, isScriptLoaded } =
		useContext(providerContext)
	useEffect(() => {
		// if the site key is test-key, set the token to test-token
		if (siteKey === 'test-key') {
			setToken('test-token')
			return
		}

		// Only try to execute reCAPTCHA if the script is loaded
		if (isScriptLoaded && typeof grecaptcha !== 'undefined') {
			grecaptcha.enterprise.ready(async () => {
				const token = await grecaptcha.enterprise.execute(siteKey, {
					action: action,
				})
				setToken(token)
			})
		}
	}, [siteKey, action, setToken, isScriptLoaded])
	return { token }
}

export function RecaptchaProvider({ siteKey, children }: Props) {
	const [token, setToken] = useState<string | null>(null)
	const nonce = useNonce()

	// Load the reCAPTCHA script after the page becomes interactive
	const scriptSrc = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}&badge=bottomleft`
	const isScriptLoaded = useAfterInteractive(scriptSrc, nonce, siteKey)

	return (
		<providerContext.Provider
			value={{ token, siteKey, setToken, isScriptLoaded }}
		>
			{children}
		</providerContext.Provider>
	)
}
