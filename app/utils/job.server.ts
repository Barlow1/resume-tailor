import { prisma } from './db.server.ts'
import { extractKeywordsFromJobDescription } from './keyword-extraction.server.ts'

interface CreateJobParams {
  userId: string | null
  title: string
  company?: string | null
  content: string
}

export async function createJob({ userId, title, company, content }: CreateJobParams) {
  // Extract keywords from job description using OpenAI
  console.log(`[Job Creation] Creating job: "${title}"`)
  const result = await extractKeywordsFromJobDescription(content, title)
  const extractedKeywords = result.keywords.length > 0
    ? JSON.stringify({ keywords: result.keywords, primary: result.primary })
    : null

  console.log(`[Job Creation] Extracted keywords:`, extractedKeywords ? 'YES' : 'NO', result.keywords.length, `(${result.primary.length} primary)`)

  return prisma.job.create({
    data: {
      title,
      company: company || null,
      content,
      extractedKeywords,
      ...(userId ? { owner: { connect: { id: userId } } } : {}),
    },
  })
}

export async function getUserJobs(userId: string) {
  return prisma.job.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
  })
} 