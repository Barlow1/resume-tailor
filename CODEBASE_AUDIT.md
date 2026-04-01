# Codebase Audit Report: resume-tailor

**Date:** 2026-03-23
**Branch:** feature/new-resume-templates
**Auditor:** Claude Opus 4.6 (1M context)

---

## Contributors

- **Christian Barlow** (technical co-founder): 218 commits. Built the entire app architecture, builder, auth, payments, AI integration, PDF system.
- **Brayan** + Claude: ~138 commits since mid-2025. Truth Panel redesign, templates, cover letters, experience matching, application tracker, dead code cleanup.

---

## 1. Style Guide: Christian Barlow's Patterns

| Pattern | Christian's Way |
|---------|----------------|
| **Exports** | Named exports for components (`export function Foo()`), default only for route components |
| **Types** | Inline `{ inputId: string }` for simple props, separate `interface FooProps` for complex ones |
| **Components** | `function` declarations, not arrow functions |
| **Imports** | React -> external libs -> local utils -> local components, `type` keyword for type imports |
| **Server utils** | `.server.ts` suffix, `export async function`, Prisma with explicit `include`/`select` |
| **Error handling** | Early returns with `json({ error }, { status })`, try/catch for external services |
| **State** | `useState` for local, `useFetcher` for server sync, debounced auto-save |
| **Styling** | Tailwind with `cn()` utility, conditional classes via `clsx` |
| **Routes** | Intent-based dispatch in `action()`, parallel queries with `Promise.all` in loaders |
| **Comments** | Minimal, "why not what", JSDoc only on exported utilities |
| **Naming** | kebab-case files, PascalCase types, camelCase functions |

**Claude-added code is largely consistent with these patterns.** The template system, Truth Panel components, and server utilities all follow Christian's conventions well.

---

## 2. Security Findings (OWASP)

### CRITICAL

| # | Finding | File | Exploit |
|---|---------|------|---------|
| **S1** | **Arbitrary HTML to Puppeteer -- SSRF/RCE** | `resources+/generate-pdf.ts` | Unauthenticated POST with `<script>fetch('http://169.254.169.254/...')</script>` reads cloud metadata, local files, scans internal network |
| **S2** | **IDOR: Any user can overwrite any resume** | `builder-resume.server.ts:248` | `updateBuilderResume` WHERE clause uses `{ id: resumeId }` without `userId` filter. Attacker sends save request with victim's resume ID |

### HIGH

| # | Finding | File | Exploit |
|---|---------|------|---------|
| **S3** | **IDOR: Unauthenticated analysis read** | `resources+/analysis.$id.tsx` | No auth check -- anyone can read resume text, JD, AI feedback by ID |
| **S4** | **Unescaped HTML in legacy PDF generation** | `resources+/download-pdf.ts:149-192` | `${personalInfo.full_name}` interpolated without `escapeHtml()` -- XSS in Puppeteer context |
| **S5** | **IDOR: Clone any resume / download any PDF** | `resources+/create-resume.tsx:217`, `download-pdf.ts:232` | No ownership check on clone or PDF download |

### MEDIUM

| # | Finding | File | Exploit |
|---|---------|------|---------|
| **S6** | **No auth on generate-pdf endpoint** | `resources+/generate-pdf.ts` | `getUserId()` returns null if not logged in, PDF still generates (amplifies S1) |
| **S7** | **No server-side sanitization on save** | `resources+/save-resume.tsx` | contentEditable HTML saved as-is to DB, only escaped at render time (fragile) |

### Verified SAFE

- **CSS injection via `nameColor`**: `sanitizeColor()` validates against hex regex
- **Font injection**: Resolved from hardcoded allowlist
- **SQL injection**: All Prisma parameterized queries
- **Template XSS**: All 5 templates use `escapeHtml()` consistently

---

## 3. Bug Findings (Code Review)

### CRITICAL

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **B1** | **Puppeteer browser never closed on error** | `pdf.server.ts:3-153` | Process leak on every failed PDF -- accumulates until server crashes |
| **B2** | **`null` description content on update path** | `builder-resume.server.ts:189` | `content: descData.content` (no `?? ''`) -- Prisma validation error, silent save failure |

### HIGH

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **B3** | **PDF page-break early return blanks content** | `pdf.server.ts:107` | Section spanning exactly one page: content detached from DOM, `pages.length <= 1` exits early, PDF page is blank |
| **B4** | **Modernist template negative margin clipped in PDF** | `templates/modernist.ts:7` | `margin-left: -22px` on section headers may be clipped in Puppeteer PDF |
| **B5** | **First replaced bullet missing `id`** | `builder+/index.tsx:1188` | AI multi-bullet replace creates `{ content: firstBullet }` with no `id` -- highlight broken |
| **B6** | **Blob URL memory leak on PDF download** | `builder+/index.tsx:1298` | `createObjectURL` never revoked -- leaks blob reference per download |
| **B7** | **Editorial template left border only on page 1** | `templates/editorial.ts:157` | `editorial-body` wrapper not cloned across page-break splits |

### MEDIUM

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **B8** | **Stub `action` with `console.log`** | `builder+/index.tsx:2959` | Logs every form POST to server console -- noise + info leak |
| **B9** | **Stale `formData` in cover letter mutation** | `builder+/index.tsx:672` | Cover letter draft changes could clobber concurrent formData updates |
| **B10** | **Resume rename patches wrong resume** | `builder+/index.tsx:1940` | Double-clicking a non-active resume name updates the active resume's name instead |
| **B11** | **`sanitizeColor` accepts invalid hex lengths** | `templates/shared.ts:32` | `#12345` (5 digits) passes validation but renders as nothing in browsers |

