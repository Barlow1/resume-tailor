import { useLocation } from '@remix-run/react'
import { Pricing as PricingComponent } from '~/routes/resources+/pricing.tsx'

export default function Pricing() {
	const location = useLocation()
	const successUrl = location.pathname
	const cancelUrl = location.pathname
	return (
		<div className="py-24 sm:py-32">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<div className="mx-auto max-w-4xl text-center">
					<h2 className="text-base/7 font-semibold text-brand-800">Pricing</h2>
					<p className="text-balance mt-2 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
						Pricing that makes sense
					</p>
				</div>
				<p className="text-pretty mx-auto mt-6 max-w-2xl text-center text-lg font-medium text-muted-foreground sm:text-xl/8">
				  The most affordable plan and comprehensive solution for tailor your resume
				</p>
				<PricingComponent successUrl={successUrl} cancelUrl={cancelUrl} />
			</div>
		</div>
	)
}
