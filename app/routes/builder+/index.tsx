import {
	useCallback,
	useEffect,
	useRef,
	useState,
	createContext,
	type Dispatch,
	type SetStateAction,
} from 'react'
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { Form, useLoaderData, useFetcher, useNavigate } from '@remix-run/react'
import {
	EnvelopeIcon,
	PhoneIcon,
	MapPinIcon,
	LinkIcon,
	UserCircleIcon,
	TrashIcon,
	PlusIcon,
	ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { SubscribeModal } from '~/components/subscribe-modal.tsx'
import { getStripeSubscription, getUserId } from '~/utils/auth.server.ts'
import { useDebouncedCallback } from 'use-debounce'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import { AIAssistantModal } from '~/components/ai-assistant-modal.tsx'
import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragOverlay,
	type DragStartEvent,
	type DragOverEvent,
	pointerWithin,
	closestCorners,
	getFirstCollision,
	type CollisionDetection,
	type UniqueIdentifier,
	useDndContext,
} from '@dnd-kit/core'
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { EditableContent } from '~/components/editable-content.tsx'
import { SortableExperience } from '~/components/sortable-experience.tsx'
import { SortableEducation } from '~/components/sortable-education.tsx'
import {
	type BuilderEducation,
	type BuilderExperience,
	type BuilderHeaders,
	type BuilderHobby,
	type BuilderJob,
	type BuilderSkill,
	getBuilderResume,
	type ResumeData,
	type VisibleSections,
} from '~/utils/builder-resume.server.ts'
import { ImageCropper } from '~/components/image-cropper.tsx'
import { CreateJobModal } from '~/components/create-job-modal.tsx'
import { getUserJobs } from '~/utils/job.server.ts'
import JobSelector from '~/components/job-selector.tsx'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { Icon } from '~/components/ui/icon.tsx'
import { ConfirmModal } from '~/components/ui/confirm-modal.tsx'
import { Button } from '~/components/ui/button.tsx'
import { prisma } from '~/utils/db.server.ts'
import { ResumeCreationModal } from '~/components/resume-creation-modal.tsx'
import { getUserBuilderResumes } from '~/utils/builder-resume.server.ts'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import type { SubmitTarget } from 'react-router-dom/dist/dom.d.ts'
import * as reactColor from 'react-color'
import { type BuilderResume, type Job } from '@prisma/client'
import { SectionVisibilityMenu } from '~/components/section-visibility-menu.tsx'

const { ChromePicker } = reactColor

function base64ToUint8Array(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

const defaultFormData: ResumeData = {
	name: '',
	nameColor: '#6B45FF',
	role: '',
	email: '',
	phone: '',
	location: '',
	website: '',
	about: '',
	experiences: [
		{
			id: crypto.randomUUID(),
			role: '',
			company: '',
			startDate: '',
			endDate: '',
			descriptions: [
				{
					id: crypto.randomUUID(),
					content: '',
				},
			],
		},
	],
	education: [
		{
			id: crypto.randomUUID(),
			school: '',
			degree: '',
			startDate: '',
			endDate: '',
			description: '',
		},
	],
	skills: [
		{
			id: crypto.randomUUID(),
			name: '',
		},
	],
	hobbies: [
		{
			id: crypto.randomUUID(),
			name: '',
		},
	],
	image: '',
	headers: {
		experienceHeader: 'Professional Experience',
		skillsHeader: 'Skills & Expertise',
		hobbiesHeader: 'Interests & Activities',
		educationHeader: 'Education',
		aboutHeader: 'About Me',
		detailsHeader: 'Personal Details',
	},
}

const defaultVisibleSections: VisibleSections = {
	about: true,
	experience: true,
	education: true,
	skills: true,
	hobbies: true,
	personalDetails: true,
	photo: true,
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)
	const cookieHeader = request.headers.get('Cookie')
	const { resumeId, subscribe, downloadPDFRequested } =
		(await resumeCookie.parse(cookieHeader)) || {}

	let savedData = defaultFormData
	let savedVisibleSections: VisibleSections = defaultVisibleSections

	if (resumeId) {
		const resume = await getBuilderResume(resumeId)
		if (resume) {
			savedData = {
				id: resume.id,
				name: resume.name || '',
				role: resume.role || '',
				email: resume.email || '',
				phone: resume.phone || '',
				location: resume.location || '',
				website: resume.website || '',
				about: resume.about || '',
				image: resume.image || '',
				experiences: resume.experiences,
				education: resume.education,
				skills: resume.skills,
				hobbies: resume.hobbies,
				jobId: resume.jobId || null,
				job: resume.job || null,
				nameColor: resume.nameColor || '#6B45FF',
				headers: {
					experienceHeader:
						resume.headers?.experienceHeader || 'Professional Experience',
					skillsHeader: resume.headers?.skillsHeader || 'Skills & Expertise',
					hobbiesHeader:
						resume.headers?.hobbiesHeader || 'Interests & Activities',
					educationHeader: resume.headers?.educationHeader || 'Education',
					aboutHeader: resume.headers?.aboutHeader || 'About Me',
					detailsHeader: resume.headers?.detailsHeader || 'Personal Details',
				},
			}
			if (resume.visibleSections) {
				savedVisibleSections = resume.visibleSections as VisibleSections
			}
		}
	}

	const [gettingStartedProgress, subscription, jobs, resumes] =
		await Promise.all([
			userId
				? prisma.gettingStartedProgress.findUnique({
						where: { ownerId: userId },
				  })
				: null,
			userId ? getStripeSubscription(userId) : null,
			userId ? getUserJobs(userId) : ([] as Jsonify<Job>[]),
			userId ? getUserBuilderResumes(userId) : ([] as Jsonify<BuilderResume>[]),
		])

	return json({
		userId,
		subscription,
		savedData,
		savedVisibleSections,
		subscribe: subscribe === 'true',
		downloadPDFRequested: downloadPDFRequested === 'true',
		jobs,
		gettingStartedProgress,
		resumes,
	})
}

