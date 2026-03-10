# Automation Roadmap: Agent Tier Phase 2

**Purpose**: Document how each manual step in the human-powered Agent tier (Phase 1) would eventually be automated. This is design-only — don't build yet.

---

## Current State (Phase 1: Human-Powered)

```
Admin/VA manually:
1. Reviews user profile & preferences
2. Searches job boards for matching roles
3. Evaluates fit and adds matches to user's queue
4. User approves/rejects matches
5. Admin tailors resume for approved matches
6. Admin applies on user's behalf
7. Admin tracks responses and updates status
8. Admin sends weekly digest
```

---

## Step 1: Automated Job Discovery

### What the VA Does Now
- Reviews user's target roles, companies, location preferences
- Manually searches job boards (LinkedIn, Indeed, company career pages)
- Finds 10-15 relevant postings per user per week

### Automation Approach

**1A. Job Board API Integration (Already Partially Built)**
- Adzuna, The Muse, JSearch APIs exist on `apply` branch
- `job-search.server.ts` already: generates search queries from profile -> fetches 3 APIs in parallel -> dedupes -> LLM scores
- **Gap**: Need to run this on a schedule per user, not just on-demand
- **Complexity**: S (infrastructure exists, need scheduling wrapper)

**1B. Company Career Page Monitoring**
- User provides "dream companies" list
- Scrape Greenhouse/Lever/Ashby public API endpoints (standardized JSON feeds)
- Most ATS systems expose: `https://boards.greenhouse.io/{company}/jobs`
- Poll daily, diff against previous results to find new postings
- **Approach**: Simple HTTP fetch + JSON parse (no browser automation needed for these)
- **Complexity**: M (need to build scraper registry, handle company -> ATS URL mapping)

**1C. Google Jobs / Indeed Scraping**
- Use JSearch API (already integrated) as Google Jobs proxy
- For Indeed: no official API, would need SerpAPI or ScraperAPI
- **Legal note**: Scraping Indeed violates their TOS. Use API aggregators instead.
- **Complexity**: S (JSearch already integrated)

**1D. LinkedIn Job Monitoring**
- LinkedIn has no public job search API for third parties
- Options: (a) User connects LinkedIn and we use their session (risky, TOS violation), (b) Use a third-party aggregator, (c) Manual for now
- **Recommendation**: Skip LinkedIn automation. Use aggregators that index LinkedIn postings.
- **Complexity**: XL (and legally risky)

### Scheduling
- **Approach**: Cron job (Fly.io scheduled machine or external) triggers `/api/internal/discover-jobs` endpoint
- Runs daily per active Agent user
- Stores discovered jobs, dedupes against existing matches
- **Complexity**: M (need internal API endpoint + cron setup + per-user scheduling)

---

## Step 2: Automated Job Matching & Scoring

### What the VA Does Now
- Reviews each discovered job against user's profile
- Assesses fit based on skills, experience level, preferences
- Sets match_score and writes rationale
- Adds to user's match queue

### Automation Approach

**2A. LLM-Based Scoring (Partially Built)**
- `job-matching.server.ts` on `apply` branch already does this
- Input: CandidateProfile + JobMatch details
- Output: fit score (0-100) + explanation + match rationale
- Uses structured output with Zod schema validation
- **Gap**: Need to handle batch scoring (10-15 jobs per user per run)
- **Complexity**: S (core logic exists)

**2B. Preference Filtering (Pre-LLM)**
- Before expensive LLM scoring, filter by hard constraints:
  - Location match (remote preference, geo radius)
  - Salary range (if job posts salary)
  - Deal-breakers (e.g., travel requirements, clearance needed)
  - Company size / industry match
- Simple rule-based filtering, no AI needed
- **Complexity**: S

**2C. Score Threshold & Auto-Queue**
- Jobs scoring above threshold (e.g., 70+) auto-added to user's pending matches
- Jobs scoring 50-70 flagged for human review
- Jobs below 50 discarded
- Thresholds configurable per user
- **Complexity**: S

