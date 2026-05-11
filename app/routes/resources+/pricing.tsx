import { parse } from '@conform-to/zod'
import { json } from '@remix-run/node'
import { Form, useRouteLoaderData } from '@remix-run/react'
import { type ActionFunctionArgs, redirect } from '@remix-run/router'
import { useState } from 'react'
import { z } from 'zod'
import { track } from '~/lib/analytics.client.ts'
import { useTheme } from '~/routes/resources+/theme/index.tsx'
import type { loader as rootLoader } from '~/root.tsx'
import { trackEvent } from '~/utils/analytics.ts'
import { getUserId, requireStripeSubscription } from '~/utils/auth.server.ts'

export type Frequency = 'weekly' | 'monthly'

export type SubscribeTrigger =
	| 'pricing_page'
	| 'download_limit'
	| 'ai_limit'
	| 'analysis_limit'
	| 'outreach_limit'
	| 'upload_required'
	| 'direct'

const FREE_FEATURES = [
	'3 tailored experiences',
	'3 generated experiences',
	'48-hour support response time',
	'Export to an ATS optimized PDF',
]

const PRO_FEATURES = [
	'3-day free trial',
	'Unlimited AI tailored & ATS optimized resumes',
	'AI powered resume builder',
	'AI resume upload & parsing',
	'Dedicated support',
]

const PRICES: Record<Frequency, { amount: string; period: string }> = {
	weekly: { amount: '$4.99', period: 'week' },
	monthly: { amount: '$15', period: 'month' },
}

export const PricingSchema = z.object({
	successUrl: z.string(),
	cancelUrl: z.string(),
	redirectTo: z.string().optional(),
	frequency: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, { schema: PricingSchema })
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
	const fullSuccessUrl = `${baseUrl}${redirectTo || successUrl}`
	const fullCancelUrl = `${baseUrl}${cancelUrl}`
	await requireStripeSubscription({
		userId,
		successUrl: fullSuccessUrl,
		cancelUrl: fullCancelUrl,
		frequency,
	})
	return null
}

// ---------------------------------------------------------------------------
// Theme-aware token map
// ---------------------------------------------------------------------------

interface Tokens {
	el: string         // tier card surface
	brand: string      // primary purple (always #6B45FF)
	gradFrom: string   // gradient stop 1
	gradMid: string   // gradient stop 2
	gradTo: string     // gradient stop 3
	text: string
	sec: string
	mut: string
	brd: string
	checkmark: string
	proGlow: string    // inner radial glow on Pro card
	proShadow: string  // outer shadow on Pro card
	toggleBg: string
	toggleBrd: string
}

const dark: Tokens = {
	el: '#18181B',
	brand: '#6B45FF',
	gradFrom: '#8B6AFF',
	gradMid: '#C4B5FD',
	gradTo: '#6B45FF',
	text: '#FAFAFA',
	sec: '#A1A1AA',
	mut: '#8E8E96',
	brd: 'rgba(255,255,255,0.06)',
	checkmark: '#8B6AFF',
	proGlow: 'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(107,69,255,0.18) 0%, transparent 70%)',
	proShadow: '0 0 0 1px rgba(107,69,255,0.3), 0 8px 32px rgba(107,69,255,0.15)',
	toggleBg: '#18181B',
	toggleBrd: 'rgba(255,255,255,0.06)',
}

const light: Tokens = {
	el: '#FAFAFA',
	brand: '#6B45FF',
	gradFrom: '#5430BB',
	gradMid: '#6B45FF',
	gradTo: '#5430BB',
	text: '#111113',
	sec: '#46464C',
	mut: '#71717A',
	brd: '#E0E0E6',
	checkmark: '#6B45FF',
	proGlow: 'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(107,69,255,0.06) 0%, transparent 70%)',
	proShadow: '0 0 0 1px rgba(107,69,255,0.35), 0 8px 24px rgba(107,69,255,0.18)',
	toggleBg: '#F4F4F5',
	toggleBrd: '#E0E0E6',
}

