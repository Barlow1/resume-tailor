/**
 * /reverse-recruiter: the money page for the reverse-recruiter category.
 *
 * SEO skeleton is load-bearing: single h1 ("Your AI Reverse Recruiter"),
 * the ten locked h2s in order, and FAQPage JSON-LD rendered from the same
 * FAQS array as the visible accordion.
 *
 * Design: "the dossier". Dark ops-room for the buying path (heavy Nunito
 * display, mono for anything that reads as data), a flip to warm paper with
 * serif prose for the educational block + FAQ, then back to dark to close.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
	type LinksFunction,
} from '@remix-run/node'
import { useLoaderData, Link } from '@remix-run/react'
import { trackCtaClick } from '~/lib/analytics.client.ts'

const PAGE_URL = 'https://resumetailor.ai/reverse-recruiter'
const PAGE_TITLE = 'AI Reverse Recruiter That Finds & Applies to Jobs | Resume Tailor'
const PAGE_DESCRIPTION =
	'A reverse recruiter works for you, not the employer. Resume Tailor finds high-match roles, tailors your resume for each one, and applies on your behalf.'
const OG_IMAGE = 'https://resumetailor.ai/og/reverse-recruiter-og.png'

export const meta: MetaFunction = () => [
	{ title: PAGE_TITLE },
	{ name: 'description', content: PAGE_DESCRIPTION },
	{ tagName: 'link', rel: 'canonical', href: PAGE_URL },
	{ property: 'og:type', content: 'website' },
	{ property: 'og:url', content: PAGE_URL },
	{ property: 'og:title', content: PAGE_TITLE },
	{ property: 'og:description', content: PAGE_DESCRIPTION },
	{ property: 'og:image', content: OG_IMAGE },
	{ property: 'og:image:width', content: '1200' },
	{ property: 'og:image:height', content: '630' },
	{
		property: 'og:image:alt',
		content: 'Your AI Reverse Recruiter, from Resume Tailor',
	},
	{ name: 'twitter:card', content: 'summary_large_image' },
	{ name: 'twitter:title', content: PAGE_TITLE },
	{ name: 'twitter:description', content: PAGE_DESCRIPTION },
	{ name: 'twitter:image', content: OG_IMAGE },
]

export const links: LinksFunction = () => [
	// The LCP element is the 900-weight h1; get the font connection warm
	// before the stylesheet resolves.
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
	{
		rel: 'stylesheet',
		// Only the five weights the page actually sets. No italics: the two
		// italic moments on the page are Georgia, not Nunito.
		href: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800;900&display=swap',
	},
]

export async function loader({ request }: LoaderFunctionArgs) {
	// Payment link with the 7-day free trial attached (verified 8/7/2026:
	// "7 days free, then $99.00/month", $0.00 due today). The old no-trial
	// link ended in 5Rm01; deactivate it in Stripe so stale tabs cannot
	// check out at full price on day one.
	const checkoutUrl =
		process.env.STRIPE_AGENT_CHECKOUT_URL || 'https://buy.stripe.com/00w7sM0ubeMi3fw9zl5Rm02'

	return json(
		{ checkoutUrl },
		{
			headers: {
				'Cache-Control': 'public, max-age=3600',
			},
		},
	)
}

/**
 * TODO(brayan): verify before submitting this URL to Search Console.
 * This is the price band traditional (human) reverse-recruiting services
 * advertise, and we quote it on the page as the anchor against our $99/mo.
 * Pull 3–4 live competitor pricing pages and confirm the range still holds.
 * A stale number on a commercial page is worse than no number.
 */
const TRADITIONAL_PRICE_RANGE = '$1,500 to $6,000'

const JOBS = [
	{
		company: 'Stripe',
		role: 'Senior Product Designer',
		match: 94,
		tags: ['Remote', '$180-220k', 'Fintech'],
		why: 'Your payments experience at Square plus design systems work is a direct match.',
	},
	{
		company: 'Vercel',
		role: 'Staff Frontend Engineer',
		match: 91,
		tags: ['Hybrid NYC', '$190-240k', 'DevTools'],
		why: 'Your React + performance optimization background aligns perfectly with their core product.',
	},
	{
		company: 'Linear',
		role: 'Product Engineer',
		match: 88,
		tags: ['Remote', '$160-200k', 'B2B SaaS'],
		why: 'Full-stack skills and your passion for developer tools make this a strong fit.',
	},
	{
		company: 'Figma',
		role: 'Design Engineer',
		match: 92,
		tags: ['SF / Remote', '$175-215k', 'Design Tools'],
		why: 'Rare combination of design + engineering skills matches their cross-functional team.',
	},
	{
		company: 'Notion',
		role: 'Senior Engineer, AI',
		match: 85,
		tags: ['SF Hybrid', '$185-230k', 'Productivity'],
		why: 'Your ML coursework and production React experience fit their AI features team.',
	},
]

/**
 * Proof bar data. One honest number beats three fillers: the earlier
 * "1 resume per role" and "100% approved by you" entries were features
 * dressed as stats, and they taught readers to discount the real one.
 * The moment reverse-recruiter outcome stats exist (roles sourced,
 * applications submitted, interview requests), add them here and the bar
 * redraws itself as a multi-column grid.
 */
const PROOF_STATS: Array<{ value: string; count?: number; label: string }> = [
	{ value: '16,000', count: 16000, label: 'resumes tailored so far' },
]

const PAIN_POINTS = [
	'2 hours rewriting your resume for every application',
	'Scrolling job boards endlessly, saving tabs you never revisit',
	'Copy-pasting into broken ATS forms that destroy your formatting',
	'Dozens of generic applications with little to show for it. Repeat.',
	'Doing all of this while working full-time or financially stressed',
]

const RELIEF_POINTS = [
	'Your reverse recruiter finds high-match roles for your experience and goals',
	'Each resume custom-built for the specific job, ATS-optimized every time',
	'You review matches and swipe yes or no. That is your whole job',
	'Polished applications submitted on your behalf',
	"You show up when there's an interview. Nothing else.",
]

const STEPS = [
	{
		title: 'Tell us who you are',
		body: 'Upload your resume and tell us what you want: roles, companies, locations, salary range. Takes 5 minutes, once.',
	},
	{
		title: 'Swipe on your matches',
		body: 'Every week you get 10–15 high-quality roles that actually fit your experience. Swipe yes on the ones you want. Skip the rest.',
	},
	{
		title: 'We apply for you',
		body: "For every role you approve, we tailor your resume, fill out the application, and submit it. You get notified when it's done.",
	},
]

const FEATURES = [
	{
		icon: 'target',
		title: 'Curated matching',
		body: '10–15 roles weekly, selected for your skills, goals, and preferences. No spray and pray.',
	},
	{
		icon: 'doc',
		title: 'Auto-tailored resumes',
		body: 'Each application gets a custom resume. Right keywords, right structure, ATS-ready.',
	},
	{
		icon: 'send',
		title: 'We apply for you',
		body: 'We submit polished applications on your behalf. You just approve and wait.',
	},
	{
		icon: 'board',
		title: 'Application dashboard',
		body: 'Track every application, status update, and response in one place. No more spreadsheets.',
	},
	{
		icon: 'gauge',
		title: 'ATS scoring',
		body: 'See exactly how each resume scores against the job. Keywords matched, gaps flagged, 0–100.',
	},
	{
		icon: 'layers',
		title: 'Full Resume Tailor access',
		body: 'Includes the complete builder, manual tailoring, and unlimited resume versions.',
	},
] as const

/**
 * Testimonial slot. Today it holds builder proof (flagged in the brief).
 * The moment a reverse-recruiter story lands, swap the quote and fill
 * `pipeline`; a sourced/approved/submitted/interviews strip renders
 * automatically under the attribution.
 */
const TESTIMONIAL = {
	eyebrow: 'From a Resume Tailor builder member',
	quote:
		'"I was mass-applying with the same resume for months. After tailoring with Resume Tailor, I got 3 interview callbacks in my first week."',
	name: 'Sarah M.',
	role: 'Product Designer',
	outcome: 'Hired at a Series B startup',
	pipeline: null as null | Array<{ label: string; value: string }>,
}

/**
 * Single source of truth for the FAQ: renders the accordion AND the
 * FAQPage JSON-LD, so the structured data can never drift from what a
 * human actually sees on the page (which is what Google requires).
 */
const FAQS = [
	{
		q: 'What is a reverse recruiter?',
		a: "A traditional recruiter is hired and paid by an employer, so their client is the company. You are the product. A reverse recruiter is hired by the job seeker. You are the client. They source roles that fit you, position your experience for each one, and handle the application legwork on your behalf.",
	},
	{
		q: 'How much does a reverse recruiter cost?',
		a: `Traditional reverse recruiting services typically run ${TRADITIONAL_PRICE_RANGE} for a multi-month engagement, because a human does every hour of the work. Resume Tailor is ${'$'}99 a month, cancel anytime, and your first week is free. The AI does the volume. A human reviews the matches.`,
	},
	{
		q: 'Is reverse recruiting worth it?',
		a: "It depends on what your time is worth. A tailored application takes most people 45–90 minutes. Apply to 10 roles a month and that is a part-time job on top of your actual job. Reverse recruiting is worth it when your search costs you more than the service does.",
	},
	{
		q: 'Is this a reverse recruiting agency?',
		a: "Not in the traditional sense. An agency assigns you a human career strategist at agency prices. We are an AI reverse recruiter. Software does the sourcing and resume tailoring at volume, and a person reviews every match before it reaches you. Same job, different cost structure.",
	},
	{
		q: "How is this different from Resume Tailor's builder?",
		a: 'The builder is a self-serve tool. You tailor resumes yourself. The reverse recruiter is done for you. We find roles, tailor your resume for each one, and submit applications on your behalf. You just approve matches.',
	},
	{
		q: 'How do you find job matches?',
		a: 'We combine AI matching with human curation. We scan listings across company career pages, job boards, and ATS platforms, then cut to the 10–15 that fit your skills, preferences, and goals each week.',
	},
	{
		q: 'Do you actually apply, or just prepare materials?',
		a: "We actually apply. When you approve a match, we tailor the resume, fill out the application, and submit it. You get a notification when it is done, with a record in your dashboard.",
	},
	{
		q: "What is the difference between a reverse recruiter and a career coach?",
		a: 'A career coach advises you on interview prep, positioning, and negotiation. You still do the searching and applying. A reverse recruiter does the work: sourcing roles, tailoring resumes, submitting applications. Coaching changes how you search. Reverse recruiting removes the searching.',
	},
	{
		q: 'What if I find a job quickly?',
		a: "That is the goal. Cancel anytime. No contracts, no fees. If we help you land a role in month one, you spent $99 instead of months of your own time.",
	},
	{
		q: 'Why only 50 members?',
		a: "Quality. A person reviews every match. We would rather send 15 great matches than 100 mediocre ones. We will add capacity as we grow, but right now fewer members means better results for each one.",
	},
	{
		q: 'Is my data private?',
		a: 'Yes. Your resume and personal information are never shared with third parties. We use your data only to find and apply to jobs on your behalf. You can delete everything at any time.',
	},
]

