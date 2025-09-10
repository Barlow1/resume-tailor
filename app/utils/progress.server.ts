import { prisma } from './db.server.ts'

export async function ensureProgress(userId: string) {
  return prisma.gettingStartedProgress.upsert({
    where: { ownerId: userId },
    create: {
      ownerId: userId,
      hasSavedJob: false,
      hasSavedResume: false,
      hasGeneratedResume: false,
      hasTailoredResume: false,
      tailorCount: 0,
      generateCount: 0,
      analysisCount: 0,
      downloadCount: 0,
    },
    update: {},
    select: { analysisCount: true },
  })
}
