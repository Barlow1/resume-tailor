# Resume Tailor - Codebase Audit

**Date**: 2026-03-06
**Branch audited**: `os` (with `apply` branch reviewed for pipeline models)
**Purpose**: Inform Agent Tier ($99/mo) implementation

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Remix (Express adapter) | 2.3.0 |
| Language | TypeScript | 5.1.6 |
| Runtime | Node.js | 18.x |
| Database | SQLite (via Prisma ORM) | Prisma 5.1.1 |
| Distributed DB | LiteFS | 0.5.1 |
| AI/LLM | OpenAI (gpt-5.2, gpt-4o, gpt-5-mini) | openai 4.80.0 |
| Styling | Tailwind CSS | 3.3.2 |
| UI Primitives | Radix UI + Headless UI | Various |
| Icons | Heroicons, Lucide, FontAwesome | Various |
| Forms | Conform + Zod | 0.7.4 / 3.21.4 |
| Auth | remix-auth (form + OAuth: Google, GitHub, LinkedIn) | 3.5.0 |
| Payments | Stripe | 14.14.0 |
| Email | Resend + React Email | - |
| PDF Export | Puppeteer (headless Chrome) | 24.0.0 |
| Resume Parsing | pdf-parse-fork, mammoth (DOCX) | - |
| Analytics | PostHog, LogRocket, Sentry, Google Analytics | Various |
| CRM | HubSpot | 11.1.0 |
| Chat | Crisp | 1.0.25 |
| Testing | Playwright (E2E) + Vitest (unit) | 1.36.1 / 0.33.0 |
| Hosting | Fly.io (Docker, us-east/iad) | - |
| CI/CD | GitHub Actions | - |

---

## 2. Project Structure

```
resume-tailor/
  app/
    components/          # ~75 React components
      ui/                # Primitives: Button, Input, Dialog, Toast, Dropdown (22 files)
      thirdcomponent/    # Landing page sections (Hero, Section2-8)
      pipeline/          # Pipeline components (apply branch only, 13 files)
    routes/              # 102 route files (Remix flat routes with + grouping)
      _auth+/            # Login, signup, forgot-password, verify, onboarding
      _marketing+/       # Homepage, about, privacy, TOS, support
      admin+/            # bullet-qa, cache management
      ai-resume-builder+/
      analyze+/          # Resume-JD analysis
      builder+/          # Visual resume builder
      gettingstarted+/   # Onboarding: tailor, generate, upload flows
      jobs+/             # Job management
      outreach+/         # Recruiter outreach
      pricing+/          # Pricing page
      resources+/        # API endpoints (~35 resource routes)
      settings+/         # Profile, photo, 2FA
      users+/            # User profiles, job/resume management
      blog+/             # MDX blog
      pipeline+/         # Pipeline routes (apply branch only)
    utils/               # ~47 server/client utilities
    prompts/             # AI prompt templates (versioned)
    hooks/               # Custom React hooks
    lib/                 # Keyword databases, careerfit
    types/               # TypeScript definitions
    styles/              # Global CSS, Tailwind
  prisma/
    schema.prisma        # 15 core + 17 builder models
    data.db              # SQLite database
  server/                # Express server (dev + prod)
  other/                 # Dockerfile, LiteFS config, build scripts
  .github/workflows/     # CI/CD pipeline
```

---

## 3. Database Models (Current `os` Branch)

### Core User & Auth
- **User**: id, email, username, name, stripeCustomerId, roles[], sessions[], subscriptions[]
- **Password**: bcrypt hash linked to User
- **Session**: cookie-based, 30-day expiry, stored in DB
- **Role / Permission**: RBAC system (admin role exists)
- **Verification**: OTP codes for email verify, 2FA, password reset

### Resume & Builder
- **Resume**: personal info, summary, linked to Experience[], Education[], Skill[], File
- **BuilderResume**: modern builder with layout/font/color controls, linked to BuilderExperience[], BuilderEducation[], BuilderSkill[], BuilderHobby[], BuilderHeaders, BuilderVisibleSections, ResumeScore[]
- **File**: binary blob storage for uploaded PDFs/DOCXs
- **Image**: profile images

