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
	ArrowUturnLeftIcon,
	ExclamationTriangleIcon,
	XMarkIcon,
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
import { type Job } from '@prisma/client'
import { SectionVisibilityMenu } from '~/components/section-visibility-menu.tsx'
import type OpenAI from 'openai'
import { RainbowSparklesIcon } from '~/components/rainbow-sparkles-icon.tsx'
import {
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
	Tooltip,
} from '~/components/ui/tooltip.tsx'
import { FontSelector } from '~/components/font-selector.tsx'
import { LayoutSelector } from '~/components/layout-selector.tsx'
import { TextSizeSelector } from '~/components/text-size-selector.tsx'
import { ResumeScoreCard } from '~/components/resume-score-card.tsx'
import { ImprovementChecklist } from '~/components/improvement-checklist.tsx'
import { useResumeScore } from '~/hooks/use-resume-score.ts'
import { TailorDiffModal } from '~/components/tailor-diff-modal.tsx'
import {
	createDiffSummary,
	extractJobKeywords,
	type DiffSummary,
} from '~/utils/tailor-diff.ts'
import { trackEvent as trackLegacyEvent } from '~/utils/tracking.client.ts'
import { trackEvent } from '~/utils/analytics.ts'
import { track } from '~/lib/analytics.client.ts'
import { useOnboardingFlow } from '~/hooks/use-onboarding-flow.ts'
import { JobPasteModal } from '~/components/job-paste-modal.tsx'
import { SpotlightOverlay } from '~/components/spotlight-overlay.tsx'
const { ChromePicker } = reactColor

