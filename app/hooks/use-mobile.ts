import { useState, useEffect } from 'react'

export function useMobile(breakpoint = 768) {
	const [mobile, setMobile] = useState(false)
	useEffect(() => {
		const check = () => setMobile(window.innerWidth < breakpoint)
		check()
		window.addEventListener('resize', check)
		return () => window.removeEventListener('resize', check)
	}, [breakpoint])
	return mobile
}