const structuredData = {
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'Service',
			'@id': `${PAGE_URL}#service`,
			name: 'Resume Tailor AI Reverse Recruiter',
			serviceType: 'Reverse recruiting',
			description: PAGE_DESCRIPTION,
			url: PAGE_URL,
			areaServed: 'US',
			audience: { '@type': 'Audience', audienceType: 'Job seekers' },
			provider: {
				'@type': 'Organization',
				name: 'Resume Tailor',
				url: 'https://resumetailor.ai/',
			},
			offers: {
				'@type': 'Offer',
				price: '99',
				priceCurrency: 'USD',
				url: PAGE_URL,
				availability: 'https://schema.org/LimitedAvailability',
			},
		},
		{
			'@type': 'FAQPage',
			'@id': `${PAGE_URL}#faq`,
			mainEntity: FAQS.map(({ q, a }) => ({
				'@type': 'Question',
				name: q,
				acceptedAnswer: { '@type': 'Answer', text: a },
			})),
		},
	],
}

/**
 * Card stack rest positions. The CSS below is generated from this array and
 * the drag code interpolates between neighboring slots, so JS and CSS can
 * never disagree about where a card sits.
 */
/**
 * Under-cards stay near-opaque: these are dark cards on a dark canvas, so an
 * opacity fade makes the stack invisible. Depth comes from offset + scale,
 * with a slight dim, and the peeking edges keep their hairline borders.
 */
const SLOTS = [
	{ scale: 1, y: 0, opacity: 1 },
	{ scale: 0.96, y: 24, opacity: 0.92 },
	{ scale: 0.92, y: 48, opacity: 0.65 },
]

const slotCss = SLOTS.map(
	(s, i) => `
  .rr-card[data-slot="${i}"] {
    transform: translate3d(0, ${s.y}px, 0) scale(${s.scale});
    opacity: ${s.opacity};
  }`,
).join('\n')