function base64ToUint8Array(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

const getDefaultFormData = (): ResumeData => {
	return {
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
				name: 'Product: ',
			},
			{
				id: crypto.randomUUID(),
				name: 'Tools: ',
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
			experienceHeader: 'Work Experience',
			skillsHeader: 'Skills',
			hobbiesHeader: 'Interests & Activities',
			educationHeader: 'Education',
			aboutHeader: 'About Me',
			detailsHeader: 'Personal Details',
		},
		visibleSections: {
			about: true,
			experience: true,
			education: true,
			skills: true,
			hobbies: true,
			personalDetails: true,
			photo: true,
		},
		font: 'font-crimson',
		layout: 'traditional',
		textSize: 'medium',
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)
	const cookieHeader = request.headers.get('Cookie')
	const { resumeId, subscribe, downloadPDFRequested, resumeUploadedTracking } =
		(await resumeCookie.parse(cookieHeader)) || {}

	let savedData = getDefaultFormData()

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
						resume.headers?.experienceHeader || 'Work Experience',
					skillsHeader: resume.headers?.skillsHeader || 'Skills',
					hobbiesHeader:
						resume.headers?.hobbiesHeader || 'Interests & Activities',
					educationHeader: resume.headers?.educationHeader || 'Education',
					aboutHeader: resume.headers?.aboutHeader || '',
					detailsHeader: resume.headers?.detailsHeader || 'Personal Details',
				},
				visibleSections: {
					about: resume.visibleSections?.about ?? true,
					experience: resume.visibleSections?.experience ?? true,
					education: resume.visibleSections?.education ?? true,
					skills: resume.visibleSections?.skills ?? true,
					hobbies: resume.visibleSections?.hobbies ?? true,
					personalDetails: resume.visibleSections?.personalDetails ?? true,
					photo: resume.visibleSections?.photo ?? true,
				},
				font: resume.font || 'font-crimson',
				layout: resume.layout || 'traditional',
				textSize: resume.textSize || 'medium',
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
			userId ? getUserBuilderResumes(userId) : ([] as ResumeData[]),
		])

	// Clear tracking data from cookie after reading
	const headers: HeadersInit = {}
	if (resumeUploadedTracking) {
		headers['Set-Cookie'] = await resumeCookie.serialize({
			resumeId,
			subscribe: subscribe === 'true',
			downloadPDFRequested: downloadPDFRequested === 'true',
			resumeUploadedTracking: undefined,
		})
	}

	return json(
		{
			userId,
			subscription,
			savedData,
			subscribe: subscribe === 'true',
			downloadPDFRequested: downloadPDFRequested === 'true',
			jobs,
			gettingStartedProgress,
			resumes,
			resumeUploadedTracking,
		},
		{ headers },
	)
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
		subscribe,
		downloadPDFRequested,
		jobs,
		gettingStartedProgress,
		resumes,
		resumeUploadedTracking,
	} = useLoaderData<typeof loader>()

	const [formData, setFormData] = useState(savedData)
	const [showSubscribeModal, setShowSubscribeModal] = useState(false)
	const [showCreateJob, setShowCreateJob] = useState(false)

	// New state for diff modal
	const [showDiffModal, setShowDiffModal] = useState(false)
	const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null)

	// New state for error handling
	const [errorState, setErrorState] = useState<{
		message: string
		retryable: boolean
		suggestion?: string
		errorType: string
	} | null>(null)

	const fetcher = useFetcher<{ formData: Jsonify<ResumeData> }>()
	const pdfFetcher = useFetcher<{ fileData: string; fileType: string }>()

	const navigate = useNavigate()

	// Calculate resume score in real-time for gamification
	const extractedKeywords = formData.job?.extractedKeywords
		? (JSON.parse(formData.job.extractedKeywords) as string[])
		: null

	const { scores, previousScore, checklist } = useResumeScore({
		resumeData: formData,
		jobDescription: formData.job?.content ?? undefined,
		extractedKeywords,
		debounceMs: 500,
	})

	// Track builder opened on mount
	useEffect(() => {
		track('builder_opened', {
			resume_id: savedData.id || 'new',
			has_job: !!savedData.jobId,
			section_count: (savedData.experiences?.length || 0) + (savedData.education?.length || 0),
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Debounced save function - will only fire after 1000ms of no changes
	const debouncedSave = useDebouncedCallback(async (formData: ResumeData) => {
		const form = new FormData()
		form.append('formData', JSON.stringify(formData))
		form.append('downloadPDFRequested', 'false')
		form.append('subscribe', 'false')

		await fetcher.submit(form, {
			method: 'POST',
			action: '/resources/save-resume',
		})
	}, 1000)

	const resetSave = () => {
		fetcher.submit(
			{
				formData: JSON.stringify(getDefaultFormData()),
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
			// Track paywall shown in PostHog
			track('paywall_shown', {
				trigger: 'download_limit',
				usage_count: gettingStartedProgress?.downloadCount ?? 0,
				limit: MAX_FREE_DOWNLOADS,
			})
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

		// Remove preview-only elements (gradient overlays, page break indicators, etc.)
		resumeElement.querySelectorAll('.preview-only').forEach(el => el.remove())

		// Remove border and box-shadow from resume element
		resumeElement.style.border = 'none'
		resumeElement.style.boxShadow = 'none'

		// Remove overflow-hidden to allow multi-page content
		resumeElement.style.overflow = 'visible'
		resumeElement.style.height = 'auto'
		resumeElement.classList.remove('overflow-hidden')

		if (pdfFetcher.state !== 'idle') return

		const styles = getRenderedStyles()
		const fontLinks = getGoogleFontsLinks()
		// Include base URL so relative font paths resolve in Puppeteer
		const baseUrl = window.location.origin
		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					<base href="${baseUrl}/">
					${fontLinks}
					${styles}
				</head>
				<body>
					${resumeElement.outerHTML}
				</body>
			</html>`

		pdfFetcher.submit(
			{ html: html, resumeId: formData.id ?? '' },
			{ method: 'post', action: '/resources/generate-pdf' },
		)
	}, [
		subscription?.active,
		gettingStartedProgress?.downloadCount,
		handlePDFDownloadRequested,
		pdfFetcher,
		formData.id,
	])

	const pricingFetcher = useFetcher()

	// Track pdfFetcher.data reference to detect actual new data
	const lastPdfDataRef = useRef<{ fileData: string; fileType: string } | null>(
		null,
	)

	useEffect(() => {
		if (!pdfFetcher.data || pdfFetcher.state !== 'idle') {
			return
		}
		// Only download if this is new data (not just a re-render)
		if (pdfFetcher.data === lastPdfDataRef.current) {
			return
		}
		lastPdfDataRef.current = pdfFetcher.data

		const { fileData, fileType } = pdfFetcher.data
		const byteArray = base64ToUint8Array(fileData)
		const blob = new Blob([byteArray as BlobPart], { type: fileType })

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

	// Track resume_uploaded event
	useEffect(() => {
		if (resumeUploadedTracking) {
			trackEvent('resume_uploaded', {
				user_id: resumeUploadedTracking.user_id,
				plan_type: resumeUploadedTracking.plan_type,
			})
		}
	}, [resumeUploadedTracking])

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

		// Track bullet AI click during onboarding and advance to needs_tailor_click stage
		if (onboarding.stage === 'needs_bullet_tailor') {
			trackLegacyEvent('onboarding_bullet_ai_clicked', {
				userId,
				resumeId: formData.id,
				jobId: selectedJob?.id,
				category: 'Onboarding',
			})
			onboarding.handleAIModalOpen()
		}
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

			// Track bullet AI selection during onboarding
			if (onboarding.stage === 'needs_tailor_click') {
				trackLegacyEvent('onboarding_bullet_ai_selected', {
					userId,
					resumeId: formData.id,
					jobId: selectedJob?.id,
					category: 'Onboarding',
				})
			}
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
				jobId: job?.id ?? null,
				job: job ?? null,
			}
			setFormData(newFormData)
			debouncedSave(newFormData)

			// Track job selection
			trackLegacyEvent('job_selected', {
				jobId: job?.id,
				hasJobDescription: !!(job?.content && job.content.trim().length > 0),
				userId,
				category: 'Resume Builder',
			})
		},
		[formData, setFormData, debouncedSave, userId],
	)

	const handleCloseCreateJob = useCallback(() => {
		setShowCreateJob(false)
	}, [setShowCreateJob])

	const [showResetModal, setShowResetModal] = useState(false)

	const handleReset = () => {
		setFormData(getDefaultFormData() as Jsonify<ResumeData>)
		setNameColor(getDefaultFormData().nameColor ?? '#6B45FF')
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

	const handleToggleSection = (sectionId: string) => {
		if (!formData.visibleSections) {
			return
		}
		const newFormData = {
			...formData,
			visibleSections: {
				...formData.visibleSections,
				[sectionId as keyof typeof formData.visibleSections]: !(
					formData.visibleSections?.[
						sectionId as keyof typeof formData.visibleSections
					] ?? true
				),
			},
		}

		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const tailorFetcher = useFetcher<OpenAI.Chat.Completions.ChatCompletion>()

	// Add new state for storing the pre-tailored resume
	const [preTailoredResume, setPreTailoredResume] =
		useState<Jsonify<ResumeData> | null>(null)

	// Onboarding flow hook - manages all onboarding state and logic
	// hasTailored is true if user has ever used bullet-level AI tailor (persisted in gettingStartedProgress)
	const onboarding = useOnboardingFlow({
		serverProgress: gettingStartedProgress,
		hasResume: !!(formData.name || formData.role),
		selectedJob: selectedJob as Jsonify<Job> | null | undefined,
		hasTailored: (gettingStartedProgress?.tailorCount ?? 0) > 0,
		onJobSelect: handleJobChange as (job: Jsonify<Job>) => void,
	})

	const handleTailorEntireResume = async () => {
		if (!selectedJob) {
			return
		}

		// Store current resume state before tailoring
		setPreTailoredResume(formData)

		const form = new FormData()
		form.append('jobTitle', selectedJob.title || '')
		form.append('jobDescription', selectedJob.content || '')
		form.append('entireResume', 'true')
		form.append('resumeData', JSON.stringify(formData))

		// Pass the pre-extracted keywords for better tailoring
		if (extractedKeywords && extractedKeywords.length > 0) {
			form.append('extractedKeywords', JSON.stringify(extractedKeywords))
		}

		await tailorFetcher.submit(form, {
			method: 'POST',
			action: '/resources/builder-completions',
		})
	}

	// Add new function to handle undo
	const handleUndoTailor = () => {
		if (preTailoredResume) {
			setFormData(preTailoredResume)
			debouncedSave(preTailoredResume)
			setPreTailoredResume(null)
			rerenderRef.current = true
		}
	}

	useEffect(() => {
		if (tailorFetcher.data && tailorFetcher.state === 'idle') {
			// Check for errors first
			const data = tailorFetcher.data as any
			if (data.error) {
				setErrorState({
					message: data.error,
					retryable: data.retryable || false,
					suggestion: data.suggestion,
					errorType: data.errorType || 'unknown',
				})
				return
			}

			// Success - parse AI response
			const parsedData = JSON.parse(
				tailorFetcher.data.choices[0].message.content ?? '{}',
			) as Jsonify<ResumeData>

			// Create diff summary if we have a pre-tailored resume
			if (preTailoredResume && formData.job) {
				const jobKeywords = formData.job.content
					? extractJobKeywords(formData.job.content)
					: []
				const summary = createDiffSummary(
					preTailoredResume,
					parsedData as any,
					jobKeywords,
				)
				setDiffSummary(summary)

				// During onboarding, skip the diff modal and just show toast
				if (onboarding.skipDiffModal) {
					onboarding.handleTailorComplete()
					setPreTailoredResume(null) // Clear undo state
				} else {
					setShowDiffModal(true)
				}
			}

			setFormData(prevFormData => {
				const newFormData = {
					...prevFormData,
					...parsedData,
					// keep the old experiences except for the descriptions & new ids
					experiences: parsedData.experiences?.map(exp => {
						const currentExp = prevFormData.experiences?.find(
							e => e.id === exp.id,
						)
						if (!currentExp) {
							return exp
						}
						return {
							...currentExp,
							descriptions: exp.descriptions,
						}
					}),
				}
				debouncedSave(newFormData)
				return newFormData
			})
			rerenderRef.current = true
		}
	}, [
		tailorFetcher.data,
		tailorFetcher.state,
		setFormData,
		debouncedSave,
		preTailoredResume,
		formData.job,
		onboarding,
	])

	// Track successful downloads for onboarding
	useEffect(() => {
		if (
			pdfFetcher.data &&
			pdfFetcher.state === 'idle' &&
			!onboarding.isComplete
		) {
			// Track download during onboarding
			trackLegacyEvent('onboarding_download_clicked', {
				userId,
				resumeId: formData.id,
				category: 'Onboarding',
			})
		}
	}, [
		pdfFetcher.data,
		pdfFetcher.state,
		onboarding.isComplete,
		userId,
		formData.id,
	])

	// Track when bullet AI spotlight is shown
	useEffect(() => {
		if (onboarding.stage === 'needs_bullet_tailor') {
			trackLegacyEvent('onboarding_bullet_ai_spotlight_shown', {
				userId,
				resumeId: formData.id,
				hasJob: !!selectedJob,
				category: 'Onboarding',
			})
		}
	}, [onboarding, userId, formData.id, selectedJob])

	// Inside ResumeBuilder component, add state for font
	// Default to Crimson Pro for professional look
	const [selectedFont, setSelectedFont] = useState(
		formData.font ?? 'font-crimson',
	)

	// Text size presets - based on professional resume specifications
	// Small: exact specs from user (22pt name, 10pt body, 12pt company/degree)
	const TEXT_SIZE_PRESETS = {
		small: {
			'--resume-name-size': '22pt',
			'--resume-contact-size': '10pt',
			'--resume-summary-size': '10pt',
			'--resume-section-header-size': '10pt',
			'--resume-company-size': '12pt',
			'--resume-dates-size': '10pt',
			'--resume-job-title-size': '10pt',
			'--resume-body-size': '10pt',
			'--resume-degree-size': '12pt',
			'--resume-school-size': '10pt',
			'--resume-skill-label-size': '10pt',
			'--resume-skill-size': '10pt',
		},
		medium: {
			'--resume-name-size': '26pt',
			'--resume-contact-size': '11pt',
			'--resume-summary-size': '11pt',
			'--resume-section-header-size': '11pt',
			'--resume-company-size': '13pt',
			'--resume-dates-size': '11pt',
			'--resume-job-title-size': '11pt',
			'--resume-body-size': '11pt',
			'--resume-degree-size': '13pt',
			'--resume-school-size': '11pt',
			'--resume-skill-label-size': '11pt',
			'--resume-skill-size': '11pt',
		},
		large: {
			'--resume-name-size': '30pt',
			'--resume-contact-size': '12pt',
			'--resume-summary-size': '12pt',
			'--resume-section-header-size': '12pt',
			'--resume-company-size': '14pt',
			'--resume-dates-size': '12pt',
			'--resume-job-title-size': '12pt',
			'--resume-body-size': '12pt',
			'--resume-degree-size': '14pt',
			'--resume-school-size': '12pt',
			'--resume-skill-label-size': '12pt',
			'--resume-skill-size': '12pt',
		},
	}

	// Always use compact spacing for professional single-page look
	const COMPACT_SPACING = {
		'--resume-line-height': '1.2',
		'--resume-bullet-line-height': '1.2',
		'--resume-section-gap': '14pt',
		'--resume-company-title-gap': '5pt',
		'--resume-title-bullet-gap': '4pt',
		'--resume-item-gap': '2pt',
		'--resume-bullet-gap': '2pt',
	}
	// Default to medium text with compact spacing for professional single-page look
	const [textSize, setTextSize] = useState<string>(
		(savedData.textSize) || 'medium',
	)

	// State to dismiss warning banner
	const [warningDismissed, setWarningDismissed] = useState(false)

	// Get CSS variables combining text size with compact spacing
	const getResumeStyles = () => {
		return {
			...TEXT_SIZE_PRESETS[textSize as keyof typeof TEXT_SIZE_PRESETS],
			...COMPACT_SPACING,
		} as React.CSSProperties
	}

	// Add font change handler
	const handleFontChange = (newFont: string) => {
		setSelectedFont(newFont)
		const newFormData = {
			...formData,
			font: newFont,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	// Add layout state - default to traditional for professional single-column look
	const [selectedLayout, setSelectedLayout] = useState(
		formData.layout ?? 'traditional',
	)

	// Page frame state for overflow detection and scaling
	const [pageScale, setPageScale] = useState(1)
	const [contentOverflows, setContentOverflows] = useState(false)
	const [pageCount, setPageCount] = useState(1)
	const pageFrameContainerRef = useRef<HTMLDivElement>(null)
	const resumeContentRef = useRef<HTMLDivElement>(null)

	// Page dimensions at 96dpi (Letter: 8.5" x 11")
	const PAGE_WIDTH = 816 // 8.5 inches * 96dpi
	const CONTENT_HEIGHT = 960 // 10 inches (11" - 1" total margins) * 96dpi

	// Add layout change handler
	const handleLayoutChange = (newLayout: string) => {
		setSelectedLayout(newLayout)
		const newFormData = {
			...formData,
			layout: newLayout,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
		rerenderRef.current = true
	}

	const handleTextSizeChange = (newTextSize: string) => {
		setTextSize(newTextSize)
		const newFormData = {
			...formData,
			textSize: newTextSize,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	// ResizeObserver for page frame scaling and overflow detection
	useEffect(() => {
		const container = pageFrameContainerRef.current
		const content = resumeContentRef.current
		if (!container || !content) return

		const updatePageFrame = () => {
			// Calculate scale to fit container width (max 1.0)
			const containerWidth = container.clientWidth
			const newScale = Math.min(1, containerWidth / PAGE_WIDTH)
			setPageScale(newScale)

			// Get actual content height (subtract padding: p-12 = 48px top + 48px bottom = 96px)
			const contentScrollHeight = content.scrollHeight
			const actualContentHeight = Math.max(0, contentScrollHeight - 96)

			// Check for content overflow (content exceeds 1 page)
			const hasOverflow = actualContentHeight > CONTENT_HEIGHT
			setContentOverflows(hasOverflow)

			// Calculate page count based on actual content
			const pages = Math.ceil(actualContentHeight / CONTENT_HEIGHT)
			setPageCount(Math.max(1, pages))
		}

		// Initial calculation
		updatePageFrame()

		// Observe container for resize
		const containerObserver = new ResizeObserver(updatePageFrame)
		containerObserver.observe(container)

		// Observe content for changes
		const contentObserver = new ResizeObserver(updatePageFrame)
		contentObserver.observe(content)

		return () => {
			containerObserver.disconnect()
			contentObserver.disconnect()
		}
	}, [PAGE_WIDTH, CONTENT_HEIGHT, formData, selectedLayout])

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
							cancelUrl={`/builder`}
						/>

						<AIAssistantModal
							isOpen={showAIModal}
							onClose={() => {
								setShowAIModal(false)
								onboarding.handleAIModalClose()
							}}
							onUpdate={handleBulletUpdate}
							onMultipleUpdate={handleMultipleBulletUpdate}
							content={selectedBullet?.content}
							experience={selectedExperience}
							job={selectedJob}
							resumeData={formData}
							subscription={subscription}
							gettingStartedProgress={gettingStartedProgress}
							setShowSubscribeModal={setShowSubscribeModal}
							onTailorClick={onboarding.handleTailorComplete}
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
									isActiveStep={
										(gettingStartedProgress?.downloadCount ?? 0) === 0 &&
										!!(formData.name || formData.role) &&
										!selectedJob
									}
								/>
								{selectedJob ? (
									<div id="tailor-button">
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger>
													<StatusButton
														type="button"
														onClick={
															preTailoredResume
																? handleUndoTailor
																: handleTailorEntireResume
														}
														className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-200"
														status={
															tailorFetcher.state === 'submitting'
																? 'pending'
																: 'idle'
														}
													>
														{preTailoredResume &&
														tailorFetcher.state === 'idle' &&
														tailorFetcher.data ? (
															<>
																<ArrowUturnLeftIcon className="h-5 w-5" />
																Undo
															</>
														) : (
															<>
																<RainbowSparklesIcon className="h-5 w-5" />
																Tailor to Job
															</>
														)}
													</StatusButton>
												</TooltipTrigger>
												<TooltipContent>
													{preTailoredResume &&
													tailorFetcher.state === 'idle' &&
													tailorFetcher.data
														? 'Undo tailoring'
														: 'Tailor entire resume (~1-2 min)'}
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
								) : null}
							</div>
							<div className="flex items-center gap-2">
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
								<LayoutSelector
									selectedLayout={selectedLayout}
									onLayoutChange={handleLayoutChange}
								/>
								<FontSelector
									selectedFont={selectedFont}
									onFontChange={handleFontChange}
								/>
								<TextSizeSelector
									selectedTextSize={textSize}
									onTextSizeChange={handleTextSizeChange}
								/>

								<SectionVisibilityMenu
									sections={[
										{
											id: 'about',
											label: 'About Me',
											visible: formData.visibleSections?.about ?? true,
										},
										{
											id: 'experience',
											label: 'Experience',
											visible: formData.visibleSections?.experience ?? true,
										},
										{
											id: 'education',
											label: 'Education',
											visible: formData.visibleSections?.education ?? true,
										},
										{
											id: 'skills',
											label: 'Skills',
											visible: formData.visibleSections?.skills ?? true,
										},
										{
											id: 'hobbies',
											label: 'Interests',
											visible: formData.visibleSections?.hobbies ?? true,
										},
										{
											id: 'personalDetails',
											label: 'Personal Details',
											visible:
												formData.visibleSections?.personalDetails ?? true,
										},
										{
											id: 'photo',
											label: 'Photo',
											visible: formData.visibleSections?.photo ?? true,
										},
									]}
									onToggleSection={handleToggleSection}
								/>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger>
											<Button
												onClick={handleReset}
												className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-200"
											>
												<Icon size="md" name="plus" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>Create a new resume</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<div id="download-button">
									<StatusButton
										type="button"
										onClick={handleClickDownloadPDF}
										className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
										status={
											pdfFetcher.state === 'submitting'
												? 'pending'
												: pdfFetcher.state === 'idle' && pdfFetcher.data
												? 'success'
												: 'idle'
										}
									>
										<ArrowDownTrayIcon className="h-4 w-4" />
										Download Resume
									</StatusButton>
								</div>
							</div>
						</div>

						{/* Error Handling UI */}
						{errorState && (
							<div className="mb-4 rounded-r-lg border-l-4 border-red-500 bg-red-50 p-4">
								<div className="flex items-start">
									<ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-red-500" />
									<div className="ml-3 flex-1">
										<p className="text-sm text-red-800">{errorState.message}</p>
										<div className="mt-3 flex gap-2">
											{errorState.retryable && (
												<Button
													onClick={() => {
														setErrorState(null)
														handleTailorEntireResume()
													}}
													size="sm"
												>
													Retry
												</Button>
											)}
											{errorState.suggestion === 'use_bullet_tailoring' && (
												<Button
													onClick={() => {
														setErrorState(null)
														setShowAIModal(true)
													}}
													size="sm"
													variant="outline"
												>
													Try Bullet Tailoring Instead
												</Button>
											)}
											<Button
												onClick={() => setErrorState(null)}
												size="sm"
												variant="ghost"
											>
												Dismiss
											</Button>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Main content area with resume editor and gamification sidebar */}
						<div className="flex gap-6">
							{/* Left: Resume Editor */}
							<div className="flex-1">
								<Form key={formData.id} method="post">
									{/* Hidden inputs to store the actual form data */}
									{Object.entries(formData)
										.filter(([key]) => key !== 'experiences')
										.map(([key, value]) => (
											<input
												key={key}
												type="hidden"
												name={key}
												value={
													value === null || value === undefined
														? ''
														: typeof value === 'object'
														? JSON.stringify(value)
														: String(value)
												}
											/>
										))}
									<input
										type="hidden"
										name="experiences"
										value={JSON.stringify(formData.experiences)}
									/>

									{/* Page Frame Container - scales to fit viewport */}
									<div ref={pageFrameContainerRef} className="relative w-full">
										{/* Overflow Warning Badge */}
										{contentOverflows && !warningDismissed && (
											<div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 transform">
												<div className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
													<ExclamationTriangleIcon className="h-4 w-4" />
													<span>
														Content exceeds 1 page - {pageCount} pages
													</span>
													<button
														type="button"
														onClick={() => setWarningDismissed(true)}
														className="ml-1 rounded-full p-0.5 hover:bg-amber-600"
														title="Dismiss"
													>
														<XMarkIcon className="h-4 w-4" />
													</button>
												</div>
											</div>
										)}

										{/* Scaled Page Frame - infinite canvas that grows with content */}
										<div
											className="mx-auto origin-top"
											style={{
												width: PAGE_WIDTH,
												transform: `scale(${pageScale})`,
												transformOrigin: 'top center',
											}}
										>
											{/* Resume Paper - grows to fit all content */}
											<div
												ref={resumeContentRef}
												id="resume-content"
												className={`relative w-full bg-white p-12 shadow-[0_4px_20px_rgba(0,0,0,0.15)] ${
													isModalDisplaying ? 'scale-90' : ''
												} ${selectedFont}`}
												style={{
													boxShadow:
														'0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
													minHeight: CONTENT_HEIGHT + 96, // Minimum 1 page height with padding
													...getResumeStyles(),
												}}
											>
												{/* Page boundary markers - only show when content exceeds 1 page */}
												{pageCount > 1 &&
													Array.from({ length: pageCount - 1 }).map((_, i) => (
														<div
															key={i}
															className="preview-only pointer-events-none absolute left-0 right-0 z-20"
															style={{
																top: `${(i + 1) * CONTENT_HEIGHT + 48}px`, // 48px = p-12 padding
																marginLeft: '-48px',
																marginRight: '-48px',
																width: 'calc(100% + 96px)',
															}}
														>
															<div className="relative flex items-center">
																<div className="flex-1 border-t border-dashed border-gray-300" />
																<span className="bg-white px-3 text-[10px] text-gray-400">
																	Page {i + 1} | Page {i + 2}
																</span>
																<div className="flex-1 border-t border-dashed border-gray-300" />
															</div>
														</div>
													))}
												{selectedLayout === 'modern' ? (
													<div className="grid grid-cols-[250px_1fr] gap-4">
														{/* Left Pane */}
														<div
															className="pr-4"
															style={{
																display: 'flex',
																flexDirection: 'column',
																gap: 'var(--resume-section-gap)',
															}}
														>
															{/* Image Upload */}
															{formData.visibleSections?.photo && (
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
															{formData.visibleSections?.about && (
																<div className="rounded border-dashed border-gray-400 hover:border">
																	<EditableContent
																		content={formData.headers?.aboutHeader}
																		onInput={e =>
																			handleHeaderEdit(
																				e.currentTarget.innerText,
																				'aboutHeader',
																			)
																		}
																		className="resume-section-header text-gray-700"
																		placeholder="About Me"
																		rerenderRef={rerenderRef}
																	/>
																	<EditableContent
																		multiline
																		content={formData.about}
																		onInput={e =>
																			handleAboutEdit(
																				e.currentTarget.innerText,
																				'about',
																			)
																		}
																		className="resume-body min-h-[150px] p-3 text-gray-600"
																		placeholder="Write a brief introduction about yourself..."
																		rerenderRef={rerenderRef}
																	/>
																</div>
															)}

															{/* Personal Details */}
															{formData.visibleSections?.personalDetails && (
																<div>
																	<EditableContent
																		content={formData.headers?.detailsHeader}
																		onInput={e =>
																			handleHeaderEdit(
																				e.currentTarget.innerText,
																				'detailsHeader',
																			)
																		}
																		className="resume-section-header text-gray-700"
																		placeholder="Personal Details"
																		rerenderRef={rerenderRef}
																	/>
																	<div className="space-y-1">
																		<div className="flex items-center gap-2">
																			<MapPinIcon className="h-4 w-4 text-gray-400" />
																			<EditableContent
																				content={formData.location}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'location',
																					)
																				}
																				className="resume-body flex-1 rounded p-1 text-gray-600 outline-none transition"
																				placeholder="Location"
																				rerenderRef={rerenderRef}
																			/>
																		</div>
																		<div className="flex items-center gap-2">
																			<EnvelopeIcon className="h-4 w-4 text-gray-400" />
																			<EditableContent
																				content={formData.email}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'email',
																					)
																				}
																				className="resume-body flex-1 rounded p-1 text-gray-600 outline-none transition"
																				placeholder="Email"
																				rerenderRef={rerenderRef}
																			/>
																		</div>
																		<div className="flex items-center gap-2">
																			<PhoneIcon className="h-4 w-4 text-gray-400" />
																			<EditableContent
																				content={formData.phone}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'phone',
																					)
																				}
																				className="resume-body flex-1 rounded p-1 text-gray-600 outline-none transition"
																				placeholder="Phone"
																				rerenderRef={rerenderRef}
																			/>
																		</div>
																		<div className="flex items-center gap-2">
																			<LinkIcon className="h-4 w-4 text-gray-400" />
																			<EditableContent
																				content={formData.website}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'website',
																					)
																				}
																				className="resume-body flex-1 rounded p-1 text-gray-600 outline-none transition"
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
																	handleFieldEdit(
																		e.currentTarget.innerText,
																		'name',
																	)
																}
																className="resume-name mb-1 rounded p-1 outline-none transition"
																placeholder="Your Name"
																rerenderRef={rerenderRef}
																style={{ color: nameColor }}
															/>

															<EditableContent
																content={formData.role}
																onInput={e =>
																	handleFieldEdit(
																		e.currentTarget.innerText,
																		'role',
																	)
																}
																className="resume-role mb-2 rounded p-1 text-gray-600 outline-none transition"
																placeholder="Your Role (e.g. Frontend Developer)"
																rerenderRef={rerenderRef}
															/>

															<div className="resume-section-gap">
																{formData.visibleSections?.experience && (
																	<EditableContent
																		content={formData.headers?.experienceHeader}
																		onInput={e =>
																			handleHeaderEdit(
																				e.currentTarget.innerText,
																				'experienceHeader',
																			)
																		}
																		className="resume-section-header text-gray-700 outline-none"
																		placeholder="Professional Experience"
																	/>
																)}

																<div className="space-y-2">
																	{formData.visibleSections?.experience &&
																	formData.experiences ? (
																		<SortableContext
																			items={formData.experiences.map(
																				exp => exp.id!,
																			)}
																			strategy={verticalListSortingStrategy}
																		>
																			{formData.experiences?.map(
																				(exp, expIndex) => (
																					<SortableExperience
																						key={exp.id}
																						experience={exp}
																						onExperienceEdit={
																							handleExperienceEdit
																						}
																						onRemoveExperience={
																							removeExperience
																						}
																						onAddExperience={addExperience}
																						onAIClick={handleAIClick}
																						onAddBullet={addBulletPoint}
																						onRemoveBullet={removeBulletPoint}
																						onBulletEdit={handleBulletPointEdit}
																						rerenderRef={rerenderRef}
																						experienceIndex={expIndex}
																					/>
																				),
																			)}
																		</SortableContext>
																	) : null}
																</div>
															</div>

															<div className="resume-section-gap">
																{formData.visibleSections?.education && (
																	<EditableContent
																		content={formData.headers?.educationHeader}
																		onInput={e =>
																			handleHeaderEdit(
																				e.currentTarget.innerText,
																				'educationHeader',
																			)
																		}
																		className="resume-section-header text-gray-700 outline-none"
																		placeholder="Education"
																	/>
																)}
																<div className="space-y-2">
																	{formData.visibleSections?.education &&
																	formData.education?.length === 0 ? (
																		<>
																			<div className="rounded border border-dashed border-gray-300 p-4 text-center text-gray-500">
																				Click "Add Education" to add your
																				educational background
																			</div>
																			<Button onClick={() => addEducation()}>
																				Add Education
																			</Button>
																		</>
																	) : formData.visibleSections?.education &&
																	  formData.education ? (
																		<SortableContext
																			items={
																				formData.education.map(edu => edu.id!)!
																			}
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

															<div className="resume-section-gap">
																{formData.visibleSections?.skills && (
																	<>
																		<EditableContent
																			content={formData.headers?.skillsHeader}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'skillsHeader',
																				)
																			}
																			className="resume-section-header text-gray-700 outline-none"
																			placeholder="Skills & Expertise"
																		/>

																		<div>
																			{formData.skills?.map(skill => (
																				<div
																					key={skill.id}
																					className="group relative"
																					style={{
																						marginTop:
																							'var(--resume-bullet-gap)',
																					}}
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
																						className="resume-body text-gray-700 outline-none"
																						placeholder="Category: Skill1, Skill2, Skill3"
																						id={`skill-${skill.id}`}
																					/>
																					<div className="preview-only absolute -right-4 top-0 hidden gap-1 group-hover:flex">
																						<button
																							type="button"
																							onClick={() =>
																								removeSkill(skill.id!)
																							}
																							className="text-gray-400 hover:text-gray-600"
																						>
																							<TrashIcon className="h-3 w-3" />
																						</button>
																						<button
																							type="button"
																							onClick={() => addSkill()}
																							className="text-gray-400 hover:text-gray-600"
																						>
																							<PlusIcon className="h-3 w-3" />
																						</button>
																					</div>
																				</div>
																			))}
																		</div>
																	</>
																)}
															</div>

															<div className="resume-section-gap">
																{formData.visibleSections?.hobbies && (
																	<>
																		<EditableContent
																			content={formData.headers?.hobbiesHeader}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'hobbiesHeader',
																				)
																			}
																			className="resume-section-header text-gray-700 outline-none"
																			placeholder="Interests & Activities"
																			rerenderRef={rerenderRef}
																		/>
																		<div>
																			{formData.hobbies?.map((hobby, index) => (
																				<span
																					key={hobby.id}
																					className="group relative inline"
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
																						className="resume-body inline text-gray-700"
																						placeholder="Interest"
																						id={`hobby-${hobby.id}`}
																					/>
																					{index <
																						(formData.hobbies?.length ?? 0) -
																							1 && (
																						<span className="resume-body text-gray-700">
																							,{' '}
																						</span>
																					)}
																					<span className="preview-only hidden gap-1 group-hover:inline-flex">
																						<button
																							type="button"
																							onClick={() =>
																								removeHobby(hobby.id!)
																							}
																							className="ml-1 text-gray-400 hover:text-gray-600"
																						>
																							<TrashIcon className="h-3 w-3" />
																						</button>
																						<button
																							type="button"
																							onClick={() => addHobby()}
																							className="text-gray-400 hover:text-gray-600"
																						>
																							<PlusIcon className="h-3 w-3" />
																						</button>
																					</span>
																				</span>
																			))}
																		</div>
																	</>
																)}
															</div>
														</div>
													</div>
												) : selectedLayout === 'professional' ? (
													<div
														style={{
															display: 'flex',
															flexDirection: 'column',
															gap: 'var(--resume-section-gap)',
														}}
													>
														{/* Header */}
														<div className="border-b border-gray-200 pb-1">
															<div className="text-center">
																<EditableContent
																	content={formData.name}
																	onInput={e =>
																		handleFieldEdit(
																			e.currentTarget.innerText,
																			'name',
																		)
																	}
																	className="resume-name mb-1"
																	style={{ color: nameColor }}
																	placeholder="Your Name"
																	rerenderRef={rerenderRef}
																/>
																<EditableContent
																	content={formData.role}
																	onInput={e =>
																		handleFieldEdit(
																			e.currentTarget.innerText,
																			'role',
																		)
																	}
																	className="resume-role text-gray-600"
																	placeholder="Your Role"
																	rerenderRef={rerenderRef}
																/>
															</div>
															{formData.visibleSections?.personalDetails && (
																<div className="resume-dates mt-1 flex justify-center gap-2 text-gray-600">
																	{formData.email && (
																		<div className="flex items-center gap-0.5">
																			<EnvelopeIcon className="h-3 w-3" />
																			<EditableContent
																				content={formData.email}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'email',
																					)
																				}
																				className="outline-none"
																				placeholder="Email"
																				rerenderRef={rerenderRef}
																			/>
																		</div>
																	)}
																	{formData.phone && (
																		<div className="flex items-center gap-0.5">
																			<PhoneIcon className="h-3 w-3" />
																			<EditableContent
																				content={formData.phone}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'phone',
																					)
																				}
																				className="outline-none"
																				placeholder="Phone"
																				rerenderRef={rerenderRef}
																			/>
																		</div>
																	)}
																	{formData.location && (
																		<div className="flex items-center gap-0.5">
																			<MapPinIcon className="h-3 w-3" />
																			<EditableContent
																				content={formData.location}
																				onInput={e =>
																					handleFieldEdit(
																						e.currentTarget.innerText,
																						'location',
																					)
																				}
																				className="outline-none"
																				placeholder="Location"
																				rerenderRef={rerenderRef}
																			/>
																		</div>
																	)}
																</div>
															)}
														</div>

														{/* Two-column content */}
														<div className="grid grid-cols-2 gap-4">
															{/* Left column */}
															<div
																style={{
																	display: 'flex',
																	flexDirection: 'column',
																	gap: 'var(--resume-section-gap)',
																}}
															>
																{formData.visibleSections?.experience && (
																	<div>
																		<EditableContent
																			content={
																				formData.headers?.experienceHeader
																			}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'experienceHeader',
																				)
																			}
																			className="resume-section-header text-gray-700"
																			placeholder="Professional Experience"
																		/>
																		<div className="space-y-2">
																			<SortableContext
																				items={
																					formData.experiences?.map(
																						exp => exp.id!,
																					) ?? []
																				}
																				strategy={verticalListSortingStrategy}
																			>
																				{formData.experiences?.map(
																					(exp, expIndex) => (
																						<SortableExperience
																							key={exp.id}
																							experience={exp}
																							onExperienceEdit={
																								handleExperienceEdit
																							}
																							onRemoveExperience={
																								removeExperience
																							}
																							onAddExperience={addExperience}
																							onAIClick={handleAIClick}
																							onAddBullet={addBulletPoint}
																							onRemoveBullet={removeBulletPoint}
																							onBulletEdit={
																								handleBulletPointEdit
																							}
																							rerenderRef={rerenderRef}
																							experienceIndex={expIndex}
																						/>
																					),
																				)}
																			</SortableContext>
																		</div>
																	</div>
																)}

																{formData.visibleSections?.education && (
																	<div>
																		<EditableContent
																			content={
																				formData.headers?.educationHeader
																			}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'educationHeader',
																				)
																			}
																			className="resume-section-header text-gray-700"
																			placeholder="Education"
																		/>
																		<div className="space-y-2">
																			<SortableContext
																				items={
																					formData.education?.map(
																						edu => edu.id!,
																					) ?? []
																				}
																				strategy={verticalListSortingStrategy}
																			>
																				{formData.education?.map(edu => (
																					<SortableEducation
																						key={edu.id}
																						education={edu}
																						onEducationEdit={
																							handleEducationEdit
																						}
																						onRemoveEducation={removeEducation}
																						onAddEducation={addEducation}
																					/>
																				))}
																			</SortableContext>
																		</div>
																	</div>
																)}
															</div>

															{/* Right column */}
															<div
																style={{
																	display: 'flex',
																	flexDirection: 'column',
																	gap: 'var(--resume-section-gap)',
																}}
															>
																{formData.visibleSections?.about && (
																	<div>
																		<EditableContent
																			content={formData.headers?.aboutHeader}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'aboutHeader',
																				)
																			}
																			className="resume-section-header text-gray-700"
																			placeholder="About Me"
																		/>
																		<EditableContent
																			content={formData.about}
																			onInput={e =>
																				handleFieldEdit(
																					e.currentTarget.innerText,
																					'about',
																				)
																			}
																			className="resume-body whitespace-pre-wrap text-gray-600"
																			placeholder="Write a brief summary about yourself..."
																			rerenderRef={rerenderRef}
																		/>
																	</div>
																)}

																{formData.visibleSections?.skills && (
																	<div>
																		<EditableContent
																			content={formData.headers?.skillsHeader}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'skillsHeader',
																				)
																			}
																			className="resume-section-header text-gray-700"
																			placeholder="Skills & Expertise"
																		/>
																		<div>
																			{formData.skills?.map(skill => (
																				<div
																					key={skill.id}
																					className="group relative"
																					style={{
																						marginTop:
																							'var(--resume-bullet-gap)',
																					}}
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
																						className="resume-body text-gray-700"
																						placeholder="Category: Skill1, Skill2, Skill3"
																						id={`skill-${skill.id}`}
																					/>
																					<div className="preview-only absolute -right-4 top-0 hidden gap-1 group-hover:flex">
																						<button
																							type="button"
																							onClick={() =>
																								removeSkill(skill.id!)
																							}
																							className="text-gray-400 hover:text-gray-600"
																						>
																							<TrashIcon className="h-3 w-3" />
																						</button>
																						<button
																							type="button"
																							onClick={() => addSkill()}
																							className="text-gray-400 hover:text-gray-600"
																						>
																							<PlusIcon className="h-3 w-3" />
																						</button>
																					</div>
																				</div>
																			))}
																		</div>
																	</div>
																)}

																{formData.visibleSections?.hobbies && (
																	<div>
																		<EditableContent
																			content={formData.headers?.hobbiesHeader}
																			onInput={e =>
																				handleHeaderEdit(
																					e.currentTarget.innerText,
																					'hobbiesHeader',
																				)
																			}
																			className="resume-section-header text-gray-700"
																			placeholder="Interests & Activities"
																		/>
																		<div>
																			{formData.hobbies?.map((hobby, index) => (
																				<span
																					key={hobby.id}
																					className="group relative inline"
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
																						className="resume-body inline text-gray-700"
																						placeholder="Interest"
																						id={`hobby-${hobby.id}`}
																					/>
																					{index <
																						(formData.hobbies?.length ?? 0) -
																							1 && (
																						<span className="resume-body text-gray-700">
																							,{' '}
																						</span>
																					)}
																					<span className="preview-only hidden gap-1 group-hover:inline-flex">
																						<button
																							type="button"
																							onClick={() =>
																								removeHobby(hobby.id!)
																							}
																							className="ml-1 text-gray-400 hover:text-gray-600"
																						>
																							<TrashIcon className="h-3 w-3" />
																						</button>
																						<button
																							type="button"
																							onClick={() => addHobby()}
																							className="text-gray-400 hover:text-gray-600"
																						>
																							<PlusIcon className="h-3 w-3" />
																						</button>
																					</span>
																				</span>
																			))}
																		</div>
																	</div>
																)}
															</div>
														</div>
													</div>
												) : (
													// Traditional layout - Classic single-column
													<div
														style={{
															display: 'flex',
															flexDirection: 'column',
															gap: 'var(--resume-section-gap)',
														}}
													>
														{/* Header */}
														<div className="pb-2">
															<EditableContent
																content={formData.name}
																onInput={e =>
																	handleFieldEdit(
																		e.currentTarget.innerText,
																		'name',
																	)
																}
																className="resume-name text-center"
																style={{ color: nameColor }}
																placeholder="Your Name"
																rerenderRef={rerenderRef}
															/>
															{formData.visibleSections?.personalDetails && (
																<div className="resume-body mt-1 flex flex-row justify-center text-center text-gray-600">
																	{[
																		<EditableContent
																			key="email"
																			content={formData.email}
																			onInput={e =>
																				handleFieldEdit(
																					e.currentTarget.innerText,
																					'email',
																				)
																			}
																			className="inline text-gray-600"
																			placeholder="Email"
																			rerenderRef={rerenderRef}
																		/>,
																		<EditableContent
																			key="phone"
																			content={formData.phone}
																			onInput={e =>
																				handleFieldEdit(
																					e.currentTarget.innerText,
																					'phone',
																				)
																			}
																			className="inline text-gray-600"
																			placeholder="Phone"
																			rerenderRef={rerenderRef}
																		/>,
																		<EditableContent
																			key="location"
																			content={formData.location}
																			onInput={e =>
																				handleFieldEdit(
																					e.currentTarget.innerText,
																					'location',
																				)
																			}
																			className="inline text-gray-600"
																			placeholder="Location"
																			rerenderRef={rerenderRef}
																		/>,
																		<EditableContent
																			key="website"
																			content={formData.website}
																			onInput={e =>
																				handleFieldEdit(
																					e.currentTarget.innerText,
																					'website',
																				)
																			}
																			className="inline text-gray-600"
																			placeholder="Website"
																			rerenderRef={rerenderRef}
																		/>,
																	]
																		.filter(Boolean)
																		.reduce((prev, curr, i) => (
																			<>
																				{prev}
																				{i !== 0 && (
																					<span className="mx-2 text-gray-400">
																						•
																					</span>
																				)}
																				{curr}
																			</>
																		))}
																</div>
															)}
														</div>

														{/* About/Summary - no header, just the summary text */}
														{formData.visibleSections?.about && (
															<div>
																<EditableContent
																	content={formData.about}
																	onInput={e =>
																		handleFieldEdit(
																			e.currentTarget.innerText,
																			'about',
																		)
																	}
																	className="resume-body whitespace-pre-wrap text-gray-600"
																	placeholder="Write a brief summary about yourself..."
																	rerenderRef={rerenderRef}
																/>
															</div>
														)}

														{/* Experience */}
														{formData.visibleSections?.experience && (
															<div>
																<EditableContent
																	content={formData.headers?.experienceHeader}
																	onInput={e =>
																		handleHeaderEdit(
																			e.currentTarget.innerText,
																			'experienceHeader',
																		)
																	}
																	className="resume-section-header uppercase tracking-wider"
																	style={{ color: nameColor }}
																	placeholder="Work Experience"
																	rerenderRef={rerenderRef}
																/>
																<div className="space-y-1.5">
																	<SortableContext
																		items={
																			formData.experiences?.map(
																				exp => exp.id!,
																			) ?? []
																		}
																		strategy={verticalListSortingStrategy}
																	>
																		{formData.experiences?.map(
																			(exp, expIndex) => (
																				<SortableExperience
																					key={exp.id}
																					experience={exp}
																					onExperienceEdit={
																						handleExperienceEdit
																					}
																					onRemoveExperience={removeExperience}
																					onAddExperience={addExperience}
																					onAIClick={handleAIClick}
																					onAddBullet={addBulletPoint}
																					onRemoveBullet={removeBulletPoint}
																					onBulletEdit={handleBulletPointEdit}
																					rerenderRef={rerenderRef}
																					experienceIndex={expIndex}
																				/>
																			),
																		)}
																	</SortableContext>
																</div>
															</div>
														)}

														{/* Education */}
														{formData.visibleSections?.education && (
															<div>
																<EditableContent
																	content={formData.headers?.educationHeader}
																	onInput={e =>
																		handleHeaderEdit(
																			e.currentTarget.innerText,
																			'educationHeader',
																		)
																	}
																	className="resume-section-header uppercase tracking-wider"
																	style={{ color: nameColor }}
																	placeholder="Education"
																	rerenderRef={rerenderRef}
																/>
																<div className="space-y-1.5">
																	<SortableContext
																		items={
																			formData.education?.map(edu => edu.id!) ??
																			[]
																		}
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
																</div>
															</div>
														)}

														{/* Skills - bullet point format with category labels */}
														{formData.visibleSections?.skills && (
															<div>
																<EditableContent
																	content={formData.headers?.skillsHeader}
																	onInput={e =>
																		handleHeaderEdit(
																			e.currentTarget.innerText,
																			'skillsHeader',
																		)
																	}
																	className="resume-section-header uppercase tracking-wider"
																	style={{ color: nameColor }}
																	placeholder="Skills"
																	rerenderRef={rerenderRef}
																/>
																<div>
																	{formData.skills?.map(skill => (
																		<div
																			key={skill.id}
																			className="group relative"
																			style={{
																				marginTop: 'var(--resume-bullet-gap)',
																			}}
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
																				className="resume-body text-gray-700"
																				placeholder="Category: Skill1, Skill2, Skill3"
																				id={`skill-${skill.id}`}
																			/>
																			<div className="preview-only absolute -right-4 top-0 hidden gap-1 group-hover:flex">
																				<button
																					type="button"
																					onClick={() => removeSkill(skill.id!)}
																					className="text-gray-400 hover:text-gray-600"
																				>
																					<TrashIcon className="h-3 w-3" />
																				</button>
																				<button
																					type="button"
																					onClick={() => addSkill()}
																					className="text-gray-400 hover:text-gray-600"
																				>
																					<PlusIcon className="h-3 w-3" />
																				</button>
																			</div>
																		</div>
																	))}
																</div>
															</div>
														)}

														{/* Interests */}
														{formData.visibleSections?.hobbies && (
															<div>
																<EditableContent
																	content={formData.headers?.hobbiesHeader}
																	onInput={e =>
																		handleHeaderEdit(
																			e.currentTarget.innerText,
																			'hobbiesHeader',
																		)
																	}
																	className="resume-section-header uppercase tracking-wider"
																	style={{ color: nameColor }}
																	placeholder="Interests"
																	rerenderRef={rerenderRef}
																/>
																<div>
																	{formData.hobbies?.map((hobby, index) => (
																		<span
																			key={hobby.id}
																			className="group relative inline"
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
																				className="resume-body inline text-gray-700"
																				placeholder="Interest"
																				id={`hobby-${hobby.id}`}
																			/>
																			{index <
																				(formData.hobbies?.length ?? 0) - 1 && (
																				<span className="resume-body text-gray-700">
																					,{' '}
																				</span>
																			)}
																			<span className="preview-only hidden gap-1 group-hover:inline-flex">
																				<button
																					type="button"
																					onClick={() => removeHobby(hobby.id!)}
																					className="ml-1 text-gray-400 hover:text-gray-600"
																				>
																					<TrashIcon className="h-3 w-3" />
																				</button>
																				<button
																					type="button"
																					onClick={() => addHobby()}
																					className="text-gray-400 hover:text-gray-600"
																				>
																					<PlusIcon className="h-3 w-3" />
																				</button>
																			</span>
																		</span>
																	))}
																</div>
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								</Form>
							</div>

							{/* Right: Gamification Sidebar */}
							<div className="sticky top-4 w-80 flex-shrink-0 space-y-4 self-start">
								<ResumeScoreCard
									scores={scores}
									previousScore={previousScore}
									hasJobDescription={
										!!(
											formData.job?.content &&
											formData.job.content.trim().length > 0
										)
									}
								/>
								<ImprovementChecklist items={checklist} />
							</div>
						</div>
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
			/>
			{diffSummary && (
				<TailorDiffModal
					isOpen={showDiffModal}
					onClose={() => setShowDiffModal(false)}
					onKeepChanges={() => {
						setShowDiffModal(false)
						setPreTailoredResume(null)
						trackLegacyEvent('post_tailor_action', {
							action: 'keep',
							userId,
							category: 'Resume Tailoring',
						})
						// Track AI tailor accepted in PostHog
						track('ai_tailor_accepted', {
							experience_id: formData.id || 'unknown',
							changes_made: diffSummary?.totalChanges || 0,
						})
					}}
					onRevert={() => {
						if (preTailoredResume) {
							setFormData(preTailoredResume)
							debouncedSave(preTailoredResume)
						}
						setShowDiffModal(false)
						setPreTailoredResume(null)
						trackLegacyEvent('post_tailor_action', {
							action: 'revert',
							userId,
							category: 'Resume Tailoring',
						})
						// Track AI tailor rejected in PostHog
						track('ai_tailor_rejected', {
							experience_id: formData.id || 'unknown',
						})
					}}
					diffSummary={diffSummary}
					scoreImprovement={previousScore ? scores.overall - previousScore : 0}
				/>
			)}

			{/* Onboarding components */}
			<JobPasteModal
				isOpen={onboarding.showJobModal}
				onComplete={onboarding.handleJobCreated}
				onSkip={onboarding.handleSkipJob}
			/>

			<SpotlightOverlay
				targetSelector={onboarding.spotlightTarget}
				enabled={!!onboarding.spotlightTarget}
			>
				{onboarding.spotlightHint && (
					<div className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg">
						{onboarding.spotlightHint}
					</div>
				)}
			</SpotlightOverlay>
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
	// Critical font CSS to ensure correct weights are applied in PDF
	const fontOverrides = `
		.font-crimson,
		.font-crimson * {
			font-family: 'Crimson Pro', Georgia, serif !important;
		}

		/* Bold elements - use 700 */
		.resume-name,
		.resume-company,
		.resume-job-title,
		.resume-dates,
		.resume-degree,
		.resume-skill-label {
			font-weight: 800 !important;
		}

		/* Regular elements - use 500 */
		.resume-body,
		.resume-section-header,
		.resume-contact,
		.resume-role,
		.resume-school,
		.resume-skill {
			font-weight: 500 !important;
		}

		/* Set body defaults */
		body {
			font-family: 'Crimson Pro', Georgia, serif !important;
			font-weight: 500 !important;
		}
	`

	// Get all stylesheet links and inline styles, but FILTER OUT any @font-face
	// rules that might declare light font weights (200, 300, etc.)
	const styles = Array.from(document.styleSheets)
		.map(sheet => {
			try {
				return Array.from(sheet.cssRules)
					.filter(rule => {
						// Skip @font-face rules that might declare light weights
						if (rule instanceof CSSFontFaceRule) {
							const ruleText = rule.cssText
							// Keep only if it's for weights 400+ or doesn't specify weight
							if (
								ruleText.includes('font-weight: 200') ||
								ruleText.includes('font-weight: 300') ||
								ruleText.includes('font-weight:200') ||
								ruleText.includes('font-weight:300')
							) {
								return false
							}
						}
						return true
					})
					.map(rule => rule.cssText)
					.join('\n')
			} catch (e) {
				// Skip external stylesheets that might cause CORS issues
				return ''
			}
		})
		.join('\n')

	return `<style>${styles}\n${fontOverrides}</style>`
}

// Google Fonts for PDF - @font-face without local() forces web fonts over system fonts
function getGoogleFontsLinks() {
	return `
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@500;800&display=swap" rel="stylesheet">
	`
}
