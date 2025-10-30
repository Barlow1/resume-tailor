import { type Prisma } from '@prisma/client'
import { prisma } from './db.server.ts'

export type BuilderExperienceDescription = {
	id?: string | null
	content?: string | null
	order?: number | null
}

export type BuilderExperience = {
	id?: string | null
	role?: string | null
	company?: string | null
	startDate?: string | null
	endDate?: string | null
	descriptions?: BuilderExperienceDescription[]
}

export type BuilderEducation = {
	id?: string | null
	school?: string | null
	degree?: string | null
	startDate?: string | null
	endDate?: string | null
	description?: string | null
}

export type BuilderSkill = {
	id?: string | null
	name?: string | null
}

export type BuilderHobby = {
	id?: string | null
	name?: string | null
}

export type BuilderHeaders = {
	id?: string
	experienceHeader?: string | null
	skillsHeader?: string | null
	hobbiesHeader?: string | null
	educationHeader?: string | null
	aboutHeader?: string | null
	detailsHeader?: string | null
}

export type BuilderJob = {
	id?: string | null
	title?: string | null
	content?: string | null
}

export type ResumeData = {
	id?: string | null
	name?: string | null
	nameColor?: string | null
	role?: string | null
	email?: string | null
	phone?: string | null
	location?: string | null
	website?: string | null
	about?: string | null
	image?: string | null
	jobId?: string | null
	job?: BuilderJob | null
	experiences?: BuilderExperience[]
	education?: BuilderEducation[]
	skills?: BuilderSkill[]
	hobbies?: BuilderHobby[]
	headers?: BuilderHeaders | null
	createdAt?: string | Date | null
	updatedAt?: string | Date | null
	visibleSections: VisibleSections | null
	font?: string | null
	layout?: string | null
}

export type VisibleSections = {
	id?: string
	about: boolean
	experience: boolean
	education: boolean
	skills: boolean
	hobbies: boolean
	personalDetails: boolean
	photo: boolean
}

export async function createBuilderResume(
	userId: string | null,
	data: Omit<ResumeData, 'userId' | 'createdAt' | 'updatedAt'>,
) {
	const { id, job, jobId, ...createData } = data
	const createInput: Prisma.BuilderResumeCreateInput = {
		...createData,
		user: userId ? { connect: { id: userId } } : undefined,
		experiences: {
			create:
				data.experiences?.map(exp => ({
					...exp,
					descriptions: {
						create: exp.descriptions?.map((desc, index) => ({
							content: desc.content ?? '',
							order: desc.order ?? index,
						})).filter(desc => desc.content !== '') ?? [],
					},
				})) || [],
		},
		education: { create: data.education },
		skills: { create: data.skills },
		hobbies: { create: data.hobbies },
		headers: data.headers ? { create: data.headers } : undefined,
		job: jobId ? { connect: { id: jobId } } : undefined,
		visibleSections: data.visibleSections ? { create: data.visibleSections } : undefined,
	}
	return prisma.builderResume.create({
		data: createInput,
		include: {
			experiences: {
				include: {
					descriptions: {
						orderBy: {
							order: 'asc',
						},
					},
				},
			},
			education: true,
			skills: true,
			hobbies: true,
			headers: true,
			job: true,
			visibleSections: true,
		},
	})
}

