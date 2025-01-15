import { prisma } from './db.server.ts'

interface CreateJobParams {
  userId: string | null
  title: string
  content: string
}

export async function createJob({ userId, title, content }: CreateJobParams) {
  return prisma.job.create({
    data: {
      title,
      content,
      ownerId: userId,
    },
  })
}

export async function getUserJobs(userId: string) {
  return prisma.job.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
  })
} 