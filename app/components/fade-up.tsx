import { useRef, useState, useEffect, type ReactNode, type CSSProperties } from 'react'

function useInView(threshold = 0.1) {
	const ref = useRef<HTMLDivElement>(null)
	const [visible, setVisible] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const obs = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					obs.disconnect()
					// Double rAF ensures the browser has painted at least one
					// frame with the hidden state before we transition to visible.
					// Without this, above-the-fold elements jump to the end state
					// because the observer fires before the initial paint.
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							setVisible(true)
						})
					})
				}
			},
			{ threshold },
		)
		obs.observe(el)
		return () => obs.disconnect()
	}, [threshold])
	return [ref, visible] as const
}

export function FadeUp({
	children,
	delay = 0,
	style = {},
}: {
	children: ReactNode
	delay?: number
	style?: CSSProperties
}) {
	const [ref, visible] = useInView()
	return (
		<div
			ref={ref}
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? 'translateY(0)' : 'translateY(28px)',
				transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
				...style,
			}}
		>
			{children}
		</div>
	)
}
