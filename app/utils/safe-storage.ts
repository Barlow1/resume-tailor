/**
 * Safe Web Storage wrappers. In Safari private mode, in-app webviews
 * (LinkedIn/Instagram/Facebook browsers), and blocked-cookies
 * configurations, window.localStorage/sessionStorage can be null or throw
 * SecurityError on ANY access. Never touch storage directly — a raw
 * localStorage.getItem in render/effect code crashes the whole React tree
 * for those users (RESUME-TAILOR-4W).
 *
 * Deliberately NOT named *.client.ts: Remix blanks .client modules in the
 * server bundle and some callers import this in SSR-reachable code; the
 * typeof-window guard makes it SSR-safe instead.
 */
function getStore(kind: 'localStorage' | 'sessionStorage'): Storage | null {
	if (typeof window === 'undefined') return null
	try {
		return window[kind] ?? null
	} catch {
		return null
	}
}

export function storageGet(key: string): string | null {
	try {
		return getStore('localStorage')?.getItem(key) ?? null
	} catch {
		return null
	}
}

export function storageSet(key: string, value: string): void {
	try {
		getStore('localStorage')?.setItem(key, value)
	} catch {}
}

export function storageRemove(key: string): void {
	try {
		getStore('localStorage')?.removeItem(key)
	} catch {}
}

export function sessionGet(key: string): string | null {
	try {
		return getStore('sessionStorage')?.getItem(key) ?? null
	} catch {
		return null
	}
}

export function sessionSet(key: string, value: string): void {
	try {
		getStore('sessionStorage')?.setItem(key, value)
	} catch {}
}