### Job & Analysis
- **Job**: title, company, content (JD text), extractedKeywords, ownerId
- **Analysis**: JD text, resume text, fitPct, feedback, peopleJson
- **ResumeScore**: per resume-job pair scoring (overall, keyword, metrics, action verbs, length, formatting)
- **TailoredResume**: originalResume (JSON), jobDescription, tailoredResume (JSON), promptVersion
- **BulletTailorLog**: audit trail for individual bullet tailoring actions

### Payments & Tracking
- **Subscription**: stripeCustomerId, active, stripeSubscriptionId, stripeProductId, stripePriceId
- **ConversionEvent**: userId, planTier, priceUsd, eventType (subscription_started, purchase_completed)
- **GettingStartedProgress**: onboarding step tracking

### Pipeline Models (on `apply` branch, not yet merged)
- **CandidateProfile**: full career profile with structured JSON fields (hardSkills, softEvidence, differentiators, constraints, gaps, positioning)
- **IntakeConversation**: multi-turn Q&A messages, step tracking, gap detection
- **Application**: job info + tailored resume + cover letter + status tracking
- **JobMatch**: fitScore, explanation, matchReason, job details, status

---

## 4. Resume Tailoring Flow (End-to-End)

### Upload & Parse
1. User uploads PDF/DOCX via drag-and-drop
2. Text extracted: `pdf-parse-fork` (PDF) or `mammoth` (DOCX)
3. OpenAI GPT-4o parses into structured `OpenAIResumeData` (personal info, experiences with bullets, education, skills, projects, certs)
4. Stored in Prisma Resume/BuilderResume models

### Job Description Ingestion
- User copy-pastes job title + description text
- Stored in Job model
- Optional keyword extraction via GPT (hard skills, soft skills, primary keywords)

### AI Tailoring (Two Modes)
1. **Batch Resume Tailoring** (`resume-tailor.server.ts`):
   - GPT-5.2, temperature 0.4, JSON mode
   - Input: full parsed resume + JD
   - Output: enhanced_bullets[], suggested_bullets[], gaps[], enhanced_summary
   - Stored in TailoredResume model with prompt version

2. **Streaming Bullet Tailoring** (`resources/completions`, `resources/experience-tailor`):
   - SSE streaming via remix-utils
   - Returns 3 strategic rewrites per bullet (Impact, Alignment, Transferable angles)
   - Diagnostic modes: no-metrics, weak-verb, missing-keywords
   - Actions logged in BulletTailorLog

### Resume Analysis
- `careerfit.server.ts`: `getAiFeedback()` returns fitPct, strengths, weaknesses, red flags, keyword analysis
- Streaming version via SSE at `/resources/analyze-stream`
- Job fit scoring: responsibilities (40%) + skills (40%) + seniority (20%)

### PDF Export
- Puppeteer renders HTML to PDF
- Smart page-break algorithm (Letter size: 816x1056px)
- Waits for Google Fonts to load
- Multi-page support with automatic content wrapping

---

## 5. Auth System

- **Session-based**: cookie `_session`, HttpOnly, Secure, SameSite: Lax
- **Login methods**: username/password + reCAPTCHA, Google OAuth, GitHub OAuth, LinkedIn OAuth
- **2FA**: optional TOTP verification
- **Key helpers**:
  - `requireUserId(request)` — redirects to login if unauthenticated
  - `getUserId(request)` — returns userId or null
  - `requireAdmin(request)` — gates admin routes

---

## 6. Payment System

### Current Plans
| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | 6 tailored experiences, 6 generated, PDF export |
| Pro (Weekly) | $4.99/week | Unlimited tailoring, builder, parsing, dedicated support |
| Pro (Monthly) | $15/month | Same as weekly |

- 3-day free trial on Pro
- Stripe checkout with webhook-driven activation

