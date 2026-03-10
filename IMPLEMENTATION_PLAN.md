# Implementation Plan: Agent Tier ($99/month)

**Goal**: Get to 5 paying Agent tier users as fast as possible with a human-powered MVP.

---

## Critical Path

```
1. Merge apply branch pipeline models     [S]   ← unblocks everything
2. Add Agent tier to Stripe + gating      [M]   ← users can pay
3. Agent onboarding flow                  [M]   ← users provide preferences
4. Admin: add matches for users           [M]   ← VA can operate
5. Job matches feed (user-facing)         [M]   ← users see & approve matches
6. Admin: log applications                [S]   ← VA records what they did
7. Application pipeline dashboard         [M]   ← users see status
8. Weekly digest email                    [M]   ← users feel the service is active
```

**Everything else can wait.**

---

## Phase 1A: Foundation (Build First)

### 1. Merge `apply` Branch Pipeline Models
**Complexity**: S
**What**: Merge the Prisma schema additions from `apply` branch (CandidateProfile, IntakeConversation, Application, JobMatch) into `os`/`main`.
**Why first**: All Agent tier features depend on these models.
**Reuse**: 100% — models already exist, just need to be on the right branch.
**Caveat**: Review if any schema changes are needed for Agent tier (see modifications below).

**Schema Modifications Needed:**

```prisma
// Extend CandidateProfile (already exists on apply branch)
model CandidateProfile {
  // ... existing fields ...

  // Add for Agent tier:
  targetRoles        String?  // JSON: ["Senior PM", "Product Lead"]
  targetCompanies    String?  // JSON: ["Google", "Stripe", "Notion"]
  targetIndustries   String?  // JSON: ["SaaS", "Fintech"]
  companySizePref    String?  // "startup" | "mid" | "enterprise" | "any"
  salaryMin          Int?
  salaryMax          Int?
  dealbreakers       String?  // JSON: ["travel >20%", "on-site only"]
  agentActive        Boolean  @default(false)  // pause/resume
  agentStartedAt     DateTime?
}

// Extend JobMatch (already exists on apply branch)
model JobMatch {
  // ... existing fields ...

  // Add for Agent tier:
  addedBy         String?   // "admin" | "system" | "user"
  adminNotes      String?
  salaryMin       Int?
  salaryMax       Int?
  location        String?
  remoteType      String?   // "remote" | "hybrid" | "onsite"
  sourceUrl       String?   // where admin found it
}

// Extend Application (already exists on apply branch)
model Application {
  // ... existing fields ...

  // Add for Agent tier:
  applicationMethod  String?   // "direct" | "linkedin" | "email" | "referral"
  confirmationUrl    String?   // screenshot or confirmation link
  adminNotes         String?
  followUpDates      String?   // JSON: ["2026-03-15", "2026-03-22"]
}

// NEW: Agent activity audit log
model AgentActivity {
  id        String   @id @default(cuid())
  userId    String
  createdAt DateTime @default(now())
  type      String   // "match_added" | "application_submitted" | "status_updated" | "resume_tailored"
  details   String   // JSON with activity-specific data
  actorType String   // "admin" | "system"
  actorId   String?  // admin userId if human

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}
```

### 2. Add Agent Tier to Stripe + Access Gating
**Complexity**: M
**What**:
- Create new Stripe Product + Price ($99/month) in Stripe dashboard
- Add `STRIPE_PRICE_ID_AGENT` env var
- Extend subscription system to track plan tier (not just active/inactive)
- Create `requireAgentTier(request)` helper that checks user has Agent subscription
- Add Agent tier to pricing page

**Files to modify**:
- `app/utils/stripe.server.ts` — add agent price ID, tier detection
- `app/utils/subscription.server.ts` — add `getSubscriptionTier()` function
- `app/routes/resources+/pricing.tsx` — add Agent tier card
- `app/routes/pricing+/index.tsx` — add Agent tier to pricing page
- `.env.example` — add `STRIPE_PRICE_ID_AGENT`

**Reuse**: Heavy reuse of existing Stripe integration. Extend, don't rewrite.

**Key Decision**: How to represent tier in DB?
- Option A: Use `stripePriceId` to determine tier (simple, current pattern)
- Option B: Add `tier` field to Subscription model (explicit, cleaner)
- **Recommendation**: Option A for MVP (match priceId against env vars). Migrate to B later if needed.

