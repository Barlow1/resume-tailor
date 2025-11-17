# Resume Tailor Instrumentation & Improvements Guide

## Overview

This guide documents the tracking, UX improvements, and error handling added to the resume tailoring flow to diagnose and fix the "doesn't work" issues reported by 32 users.

---

## Priority 1: Comprehensive Tracking ✅

### What Was Added

**New Files:**
- `app/utils/tracking.server.ts` - Server-side tracking utilities
- `app/utils/tracking.client.ts` - Client-side tracking with Google Analytics integration

**Tracked Events:**

#### 1. Resume Upload Flow
```typescript
// app/routes/resources+/create-resume.tsx
trackResumeUpload({
  method: 'scratch' | 'upload' | 'existing',
  success: boolean,
  userId?: string,
  error?: string,
  fileType?: string,
  fileSize?: number
})
```

**Tracks:**
- Upload start
- Parsing start/success/failure
- Upload success/failure
- File type and size
- Error details

#### 2. Resume Parsing
```typescript
trackResumeParsing({
  started?: boolean,
  success?: boolean,
  failed?: boolean,
  error?: string,
  userId?: string,
  fileType?: string,
  duration?: number
})
```

**Tracks:**
- Parsing duration
- Success/failure rates
- Error messages

#### 3. Tailor Flow
```typescript
// Tailor button click
trackTailorClicked({
  jobId: string,
  resumeId: string,
  experienceCount: number,
  userId?: string,
  type: 'entire_resume' | 'single_bullet'
})

// Tailor completion
trackTailorCompleted({
  success: boolean,
  error?: string,
  duration: number,
  changedFields?: string[],
  userId?: string,
  resumeId?: string,
  jobId?: string,
  type: 'entire_resume' | 'single_bullet'
})
```

**Tracks:**
- Click → completion success rate
- Duration of AI operations
- Which fields changed
- Error types and messages

#### 4. Error Tracking
```typescript
trackError({
  error: string,
  context: string,
  userId?: string,
  stack?: string
})
```

**Tracks:**
- All errors with context
- Stack traces for debugging

### How to Use Tracking Data

**Key Metrics to Monitor:**

1. **Conversion Funnel:**
   ```
   resume_uploaded → job_selected → tailor_clicked → tailor_completed
   ```

   If drop-off is >20% at any step, investigate that step.

2. **Error Rate:**
   ```
   (tailor_completed with success=false) / (tailor_clicked) < 5%
   ```

   If error rate >5%, check error types and messages.

3. **Duration:**
   ```
   Average duration for tailor_completed should be 3-10 seconds
   ```

   If >15 seconds, API may be slow.

**Access Tracking Logs:**

Currently logs to console. Check server logs:
```bash
grep "\[TRACKING\]" server.log | jq
```

**To Add Analytics Service (PostHog, Mixpanel, etc.):**

Edit `app/utils/tracking.server.ts`:
```typescript
export async function trackEvent(event: string, properties: Record<string, any> = {}) {
  // ... existing console.log ...

  // Add your analytics service:
  await posthog.capture({
    distinctId: properties.userId,
    event,
    properties,
  })
}
```

---

## Priority 2: Diff View Modal ✅

### What Was Added

**New Files:**
- `app/utils/tailor-diff.ts` - Change detection utilities
- `app/components/tailor-diff-modal.tsx` - Modal UI component

### Features

**Change Detection:**
- Detects added/modified/removed bullet points
- Identifies new keywords from job description
- Calculates total changes

**UI Display:**
- Summary stats (keywords added, bullets enhanced, score improvement)
- Before/after comparison for modified bullets
- Added/removed bullet highlights
- "Keep Changes" or "Revert" buttons

### How to Integrate in Builder

**In `app/routes/builder+/index.tsx`:**