### Quality Safeguards
- Human review queue for edge cases
- User feedback loop: rejections with reason feed back into scoring model
- Weekly accuracy check: did user approve what we scored highly?

---

## Step 3: Automated Resume Tailoring

### What the VA Does Now
- Takes user's base resume + approved job
- Uses existing tailoring tool to generate tailored version
- Reviews and adjusts output
- Saves tailored resume to application record

### Automation Approach

**Already Built** — this is the core product.

- `resume-tailor.server.ts`: `tailorResume()` function
- `openai.server.ts`: `getEntireTailoredResumeResponse()`, `getBuilderExperienceResponse()`
- Prompt system with versioning
- PDF export via Puppeteer

**Automation Steps:**
1. When user approves a match, trigger `tailorResume()` with their base resume + JD
2. Store tailored output in Application record
3. Generate PDF via Puppeteer
4. Notify user that application is ready (or auto-proceed if user opted in)
- **Complexity**: S (just orchestration of existing functions)

**Enhancements for Agent Tier:**
- Cover letter generation (recruiter outreach generation exists, adapt for cover letters)
- ATS keyword optimization pass
- User can preview diff before application proceeds
- **Complexity**: M (cover letter prompt + preview UI)

---

## Step 4: Auto-Apply

### What the VA Does Now
- Opens job URL in browser
- Fills out ATS application form manually
- Uploads tailored resume PDF
- Copies cover letter into text fields
- Submits application
- Screenshots confirmation for proof
- Logs application in dashboard

### Automation Approach

**4A. ATS Form Automation (Browser-Based)**
- Use Playwright (already a dependency for testing) for browser automation
- Build ATS-specific adapters:
  - **Greenhouse**: Well-structured forms, most automatable
  - **Lever**: Similar to Greenhouse, standardized
  - **Workday**: Complex, multi-page, hardest to automate
  - **Ashby**: Modern, relatively clean forms
  - **Custom ATS**: Case-by-case, likely skip
- **Approach**: Detect ATS type from URL pattern -> use appropriate adapter -> fill fields -> upload resume -> submit
- **Complexity**: XL (each ATS is different, forms change, CAPTCHAs, 2FA, session management)

**4B. API-Based Submission**
- Some ATS platforms accept API submissions (Greenhouse has a Job Board API with POST endpoint)
- Much more reliable than browser automation
- Limited availability — most ATS don't expose public apply APIs
- **Complexity**: M (per-ATS, but clean when available)

**4C. Email Applications**
- Some jobs accept email applications (especially smaller companies)
- Generate email with cover letter + attached resume PDF
- Send via Resend (already integrated)
- **Complexity**: S

**4D. LinkedIn Easy Apply**
- Requires LinkedIn session/authentication
- High risk of account suspension
- **Recommendation**: Skip or use user's own session with explicit consent
- **Complexity**: XL (and risky)

### Legal & TOS Considerations
- **LinkedIn**: Explicitly prohibits automated actions. Account ban risk. Do NOT automate.
- **Indeed**: TOS prohibits automated submissions. Skip.
- **Greenhouse/Lever**: No explicit prohibition on filling forms programmatically, but submitting on someone else's behalf could be problematic. Include disclosure: "Application submitted by ResumetailorAI on behalf of [candidate]"
- **General**: Users should explicitly consent to auto-apply. Provide opt-in per job, not blanket consent.
- **Recommendation**: Start with email applications + Greenhouse API. Browser automation as Phase 3.

### Proof of Application
- Screenshot of confirmation page (Playwright can do this)
- Save confirmation email if received
- Store in Application record for user's dashboard

---

## Step 5: Automated Response Tracking

### What the VA Does Now
- Periodically checks if applications got responses
- Updates status: applied -> heard_back -> interviewing -> offer/rejected
- Flags "ghosted" applications after N days
- Updates dashboard

### Automation Approach

**5A. Email Parsing (Most Promising)**
- User forwards application-related emails to a dedicated inbox (e.g., `tracking@resumetailor.ai`)
- Or: user grants read access to their email (Gmail API, OAuth scope: `gmail.readonly`)
- Parse emails for: rejection notices, interview invitations, next steps
- LLM classifies email: rejection / interview_request / follow_up_needed / offer / generic
- Update Application status automatically
- **Complexity**: L (email parsing is messy, many formats, false positives)

