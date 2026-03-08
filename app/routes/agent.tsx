import { useEffect, useRef, useCallback } from 'react'
import { json, type LoaderFunctionArgs, type MetaFunction, type LinksFunction } from '@remix-run/node'
import { useLoaderData, Link } from '@remix-run/react'
import { trackCtaClick } from '~/lib/analytics.client.ts'

export const meta: MetaFunction = () => [
	{ title: 'Resume Tailor Agent — Stop Applying to Jobs' },
	{
		name: 'description',
		content:
			'Your AI career agent finds roles you\'ll love, tailors your resume for each one, and applies on your behalf. You just swipe yes.',
	},
]

export const links: LinksFunction = () => [
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,200;0,300;0,400;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,600;1,700;1,800;1,900&display=swap',
	},
]

export async function loader({ request }: LoaderFunctionArgs) {
	const checkoutUrl =
		process.env.STRIPE_AGENT_CHECKOUT_URL || 'https://buy.stripe.com/9B6bJ290HfQmdUaaDp5Rm01'

	return json(
		{ checkoutUrl },
		{
			headers: {
				'Cache-Control': 'public, max-age=3600',
			},
		},
	)
}

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

const pageStyles = `
  :root {
    --bg: #08080A;
    --card: #111114;
    --card-hover: #161619;
    --brand: #6B45FF;
    --brand-light: #8B6AFF;
    --brand-lighter: #C4B5FD;
    --brand-dim: rgba(107, 69, 255, 0.10);
    --brand-glow: rgba(107, 69, 255, 0.35);
    --brand-glow-lg: rgba(107, 69, 255, 0.15);
    --text: #FAFAFA;
    --text-secondary: #A1A1AA;
    --text-muted: #71717A;
    --border: rgba(255,255,255,0.06);
    --border-hover: rgba(255,255,255,0.12);
    --green: #22c55e;
    --green-dim: rgba(34,197,94,0.12);
    --red: #ef4444;
    --red-dim: rgba(239,68,68,0.10);
    --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  }

  .agent-page * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    padding: 0 40px; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(8, 8, 10, 0);
    backdrop-filter: blur(0px);
    border-bottom: 1px solid transparent;
    transition: all 0.4s ease;
  }
  .nav.scrolled {
    background: rgba(8, 8, 10, 0.82);
    backdrop-filter: blur(20px);
    border-bottom-color: var(--border);
  }
  .nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-weight: 600; font-size: 15px; letter-spacing: -0.01em;
    color: var(--text); text-decoration: none;
  }
  .nav-logo-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--brand);
    box-shadow: 0 0 12px var(--brand-glow);
  }
  .nav-links { display: flex; align-items: center; gap: 32px; }
  .nav-link {
    font-size: 14px; color: var(--text-secondary);
    text-decoration: none; transition: color 0.2s;
  }
  .nav-link:hover { color: var(--text); }
  .nav-cta-btn {
    padding: 9px 20px; border-radius: 8px;
    background: var(--brand); color: white;
    font-size: 13px; font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 0 20px rgba(107,69,255,0.25);
  }
  .nav-cta-btn:hover { background: var(--brand-light); transform: translateY(-1px); }

  .sticky-bar {
    position: fixed; bottom: -80px; left: 0; right: 0; z-index: 999;
    padding: 16px 40px;
    background: rgba(8,8,10,0.9);
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; gap: 20px;
    transition: bottom 0.5s var(--ease-spring);
  }
  .sticky-bar.visible { bottom: 0; }
  .sticky-bar-text { font-size: 14px; color: var(--text-secondary); }
  .sticky-bar-text strong { color: var(--text); font-weight: 600; }
  .sticky-bar-cta {
    padding: 10px 24px; border-radius: 8px;
    background: var(--brand); color: white;
    font-size: 14px; font-weight: 600;
    text-decoration: none; border: none; cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 24px rgba(107,69,255,0.3);
  }
  .sticky-bar-cta:hover { background: var(--brand-light); }

  .fade-up {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.8s var(--ease-spring), transform 0.8s var(--ease-spring);
  }
  .fade-up.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .fade-up-d1 { transition-delay: 0.08s; }
  .fade-up-d2 { transition-delay: 0.16s; }
  .fade-up-d3 { transition-delay: 0.24s; }
  .fade-up-d4 { transition-delay: 0.32s; }

  .hero {
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 120px 24px 80px;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
    width: 800px; height: 800px;
    background: radial-gradient(ellipse, var(--brand-glow-lg) 0%, transparent 65%);
    pointer-events: none;
  }
  .hero-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 18px; border-radius: 100px;
    background: var(--brand-dim);
    border: 1px solid rgba(107,69,255,0.2);
    font-size: 13px; font-weight: 500; color: var(--brand-lighter);
    margin-bottom: 40px;
  }
  .hero-pill-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--brand-light);
    animation: pulse 2.5s ease infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(107,69,255,0.4); }
    50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(107,69,255,0); }
  }

  .hero h1 {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: clamp(52px, 9vw, 104px);
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.035em;
    max-width: 780px;
  }
  .hero h1 .gradient-text {
    background: linear-gradient(135deg, var(--brand-light) 0%, var(--brand-lighter) 50%, #fff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: clamp(16px, 2vw, 19px);
    color: var(--text-secondary);
    max-width: 480px;
    line-height: 1.65;
    margin-top: 32px;
  }

  .hero-ctas {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    margin-top: 48px;
  }
  .btn-primary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 18px 40px; border-radius: 12px;
    background: var(--brand); color: white;
    font-size: 16px; font-weight: 700;
    text-decoration: none; border: none; cursor: pointer;
    transition: all 0.25s var(--ease-spring);
    box-shadow: 0 0 48px var(--brand-glow), 0 2px 8px rgba(0,0,0,0.3);
  }
  .btn-primary:hover {
    background: var(--brand-light);
    transform: translateY(-2px);
    box-shadow: 0 0 64px var(--brand-glow), 0 4px 16px rgba(0,0,0,0.4);
  }
  .btn-primary .arrow { transition: transform 0.2s; }
  .btn-primary:hover .arrow { transform: translateX(3px); }
  .hero-note { font-size: 13px; color: var(--text-muted); }

  .section {
    padding: 140px 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
  .section-narrow { max-width: 680px; }
  .section-label {
    font-size: 13px; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--brand-lighter);
    margin-bottom: 16px;
  }
  .section-title {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: clamp(36px, 5.5vw, 60px);
    font-weight: 400;
    letter-spacing: -0.025em;
    line-height: 1.05;
  }
  .section-sub {
    font-size: 17px; color: var(--text-secondary);
    line-height: 1.65; margin-top: 16px;
    max-width: 500px;
  }
  .section-center { text-align: center; }
  .section-center .section-sub { margin-left: auto; margin-right: auto; }

  .proof-bar {
    display: flex; justify-content: center; gap: 48px;
    padding: 60px 24px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .proof-item { text-align: center; }
  .proof-num {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: 42px; font-weight: 400; line-height: 1;
    color: var(--text);
  }
  .proof-label {
    font-size: 13px; color: var(--text-muted); margin-top: 6px;
  }

  .contrast-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    margin-top: 64px;
  }
  .contrast-card {
    padding: 44px 36px;
    border-radius: 16px;
    border: 1px solid var(--border);
    transition: border-color 0.3s;
  }
  .contrast-card:hover { border-color: var(--border-hover); }
  .old-card { background: var(--card); }
  .new-card {
    background: linear-gradient(160deg, rgba(107,69,255,0.08) 0%, rgba(107,69,255,0.02) 100%);
    border-color: rgba(107,69,255,0.15);
  }
  .new-card:hover { border-color: rgba(107,69,255,0.3); }
  .contrast-card-title {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: 26px; font-weight: 400;
    margin-bottom: 28px;
  }
  .old-card .contrast-card-title { color: var(--text-muted); }
  .new-card .contrast-card-title { color: var(--brand-lighter); }

  .contrast-item {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 13px 0;
    font-size: 15px; line-height: 1.55;
  }
  .contrast-item + .contrast-item { border-top: 1px solid var(--border); }
  .contrast-icon {
    flex-shrink: 0; width: 26px; height: 26px;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .icon-bad { background: var(--red-dim); color: var(--red); }
  .icon-good { background: var(--green-dim); color: var(--green); }
  .old-card .contrast-item { color: var(--text-muted); }
  .new-card .contrast-item { color: var(--text-secondary); }

  .steps-list {
    margin-top: 72px;
    display: flex; flex-direction: column;
  }
  .step-row {
    display: grid; grid-template-columns: 72px 1fr; gap: 28px;
    padding: 44px 0;
    border-top: 1px solid var(--border);
    align-items: start;
  }
  .step-row:last-child { border-bottom: 1px solid var(--border); }
  .step-num {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: 48px; color: var(--brand);
    opacity: 0.4; line-height: 1;
  }
  .step-content h3 {
    font-size: 21px; font-weight: 600;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }
  .step-content p {
    font-size: 15px; color: var(--text-secondary);
    line-height: 1.6; max-width: 520px;
  }

  .demo-wrap {
    padding: 120px 24px 60px;
    display: flex; flex-direction: column; align-items: center;
    position: relative;
  }
  .demo-stack {
    position: relative;
    width: 400px; max-width: 100%;
    height: 460px;
    perspective: 1200px;
  }
  .demo-card {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    border-radius: 20px;
    padding: 36px 32px;
    display: flex; flex-direction: column;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    will-change: transform;
    overflow: hidden;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(107,69,255,0.08);
  }
  .demo-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    border-radius: 20px 20px 0 0;
    background: linear-gradient(90deg, var(--brand), var(--brand-light));
    z-index: 2;
  }
  .demo-card[data-top="true"] { cursor: grab; }
  .demo-card[data-dragging="true"] { cursor: grabbing; }

  .swipe-label {
    position: absolute; top: 32px; z-index: 10;
    padding: 8px 22px;
    border-radius: 8px;
    font-size: 26px; font-weight: 800;
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    letter-spacing: 3px;
    pointer-events: none;
    opacity: 0;
    transition: none;
  }
  .swipe-label-apply {
    left: 28px;
    border: 3px solid var(--green);
    color: var(--green);
    transform: rotate(-15deg);
    text-shadow: 0 0 20px rgba(34,197,94,0.4);
  }
  .swipe-label-skip {
    right: 28px;
    border: 3px solid var(--red);
    color: var(--red);
    transform: rotate(15deg);
    text-shadow: 0 0 20px rgba(239,68,68,0.4);
  }

  .dc-top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
  .dc-company {
    font-size: 12px; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .dc-match {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 100px;
    background: rgba(107,69,255,0.12);
    font-size: 13px; font-weight: 600; color: var(--brand-lighter);
  }
  .dc-match-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--brand-light);
  }
  .dc-role {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: 30px; font-weight: 400;
    margin-top: 14px;
    letter-spacing: -0.015em;
    position: relative; z-index: 1;
  }
  .dc-meta {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-top: 16px;
    position: relative; z-index: 1;
  }
  .dc-tag {
    padding: 5px 14px; border-radius: 100px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    font-size: 13px; color: var(--text-secondary);
  }
  .dc-why {
    margin-top: auto; padding-top: 24px;
    border-top: 1px solid var(--border);
    position: relative; z-index: 1;
  }
  .dc-why-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted); margin-bottom: 8px;
  }
  .dc-why-text { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

  .demo-card-glow {
    position: absolute; inset: 0; border-radius: 20px;
    pointer-events: none; z-index: 0;
    opacity: 0; transition: none;
  }

  .demo-actions {
    display: flex; justify-content: center; gap: 24px;
    margin-top: 32px;
  }
  .demo-btn {
    width: 64px; height: 64px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: none; cursor: pointer;
    font-size: 22px;
    transition: all 0.25s var(--ease-spring);
  }
  .demo-btn-skip {
    background: rgba(239,68,68,0.08); border: 2px solid rgba(239,68,68,0.25); color: var(--red);
    box-shadow: 0 4px 20px rgba(239,68,68,0.12);
  }
  .demo-btn-skip:hover { background: rgba(239,68,68,0.18); transform: scale(1.1); box-shadow: 0 8px 30px rgba(239,68,68,0.2); }
  .demo-btn-go {
    background: rgba(34,197,94,0.08); border: 2px solid rgba(34,197,94,0.25); color: var(--green);
    box-shadow: 0 4px 20px rgba(34,197,94,0.12);
    font-size: 26px;
  }
  .demo-btn-go:hover { background: rgba(34,197,94,0.18); transform: scale(1.1); box-shadow: 0 8px 30px rgba(34,197,94,0.2); }
  @keyframes btnPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
  .demo-hint {
    font-size: 13px; color: var(--text-muted); margin-top: 20px;
    text-align: center;
  }
  .demo-hint span { color: var(--brand-lighter); }
  .demo-counter {
    font-size: 12px; color: rgba(255,255,255,0.2);
    margin-top: 10px; text-align: center;
    letter-spacing: 1px; font-weight: 500;
  }
  .demo-empty {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 20px;
    animation: popIn 0.5s ease;
  }
  @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  .demo-reset-btn {
    padding: 12px 32px; border-radius: 100px;
    background: linear-gradient(135deg, var(--brand), var(--brand-light));
    border: none; color: #fff; font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: 'Nunito Sans', -apple-system, sans-serif;
    letter-spacing: 0.5px;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 24px var(--brand-glow);
  }
  .demo-reset-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px var(--brand-glow); }

  .features-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
    margin-top: 56px;
  }
  .feature-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 36px 28px;
    transition: all 0.3s var(--ease-spring);
  }
  .feature-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  }
  .feature-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: var(--brand-dim);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; margin-bottom: 20px;
    color: var(--brand-light);
  }
  .feature-card h4 {
    font-size: 17px; font-weight: 600; margin-bottom: 8px;
    letter-spacing: -0.01em;
  }
  .feature-card p {
    font-size: 14px; color: var(--text-muted); line-height: 1.55;
  }

  .testimonial-section {
    padding: 120px 24px;
    max-width: 700px; margin: 0 auto;
    text-align: center;
  }
  .testimonial-stars {
    font-size: 18px; color: #facc15;
    letter-spacing: 4px;
    margin-bottom: 28px;
  }
  .testimonial-quote {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: clamp(24px, 3.5vw, 32px);
    font-weight: 400; font-style: italic;
    line-height: 1.45;
    color: var(--text);
  }
  .testimonial-author {
    margin-top: 32px;
    font-size: 15px; color: var(--text-secondary);
  }
  .testimonial-author strong { color: var(--text); font-weight: 600; }
  .testimonial-outcome {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 12px;
    padding: 6px 16px; border-radius: 100px;
    background: var(--green-dim);
    font-size: 13px; font-weight: 600; color: var(--green);
  }

  .pricing-wrap {
    padding: 140px 24px;
    max-width: 580px; margin: 0 auto;
    text-align: center;
  }
  .price-card {
    background: var(--card);
    border: 1px solid rgba(107,69,255,0.2);
    border-radius: 20px;
    padding: 56px 48px;
    margin-top: 48px;
    position: relative;
    overflow: hidden;
  }
  .price-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--brand), var(--brand-light));
  }
  .price-card::after {
    content: '';
    position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
    width: 300px; height: 200px;
    background: radial-gradient(ellipse, rgba(107,69,255,0.12), transparent 70%);
    pointer-events: none;
  }
  .price-tier {
    font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--brand-lighter); font-weight: 500;
    margin-bottom: 20px;
    position: relative;
  }
  .price-amount {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: 80px; font-weight: 400;
    line-height: 1; position: relative;
  }
  .price-per { font-size: 15px; color: var(--text-muted); margin-top: 4px; margin-bottom: 40px; position: relative; }

  .price-features {
    text-align: left; position: relative;
    margin-bottom: 40px;
  }
  .pf-item {
    display: flex; align-items: center; gap: 14px;
    padding: 13px 0; font-size: 15px;
    border-bottom: 1px solid var(--border);
  }
  .pf-item:last-child { border-bottom: none; }
  .pf-check {
    flex-shrink: 0; width: 20px; height: 20px; border-radius: 6px;
    background: var(--brand-dim);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; color: var(--brand-light); font-weight: 700;
  }

  .price-cta {
    display: block; width: 100%; padding: 18px;
    background: var(--brand); color: white;
    border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    transition: all 0.25s var(--ease-spring);
    box-shadow: 0 0 48px var(--brand-glow);
    position: relative;
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    text-decoration: none;
    text-align: center;
  }
  .price-cta:hover {
    background: var(--brand-light);
    transform: translateY(-2px);
    box-shadow: 0 0 64px var(--brand-glow);
  }
  .spots-badge {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 20px;
    font-size: 13px; color: var(--text-muted);
    position: relative;
  }
  .spots-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--brand-light);
    animation: pulse 2.5s ease infinite;
  }
  .guarantee {
    margin-top: 12px; font-size: 12px; color: var(--text-muted); position: relative;
  }

  .faq-section {
    padding: 120px 24px;
    max-width: 680px; margin: 0 auto;
  }
  .faq-item {
    border-bottom: 1px solid var(--border);
  }
  .faq-q {
    width: 100%; padding: 24px 0;
    background: none; border: none; color: var(--text);
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: 16px; font-weight: 500;
    text-align: left; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    transition: color 0.2s;
  }
  .faq-q:hover { color: var(--brand-lighter); }
  .faq-icon {
    font-size: 20px; color: var(--text-muted);
    transition: transform 0.3s var(--ease-spring);
  }
  .faq-item.open .faq-icon { transform: rotate(45deg); }
  .faq-a {
    max-height: 0; overflow: hidden;
    transition: max-height 0.4s var(--ease-spring), padding 0.3s;
  }
  .faq-item.open .faq-a { max-height: 200px; }
  .faq-a-inner {
    padding-bottom: 24px;
    font-size: 15px; color: var(--text-secondary); line-height: 1.6;
  }

  .final-cta {
    padding: 140px 24px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .final-cta::before {
    content: '';
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 700px; height: 500px;
    background: radial-gradient(ellipse, rgba(107,69,255,0.12), transparent 65%);
    pointer-events: none;
  }
  .final-headline {
    font-family: 'Nunito Sans', -apple-system, sans-serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 400; letter-spacing: -0.02em;
    line-height: 1.1;
    max-width: 600px; margin: 0 auto;
    position: relative;
  }
  .final-sub {
    font-size: 17px; color: var(--text-secondary);
    margin-top: 20px; position: relative;
  }
  .final-btn-wrap {
    margin-top: 40px; position: relative;
  }

  .footer {
    padding: 32px 40px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; color: var(--text-muted);
  }
  .footer a { color: var(--text-muted); text-decoration: none; }
  .footer a:hover { color: var(--text); }
  .footer-links { display: flex; gap: 24px; }

  @media (max-width: 768px) {
    .nav { padding: 0 20px; }
    .nav-links a:not(.nav-cta-btn) { display: none; }
    .section { padding: 100px 20px; }
    .contrast-grid { grid-template-columns: 1fr; }
    .contrast-card { padding: 32px 24px; }
    .features-grid { grid-template-columns: 1fr; }
    .step-row { grid-template-columns: 52px 1fr; gap: 16px; }
    .demo-stack { width: 100%; height: 400px; }
    .price-card { padding: 40px 28px; }
    .proof-bar { flex-direction: column; gap: 32px; }
    .footer { flex-direction: column; gap: 16px; text-align: center; }
    .sticky-bar { padding: 14px 20px; }
    .sticky-bar-text { display: none; }
  }
`

