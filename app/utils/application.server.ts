import { prisma } from './db.server.ts'

export async function createApplication(
	userId: string,
	resumeId: string,
	jobId: string,
	matchLevel: string,
	matchSummary: string | null,
	coverLetter?: string | null,
) {
	return prisma.application.create({
		data: {
			userId,
			resumeId,
			jobId,
			matchLevel,
			matchSummary,
			coverLetter,
			nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		},
	})
}

export async function getUserApplications(userId: string) {
	return prisma.application.findMany({
		where: { userId },
		include: {
			resume: { select: { id: true, name: true, role: true } },
			job: { select: { id: true, title: true, company: true } },
		},
		orderBy: { appliedAt: 'desc' },
	})
}

export async function updateApplicationStatus(
	applicationId: string,
	userId: string,
	status: string,
) {
	const terminal = ['offered', 'rejected']
	return prisma.application.update({
		where: { id: applicationId, userId },
		data: {
			status,
			statusUpdatedAt: new Date(),
			...(terminal.includes(status) ? { nextCheckIn: null } : {}),
		},
	})
}

export async function deleteApplication(applicationId: string, userId: string) {
	return prisma.application.delete({
		where: { id: applicationId, userId },
	})
}