### Stripe Integration
- **Env vars**: `STRIPE_SK`, `STRIPE_PRODUCT_ID`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_WEEKLY`
- **Webhook events**: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_succeeded`
- **Key function**: `requireStripeSubscription({ userId, successUrl, cancelUrl, frequency })` — creates customer if needed, checks for active sub, redirects to checkout if none
- **Billing portal**: Stripe-hosted, accessed via `/resources/stripe/manage-subscription`
- **Subscription model**: id, stripeCustomerId, active (boolean), stripeSubscriptionId, stripeProductId, stripePriceId

### Adding Agent Tier
- Need new Stripe Product + Price ($99/month)
- Add `STRIPE_PRICE_ID_AGENT` env var
- Extend `requireStripeSubscription` to handle tier-specific gating (not just active/inactive)
- The current system only checks "has active subscription" — needs to distinguish Pro vs Agent

---

## 7. Email System

- **Provider**: Resend (`RESEND_API_KEY`)
- **Templating**: React Email (`@react-email/components`)
- **From**: `hello@resumetailor.ai`
- **Current templates**: SignupEmail, ForgotPasswordEmail, ForgotUsernameEmail
- **Fallback**: If no API key, emails logged to console
- **Ready for**: Weekly digest and notification emails (infrastructure exists, just need new templates)

---

## 8. Admin Tooling

### Existing Admin Routes
- `/admin/bullet-qa` — Browse bullet tailor logs, filter by action/date, pagination
- `/admin/bullet-qa-export` — CSV export of QA data
- `/admin/cache` — SQLite + LRU cache management
- **Gated by**: `requireAdmin(request)`

### For Agent Tier
- Admin routes already follow a pattern we can extend
- No existing "user management" admin view — would need to build user queue

---

## 9. UI Patterns & Conventions

### Styling
- Tailwind CSS for most components
- Inline styles (`CSSProperties`) for landing page animations and dynamic theming
- Landing page colors: `#08080A` bg, `#6B45FF` brand purple, `#FAFAFA` text
- Pipeline (apply branch) uses different palette: `#09090b` bg, `#c4956a` warm accent
- Glass effects: `backdrop-filter: blur(20px)`, semi-transparent backgrounds

### Component Patterns
- Radix UI primitives (Dialog, Dropdown, Toast, Checkbox, Tooltip)
- `Button` with CVA variants: default, primary, destructive, outline, secondary, ghost
- `Field` / `TextareaField` / `CheckboxField` from Conform integration
- `StatusButton` for async submissions (pending/success/error states)
- `DialogModal` for modals (sm/md/lg sizes)
- `FadeUp` for scroll-triggered animations (Intersection Observer)
- `GeneralErrorBoundary` + Sentry for error handling

