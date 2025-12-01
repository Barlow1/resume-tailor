import { cssBundleHref } from '@remix-run/css-bundle'
import {
	json,
	type DataFunctionArgs,
	type HeadersFunction,
	type LinksFunction,
	type MetaFunction,
} from '@remix-run/node'
import {
	Form,
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useLocation,
	useMatches,
	useSubmit,
} from '@remix-run/react'
import { withSentry } from '@sentry/remix'
import { useEffect, useRef, useState } from 'react'
import { Confetti } from './components/confetti.tsx'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { Button } from './components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from './components/ui/dropdown-menu.tsx'
import { Icon, href as iconsHref } from './components/ui/icon.tsx'
import { Toaster } from './components/ui/toaster.tsx'
import { ThemeSwitch, useTheme } from './routes/resources+/theme/index.tsx'
import { getTheme } from './routes/resources+/theme/theme.server.ts'
import fontStylestylesheetUrl from './styles/font.css'
import tailwindStylesheetUrl from './styles/tailwind.css'
import { authenticator, getUserId } from './utils/auth.server.ts'
import { ClientHintCheck, getHints } from './utils/client-hints.tsx'
import { prisma } from './utils/db.server.ts'
import { getEnv } from './utils/env.server.ts'
import { getFlashSession } from './utils/flash-session.server.ts'
import { combineHeaders, getDomainUrl, getUserImgSrc } from './utils/misc.ts'
import { useNonce } from './utils/nonce-provider.ts'
import { makeTimings, time } from './utils/timing.server.ts'
import { useToast } from './utils/useToast.tsx'
import { useOptionalUser, useUser } from './utils/user.ts'
import { trackEvent } from './utils/analytics.ts'
import rdtStylesheetUrl from 'remix-development-tools/stylesheet.css'
import clsx from 'clsx'
import LogRocket from 'logrocket'
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	TransitionChild,
} from '@headlessui/react'
import {
	Bars3Icon,
	Cog6ToothIcon,
	XMarkIcon,
	BriefcaseIcon,
	DocumentTextIcon,
	DocumentArrowUpIcon,
	QueueListIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
	MegaphoneIcon,
} from '@heroicons/react/24/outline'
import { redirect } from '@remix-run/router'
import { Crisp } from 'crisp-sdk-web'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from './components/ui/tooltip.tsx'
import { NewBadge } from './components/ui/badge.tsx'
import { RecaptchaProvider } from './components/recaptcha-provider.tsx'
declare global {
	interface Window {
		__LOGROCKET_INITIALIZED__?: boolean
	}
}

export const links: LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		{ rel: 'preload', href: iconsHref, as: 'image' },
		// Preload CSS as a resource to avoid render blocking
		{ rel: 'preload', href: fontStylestylesheetUrl, as: 'style' },
		{ rel: 'preload', href: tailwindStylesheetUrl, as: 'style' },
		cssBundleHref ? { rel: 'preload', href: cssBundleHref, as: 'style' } : null,
		rdtStylesheetUrl && process.env.NODE_ENV === 'development'
			? { rel: 'preload', href: rdtStylesheetUrl, as: 'style' }
			: null,
		{ rel: 'mask-icon', href: '/favicons/mask-icon.svg' },
		{
			rel: 'alternate icon',
			type: 'image/png',
			href: '/favicons/favicon-32x32.png',
		},
		{ rel: 'apple-touch-icon', href: '/favicons/apple-touch-icon.png' },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		//These should match the css preloads above to avoid css as render blocking resource
		{ rel: 'icon', type: 'image/svg+xml', href: '/favicons/favicon.svg' },
		{ rel: 'stylesheet', href: fontStylestylesheetUrl },
		{ rel: 'stylesheet', href: tailwindStylesheetUrl },
		cssBundleHref ? { rel: 'stylesheet', href: cssBundleHref } : null,
		rdtStylesheetUrl && process.env.NODE_ENV === 'development'
			? { rel: 'stylesheet', href: rdtStylesheetUrl }
			: null,
	].filter(Boolean)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: data ? 'Resume Tailor' : 'Error | Resume Tailor' },
		{ name: 'description', content: `Your own captain's log` },
	]
}

