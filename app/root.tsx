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
	// useMatches,
	useSubmit,
} from '@remix-run/react'
import { withSentry } from '@sentry/remix'
import { useEffect, useRef } from 'react'
import { Confetti } from './components/confetti.tsx'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
// import { SearchBar } from './components/search-bar.tsx'
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
import rdtStylesheetUrl from 'remix-development-tools/stylesheet.css'
import OnboardingStepper from './routes/resources+/onboarding-stepper.tsx'
import * as gtag from './utils/gtags.client.ts'
import clsx from 'clsx'
import LogRocket from 'logrocket'

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
						select: { id: true, name: true, username: true, imageId: true, email: true },
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

	let firstJob = null
	let gettingStartedProgress = null
	if (userId) {
		;[firstJob, gettingStartedProgress] = await Promise.all([
			prisma.job.findFirst({ where: { ownerId: userId } }),
			prisma.gettingStartedProgress.findUnique({
				where: {
					ownerId: userId,
				},
			}),
		])
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
	const location = useLocation()
	const gaTrackingId = 'G-8JBRTFQ8PR'
	useEffect(() => {
		if (gaTrackingId?.length && process.env.NODE_ENV === 'production') {
			gtag.pageview(location.pathname, gaTrackingId)
		}
	}, [location])
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<ClientHintCheck nonce={nonce} />
				<script
					async
					src={`https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`}
				></script>
				<script
					async
					id="gtag-init"
					dangerouslySetInnerHTML={{
						__html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaTrackingId}', {
                  page_path: window.location.pathname,
                });
              `,
					}}
				/>
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="bg-background text-foreground">
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

	useEffect(() => {
		if (user) {
			LogRocket.identify(user.id, {
				name: user.name ?? user.email,
				email: user.email,

				// Add your own custom user variables here, ie:
				subscriptionType: 'pro',
			})
		}
	}, [user])

	return (
		<Document nonce={nonce} theme={theme} env={data.ENV}>
			<div className="flex h-screen flex-col justify-between">
				<header className="container py-6">
					<nav className="flex items-center justify-between">
						<Link to="/">
							<div
								className={clsx(
									'text-center text-xl font-extrabold text-primary md:text-3xl lg:text-6xl',
									{ 'text-white': isOnLandingPage },
								)}
							>
								RESUME TAILOR
							</div>
						</Link>
						{/* {isOnSearchPage ? null : (
							<div className="ml-auto max-w-sm flex-1 pr-10">
								<SearchBar status="idle" />
							</div>
						)} */}
						<div className="flex items-center gap-10">
							<ThemeSwitch
								className={isOnLandingPage ? 'text-white' : undefined}
								userPreference={data.requestInfo.userPrefs.theme}
							/>
							<div className="flex items-center gap-10">
								{user ? (
									<UserDropdown isOnLandingPage={isOnLandingPage ?? false} />
								) : (
									<Button asChild variant={'primary'} size="sm">
										<Link to="/login">Log In</Link>
									</Button>
								)}
							</div>
						</div>
					</nav>
				</header>

				<div className="flex-1">
					<Outlet />
					<OnboardingStepper
						firstJob={data.firstJob}
						gettingStartedProgress={data.gettingStartedProgress}
					/>
				</div>

				<div className="container flex justify-between pb-5">
					<Link to="/">
						<div className="font-light">Resume</div>
						<div className="font-bold">Tailor</div>
					</Link>
				</div>
			</div>
			<Confetti confetti={data.flash?.confetti} />
			<Toaster />
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
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to={`/users/${user.username}/jobs`}>
							<Icon className="text-body-md" name="pencil-2">
								Jobs
							</Icon>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link
							prefetch="intent"
							to={`/users/${user.username}/resume/upload`}
						>
							<Icon className="text-body-md" name="upload">
								Resume
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