```typescript
import { TailorDiffModal } from '~/components/tailor-diff-modal'
import { createDiffSummary, extractJobKeywords } from '~/utils/tailor-diff'

// Add state
const [showDiffModal, setShowDiffModal] = useState(false)
const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null)

// After AI tailoring completes (in tailorFetcher.data effect):
useEffect(() => {
  if (tailorFetcher.data && preTailoredResume) {
    const aiResponse = JSON.parse(tailorFetcher.data.choices[0].message.content)

    // Create diff summary
    const jobKeywords = selectedJob ? extractJobKeywords(selectedJob.content) : []
    const summary = createDiffSummary(preTailoredResume, aiResponse, jobKeywords)
    setDiffSummary(summary)
    setShowDiffModal(true)

    // Apply changes
    setFormData(aiResponse)
  }
}, [tailorFetcher.data])

// Add modal to JSX:
<TailorDiffModal
  isOpen={showDiffModal}
  onClose={() => setShowDiffModal(false)}
  onKeepChanges={() => {
    setShowDiffModal(false)
    setPreTailoredResume(null) // Clear undo state
    // Track action
    trackEvent('post_tailor_action', { action: 'keep', userId })
  }}
  onRevert={() => {
    setFormData(preTailoredResume)
    setShowDiffModal(false)
    setPreTailoredResume(null)
    // Track action
    trackEvent('post_tailor_action', { action: 'revert', userId })
  }}
  diffSummary={diffSummary}
  scoreImprovement={newScore - previousScore}
/>
```

### Why This Matters

**Addresses User Feedback:**
- "I don't know what changed" → Now shows exactly what changed
- "AI made it worse" → Can revert immediately
- "Not sure if it worked" → Visual confirmation with stats

---

## Priority 3: In-Builder Progress Stepper ✅

### What Was Added

**New File:**
- `app/components/tailor-flow-stepper.tsx`

### Features

**Visual Progress:**
- 4-step process: Upload → Select Job → Tailor → Download
- Color-coded status (complete, active, disabled)
- Progress bar showing % complete

**Contextual Guidance:**
- Shows next action based on current step
- Disabled steps are grayed out
- Active step highlighted with ring

### How to Integrate in Builder

**In `app/routes/builder+/index.tsx`:**

```typescript
import { TailorFlowStepper } from '~/components/tailor-flow-stepper'

// Add above resume preview (around line 1450):
<TailorFlowStepper
  hasResume={!!formData.name || !!formData.role}
  selectedJob={selectedJob}
/>
```

### Why This Matters

**Addresses User Confusion:**
- "Uploaded resume and AI does nothing" → Shows they need to select a job first
- "Don't know what to do next" → Clear next action message
- "Stuck on step 2" → Visual progress shows where they are

---

## Priority 4: Error Recovery with Graceful Fallbacks ✅

### What Was Added

**Enhanced Error Handling in `app/routes/resources+/builder-completions.ts`:**

### Error Types & Recovery

#### 1. Rate Limit Errors
```typescript
{
  error: 'Our AI is currently busy. Please try again in 30 seconds.',
  retryable: true,
  errorType: 'rate_limit'
}
```

**User Action:** Retry button appears after 30 seconds

#### 2. Context Length Errors
```typescript
{
  error: 'Your resume is too long for full tailoring. Try tailoring individual bullet points instead.',
  suggestion: 'use_bullet_tailoring',
  retryable: false,
  errorType: 'context_length'
}
```

**User Action:** Opens AI modal for bullet-by-bullet tailoring

#### 3. Timeout Errors
```typescript
{
  error: 'Request timed out. Your resume has been saved. Please try again.',
  retryable: true,
  errorType: 'timeout'
}
```

**User Action:** Retry button + reassurance that data is saved

#### 4. Generic Errors
```typescript
{
  error: 'Something went wrong. Your resume is saved - click to retry.',
  retryable: true,
  errorType: 'unknown'
}
```

**User Action:** Retry button + reassurance

### How to Display Errors in Builder

**In `app/routes/builder+/index.tsx`:**

