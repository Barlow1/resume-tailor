import { parse } from '@conform-to/zod'
import { CheckIcon } from '@heroicons/react/20/solid'
import { json } from '@remix-run/node'
import { Form, useRouteLoaderData } from '@remix-run/react'
import { type ActionFunctionArgs, redirect } from '@remix-run/router'
import { z } from 'zod'
import { Button } from '~/components/ui/button.tsx'
import { getUserId, requireStripeSubscription } from '~/utils/auth.server.ts'
import { useState } from 'react'
import { Radio, RadioGroup } from '@headlessui/react'
import { cn } from '~/utils/misc.ts'
import { trackEvent } from '~/utils/analytics.ts'
import type { loader as rootLoader } from '~/root.tsx'

const frequencies = [
	{ value: 'weekly' as const, label: 'Weekly', priceSuffix: '/week' },
	{ value: 'monthly' as const, label: 'Monthly', priceSuffix: '/month' },
]
const tiers = [
	{
		name: 'Free',
		id: 'tier-free',
		href: '#',
		price: {
			monthly: 'FREE',
			weekly: 'FREE',
		},
		description:
			"Build your first resume and tailor it to any job you're applying to and export it to an ATS optimized PDF",
		features: [
			'6 tailored/generated experiences',
			'48-hour support response time',
			'Export to an ATS optimized PDF',
		],
		mostPopular: false,
	},
	{
		name: 'Pro',
		id: 'tier-pro',
		href: '#',
		price: {
			monthly: { initial: '3 DAY FREE TRIAL', recurring: '$15' },
			weekly: { initial: '3 DAY FREE TRIAL', recurring: '$4.99' },
		},
		description:
			"Tailor unlimited resumes to all jobs you're applying to and download them in an ATS optimized PDF",
		features: [
			'3-day free trial',
			'Unlimited AI tailored & ATS optimized resumes',
			'AI powered resume builder',
			'AI resume upload & parsing',
			'Dedicated support',
		],
		mostPopular: true,
	},
]

export const PricingSchema = z.object({
	successUrl: z.string(),
	cancelUrl: z.string(),
	redirectTo: z.string().optional(),
	frequency: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: PricingSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const { successUrl, cancelUrl, redirectTo, frequency } = submission.value
	const userId = await getUserId(request)
	if (!userId) {
		return redirect(`/login?redirectTo=${redirectTo || successUrl}`)
	}
	const baseUrl = new URL(request.url).origin

	const fullSuccessUrl = `${baseUrl}${successUrl}`
	const fullCancelUrl = `${baseUrl}${cancelUrl}`
	await requireStripeSubscription({
		userId,
		successUrl: fullSuccessUrl,
		cancelUrl: fullCancelUrl,
		frequency,
	})
	return null
}

export function Pricing({
	successUrl,
	cancelUrl,
	redirectTo,
}: {
	successUrl: string
	cancelUrl: string
	redirectTo?: string | undefined
}) {
	const [frequency, setFrequency] = useState(frequencies[0])
	const rootData = useRouteLoaderData<typeof rootLoader>('root')
	const userId = rootData?.user?.id

	return (
		<div className="mx-auto max-w-7xl">
			<div className="mt-16 flex justify-center">
				<RadioGroup
					value={frequency}
					onChange={setFrequency}
					className="grid grid-cols-2 gap-x-1 rounded-full bg-background p-1 text-center text-xs/5 font-semibold ring-1 ring-inset ring-border"
				>
					{frequencies.map(option => (
						<Radio
							key={option.value}
							value={option}
							className="cursor-pointer rounded-full px-2.5 py-1 text-muted-foreground data-[checked]:bg-brand-800 data-[checked]:text-primary-foreground"
						>
							{option.label}
						</Radio>
					))}
				</RadioGroup>
			</div>
			<div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-2">
				{tiers.map(tier => {
					const price = tier.price[frequency.value]
					const initalPrice = typeof price === 'string' ? price : price.initial
					const recurringPrice =
						typeof price === 'string' ? undefined : price.recurring
					return (
						<div
							key={tier.id}
							className={cn(
								tier.mostPopular
									? 'ring-2 ring-brand-800'
									: 'ring-1 ring-border',
								'rounded-3xl bg-background p-8 xl:p-10',
							)}
						>
							<div className="flex items-center justify-between gap-x-4">
								<h3
									id={tier.id}
									className={cn(
										tier.mostPopular ? 'text-brand-800' : 'text-foreground',
										'text-lg/8 font-semibold',
									)}
								>
									{tier.name}
								</h3>
								{tier.mostPopular ? (
									<p className="rounded-full bg-brand-800/10 px-2.5 py-1 text-xs/5 font-semibold text-brand-800 dark:bg-brand-800/20">
										Most popular
									</p>
								) : null}
							</div>
							<p className="mt-4 text-sm/6 text-muted-foreground">
								{tier.description}
							</p>
							<p className="mt-6 flex items-baseline gap-x-1">
								<span className="text-4xl font-semibold tracking-tight text-foreground">
									{initalPrice}
								</span>
								{tier.name === 'Free' || tier.name === 'Pro' ? null : (
									<span className="text-sm/6 font-semibold text-muted-foreground">
										{frequency.priceSuffix}
									</span>
								)}
							</p>
							{recurringPrice ? (
								<p className="mt-6 flex items-baseline gap-x-1">
									<span className="text-sm/6 font-semibold text-muted-foreground">
										then
									</span>
									<span className="text-sm/6 font-semibold tracking-tight text-foreground">
										{recurringPrice}
									</span>
									{tier.name === 'Free' ? null : (
										<span className="text-sm/6 font-semibold text-muted-foreground">
											{frequency.priceSuffix}
										</span>
									)}
								</p>
							) : null}
							{tier.name === 'Free' ? null : (
								<Form method="post" action="/resources/pricing">
									<input type="hidden" name="successUrl" value={successUrl} />
									<input type="hidden" name="cancelUrl" value={cancelUrl} />
									<input type="hidden" name="redirectTo" value={redirectTo} />
									<input
										type="hidden"
										name="frequency"
										value={frequency.value}
									/>
									<Button
										type="submit"
										onClick={() => {
											// Track free_trial_started event
											if (userId) {
												trackEvent('free_trial_started', {
													user_id: userId,
													plan_tier: frequency.value,
												})
											}
										}}
										className={cn(
											tier.mostPopular
												? 'bg-brand-800 text-primary-foreground hover:bg-brand-500'
												: 'bg-background text-brand-800 ring-1 ring-inset ring-border hover:ring-brand-800/30',
											'mt-6 block w-full',
										)}
									>
										Start free trial
									</Button>
								</Form>
							)}
							<ul className="mt-8 space-y-3 text-sm/6 text-muted-foreground xl:mt-10">
								{tier.features.map(feature => (
									<li key={feature} className="flex gap-x-3">
										<CheckIcon
											aria-hidden="true"
											className="h-6 w-5 flex-none text-brand-800"
										/>
										{feature}
									</li>
								))}
							</ul>
						</div>
					)
				})}
			</div>
		</div>
	)
}