### LOW

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **B12** | **Debug `console.log` in production** | `builder+/index.tsx:2369` | Logs full AI bullet content to browser console |
| **B13** | **Three competing analytics imports** | `builder+/index.tsx:65-67` | `trackEvent`, `trackLegacyEvent`, `track` -- confusing, likely partially dead |

---

## 4. Lint Errors

**8 errors, 28 warnings.**

All 8 errors are in untracked files (block-editor, block-tree tests, scripts):
- `block-editor.tsx:1` -- unused `useCallback` import
- `extract-pdf.server.test.ts:138` -- import not at top of module
- `extract-with-ai.server.test.ts:2` -- unused `DesignTokens`, `FontMapping` imports
- `extract-with-ai.server.test.ts:178` -- import not at top of module
- `generate-template.server.ts:3` -- unused `PdfExtractionResult` import
- `validate-block-tree.server.ts:12` -- unused `Block` import
- `preview-ai-extraction.ts:14` -- unused `serializeBlockTree` import

The 28 warnings are all `react-hooks/exhaustive-deps` in `builder+/index.tsx` -- pre-existing pattern from the builder's update function architecture.

---

## 5. Dead Code & Files to Delete

### Components to delete (never imported anywhere)

| File | Why |
|------|-----|
| `app/components/resume-score-card.tsx` | Dead -- score system was removed |
| `app/components/improvement-checklist.tsx` | Never imported |
| `app/components/rejection-section.tsx` | Never imported |
| `app/components/tailor-diff-modal.tsx` | Never imported |
| `app/components/tailor-flow-stepper.tsx` | Never imported |
| `app/components/section-visibility-menu.tsx` | Never imported |
| `app/components/job-selector.tsx` | Never imported |
| `app/components/editable-content.tsx` | Never imported (replaced by inline contentEditable) |
| `app/components/image-cropper.tsx` | Never imported |
| `app/components/spotlight-overlay.tsx` | Never imported |
| `app/components/rainbow-sparkles-icon.tsx` | Never imported |
| `app/components/search-bar.tsx` | Never imported |

### Other dead code

| Location | What |
|----------|------|
| `builder+/index.tsx:2959` | Stub `action` export with console.log |

---

## 6. Files/Dirs to Gitignore

Add to `.gitignore`:

```gitignore
# Test output
tests/output/
tests/fixtures/block-tree-output/
tests/fixtures/docx/

# Local dev tools
.superpowers/
```

---

## 7. Open PRs Assessment

| PR | Status | Recommendation |
|----|--------|----------------|
| **#111** -- Remove dead code and simplify analytics hooks | All tests pass, -1,726 lines | **MERGE IMMEDIATELY** -- zero risk, high value |
| **#110** -- Fix PDF page breaks, error handling | Playwright tests failing | **FIX TESTS THEN MERGE** -- contains critical PDF fix |
| **#113** -- Truth Panel redesign | All tests pass, +7,045 lines | **MERGE** after #111 lands |
| **#114** -- New resume templates | All tests pass, +8,604 lines | **MERGE** after #113 lands |

**Merge order:** #111 -> #110 (fix tests) -> #113 -> #114

---

## 8. Prioritized Fix List

### Tier 1: Fix NOW (security + data integrity)

1. **S1+S6**: Add `requireUserId(request)` to `generate-pdf.ts` AND stop accepting raw HTML from client -- generate server-side from resume ID
2. **S2**: Add `userId` to WHERE clause in `updateBuilderResume`
3. **S3**: Add auth check to `analysis.$id.tsx` loader
4. **S4**: Add `escapeHtml()` to all interpolations in `download-pdf.ts`
5. **S5**: Add ownership checks to resume clone and PDF download
6. **B1**: Wrap Puppeteer in try/finally to always close browser
7. **B2**: Add `?? ''` to description content in `updateBuilderResume`

### Tier 2: Fix this week (user-facing bugs)

8. **B3**: Fix PDF page-break early return (move check before DOM restructure)
9. **B5**: Add `id: crypto.randomUUID()` to first replaced bullet
10. **B6**: Add `setTimeout(() => URL.revokeObjectURL(url), 1000)` after PDF download
11. **B8**: Remove stub `action` export from builder
12. **B12**: Remove debug `console.log`

### Tier 3: Fix soon (polish)

13. **B4**: Fix Modernist negative margin for PDF
14. **B7**: Fix Editorial left border across page breaks
15. **B10**: Fix resume rename to only patch the correct resume
16. **B11**: Tighten `sanitizeColor` regex
17. Delete 12 unused component files
18. Update `.gitignore` with test output dirs

### Tier 4: When convenient

19. **B9**: Use functional updater for cover letter draft changes
20. **B13**: Consolidate three analytics imports
21. Merge PR #111 (dead code cleanup)
22. Clean up 38 stale local git branches

---

## 9. Design/UX Notes (from code review)

Browser-based visual testing was not performed (gstack browse has a Windows startup bug). These issues were identified from reading template code:

- **Modernist template**: Section headers use `margin-left: -22px` which may clip in PDF
- **Editorial template**: Left border decoration only renders on page 1 of multi-page PDFs
- **All templates**: `sanitizeColor` accepts invalid 5/7-digit hex values that render as nothing
- **Page breaks**: Edge case where section fills exactly one page can produce blank PDF page

Visual QA recommended when gstack browse is fixed or via manual testing.

---

## Disclaimer

This audit was performed by an AI assistant. While thorough, it is not a substitute for a professional security audit. For the security findings (especially S1 SSRF/RCE), consider engaging a professional penetration testing firm to validate and ensure comprehensive coverage.
