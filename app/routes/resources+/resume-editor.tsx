import { useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
// import { type Skill, type Education, type Experience } from '@prisma/client'
import { json, type DataFunctionArgs } from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { ErrorList } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
// import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
// import { type Stringify } from '~/utils/misc.ts'
import { useUser } from '~/utils/user.ts'


type ActionData = {
	status: 'idle' | 'error' | 'success';
	submission?: {
	  intent: string;
	  payload: Record<string, unknown>;
	  error: Record<string, string>;
	};
	message?: string;
  };

export const ResumeEditorSchema = z.object({
	id: z.string().optional(),
	action: z.enum(['updateExperience', 'updateSkill', 'addExperience', 'addSkill']).optional(),
	experienceId: z.string().optional(),
	skillId: z.string().optional(),
	value: z.string().optional(),
	// title: z.string().min(1),
	// summary: z.string().min(1),
	// firstName: z.string().min(1),
	// lastName: z.string().min(1),
	// email: z.string().email(),
	// phone: z.string().min(1),
	// city: z.string().min(1),
	// state: z.string().min(1),
	// country: z.string().min(1),
})




export async function action({ request }: DataFunctionArgs) {
	// const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parse(formData, {
	  schema: ResumeEditorSchema,
	  acceptMultipleErrors: () => true,
	})

	if (submission.intent !== 'submit') {
	  return json({ status: 'idle', submission } as const)
	}
  
	if (!submission.value) {
	  return json({ status: 'error', submission } as const, { status: 400 })
	}
  
	const { id, action, experienceId, skillId, value } = submission.value
  
	try {
		let resume: { id: string; owner: { username: string }; experience: any[]; skills: any[] }
	  
		switch (action) {
		  case 'updateExperience':
			if (experienceId && value) {
			  const [employer, role] = value.split(' - ')
			  await prisma.experience.update({
				where: { id: experienceId },
				data: { employer, role },
			  })
			}
			break
		  case 'updateSkill':
			if (skillId && value) {
			  await prisma.skill.update({
				where: { id: skillId },
				data: { name: value },
			  })
			}
			break
		  case 'addExperience':
			if (id) {
			  await prisma.experience.create({
				data: {
				  resumeId: id,
				  employer: 'New Employer',
				  role: 'New Role',
				  responsibilities: '',
				},
			  })
			} else {
			  throw new Error("Resume ID is required to add experience.")
			}
			break
		  case 'addSkill':
			if (id) {
			  await prisma.skill.create({
				data: {
				  resumeId: id,
				  name: 'New Skill',
				},
			  })
			} else {
			  throw new Error("Resume ID is required to add skill.")
			}
			break
		}
	  
	  resume = await prisma.resume.findUniqueOrThrow({
		where: { id },
		select: {
		  id: true,
		  owner: { select: { username: true } },
		  experience: true,
		  skills: true,
		},
	  })
  
	  return json({ status: 'success', resume })
	} catch (error) {
	  console.error('Error in resume action:', error)
	  return json({ status: 'error', submission } as const, { status: 500 })
	}
  }

