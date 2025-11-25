import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme.js'
import animatePlugin from 'tailwindcss-animate'
import radixPlugin from 'tailwindcss-radix'
import typography from '@tailwindcss/typography'
import lineClamp from '@tailwindcss/line-clamp'

export default {
	content: ['./app/**/*.{ts,tsx,jsx,js,mdx}'],
	darkMode: 'class',
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: {
					DEFAULT: 'hsl(var(--input))',
					invalid: 'hsl(var(--input-invalid))',
				},
				ring: {
					DEFAULT: 'hsl(var(--ring))',
					invalid: 'hsl(var(--foreground-danger))',
				},
				background: 'hsl(var(--background))',
				foreground: {
					DEFAULT: 'hsl(var(--foreground))',
					danger: 'hsl(var(--foreground-danger))',
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				brand: {
					'500': '#6B45FF',
					'800': '#5430BB',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			fontFamily: {
				sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
				rainbow: ['Over the Rainbow', ...defaultTheme.fontFamily.sans],
			},
			fontSize: {
				// 1rem = 16px
				/** 80px size / 84px high / bold */
				mega: ['5rem', { lineHeight: '5.25rem', fontWeight: '700' }],
				/** 56px size / 62px high / bold */
				h1: ['3.5rem', { lineHeight: '3.875rem', fontWeight: '700' }],
				/** 40px size / 48px high / bold */
				h2: ['2.5rem', { lineHeight: '3rem', fontWeight: '700' }],
				/** 32px size / 36px high / bold */
				h3: ['2rem', { lineHeight: '2.25rem', fontWeight: '700' }],
				/** 28px size / 36px high / bold */
				h4: ['1.75rem', { lineHeight: '2.25rem', fontWeight: '700' }],
				/** 24px size / 32px high / bold */
				h5: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
				/** 16px size / 20px high / bold */
				h6: ['1rem', { lineHeight: '1.25rem', fontWeight: '700' }],

				/** 32px size / 36px high / normal */
				'body-2xl': ['2rem', { lineHeight: '2.25rem' }],
				/** 28px size / 36px high / normal */
				'body-xl': ['1.75rem', { lineHeight: '2.25rem' }],
				/** 24px size / 32px high / normal */
				'body-lg': ['1.5rem', { lineHeight: '2rem' }],
				/** 20px size / 28px high / normal */
				'body-md': ['1.25rem', { lineHeight: '1.75rem' }],
				/** 16px size / 20px high / normal */
				'body-sm': ['1rem', { lineHeight: '1.25rem' }],
				/** 14px size / 18px high / normal */
				'body-xs': ['0.875rem', { lineHeight: '1.125rem' }],
				/** 12px size / 16px high / normal */
				'body-2xs': ['0.75rem', { lineHeight: '1rem' }],

				/** 18px size / 24px high / semibold */
				caption: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
				/** 12px size / 16px high / bold */
				button: ['0.75rem', { lineHeight: '1rem', fontWeight: '700' }],
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
				rainbow: {
					'0%': {
						filter: 'hue-rotate(0deg) brightness(1)',
					},
					'50%': {
						filter: 'hue-rotate(180deg) brightness(1.25)',
					},
					'100%': {
						filter: 'hue-rotate(360deg) brightness(1)',
					},
				},
				'rainbow-text': {
					'0%, 100%': {
						'background-size': '200% 200%',
						'background-position': 'left center',
					},
					'50%': {
						'background-size': '200% 200%',
						'background-position': 'right center',
					},
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'rainbow-icon': 'rainbow 8s linear infinite',
				'rainbow-text': 'rainbow-text 4s linear infinite',
			},
			backgroundImage: {
				'rainbow-text': 'linear-gradient(to right, #6366f1, #ec4899, #6366f1)',
			},
			typography: {
				DEFAULT: {
				css: {
					maxWidth: '70ch',
					h1: { fontWeight: '800', letterSpacing: '-0.02em' },
					h2: { fontWeight: '700', letterSpacing: '-0.01em', marginTop: '2.2em' },
					h3: { fontWeight: '700' },
					a: { color: '#2563eb', fontWeight: '500' },
					'a:hover': { color: '#6A95F1'},
					blockquote: {
					borderLeftColor: 'hsl(221 83% 53%)',
					background: 'hsl(220 14% 97%)',
					padding: '1rem 1.25rem',
					borderRadius: '0.75rem',
					},
					table: { width: '100%', tableLayout: 'auto' },
					'th, td': { padding: '0.5rem 0.75rem', borderBottom: '1px solid hsl(220 13% 90%)' },
					'thead th': { borderBottomWidth: '2px' },
					hr: { borderColor: 'hsl(220 13% 90%)' },
					'code::before': { content: 'none' },
					'code::after': { content: 'none' },
					code: {
					background: 'hsl(220 14% 96%)',
					padding: '0.15rem 0.35rem',
					borderRadius: '0.375rem',
					},
					'ul > li, ol > li': { marginTop: '0.4em', marginBottom: '0.4em' },
				},
				},
				invert: {
				css: {
					'--tw-prose-body': 'hsl(220 13% 91%)',
					'--tw-prose-headings': 'white',
					'--tw-prose-links': 'hsl(217 91% 60%)',
					'--tw-prose-quotes': 'hsl(220 13% 91%)',
					'--tw-prose-hr': 'hsl(215 14% 25%)',
					'--tw-prose-code': 'hsl(220 13% 91%)',
					'--tw-prose-th-borders': 'hsl(215 14% 25%)',
					'--tw-prose-td-borders': 'hsl(215 14% 25%)',
					blockquote: { background: 'hsl(215 14% 18%)' },
					code: { background: 'hsl(215 14% 18%)' },
				},
				},
			},
			},
		},
	plugins: [
		animatePlugin,
		radixPlugin,
		typography,
		lineClamp,
		function ({ addUtilities }: { addUtilities: (utilities: Record<string, any>) => void }) {
			addUtilities({
				'.bg-clip-text': {
					'-webkit-background-clip': 'text',
					'background-clip': 'text',
				},
				'.text-fill-transparent': {
					'-webkit-text-fill-color': 'transparent',
				},
			})
		},
	],
} satisfies Config