export function tokensFor(theme: 'light' | 'dark'): Tokens {
	return theme === 'light' ? light : dark
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export function Pricing({
	successUrl,
	cancelUrl,
	redirectTo,
	trigger = 'pricing_page',
}: {
	successUrl: string
	cancelUrl: string
	redirectTo?: string | undefined
	trigger?: SubscribeTrigger
}) {
	const [frequency, setFrequency] = useState<Frequency>('weekly')
	const rootData = useRouteLoaderData<typeof rootLoader>('root')
	const userId = rootData?.user?.id
	const theme = useTheme()
	const t = tokensFor(theme)
	const price = PRICES[frequency]

	const handleSubmit = () => {
		try {
			if (userId) {
				trackEvent('free_trial_started', {
					user_id: userId,
					plan_tier: frequency,
				})
			}
			trackEvent('checkout_started', {
				plan: frequency,
				is_trial: true,
				trigger,
			})
			track('checkout_started', {
				plan: frequency,
				is_trial: true,
				trigger,
			})
		} catch {
			// never block checkout on analytics
		}
	}

	return (
		<div style={{ fontFamily: 'Nunito Sans, system-ui, sans-serif' }}>
			<div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
				<FrequencyToggle value={frequency} onChange={setFrequency} t={t} />
			</div>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
					gap: 16,
					maxWidth: 700,
					marginLeft: 'auto',
					marginRight: 'auto',
				}}
			>
				<FreeCard t={t} />
				<ProCard
					t={t}
					price={price}
					successUrl={successUrl}
					cancelUrl={cancelUrl}
					redirectTo={redirectTo}
					frequency={frequency}
					trigger={trigger}
					onSubmit={handleSubmit}
				/>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Tier cards
// ---------------------------------------------------------------------------

function FreeCard({ t }: { t: Tokens }) {
	return (
		<div
			style={{
				background: t.el,
				border: `1px solid ${t.brd}`,
				borderRadius: 16,
				padding: '24px 22px',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<h3
				style={{
					margin: 0,
					fontSize: 18,
					fontWeight: 600,
					color: t.text,
					letterSpacing: '-0.01em',
				}}
			>
				Free
			</h3>

			<div style={{ marginTop: 12, marginBottom: 14 }}>
				<span
					style={{
						fontFamily: 'Manrope, Nunito Sans, system-ui, sans-serif',
						fontSize: 24,
						fontWeight: 700,
						letterSpacing: '-0.02em',
						color: t.text,
						lineHeight: 1,
					}}
				>
					FREE
				</span>
			</div>

			<p style={{ margin: '0 0 18px', color: t.sec, fontSize: 14, lineHeight: 1.5 }}>
				Build your first resume and tailor it to any job you&rsquo;re applying to and export
				it to an ATS optimized PDF
			</p>

			<ul
				style={{
					listStyle: 'none',
					padding: 0,
					margin: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
				}}
			>
				{FREE_FEATURES.map(f => (
					<FeatureItem key={f} text={f} t={t} />
				))}
			</ul>
		</div>
	)
}

interface ProCardProps {
	t: Tokens
	price: { amount: string; period: string }
	successUrl: string
	cancelUrl: string
	redirectTo?: string
	frequency: Frequency
	trigger?: SubscribeTrigger
	onSubmit: () => void
}

function ProCard({
	t,
	price,
	successUrl,
	cancelUrl,
	redirectTo,
	frequency,
	trigger,
	onSubmit,
}: ProCardProps) {
	const [ctaHover, setCtaHover] = useState(false)
	return (
		<div
			style={{
				position: 'relative',
				background: t.el,
				border: `1px solid ${t.brand}`,
				borderRadius: 16,
				padding: '24px 22px',
				boxShadow: t.proShadow,
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			}}
		>
			<div
				aria-hidden="true"
				style={{
					position: 'absolute',
					inset: 0,
					pointerEvents: 'none',
					background: t.proGlow,
				}}
			/>

			<div
				style={{
					position: 'relative',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}
			>
				<h3
					style={{
						margin: 0,
						fontSize: 18,
						fontWeight: 600,
						letterSpacing: '-0.01em',
						background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradMid}, ${t.gradTo})`,
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						backgroundClip: 'text',
					}}
				>
					Pro
				</h3>
				<span
					style={{
						background: 'rgba(107,69,255,0.12)',
						color: t.brand,
						border: '1px solid rgba(107,69,255,0.25)',
						borderRadius: 999,
						padding: '4px 10px',
						fontSize: 11,
						fontWeight: 600,
						textTransform: 'uppercase',
						letterSpacing: '0.05em',
					}}
				>
					Most popular
				</span>
			</div>

			<div style={{ position: 'relative', marginTop: 12, marginBottom: 14 }}>
				<div
					style={{
						fontFamily: 'Manrope, Nunito Sans, system-ui, sans-serif',
						fontSize: 28,
						fontWeight: 700,
						letterSpacing: '-0.02em',
						color: t.text,
						lineHeight: 1.05,
					}}
				>
					3 DAY FREE TRIAL
				</div>
				<div style={{ fontSize: 14, color: t.mut, marginTop: 4 }}>
					then {price.amount}/{price.period}
				</div>
			</div>

			<p
				style={{
					position: 'relative',
					margin: '0 0 18px',
					color: t.sec,
					fontSize: 14,
					lineHeight: 1.5,
				}}
			>
				Tailor unlimited resumes to all jobs you&rsquo;re applying to and download them in an
				ATS optimized PDF
			</p>

			<ul
				style={{
					position: 'relative',
					listStyle: 'none',
					padding: 0,
					margin: '0 0 20px',
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
				}}
			>
				{PRO_FEATURES.map(f => (
					<FeatureItem key={f} text={f} t={t} />
				))}
			</ul>

			<Form
				method="post"
				action="/resources/pricing"
				onSubmit={onSubmit}
				style={{ position: 'relative', marginTop: 'auto' }}
			>
				<input type="hidden" name="successUrl" value={successUrl} />
				<input type="hidden" name="cancelUrl" value={cancelUrl} />
				{redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
				<input type="hidden" name="frequency" value={frequency} />
				{trigger ? <input type="hidden" name="trigger" value={trigger} /> : null}

				<button
					type="submit"
					onMouseEnter={() => setCtaHover(true)}
					onMouseLeave={() => setCtaHover(false)}
					style={{
						width: '100%',
						background: t.brand,
						color: '#fff',
						border: 'none',
						borderRadius: 8,
						padding: '12px 24px',
						fontSize: 15,
						fontWeight: 500,
						cursor: 'pointer',
						fontFamily: 'Nunito Sans, system-ui, sans-serif',
						boxShadow: ctaHover
							? '0 0 0 1px rgba(107,69,255,0.4), 0 6px 24px rgba(107,69,255,0.35)'
							: '0 0 0 1px rgba(107,69,255,0.3), 0 4px 16px rgba(107,69,255,0.25)',
						transform: ctaHover ? 'translateY(-1px)' : 'translateY(0)',
						transition: 'all 0.2s',
					}}
				>
					Start free trial
				</button>
			</Form>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

function FeatureItem({ text, t }: { text: string; t: Tokens }) {
	return (
		<li
			style={{
				display: 'flex',
				alignItems: 'flex-start',
				gap: 10,
				color: t.sec,
				fontSize: 14,
				lineHeight: 1.5,
			}}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke={t.checkmark}
				strokeWidth={2.25}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
				style={{ flexShrink: 0, marginTop: 2 }}
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
			<span>{text}</span>
		</li>
	)
}

function FrequencyToggle({
	value,
	onChange,
	t,
}: {
	value: Frequency
	onChange: (f: Frequency) => void
	t: Tokens
}) {
	const options: { id: Frequency; label: string }[] = [
		{ id: 'weekly', label: 'Weekly' },
		{ id: 'monthly', label: 'Monthly' },
	]
	const activeIdx = options.findIndex(o => o.id === value)
	return (
		<div
			role="tablist"
			aria-label="Billing frequency"
			style={{
				position: 'relative',
				display: 'inline-flex',
				padding: 4,
				background: t.toggleBg,
				border: `1px solid ${t.toggleBrd}`,
				borderRadius: 999,
			}}
		>
			<div
				aria-hidden="true"
				style={{
					position: 'absolute',
					top: 4,
					bottom: 4,
					left: 4,
					width: 'calc(50% - 4px)',
					borderRadius: 999,
					background: t.brand,
					boxShadow: '0 0 0 1px rgba(107,69,255,0.4), 0 2px 8px rgba(107,69,255,0.3)',
					transform: `translateX(${activeIdx * 100}%)`,
					transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
				}}
			/>
			{options.map(o => {
				const active = o.id === value
				return (
					<button
						key={o.id}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(o.id)}
						style={{
							position: 'relative',
							zIndex: 1,
							minWidth: 108,
							padding: '8px 18px',
							background: 'transparent',
							border: 'none',
							cursor: 'pointer',
							color: active ? '#fff' : t.sec,
							fontFamily: 'Nunito Sans, system-ui, sans-serif',
							fontSize: 13,
							fontWeight: 600,
							transition: 'color 0.2s',
						}}
					>
						{o.label}
					</button>
				)
			})}
		</div>
	)
}

export default Pricing
