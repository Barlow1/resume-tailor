# resume-tailor development

## Founder mode

This project is built in founder mode, not manager mode. The owner thinks like
Steve Jobs and Walt Disney — experiences first, taste over metrics, strong opinions.

**How to work with the founder:**
- Demo over dashboard. The founder evaluates by USING the thing, not reading metrics.
  When presenting work, say "try this" not "here are the numbers."
- Metrics are lagging indicators. If something feels wrong, it IS wrong — don't wait
  for data to confirm what taste already told you.
- No AI slop. No purple gradients, no generic hero copy, no cookie-cutter layouts,
  no "looks like every other AI-generated app." If it looks like a template, start over.
- Opinionated > consensus. The founder will choose what they believe is best even if
  it's not what everyone else is doing. Don't optimize for hype or trends.
- The little things matter. Transitions, spacing, how a click FEELS, what happens at
  the edges. Polish is not optional.
- Build things people want — whether they know they want them yet or not. The best
  features solve problems users haven't articulated.
- When in doubt, ask: "Would I be proud to show this to someone I respect?"

## Commands

```bash
npm install          # install dependencies
npm run dev          # run dev server
npm run build        # build for production
npx vitest           # run unit tests
npx playwright test  # run e2e tests
```

## Project structure

```
resume-tailor/
├── app/
│   ├── components/              # React components (font-selector, layout-selector, etc.)
│   ├── routes/
│   │   ├── builder+/index.tsx   # Main builder interface (~2800 lines)
│   │   └── resources+/          # API endpoints (generate-pdf, save-resume, etc.)
│   ├── utils/
│   │   ├── generate-resume-html.ts    # Resume HTML template generator
│   │   ├── builder-resume.server.ts   # ResumeData types & DB queries
│   │   └── pdf.server.ts             # Puppeteer PDF generation
│   ├── hooks/
│   ├── lib/
│   ├── prompts/
│   └── styles/
├── prisma/                      # SQLite database schema
├── tests/                       # Playwright e2e tests
└── types/
```

## Tech stack

- **Framework:** Remix 2.3.0 (full-stack React)
- **Database:** SQLite + Prisma ORM
- **Styling:** TailwindCSS
- **PDF:** Puppeteer (headless Chrome)
- **Fonts:** Google Fonts (dynamic link tags)
- **State:** Zustand + React hooks
- **AI:** OpenAI API
- **Payments:** Stripe

## Key files for resume templates

- `app/utils/generate-resume-html.ts` — HTML template generator (single file today)
- `app/utils/builder-resume.server.ts` — ResumeData type (has layout, font, nameColor, textSize fields)
- `app/utils/pdf.server.ts` — Puppeteer PDF with smart page breaking
- `app/routes/builder+/index.tsx` — Builder UI with Customize sidebar (font picker, color swatches, text size)
- `app/components/font-selector.tsx` — Font picker component
- `app/components/layout-selector.tsx` — Layout picker component

## Database fields (no migration needed for templates)

`nameColor` (String?), `font` (String?), `layout` (String?), `textSize` (String?) — all exist on the Resume model.

## gstack

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse,
/qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro,
/investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade.
