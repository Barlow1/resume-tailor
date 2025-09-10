import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id!
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      company: true,
      jdText: true,
      resumeTxt: true,
      fitPct: true,
      feedback: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!analysis) throw new Response('Not found', { status: 404 })

  let feedback = null as any
  try {
    feedback = analysis.feedback ? JSON.parse(analysis.feedback) : null
  } catch {
    feedback = null
  }

  return json({ ...analysis, feedback })
}
