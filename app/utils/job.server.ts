import { prisma } from './db.server.ts'
import { extractKeywordsFromJobDescription } from './keyword-extraction.server.ts'

interface CreateJobParams {
  userId: string | null
  title: string
  content: string
}

export async function createJob({ userId, title, content }: CreateJobParams) {
  // Extract keywords from job description using OpenAI
  console.log(`[Job Creation] Creating job: "${title}"`)
  const keywords = await extractKeywordsFromJobDescription(content)
  const extractedKeywords = keywords.length > 0 ? JSON.stringify(keywords) : null

  console.log(`[Job Creation] Extracted keywords:`, extractedKeywords ? 'YES' : 'NO', keywords.length)

  return prisma.job.create({
    data: {
      title,
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