**5B. Webhook from ATS**
- Some ATS send status update emails to the applicant
- Parse these emails (same as 5A)
- No direct webhook from ATS to our system (ATS webhooks go to the employer, not applicant)
- **Complexity**: N/A (not feasible directly)

**5C. Time-Based Status Updates**
- Auto-archive applications with no response after 14 days (configurable)
- Already implemented on `apply` branch (`lastActivityAt`, `archivedAt` fields)
- Prompt user: "It's been 2 weeks since applying to [Company]. Send a follow-up?"
- **Complexity**: S

**5D. Manual Check-In Prompts**
- Weekly email asks user to update status on active applications
- Simple reply or click-to-update links
- Fallback for anything automation can't handle
- **Complexity**: S

### Recommended Order
1. Time-based auto-archive (S) — already partially built
2. Manual check-in prompts (S) — simple email
3. Email parsing with user-forwarded emails (L) — highest value
4. Gmail API integration (XL) — most seamless but complex permissions

---

## Step 6: Automated Weekly Digest

### What the VA Does Now
- Compiles weekly activity summary
- Sends email to each Agent user

### Automation Approach
- Query database for each active Agent user:
  - New matches added this week
  - Applications submitted
  - Status changes (responses, interviews)
  - Upcoming follow-up dates
- Render React Email template with summary
- Send via Resend (already integrated)
- **Trigger**: Cron job every Monday at 9am user's timezone (or fixed UTC time to start)
- **Complexity**: M (template design + cron + timezone handling)

---

## Automation Priority Matrix

| Step | Manual Effort Saved | Complexity | Recommend Phase |
|------|-------------------|------------|-----------------|
| Job Discovery (API) | High | S | Phase 2A (first) |
| Job Scoring (LLM) | High | S | Phase 2A (first) |
| Preference Filtering | Medium | S | Phase 2A |
| Resume Tailoring | High | S | Phase 2A (already built) |
| Cover Letter Generation | Medium | M | Phase 2A |
| Weekly Digest Email | Medium | M | Phase 2A |
| Company Career Monitoring | Medium | M | Phase 2B |
| Email Applications | Low-Med | S | Phase 2B |
| Time-Based Auto-Archive | Low | S | Phase 2A |
| Check-In Prompts | Low | S | Phase 2B |
| ATS API Submission | High | M per ATS | Phase 2C |
| ATS Browser Automation | High | XL | Phase 3 |
| Email Parsing (tracking) | Medium | L | Phase 3 |
| Gmail API Integration | High | XL | Phase 3+ |
| LinkedIn Automation | High | XL + risky | Never (TOS risk) |

---

## Architecture Considerations for Automation

### Background Job Processing
- Current app is purely request-driven (no workers, no queues)
- Automation requires scheduled/async processing
- **Options**:
  1. **Fly.io Machines API**: Schedule machines to run cron tasks (simplest with current infra)
  2. **Internal cron endpoint**: External cron service (cron-job.org, Fly cron) hits internal API
  3. **BullMQ + Redis**: Full job queue system (overkill for Phase 2A)
- **Recommendation**: Start with internal cron endpoint, move to proper queue when needed

### Cost Management
- LLM calls per user per week (automated): ~20-30 (scoring) + 10-15 (tailoring) = ~35-45 calls
- At $0.01-0.05 per call, roughly $0.35-2.25/user/week, or $1.50-9/user/month
- Well within $99/month margin
- Monitor and cap per-user LLM usage to prevent runaway costs

### Data Architecture
- Current models (on `apply` branch) support most automation needs
- Add: `DiscoveredJob` model (raw jobs before scoring, separate from `JobMatch`)
- Add: `AgentRun` model (audit log: what the automation did, when, results)
- Add: `UserPreferences` fields to CandidateProfile (notification settings, auto-apply consent, score thresholds)