const pageStyles = `
  .rr {
    --ink: #0B0C10;
    --ink-2: #101118;
    --ink-3: #14151D;
    --line: rgba(255,255,255,0.08);
    --line-soft: rgba(255,255,255,0.045);
    --brand: #6B45FF;
    --brand-hi: #8B6AFF;
    --brand-soft: #B4A2FF;
    --brand-dim: rgba(107,69,255,0.12);
    --text: #F4F4F7;
    --text-2: #A9AAB6;
    --text-3: #7C7E8C;
    --good: #46D68C;
    --good-dim: rgba(70,214,140,0.12);
    --bad: #F26D6D;
    --bad-dim: rgba(242,109,109,0.10);
    --paper: #F4F1E9;
    --paper-line: rgba(23,20,35,0.14);
    --paper-ink: #191722;
    --paper-body: #3A3844;
    --paper-mut: #6E6B78;
    --brand-paper: #4F2EE8;
    --mono: 'Cascadia Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: 'Nunito Sans', -apple-system, 'Segoe UI', sans-serif;
    --serif: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    --spring: cubic-bezier(0.22, 1, 0.36, 1);
  }

  .rr, .rr * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  .rr ::selection { background: rgba(107,69,255,0.4); color: #fff; }
  .rr-paper ::selection { background: rgba(79,46,232,0.2); color: var(--paper-ink); }
  .rr :is(a, button):focus-visible {
    outline: 2px solid var(--brand-hi);
    outline-offset: 3px;
  }
  .rr-paper :is(a, button):focus-visible { outline-color: var(--brand-paper); }

  .rr-wrap { max-width: 1140px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 48px); }

  /* ---------- shared type ---------- */
  .rr-eyebrow {
    display: flex; align-items: center; gap: 12px;
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--brand-soft);
  }
  .rr-eyebrow::before { content: ''; width: 20px; height: 1px; background: var(--brand); flex-shrink: 0; }
  .rr-h2 {
    font-family: var(--sans);
    font-size: clamp(34px, 4.8vw, 56px);
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1.02;
    color: var(--text);
    margin-top: 20px;
  }
  .rr-sub {
    font-size: 17px; line-height: 1.65;
    color: var(--text-2);
    max-width: 540px;
    margin-top: 18px;
  }
  .rr-sec { padding: clamp(96px, 12vw, 150px) 0 0; }
  .rr-sec-head { max-width: 720px; }

  /* ---------- scroll reveal ----------
     Gated behind .rr-js, which the reveal effect adds right before it starts
     observing. If JS never runs (failed bundle, bot, saved page), nothing is
     ever hidden: the reveal is an enhancement, not a dependency. */
  .rr-js .rr-fade {
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 0.7s var(--spring), transform 0.7s var(--spring);
  }
  .rr-js .rr-fade.rr-in { opacity: 1; transform: translateY(0); }
  .rr-d1 { transition-delay: 0.07s; }
  .rr-d2 { transition-delay: 0.14s; }
  .rr-d3 { transition-delay: 0.21s; }
  .rr-d4 { transition-delay: 0.28s; }

  /* ---------- nav ---------- */
  .rr-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    height: 64px;
    padding: 0 clamp(20px, 4vw, 40px);
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(11, 12, 16, 0);
    border-bottom: 1px solid transparent;
    transition: background 0.35s ease, border-color 0.35s ease, backdrop-filter 0.35s ease;
  }
  .rr-nav.is-scrolled {
    background: rgba(11, 12, 16, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom-color: var(--line);
  }
  .rr-nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-size: 15px; font-weight: 800; letter-spacing: -0.01em;
    color: var(--text); text-decoration: none;
  }
  /* The mark ships as dark artwork; invert it for the dark canvas. */
  .rr-nav-mark { height: 24px; width: auto; display: block; filter: brightness(0) invert(1); }
  .rr-nav-links { display: flex; align-items: center; gap: 28px; }
  .rr-nav-link {
    font-size: 14px; color: var(--text-2); text-decoration: none;
    transition: color 0.2s;
  }
  .rr-nav-link:hover { color: var(--text); }
  .rr-nav-cta {
    padding: 9px 18px; border-radius: 8px;
    background: var(--brand); color: #fff;
    font-size: 13px; font-weight: 800; text-decoration: none;
    transition: background 0.2s, transform 0.2s;
  }
  .rr-nav-cta:hover { background: var(--brand-hi); transform: translateY(-1px); }

  /* ---------- sticky bottom bar ---------- */
  .rr-stickybar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 999;
    padding: 14px clamp(20px, 4vw, 40px);
    display: flex; align-items: center; justify-content: center; gap: 20px;
    background: rgba(11, 12, 16, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid var(--line);
    transform: translateY(110%);
    /* visibility keeps the hidden bar out of the tab order and away from
       screen readers; it flips after the slide-out finishes. */
    visibility: hidden;
    transition: transform 0.5s var(--spring), visibility 0.5s;
  }
  .rr-stickybar.rr-on { transform: translateY(0); visibility: visible; }
  .rr-stickytext { font-size: 14px; color: var(--text-2); }
  .rr-stickytext strong { color: var(--text); font-weight: 800; }
  .rr-stickycta {
    padding: 10px 22px; border-radius: 8px;
    background: var(--brand); color: #fff;
    font-size: 14px; font-weight: 800; text-decoration: none;
    white-space: nowrap;
    transition: background 0.2s;
  }
  .rr-stickycta:hover { background: var(--brand-hi); }

  /* ---------- hero ---------- */
  .rr-hero {
    position: relative;
    padding: clamp(150px, 20vh, 220px) 0 clamp(80px, 10vw, 120px);
    overflow: hidden;
  }
  .rr-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(to right, var(--line-soft) 0 1px, transparent 1px 228px);
    -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 88%);
    mask-image: linear-gradient(to bottom, black 0%, transparent 88%);
    pointer-events: none;
  }
  .rr-hero::after {
    content: '';
    position: absolute; top: -240px; left: -140px;
    width: 720px; height: 720px;
    background: radial-gradient(circle, rgba(107,69,255,0.13) 0%, transparent 62%);
    pointer-events: none;
  }
  .rr-hero .rr-wrap { position: relative; z-index: 1; }
  .rr-pill {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 8px 16px;
    border: 1px solid rgba(107,69,255,0.35);
    border-radius: 100px;
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--brand-soft);
    background: rgba(107,69,255,0.07);
  }
  .rr-pill-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--brand-hi);
    animation: rrPulse 2.6s ease infinite;
  }
  @keyframes rrPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(107,69,255,0.45); }
    50% { opacity: 0.55; box-shadow: 0 0 0 7px rgba(107,69,255,0); }
  }
  .rr-h1 {
    margin-top: 36px;
    font-family: var(--sans);
    font-size: clamp(44px, 9.4vw, 110px);
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 0.96;
    color: var(--text);
    max-width: 900px;
  }
  .rr-h1-soft { color: var(--text-3); }
  .rr-tagline {
    margin-top: 30px;
    font-family: var(--sans);
    font-size: clamp(21px, 3vw, 30px);
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.25;
    color: var(--text);
    max-width: 640px;
  }
  .rr-herosub {
    margin-top: 18px;
    font-size: clamp(16px, 2vw, 18px);
    line-height: 1.65;
    color: var(--text-2);
    max-width: 520px;
  }
  .rr-ctas {
    margin-top: 44px;
    display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
  }
  .rr-btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 17px 34px;
    border: none; border-radius: 10px;
    background: var(--brand); color: #fff;
    font-family: var(--sans);
    font-size: 16px; font-weight: 800;
    text-decoration: none; cursor: pointer;
    transition: background 0.22s, transform 0.22s var(--spring), box-shadow 0.22s;
    box-shadow: 0 1px 0 rgba(255,255,255,0.14) inset, 0 10px 34px rgba(107,69,255,0.28);
  }
  .rr-btn:hover {
    background: var(--brand-hi);
    transform: translateY(-2px);
    box-shadow: 0 1px 0 rgba(255,255,255,0.14) inset, 0 16px 44px rgba(107,69,255,0.36);
  }
  .rr-btn-arrow { transition: transform 0.2s; }
  .rr-btn:hover .rr-btn-arrow { transform: translateX(3px); }
  .rr-note {
    font-family: var(--mono);
    font-size: 12px; letter-spacing: 0.02em;
    color: var(--text-3);
  }
  .rr-sec-cta { margin-top: 48px; }
  /* Paper variant: deeper purple for contrast on the light canvas. */
  .rr-btn--paper {
    background: var(--brand-paper);
    box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 10px 30px rgba(79,46,232,0.22);
  }
  .rr-btn--paper:hover {
    background: #5C3DF5;
    box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 14px 36px rgba(79,46,232,0.3);
  }
  .rr-paper-cta {
    margin-top: clamp(48px, 6vw, 72px);
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  }
  .rr-paper-cta-note {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--paper-mut);
  }

  /* ---------- proof bar ---------- */
  .rr-proof {
    margin-top: clamp(64px, 9vw, 110px);
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .rr-proof-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  }
  .rr-proof-item { padding: 42px 36px; }
  .rr-proof-item + .rr-proof-item { border-left: 1px solid var(--line); }
  .rr-proof-num {
    font-family: var(--mono);
    font-size: clamp(34px, 4vw, 46px);
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--text);
  }
  .rr-proof-label {
    margin-top: 10px;
    font-size: 13px; line-height: 1.5;
    color: var(--text-3);
    max-width: 220px;
  }
  /* Single-stat mode: one honest number, read as a sentence. */
  .rr-proof--solo .rr-proof-item {
    display: flex; align-items: baseline; justify-content: center;
    gap: 14px; flex-wrap: wrap;
    padding: 36px 24px;
  }
  .rr-proof--solo .rr-proof-label {
    margin-top: 0; max-width: none;
    font-size: 15px; color: var(--text-2);
  }

  /* ---------- problem vs solution ---------- */
  .rr-versus {
    display: grid; grid-template-columns: 1fr 1fr; gap: 22px;
    margin-top: clamp(48px, 6vw, 72px);
  }
  .rr-vcard {
    border-radius: 16px;
    padding: clamp(30px, 4vw, 46px) clamp(24px, 3.4vw, 40px);
  }
  .rr-vcard--old {
    background: var(--ink-2);
    border: 1px solid var(--line);
  }
  .rr-vcard--new {
    background: linear-gradient(170deg, rgba(107,69,255,0.10) 0%, rgba(107,69,255,0.02) 100%);
    border: 1px solid rgba(107,69,255,0.32);
  }
  .rr-vtag {
    font-family: var(--mono);
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
  }
  .rr-vcard--old .rr-vtag { color: var(--text-3); }
  .rr-vcard--new .rr-vtag { color: var(--brand-soft); }
  .rr-vtitle {
    margin-top: 12px; margin-bottom: 20px;
    font-family: var(--sans);
    font-size: clamp(21px, 2.4vw, 26px);
    font-weight: 800; letter-spacing: -0.02em;
  }
  .rr-vcard--old .rr-vtitle { color: var(--text-3); }
  .rr-vcard--new .rr-vtitle { color: var(--text); }
  .rr-vrow {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 14px 0;
    font-size: 15px; line-height: 1.55;
  }
  .rr-vrow + .rr-vrow { border-top: 1px solid var(--line); }
  .rr-vcard--new .rr-vrow + .rr-vrow { border-top-color: rgba(107,69,255,0.14); }
  .rr-vcard--old .rr-vrow { color: var(--text-3); }
  .rr-vcard--new .rr-vrow { color: var(--text-2); }
  .rr-vic {
    flex-shrink: 0;
    width: 24px; height: 24px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono);
    font-size: 13px; font-weight: 700;
    margin-top: 1px;
  }
  .rr-vic--bad { background: var(--bad-dim); color: var(--bad); }
  .rr-vic--good { background: var(--good-dim); color: var(--good); }

  /* ---------- swipe demo ---------- */
  .rr-demo {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
    padding-left: 20px; padding-right: 20px;
  }
  .rr-demo .rr-eyebrow { justify-content: center; }
  .rr-deck {
    position: relative;
    width: 400px; max-width: 100%;
    height: 430px;
    margin-top: 44px;
    /* Room for the under-card peek below the top card. */
    margin-bottom: 48px;
  }
  .rr-card {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    padding: 32px 30px;
    border-radius: 18px;
    background: linear-gradient(180deg, #17181F 0%, var(--ink-3) 34%);
    border: 1px solid var(--line);
    box-shadow: 0 24px 70px rgba(0,0,0,0.55);
    user-select: none;
    -webkit-user-select: none;
    touch-action: pan-y;
    will-change: transform;
    overflow: hidden;
    transition: transform 0.55s var(--spring), opacity 0.45s ease;
    animation: rrDeal 0.6s var(--spring) backwards;
  }
${slotCss}
  @keyframes rrDeal {
    from { opacity: 0; transform: translate3d(0, 56px, 0) scale(0.88); }
  }
  .rr-card[data-top] { cursor: grab; }
  .rr-card[data-top]:active { cursor: grabbing; }
  .rr-stamp {
    position: absolute; top: 26px; z-index: 6;
    padding: 7px 16px;
    border: 3px solid; border-radius: 8px;
    font-family: var(--mono);
    font-size: 21px; font-weight: 700; letter-spacing: 0.22em;
    opacity: 0;
    pointer-events: none;
  }
  .rr-stamp--apply {
    left: 22px;
    border-color: var(--good); color: var(--good);
    transform: rotate(-12deg);
  }
  .rr-stamp--skip {
    right: 22px;
    border-color: var(--bad); color: var(--bad);
    transform: rotate(12deg);
  }
  .rr-cglow {
    position: absolute; inset: 0; z-index: 0;
    border-radius: 18px;
    opacity: 0;
    pointer-events: none;
  }
  .rr-ctop {
    display: flex; justify-content: space-between; align-items: center;
    position: relative; z-index: 1;
  }
  .rr-cco {
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--text-3);
  }
  .rr-cmatch {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 12px; border-radius: 100px;
    background: var(--brand-dim);
    border: 1px solid rgba(107,69,255,0.28);
    font-family: var(--mono);
    font-size: 12px; font-weight: 600;
    color: var(--brand-soft);
  }
  .rr-cmatch-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--brand-hi); }
  .rr-crole {
    margin-top: 18px;
    font-family: var(--sans);
    font-size: 27px; font-weight: 800;
    letter-spacing: -0.02em; line-height: 1.12;
    color: var(--text);
    text-align: left;
    position: relative; z-index: 1;
  }
  .rr-ctags {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-top: 16px;
    position: relative; z-index: 1;
  }
  .rr-ctag {
    padding: 5px 12px; border-radius: 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-2);
  }
  .rr-cwhy {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--line);
    text-align: left;
    position: relative; z-index: 1;
  }
  .rr-cwhy-label {
    font-family: var(--mono);
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 8px;
  }
  .rr-cwhy-text { font-size: 14px; line-height: 1.55; color: var(--text-2); }

  .rr-deck-done {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 10px;
    border: 1px dashed var(--line);
    border-radius: 18px;
    animation: rrPop 0.5s var(--spring);
  }
  @keyframes rrPop {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .rr-done-title {
    font-family: var(--sans);
    font-size: 24px; font-weight: 800; letter-spacing: -0.02em;
    color: var(--text);
  }
  .rr-done-sub { font-size: 14px; color: var(--text-2); }
  .rr-again {
    margin-top: 16px;
    padding: 11px 26px;
    border: 1px solid var(--line); border-radius: 100px;
    background: rgba(255,255,255,0.04);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px; font-weight: 700;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .rr-again:hover { border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.07); }
  .rr-done-link {
    margin-top: 6px;
    font-size: 14px; font-weight: 700;
    color: var(--brand-soft); text-decoration: none;
  }
  .rr-done-link:hover { color: #fff; }

  .rr-actions {
    display: flex; justify-content: center; gap: 22px;
    margin-top: 30px;
  }
  .rr-act {
    width: 60px; height: 60px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; line-height: 1;
    cursor: pointer;
    transition: transform 0.25s var(--spring), background 0.2s, opacity 0.3s;
  }
  .rr-act:disabled { opacity: 0.25; cursor: default; }
  .rr-act--skip {
    background: var(--bad-dim);
    border: 1.5px solid rgba(242,109,109,0.35);
    color: var(--bad);
  }
  .rr-act--skip:hover:not(:disabled) { transform: scale(1.1); background: rgba(242,109,109,0.2); }
  .rr-act--apply {
    background: var(--good-dim);
    border: 1.5px solid rgba(70,214,140,0.35);
    color: var(--good);
    font-size: 24px;
  }
  .rr-act--apply:hover:not(:disabled) { transform: scale(1.1); background: rgba(70,214,140,0.2); }
  .rr-hint { margin-top: 22px; font-size: 13px; color: var(--text-3); }
  .rr-hint span { color: var(--good); }
  .rr-count {
    margin-top: 10px;
    font-family: var(--mono);
    font-size: 11px; letter-spacing: 0.22em;
    color: rgba(255,255,255,0.38);
    min-height: 14px;
  }

  /* ---------- how it works ---------- */
  .rr-steps { margin-top: clamp(48px, 6vw, 72px); }
  .rr-step {
    display: grid; grid-template-columns: 96px 1fr; gap: 24px;
    padding: clamp(30px, 4vw, 44px) 0;
    border-top: 1px solid var(--line);
    align-items: start;
  }
  .rr-step:last-child { border-bottom: 1px solid var(--line); }
  .rr-step-num {
    font-family: var(--mono);
    font-size: clamp(26px, 3vw, 38px);
    font-weight: 500;
    color: var(--brand);
    line-height: 1.1;
  }
  .rr-step-body h3 {
    font-family: var(--sans);
    font-size: 21px; font-weight: 800; letter-spacing: -0.015em;
    color: var(--text);
    margin-bottom: 8px;
  }
  .rr-step-body p {
    font-size: 15px; line-height: 1.6;
    color: var(--text-2);
    max-width: 560px;
  }

  /* ---------- what's included ---------- */
  .rr-feats {
    display: grid; grid-template-columns: repeat(3, 1fr);
    margin-top: clamp(48px, 6vw, 72px);
    border: 1px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
    background: var(--ink-2);
  }
  .rr-feat {
    padding: clamp(28px, 3.4vw, 40px) clamp(22px, 3vw, 34px);
    box-shadow: -1px 0 0 var(--line), 0 -1px 0 var(--line);
    transition: background 0.3s;
  }
  .rr-feat:hover { background: var(--ink-3); }
  .rr-feat-ic {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--brand-dim);
    color: var(--brand-soft);
    margin-bottom: 18px;
  }
  .rr-feat h3 {
    font-family: var(--sans);
    font-size: 17px; font-weight: 800; letter-spacing: -0.01em;
    color: var(--text);
    margin-bottom: 8px;
  }
  .rr-feat p { font-size: 14px; line-height: 1.6; color: var(--text-2); }

  /* ---------- testimonial ---------- */
  .rr-quote-sec {
    max-width: 760px; margin: 0 auto;
    text-align: center;
  }
  .rr-quote-sec .rr-eyebrow { justify-content: center; }
  .rr-stars {
    margin-top: 26px;
    font-size: 17px; letter-spacing: 6px;
    color: #E8B44F;
  }
  .rr-quote {
    margin-top: 22px;
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(22px, 3.2vw, 30px);
    line-height: 1.5;
    color: var(--text);
  }
  .rr-attr { margin-top: 26px; font-size: 15px; color: var(--text-2); }
  .rr-attr strong { color: var(--text); font-weight: 800; }
  .rr-chip {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 14px;
    padding: 6px 16px; border-radius: 100px;
    background: var(--good-dim);
    font-family: var(--mono);
    font-size: 12px; font-weight: 600;
    color: var(--good);
  }
  .rr-pipeline {
    display: flex; justify-content: center; flex-wrap: wrap; gap: 10px;
    margin-top: 22px;
  }
  .rr-pipe-item {
    padding: 8px 14px;
    border: 1px solid var(--line); border-radius: 8px;
    font-family: var(--mono); font-size: 12px;
    color: var(--text-2);
  }
  .rr-pipe-item b { color: var(--text); font-weight: 700; }

  /* ---------- pricing ---------- */
  .rr-pricing { position: relative; }
  .rr-price-card {
    position: relative;
    display: grid; grid-template-columns: 1.05fr 1fr;
    gap: clamp(32px, 4vw, 56px);
    margin-top: clamp(44px, 6vw, 64px);
    padding: clamp(34px, 4.6vw, 56px);
    background: var(--ink-2);
    border: 1px solid rgba(107,69,255,0.28);
    border-radius: 20px;
    overflow: hidden;
  }
  .rr-price-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--brand), var(--brand-hi), transparent 80%);
  }
  .rr-price-card::after {
    content: '';
    position: absolute; top: -160px; left: -120px;
    width: 480px; height: 400px;
    background: radial-gradient(ellipse, rgba(107,69,255,0.14), transparent 68%);
    pointer-events: none;
  }
  .rr-price-left { position: relative; z-index: 1; display: flex; flex-direction: column; }
  .rr-price-tier {
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--brand-soft);
  }
  /* The anchor must be read BEFORE the $99, or it never anchors. Label in
     mono, the range big enough that the eye cannot skip it on the way down. */
  .rr-anchor {
    margin-top: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--line);
  }
  .rr-anchor-label {
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--text-3);
  }
  .rr-anchor-value {
    margin-top: 8px;
    font-family: var(--sans);
    font-size: clamp(22px, 2.6vw, 28px);
    font-weight: 800; letter-spacing: -0.02em;
    color: var(--text-2);
  }
  .rr-anchor-value span {
    font-size: 14px; font-weight: 400;
    color: var(--text-3);
    margin-left: 6px;
  }
  .rr-price-row {
    display: flex; align-items: baseline; gap: 14px;
    margin-top: 18px;
  }
  .rr-price {
    font-family: var(--sans);
    font-size: clamp(76px, 9vw, 116px);
    font-weight: 900;
    letter-spacing: -0.045em;
    line-height: 1;
    color: var(--text);
  }
  .rr-price-meta {
    font-family: var(--mono);
    font-size: 12px; line-height: 1.7;
    color: var(--text-2);
  }
  .rr-trial-pill {
    align-self: flex-start;
    display: inline-flex; align-items: center;
    margin-top: 18px; margin-bottom: 18px;
    padding: 7px 14px;
    border: 1px solid rgba(70,214,140,0.35);
    border-radius: 100px;
    background: var(--good-dim);
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--good);
  }
  .rr-pcta {
    display: block;
    margin-top: 0;
    padding: 17px 20px;
    border-radius: 10px;
    background: var(--brand); color: #fff;
    font-family: var(--sans);
    font-size: 16px; font-weight: 800;
    text-align: center; text-decoration: none;
    transition: background 0.22s, transform 0.22s var(--spring), box-shadow 0.22s;
    box-shadow: 0 1px 0 rgba(255,255,255,0.14) inset, 0 10px 34px rgba(107,69,255,0.26);
  }
  .rr-pcta:hover { background: var(--brand-hi); transform: translateY(-2px); }
  .rr-seats {
    display: flex; align-items: center; gap: 9px;
    margin-top: 18px;
    font-family: var(--mono);
    font-size: 12px; color: var(--text-2);
  }
  .rr-seat-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--brand-hi);
    animation: rrPulse 2.6s ease infinite;
  }
  .rr-guarantee {
    margin-top: 8px;
    font-family: var(--mono);
    font-size: 13px; color: var(--text-2);
  }
  .rr-price-feats {
    position: relative; z-index: 1;
    align-self: center;
    width: 100%;
  }
  .rr-pf {
    display: flex; align-items: center; gap: 14px;
    padding: 15px 0;
    font-size: 15px; color: var(--text-2);
  }
  .rr-pf + .rr-pf { border-top: 1px solid var(--line); }
  .rr-pf-check {
    flex-shrink: 0;
    width: 22px; height: 22px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    background: var(--brand-dim);
    font-family: var(--mono);
    font-size: 12px; font-weight: 700;
    color: var(--brand-soft);
  }

  /* ---------- paper (educational + FAQ) ---------- */
  .rr-paper {
    margin-top: clamp(96px, 12vw, 150px);
    background: var(--paper);
    color: var(--paper-body);
    padding: clamp(80px, 10vw, 130px) 0 clamp(72px, 9vw, 110px);
  }
  .rr-read { max-width: 720px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 40px); }
  .rr-eyebrow--paper { color: var(--brand-paper); }
  .rr-eyebrow--paper::before { background: var(--brand-paper); }
  .rr-learn h2 {
    font-family: var(--sans);
    font-size: clamp(28px, 3.8vw, 38px);
    font-weight: 900;
    letter-spacing: -0.025em;
    line-height: 1.1;
    color: var(--paper-ink);
    margin: clamp(56px, 7vw, 84px) 0 22px;
  }
  .rr-learn h2:first-of-type { margin-top: 34px; }
  .rr-learn p {
    font-family: var(--serif);
    font-size: 17.5px; line-height: 1.75;
    color: var(--paper-body);
  }
  .rr-learn p + p { margin-top: 18px; }
  .rr-learn strong { color: var(--paper-ink); font-weight: 700; }
  /* Prose links only ("p a", not "a"): the paper CTA button is also an
     anchor inside this block, and an unscoped rule paints its label
     brand-on-brand, which is unreadable. */
  .rr-learn p a {
    color: var(--brand-paper);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-thickness: 1px;
  }
  .rr-learn p a:hover { text-decoration-thickness: 2px; }
  /* The eyebrow is a p inside .rr-learn; win the specificity contest so it
     stays mono instead of inheriting the serif prose styling. */
  .rr-learn p.rr-eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }

  .rr-lsteps { margin-top: 28px; counter-reset: rr-lstep; }
  .rr-lstep {
    display: grid; grid-template-columns: 40px 1fr; gap: 14px;
    padding: 17px 0;
    border-top: 1px solid var(--paper-line);
  }
  .rr-lstep:last-child { border-bottom: 1px solid var(--paper-line); }
  .rr-lstep::before {
    counter-increment: rr-lstep;
    content: '0' counter(rr-lstep);
    font-family: var(--mono);
    font-size: 13px; font-weight: 600;
    color: var(--brand-paper);
    line-height: 2;
  }
  .rr-lstep div {
    font-family: var(--serif);
    font-size: 16.5px; line-height: 1.7;
    color: var(--paper-body);
  }
  .rr-lstep b { color: var(--paper-ink); font-weight: 700; }

  .rr-table {
    margin-top: 30px;
    border: 1px solid var(--paper-line);
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255,255,255,0.45);
  }
  .rr-trow {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    font-size: 14px; line-height: 1.5;
  }
  .rr-trow + .rr-trow { border-top: 1px solid var(--paper-line); }
  .rr-trow > * { padding: 14px 16px; }
  .rr-trow > * + * { border-left: 1px solid var(--paper-line); }
  .rr-trow--head {
    background: rgba(23,20,35,0.045);
    font-family: var(--mono);
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--paper-mut);
  }
  .rr-trow--head .rr-tmine { color: var(--brand-paper); }
  .rr-trow span { color: var(--paper-mut); }
  .rr-trow span.rr-tlabel { font-weight: 800; color: var(--paper-ink); font-family: var(--sans); }
  .rr-trow .rr-tmine {
    background: rgba(79,46,232,0.06);
    color: var(--paper-ink);
    font-weight: 600;
  }

  /* ---------- FAQ (on paper) ---------- */
  .rr-faq { max-width: 720px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 40px); }
  .rr-faq-title {
    font-family: var(--sans);
    font-size: clamp(30px, 4.2vw, 44px);
    font-weight: 900;
    letter-spacing: -0.025em;
    color: var(--paper-ink);
    margin: clamp(72px, 9vw, 110px) 0 26px;
  }
  .rr-faq-item { border-bottom: 1px solid var(--paper-line); }
  .rr-faq-item:first-of-type { border-top: 1px solid var(--paper-line); }
  .rr-faq-q {
    width: 100%;
    padding: 22px 0;
    display: flex; justify-content: space-between; align-items: center; gap: 20px;
    background: none; border: none;
    font-family: var(--sans);
    font-size: 16.5px; font-weight: 700;
    letter-spacing: -0.01em;
    text-align: left;
    color: var(--paper-ink);
    cursor: pointer;
    transition: color 0.2s;
  }
  .rr-faq-q:hover { color: var(--brand-paper); }
  .rr-faq-ic {
    flex-shrink: 0;
    font-family: var(--mono);
    font-size: 19px; font-weight: 400;
    color: var(--paper-mut);
    transition: transform 0.35s var(--spring), color 0.2s;
  }
  .rr-faq-item.open .rr-faq-ic { transform: rotate(45deg); color: var(--brand-paper); }
  /* 0fr -> 1fr grid animation: smooth open at any answer height, no clipping. */
  .rr-faq-a {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.45s var(--spring);
  }
  .rr-faq-item.open .rr-faq-a { grid-template-rows: 1fr; }
  /* visibility hides collapsed answers from screen readers (matching
     aria-expanded) while still animating: it flips only after the close
     transition ends. */
  .rr-faq-clip { overflow: hidden; min-height: 0; visibility: hidden; transition: visibility 0.45s; }
  .rr-faq-item.open .rr-faq-clip { visibility: visible; }
  .rr-faq-clip p {
    padding: 0 40px 24px 0;
    font-family: var(--serif);
    font-size: 16px; line-height: 1.7;
    color: var(--paper-body);
  }

  /* ---------- final CTA ---------- */
  .rr-final {
    position: relative;
    padding: clamp(110px, 14vw, 170px) 0;
    text-align: center;
    overflow: hidden;
  }
  .rr-final::before {
    content: '';
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 680px; height: 460px;
    background: radial-gradient(ellipse, rgba(107,69,255,0.13), transparent 65%);
    pointer-events: none;
  }
  .rr-final-h {
    position: relative;
    font-family: var(--sans);
    font-size: clamp(32px, 5vw, 54px);
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1.06;
    color: var(--text);
    max-width: 680px;
    margin: 0 auto;
  }
  .rr-final-sub {
    position: relative;
    margin-top: 20px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    color: var(--text-2);
  }
  .rr-final-btn { position: relative; margin-top: 40px; }

  /* ---------- footer ---------- */
  .rr-footer {
    border-top: 1px solid var(--line);
    padding: 30px clamp(20px, 4vw, 40px) 110px;
    display: flex; justify-content: space-between; align-items: center;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-3);
  }
  .rr-foot-links { display: flex; gap: 24px; }
  .rr-footer a { color: var(--text-3); text-decoration: none; transition: color 0.2s; }
  .rr-footer a:hover { color: var(--text); }

  /* ---------- responsive ---------- */
  @media (max-width: 960px) {
    .rr-feats { grid-template-columns: repeat(2, 1fr); }
    .rr-price-card { grid-template-columns: 1fr; }
    .rr-price-feats { align-self: start; }
  }
  @media (max-width: 768px) {
    .rr-nav-link { display: none; }
    .rr-versus { grid-template-columns: 1fr; }
    .rr-proof-grid { grid-template-columns: 1fr; }
    .rr-proof-item { padding: 28px 8px; }
    .rr-proof-item + .rr-proof-item { border-left: none; border-top: 1px solid var(--line); }
    .rr-step { grid-template-columns: 56px 1fr; gap: 16px; }
    .rr-feats { grid-template-columns: 1fr; }
    .rr-deck { height: 410px; }
    .rr-card { padding: 26px 22px; }
    .rr-crole { font-size: 24px; }
    .rr-trow { grid-template-columns: 1fr; }
    .rr-trow > * + * { border-left: none; border-top: 1px solid var(--paper-line); }
    .rr-trow--head { display: none; }
    /* With the head row hidden, the first visible row would double up
       against the table's own border. */
    .rr-trow--head + .rr-trow { border-top: none; }
    /* Stacked cards need their own row header, since the column
       headings are hidden. Only value cells carry data-col, so the
       label cell must not get a dangling separator. */
    .rr-trow .rr-tlabel {
      background: rgba(23,20,35,0.045);
      font-family: var(--mono);
      font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--paper-mut);
      padding-top: 10px; padding-bottom: 10px;
    }
    .rr-trow span[data-col]::before {
      content: attr(data-col) ': ';
      font-family: var(--mono);
      font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--paper-mut);
    }
    .rr-footer { flex-direction: column; gap: 14px; text-align: center; }
  }
  @media (max-width: 480px) {
    .rr-stickytext { display: none; }
    .rr-ctas { gap: 16px; }
    .rr-btn { width: 100%; justify-content: center; }
    .rr-pcta { width: 100%; }
  }

  /* ---------- reduced motion ---------- */
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .rr-fade { opacity: 1; transform: none; transition: none; }
    .rr-card { animation: none; transition: none; }
    .rr-pill-dot, .rr-seat-dot { animation: none; }
    .rr-stickybar { transition: none; }
    .rr-faq-a { transition: none; }
  }
`

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]['icon'] }) {
	const common = {
		width: 20,
		height: 20,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.7,
		strokeLinecap: 'round' as const,
		strokeLinejoin: 'round' as const,
		'aria-hidden': true,
	}
	switch (name) {
		case 'target':
			return (
				<svg {...common}>
					<circle cx="12" cy="12" r="8" />
					<circle cx="12" cy="12" r="3.2" />
					<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
				</svg>
			)
		case 'doc':
			return (
				<svg {...common}>
					<rect x="5" y="3" width="14" height="18" rx="2" />
					<path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
				</svg>
			)
		case 'send':
			return (
				<svg {...common}>
					<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3z" />
				</svg>
			)
		case 'board':
			return (
				<svg {...common}>
					<rect x="3" y="4" width="5" height="16" rx="1.2" />
					<rect x="9.5" y="4" width="5" height="10" rx="1.2" />
					<rect x="16" y="4" width="5" height="13" rx="1.2" />
				</svg>
			)
		case 'gauge':
			return (
				<svg {...common}>
					<path d="M4.5 16.5a8 8 0 1 1 15 0" />
					<path d="M12 16.5l3.6-6" />
					<circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
				</svg>
			)
		case 'layers':
			return (
				<svg {...common}>
					<path d="M12 3l9 5-9 5-9-5 9-5z" />
					<path d="M3 12.5l9 5 9-5" />
					<path d="M3 16.5l9 5 9-5" />
				</svg>
			)
	}
}

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
	const [open, setOpen] = useState(false)
	return (
		<div className={`rr-faq-item${open ? ' open' : ''}`}>
			<button
				className="rr-faq-q"
				id={`rr-faq-q-${idx}`}
				aria-expanded={open}
				aria-controls={`rr-faq-a-${idx}`}
				onClick={() => setOpen(o => !o)}
			>
				<span>{q}</span>
				<span className="rr-faq-ic" aria-hidden="true">
					+
				</span>
			</button>
			<div
				className="rr-faq-a"
				id={`rr-faq-a-${idx}`}
				role="region"
				aria-labelledby={`rr-faq-q-${idx}`}
			>
				<div className="rr-faq-clip">
					<p>{a}</p>
				</div>
			</div>
		</div>
	)
}