### 3. Agent Onboarding Flow
**Complexity**: M
**What**: New page at `/agent/setup` — multi-step form collecting:
- Target role titles (multi-select / free-text tags)
- Target industries
- Company size preferences
- Location / remote preferences
- Salary expectations (min-max range)
- Dream companies list
- Deal-breakers (free-text list)
- Select or upload base resume

**Files to create**:
- `app/routes/agent+/setup.tsx` — multi-step form route
- `app/components/agent/onboarding-form.tsx` — form component (if complex enough to extract)

**Reuse**:
- CandidateProfile model (from `apply` branch) stores all this data
- Resume upload component exists (`resources/upload-resume`)
- Conform + Zod for validation (existing pattern)
- Can reference pipeline intake flow for patterns, but simpler (no conversation, just a form)

**Design**: Should feel premium. Use the main brand purple, clean typography, progress indicator. Reference the landing page design quality (glass effects, smooth transitions). NOT the admin aesthetic.

### 4. Admin Panel: Add Matches for Users
**Complexity**: M
**What**: Admin pages for VA to operate the service.

**Routes to create**:
- `app/routes/admin+/agent-users.tsx` — list of active Agent tier users with their profiles
- `app/routes/admin+/agent-users.$userId.tsx` — single user view: their profile, preferences, current matches
- `app/routes/admin+/agent-users.$userId.add-match.tsx` — form to add a job match for a user

**Add Match Form**:
- Job URL (required)
- Job title, company, location (auto-fill if possible, manual override)
- Job description (paste)
- Salary range (optional)
- Remote type
- Match score (admin sets, 0-100)
- Match rationale (free text, shown to user)
- Admin notes (internal, not shown to user)

**Reuse**:
- Admin route pattern (`requireAdmin`)
- JobMatch model (from `apply` branch)
- Existing job creation patterns

**Nice-to-have (not MVP)**: Auto-fetch job details from URL. Would need a scraper/unfurl service. Skip for Phase 1.

---

## Phase 1B: User Experience (Build Second)

### 5. Job Matches Feed
**Complexity**: M
**What**: Page at `/agent/matches` showing job matches added by admin.

**UI**:
- Card-based feed, sorted by date added (newest first)
- Each card: company name, role title, location, remote type, salary range (if available), match score badge, 1-line rationale
- Actions per card: Approve (green) / Reject (red) / Save for Later (yellow)
- Click card to expand: full job description, match rationale detail
- Filter by status: All / Pending / Approved / Rejected
- Sort by: date, match score

**Files to create**:
- `app/routes/agent+/matches.tsx` — matches page (loader + action)
- `app/components/agent/match-card.tsx` — individual match card

**Reuse**:
- `match-card.tsx` from pipeline components (apply branch) — adapt styling
- JobMatch model for data
- Can use existing Radix components (Dialog for expand, Badge for score)

**Status flow**: `new` -> `approved` / `rejected` / `saved`
When approved: admin sees it in their queue to apply.

### 6. Admin: Log Applications
**Complexity**: S
**What**: When admin applies to a job on behalf of user, they log it.

**UI** (in admin panel, can be simple):
- On the user's match list, approved matches show "Mark as Applied" button
- Form: application date, method (direct/linkedin/email), confirmation URL/notes
- Creates Application record linked to JobMatch
- Creates AgentActivity audit log entry

**Files to modify**:
- `app/routes/admin+/agent-users.$userId.tsx` — add "Mark Applied" action

**Reuse**: Application model (apply branch), form patterns.

### 7. Application Pipeline Dashboard
**Complexity**: M
**What**: Page at `/agent/dashboard` showing the user's application pipeline.

**UI**:
- Stats bar at top: matches this week, applications sent, response rate, interviews
- Pipeline view (simple list grouped by status, not full Kanban for MVP):
  - **Matched**: jobs found for you (count)
  - **Approved**: you said yes (count)
  - **Applied**: resume sent (count + list with dates)
  - **Heard Back**: got a response (count + list)
  - **Interviewing**: active interviews (count + list)
  - **Offers**: (count)
- Each item shows: company, role, date, status, link to view tailored resume

