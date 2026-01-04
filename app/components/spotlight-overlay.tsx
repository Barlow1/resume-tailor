/**
 * Spotlight Overlay Component
 *
 * Creates a dark overlay with a "spotlight" hole around a target element.
 * Used during onboarding to guide users to specific UI elements.
 */

import { useEffect, useState, useRef } from 'react'

interface SpotlightOverlayProps {
	/** CSS selector for the target element to spotlight */
	targetSelector: string | null
	/** Whether the spotlight is enabled */
	enabled: boolean
	/** Content to display below the spotlight (hint text) */
	children?: React.ReactNode
}

interface TargetRect {
	top: number
	left: number
	width: number
	height: number
}

export function SpotlightOverlay({
	targetSelector,
	enabled,
	children,
}: SpotlightOverlayProps) {
	const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
	const observerRef = useRef<ResizeObserver | null>(null)

	useEffect(() => {
		if (!enabled || !targetSelector) {
			setTargetRect(null)
			return
		}

		const updatePosition = () => {
			const element = document.querySelector(targetSelector)
			if (!element) {
				setTargetRect(null)
				return
			}

			const rect = element.getBoundingClientRect()
			const padding = 8 // Padding around the element

			setTargetRect({
				top: rect.top - padding,
				left: rect.left - padding,
				width: rect.width + padding * 2,
				height: rect.height + padding * 2,
			})

			// Scroll element into view if needed
			if (rect.top < 0 || rect.bottom > window.innerHeight) {
				element.scrollIntoView({ behavior: 'smooth', block: 'center' })
			}
		}

		// Initial position
		updatePosition()

		// Watch for resize/reflow
		const element = document.querySelector(targetSelector)
		if (element) {
			observerRef.current = new ResizeObserver(updatePosition)
			observerRef.current.observe(element)
		}

		// Update on scroll and resize
		window.addEventListener('scroll', updatePosition, true)
		window.addEventListener('resize', updatePosition)

		return () => {
			observerRef.current?.disconnect()
			window.removeEventListener('scroll', updatePosition, true)
			window.removeEventListener('resize', updatePosition)
		}
	}, [targetSelector, enabled])

	if (!enabled || !targetRect) {
		return null
	}

	return (
		<>
			{/* Dark overlay with hole */}
			<div className="fixed inset-0 z-40 pointer-events-none">
				{/* Top panel */}
				<div
					className="absolute bg-black/60 left-0 right-0 top-0"
					style={{ height: targetRect.top }}
				/>
				{/* Bottom panel */}
				<div
					className="absolute bg-black/60 left-0 right-0 bottom-0"
					style={{ top: targetRect.top + targetRect.height }}
				/>
				{/* Left panel */}
				<div
					className="absolute bg-black/60 left-0"
					style={{
						top: targetRect.top,
						width: targetRect.left,
						height: targetRect.height,
					}}
				/>
				{/* Right panel */}
				<div
					className="absolute bg-black/60 right-0"
					style={{
						top: targetRect.top,
						left: targetRect.left + targetRect.width,
						height: targetRect.height,
					}}
				/>
			</div>


			{/* Hint content below spotlight */}
			{children && (
				<div
					className="fixed z-50 pointer-events-none"
					style={{
						top: targetRect.top + targetRect.height + 16,
						left: targetRect.left + targetRect.width / 2,
						transform: 'translateX(-50%)',
					}}
				>
					{children}
				</div>
			)}
		</>
	)
}