function toggleFaqItem(btn: HTMLButtonElement) {
	const item = btn.closest('.faq-item')
	if (item) {
		item.classList.toggle('open')
	}
}

export default function AgentPage() {
	const { checkoutUrl } = useLoaderData<typeof loader>()
	const navRef = useRef<HTMLElement>(null)
	const stickyBarRef = useRef<HTMLDivElement>(null)
	const stackRef = useRef<HTMLDivElement>(null)
	const counterRef = useRef<HTMLDivElement>(null)
	const currentIdxRef = useRef(0)

	// Scroll-based nav animation + sticky bar
	useEffect(() => {
		const nav = navRef.current
		const stickyBar = stickyBarRef.current
		if (!nav || !stickyBar) return

		const onScroll = () => {
			const y = window.scrollY
			nav.classList.toggle('scrolled', y > 40)
			stickyBar.classList.toggle('visible', y > window.innerHeight * 0.7)
		}

		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	// Intersection Observer for fade-up animations
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						requestAnimationFrame(() => {
							requestAnimationFrame(() => {
								e.target.classList.add('visible')
							})
						})
						observer.unobserve(e.target)
					}
				})
			},
			{ threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
		)

		document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el))

		return () => observer.disconnect()
	}, [])

	// Counter animation
	useEffect(() => {
		const counterObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						const el = e.target as HTMLElement
						const target = parseInt(el.dataset.count || '0', 10)
						const suffix = el.dataset.suffix || ''
						const duration = 1800
						const start = performance.now()

						const tick = (now: number) => {
							const p = Math.min((now - start) / duration, 1)
							const ease = 1 - Math.pow(1 - p, 4)
							const val = Math.round(ease * target)
							el.textContent =
								(target >= 1000 ? val.toLocaleString() : String(val)) +
								(suffix ? ' ' + suffix : '')
							if (p < 1) requestAnimationFrame(tick)
						}

						requestAnimationFrame(tick)
						counterObserver.unobserve(el)
					}
				})
			},
			{ threshold: 0.5 },
		)

		document.querySelectorAll('[data-count]').forEach((el) => counterObserver.observe(el))

		return () => counterObserver.disconnect()
	}, [])

	// Swipe demo card system
	const setupDrag = useCallback((card: HTMLElement) => {
		let startX = 0
		let startY = 0
		let dx = 0
		let dy = 0
		let dragging = false
		const applyLabel = card.querySelector('.swipe-label-apply') as HTMLElement
		const skipLabel = card.querySelector('.swipe-label-skip') as HTMLElement
		const glow = card.querySelector('.demo-card-glow') as HTMLElement

		function onStart(e: MouseEvent | TouchEvent) {
			dragging = true
			card.setAttribute('data-dragging', 'true')
			card.style.transition = 'none'
			const pt = 'touches' in e ? e.touches[0] : e
			startX = pt.clientX
			startY = pt.clientY
		}

		function onMove(e: MouseEvent | TouchEvent) {
			if (!dragging) return
			const pt = 'touches' in e ? e.touches[0] : e
			dx = pt.clientX - startX
			dy = pt.clientY - startY
			const rot = dx * 0.08
			card.style.transform = `translate(${dx}px,${dy}px) rotate(${rot}deg)`
			const pct = Math.min(Math.abs(dx) / 120, 1)
			if (dx > 0) {
				applyLabel.style.opacity = String(pct)
				skipLabel.style.opacity = '0'
				glow.style.opacity = String(pct * 0.3)
				glow.style.background =
					'radial-gradient(circle at 30% 50%, rgba(34,197,94,0.25), transparent 70%)'
			} else {
				skipLabel.style.opacity = String(pct)
				applyLabel.style.opacity = '0'
				glow.style.opacity = String(pct * 0.3)
				glow.style.background =
					'radial-gradient(circle at 70% 50%, rgba(239,68,68,0.25), transparent 70%)'
			}
		}

		function onEnd() {
			if (!dragging) return
			dragging = false
			card.removeAttribute('data-dragging')
			if (Math.abs(dx) > 100) {
				flyOut(card, dx > 0 ? 1 : -1)
			} else {
				card.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)'
				card.style.transform = 'scale(1) translateY(0)'
				applyLabel.style.opacity = '0'
				skipLabel.style.opacity = '0'
				glow.style.opacity = '0'
			}
		}

		card.addEventListener('mousedown', onStart)
		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onEnd)
		card.addEventListener('touchstart', onStart, { passive: true })
		document.addEventListener('touchmove', onMove, { passive: true })
		document.addEventListener('touchend', onEnd)

		return () => {
			card.removeEventListener('mousedown', onStart)
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseup', onEnd)
			card.removeEventListener('touchstart', onStart)
			document.removeEventListener('touchmove', onMove)
			document.removeEventListener('touchend', onEnd)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const flyOut = useCallback(
		(card: HTMLElement, dir: number) => {
			card.style.transition =
				'transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease'
			card.style.transform = `translate(${dir * 600}px, -60px) rotate(${dir * 30}deg)`
			card.style.opacity = '0'
			setTimeout(() => {
				currentIdxRef.current++
				renderCards()
			}, 350)
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	)

	const renderCards = useCallback(() => {
		const stack = stackRef.current
		const counterEl = counterRef.current
		if (!stack || !counterEl) return

		stack.innerHTML = ''
		const remaining = JOBS.length - currentIdxRef.current
		if (remaining <= 0) {
			const emptyDiv = document.createElement('div')
			emptyDiv.className = 'demo-empty'
			emptyDiv.innerHTML =
				'<p style="color:var(--text-muted);font-size:15px;">All caught up!</p>'
			const resetBtn = document.createElement('button')
			resetBtn.className = 'demo-reset-btn'
			resetBtn.textContent = 'See them again'
			resetBtn.addEventListener('click', () => {
				currentIdxRef.current = 0
				renderCards()
			})
			emptyDiv.appendChild(resetBtn)
			stack.appendChild(emptyDiv)
			counterEl.textContent = ''
			return
		}
		counterEl.textContent = currentIdxRef.current + ' / ' + JOBS.length

		const show = Math.min(remaining, 3)
		for (let i = show - 1; i >= 0; i--) {
			const job = JOBS[currentIdxRef.current + i]
			const card = document.createElement('div')
			card.className = 'demo-card'
			card.style.zIndex = String(10 - i)
			const scale = 1 - i * 0.04
			const ty = i * 12
			card.style.transform = `scale(${scale}) translateY(${ty}px)`
			card.style.opacity = i === 0 ? '1' : String(0.6 - i * 0.15)
			card.style.transition =
				'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease'
			if (i === 0) card.setAttribute('data-top', 'true')
			card.innerHTML = `<div class="swipe-label swipe-label-apply">APPLY</div><div class="swipe-label swipe-label-skip">SKIP</div><div class="demo-card-glow"></div><div class="dc-top"><span class="dc-company">${job.company}</span><span class="dc-match"><span class="dc-match-dot"></span>${job.match}% match</span></div><div class="dc-role">${job.role}</div><div class="dc-meta">${job.tags.map((t) => '<span class="dc-tag">' + t + '</span>').join('')}</div><div class="dc-why"><div class="dc-why-label">Why you matched</div><div class="dc-why-text">${job.why}</div></div>`
			stack.appendChild(card)
		}
		const topCard = stack.querySelector('[data-top="true"]') as HTMLElement | null
		if (topCard) setupDrag(topCard)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setupDrag])

	// Initialize swipe demo
	useEffect(() => {
		renderCards()
	}, [renderCards])

	// Button handlers for demo
	const handleSkip = useCallback(() => {
		const stack = stackRef.current
		if (!stack) return
		const top = stack.querySelector('[data-top="true"]') as HTMLElement | null
		if (top) flyOut(top, -1)
	}, [flyOut])

	const handleApply = useCallback(() => {
		const stack = stackRef.current
		if (!stack) return
		const top = stack.querySelector('[data-top="true"]') as HTMLElement | null
		if (top) {
			const label = top.querySelector('.swipe-label-apply') as HTMLElement | null
			if (label) label.style.opacity = '1'
			flyOut(top, 1)
		}
	}, [flyOut])

	// CTA click handlers with analytics
	const handleCtaClick = useCallback(
		(location: string) => {
			trackCtaClick('agent_get_started', location, checkoutUrl)
		},
		[checkoutUrl],
	)

	const handleFaqToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		toggleFaqItem(e.currentTarget)
	}, [])

	return (
		<div
			className="agent-page"
			style={{
				background: '#08080A',
				color: '#FAFAFA',
				fontFamily: "'Nunito Sans', -apple-system, sans-serif",
				WebkitFontSmoothing: 'antialiased',
				MozOsxFontSmoothing: 'grayscale',
				overflowX: 'hidden',
				lineHeight: 1.5,
				minHeight: '100vh',
			}}
		>
			<style dangerouslySetInnerHTML={{ __html: pageStyles }} />

			<nav className="nav" id="nav" ref={navRef}>
				<Link to="/" className="nav-logo" reloadDocument>
					<span className="nav-logo-dot" />
					Resume Tailor
				</Link>
				<div className="nav-links">
					<Link to="/pricing" className="nav-link" reloadDocument>
						Pricing
					</Link>
					<Link to="/builder" className="nav-link" reloadDocument>
						Builder
					</Link>
					<Link to="#pricing" className="nav-cta-btn">
						Get your agent
					</a>
				</div>
			</nav>

			<div className="sticky-bar" id="stickyBar" ref={stickyBarRef}>
				<span className="sticky-bar-text">
					<strong>Career Agent</strong> — limited to 50 members
				</span>
				<a
					href={checkoutUrl}
					className="sticky-bar-cta"
					onClick={() => handleCtaClick('sticky_bar')}
				>
					Get your agent — $99/mo
				</a>
			</div>

			<section className="hero">
				<div className="hero-pill fade-up">
					<span className="hero-pill-dot" />
					Now accepting members
				</div>
				<h1 className="fade-up fade-up-d1">
					Stop applying
					<br />
					to <span className="gradient-text">jobs.</span>
				</h1>
				<p className="hero-sub fade-up fade-up-d2">
					Your AI career agent finds roles you'll love, tailors your resume for each
					one, and applies on your behalf. You just swipe yes.
				</p>
				<div className="hero-ctas fade-up fade-up-d3">
					<a
						href={checkoutUrl}
						className="btn-primary"
						onClick={() => handleCtaClick('hero')}
					>
						Get your agent
						<span className="arrow">→</span>
					</a>
					<span className="hero-note">Limited to 50 members · Cancel anytime</span>
				</div>
			</section>

			<div className="proof-bar">
				<div className="proof-item fade-up">
					<div className="proof-num" data-count="16000">
						0
					</div>
					<div className="proof-label">Resumes tailored</div>
				</div>
				<div className="proof-item fade-up fade-up-d1">
					<div className="proof-num" data-count="57" data-suffix="%">
						0
					</div>
					<div className="proof-label">Trial → paid conversion</div>
				</div>
				<div className="proof-item fade-up fade-up-d2">
					<div className="proof-num" data-count="30" data-suffix="sec">
						0
					</div>
					<div className="proof-label">Average tailoring time</div>
				</div>
			</div>

			<section className="section">
				<div className="section-center">
					<p className="section-label fade-up">The job search is designed against you</p>
					<h2 className="section-title fade-up fade-up-d1">
						You deserve an agent,
						<br />
						not another tool.
					</h2>
				</div>

				<div className="contrast-grid">
					<div className="contrast-card old-card fade-up">
						<div className="contrast-card-title">How you apply today</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-bad">×</span>
							<span>2 hours rewriting your resume for every application</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-bad">×</span>
							<span>
								Scrolling job boards endlessly, saving tabs you never revisit
							</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-bad">×</span>
							<span>
								Copy-pasting into broken ATS forms that destroy your formatting
							</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-bad">×</span>
							<span>50 generic applications. Zero callbacks. Repeat.</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-bad">×</span>
							<span>
								Doing all of this while working full-time or financially stressed
							</span>
						</div>
					</div>
					<div className="contrast-card new-card fade-up fade-up-d1">
						<div className="contrast-card-title">With your career agent</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-good">✓</span>
							<span>
								Agent finds high-match roles tailored to your experience and goals
							</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-good">✓</span>
							<span>
								Each resume custom-built for the specific job, ATS-optimized every
								time
							</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-good">✓</span>
							<span>
								You review matches and swipe yes or no — that's your
								entire job
							</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-good">✓</span>
							<span>
								Your agent submits polished applications on your behalf
							</span>
						</div>
						<div className="contrast-item">
							<span className="contrast-icon icon-good">✓</span>
							<span>
								You show up when there's an interview. Nothing else.
							</span>
						</div>
					</div>
				</div>
			</section>

			<div className="demo-wrap">
				<p className="section-label fade-up">This is what it feels like</p>
				<div style={{ height: '24px' }} />
				<div
					className="demo-stack fade-up fade-up-d1"
					id="demoStack"
					ref={stackRef}
				/>
				<div className="demo-actions fade-up fade-up-d2">
					<button
						className="demo-btn demo-btn-skip"
						id="btnSkip"
						title="Skip"
						onClick={handleSkip}
					>
						×
					</button>
					<button
						className="demo-btn demo-btn-go"
						id="btnApply"
						title="Apply"
						onClick={handleApply}
					>
						♥
					</button>
				</div>
				<p className="demo-hint fade-up fade-up-d3">
					Drag the card or tap <span>♥</span> — your agent handles the rest
				</p>
				<div className="demo-counter" id="demoCounter" ref={counterRef} />
			</div>

			<section className="section section-narrow">
				<div className="section-center">
					<p className="section-label fade-up">How it works</p>
					<h2 className="section-title fade-up fade-up-d1">
						Three steps.
						<br />
						Zero grind.
					</h2>
					<p className="section-sub fade-up fade-up-d2">
						Like having a Hollywood talent agent — except it costs $99 a month, not
						10% of your salary.
					</p>
				</div>

				<div className="steps-list">
					<div className="step-row fade-up">
						<span className="step-num">1</span>
						<div className="step-content">
							<h3>Tell us who you are</h3>
							<p>
								Upload your resume and tell us what you're looking for —
								roles, companies, locations, salary range. Takes 5 minutes, once.
							</p>
						</div>
					</div>
					<div className="step-row fade-up">
						<span className="step-num">2</span>
						<div className="step-content">
							<h3>Swipe on your matches</h3>
							<p>
								Every week your agent surfaces 10–15 high-quality roles that
								actually fit your experience. Swipe yes on the ones you want. Skip
								the rest.
							</p>
						</div>
					</div>
					<div className="step-row fade-up">
						<span className="step-num">3</span>
						<div className="step-content">
							<h3>Your agent applies for you</h3>
							<p>
								For every role you approve, your agent tailors your resume, fills
								the application, and submits. You get notified when it's done.
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="section">
				<div className="section-center">
					<p className="section-label fade-up">What's included</p>
					<h2 className="section-title fade-up fade-up-d1">
						Everything you need.
						<br />
						Nothing you don't.
					</h2>
				</div>

				<div className="features-grid">
					<div className="feature-card fade-up">
						<div className="feature-icon">&#127919;</div>
						<h4>Curated matching</h4>
						<p>
							10–15 roles weekly, selected for your skills, goals, and
							preferences. No spray and pray.
						</p>
					</div>
					<div className="feature-card fade-up fade-up-d1">
						<div className="feature-icon">&#128196;</div>
						<h4>Auto-tailored resumes</h4>
						<p>
							Each application gets a custom resume — right keywords, right
							structure, ATS-ready.
						</p>
					</div>
					<div className="feature-card fade-up fade-up-d2">
						<div className="feature-icon">&#128640;</div>
						<h4>Agent applies for you</h4>
						<p>
							Your agent submits polished applications on your behalf. You just
							approve and wait.
						</p>
					</div>
					<div className="feature-card fade-up">
						<div className="feature-icon">&#128202;</div>
						<h4>Application dashboard</h4>
						<p>
							Track every application, status update, and response in one place. No
							more spreadsheets.
						</p>
					</div>
					<div className="feature-card fade-up fade-up-d1">
						<div className="feature-icon">&#128175;</div>
						<h4>ATS scoring</h4>
						<p>
							See exactly how each resume scores against the job. Keywords matched,
							gaps flagged, 0–100.
						</p>
					</div>
					<div className="feature-card fade-up fade-up-d2">
						<div className="feature-icon">&#128274;</div>
						<h4>Full Resume Tailor access</h4>
						<p>
							Includes the complete builder, manual tailoring, and unlimited resume
							versions.
						</p>
					</div>
				</div>
			</section>

			<section className="testimonial-section fade-up">
				<div className="testimonial-stars">&#9733; &#9733; &#9733; &#9733; &#9733;</div>
				<p className="testimonial-quote">
					"I was mass-applying with the same resume for months. After tailoring with
					Resume Tailor, I got 3 interview callbacks in my first week."
				</p>
				<div className="testimonial-author">
					<strong>Sarah M.</strong> · Product Designer
				</div>
				<div className="testimonial-outcome">✓ Hired at a Series B startup</div>
			</section>

			<section className="pricing-wrap" id="pricing">
				<p className="section-label fade-up">Simple pricing</p>
				<h2 className="section-title fade-up fade-up-d1">
					One plan. One agent.
					<br />
					One price.
				</h2>

				<div className="price-card fade-up fade-up-d2">
					<p className="price-tier">Career Agent</p>
					<div className="price-amount">$99</div>
					<p className="price-per">per month · cancel anytime</p>

					<div className="price-features">
						<div className="pf-item">
							<span className="pf-check">✓</span>
							<span>10–15 curated role matches every week</span>
						</div>
						<div className="pf-item">
							<span className="pf-check">✓</span>
							<span>Custom-tailored resume per application</span>
						</div>
						<div className="pf-item">
							<span className="pf-check">✓</span>
							<span>Agent applies on your behalf</span>
						</div>
						<div className="pf-item">
							<span className="pf-check">✓</span>
							<span>Application dashboard & status tracking</span>
						</div>
						<div className="pf-item">
							<span className="pf-check">✓</span>
							<span>Full Resume Tailor builder access</span>
						</div>
					</div>

					<a
						href={checkoutUrl}
						className="price-cta"
						onClick={() => handleCtaClick('pricing')}
					>
						Get your agent →
					</a>
					<div className="spots-badge">
						<span className="spots-dot" />
						Limited to 50 members
					</div>
					<div className="guarantee">7-day money-back guarantee</div>
				</div>
			</section>

			<section className="faq-section">
				<h2
					className="section-title fade-up"
					style={{ marginBottom: '48px' }}
				>
					Questions
				</h2>

				<div className="faq-item fade-up">
					<button className="faq-q" onClick={handleFaqToggle}>
						How is this different from Resume Tailor's builder?
						<span className="faq-icon">+</span>
					</button>
					<div className="faq-a">
						<div className="faq-a-inner">
							The builder is a self-serve tool — you tailor resumes yourself. The
							Career Agent is a done-for-you service. We find roles, tailor your resume
							for each one, and submit applications on your behalf. You just approve
							matches.
						</div>
					</div>
				</div>
				<div className="faq-item fade-up">
					<button className="faq-q" onClick={handleFaqToggle}>
						How do you find job matches?
						<span className="faq-icon">+</span>
					</button>
					<div className="faq-a">
						<div className="faq-a-inner">
							We combine AI matching with human curation. We scan thousands of listings
							across company career pages, job boards, and ATS platforms — then
							filter to the 10–15 that genuinely fit your skills, preferences, and
							career goals each week.
						</div>
					</div>
				</div>
				<div className="faq-item fade-up">
					<button className="faq-q" onClick={handleFaqToggle}>
						Do you actually apply, or just prepare materials?
						<span className="faq-icon">+</span>
					</button>
					<div className="faq-a">
						<div className="faq-a-inner">
							We actually apply. When you approve a match, your agent tailors the
							resume, fills out the application, and submits it. You get a notification
							when it's done with a record in your dashboard.
						</div>
					</div>
				</div>
				<div className="faq-item fade-up">
					<button className="faq-q" onClick={handleFaqToggle}>
						What if I find a job quickly?
						<span className="faq-icon">+</span>
					</button>
					<div className="faq-a">
						<div className="faq-a-inner">
							That's the goal. Cancel anytime — no contracts, no fees. If
							our agent helps you land a role in month one, you've spent $99
							instead of months of your own time.
						</div>
					</div>
				</div>
				<div className="faq-item fade-up">
					<button className="faq-q" onClick={handleFaqToggle}>
						Why only 50 members?
						<span className="faq-icon">+</span>
					</button>
					<div className="faq-a">
						<div className="faq-a-inner">
							Quality. Every match is human-reviewed. We'd rather deliver 15
							great matches than 100 mediocre ones. We'll expand capacity as we
							scale, but right now, fewer members means better results for each person.
						</div>
					</div>
				</div>
				<div className="faq-item fade-up">
					<button className="faq-q" onClick={handleFaqToggle}>
						Is my data private?
						<span className="faq-icon">+</span>
					</button>
					<div className="faq-a">
						<div className="faq-a-inner">
							Yes. Your resume and personal information are never shared with third
							parties. We use your data only to find and apply to jobs on your behalf.
							You can delete everything at any time.
						</div>
					</div>
				</div>
			</section>

			<section className="final-cta">
				<h2 className="final-headline fade-up">
					Every hour you spend applying is an hour you'll never get back.
				</h2>
				<p className="final-sub fade-up fade-up-d1">
					Your next interview is one swipe away.
				</p>
				<div className="final-btn-wrap fade-up fade-up-d2">
					<a
						href={checkoutUrl}
						className="btn-primary"
						onClick={() => handleCtaClick('final_cta')}
					>
						Get your agent
						<span className="arrow">→</span>
					</a>
				</div>
			</section>

			<footer className="footer">
				<span>© 2026 Resume Tailor</span>
				<div className="footer-links">
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