```typescript
// After tailorFetcher completes:
useEffect(() => {
  if (tailorFetcher.data?.error) {
    const errorData = tailorFetcher.data

    setErrorState({
      message: errorData.error,
      retryable: errorData.retryable,
      suggestion: errorData.suggestion,
      errorType: errorData.errorType
    })
  }
}, [tailorFetcher.data])

// Add error display UI:
{errorState && (
  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
    <div className="flex items-start">
      <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
      <div className="ml-3 flex-1">
        <p className="text-sm text-red-800">{errorState.message}</p>
        <div className="mt-3 flex gap-2">
          {errorState.retryable && (
            <Button onClick={retryTailor} size="sm">
              Retry
            </Button>
          )}
          {errorState.suggestion === 'use_bullet_tailoring' && (
            <Button onClick={() => setShowAIModal(true)} size="sm" variant="outline">
              Try Bullet Tailoring Instead
            </Button>
          )}
          <Button onClick={() => setErrorState(null)} size="sm" variant="ghost">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

### Why This Matters

**Reduces Churn:**
- Before: Error → User confused → User leaves
- After: Error → Clear message → Recovery option → User continues

**67.5% cancel within 7 days** - Most likely due to hitting one error and giving up. This fixes that.

---

## Testing Guide

### Manual Testing Checklist

**Resume Upload:**
- [ ] Upload valid PDF → Check `resume_uploaded` event logged
- [ ] Upload invalid file → Check error tracking
- [ ] Clone existing resume → Check tracking

**Tailor Flow:**
- [ ] Select job → Click "Tailor to Job" → Check events:
  - `tailor_clicked`
  - `tailor_completed` (success=true)
- [ ] Force error (disconnect network) → Check error handling
- [ ] Check diff modal appears with changes

**Error Recovery:**
- [ ] Simulate rate limit → Check error message and retry button
- [ ] Create very long resume → Check context length error
- [ ] Check all errors track properly

### Automated Testing

**Add to test suite:**

```typescript
// Test tracking
test('tracks resume upload success', async () => {
  const trackingSpy = vi.spyOn(tracking, 'trackResumeUpload')
  await uploadResume(validFile)
  expect(trackingSpy).toHaveBeenCalledWith({
    method: 'upload',
    success: true,
    ...
  })
})

// Test error handling
test('handles rate limit with retry option', async () => {
  const response = await tailorResume(data)
  expect(response.error).toContain('busy')
  expect(response.retryable).toBe(true)
})
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Conversion Rate:**
   - `tailor_clicked` → `tailor_completed` (success=true)
   - Target: >90%

2. **Error Rate:**
   - `tailor_completed` (success=false) / `tailor_clicked`
   - Target: <5%

3. **Average Duration:**
   - `tailor_completed.duration`
   - Target: 3-10 seconds

4. **User Actions:**
   - `post_tailor_action` (action='undo') / `tailor_completed`
   - If >30% undo → AI output quality issue

### Alert Thresholds

**Set up alerts:**

```
ERROR RATE > 10% → Immediate alert
CONVERSION RATE < 80% → Daily alert
AVG DURATION > 15s → Hourly alert
UNDO RATE > 40% → Daily alert
```

---

## Next Steps

### Immediate (Week 1):
1. ✅ Deploy tracking code
2. ✅ Implement error handling
3. ✅ Add diff modal
4. ✅ Add progress stepper
5. ⏳ Integrate into builder UI
6. ⏳ Test all flows end-to-end

### Week 2:
1. Monitor tracking data for 7 days
2. Analyze drop-off points
3. Review error types and frequencies
4. A/B test diff modal (show vs. don't show)

### Week 3:
1. Iterate based on data
2. Add automated tests
3. Set up monitoring dashboards
4. Create runbook for common errors

---

## Files Changed/Added

### New Files:
- `app/utils/tracking.server.ts` (158 lines)
- `app/utils/tracking.client.ts` (48 lines)
- `app/utils/tailor-diff.ts` (254 lines)
- `app/components/tailor-diff-modal.tsx` (196 lines)
- `app/components/tailor-flow-stepper.tsx` (115 lines)

### Modified Files:
- `app/routes/resources+/create-resume.tsx` (added tracking)
- `app/routes/resources+/builder-completions.ts` (added tracking + error handling)

### Total Lines Added: ~950 lines

---

## Common Issues & Solutions

### Issue: "Tracking not showing up"
**Solution:** Check server logs for `[TRACKING]` prefix. If not present, ensure tracking functions are awaited.

### Issue: "Diff modal shows no changes"
**Solution:** Verify `preTailoredResume` is captured before AI call. Check that resume IDs match.

### Issue: "Error handling not working"
**Solution:** Check error.message format matches conditions. Add console.log to debug error structure.

### Issue: "Stepper not updating"
**Solution:** Verify `hasResume` and `selectedJob` props are reactive. Check for stale closures.

---

## Support

For issues or questions:
1. Check this guide first
2. Review tracking logs: `grep "\[TRACKING\]" server.log`
3. Check browser console for client-side errors
4. Review Sentry/error tracking for production issues

---

**Last Updated:** 2025-11-02
**Version:** 1.0.0
