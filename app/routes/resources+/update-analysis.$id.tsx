import { json, type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'
import { getAiFeedback } from '~/lib/careerfit.server.ts'
import { requireUserId } from '~/utils/auth.server.ts'

// Free re/analyses allowed per user (per browser if not using DB)
// Set to 0 to force Stripe-only paywall
const FREE_ANALYSIS_LIMIT = 2

// Small cookie helper for a per-browser free quota without DB changes
function getCookieCount(req: Request, key: string) {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${key}=`))
  if (!match) return 0
  const v = Number(decodeURIComponent(match.split('=')[1] || '0'))
  return Number.isFinite(v) ? v : 0
}
function setCookieCount(count: number, key: string) {
  // 180 days
  const maxAge = 60 * 60 * 24 * 180
  return `${key}=${encodeURIComponent(String(count))}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request)
  if (request.method !== 'PATCH') {
    return json({ error: 'Method Not Allowed' }, { status: 405 })
  }

  const id = params.id!
  const existing = await prisma.analysis.findUnique({ where: { id } })
  if (!existing) return json({ error: 'Not found' }, { status: 404 })

  type Body = {
    title?: string
    company?: string
    jdText?: string
    resumeTxt?: string
    dryRun?: boolean
    feedback?: any
  }
  const body = (await request.json().catch(() => ({}))) as Body

  // Check subscription (Stripe) first
  const isPro = await prisma.subscription.findFirst({
    where: { ownerId: userId, active: true },
    select: { id: true },
  }).then(Boolean)

  // If not Pro, enforce a browser-based free limit (no DB changes required)
  const cookieKey = `rt_free_analysis_used_${userId}` // per-user cookie counter
  const currentUsage = !isPro && FREE_ANALYSIS_LIMIT >= 0
    ? getCookieCount(request, cookieKey)
    : 0

  if (!isPro && FREE_ANALYSIS_LIMIT >= 0 && currentUsage >= FREE_ANALYSIS_LIMIT) {
    return json({ upgradeRequired: true }, { status: 402 })
  }

  const title = body.title ?? existing.title
  const company = body.company ?? existing.company
  const jdText = body.jdText ?? existing.jdText
  const resumeTxt = body.resumeTxt ?? existing.resumeTxt

  // If dryRun flag is set, just check permissions and return
  if (body.dryRun) {
    return json({ ok: true })
  }

  // If feedback is provided (from streaming), use it directly
  // Otherwise run the AI
  const feedback = body.feedback ?? await getAiFeedback(jdText, resumeTxt, title, company)

  const updated = await prisma.analysis.update({
    where: { id },
    data: {
      title,
      company,
      jdText,
      resumeTxt,
      fitPct: feedback.fitPct,
      feedback: JSON.stringify(feedback),
    },
    select: {
      id: true,
      fitPct: true,
      feedback: true,
      title: true,
      company: true,
      jdText: true,
      resumeTxt: true,
    },
  })

  // If we're counting free uses via cookie, bump it now (only when not Pro)
  const headers: HeadersInit = {}
  if (!isPro && FREE_ANALYSIS_LIMIT >= 0) {
    headers['Set-Cookie'] = setCookieCount(currentUsage + 1, cookieKey)
  }

  // Add tracking data for GA4
  const planType = isPro ? 'pro' : 'free'

  return json(
    {
      ...updated,
      feedback: updated.feedback ? JSON.parse(updated.feedback) : null,
      trackingData: {
        user_id: userId,
        plan_type: planType,
        match_score: updated.fitPct || 0,
      },
    },
    { headers },
  )
}
