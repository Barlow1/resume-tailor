// app/routes/login.tsx
import { useFetcher } from '@remix-run/react'
import { SocialsProvider } from 'remix-auth-socials'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import React from 'react'
import clsx from 'clsx'

interface SocialButtonProps {
	provider: SocialsProvider
	label: string
	icon: JSX.Element
}

function GoogleIcon(props: React.PropsWithChildren) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 326667 333333"
			shapeRendering="geometricPrecision"
			textRendering="geometricPrecision"
			imageRendering="optimizeQuality"
			fillRule="evenodd"
			clipRule="evenodd"
			className="mr-2 h-5 w-5 overflow-visible"
			{...props}
		>
			<path
				d="M326667 170370c0-13704-1112-23704-3518-34074H166667v61851h91851c-1851 15371-11851 38519-34074 54074l-311 2071 49476 38329 3428 342c31481-29074 49630-71852 49630-122593m0 0z"
				fill="#4285f4"
			/>
			<path
				d="M166667 333333c44999 0 82776-14815 110370-40370l-52593-40742c-14074 9815-32963 16667-57777 16667-44074 0-81481-29073-94816-69258l-1954 166-51447 39815-673 1870c27407 54444 83704 91852 148890 91852z"
				fill="#34a853"
			/>
			<path
				d="M71851 199630c-3518-10370-5555-21482-5555-32963 0-11482 2036-22593 5370-32963l-93-2209-52091-40455-1704 811C6482 114444 1 139814 1 166666s6482 52221 17777 74814l54074-41851m0 0z"
				fill="#fbbc04"
			/>
			<path
				d="M166667 64444c31296 0 52406 13519 64444 24816l47037-45926C249260 16482 211666 1 166667 1 101481 1 45185 37408 17777 91852l53889 41853c13520-40185 50927-69260 95001-69260m0 0z"
				fill="#ea4335"
			/>
		</svg>
	)
}

function Divider({ children }: React.PropsWithChildren) {
	return (
		<div className="relative mb-6 mt-10">
			<div className="absolute inset-0 flex items-center" aria-hidden="true">
				<div className="w-full border-t border-gray-200 dark:border-zinc-700" />
			</div>
			<div className="relative flex justify-center text-sm font-medium leading-6">
				<span className="bg-white px-6 text-gray-900 dark:bg-zinc-800 dark:text-white">
					{children}
				</span>
			</div>
		</div>
	)
}

const ButtonStyles = {
	[SocialsProvider.DISCORD]: '',
	[SocialsProvider.FACEBOOK]:
		'text-white bg-[#3b5998] hover:bg-[#3b5998]/90 focus:ring-4 focus:outline-none focus:ring-[#3b5998]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#3b5998]/55 mr-2 mb-2',
	[SocialsProvider.GITHUB]:
		'text-white bg-[#020203] hover:bg-[#020203]/90 focus:ring-4 focus:outline-none focus:ring-[#24292F]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-gray-500 dark:hover:bg-[#050708]/30 mr-2 mb-2',
	[SocialsProvider.MICROSOFT]: '',
	[SocialsProvider.GOOGLE]:
		'text-gray-900 border border-gray-200 bg-white hover:bg-white/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#4285F4]/55 mr-2 mb-2',
	[SocialsProvider.LINKEDIN]: 'text-white bg-[#0a66c2] hover:bg-[#0a66c2]/90 focus:ring-4 focus:outline-none focus:ring-[#0a66c2]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-gray-500 dark:hover:bg-[#0a66c2]/30 mr-2 mb-2',
} as any

function SocialButton({
	provider,
	label,
	icon,
}: React.PropsWithChildren<SocialButtonProps>) {
	const fetcher = useFetcher()
	return (
		<fetcher.Form action={`/auth/${provider}`} method="post">
			<button
				className={clsx(
					'w-full justify-center drop-shadow-md',
					ButtonStyles[provider],
				)}
				aria-label={label}
				type="submit"
			>
				{icon}
				{label}
			</button>
		</fetcher.Form>
	)
}

export default function SocialLogin() {
	return (
		<div>
			<Divider>Or continue with</Divider>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<SocialButton
					provider={SocialsProvider.GOOGLE}
					label="Google"
					icon={<GoogleIcon />}
				/>
				<SocialButton
					provider={SocialsProvider.GITHUB}
					label="Github"
					icon={<FontAwesomeIcon className="mr-2 h-5 w-5" icon={faGithub} />}
				/>
				<SocialButton
					provider={SocialsProvider.LINKEDIN}
					label="LinkedIn"
					icon={<FontAwesomeIcon className="mr-2 h-5 w-5" icon={faLinkedin} />}
				/>
			</div>
		</div>
	)
}