export async function loader({ request }: DataFunctionArgs) {
	const timings = makeTimings('root loader')
	const userId = await time(() => getUserId(request), {
		timings,
		type: 'getUserId',
		desc: 'getUserId in root',
	})

	const user = userId
		? await time(
				() =>
					prisma.user.findUnique({
						where: { id: userId },
						select: {
							id: true,
							name: true,
							username: true,
							imageId: true,
							email: true,
						},
					}),
				{ timings, type: 'find user', desc: 'find user in root' },
		  )
		: null
	if (userId && !user) {
		console.info('something weird happened')
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		await authenticator.logout(request, { redirectTo: '/' })
	}
	const { flash, headers: flashHeaders } = await getFlashSession(request)

	if (request.url.endsWith('/') && user) {
		throw redirect(`/builder`)
	}

	let firstJob = null
	let gettingStartedProgress = null
	let conversionEvent = null
	if (userId) {
		;[firstJob, gettingStartedProgress] = await Promise.all([
			prisma.job.findFirst({ where: { ownerId: userId } }),
			prisma.gettingStartedProgress.findUnique({
				where: {
					ownerId: userId,
				},
			}),
		])

		// Check for untracked conversion events (subscription_started or purchase_completed)
		const untrackedConversion = await prisma.conversionEvent.findFirst({
			where: {
				userId: userId,
				tracked: false,
			},
			orderBy: {
				createdAt: 'asc',
			},
		})

		if (untrackedConversion) {
			conversionEvent = {
				id: untrackedConversion.id,
				user_id: untrackedConversion.userId,
				plan_tier: untrackedConversion.planTier,
				price_usd: untrackedConversion.priceUsd,
				event_type: untrackedConversion.eventType,
			}
		}
	}

	return json(
		{
			user,
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
			ENV: getEnv(),
			flash,
			firstJob,
			gettingStartedProgress,
			conversionEvent,
		},
		{
			headers: combineHeaders(
				{ 'Server-Timing': timings.toString() },
				flashHeaders,
			),
		},
	)
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	const headers = {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
	}
	return headers
}

function Document({
	children,
	nonce,
	theme = 'light',
	env = {},
}: {
	children: React.ReactNode
	nonce: string
	theme?: 'dark' | 'light'
	env?: Record<string, string>
}) {
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				{/* Google Tag Manager */}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PSC247R2');`,
					}}
				/>
				{/* End Google Tag Manager */}
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="bg-background text-foreground">
				{/* Google Tag Manager (noscript) */}
				<noscript>
					<iframe
						src="https://www.googletagmanager.com/ns.html?id=GTM-PSC247R2"
						height="0"
						width="0"
						style={{ display: 'none', visibility: 'hidden' }}
						title='Google Tag Manager'
					></iframe>
				</noscript>
				{/* End Google Tag Manager (noscript) */}
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
				<LiveReload nonce={nonce} />
			</body>
		</html>
	)
}

const hideNavPages = [
	'routes/_marketing+/index',
	'routes/_auth+/signup/index',
	'routes/_auth+/login',
	'routes/_auth+/forgot-password/index',
	'routes/_auth+/onboarding',
	'routes/_auth+/verify',
	'routes/_auth+/reset-password',
	'routes/_auth+/forgot-username/index',
	'routes/pricing+/index',
	'routes/ai-resume-builder+/index',
]

