import { json, type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'
import { getAiFeedback } from '~/lib/careerfit.server.ts'
import { requireUserId } from '~/utils/auth.server.ts'

// Free re/analyses allowed per user (per browser if not using DB)
// Set to 0 to force Stripe-only paywall
const FREE_ANALYSIS_LIMIT = 5

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

  // Check subscription (Stripe) first
  const isPro = await prisma.subscription.findFirst({
    where: { ownerId: userId, active: true },
    select: { id: true },
  }).then(Boolean)

  // If not Pro, enforce a browser-based free limit (no DB changes required)
  if (!isPro && FREE_ANALYSIS_LIMIT >= 0) {
    const cookieKey = `rt_free_analysis_used_${userId}` // per-user cookie counter
    const current = getCookieCount(request, cookieKey)
    if (current >= FREE_ANALYSIS_LIMIT) {
      return json({ upgradeRequired: true }, { status: 402 })
    }
  }

  type Body = { title?: string; company?: string; jdText?: string; resumeTxt?: string }
  const body = (await request.json().catch(() => ({}))) as Body

  const title = body.title ?? existing.title
  const company = body.company ?? existing.company
  const jdText = body.jdText ?? existing.jdText
  const resumeTxt = body.resumeTxt ?? existing.resumeTxt

  // Run the AI
  const feedback = await getAiFeedback(jdText, resumeTxt, title, company)

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

  // If we’re counting free uses via cookie, bump it now (only when not Pro)
  const headers: HeadersInit = {}
  if (!isPro && FREE_ANALYSIS_LIMIT >= 0) {
    const cookieKey = `rt_free_analysis_used_${userId}`
    const current = getCookieCount(request, cookieKey)
    headers['Set-Cookie'] = setCookieCount(current + 1, cookieKey)
  }

  return json(
    {
      ...updated,
      feedback: updated.feedback ? JSON.parse(updated.feedback) : null,
    },
    { headers },
  )
}