export function ResumeEditor({
	resume,
  }: {
	resume?: {
	  id: string
	  experience: Array<{
		id: string
		employer: string
		role: string
	  }>
	  skills: Array<{
		id: string
		name: string
	  }>
	} | null
  }) {
	const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null)
	const [editingSkillId, setEditingSkillId] = useState<string | null>(null)
	const resumeEditorFetcher = useFetcher<ActionData>()
	const user = useUser()

	const handleEnterPress = (
		event: React.KeyboardEvent<HTMLInputElement>,
		id: string,
		value: string,
		setEditingId: React.Dispatch<React.SetStateAction<string | null>>,
		handleSubmit: (id: string, value: string) => void
	  ) => {
		if (event.key === 'Enter') {
		  event.preventDefault();
		  handleSubmit(id, value);
		  setEditingId(null);
		}
	  }
  
	const [form] = useForm({
	  id: 'resume-editor',
	  constraint: getFieldsetConstraint(ResumeEditorSchema),
	  lastSubmission: resumeEditorFetcher.data?.submission,
	  onValidate({ formData }) {
		return parse(formData, { schema: ResumeEditorSchema })
	  },
	  shouldRevalidate: 'onBlur',
	})
  
	const handleExperienceEdit = (id: string, value: string) => {
	  const formData = new FormData()
	  formData.append('id', resume?.id ?? '')
	  formData.append('experienceId', id)
	  formData.append('value', value)
	  formData.append('action', 'updateExperience')
	  
	  resumeEditorFetcher.submit(formData, { method: 'post' })
	  setEditingExperienceId(null)
	}
  
	const handleSkillEdit = (id: string, value: string) => {
	  const formData = new FormData()
	  formData.append('id', resume?.id ?? '')
	  formData.append('skillId', id)
	  formData.append('value', value)
	  formData.append('action', 'updateSkill')
	  
	  resumeEditorFetcher.submit(formData, { method: 'post' })
	  setEditingSkillId(null)
	}
  
	const handleAddExperience = () => {
	  const formData = new FormData()
	  formData.append('id', resume?.id ?? '')
	  formData.append('action', 'addExperience')
	  resumeEditorFetcher.submit(formData, { method: 'post' })
	}
  
	const handleAddSkill = () => {
	  const formData = new FormData()
	  formData.append('id', resume?.id ?? '')
	  formData.append('action', 'addSkill')
	  resumeEditorFetcher.submit(formData, { method: 'post' })
	}
  
	return (
	  <resumeEditorFetcher.Form method="post" preventScrollReset {...form.props}>
		<input name="id" type="hidden" value={resume?.id} />
		<div className="space-y-5">
		  <div>
			<h2 className="mb-2 text-h2">Edit Resume</h2>
			<p className="mb-2 text-gray-300">
			  Add or edit your experience and skills
			</p>
		  </div>
		  <div>
			<h2 className="mb-2 text-h5">Experience</h2>
			<div className="space-y-3">
			  {resume?.experience.map((experience) => (
				<div key={experience.id} className="flex items-center space-x-2">
				  {editingExperienceId === experience.id ? (
					<input
					  defaultValue={`${experience.employer} - ${experience.role}`}
					  onBlur={(e) => handleExperienceEdit(experience.id, e.target.value)}
					  autoFocus
					  onKeyDown={(e) => handleEnterPress(e, experience.id, e.currentTarget.value, setEditingExperienceId, handleExperienceEdit)}
					  />
				  ) : (
					<>
					  <span>{experience.employer} - {experience.role}</span>
					  <button type="button" onClick={() => setEditingExperienceId(experience.id)}>
						<svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
						  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
						</svg>
					  </button>
					</>
				  )}
				</div>
			  ))}
			</div>
			<Button
			  size="pill"
			  variant="secondary"
			  type="button"
			  className="mt-2"
			  onClick={handleAddExperience}
			>
			  Add new experience +
			</Button>
		  </div>
		  <div>
			<h2 className="mb-2 text-h5">Skills</h2>
			<div className="space-y-3">
			  {resume?.skills.map((skill) => (
				<div key={skill.id} className="flex items-center space-x-2">
				  {editingSkillId === skill.id ? (
					<input
					  defaultValue={skill.name}
					  onBlur={(e) => handleSkillEdit(skill.id, e.target.value)}
					  autoFocus
					/>
				  ) : (
					<>
					  <span>{skill.name}</span>
					  <button type="button" onClick={() => setEditingSkillId(skill.id)}>
						<svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
						  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
						</svg>
					  </button>
					</>
				  )}
				</div>
			  ))}
			</div>
			<Button
			  size="pill"
			  variant="secondary"
			  type="button"
			  className="mt-2"
			  onClick={handleAddSkill}
			>
			  Add new skill +
			</Button>
		  </div>
		  <div className="flex justify-end gap-4">
			<Button asChild className="mt-2">
			  <Link to={`/users/${user?.username}/jobs`}>View Jobs</Link>
			</Button>
		  </div>
		</div>
		<ErrorList errors={form.errors} id={form.errorId} />
	  </resumeEditorFetcher.Form>
	)
  }