**Files to create**:
- `app/routes/agent+/dashboard.tsx` — dashboard page
- `app/components/agent/pipeline-stats.tsx` — stats bar
- `app/components/agent/pipeline-list.tsx` — grouped list view

**Reuse**:
- `tracking-list.tsx` and `stat-bar.tsx` from pipeline components (apply branch)
- Application + JobMatch models for data

### 8. Weekly Digest Email
**Complexity**: M
**What**: Weekly email to each Agent tier user summarizing activity.

**Content**:
- "Here's what your agent did this week"
- X new matches found (link to matches page)
- X applications submitted (list with company + role)
- Any responses received
- Upcoming follow-ups scheduled
- CTA: "Review your matches" button

**Files to create**:
- `app/routes/admin+/agent-digest.tsx` — admin trigger page (button to send digests)
- `app/emails/agent-weekly-digest.tsx` — React Email template
- `app/utils/agent-digest.server.ts` — query + send logic

**For MVP**: Admin manually triggers digest via admin page button. Automate later with cron.

**Reuse**: Resend email integration, React Email templating pattern (existing auth emails as reference).

---

## Phase 1C: Polish (Build Third, Before Launch)

### 9. Agent Settings Page
**Complexity**: S
**What**: Page at `/agent/settings` to edit preferences set during onboarding.
- Edit target roles, companies, industries, salary, deal-breakers
- Pause/resume agent service
- Communication preferences (email frequency)

**Reuse**: Same form as onboarding, pre-filled with existing data.

### 10. Upgrade Flow
**Complexity**: S
**What**: Make it easy for existing Pro users to upgrade to Agent.
- Banner on dashboard: "Upgrade to Agent tier"
- In pricing page: highlight Agent tier
- Stripe handles proration automatically

### 11. Match Notification Emails
**Complexity**: S
**What**: Email when new matches are ready for review.
- "You have 5 new job matches to review"
- Brief preview of top match
- CTA to matches page

---

## What Can Wait (Post-Launch)

| Feature | Why It Can Wait |
|---------|----------------|
| Tinder-style swipe UI | Card buttons work fine for MVP |
| Full Kanban board | Grouped list view is sufficient |
| Auto-fetch job details from URL | Admin can paste manually |
| Application status change notifications | Users check dashboard |
| Company logo on match cards | Nice but not necessary |
| Match score algorithm tuning | Admin sets score manually |
| Tailored resume preview in dashboard | Link to PDF works |
| Bulk admin actions | Handle one at a time initially |
| User can see agent activity log | Trust is built through results |

---

## Existing Code Reuse Summary

| Component | Status | Reuse Level |
|-----------|--------|-------------|
| CandidateProfile model | On `apply` branch | Extend (add agent fields) |
| JobMatch model | On `apply` branch | Extend (add admin fields) |
| Application model | On `apply` branch | Extend (add tracking fields) |
| IntakeConversation model | On `apply` branch | Skip (not needed for agent onboarding) |
| match-card.tsx | On `apply` branch | Adapt styling |
| tracking-list.tsx | On `apply` branch | Adapt for dashboard |
| stat-bar.tsx | On `apply` branch | Reuse directly |
| pipeline-layout.tsx | On `apply` branch | Reference for agent layout |
| Stripe integration | On `os`/`main` | Extend (add tier) |
| Email system (Resend) | On `os`/`main` | Extend (new templates) |
| Resume tailoring | On `os`/`main` | Reuse as-is |
| PDF export | On `os`/`main` | Reuse as-is |
| Admin route pattern | On `os`/`main` | Extend (new admin pages) |
| Auth + session | On `os`/`main` | Reuse as-is |
| Conform forms | On `os`/`main` | Reuse pattern |
| Radix UI components | On `os`/`main` | Reuse as-is |

---

## Complexity Estimates