export async function updateBuilderResume(userId: string | null, resumeId: string, data: Omit<ResumeData, 'userId' | 'createdAt' | 'updatedAt'>) {
	const existingResume = await prisma.builderResume.findUnique({
		where: { id: resumeId },
	});
	console.log('Attempting to update resume:', resumeId);
	console.log('Resume exists?', !!existingResume);

	const { id, job, jobId, ...updateData } = data
	console.log('resume id', resumeId);
	console.log('id', id);
	const updateInput: Prisma.BuilderResumeUpdateInput = {
		...updateData,
		user: userId ? { connect: { id: userId } } : undefined,
		experiences: {
			deleteMany: {},
			create: data.experiences?.map(exp => ({
				...exp,
				descriptions: {
					create: exp.descriptions?.map((desc, index) => ({
						content: desc.content,
						order: desc.order ?? index,
					})),
				},
			})) || [],
		},
		education: {
			deleteMany: {},
			create: data.education?.map(edu => ({
				school: edu.school,
				degree: edu.degree,
				startDate: edu.startDate,
				endDate: edu.endDate,
				description: edu.description,
			})) || [],
		},
		skills: {
			deleteMany: {},
			create: data.skills?.map(skill => ({
				name: skill.name,
			})) || [],
		},
		hobbies: {
			deleteMany: {},
			create: data.hobbies?.map(hobby => ({
				name: hobby.name,
			})) || [],
		},
		headers: data.headers
			? {
					upsert: {
						create: data.headers,
						update: data.headers,
					},
			  }
			: undefined,
		job: data.jobId ? { connect: { id: data.jobId } } : undefined,
		visibleSections: data.visibleSections ? {
			upsert: {
				create: data.visibleSections,
				update: data.visibleSections,
			},
		} : undefined,
	}
	console.log('updateInput', JSON.stringify(updateInput, null, 2));
	return prisma.builderResume.update({
		where: { id: resumeId },
		data: updateInput,
		include: {
			experiences: {
				include: {
					descriptions: {
						orderBy: {
							order: 'asc',
						},
					},
				},
			},
			education: true,
			skills: true,
			hobbies: true,
			headers: true,
			job: true,
			visibleSections: true,
		},
	})
}

export async function getBuilderResume(id: string) {
	return prisma.builderResume.findUnique({
		where: { id },
		include: {
			experiences: {
				select: {
					id: true,
					role: true,
					company: true,
					startDate: true,
					endDate: true,
					descriptions: {
						select: {
							id: true,
							content: true,
							order: true,
						},
					},
				},
			},
			education: {
				select: {
					id: true,
					school: true,
					degree: true,
					startDate: true,
					endDate: true,
					description: true,
				},
			},
			skills: {
				select: {
					id: true,
					name: true,
				},
			},
			hobbies: {
				select: {
					id: true,
					name: true,
				},
			},
			job: {
				select: {
					id: true,
					title: true,
					content: true,
				},
			},
			headers: {
				select: {
					id: true,
					experienceHeader: true,
					skillsHeader: true,
					hobbiesHeader: true,
					educationHeader: true,
					aboutHeader: true,
					detailsHeader: true,
				},
			},
			visibleSections: {
				select: {
					id: true,
					about: true,
					experience: true,
					education: true,
					skills: true,
					hobbies: true,
					personalDetails: true,
					photo: true,
				},
			},
		},
	})
}

export async function getUserBuilderResumes(
	userId: string,
): Promise<ResumeData[]> {
	return prisma.builderResume.findMany({
		where: { userId },
		include: {
			experiences: {
				select: {
					id: true,
					role: true,
					company: true,
					startDate: true,
					endDate: true,
					descriptions: {
						select: {
							id: true,
							content: true,
							order: true,
						},
					},
				},
			},
			education: {
				select: {
					id: true,
					school: true,
					degree: true,
					startDate: true,
					endDate: true,
					description: true,
				},
			},
			skills: {
				select: {
					id: true,
					name: true,
				},
			},
			hobbies: {
				select: {
					id: true,
					name: true,
				},
			},
			job: {
				select: {
					id: true,
					title: true,
					content: true,
				},
			},
			headers: {
				select: {
					id: true,
					experienceHeader: true,
					skillsHeader: true,
					hobbiesHeader: true,
					educationHeader: true,
					aboutHeader: true,
					detailsHeader: true,
				},
			},
			visibleSections: {
				select: {
					id: true,
					about: true,
					experience: true,
					education: true,
					skills: true,
					hobbies: true,
					personalDetails: true,
					photo: true,
				},
			},
		},
	})
}

export async function deleteBuilderResume(id: string) {
	return prisma.builderResume.delete({
		where: { id },
	})
}