### Layout
- Purple sidebar (#6B45FF) on desktop, collapsible (350px -> 100px)
- Sticky header bar with theme toggle + user dropdown
- Mobile: hamburger menu with full-width drawer
- Builder routes: full-screen, no sidebar
- Landing page: glass-effect fixed nav

### State Management
- Server state via Remix loaders/actions (no client state library)
- `useFetcher()` for background requests
- `localStorage` for sidebar collapse state
- Flash sessions for one-time toast notifications

---

## 10. Pipeline Feature (Apply Branch)

The `apply` branch has significant infrastructure already built:

### Models (see Section 3)
- CandidateProfile, IntakeConversation, Application, JobMatch

### Routes
- `/pipeline/` — index, intake, conversation, positioning, matches, add-jobs, tracking, profile, application.$applicationId

### Components (13 files)
- intake-upload, conversation-screen, extraction-feed, positioning-card, match-card, application-prep, tracking-list, pipeline-layout, pipeline-nav, pipeline-status, confidence-badge, profile-section, stat-bar

### Server Utils
- profile-extraction, intake-conversation, positioning, job-matching, application-generation, job-search, adzuna, themuse, jsearch

### Job Board APIs
- **Adzuna**: US job search, truncated descriptions
- **The Muse**: Full HTML descriptions, category-based
- **JSearch**: Google for Jobs aggregator, full descriptions + salary data
- Pipeline: LLM generates queries -> fetches all 3 in parallel -> dedupes -> LLM scores -> persists

---

## 11. Technical Debt & Scaling Concerns

### Critical for Agent Tier

1. **SQLite single-writer bottleneck**: LiteFS helps with reads, but writes are single-threaded. With admin/VA writing matches for many users + users interacting, write contention could become an issue at scale. Not a problem for first 5-50 users.

2. **Subscription tier check is binary**: `requireStripeSubscription()` only checks active/inactive. No concept of plan tiers. Must extend to support Free vs Pro vs Agent gating.

3. **No background job system**: No queues, no cron, no workers. Everything is request-driven. For Agent tier: weekly digests, status checks, and automated job search would benefit from a job queue (e.g., BullMQ, or a simple cron hitting internal endpoints).

4. **No file/document storage service**: PDFs stored as blobs in SQLite. For Agent tier storing tailored resumes, cover letters, and application confirmations, this could bloat the DB. Consider S3/R2 for larger scale.

5. **Pipeline models on `apply` branch**: CandidateProfile, JobMatch, Application models exist but aren't merged. Decision needed: merge `apply` first, or build Agent tier on `os` with new models.

### Moderate Concerns

6. **Puppeteer for PDF**: Heavy dependency (Chromium). Works but slow. Each PDF generation spins up a browser. Acceptable for current scale.

7. **No rate limiting on AI endpoints**: OpenAI calls aren't rate-limited per user. Agent tier users generating many tailored resumes could spike costs.

8. **102 route files**: Growing complexity. Flat routes pattern helps but the codebase is getting large.

9. **OpenAI model versions hardcoded**: `gpt-5.2`, `gpt-4o`, `gpt-5-mini` scattered across files. Should centralize model selection.

### Not Concerning Now
- Test coverage exists (Playwright E2E + Vitest unit)
- CI/CD pipeline is solid (lint, typecheck, test, deploy)
- Auth system is battle-tested
- Stripe integration is standard and clean

---

## 12. What Can Be Reused for Agent Tier

| Existing | Reuse For |
|----------|-----------|
| Resume parsing (GPT-4o) | Agent onboarding — parse user's base resume |
| Resume tailoring (GPT-5.2) | Auto-tailor for approved matches |
| Job fit analysis (careerfit.server.ts) | Score jobs found by admin/VA |
| Keyword extraction | Enhance match rationale |
| PDF export (Puppeteer) | Export tailored resumes for applications |
| Stripe integration | Add Agent tier price |
| Email system (Resend) | Weekly digest, match notifications |
| Admin route pattern | Build admin panel for VA |
| CandidateProfile model (apply branch) | User profile / onboarding data |
| JobMatch model (apply branch) | Job matches feed |
| Application model (apply branch) | Application tracking |
| SSE streaming | Real-time updates in dashboard |
| Toast system | Notifications for match approvals |
| Recruiter outreach generation | Auto-generate cover letters / messages |

---

## 13. Key Decisions Needed Before Building

1. **Merge `apply` branch first?** It has CandidateProfile, JobMatch, Application models + pipeline UI. We could extend these for Agent tier rather than building from scratch. Recommended: yes, merge it.

2. **Pipeline design system**: The `apply` branch uses warm accent (#c4956a) while main app uses purple (#6B45FF). Agent tier pages should use... which? Recommendation: stick with the main purple brand, Agent is a premium extension of the core product.

3. **Background jobs**: How to handle weekly digest emails and periodic status updates? Options: (a) Fly.io cron via scheduled machines, (b) external cron hitting internal API endpoints, (c) add a proper job queue. Recommendation: start with (b), simplest.

4. **Admin access for VA**: Use existing `requireAdmin` role, or create a new `agent_operator` role? Recommendation: reuse admin role for MVP, add role granularity later.