function App() {
	const data = useLoaderData<typeof loader>()
	const nonce = useNonce()
	const user = useOptionalUser()
	const theme = useTheme()
	const matches = useMatches()
	const isOnLandingPage = Boolean(
		matches.find(m => m.id === 'routes/_marketing+/index'),
	)
	useToast(data.flash?.toast)

	const isBlogRoute = matches.some(m => m.id.startsWith('routes/blog+'))
	const shouldHideNav = Boolean(matches.find(m => hideNavPages.includes(m.id))) || isBlogRoute

	const location = useLocation()
	const path = location.pathname

	useEffect(() => {
		if (user && !window.__LOGROCKET_INITIALIZED__) {
			window.__LOGROCKET_INITIALIZED__ = true
			LogRocket.init('cnp1eb/resume-tailor')
			LogRocket.identify(user.id, {
				name: user.name ?? user.email,
				email: user.email,
			})
			Crisp.user.setEmail(user.email)
			if (user.name) {
				Crisp.user.setNickname(user.name)
			}
			if (user.username) {
				Crisp.session.setData({ username: user.username })
			}
		}
	}, [user])

	useEffect(() => {
		if (typeof window !== 'undefined') {
			Crisp.configure('d2a311b1-5815-4ced-8d94-0376198c598c')
		}
	}, [])

	// Track conversion events (subscription_started or purchase_completed)
	useEffect(() => {
		if (data.conversionEvent) {
			const trackedKey = `tracked_conversion_${data.conversionEvent.id}`

			// Check if we've already tracked this conversion event
			if (!sessionStorage.getItem(trackedKey)) {
				const eventName = data.conversionEvent.event_type === 'subscription_started'
					? 'subscription_started'
					: 'purchase_completed'

				trackEvent(eventName, {
					transaction_id: data.conversionEvent.id,
					value: data.conversionEvent.price_usd,
					currency: 'USD',
					user_id: data.conversionEvent.user_id,
					plan_tier: data.conversionEvent.plan_tier,
				})

				// Mark as tracked in sessionStorage to prevent duplicates on refresh
				sessionStorage.setItem(trackedKey, 'true')

				// Mark as tracked in database
				fetch('/resources/conversion/mark-tracked', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						conversionEventId: data.conversionEvent.id,
					}),
				}).catch(error => {
					console.error('Failed to mark conversion event as tracked:', error)
				})
			}
		}
	}, [data.conversionEvent])

	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [isCollapsed, setIsCollapsed] = useState(false)

	// Load collapsed state from localStorage on mount
	useEffect(() => {
		const savedState = localStorage.getItem('sidebarCollapsed')
		if (savedState) {
			setIsCollapsed(JSON.parse(savedState) as boolean)
		}
	}, [])

	// Save collapsed state to localStorage
	const toggleCollapse = () => {
		const newState = !isCollapsed
		setIsCollapsed(newState)
		localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
	}

	const navigation = [
		{
			name: 'Builder',
			href: `/builder`,
			icon: DocumentTextIcon,
			current: path?.includes('builder'),
		},
		{
			name: 'Resume Analyzer',
			href: `/analyze`,
			icon: MagnifyingGlassIcon,
			current: path?.includes('analyze'),
		},
		{
			name: 'Recruiter Outreach',
			href: `/outreach`,
			icon: MegaphoneIcon,
			current: path?.includes('outreach'),
		},
		{
			name: 'Resumes',
			href: `/resumes`,
			icon: QueueListIcon,
			current: path?.includes('resumes'),
		},
		{
			name: 'Jobs',
			href: `/jobs`,
			icon: BriefcaseIcon,
			current: path?.includes('jobs'),
		},
		{
			name: 'Upload Resume',
			href: `/users/${user?.username}/resume/upload`,
			icon: DocumentArrowUpIcon,
			current: path?.includes('Upload') && !path?.includes('resumes'),
		},
	]

	function classNames(...classes: string[]) {
		return classes.filter(Boolean).join(' ')
	}

	const recaptchaSiteKey =
		data.ENV.MODE === 'production' && data.ENV.CI !== 'true'
			? data.ENV.RECAPTCHA_SITE_KEY
			: 'test-key'

	return (
		<Document nonce={nonce} theme={theme} env={data.ENV}>
			<RecaptchaProvider siteKey={recaptchaSiteKey}>
				<div className="flex h-screen flex-col justify-between">
					<>
						<div>
							{shouldHideNav ? null : (
								<>
									<Dialog
										className="relative z-50 lg:hidden"
										open={sidebarOpen}
										onClose={setSidebarOpen}
									>
										<DialogBackdrop
											transition
											className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
										/>

										<div className="fixed inset-0 flex">
											<DialogPanel
												transition
												className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-[closed]:-translate-x-full"
											>
												<TransitionChild>
													<div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-[closed]:opacity-0">
														<button
															type="button"
															className="-m-2.5 p-2.5"
															onClick={() => setSidebarOpen(false)}
														>
															<span className="sr-only">Close sidebar</span>
															<XMarkIcon
																className="h-6 w-6 text-white"
																aria-hidden="true"
															/>
														</button>
													</div>
												</TransitionChild>
												{/* Sidebar component, swap this element with another sidebar if you like */}

												<div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[#6B45FF] px-6 pb-4">
													<div className="flex h-16 shrink-0 items-center">
														<Link to="/">
															<div
																className={clsx(
																	'md:text-md text-center text-sm font-extrabold text-white lg:text-xl',
																	{ hidden: isCollapsed },
																)}
															>
																RESUME TAILOR
															</div>
														</Link>
													</div>
													<nav className="flex flex-1 flex-col">
														<ul className="flex flex-1 flex-col gap-y-7">
															<li>
																<ul className="-mx-2 space-y-1">
																	{navigation.map(item => (
																		<li key={item.name}>
																			<Link
																				prefetch="intent"
																				to={item.href}
																				className={classNames(
																					item.current
																						? 'bg-brand-800 text-white'
																						: 'text-purple-200 hover:bg-brand-800/50 hover:text-white',
																					'group relative flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
																				)}
																				onClick={() => setSidebarOpen(false)}
																			>
																				<item.icon
																					className={classNames(
																						item.current
																							? 'text-white'
																							: 'text-purple-200 group-hover:text-white',
																						'h-6 w-6 shrink-0',
																					)}
																				/>
																				{!isCollapsed && (
																					<span className="relative flex items-center">
																						{item.name}
																						{item.name === 'Resume Analyzer' &&
																							!item.current && <NewBadge />}
																					</span>
																				)}
																			</Link>
																		</li>
																	))}
																</ul>
															</li>
															{user ? (
																<li className="mt-auto">
																	<Link
																		to={`/users/${user?.username}`}
																		className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-purple-200 hover:bg-brand-800/50 hover:text-white"
																	>
																		<Cog6ToothIcon
																			className="h-6 w-6 shrink-0 text-purple-200 group-hover:text-white"
																			aria-hidden="true"
																		/>
																		Settings
																	</Link>
																</li>
															) : null}
														</ul>
													</nav>
												</div>
											</DialogPanel>
										</div>
									</Dialog>

									{/* Static sidebar for desktop */}
									<div
										className={clsx(
											'hidden transition-all duration-300 lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col',
											isCollapsed ? 'lg:w-20' : 'lg:w-72',
										)}
									>
										{/* Sidebar component, swap this element with another sidebar if you like */}
										<div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[#6B45FF] px-6 pb-4">
											<div className="flex h-16 shrink-0 items-center">
												<Link to="/">
													<div
														className={clsx(
															'md:text-md text-center text-sm font-extrabold text-white lg:text-xl',
														)}
													>
														{!isCollapsed ? 'RESUME TAILOR' : 'RT'}
													</div>
												</Link>
											</div>

											{/* Collapse toggle button */}
											<button
												onClick={toggleCollapse}
												className="absolute right-0 top-[50vh] -mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shadow-md hover:bg-brand-800"
											>
												{isCollapsed ? (
													<ChevronRightIcon className="h-4 w-4" />
												) : (
													<ChevronLeftIcon className="h-4 w-4" />
												)}
											</button>

											<nav className="flex flex-1 flex-col">
												<ul className="flex flex-1 flex-col gap-y-7">
													<li>
														<ul className="-mx-2 space-y-1">
															{navigation.map(item => (
																<li key={item.name}>
																	<TooltipProvider
																		delayDuration={200}
																		key={item.name}
																	>
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<a
																					href={item.href}
																					className={classNames(
																						item.current
																							? 'bg-brand-800 text-white'
																							: 'text-purple-200 hover:bg-brand-800/50 hover:text-white',
																						'group relative flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
																					)}
																					title={item.name}
																				>
																					<item.icon
																						className={classNames(
																							item.current
																								? 'text-white'
																								: 'text-purple-200 group-hover:text-white',
																							'h-6 w-6 shrink-0',
																						)}
																					/>
																					{!isCollapsed && (
																						<span className="relative flex items-center">
																							{item.name}
																							{(item.name ===
																								'Resume Analyzer' ||
																								item.name ===
																									'Recruiter Outreach') &&
																								!item.current && <NewBadge />}
																						</span>
																					)}
																					{/* tiny dot when collapsed */}
																					{isCollapsed &&
																						(item.name === 'Resume Analyzer' ||
																							item.name ===
																								'Recruiter Outreach') &&
																						!item.current && (
																							<div className="absolute -right-1 -top-1">
																								<NewBadge compact />
																							</div>
																						)}
																				</a>
																			</TooltipTrigger>
																			{isCollapsed && (
																				<TooltipContent side="right">
																					{item.name}
																				</TooltipContent>
																			)}
																		</Tooltip>
																	</TooltipProvider>
																</li>
															))}
														</ul>
													</li>
													{user ? (
														<li className="mt-auto">
															<Link
																to={`/users/${user?.username}`}
																className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-purple-200 hover:bg-brand-800/50 hover:text-white"
																title="Settings"
															>
																<Cog6ToothIcon
																	className="h-6 w-6 shrink-0 text-purple-200 group-hover:text-white"
																	aria-hidden="true"
																/>
																{!isCollapsed && 'Settings'}
															</Link>
														</li>
													) : null}
												</ul>
											</nav>
										</div>
									</div>
								</>
							)}

							<div
								className={`${
									shouldHideNav ? '' : isCollapsed ? 'lg:pl-20' : 'lg:pl-72'
								}`}
							>
								<div
									className={`${
										shouldHideNav ? '' : 'sticky bg-background'
									} top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 px-4 shadow-sm dark:shadow-gray-500/50 sm:gap-x-6 sm:px-6 lg:px-8`}
								>
									<button
										type="button"
										className={`-m-2.5 p-2.5 text-primary lg:hidden ${
											shouldHideNav ? 'hidden' : ''
										}`}
										onClick={() => setSidebarOpen(true)}
									>
										<span className="sr-only">Open sidebar</span>
										<Bars3Icon className="h-6 w-6" aria-hidden="true" />
									</button>

									{/* Separator */}
									<div
										className={`h-6 w-px bg-gray-900/10 dark:bg-gray-500/50 lg:hidden ${
											shouldHideNav ? 'hidden' : ''
										}`}
										aria-hidden="true"
									/>

									<div className="flex flex-1 justify-between">
										{shouldHideNav ? (
											<div className="flex items-center gap-x-4 lg:gap-x-6">
												<Link to="/">
													<div
														className={clsx(
															'text-center text-xl font-extrabold text-primary md:text-3xl lg:text-4xl',
														)}
													>
														RESUME TAILOR
													</div>
												</Link>
												<div className="flex flex-1 items-center justify-end gap-x-4 self-stretch text-xl lg:gap-x-6">
													<Link
														to="/pricing"
														className="text-primary hover:underline"
													>
														Pricing
													</Link>
												</div>
												<div className="flex flex-1 items-center justify-end gap-x-4 self-stretch text-xl lg:gap-x-6">
													<Link
														to="/ai-resume-builder"
														className="whitespace-nowrap  text-primary hover:underline"
													>
														Resume Builder
													</Link>
												</div>
												<div className="flex flex-1 items-center justify-end gap-x-4 self-stretch text-xl lg:gap-x-6">
													<Link
														to="/blog"
														className="whitespace-nowrap  text-primary hover:underline"
													>
														Blog 
													</Link>
												</div>
											</div>
										) : null}

										<div className="flex flex-1 justify-end gap-x-4 self-stretch lg:gap-x-6">
											<div className="flex items-center gap-x-4 lg:gap-x-6">
												<button
													type="button"
													className="-m-2.5 p-2.5 text-primary hover:text-primary/50"
												>
													<span className="sr-only">Toggle Theme</span>
													<ThemeSwitch
														userPreference={data.requestInfo.userPrefs.theme}
													/>
												</button>

												{/* Separator */}
												<div
													className="hidden dark:bg-gray-500/50 lg:block lg:h-6 lg:w-px lg:bg-gray-900/10"
													aria-hidden="true"
												/>

												{/* Profile dropdown */}
												<div className="relative">
													{user ? (
														<UserDropdown
															isOnLandingPage={isOnLandingPage ?? false}
														/>
													) : (
														<Button asChild variant={'primary'} size="sm">
															<Link to="/login">Log In</Link>
														</Button>
													)}
												</div>
											</div>
										</div>
									</div>
								</div>

								<div className="mx-auto py-10">
									<div className="mx-au">
										<Outlet />
									</div>
								</div>
							</div>
						</div>
					</>
				</div>
				<Confetti confetti={data.flash?.confetti} />
				<Toaster />
			</RecaptchaProvider>
		</Document>
	)
}
export default withSentry(App)

function UserDropdown({ isOnLandingPage }: { isOnLandingPage: boolean }) {
	const user = useUser()
	const submit = useSubmit()
	const formRef = useRef<HTMLFormElement>(null)
	const manageSubFormRef = useRef<HTMLFormElement>(null)
	const path = useLocation().pathname

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button asChild variant={'primary'}>
					<Link
						to={`/users/${user.username}`}
						// this is for progressive enhancement
						onClick={e => e.preventDefault()}
						className="flex items-center gap-2"
					>
						<img
							className="h-8 w-8 rounded-full object-cover"
							alt={user.name ?? user.username}
							src={getUserImgSrc(user.imageId)}
							width={32}
							height={32}
						/>
						<span className="text-body-sm font-bold">
							{user.name ?? user.username}
						</span>
					</Link>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent sideOffset={8} align="start">
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to={`/users/${user.username}`}>
							<Icon className="text-body-md" name="avatar">
								Profile
							</Icon>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						asChild
						// this prevents the menu from closing before the form submission is completed
						onSelect={event => {
							event.preventDefault()
							submit(manageSubFormRef.current)
						}}
					>
						<Form
							action={`/resources/stripe/manage-subscription?redirectTo=${encodeURIComponent(
								path,
							)}`}
							method="POST"
							ref={manageSubFormRef}
						>
							<input hidden name="userId" value={user.id} />
							<Icon className="text-body-md" name="gear">
								<button type="submit">Manage Subscription</button>
							</Icon>
						</Form>
					</DropdownMenuItem>
					<DropdownMenuItem
						asChild
						// this prevents the menu from closing before the form submission is completed
						onSelect={event => {
							event.preventDefault()
							submit(formRef.current)
						}}
					>
						<Form action="/logout" method="POST" ref={formRef}>
							<Icon className="text-body-md" name="exit">
								<button type="submit">Logout</button>
							</Icon>
						</Form>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenu>
	)
}

export function ErrorBoundary() {
	// the nonce doesn't rely on the loader so we can access that
	const nonce = useNonce()

	// NOTE: you cannot use useLoaderData in an ErrorBoundary because the loader
	// likely failed to run so we have to do the best we can.
	// We could probably do better than this (it's possible the loader did run).
	// This would require a change in Remix.

	// Just make sure your root route never errors out and you'll always be able
	// to give the user a better UX.

	return (
		<Document nonce={nonce}>
			<GeneralErrorBoundary />
		</Document>
	)
}