const FLY_MS_MIN = 240
const FLY_MS_MAX = 460

/**
 * The swipe deck. Transform ownership is deliberate:
 *  - At rest, position comes from the [data-slot] CSS rules only.
 *  - During a drag, inline styles override them (transition off).
 *  - On release we either spring back with a real integrator and then clear
 *    the inline styles, or fly out and promote the under-cards by
 *    rewriting data-slot, letting the class transition animate them.
 * React never writes transform, so there is nothing to fight.
 */
function SwipeDeck({ onEndCta }: { onEndCta: () => void }) {
	const { checkoutUrl } = useLoaderData<typeof loader>()
	const [topIdx, setTopIdx] = useState(0)
	const deckRef = useRef<HTMLDivElement>(null)
	const S = useRef({
		active: false,
		flying: false,
		pointerId: 0,
		sx: 0,
		sy: 0,
		dx: 0,
		dy: 0,
		grabMul: 1,
		hist: [] as Array<{ x: number; t: number }>,
		raf: 0,
	})

	useEffect(() => {
		const s = S.current
		return () => {
			if (s.raf) cancelAnimationFrame(s.raf)
		}
	}, [])

	const getCards = useCallback(() => {
		const deck = deckRef.current
		if (!deck) return []
		return Array.from(deck.querySelectorAll<HTMLElement>('.rr-card')).sort(
			(a, b) => Number(a.dataset.slot) - Number(b.dataset.slot),
		)
	}, [])

	const slotLerp = useCallback((i: number, p: number) => {
		const a = SLOTS[i]
		const b = SLOTS[i - 1] ?? SLOTS[0]
		return {
			scale: a.scale + (b.scale - a.scale) * p,
			y: a.y + (b.y - a.y) * p,
			opacity: a.opacity + (b.opacity - a.opacity) * p,
		}
	}, [])

	/** Paint the whole stack for a given top-card offset. */
	const paint = useCallback(
		(x: number, y: number) => {
			const cards = getCards()
			const top = cards[0]
			if (!top) return
			const s = S.current
			const rot = Math.max(-16, Math.min(16, x * 0.07)) * s.grabMul
			top.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`

			const p = Math.min(Math.abs(x) / 130, 1)
			const stampP = Math.max(0, Math.min((Math.abs(x) - 12) / 110, 1))
			const apply = top.querySelector<HTMLElement>('.rr-stamp--apply')
			const skip = top.querySelector<HTMLElement>('.rr-stamp--skip')
			const glow = top.querySelector<HTMLElement>('.rr-cglow')
			if (apply && skip) {
				if (x > 0) {
					apply.style.opacity = String(stampP)
					apply.style.transform = `rotate(-12deg) scale(${0.85 + 0.25 * stampP})`
					skip.style.opacity = '0'
				} else {
					skip.style.opacity = String(stampP)
					skip.style.transform = `rotate(12deg) scale(${0.85 + 0.25 * stampP})`
					apply.style.opacity = '0'
				}
			}
			if (glow) {
				glow.style.opacity = String(p * 0.35)
				glow.style.background =
					x > 0
						? 'radial-gradient(circle at 22% 50%, rgba(70,214,140,0.3), transparent 68%)'
						: 'radial-gradient(circle at 78% 50%, rgba(242,109,109,0.3), transparent 68%)'
			}

			// The under-cards climb toward their next slot as the top card leaves.
			for (let i = 1; i < cards.length; i++) {
				const v = slotLerp(i, p)
				cards[i].style.transform = `translate3d(0, ${v.y}px, 0) scale(${v.scale})`
				cards[i].style.opacity = String(v.opacity)
			}
		},
		[getCards, slotLerp],
	)

	const clearInline = useCallback((el: HTMLElement) => {
		el.style.transform = ''
		el.style.opacity = ''
		el.style.transition = ''
	}, [])

	const springBack = useCallback(() => {
		const s = S.current
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			const cards = getCards()
			cards.forEach(clearInline)
			const top = cards[0]
			if (top) {
				top.querySelectorAll<HTMLElement>('.rr-stamp, .rr-cglow').forEach(el => {
					el.style.opacity = ''
					el.style.transform = ''
				})
			}
			return
		}
		const hist = s.hist
		let vx = 0
		let vy = 0
		if (hist.length >= 2) {
			const last = hist[hist.length - 1]
			const first = hist.find(h => last.t - h.t <= 100) ?? hist[0]
			const dt = last.t - first.t
			if (dt > 0) {
				vx = ((last.x - first.x) / dt) * 1000
				vy = 0
			}
		}
		let x = s.dx
		let y = s.dy * 0.55
		let prev = performance.now()
		const k = 210
		const c = 26

		const step = (now: number) => {
			const dt = Math.min((now - prev) / 1000, 0.032)
			prev = now
			vx += (-k * x - c * vx) * dt
			vy += (-k * y - c * vy) * dt
			x += vx * dt
			y += vy * dt
			paint(x, y)
			if (Math.abs(x) < 0.4 && Math.abs(vx) < 6 && Math.abs(y) < 0.4 && Math.abs(vy) < 6) {
				const cards = getCards()
				cards.forEach(clearInline)
				const top = cards[0]
				if (top) {
					top
						.querySelectorAll<HTMLElement>('.rr-stamp, .rr-cglow')
						.forEach(el => {
							el.style.opacity = ''
							el.style.transform = ''
						})
				}
				s.raf = 0
				return
			}
			s.raf = requestAnimationFrame(step)
		}
		s.raf = requestAnimationFrame(step)
	}, [paint, getCards, clearInline])

	const flyOut = useCallback(
		(dir: 1 | -1, velocity: number) => {
			const s = S.current
			const deck = deckRef.current
			const cards = getCards()
			const top = cards[0]
			if (!deck || !top || s.flying) return
			// A button swipe can land mid spring-back; stop the spring loop or
			// it keeps repainting the flying card (and later the next top card)
			// with stale coordinates.
			if (s.raf) {
				cancelAnimationFrame(s.raf)
				s.raf = 0
			}
			s.flying = true

			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
			const w = deck.clientWidth
			const exitX = dir * (w * 1.5 + 140)
			const speed = Math.max(Math.abs(velocity), 0.9)
			const dur = reduced
				? 1
				: Math.max(FLY_MS_MIN, Math.min(FLY_MS_MAX, Math.abs(exitX - s.dx) / speed))
			const exitY = s.dy * 0.55 - 44
			const rot = dir * 26 * s.grabMul

			const stamp = top.querySelector<HTMLElement>(
				dir > 0 ? '.rr-stamp--apply' : '.rr-stamp--skip',
			)
			if (stamp) {
				stamp.style.transition = 'opacity 120ms ease'
				stamp.style.opacity = '1'
			}
			top.style.transition = `transform ${dur}ms cubic-bezier(0.2, 0.65, 0.4, 1), opacity ${dur}ms ease`
			top.style.transform = `translate3d(${exitX}px, ${exitY}px, 0) rotate(${rot}deg)`
			top.style.opacity = '0'

			// Promote the rest of the stack immediately; the class transition
			// carries them to their new slots while the top card exits.
			for (let i = 1; i < cards.length; i++) {
				clearInline(cards[i])
				cards[i].dataset.slot = String(i - 1)
			}

			window.setTimeout(() => {
				setTopIdx(n => n + 1)
				s.flying = false
				s.dx = 0
				s.dy = 0
				s.hist = []
			}, dur * 0.8)
		},
		[getCards, clearInline],
	)

	const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const s = S.current
		if (s.flying || s.active) return
		// Right/middle mouse buttons must not start a drag; contextmenu would
		// swallow the pointerup and leave the card stuck to the cursor.
		if (e.pointerType === 'mouse' && e.button !== 0) return
		if (s.raf) {
			cancelAnimationFrame(s.raf)
			s.raf = 0
		}
		s.active = true
		s.pointerId = e.pointerId
		s.sx = e.clientX
		s.sy = e.clientY
		s.dx = 0
		s.dy = 0
		s.hist = [{ x: e.clientX, t: performance.now() }]
		const rect = e.currentTarget.getBoundingClientRect()
		// Tinder detail: torque flips when you grab the bottom half.
		s.grabMul = e.clientY - rect.top < rect.height * 0.5 ? 1 : -1
		e.currentTarget.setPointerCapture(e.pointerId)
		const deck = deckRef.current
		if (deck) {
			deck
				.querySelectorAll<HTMLElement>('.rr-card')
				.forEach(el => (el.style.transition = 'none'))
		}
	}, [])

	const onPointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const s = S.current
			if (!s.active || e.pointerId !== s.pointerId) return
			s.dx = e.clientX - s.sx
			s.dy = e.clientY - s.sy
			s.hist.push({ x: e.clientX, t: performance.now() })
			if (s.hist.length > 8) s.hist.shift()
			paint(s.dx, s.dy * 0.55)
		},
		[paint],
	)

	const release = useCallback(
		(cancelled: boolean) => {
			const s = S.current
			if (!s.active) return
			s.active = false

			let velocity = 0
			const hist = s.hist
			if (hist.length >= 2) {
				const last = hist[hist.length - 1]
				const first = hist.find(h => last.t - h.t <= 100) ?? hist[0]
				const dt = last.t - first.t
				if (dt > 0) velocity = (last.x - first.x) / dt
			}

			const deck = deckRef.current
			const threshold = deck ? Math.min(140, deck.clientWidth * 0.42) : 140
			const flungByDistance = Math.abs(s.dx) > threshold
			const flungBySpeed =
				Math.abs(velocity) > 0.55 &&
				Math.abs(s.dx) > 24 &&
				Math.sign(velocity) === Math.sign(s.dx)

			if (!cancelled && (flungByDistance || flungBySpeed)) {
				flyOut(s.dx >= 0 ? 1 : -1, velocity)
			} else {
				springBack()
			}
		},
		[flyOut, springBack],
	)

	const onPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerId !== S.current.pointerId) return
			release(false)
		},
		[release],
	)

	const onPointerCancel = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerId !== S.current.pointerId) return
			release(true)
		},
		[release],
	)

	const swipeByButton = useCallback(
		(dir: 1 | -1) => {
			const s = S.current
			if (s.flying || s.active) return
			s.dx = 0
			s.dy = 0
			s.grabMul = 1
			flyOut(dir, 1.1)
		},
		[flyOut],
	)

	const done = topIdx >= JOBS.length
	const visible = JOBS.slice(topIdx, topIdx + 3)

	return (
		<div className="rr-demo rr-sec">
			<p className="rr-eyebrow rr-fade">This is what it feels like</p>
			<div className="rr-deck" ref={deckRef}>
				{done ? (
					<div className="rr-deck-done">
						<p className="rr-done-title">That was the whole job.</p>
						<p className="rr-done-sub">You swipe. We handle everything after.</p>
						<button className="rr-again" onClick={() => setTopIdx(0)}>
							See them again
						</button>
						<a
							className="rr-done-link"
							href={checkoutUrl}
							onClick={onEndCta}
						>
							Get your reverse recruiter →
						</a>
					</div>
				) : (
					visible.map((job, i) => (
						<div
							key={job.company}
							className="rr-card"
							data-slot={i}
							data-top={i === 0 ? 'true' : undefined}
							style={{ zIndex: 30 - i, animationDelay: `${i * 90}ms` }}
							onPointerDown={i === 0 ? onPointerDown : undefined}
							onPointerMove={i === 0 ? onPointerMove : undefined}
							onPointerUp={i === 0 ? onPointerUp : undefined}
							onPointerCancel={i === 0 ? onPointerCancel : undefined}
						>
							<div className="rr-stamp rr-stamp--apply" aria-hidden="true">
								APPLY
							</div>
							<div className="rr-stamp rr-stamp--skip" aria-hidden="true">
								SKIP
							</div>
							<div className="rr-cglow" aria-hidden="true" />
							<div className="rr-ctop">
								<span className="rr-cco">{job.company}</span>
								<span className="rr-cmatch">
									<span className="rr-cmatch-dot" />
									{job.match}% match
								</span>
							</div>
							<div className="rr-crole">{job.role}</div>
							<div className="rr-ctags">
								{job.tags.map(t => (
									<span className="rr-ctag" key={t}>
										{t}
									</span>
								))}
							</div>
							<div className="rr-cwhy">
								<div className="rr-cwhy-label">Why this fits you</div>
								<div className="rr-cwhy-text">{job.why}</div>
							</div>
						</div>
					))
				)}
			</div>
			<div className="rr-actions">
				<button
					className="rr-act rr-act--skip"
					aria-label="Skip this role"
					disabled={done}
					onClick={() => swipeByButton(-1)}
				>
					×
				</button>
				<button
					className="rr-act rr-act--apply"
					aria-label="Apply to this role"
					disabled={done}
					onClick={() => swipeByButton(1)}
				>
					♥
				</button>
			</div>
			<p className="rr-hint">
				Drag the card or tap <span>♥</span>. We handle the rest.
			</p>
			<p className="rr-count" aria-live="polite">
				{done
					? ''
					: `MATCH ${String(topIdx + 1).padStart(2, '0')} / ${String(JOBS.length).padStart(2, '0')}`}
			</p>
		</div>
	)
}

export default function ReverseRecruiterPage() {
	const { checkoutUrl } = useLoaderData<typeof loader>()
	const rootRef = useRef<HTMLDivElement>(null)
	const navRef = useRef<HTMLElement>(null)
	const barRef = useRef<HTMLDivElement>(null)
	const heroRef = useRef<HTMLElement>(null)
	const finalRef = useRef<HTMLElement>(null)

	const handleCtaClick = useCallback(
		(location: string, destination: string = checkoutUrl) => {
			trackCtaClick('agent_get_started', location, destination)
		},
		[checkoutUrl],
	)

	// Nav gains its chrome after the page starts moving.
	useEffect(() => {
		const nav = navRef.current
		if (!nav) return
		const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	// Sticky bar: arrives once the hero is gone, leaves when the final CTA
	// takes over (two buy buttons on screen is one too many).
	useEffect(() => {
		const bar = barRef.current
		const hero = heroRef.current
		const fin = finalRef.current
		if (!bar || !hero) return
		let heroGone = false
		let finalSeen = false
		const io = new IntersectionObserver(
			entries => {
				for (const en of entries) {
					if (en.target === hero)
						heroGone = !en.isIntersecting && en.boundingClientRect.top < 0
					if (en.target === fin) finalSeen = en.isIntersecting
				}
				bar.classList.toggle('rr-on', heroGone && !finalSeen)
			},
			{ threshold: 0 },
		)
		io.observe(hero)
		if (fin) io.observe(fin)
		return () => io.disconnect()
	}, [])

	// Scroll reveal. The .rr-js gate and the observer arrive together, so
	// elements are only ever hidden while something exists to reveal them.
	useEffect(() => {
		rootRef.current?.classList.add('rr-js')
		const els = document.querySelectorAll('.rr-fade')
		const io = new IntersectionObserver(
			entries => {
				entries.forEach(en => {
					if (en.isIntersecting) {
						en.target.classList.add('rr-in')
						io.unobserve(en.target)
					}
				})
			},
			{ threshold: 0.15, rootMargin: '0px 0px -36px 0px' },
		)
		els.forEach(el => io.observe(el))
		return () => io.disconnect()
	}, [])

	// Count-up for the proof bar
	useEffect(() => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const els = document.querySelectorAll<HTMLElement>('[data-count]')
		if (reduced) {
			els.forEach(el => {
				el.textContent = Number(el.dataset.count).toLocaleString()
			})
			return
		}
		els.forEach(el => {
			el.textContent = '0'
		})
		const io = new IntersectionObserver(
			entries => {
				entries.forEach(en => {
					if (!en.isIntersecting) return
					const el = en.target as HTMLElement
					const target = parseInt(el.dataset.count || '0', 10)
					const start = performance.now()
					const duration = 1600
					const tick = (now: number) => {
						const p = Math.min((now - start) / duration, 1)
						const ease = 1 - Math.pow(1 - p, 4)
						el.textContent = Math.round(ease * target).toLocaleString()
						if (p < 1) requestAnimationFrame(tick)
					}
					requestAnimationFrame(tick)
					io.unobserve(el)
				})
			},
			{ threshold: 0.5 },
		)
		els.forEach(el => io.observe(el))
		return () => io.disconnect()
	}, [])

	return (
		<div
			className="rr"
			ref={rootRef}
			style={{
				background: '#0B0C10',
				color: '#F4F4F7',
				fontFamily: "'Nunito Sans', -apple-system, sans-serif",
				WebkitFontSmoothing: 'antialiased',
				MozOsxFontSmoothing: 'grayscale',
				overflowX: 'hidden',
				lineHeight: 1.5,
				minHeight: '100vh',
			}}
		>
			<style dangerouslySetInnerHTML={{ __html: pageStyles }} />
			{/* Fades need no noscript fallback: they only hide behind .rr-js. */}
			<noscript>
				<style>
					{`.rr-faq-a { grid-template-rows: 1fr !important; }
					.rr-faq-clip { visibility: visible !important; }`}
				</style>
			</noscript>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>

			<nav className="rr-nav" ref={navRef}>
				<Link to="/" className="rr-nav-logo" reloadDocument>
					{/* Empty alt: the wordmark beside it already names the link. */}
					<img
						src="/RT_Logo_icon.png"
						alt=""
						className="rr-nav-mark"
						width={24}
						height={24}
					/>
					Resume Tailor
				</Link>
				{/* Same link set as the home page nav. Builder points at the
				    marketing page, not the app: cold SEO traffic should land on
				    a page that sells, and the internal link carries anchor text. */}
				<div className="rr-nav-links">
					<Link to="/pricing" className="rr-nav-link" reloadDocument>
						Pricing
					</Link>
					<Link to="/ai-resume-builder" className="rr-nav-link" reloadDocument>
						Builder
					</Link>
					<Link to="/blog" className="rr-nav-link" reloadDocument>
						Blog
					</Link>
					<Link
						to="#pricing"
						className="rr-nav-cta"
						onClick={() => handleCtaClick('nav', '#pricing')}
					>
						Get your recruiter
					</Link>
				</div>
			</nav>

			<div className="rr-stickybar" ref={barRef}>
				<span className="rr-stickytext">
					<strong>Reverse Recruiter</strong>, limited to 50 members
				</span>
				<a
					href={checkoutUrl}
					className="rr-stickycta"
					onClick={() => handleCtaClick('sticky_bar')}
				>
					Start your free week
				</a>
			</div>

			<header className="rr-hero" ref={heroRef}>
				<div className="rr-wrap">
					<div className="rr-pill rr-fade rr-in">
						<span className="rr-pill-dot" />
						Now accepting members
					</div>
					<h1 className="rr-h1 rr-fade rr-in rr-d1">
						<span className="rr-h1-soft">Your AI</span> <br />
						Reverse Recruiter
					</h1>
					<p className="rr-tagline rr-fade rr-in rr-d2">
						Get interviews without spending your nights applying.
					</p>
					<p className="rr-herosub rr-fade rr-in rr-d3">
						We find high-match roles, tailor your resume for each one, and apply on
						your behalf. You approve the jobs you want. We handle the rest.
					</p>
					<div className="rr-ctas rr-fade rr-in rr-d4">
						<a
							href={checkoutUrl}
							className="rr-btn"
							onClick={() => handleCtaClick('hero')}
						>
							Get your reverse recruiter
							<span className="rr-btn-arrow">→</span>
						</a>
						<span className="rr-note">
							First week free. Cancel anytime. Limited to 50 members.
						</span>
					</div>
				</div>
			</header>

			<div className="rr-wrap">
				<div className="rr-proof">
					<div
						className={`rr-proof-grid${PROOF_STATS.length === 1 ? ' rr-proof--solo' : ''}`}
					>
						{PROOF_STATS.map((stat, i) => (
							<div className={`rr-proof-item rr-fade rr-d${i + 1}`} key={stat.label}>
								{/* SSR shows the real number; JS zeroes it just before the
								    count-up so a no-JS render never reads "0". */}
								<div
									className="rr-proof-num"
									data-count={stat.count ?? undefined}
								>
									{stat.value}
								</div>
								<div className="rr-proof-label">{stat.label}</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<section className="rr-sec">
				<div className="rr-wrap">
					<div className="rr-sec-head">
						<p className="rr-eyebrow rr-fade">
							The job search is designed against you
						</p>
						<h2 className="rr-h2 rr-fade rr-d1">
							You deserve a recruiter <br />
							who works for you.
						</h2>
					</div>
					<div className="rr-versus">
						<div className="rr-vcard rr-vcard--old rr-fade">
							<p className="rr-vtag">Today</p>
							<p className="rr-vtitle">How you apply today</p>
							{PAIN_POINTS.map(item => (
								<div className="rr-vrow" key={item}>
									<span className="rr-vic rr-vic--bad" aria-hidden="true">
										×
									</span>
									<span>{item}</span>
								</div>
							))}
						</div>
						<div className="rr-vcard rr-vcard--new rr-fade rr-d1">
							<p className="rr-vtag">With us</p>
							<p className="rr-vtitle">With your reverse recruiter</p>
							{RELIEF_POINTS.map(item => (
								<div className="rr-vrow" key={item}>
									<span className="rr-vic rr-vic--good" aria-hidden="true">
										✓
									</span>
									<span>{item}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			<SwipeDeck onEndCta={() => handleCtaClick('demo_end')} />

			<section className="rr-sec">
				<div className="rr-wrap">
					<div className="rr-sec-head">
						<p className="rr-eyebrow rr-fade">How it works</p>
						<h2 className="rr-h2 rr-fade rr-d1">
							Three steps. <br />
							Zero grind.
						</h2>
						<p className="rr-sub rr-fade rr-d2">
							Like having a Hollywood talent agent, except it costs $99 a month
							instead of 10% of your salary.
						</p>
					</div>
					<div className="rr-steps">
						{STEPS.map((step, i) => (
							<div className="rr-step rr-fade" key={step.title}>
								<span className="rr-step-num">
									{String(i + 1).padStart(2, '0')}
								</span>
								<div className="rr-step-body">
									<h3>{step.title}</h3>
									<p>{step.body}</p>
								</div>
							</div>
						))}
					</div>
					<div className="rr-sec-cta rr-fade">
						<a
							href={checkoutUrl}
							className="rr-btn"
							onClick={() => handleCtaClick('how_it_works')}
						>
							Get your reverse recruiter
							<span className="rr-btn-arrow">→</span>
						</a>
					</div>
				</div>
			</section>

			<section className="rr-sec">
				<div className="rr-wrap">
					<div className="rr-sec-head">
						<p className="rr-eyebrow rr-fade">What's included</p>
						<h2 className="rr-h2 rr-fade rr-d1">
							Everything you need. <br />
							Nothing you don't.
						</h2>
					</div>
					<div className="rr-feats rr-fade rr-d2">
						{FEATURES.map(f => (
							<div className="rr-feat" key={f.title}>
								<div className="rr-feat-ic">
									<FeatureIcon name={f.icon} />
								</div>
								<h3>{f.title}</h3>
								<p>{f.body}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="rr-sec">
				<div className="rr-wrap">
					<div className="rr-quote-sec rr-fade">
						<p className="rr-eyebrow">{TESTIMONIAL.eyebrow}</p>
						<div className="rr-stars" role="img" aria-label="5 out of 5 stars">
							★★★★★
						</div>
						<blockquote className="rr-quote">{TESTIMONIAL.quote}</blockquote>
						<p className="rr-attr">
							<strong>{TESTIMONIAL.name}</strong> · {TESTIMONIAL.role}
						</p>
						<div className="rr-chip">✓ {TESTIMONIAL.outcome}</div>
						{TESTIMONIAL.pipeline ? (
							<div className="rr-pipeline">
								{TESTIMONIAL.pipeline.map(p => (
									<span className="rr-pipe-item" key={p.label}>
										<b>{p.value}</b> {p.label}
									</span>
								))}
							</div>
						) : null}
					</div>
				</div>
			</section>

			<section className="rr-sec rr-pricing" id="pricing">
				<div className="rr-wrap">
					<div className="rr-sec-head">
						<p className="rr-eyebrow rr-fade">Simple pricing</p>
						<h2 className="rr-h2 rr-fade rr-d1">
							One plan. One price. <br />
							No contract.
						</h2>
					</div>
					<div className="rr-price-card rr-fade rr-d2">
						<div className="rr-price-left">
							<p className="rr-price-tier">Reverse Recruiter</p>
							<div className="rr-anchor">
								<p className="rr-anchor-label">Traditional reverse recruiters</p>
								<p className="rr-anchor-value">
									{TRADITIONAL_PRICE_RANGE} <span>per engagement</span>
								</p>
							</div>
							<div className="rr-price-row">
								<span className="rr-price">$99</span>
								<span className="rr-price-meta">
									per month ·
									<br />
									cancel anytime
								</span>
							</div>
							<div className="rr-trial-pill">First week free</div>
							<a
								href={checkoutUrl}
								className="rr-pcta"
								onClick={() => handleCtaClick('pricing')}
							>
								Start your free week →
							</a>
							<div className="rr-seats">
								<span className="rr-seat-dot" />
								Limited to 50 members
							</div>
							<div className="rr-guarantee">7-day money-back guarantee</div>
						</div>
						<div className="rr-price-feats">
							{[
								'10–15 curated role matches every week',
								'Custom-tailored resume per application',
								'We apply on your behalf',
								'Application dashboard & status tracking',
								'Full Resume Tailor builder access',
							].map(item => (
								<div className="rr-pf" key={item}>
									<span className="rr-pf-check" aria-hidden="true">
										✓
									</span>
									<span>{item}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			<section className="rr-paper">
				<div className="rr-read rr-learn">
					<p className="rr-eyebrow rr-eyebrow--paper rr-fade">
						Reverse recruiting, explained
					</p>

					<h2 className="rr-fade">What is a reverse recruiter?</h2>
					<p>
						Every recruiter you have ever spoken to was paid by an employer. That is
						the whole model. A company has a role to fill, it hires a recruiter, and
						the recruiter finds the person. You were never the client. You were the
						inventory.
					</p>
					<p>
						<strong>A reverse recruiter flips who the recruiter works for.</strong>{' '}
						You hire them. They work your search. They source roles that fit your
						experience, position you for each one, and handle the application legwork
						that turns job hunting into a second job.
					</p>
					<p>
						It is the same reason actors have agents. Someone whose only incentive is
						your outcome runs a different search than someone filling a req.
					</p>
					<p>
						You will see the same idea called reverse recruiting, reverse
						recruitment, or reverse recruiter services depending on who is selling
						it. The label changes. The arrangement does not. Whoever does the work,
						works for you.
					</p>

					<h2 className="rr-fade">How reverse recruiting works</h2>
					<p>
						The mechanics are the same whether a human or an AI does the work. Here
						is the loop. It repeats every week.
					</p>
					<div className="rr-lsteps">
						<div className="rr-lstep">
							<div>
								<b>Intake.</b> You share your resume and what you want: titles,
								industries, locations, salary floor, and the things you will not
								compromise on. Five minutes, once.
							</div>
						</div>
						<div className="rr-lstep">
							<div>
								<b>Sourcing.</b> Your reverse recruiter scans company career pages,
								job boards, and ATS platforms, then cuts thousands of listings down
								to the handful that fit.
							</div>
						</div>
						<div className="rr-lstep">
							<div>
								<b>Approval.</b> You review the shortlist and pick the roles you
								want. Nothing gets submitted in your name without your yes.
							</div>
						</div>
						<div className="rr-lstep">
							<div>
								<b>Tailoring.</b> Your resume gets rewritten for each approved role.
								Keywords, ordering, and emphasis matched to that exact posting.
							</div>
						</div>
						<div className="rr-lstep">
							<div>
								<b>Submission.</b> The application is filled out and submitted on
								your behalf, with the tailored resume attached.
							</div>
						</div>
						<div className="rr-lstep">
							<div>
								<b>Tracking.</b> Every application, status change, and response
								lands in one dashboard, so you always know where your search stands.
							</div>
						</div>
					</div>

					<h2 className="rr-fade">
						AI reverse recruiter vs. traditional reverse recruiter
					</h2>
					<p>
						Traditional reverse recruiting is a person doing all of this by hand. It
						works. It is also expensive, because what you are buying is their hours.
						An AI reverse recruiter moves the volume work into software and keeps a
						human on the judgment calls.
					</p>
					<div className="rr-table">
						<div className="rr-trow rr-trow--head">
							<span />
							<span>Traditional</span>
							<span className="rr-tmine">Resume Tailor</span>
						</div>
						<div className="rr-trow">
							<span className="rr-tlabel">Cost</span>
							<span data-col="Traditional">
								{TRADITIONAL_PRICE_RANGE} per engagement
							</span>
							<span className="rr-tmine" data-col="Resume Tailor">
								$99/mo, cancel anytime
							</span>
						</div>
						<div className="rr-trow">
							<span className="rr-tlabel">Commitment</span>
							<span data-col="Traditional">Multi-month contract</span>
							<span className="rr-tmine" data-col="Resume Tailor">
								Month to month
							</span>
						</div>
						<div className="rr-trow">
							<span className="rr-tlabel">Resume per role</span>
							<span data-col="Traditional">Often one master resume</span>
							<span className="rr-tmine" data-col="Resume Tailor">
								Tailored for every application
							</span>
						</div>
						<div className="rr-trow">
							<span className="rr-tlabel">Cadence</span>
							<span data-col="Traditional">Scheduled calls and check-ins</span>
							<span className="rr-tmine" data-col="Resume Tailor">
								New matches every week
							</span>
						</div>
						<div className="rr-trow">
							<span className="rr-tlabel">Who decides</span>
							<span data-col="Traditional">You, on their schedule</span>
							<span className="rr-tmine" data-col="Resume Tailor">
								You approve every role before we apply
							</span>
						</div>
					</div>

					<h2 className="rr-fade">Reverse recruiting is not auto-apply</h2>
					<p>
						There is a whole category of tool that blasts one generic resume at 500
						jobs and calls it automation. It is easy to build and it does not work.
						Recruiters spot a generic application in seconds, and volume without fit
						is how people end up with hundreds of applications and nothing to show.
					</p>
					<p>
						A reverse recruiter makes the opposite trade. Fewer roles, picked on
						purpose, with a resume rewritten for each one and your approval before
						anything goes out under your name. Ten strong applications beat a hundred
						forgettable ones. That is the whole bet this product makes.
					</p>

					<h2 className="rr-fade">How much does a reverse recruiter cost?</h2>
					<p>
						Human reverse recruiting services generally charge{' '}
						<strong>{TRADITIONAL_PRICE_RANGE}</strong> for a multi-month engagement.
						That price is honest. A person is spending real hours on your search, and
						hours are what you pay for.
					</p>
					<p>
						<Link to="/" reloadDocument>
							Resume Tailor
						</Link>{' '}
						is <strong>$99 a month</strong>, cancel anytime. The AI absorbs the
						hours. The sourcing pass, the resume rewrite for every role, the form
						filling. A human reviews the matches before they reach you. You get the
						service without the retainer.
					</p>

					{/* The problem-aware reader just finished the cost case; give
					    them a way in without scrolling back to the pricing card. */}
					<div className="rr-paper-cta rr-fade">
						<a
							href={checkoutUrl}
							className="rr-btn rr-btn--paper"
							onClick={() => handleCtaClick('learn_end')}
						>
							Get your reverse recruiter
							<span className="rr-btn-arrow">→</span>
						</a>
						<span className="rr-paper-cta-note">
							First week free. Then $99 a month.
						</span>
					</div>
				</div>

				<div className="rr-faq">
					<h2 className="rr-faq-title rr-fade">Reverse recruiting FAQ</h2>
					{FAQS.map(({ q, a }, idx) => (
						<FaqItem q={q} a={a} idx={idx} key={q} />
					))}
				</div>
			</section>

			<section className="rr-final" ref={finalRef}>
				<div className="rr-wrap">
					<h2 className="rr-final-h rr-fade">
						Every hour you spend applying is an hour you never get back.
					</h2>
					<p className="rr-final-sub rr-fade rr-d1">
						Your next interview is one swipe away.
					</p>
					<div className="rr-final-btn rr-fade rr-d2">
						<a
							href={checkoutUrl}
							className="rr-btn"
							onClick={() => handleCtaClick('final_cta')}
						>
							Get your reverse recruiter
							<span className="rr-btn-arrow">→</span>
						</a>
					</div>
				</div>
			</section>

			<footer className="rr-footer">
				<span>© 2026 Resume Tailor</span>
				<div className="rr-foot-links">
					<Link to="/pricing" reloadDocument>
						Pricing
					</Link>
					<Link to="/" reloadDocument>
						Home
					</Link>
				</div>
			</footer>
		</div>
	)
}