| Task | Size | New Code | Modified Code | Notes |
|------|------|----------|---------------|-------|
| Merge apply branch models | S | 0 | schema.prisma | Schema extension + migration |
| Stripe Agent tier + gating | M | 1 helper fn | 3-4 files | Pricing page + subscription utils |
| Agent onboarding (/agent/setup) | M | 1-2 files | 0 | Multi-step form, premium feel |
| Admin: user queue | M | 2-3 files | 0 | List + detail views |
| Admin: add matches | M | 1 file | 0 | Form + JobMatch creation |
| Job matches feed (/agent/matches) | M | 2 files | 0 | Card list + approve/reject |
| Admin: log applications | S | 0 | 1 file | Action on existing admin page |
| Pipeline dashboard (/agent/dashboard) | M | 2-3 files | 0 | Stats + grouped list |
| Weekly digest email | M | 2-3 files | 0 | Template + query + trigger |
| Agent settings | S | 1 file | 0 | Reuse onboarding form |
| Upgrade flow | S | 0 | 1-2 files | Banner + pricing update |
| Match notification email | S | 1 file | 0 | Simple template |

**Total**: ~15-20 new files, ~5-8 modified files.

---

## Architectural Decisions (Decide NOW)

### 1. Where do Agent routes live?
**Options**:
- `app/routes/agent+/` (new route group)
- `app/routes/pipeline+/` (extend existing pipeline from apply branch)

**Recommendation**: `app/routes/agent+/` — keep Agent tier separate from the self-serve pipeline feature. They serve different user segments and will evolve independently. The pipeline is a DIY tool; Agent is a managed service.

### 2. Merge `apply` branch or cherry-pick models?
**Options**:
- Full merge of `apply` into `os`/`main` (brings pipeline UI + models)
- Cherry-pick only the Prisma schema changes + server utils

**Recommendation**: Cherry-pick the schema + server utils. The pipeline UI on `apply` is for a different product surface. We can reference its components but don't need all the pipeline routes cluttering the codebase. If we want the pipeline feature later, we can merge it separately.

### 3. Agent tier includes Pro features?
**Decision needed**: Should $99/month Agent users also get all Pro features (unlimited tailoring, builder, etc.)?

**Recommendation**: Yes. Agent tier is a superset. Simplifies access control — check "has agent OR pro subscription" for Pro features, check "has agent subscription" for Agent features.

### 4. How to identify plan tier from Subscription?
**Options**:
- Compare `stripePriceId` against env vars (simple, current pattern)
- Add `tier` enum field to Subscription model

**Recommendation**: Add a `tier` field (`free` | `pro` | `agent`) to Subscription model. It's a one-line schema change and makes access control much cleaner than string-comparing price IDs everywhere. Worth the small upfront cost.

### 5. Admin panel styling
**Decision**: Internal-only, can be basic Tailwind. No need for the premium landing page treatment. Follow existing admin patterns (bullet-qa page).

### 6. Background jobs for MVP?
**Decision**: No. Admin triggers digest manually via button. Cron jobs come in Phase 2. Don't add infrastructure complexity for 5 users.

---

## Launch Checklist

Before opening to first 5 users:

- [ ] Agent tier available on pricing page
- [ ] Stripe checkout works for $99/month
- [ ] Onboarding flow collects preferences
- [ ] Admin can see agent users and their profiles
- [ ] Admin can add job matches for a user
- [ ] User can see and approve/reject matches
- [ ] Admin can mark matches as applied
- [ ] User can see pipeline dashboard with statuses
- [ ] Weekly digest email template works
- [ ] Agent pages gated behind Agent subscription
- [ ] Agent pages gated behind auth
- [ ] Basic error handling on all new pages
- [ ] Mobile-responsive (at least usable, not perfect)

---

## Suggested Build Order (Sprint Plan)

### Sprint 1 (Days 1-3): Foundation
- Cherry-pick schema from `apply` branch + extend for Agent
- Run migration
- Add `tier` field to Subscription
- Create `requireAgentTier()` helper
- Add Agent price to Stripe + env vars
- Add Agent tier to pricing page

### Sprint 2 (Days 4-6): Onboarding + Admin
- Build `/agent/setup` onboarding form
- Build `/admin/agent-users` user queue
- Build `/admin/agent-users/$userId` detail view
- Build add-match form

### Sprint 3 (Days 7-9): User Experience
- Build `/agent/matches` feed with approve/reject
- Build `/agent/dashboard` pipeline view
- Add "Mark Applied" to admin panel

### Sprint 4 (Days 10-12): Polish + Email
- Build weekly digest email template
- Build match notification email
- Agent settings page
- Upgrade flow from Pro
- Testing + bug fixes

### Launch: Day 13
- Deploy to production
- Manually onboard first 5 users
- Founder operates as VA for first 2-4 weeks