export const DraggingContext = createContext<{
	isDraggingAny: boolean
	setIsDraggingAny: Dispatch<SetStateAction<boolean>>
}>({
	isDraggingAny: false,
	setIsDraggingAny: () => {},
})

export default function ResumeBuilder() {
	// State for form data (updated on blur)

	const {
		userId,
		subscription,
		savedData,
		savedVisibleSections,
		subscribe,
		downloadPDFRequested,
		jobs,
		gettingStartedProgress,
		resumes,
	} = useLoaderData<typeof loader>()

	const [formData, setFormData] = useState(savedData)
	const [showSubscribeModal, setShowSubscribeModal] = useState(false)
	const [showCreateJob, setShowCreateJob] = useState(false)

	const fetcher = useFetcher<{ formData: Jsonify<ResumeData> }>()
	const pdfFetcher = useFetcher<{ fileData: string; fileType: string }>()

	const navigate = useNavigate()

	// Debounced save function - will only fire after 1000ms of no changes
	const debouncedSave = useDebouncedCallback(async (formData: ResumeData, newVisibleSections?: VisibleSections) => {
		const form = new FormData()
		form.append('formData', JSON.stringify(formData))
		form.append('visibleSections', JSON.stringify(newVisibleSections ?? visibleSections))
		form.append('downloadPDFRequested', 'false')
		form.append('subscribe', 'false')
		
		await fetcher.submit(form, { method: 'POST', action: '/resources/save-resume' })
	}, 1000)

	const resetSave = () => {
		fetcher.submit(
			{
				formData: JSON.stringify(defaultFormData),
				type: 'reset',
			} as SubmitTarget,
			{ method: 'post', action: '/resources/save-resume' },
		)
	}

	const handlePDFDownloadRequested = useCallback(
		({
			downloadPDFRequested,
			subscribe,
		}: {
			downloadPDFRequested: boolean
			subscribe: boolean
		}) => {
			fetcher.submit(
				{
					formData: JSON.stringify(formData),
					downloadPDFRequested,
					subscribe,
				},
				{ method: 'post', action: '/resources/save-resume' },
			)
		},
		[fetcher, formData],
	)

	const handleFieldEdit = (content: string, field: keyof typeof formData) => {
		const newFormData = {
			...formData,
			[field]: content,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const handleAboutEdit = (content: string, field: keyof typeof formData) => {
		const newFormData = {
			...formData,
			[field]: content,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			const reader = new FileReader()
			reader.onloadend = () => {
				setTempImage(reader.result as string)
				setShowCropper(true)
			}
			reader.readAsDataURL(file)
		}
	}

	const handleCroppedImage = (croppedImage: string) => {
		const newFormData = {
			...formData,
			image: croppedImage,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const addExperience = () => {
		if (!formData.experiences) {
			return
		}
		const newFormData = {
			...formData,
			experiences: [
				...formData.experiences,
				{
					id: crypto.randomUUID(),
					role: '',
					company: '',
					startDate: '',
					endDate: '',
					descriptions: [
						{
							id: crypto.randomUUID(),
							content: '',
						},
					],
				},
			],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const removeExperience = (id: string) => {
		if (!formData.experiences) {
			return
		}
		const newFormData = {
			...formData,
			experiences: formData.experiences.filter(exp => exp.id !== id),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const handleExperienceEdit = (
		content: string,
		id: string,
		field: keyof BuilderExperience,
	) => {
		if (!formData.experiences) {
			return
		}
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp =>
				exp.id === id ? { ...exp, [field]: content } : exp,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const addSkill = () => {
		if (!formData.skills) {
			return
		}
		const newId = crypto.randomUUID()
		const newFormData = {
			...formData,
			skills: [
				...formData.skills,
				{
					id: newId,
					name: '',
				},
			],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
		requestAnimationFrame(() => {
			const newSkill = document.getElementById(`skill-${newId}`)
			if (newSkill) {
				newSkill.focus()
			}
		})
	}

	const removeSkill = (id: string) => {
		if (!formData.skills) {
			return
		}
		const newFormData = {
			...formData,
			skills: formData.skills.filter(skill => skill.id !== id),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const handleSkillEdit = (
		content: string,
		id: string,
		field: keyof BuilderSkill,
	) => {
		if (!formData.skills) {
			return
		}
		const newFormData = {
			...formData,
			skills: formData.skills.map(skill =>
				skill.id === id ? { ...skill, [field]: content } : skill,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const addHobby = () => {
		if (!formData.hobbies) {
			return
		}
		const newId = crypto.randomUUID()
		const newFormData = {
			...formData,
			hobbies: [
				...formData.hobbies,
				{
					id: newId,
					name: '',
				},
			],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)

		requestAnimationFrame(() => {
			const newHobby = document.getElementById(`hobby-${newId}`)
			if (newHobby) {
				newHobby.focus()
			}
		})
	}

	const removeHobby = (id: string) => {
		if (!formData.hobbies) {
			return
		}
		const newFormData = {
			...formData,
			hobbies: formData.hobbies.filter(hobby => hobby.id !== id),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const handleHobbyEdit = (
		content: string,
		id: string,
		field: keyof BuilderHobby,
	) => {
		if (!formData.hobbies) {
			return
		}
		const newFormData = {
			...formData,
			hobbies: formData.hobbies.map(hobby =>
				hobby.id === id ? { ...hobby, [field]: content } : hobby,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const addEducation = () => {
		if (!formData.education) {
			return
		}
		const newFormData = {
			...formData,
			education: [
				...formData.education,
				{
					id: crypto.randomUUID(),
					school: '',
					degree: '',
					startDate: '',
					endDate: '',
					description: '',
				},
			],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const removeEducation = (id: string) => {
		if (!formData.education) {
			return
		}
		const newFormData = {
			...formData,
			education: formData.education.filter(edu => edu.id !== id),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const handleEducationEdit = (
		content: string,
		id: string,
		field: keyof BuilderEducation,
	) => {
		if (!formData.education) {
			return
		}
		const newFormData = {
			...formData,
			education: formData.education.map(edu =>
				edu.id === id ? { ...edu, [field]: content } : edu,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const [downloadClicked, setDownloadClicked] = useState(false)

	const handleClickDownloadPDF = () => {
		if (!userId) {
			navigate('/login?redirectTo=/builder')
			return
		}
		setDownloadClicked(true)
		handlePDFDownloadRequested({
			downloadPDFRequested: true,
			subscribe: subscription ? false : true,
		})
		handleDownloadPDF()
	}

	const handleDownloadPDF = useCallback(async () => {
		const MAX_FREE_DOWNLOADS = 3
		if (
			!subscription?.active &&
			(gettingStartedProgress?.downloadCount ?? 0) >= MAX_FREE_DOWNLOADS
		) {
			setShowSubscribeModal(true)
			return
		}
		handlePDFDownloadRequested({
			downloadPDFRequested: false,
			subscribe: false,
		})

		const resumeElement = document
			.querySelector('#resume-content')
			?.cloneNode(true) as HTMLElement
		if (!resumeElement) return

		// remove border from resume element
		resumeElement.style.border = 'none'
		resumeElement.style.boxShadow = 'none'

		if (pdfFetcher.state !== 'idle') return

		const styles = getRenderedStyles()
		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					${styles}
				</head>
				<body>
					${resumeElement.outerHTML}
				</body>
			</html>`

		pdfFetcher.submit(
			{ html: html },
			{ method: 'post', action: '/resources/generate-pdf' },
		)
	}, [subscription?.active, gettingStartedProgress?.downloadCount, handlePDFDownloadRequested, pdfFetcher])

	const pricingFetcher = useFetcher()

	useEffect(() => {
		if (!pdfFetcher.data || pdfFetcher.state !== 'idle') {
			return
		}
		const { fileData, fileType } = pdfFetcher.data
		const byteArray = base64ToUint8Array(fileData)
		const blob = new Blob([byteArray], { type: fileType })

		// create a URL for the blob and trigger the download link
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${formData.name || 'resume'}.pdf`
		a.click()
	}, [formData.name, pdfFetcher.data, pdfFetcher.state])

	useEffect(() => {
		if (subscribe && !downloadClicked) {
			handlePDFDownloadRequested({
				downloadPDFRequested,
				subscribe: false,
			})
			pricingFetcher.submit(
				{
					successUrl: `/builder`,
					cancelUrl: '/builder',
					redirectTo: `/builder`,
				},
				{
					method: 'post',
					action: '/resources/pricing',
				},
			)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [subscribe, downloadClicked])

	useEffect(() => {
		if (downloadPDFRequested && !subscribe) {
			handleDownloadPDF()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [downloadPDFRequested, subscribe])

	const addBulletPoint = (
		experienceId: string,
		bulletIndex: number,
		isOnEnter: boolean = false,
	) => {
		if (!formData.experiences) {
			return
		}
		// if on the last bullet point, add a new bullet point
		const experience = formData.experiences.find(exp => exp.id === experienceId)
		const lastBullet = (experience?.descriptions?.length ?? 0) - 1
		const nextBulletIndex = bulletIndex + 1
		if (lastBullet === bulletIndex) {
			const newFormData = {
				...formData,
				experiences: formData.experiences.map(exp => {
					if (exp.id === experienceId) {
						if (!exp.descriptions) {
							return {
								...exp,
								descriptions: [
									{
										id: crypto.randomUUID(),
										content: '',
									},
								],
							}
						}
						return {
							...exp,
							descriptions: [
								...exp.descriptions,
								{
									id: crypto.randomUUID(),
									content: '',
								},
							],
						}
					}
					return exp
				}),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		} else if (!isOnEnter) {
			// add new bullet point after the current bullet point1
			const newFormData = {
				...formData,
				experiences: formData.experiences.map(exp => {
					if (exp.id === experienceId) {
						if (!exp.descriptions) {
							return {
								...exp,
								descriptions: [
									{
										id: crypto.randomUUID(),
										content: '',
									},
								],
							}
						}
						return {
							...exp,
							descriptions: [
								...exp.descriptions.slice(0, nextBulletIndex),
								{
									id: crypto.randomUUID(),
									content: '',
								},
								...exp.descriptions.slice(nextBulletIndex),
							],
						}
					}
					return exp
				}),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		}

		// Focus the next bullet point
		requestAnimationFrame(() => {
			const bulletPoint = document.getElementById(
				`${experienceId}_${nextBulletIndex}`,
			)
			if (bulletPoint) {
				bulletPoint.focus()
			}
		})
	}

	const removeBulletPoint = (experienceId: string, bulletIndex: number) => {
		if (!formData.experiences) {
			return
		}
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp => {
				if (exp.id === experienceId) {
					if (!exp.descriptions) {
						return exp
					}
					return {
						...exp,
						descriptions: exp.descriptions.filter(
							(_, index) => index !== bulletIndex,
						),
					}
				}
				return exp
			}),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
		rerenderRef.current = true
	}

	const handleBulletPointEdit = (
		content: string,
		experienceId: string,
		bulletIndex: number,
	) => {
		if (!formData.experiences) {
			return
		}
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp => {
				if (exp.id === experienceId) {
					if (!exp.descriptions) {
						return exp
					}
					return {
						...exp,
						descriptions: exp.descriptions.map((bullet, index) =>
							index === bulletIndex ? { id: bullet.id, content } : bullet,
						),
					}
				}
				return exp
			}),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const [showAIModal, setShowAIModal] = useState(false)
	const [selectedBullet, setSelectedBullet] = useState<{
		experienceId: string
		bulletIndex: number
		content: string
	} | null>(null)

	const [selectedExperience, setSelectedExperience] = useState<
		BuilderExperience | undefined
	>(undefined)

	const handleAIClick = (
		experienceId: string,
		bulletIndex: number,
		content: string,
	) => {
		const experience = formData.experiences?.find(
			exp => exp.id === experienceId,
		)
		setSelectedExperience(experience)
		setSelectedBullet({ content, experienceId, bulletIndex })
		setShowAIModal(true)
	}

	const rerenderRef = useRef(false)
	const handleBulletUpdate = (newContent: string) => {
		if (selectedBullet) {
			handleBulletPointEdit(
				newContent,
				selectedBullet.experienceId,
				selectedBullet.bulletIndex,
			)
			rerenderRef.current = true
		}
	}

	const handleMultipleBulletUpdate = (newContents: string[]) => {
		if (!formData.experiences) {
			return
		}
		if (selectedBullet && newContents.length > 0) {
			const [firstBullet, ...remainingBullets] = newContents

			const newFormData = {
				...formData,
				experiences: formData.experiences.map(exp =>
					exp.id === selectedBullet.experienceId
						? {
								...exp,
								descriptions: [
									...(exp.descriptions ?? []).slice(
										0,
										selectedBullet.bulletIndex,
									),
									{ content: firstBullet }, // Replace current bullet with first generated one
									...remainingBullets.map(bullet => ({
										id: crypto.randomUUID(),
										content: bullet,
									})), // Add remaining bullets after
									...(exp.descriptions ?? []).slice(
										selectedBullet.bulletIndex + 1,
									),
								],
						  }
						: exp,
				),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
			rerenderRef.current = true
		}
	}

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	// Keep track of last known drop container
	const recentlyMovedToNewContainer = useRef(false)
	const lastOverId = useRef<UniqueIdentifier | null>(null)

	// Custom collision detection strategy
	const collisionDetectionStrategy: CollisionDetection = useCallback(args => {
		// If we're dragging a bullet point, use standard detection
		if (args.active.id.toString().includes('_')) {
			return closestCorners(args)
		}

		// First, let's check if there are any collisions with pointer
		const pointerCollisions = pointerWithin(args)

		// If we're not dragging over anything, return empty
		if (!pointerCollisions.length) return []

		// If we recently moved to a new container and have an active collision,
		// return the last known collision
		const containerId = lastOverId.current
		if (containerId && recentlyMovedToNewContainer.current) {
			const collision = pointerCollisions.find(({ id }) => id === containerId)
			if (collision) return [collision]
		}

		// Return the first collision or empty array
		const firstCollision = getFirstCollision(pointerCollisions, 'id')
		if (firstCollision) {
			lastOverId.current = firstCollision
			return [{ id: firstCollision }]
		}

		return []
	}, [])

	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string)
		setIsDraggingAny(true)
		recentlyMovedToNewContainer.current = false
	}

	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event

		// Only handle experience items
		if (!active.id.toString().includes('_') && over) {
			recentlyMovedToNewContainer.current = true
		}
	}

	const handleDragEnd = (event: DragEndEvent) => {
		setIsDraggingAny(false)
		setActiveId(null)
		recentlyMovedToNewContainer.current = false
		lastOverId.current = null

		const { active, over } = event
		if (!over || active.id === over.id) return

		// Check if we're dragging an experience, education, or bullet point
		const type = active.data.current?.type

		if (type === 'experience') {
			if (!formData.experiences) {
				return
			}
			const oldIndex = formData.experiences.findIndex(
				exp => exp.id === active.id,
			)
			const newIndex = formData.experiences.findIndex(exp => exp.id === over.id)

			const newFormData = {
				...formData,
				experiences: arrayMove(formData.experiences, oldIndex, newIndex),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		} else if (type === 'education') {
			if (!formData.education) {
				return
			}
			const oldIndex = formData.education.findIndex(edu => edu.id === active.id)
			const newIndex = formData.education.findIndex(edu => edu.id === over.id)

			const newFormData = {
				...formData,
				education: arrayMove(formData.education, oldIndex, newIndex),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		} else {
			// Handle bullet point dragging
			if (!formData.experiences) {
				return
			}
			const [activeExpId, activeBulletIndex] = active.id.toString().split('_')
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [_overExpId, overBulletIndex] = over.id.toString().split('_')

			const newFormData = {
				...formData,
				experiences: formData.experiences.map(exp => {
					if (exp.id === activeExpId) {
						if (!exp.descriptions) {
							return exp
						}
						let newDescription = [...exp.descriptions]
						const oldIndex = parseInt(activeBulletIndex)
						const newIndex = parseInt(overBulletIndex)
						const [movedItem] = newDescription.splice(oldIndex, 1)
						newDescription.splice(newIndex, 0, movedItem)
						return { ...exp, descriptions: newDescription }
					}
					return exp
				}),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
			setSelectedBullet({
				experienceId: activeExpId,
				bulletIndex: parseInt(overBulletIndex),
				content:
					formData.experiences.find(exp => exp.id === activeExpId)
						?.descriptions?.[parseInt(overBulletIndex)]?.content ?? '',
			})
			rerenderRef.current = true

			// Focus the new bullet point
			requestAnimationFrame(() => {
				const bulletPoint = document.getElementById(
					`${activeExpId}_${parseInt(overBulletIndex)}`,
				)
				if (bulletPoint) {
					bulletPoint.focus()
				}
			})
		}
	}

	const handleUploadResume = () => {
		if (!userId) {
			navigate('/login?redirectTo=/builder')
			return false
		} else if (!subscription) {
			setShowCreationModal(false)
			setShowSubscribeModal(true)
			return false
		}
		return true
	}

	const [isDraggingAny, setIsDraggingAny] = useState(false)
	const [activeId, setActiveId] = useState<string | null>(null)

	const DragOverlayContent = () => {
		const { active } = useDndContext()

		if (!activeId || !active?.data.current) return null

		if (active.data.current.type === 'bullet') {
			return null
		}

		return (
			<div className="rounded-lg border bg-white shadow-lg">
				{active.data.current.type === 'experience' ? (
					formData.experiences ? (
						<SortableExperience
							experience={
								formData.experiences.find(exp => exp.id === activeId)!
							}
							onExperienceEdit={handleExperienceEdit}
							onRemoveExperience={removeExperience}
							onAddExperience={addExperience}
							onAIClick={handleAIClick}
							onAddBullet={addBulletPoint}
							onRemoveBullet={removeBulletPoint}
							onBulletEdit={handleBulletPointEdit}
							rerenderRef={rerenderRef}
						/>
					) : null
				) : active.data.current.type === 'education' ? (
					formData.education ? (
						<SortableEducation
							education={formData.education.find(edu => edu.id === activeId)!}
							onEducationEdit={handleEducationEdit}
							onRemoveEducation={removeEducation}
							onAddEducation={addEducation}
						/>
					) : null
				) : null}
			</div>
		)
	}

	const handleHeaderEdit = (content: string, field: keyof BuilderHeaders) => {
		const newFormData = {
			...formData,
			headers: {
				...formData.headers,
				[field]: content,
			},
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	// Add state for cropper
	const [showCropper, setShowCropper] = useState(false)
	const [tempImage, setTempImage] = useState<string | null>(null)

	// Add state for selected job
	const [selectedJob, setSelectedJob] = useState<BuilderJob | null | undefined>(
		formData.job,
	)

	const handleJobChange = useCallback(
		(job: BuilderJob) => {
			setSelectedJob(job)
			const newFormData = {
				...formData,
				jobId: job.id,
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		},
		[formData, setFormData, debouncedSave],
	)

	const handleCloseCreateJob = useCallback(() => {
		setShowCreateJob(false)
	}, [setShowCreateJob])

	const [showResetModal, setShowResetModal] = useState(false)

	const handleReset = () => {
		setFormData(defaultFormData as Jsonify<ResumeData>)
		setNameColor(defaultFormData.nameColor ?? '#6B45FF')
		setVisibleSections(defaultVisibleSections)
		setShowResetModal(false)
		setShowCreationModal(true)
		rerenderRef.current = true
		// reset the cookie
		resetSave()
	}

	const [showCreationModal, setShowCreationModal] = useState(!formData.id)

	const isModalDisplaying = showAIModal || showCreateJob

	// Add state for color and color picker visibility
	const [nameColor, setNameColor] = useState(formData.nameColor ?? '#6B45FF')
	const [showColorPicker, setShowColorPicker] = useState(false)

	const handleNameColorChange = (color: string) => {
		setNameColor(color)
		const newFormData = {
			...formData,
			nameColor: color,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const [visibleSections, setVisibleSections] = useState(savedVisibleSections)

	const handleToggleSection = (sectionId: string) => {
		const newVisibleSections = {
			...visibleSections,
			[sectionId as keyof typeof visibleSections]: !visibleSections[sectionId as keyof typeof visibleSections],
		}

		setVisibleSections(newVisibleSections)
		debouncedSave(formData, newVisibleSections)
	}

	return (
		<DraggingContext.Provider value={{ isDraggingAny, setIsDraggingAny }}>
			<DndContext
				sensors={sensors}
				collisionDetection={collisionDetectionStrategy}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
				onDragCancel={() => {
					setActiveId(null)
					setIsDraggingAny(false)
					recentlyMovedToNewContainer.current = false
					lastOverId.current = null
				}}
			>
				<div
					className={`relative transition-all duration-300 ease-in-out ${
						isModalDisplaying ? 'mr-[300px]' : ''
					}`}
				>
					<div className="mx-auto max-w-7xl p-6">
						<SubscribeModal
							isOpen={showSubscribeModal}
							onClose={() => setShowSubscribeModal(false)}
							successUrl={`/builder`}
							redirectTo={`/builder`}
							cancelUrl={'/builder'}
						/>

						<AIAssistantModal
							isOpen={showAIModal}
							onClose={() => setShowAIModal(false)}
							onUpdate={handleBulletUpdate}
							onMultipleUpdate={handleMultipleBulletUpdate}
							content={selectedBullet?.content}
							experience={selectedExperience}
							job={selectedJob}
							subscription={subscription}
							gettingStartedProgress={gettingStartedProgress}
							setShowSubscribeModal={setShowSubscribeModal}
						/>
						<CreateJobModal
							isOpen={showCreateJob}
							onClose={handleCloseCreateJob}
							onCreate={handleJobChange}
						/>

						<div
							className={`mb-6 flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm ${
								isModalDisplaying ? 'scale-90' : ''
							}`}
						>
							<div className="flex items-center gap-4">
								<JobSelector
									jobs={jobs}
									handleAddJob={() => setShowCreateJob(true)}
									selectedJob={selectedJob}
									setSelectedJob={handleJobChange}
								/>
							</div>
							<div className="flex gap-2">
								<div className="relative">
									<button
										title="Change Color"
										onClick={() => setShowColorPicker(!showColorPicker)}
										className="h-10 w-10 rounded-full border border-gray-300 shadow-sm"
										style={{ backgroundColor: nameColor }}
									/>
									{showColorPicker && (
										<div className="absolute right-0 top-10 z-10">
											<div
												className="fixed inset-0"
												onClick={() => setShowColorPicker(false)}
											/>
											<ChromePicker
												color={nameColor}
												onChange={col => handleNameColorChange(col.hex)}
											/>
										</div>
									)}
								</div>
								<StatusButton
									type="button"
									onClick={() => debouncedSave(formData)}
									className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-200"
									status={
										fetcher.state === 'submitting'
											? 'pending'
											: fetcher.state === 'idle' && fetcher.data
											? 'success'
											: 'idle'
									}
									title="Save"
								>
									<Icon size="md" name="save" />
								</StatusButton>
								<SectionVisibilityMenu
									sections={[
										{
											id: 'about',
											label: 'About Me',
											visible: visibleSections.about,
										},
										{
											id: 'experience',
											label: 'Experience',
											visible: visibleSections.experience,
										},
										{
											id: 'education',
											label: 'Education',
											visible: visibleSections.education,
										},
										{
											id: 'skills',
											label: 'Skills',
											visible: visibleSections.skills,
										},
										{
											id: 'hobbies',
											label: 'Interests',
											visible: visibleSections.hobbies,
										},
										{
											id: 'personalDetails',
											label: 'Personal Details',
											visible: visibleSections.personalDetails,
										},
										{
											id: 'photo',
											label: 'Photo',
											visible: visibleSections.photo,
										},
									]}
									onToggleSection={handleToggleSection}
								/>
								<Button
									onClick={handleReset}
									className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-200"
								>
									<Icon size="md" name="plus" />
									New Resume
								</Button>
								<StatusButton
									type="button"
									onClick={handleClickDownloadPDF}
									className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-200"
									status={
										pdfFetcher.state === 'submitting'
											? 'pending'
											: pdfFetcher.state === 'idle' && pdfFetcher.data
											? 'success'
											: 'idle'
									}
								>
									<ArrowDownTrayIcon className="h-4 w-4" />
									Download PDF
								</StatusButton>
							</div>
						</div>

						<Form key={`${formData.id}-${rerenderRef.current}`} method="post">
							{/* Hidden inputs to store the actual form data */}
							{Object.entries(formData)
								.filter(([key]) => key !== 'experiences')
								.map(([key, value]) => (
									<input
										key={key}
										type="hidden"
										name={key}
										value={value as string}
									/>
								))}
							<input
								type="hidden"
								name="experiences"
								value={JSON.stringify(formData.experiences)}
							/>

							{/* Resume Paper with both panes inside */}
							<div
								id="resume-content"
								className={`min-h-[842px] rounded-lg border bg-white p-8 shadow-lg ${
									isModalDisplaying ? 'scale-90' : ''
								}`}
							>
								<div className="grid grid-cols-[250px_1fr] gap-8">
									{/* Left Pane */}
									<div className="space-y-6 pr-6">
										{/* Image Upload */}
										{visibleSections.photo && (
											<div>
												<input
													type="file"
													accept="image/*"
													className="hidden"
													onChange={handleImageUpload}
													id="image-upload"
												/>
												<label
													htmlFor="image-upload"
													className="block cursor-pointer"
												>
													<div
														className={`aspect-square w-full overflow-hidden rounded-full ${
															formData.image
																? ''
																: 'border-2 border-dashed border-gray-300 bg-gray-50 transition hover:bg-gray-100'
														}`}
													>
														{formData.image ? (
															<img
																src={formData.image}
																alt="Profile"
																className="h-full w-full object-cover"
															/>
														) : (
															<div className="flex h-full flex-col items-center justify-center gap-2 p-4">
																<UserCircleIcon className="h-16 w-16 text-gray-400" />
																<span className="text-sm text-gray-500">
																	Click to upload photo
																</span>
															</div>
														)}
													</div>
												</label>
											</div>
										)}

										{/* About Me */}
										{visibleSections.about && (
											<div className="rounded border-dashed border-gray-400 hover:border">
												<EditableContent
													content={formData.headers?.aboutHeader}
													onInput={e =>
														handleHeaderEdit(
															e.currentTarget.innerText,
															'aboutHeader',
														)
													}
													className="mb-2 font-semibold text-gray-700"
													placeholder="About Me"
													rerenderRef={rerenderRef}
												/>
												<EditableContent
													multiline
													content={formData.about}
													onInput={e =>
														handleAboutEdit(e.currentTarget.innerText, 'about')
													}
													className="min-h-[150px] p-3 text-sm text-gray-600"
													placeholder="Write a brief introduction about yourself..."
													rerenderRef={rerenderRef}
												/>
											</div>
										)}

										{/* Personal Details */}
										{visibleSections.personalDetails && (
											<div>
												<EditableContent
													content={formData.headers?.detailsHeader}
													onInput={e =>
														handleHeaderEdit(
															e.currentTarget.innerText,
															'detailsHeader',
														)
													}
													className="mb-2 font-semibold text-gray-700"
													placeholder="Personal Details"
													rerenderRef={rerenderRef}
												/>
												<div className="space-y-3">
													<div className="flex items-center gap-2">
														<MapPinIcon className="h-5 w-5 text-gray-400" />
														<EditableContent
															content={formData.location}
															onInput={e =>
																handleFieldEdit(
																	e.currentTarget.innerText,
																	'location',
																)
															}
															className="flex-1 rounded p-1 text-sm text-gray-600 outline-none transition"
															placeholder="Location"
															rerenderRef={rerenderRef}
														/>
													</div>
													<div className="flex items-center gap-2">
														<EnvelopeIcon className="h-5 w-5 text-gray-400" />
														<EditableContent
															content={formData.email}
															onInput={e =>
																handleFieldEdit(
																	e.currentTarget.innerText,
																	'email',
																)
															}
															className="flex-1 rounded p-1 text-sm text-gray-600 outline-none transition"
															placeholder="Email"
															rerenderRef={rerenderRef}
														/>
													</div>
													<div className="flex items-center gap-2">
														<PhoneIcon className="h-5 w-5 text-gray-400" />
														<EditableContent
															content={formData.phone}
															onInput={e =>
																handleFieldEdit(
																	e.currentTarget.innerText,
																	'phone',
																)
															}
															className="flex-1 rounded p-1 text-sm text-gray-600 outline-none transition"
															placeholder="Phone"
															rerenderRef={rerenderRef}
														/>
													</div>
													<div className="flex items-center gap-2">
														<LinkIcon className="h-5 w-5 text-gray-400" />
														<EditableContent
															content={formData.website}
															onInput={e =>
																handleFieldEdit(
																	e.currentTarget.innerText,
																	'website',
																)
															}
															className="flex-1 rounded p-1 text-sm text-gray-600 outline-none transition"
															placeholder="Website"
															rerenderRef={rerenderRef}
														/>
													</div>
												</div>
											</div>
										)}
									</div>

									{/* Right Pane */}
									<div>
										<EditableContent
											content={formData.name}
											onInput={e =>
												handleFieldEdit(e.currentTarget.innerText, 'name')
											}
											className={`mb-2 rounded p-1 text-3xl font-bold outline-none transition`}
											placeholder="Your Name"
											rerenderRef={rerenderRef}
											style={{ color: nameColor }}
										/>

										<EditableContent
											content={formData.role}
											onInput={e =>
												handleFieldEdit(e.currentTarget.innerText, 'role')
											}
											className="mb-4 rounded p-1 text-xl text-gray-600 outline-none transition"
											placeholder="Your Role (e.g. Frontend Developer)"
											rerenderRef={rerenderRef}
										/>

										<div className="mb-6">
											{visibleSections.experience && (
												<EditableContent
													content={formData.headers?.experienceHeader}
													onInput={e =>
														handleHeaderEdit(
															e.currentTarget.innerText,
															'experienceHeader',
														)
													}
													className="mb-4 text-xl font-semibold text-gray-700 outline-none"
													placeholder="Professional Experience"
												/>
											)}

											<div className="space-y-4">
												{visibleSections.experience && formData.experiences ? (
													<SortableContext
														items={formData.experiences.map(exp => exp.id!)}
														strategy={verticalListSortingStrategy}
													>
														{formData.experiences?.map(exp => (
															<SortableExperience
																key={exp.id}
																experience={exp}
																onExperienceEdit={handleExperienceEdit}
																onRemoveExperience={removeExperience}
																onAddExperience={addExperience}
																onAIClick={handleAIClick}
																onAddBullet={addBulletPoint}
																onRemoveBullet={removeBulletPoint}
																onBulletEdit={handleBulletPointEdit}
																rerenderRef={rerenderRef}
															/>
														))}
													</SortableContext>
												) : null}
											</div>
										</div>

										<div className="mb-6">
											{visibleSections.education && (
												<EditableContent
													content={formData.headers?.educationHeader}
													onInput={e =>
														handleHeaderEdit(
															e.currentTarget.innerText,
															'educationHeader',
														)
													}
													className="mb-4 text-xl font-semibold text-gray-700 outline-none"
													placeholder="Education"
												/>
											)}
											<div className="space-y-4">
												{visibleSections.education &&
												formData.education?.length === 0 ? (
													<div className="rounded border border-dashed border-gray-300 p-4 text-center text-gray-500">
														Click "Add Education" to add your educational
														background
													</div>
												) : visibleSections.education && formData.education ? (
													<SortableContext
														items={formData.education.map(edu => edu.id!)!}
														strategy={verticalListSortingStrategy}
													>
														{formData.education?.map(edu => (
															<SortableEducation
																key={edu.id}
																education={edu}
																onEducationEdit={handleEducationEdit}
																onRemoveEducation={removeEducation}
																onAddEducation={addEducation}
															/>
														))}
													</SortableContext>
												) : null}
											</div>
										</div>

										<div className="mb-6">
											{visibleSections.skills && (
												<>
													<EditableContent
														content={formData.headers?.skillsHeader}
														onInput={e =>
															handleHeaderEdit(
																e.currentTarget.innerText,
																'skillsHeader',
															)
														}
														className="mb-4 text-xl font-semibold text-gray-700 outline-none"
														placeholder="Skills & Expertise"
													/>

													<div className="flex flex-wrap gap-2">
														{visibleSections.skills &&
															formData.skills?.map(skill => (
																<div
																	key={skill.id}
																	className="group relative flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-center"
																>
																	<EditableContent
																		content={skill.name}
																		onInput={e =>
																			handleSkillEdit(
																				e.currentTarget.innerText,
																				skill.id!,
																				'name',
																			)
																		}
																		onEnter={() => addSkill()}
																		className="text-sm text-gray-700 outline-none"
																		placeholder="Skill"
																		id={`skill-${skill.id}`}
																	/>
																	<button
																		type="button"
																		onClick={() => removeSkill(skill.id!)}
																		className="ml-2 hidden text-gray-400 hover:text-gray-600 group-hover:block"
																	>
																		<TrashIcon className="h-3 w-3" />
																	</button>
																	<button
																		type="button"
																		onClick={() => addSkill()}
																		className="ml-2 hidden text-gray-400 hover:text-gray-600 group-hover:block"
																	>
																		<PlusIcon className="h-3 w-3" />
																	</button>
																</div>
															))}
													</div>
												</>
											)}
										</div>

										<div className="mb-6">
											{visibleSections.hobbies && (
												<EditableContent
													content={formData.headers?.hobbiesHeader}
													onInput={e =>
														handleHeaderEdit(
															e.currentTarget.innerText,
															'hobbiesHeader',
														)
													}
													className="mb-4 text-xl font-semibold text-gray-700 outline-none"
													placeholder="Interests & Activities"
													rerenderRef={rerenderRef}
												/>
											)}

											<div className="flex flex-wrap gap-2">
												{visibleSections.hobbies &&
													formData.hobbies?.map(hobby => (
														<div
															key={hobby.id}
															className="group relative flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-center"
														>
															<EditableContent
																content={hobby.name}
																onInput={e =>
																	handleHobbyEdit(
																		e.currentTarget.innerText,
																		hobby.id!,
																		'name',
																	)
																}
																onEnter={() => addHobby()}
																className="text-sm text-gray-700 outline-none"
																placeholder="Hobby"
																id={`hobby-${hobby.id}`}
															/>
															<button
																type="button"
																onClick={() => removeHobby(hobby.id!)}
																className="ml-2 hidden text-gray-400 hover:text-gray-600 group-hover:block"
															>
																<TrashIcon className="h-3 w-3" />
															</button>
															<button
																type="button"
																onClick={() => addHobby()}
																className="ml-2 hidden text-gray-400 hover:text-gray-600 group-hover:block"
															>
																<PlusIcon className="h-3 w-3" />
															</button>
														</div>
													))}
											</div>
										</div>
									</div>
								</div>
							</div>
						</Form>
					</div>
				</div>
				<DragOverlay dropAnimation={null}>
					<DragOverlayContent />
				</DragOverlay>
			</DndContext>
			{showCropper && tempImage && (
				<ImageCropper
					image={tempImage}
					onCrop={handleCroppedImage}
					onClose={() => {
						setShowCropper(false)
						setTempImage(null)
					}}
				/>
			)}
			{!userId ? (
				<ConfirmModal
					isOpen={showResetModal}
					onClose={() => setShowResetModal(false)}
					onConfirm={handleReset}
					title="Create New Resume"
					message="Are you sure you want to create a new resume? This will clear all your current data and cannot be undone. Please sign in to save your progress."
				/>
			) : null}
			<ResumeCreationModal
				isOpen={showCreationModal}
				onClose={() => setShowCreationModal(false)}
				resumes={resumes}
				handleUploadResume={handleUploadResume}
				userId={userId}
				subscription={subscription}
			/>
		</DraggingContext.Provider>
	)
}

export const action = async ({ request }: ActionFunctionArgs) => {
	const formData = await request.formData()
	console.log(formData)
	// Handle form submission here
	// You could save to a database, generate a PDF, etc.
	return null
}

function getRenderedStyles() {
	// Get all stylesheet links and inline styles
	const styles = Array.from(document.styleSheets)
		.map(sheet => {
			try {
				return Array.from(sheet.cssRules)
					.map(rule => rule.cssText)
					.join('\n')
			} catch (e) {
				// Skip external stylesheets that might cause CORS issues
				return ''
			}
		})
		.join('\n')

	return `<style>${styles}</style>`
}
