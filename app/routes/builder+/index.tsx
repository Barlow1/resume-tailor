import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import {
	useLoaderData,
	useFetcher,
	useNavigate,
	useSubmit,
} from '@remix-run/react'
import { useOptionalUser } from '~/utils/user.ts'
import { useTheme } from '~/routes/resources+/theme/index.tsx'
import {
	ChevronDown,
	Search,
	Sun,
	Moon,
	Download,
	LayoutTemplate,
	Check,
	X,
	Plus,
	Briefcase,
	GraduationCap,
	Code2,
	AlignLeft,
	Target,
	PanelLeftClose,
	PanelRightClose,
	Eye,
	EyeOff,
} from 'lucide-react'
import { SubscribeModal } from '~/components/subscribe-modal.tsx'
import { getStripeSubscription, getUserId } from '~/utils/auth.server.ts'
import { useDebouncedCallback } from 'use-debounce'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import {
	AIAssistantModal,
	type DiagnosticContext,
} from '~/components/ai-assistant-modal.tsx'
import {
	type BuilderEducation,
	type BuilderExperience,
	type BuilderJob,
	getBuilderResume,
	type ResumeData,
} from '~/utils/builder-resume.server.ts'
import { CreateJobModal } from '~/components/create-job-modal.tsx'
import { getUserJobs } from '~/utils/job.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { ResumeCreationModal } from '~/components/resume-creation-modal.tsx'
import { getUserBuilderResumes } from '~/utils/builder-resume.server.ts'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { generateResumeHtml } from '~/utils/generate-resume-html.ts'
import {
	ResumeIframe,
	type ResumeIframeHandle,
	type StructuralAction,
	type HoveredElementInfo,
} from '~/components/resume-iframe.tsx'
import { FloatingToolbar } from '~/components/floating-toolbar.tsx'
import { type Job } from '@prisma/client'
import { trackEvent } from '~/utils/analytics.ts'
import { trackEvent as trackLegacyEvent } from '~/utils/tracking.client.ts'
import { track } from '~/lib/analytics.client.ts'
import { toast } from '~/components/ui/use-toast.ts'
import { useOnboardingFlow } from '~/hooks/use-onboarding-flow.ts'
import { JobPasteModal } from '~/components/job-paste-modal.tsx'
import { BuilderNav } from '~/components/builder-nav.tsx'
import { OnboardingWidget } from '~/components/onboarding-widget.tsx'
import { TruthPanel } from '~/components/truth-panel.tsx'
import { CoverLetterPanel } from '~/components/cover-letter-panel.tsx'
import { TEMPLATE_META, FONT_PAIRINGS, COLOR_PALETTE } from '~/utils/templates/registry.ts'

function base64ToUint8Array(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

const getDefaultFormData = (): ResumeData => {
	return {
		name: '',
		nameColor: '#1b3a5c',
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
				descriptions: [{ id: crypto.randomUUID(), content: '' }],
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
			{ id: crypto.randomUUID(), name: 'Product: ' },
			{ id: crypto.randomUUID(), name: 'Tools: ' },
		],
		hobbies: [{ id: crypto.randomUUID(), name: '' }],
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
		font: 'inter',
		layout: 'slate',
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
				nameColor: resume.nameColor || '#1b3a5c',
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
				font: resume.font || 'inter',
				layout: resume.layout || 'slate',
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

/* ═══ DESIGN TOKENS ═══ */
const BRAND = '#6B45FF'
const SUCCESS = '#30A46C'
const AMBER = '#F5D90A'

const lightTheme = {
	bg: '#FAFAFA',
	bgEl: '#FFFFFF',
	bgSurf: '#F4F4F5',
	border: '#E0E0E6',
	borderSub: '#EBEBEF',
	text: '#111113',
	muted: '#46464C',
	dim: '#4A4A50',
	canvas: '#E8E8EC',
	white: '#FFFFFF',
	brandText: '#4B30B3',
}
const darkTheme = {
	bg: '#111113',
	bgEl: '#18181B',
	bgSurf: '#1E1E22',
	border: '#2B2B31',
	borderSub: '#222228',
	text: '#ECECEE',
	muted: '#B5B5BB',
	dim: '#B4B4BA',
	canvas: '#0C0C0E',
	white: '#FFFFFF',
	brandText: '#C0ABFF',
}
type Theme = typeof lightTheme


/* ═══ FONT / TEMPLATE OPTIONS (from registry) ═══ */
const VISIBLE_PAIRINGS = FONT_PAIRINGS.filter((p: { legacy?: boolean }) => !p.legacy)
const DEFAULT_SECTION_ORDER = [
	'summary',
	'experience',
	'education',
	'skills',
	'hobbies',
]

function moveArray<T>(arr: T[], from: number, to: number): T[] {
	const result = [...arr]
	const [removed] = result.splice(from, 1)
	result.splice(to, 0, removed)
	return result
}

/* ═══ PAGE DIMENSIONS ═══ */


/* ═══ EDITABLE TEXT ═══ */
/* ═══ BACKDROP ═══ */
const Backdrop = ({
	children,
	onClick,
}: {
	children: React.ReactNode
	onClick: () => void
}) => (
	<div
		onClick={onClick}
		style={{
			position: 'fixed',
			inset: 0,
			zIndex: 200,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			background: 'rgba(0,0,0,0.55)',
			backdropFilter: 'blur(8px)',
		}}
	>
		{children}
	</div>
)

/* ═══ JOB DROPDOWN ═══ */
function JobDropdown({
	jobs,
	current,
	onSelect,
	c,
}: {
	jobs: Jsonify<Job>[]
	current: string | null
	onSelect: (j: Jsonify<Job>) => void
	c: Theme
}) {
	const [open, setOpen] = useState(false)
	const j = jobs.find(jb => jb.id === current)
	return (
		<div style={{ position: 'relative' }}>
			<div
				onClick={() => setOpen(!open)}
				style={{
					padding: '10px 13px',
					borderRadius: 7,
					border: `1px solid ${c.border}`,
					background: c.bgSurf,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					cursor: 'pointer',
				}}
			>
				<div style={{ minWidth: 0 }}>
					<div
						style={{
							fontSize: 16,
							color: c.text,
							fontWeight: 500,
							whiteSpace: 'nowrap',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
						}}
					>
						{j?.title || 'Choose a job...'}
					</div>
					{j?.company && (
						<div style={{ fontSize: 12, color: c.dim, marginTop: 1 }}>
							{j.company}
						</div>
					)}
				</div>
				<ChevronDown
					size={17}
					color={c.dim}
					style={{
						flexShrink: 0,
						transform: open ? 'rotate(180deg)' : 'none',
						transition: 'transform 150ms',
					}}
				/>
			</div>
			{open && (
				<div
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						right: 0,
						marginTop: 4,
						background: c.bgEl,
						border: `1px solid ${c.border}`,
						borderRadius: 8,
						boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
						zIndex: 50,
						overflow: 'hidden',
					}}
				>
					{jobs.map(jb => (
						<div
							key={jb.id}
							onClick={() => {
								onSelect(jb)
								setOpen(false)
							}}
							style={{
								padding: '13px 16px',
								cursor: 'pointer',
								background: current === jb.id ? `${BRAND}08` : 'transparent',
								borderLeft:
									current === jb.id
										? `2px solid ${BRAND}`
										: '2px solid transparent',
							}}
							onMouseEnter={e => {
								if (current !== jb.id)
									(e.currentTarget as HTMLElement).style.background = c.bgSurf
							}}
							onMouseLeave={e => {
								if (current !== jb.id)
									(e.currentTarget as HTMLElement).style.background =
										'transparent'
							}}
						>
							<div style={{ fontSize: 16, color: c.text, fontWeight: 500 }}>
								{jb.title}
							</div>
							{jb.company && (
								<div style={{ fontSize: 12, color: c.dim, marginTop: 1 }}>
									{jb.company}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

/* ═══ SLIDE-OVER PANEL ═══ */
function SlideOver({
	open,
	onClose,
	title,
	children,
	c,
}: {
	open: boolean
	onClose: () => void
	title: string
	children: React.ReactNode
	c: Theme
}) {
	if (!open) return null
	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 300,
				display: 'flex',
				justifyContent: 'flex-end',
			}}
		>
			<div
				onClick={onClose}
				style={{
					position: 'absolute',
					inset: 0,
					background: 'rgba(0,0,0,0.4)',
					backdropFilter: 'blur(4px)',
				}}
			/>
			<div
				style={{
					position: 'relative',
					width: 400,
					maxWidth: '90vw',
					background: c.bgEl,
					borderLeft: `1px solid ${c.border}`,
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
				}}
			>
				<div
					style={{
						padding: '16px 20px',
						borderBottom: `1px solid ${c.border}`,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>
						{title}
					</span>
					<button
						onClick={onClose}
						style={{
							width: 28,
							height: 28,
							borderRadius: 5,
							border: 'none',
							background: 'transparent',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<X size={16} color={c.dim} />
					</button>
				</div>
				<div style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</div>
			</div>
		</div>
	)
}

/* ═══════════════════════════════════════ */
/* ═══ MAIN BUILDER COMPONENT ═══ */
/* ═══════════════════════════════════════ */
export default function ResumeBuilder() {
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

	const navigate = useNavigate()
	const [formData, setFormData] = useState(savedData)
	const appTheme = useTheme()
	const isDark = appTheme === 'dark'
	const [sidebar, setSidebar] = useState(true)
	const [scorePanel, setScorePanel] = useState(true)
	const [activeSection, setActiveSection] = useState('experience')
	const [showSubscribeModal, setShowSubscribeModal] = useState(false)
	const [subscribeModalTrigger, setSubscribeModalTrigger] = useState<'download_limit' | 'ai_limit'>('download_limit')
	const [showCreateJob, setShowCreateJob] = useState(false)
	const [showCreationModal, setShowCreationModal] = useState(!formData.id)
	const [showAIModal, setShowAIModal] = useState(false)
	const [aiModalInitialTab, setAiModalInitialTab] = useState<
		'tailor' | 'generate' | undefined
	>(undefined)
	const [selectedBullet, setSelectedBullet] = useState<{
		experienceId: string
		bulletIndex: number
		content: string
	} | null>(null)
	const [selectedExperience, setSelectedExperience] = useState<
		BuilderExperience | undefined
	>(undefined)
	const [diagnosticContext, setDiagnosticContext] =
		useState<DiagnosticContext | null>(null)
	const [, setHighlightedBullets] = useState<Set<string>>(new Set())
	const [selectedJob, setSelectedJob] = useState<BuilderJob | null | undefined>(
		formData.job,
	)
	const [downloadClicked, setDownloadClicked] = useState(false)
	const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER)
	const [coverLetterOpen, setCoverLetterOpen] = useState(false)
	const [coverLetterText, setCoverLetterText] = useState('')
	const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false)
	const [showTemplateGallery, setShowTemplateGallery] = useState(false)
	const [showCommandPalette, setShowCommandPalette] = useState(false)
	const [showAllResumes, setShowAllResumes] = useState(false)
	const [cmdSearch, setCmdSearch] = useState('')
	const [cmdSelected, setCmdSelected] = useState(0)
	const [onboardingDismissed, setOnboardingDismissed] = useState(false)
	const [onboardingCollapsed, setOnboardingCollapsed] = useState(false)
	const [hasReviewedMatch, setHasReviewedMatch] = useState(false)
	const [hasTakenAction, setHasTakenAction] = useState(false)
	const [editingResumeId, setEditingResumeId] = useState<string | null>(null)
	const [matchRefetchKey, setMatchRefetchKey] = useState(0)
	const undoSnapshotRef = useRef<typeof formData | null>(null)
	const bulletUndoMapRef = useRef<Map<string, { action: 'rewrite' | 'new'; experienceId: string; originalText: string | null }>>(new Map())
	const [pendingHighlights, setPendingHighlights] = useState<string[]>([])
	const [hoveredElement, setHoveredElement] =
		useState<HoveredElementInfo | null>(null)
	const iframeComponentRef = useRef<ResumeIframeHandle>(null)
	const user = useOptionalUser()
	const submitForm = useSubmit()
	const [profileOpen, setProfileOpen] = useState(false)
	const profileRef = useRef<HTMLDivElement>(null)
	const logoutFormRef = useRef<HTMLFormElement>(null)
	const manageSubFormRef = useRef<HTMLFormElement>(null)

	const c = isDark ? darkTheme : lightTheme
	const sW = sidebar ? 304 : 64
	const rightPanelW = scorePanel ? 340 : 0
	const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440)
	useEffect(() => {
		const handler = () => setViewportWidth(window.innerWidth)
		window.addEventListener('resize', handler)
		return () => window.removeEventListener('resize', handler)
	}, [])
	const canvasAvailable = viewportWidth - sW - rightPanelW - 80
	const canvasScale = Math.min(Math.max(canvasAvailable / 816, 0.7), 1.25)

	/* ═══ DARK MODE (synced with app theme) ═══ */
	const themeFetcher = useFetcher()
	const toggleDarkMode = useCallback(() => {
		themeFetcher.submit(
			{ theme: isDark ? 'light' : 'dark' },
			{ method: 'POST', action: '/resources/theme' },
		)
	}, [isDark, themeFetcher])

	/* ═══ COMMAND PALETTE (⌘K) ═══ */
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				setShowCommandPalette(prev => !prev)
				setCmdSearch('')
				setCmdSelected(0)
			}
			if (e.key === 'Escape') {
				setShowCommandPalette(false)
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [])

	useEffect(() => {
		if (!profileOpen) return
		function handleClickOutside(e: MouseEvent) {
			if (
				profileRef.current &&
				!profileRef.current.contains(e.target as Node)
			) {
				setProfileOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [profileOpen])

	/* ═══ COVER LETTER ═══ */
	const coverLetterFetcher = useFetcher<{ coverLetter: string }>()

	const handleGenerateCoverLetter = useCallback(() => {
		if (!formData.id || !selectedJob?.id) return
		setIsGeneratingCoverLetter(true)
		setCoverLetterOpen(true)
		coverLetterFetcher.submit(
			JSON.stringify({ resumeId: formData.id, jobId: selectedJob.id }),
			{ method: 'POST', action: '/resources/generate-cover-letter', encType: 'application/json' },
		)
	}, [formData.id, selectedJob?.id, coverLetterFetcher])

	useEffect(() => {
		if (coverLetterFetcher.data?.coverLetter) {
			setCoverLetterText(coverLetterFetcher.data.coverLetter)
			setIsGeneratingCoverLetter(false)
		}
	}, [coverLetterFetcher.data])

	// Load existing draft when opening cover letter panel
	useEffect(() => {
		if (coverLetterOpen && selectedJob?.id && !coverLetterText) {
			if (formData.coverLetterDrafts) {
				try {
					const drafts = JSON.parse(formData.coverLetterDrafts) as Record<string, string>
					if (drafts[selectedJob.id]) {
						setCoverLetterText(drafts[selectedJob.id])
					}
				} catch {
					// ignore parse errors
				}
			}
		}
	}, [coverLetterOpen, selectedJob?.id])

	const handleCoverLetterTextChange = useCallback((text: string) => {
		setCoverLetterText(text)
		const jobId = selectedJob?.id
		if (jobId) {
			setFormData(prev => {
				const drafts = prev.coverLetterDrafts ? JSON.parse(prev.coverLetterDrafts) as Record<string, string> : {}
				drafts[jobId] = text
				return { ...prev, coverLetterDrafts: JSON.stringify(drafts) }
			})
		}
	}, [selectedJob?.id])

	/* ═══ SAVE ═══ */
	const fetcher = useFetcher<{ success: boolean; error?: string }>()
	const pdfFetcher = useFetcher<{ fileData: string; fileType: string }>()
	const applicationFetcher = useFetcher()
	const [saveStatus, setSaveStatus] = useState<
		'idle' | 'saving' | 'saved' | 'error'
	>('idle')
	const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
	const scrollHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

	const debouncedSave = useDebouncedCallback(async (data: ResumeData) => {
		const form = new FormData()
		form.append('formData', JSON.stringify(data))
		form.append('downloadPDFRequested', 'false')
		form.append('subscribe', 'false')
		await fetcher.submit(form, {
			method: 'POST',
			action: '/resources/save-resume',
		})
	}, 1000)

	useEffect(() => {
		if (fetcher.state === 'submitting') {
			setSaveStatus('saving')
			return
		}
		if (fetcher.state === 'idle' && fetcher.data) {
			if (fetcher.data.success === false) {
				setSaveStatus('error')
				toast({
					variant: 'destructive',
					title: 'Failed to save',
					description:
						fetcher.data.error ||
						'Your changes could not be saved. Please try again.',
				})
			} else {
				setSaveStatus('saved')
			}
			clearTimeout(saveStatusTimeoutRef.current)
			saveStatusTimeoutRef.current = setTimeout(
				() => setSaveStatus('idle'),
				3000,
			)
		}
	}, [fetcher.state, fetcher.data])

	/* ═══ RESUME SWITCHING ═══ */
	const resumeSwitchFetcher = useFetcher()
	const cloneForJobFetcher = useFetcher<{ resumeId?: string; error?: string }>()
	const isCloning = cloneForJobFetcher.state !== 'idle'
	const handleResumeSwitch = useCallback(
		(resumeId: string) => {
			if (resumeId === formData.id) return
			debouncedSave.cancel()
			resumeSwitchFetcher.submit(
				{ resumeId },
				{ method: 'POST', action: '/resumes' },
			)
		},
		[formData.id, resumeSwitchFetcher, debouncedSave],
	)

	useEffect(() => {
		if (savedData.id !== formData.id && savedData.id !== undefined) {
			setFormData(savedData)
			setSelectedJob(savedData.job)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [savedData.id])

	// When clone-for-job completes, switch to the new resume
	useEffect(() => {
		if (cloneForJobFetcher.state === 'idle' && cloneForJobFetcher.data?.resumeId) {
			const newResumeId = cloneForJobFetcher.data.resumeId
			if (newResumeId !== formData.id) {
				resumeSwitchFetcher.submit(
					{ resumeId: newResumeId },
					{ method: 'POST', action: '/resumes' },
				)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cloneForJobFetcher.state, cloneForJobFetcher.data])

	/* ═══ ANALYTICS ═══ */
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		track('builder_opened', {
			resume_id: savedData.id || 'new',
			has_job: !!savedData.jobId,
			section_count:
				(savedData.experiences?.length || 0) +
				(savedData.education?.length || 0),
		})
	}, [])

	useEffect(() => {
		if (resumeUploadedTracking) {
			trackEvent('resume_uploaded', {
				user_id: resumeUploadedTracking.user_id,
				plan_type: resumeUploadedTracking.plan_type,
			})
		}
	}, [resumeUploadedTracking])

	/* ═══ PENDING HIGHLIGHTS — apply after formData settles into iframe ═══ */
	useEffect(() => {
		if (pendingHighlights.length === 0) return
		// Mark structural so iframe accepts the new HTML from the updated formData
		iframeComponentRef.current?.markStructuralUpdate()
		// Wait for iframe to re-render with new content, then highlight
		const timer = setTimeout(() => {
			iframeComponentRef.current?.highlightDescriptions(pendingHighlights)
			setPendingHighlights([])
		}, 800)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingHighlights])

	/* ═══ EDIT HANDLERS ═══ */
	const updateField = (field: string, val: string) => {
		setFormData(prev => {
			const newFormData = { ...prev, [field]: val }
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const updateExpField = (
		expId: string,
		field: keyof BuilderExperience,
		val: string,
	) => {
		setFormData(prev => {
			if (!prev.experiences) return prev
			const newFormData = {
				...prev,
				experiences: prev.experiences.map(exp =>
					exp.id === expId ? { ...exp, [field]: val } : exp,
				),
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const updateBullet = (expId: string, bulletIndex: number, val: string) => {
		setFormData(prev => {
			if (!prev.experiences) return prev
			const newFormData = {
				...prev,
				experiences: prev.experiences.map(exp => {
					if (exp.id !== expId || !exp.descriptions) return exp
					return {
						...exp,
						descriptions: exp.descriptions.map((b, i) =>
							i === bulletIndex ? { id: b.id, content: val } : b,
						),
					}
				}),
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const addBulletPoint = (experienceId: string) => {
		if (!formData.experiences) return
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp => {
				if (exp.id !== experienceId) return exp
				return {
					...exp,
					descriptions: [
						...(exp.descriptions || []),
						{ id: crypto.randomUUID(), content: '' },
					],
				}
			}),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const deleteBullet = (experienceId: string, bulletIndex: number) => {
		if (!formData.experiences) return
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp => {
				if (exp.id !== experienceId || !exp.descriptions) return exp
				const filtered = exp.descriptions.filter((_, i) => i !== bulletIndex)
				return {
					...exp,
					descriptions:
						filtered.length > 0
							? filtered
							: [{ id: crypto.randomUUID(), content: '' }],
				}
			}),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const reorderBullets = (
		experienceId: string,
		oldIndex: number,
		newIndex: number,
	) => {
		if (!formData.experiences) return
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp => {
				if (exp.id !== experienceId || !exp.descriptions) return exp
				return {
					...exp,
					descriptions: moveArray(exp.descriptions, oldIndex, newIndex),
				}
			}),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const updateEduField = (
		eduId: string,
		field: keyof BuilderEducation,
		val: string,
	) => {
		setFormData(prev => {
			if (!prev.education) return prev
			const newFormData = {
				...prev,
				education: prev.education.map(edu =>
					edu.id === eduId ? { ...edu, [field]: val } : edu,
				),
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const updateSkill = (skillId: string, val: string) => {
		setFormData(prev => {
			if (!prev.skills) return prev
			const newFormData = {
				...prev,
				skills: prev.skills.map(s =>
					s.id === skillId ? { ...s, name: val } : s,
				),
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const addSkill = () => {
		if (!formData.skills) return
		const newFormData = {
			...formData,
			skills: [...formData.skills, { id: crypto.randomUUID(), name: '' }],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const addExperience = () => {
		if (!formData.experiences) return
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
					descriptions: [{ id: crypto.randomUUID(), content: '' }],
				},
			],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const addEducation = () => {
		if (!formData.education) return
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

	const updateHobby = (hobbyId: string, val: string) => {
		setFormData(prev => {
			if (!prev.hobbies) return prev
			const newFormData = {
				...prev,
				hobbies: prev.hobbies.map(h =>
					h.id === hobbyId ? { ...h, name: val } : h,
				),
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const addHobby = () => {
		if (!formData.hobbies) return
		const newFormData = {
			...formData,
			hobbies: [...formData.hobbies, { id: crypto.randomUUID(), name: '' }],
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const deleteExperience = (experienceId: string) => {
		if (!formData.experiences) return
		const newFormData = {
			...formData,
			experiences: formData.experiences.filter(exp => exp.id !== experienceId),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const deleteEducation = (educationId: string) => {
		if (!formData.education) return
		const newFormData = {
			...formData,
			education: formData.education.filter(edu => edu.id !== educationId),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const deleteSkill = (skillId: string) => {
		if (!formData.skills) return
		const newFormData = {
			...formData,
			skills: formData.skills.filter(s => s.id !== skillId),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const deleteHobby = (hobbyId: string) => {
		if (!formData.hobbies) return
		const newFormData = {
			...formData,
			hobbies: formData.hobbies.filter(h => h.id !== hobbyId),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	/* ═══ JOB SELECTION ═══ */
	const keywordExtractFetcher = useFetcher<{
		extractedKeywords: string | null
	}>()
	useEffect(() => {
		if (
			keywordExtractFetcher.state === 'idle' &&
			keywordExtractFetcher.data?.extractedKeywords
		) {
			setFormData(prev => {
				if (!prev.job) return prev
				return {
					...prev,
					job: {
						...prev.job,
						extractedKeywords: keywordExtractFetcher.data!.extractedKeywords,
					},
				}
			})
		}
	}, [keywordExtractFetcher.state, keywordExtractFetcher.data])

	// On mount: auto-extract keywords if job exists but extractedKeywords is missing
	const hasTriggeredExtractRef = useRef(false)
	useEffect(() => {
		if (hasTriggeredExtractRef.current) return
		const job = formData.job
		if (job?.id && job?.content?.trim() && !job.extractedKeywords) {
			hasTriggeredExtractRef.current = true
			keywordExtractFetcher.submit(
				{ jobId: job.id },
				{ method: 'POST', action: '/resources/extract-keywords' },
			)
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const isResumeBlank = useCallback((data: typeof formData) => {
		const hasName = !!data.name?.trim()
		const hasRole = !!data.role?.trim()
		const hasEmail = !!data.email?.trim()
		const hasAbout = !!data.about?.trim()
		const hasRealExperience = (data.experiences ?? []).some(
			exp => exp.role?.trim() || exp.company?.trim(),
		)
		return !hasName && !hasRole && !hasEmail && !hasAbout && !hasRealExperience
	}, [])

	const handleJobChange = useCallback(
		(job: any) => {
			// Deselecting job — navigate to base (jobless) resume
			if (!job) {
				setSelectedJob(null)
				const baseResume = resumes.find(r => !r.jobId)
				if (baseResume && baseResume.id !== formData.id) {
					handleResumeSwitch(baseResume.id!)
				} else {
					const newFormData = { ...formData, jobId: null, job: null }
					setFormData(newFormData)
					debouncedSave(newFormData)
				}
				return
			}

			// Check if a resume already exists for this job — switch to it
			// Note: resumes is from loader data and may be stale for same-session clones;
			// the server-side idempotency guard is the authoritative duplicate check.
			const existingForJob = resumes.find(r => r.jobId === job.id)
			if (existingForJob && existingForJob.id !== formData.id) {
				handleResumeSwitch(existingForJob.id!)
				setSelectedJob(job)
				setSidebar(false)
				trackLegacyEvent('job_selected', {
					jobId: job.id,
					hasJobDescription: !!(job?.content && job.content.trim().length > 0),
					userId,
					category: 'Resume Builder',
				})
				return
			}

			// Blank resume — just attach job directly, no clone needed
			if (isResumeBlank(formData)) {
				setSelectedJob(job)
				setSidebar(false)
				const newFormData = { ...formData, jobId: job.id, job }
				setFormData(newFormData)
				debouncedSave(newFormData)
				trackLegacyEvent('job_selected', {
					jobId: job.id,
					hasJobDescription: !!(job?.content && job.content.trim().length > 0),
					userId,
					category: 'Resume Builder',
				})
				if (job.id && job.content?.trim() && !job.extractedKeywords) {
					keywordExtractFetcher.submit(
						{ jobId: job.id },
						{ method: 'POST', action: '/resources/extract-keywords' },
					)
				}
				return
			}

			// Clone the current resume for this job
			setSelectedJob(job)
			setSidebar(false)

			cloneForJobFetcher.submit(
				{
					existingResumeId: formData.id!,
					jobId: job.id,
				},
				{ method: 'POST', action: '/resources/create-resume?type=clone-for-job' },
			)

			trackLegacyEvent('job_selected', {
				jobId: job.id,
				hasJobDescription: !!(job?.content && job.content.trim().length > 0),
				userId,
				category: 'Resume Builder',
			})

			if (job.id && job.content?.trim() && !job.extractedKeywords) {
				keywordExtractFetcher.submit(
					{ jobId: job.id },
					{ method: 'POST', action: '/resources/extract-keywords' },
				)
			}
		},
		[formData, resumes, debouncedSave, userId, keywordExtractFetcher, cloneForJobFetcher, isResumeBlank, handleResumeSwitch],
	)

	/* ═══ AI ═══ */
	const handleAIClick = (
		experienceId: string,
		bulletIndex: number,
		content: string,
		diagnostic?: DiagnosticContext | null,
	) => {
		const experience = formData.experiences?.find(
			exp => exp.id === experienceId,
		)
		setSelectedExperience(experience)
		setSelectedBullet({ content, experienceId, bulletIndex })
		setDiagnosticContext(diagnostic ?? null)
		setAiModalInitialTab(undefined)
		setShowAIModal(true)
		onboarding.handleAIModalOpen()
	}

	const handleBulletUpdate = (newContent: string) => {
		if (!selectedBullet) return
		const expId = selectedBullet.experienceId
		const bulletIdx = selectedBullet.bulletIndex
		if (bulletIdx === -1) {
			// Append new bullet to the experience
			const newFormData = {
				...formData,
				experiences: (formData.experiences ?? []).map(exp =>
					exp.id === expId
						? {
								...exp,
								descriptions: [
									...(exp.descriptions ?? []),
									{ id: crypto.randomUUID(), content: newContent },
								],
						  }
						: exp,
				),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
			// Scroll to the new bullet (last index) after iframe re-renders
			const newIdx = (formData.experiences?.find(e => e.id === expId)?.descriptions?.length) ?? 0
			setTimeout(() => iframeComponentRef.current?.highlightBullet(expId, newIdx), 400)
		} else {
			updateBullet(expId, bulletIdx, newContent)
			// Scroll to and flash the updated bullet after iframe re-renders
			setTimeout(() => iframeComponentRef.current?.highlightBullet(expId, bulletIdx), 400)
		}
	}

	const handleMultipleBulletUpdate = (newContents: string[]) => {
		if (!formData.experiences || !selectedBullet || newContents.length === 0)
			return
		if (selectedBullet.bulletIndex === -1) {
			// Append all new bullets to the experience
			const newFormData = {
				...formData,
				experiences: formData.experiences.map(exp =>
					exp.id === selectedBullet.experienceId
						? {
								...exp,
								descriptions: [
									...(exp.descriptions ?? []),
									...newContents.map(b => ({
										id: crypto.randomUUID(),
										content: b,
									})),
								],
						  }
						: exp,
				),
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		} else {
			const [firstBullet, ...rest] = newContents
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
									{ id: crypto.randomUUID(), content: firstBullet },
									...rest.map(b => ({ id: crypto.randomUUID(), content: b })),
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
		}
	}

	/* ═══ ONBOARDING ═══ */
	const onboarding = useOnboardingFlow({
		serverProgress: gettingStartedProgress,
		hasResume: !!(formData.name || formData.role),
		selectedJob: selectedJob as Jsonify<Job> | null | undefined,
		hasReviewedMatch,
		hasTakenAction,
		onJobSelect: handleJobChange as (job: Jsonify<Job>) => void,
	})

	/* ═══ PDF DOWNLOAD ═══ */
	const handlePDFDownloadRequested = useCallback(
		({
			downloadPDFRequested: dpr,
			subscribe: sub,
		}: {
			downloadPDFRequested: boolean
			subscribe: boolean
		}) => {
			fetcher.submit(
				{
					formData: JSON.stringify(formData),
					downloadPDFRequested: dpr,
					subscribe: sub,
				},
				{ method: 'post', action: '/resources/save-resume' },
			)
		},
		[fetcher, formData],
	)

	const handleDownloadPDF = useCallback(async () => {
		const MAX_FREE_DOWNLOADS = 3
		if (
			!subscription?.active &&
			(gettingStartedProgress?.downloadCount ?? 0) >= MAX_FREE_DOWNLOADS
		) {
			setSubscribeModalTrigger('download_limit')
			setShowSubscribeModal(true)
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
		if (pdfFetcher.state !== 'idle') return
		const html = generateResumeHtml(formData, sectionOrder)
		pdfFetcher.submit(
			{ html, resumeId: formData.id ?? '' },
			{ method: 'post', action: '/resources/generate-pdf' },
		)
	}, [
		subscription?.active,
		gettingStartedProgress?.downloadCount,
		handlePDFDownloadRequested,
		pdfFetcher,
		formData,
		sectionOrder,
	])

	const handleClickDownloadPDF = useCallback(() => {
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
	}, [
		userId,
		navigate,
		handlePDFDownloadRequested,
		subscription,
		handleDownloadPDF,
	])

	const lastPdfDataRef = useRef<{ fileData: string; fileType: string } | null>(
		null,
	)
	useEffect(() => {
		if (!pdfFetcher.data || pdfFetcher.state !== 'idle') return
		if (pdfFetcher.data === lastPdfDataRef.current) return
		lastPdfDataRef.current = pdfFetcher.data
		const { fileData, fileType } = pdfFetcher.data
		const byteArray = base64ToUint8Array(fileData)
		const blob = new Blob([byteArray as BlobPart], { type: fileType })
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${formData.name || 'resume'}.pdf`
		a.click()
		setTimeout(() => URL.revokeObjectURL(url), 1000)

		// After PDF generation succeeds, create application if job selected
		if (selectedJob?.id && formData.id) {
			applicationFetcher.submit(
				JSON.stringify({
					intent: 'create',
					resumeId: formData.id,
					jobId: selectedJob.id,
					matchLevel: 'moderate', // TODO: get from truth panel data
					matchSummary: null,
				}),
				{ method: 'POST', action: '/resources/applications', encType: 'application/json' },
			)

			toast({
				title: 'Application tracked',
				description: `We'll check in on your application in 7 days.`,
			})
		}
	}, [formData.name, formData.id, selectedJob?.id, pdfFetcher.data, pdfFetcher.state])

	const pricingFetcher = useFetcher()
	useEffect(() => {
		if (subscribe && !downloadClicked) {
			handlePDFDownloadRequested({ downloadPDFRequested, subscribe: false })
			pricingFetcher.submit(
				{
					successUrl: '/builder',
					cancelUrl: '/builder',
					redirectTo: '/builder',
				},
				{ method: 'post', action: '/resources/pricing' },
			)
		}
	}, [subscribe, downloadClicked])

	useEffect(() => {
		if (downloadPDFRequested && !subscribe) handleDownloadPDF()
	}, [downloadPDFRequested, subscribe])

	/* ═══ SECTION SCROLL ═══ */
	const scrollToSection = (sec: string) => {
		setActiveSection(sec)
		iframeComponentRef.current?.scrollToSection(sec)
	}
	useEffect(() => {
		const timeoutRef = scrollHighlightTimeoutRef
		return () => {
			clearTimeout(timeoutRef.current)
		}
	}, [])

	/* ═══ TEMPLATE APPLY ═══ */
	const applyTemplate = (templateId: string) => {
		if (templateId === formData.layout) return
		const meta = TEMPLATE_META.find(t => t.id === templateId)
		if (!meta) return
		setFormData(prev => {
			const next = {
				...prev,
				layout: templateId,
				font: meta.defaultPairing,
				nameColor: meta.defaultAccent,
			}
			debouncedSave(next)
			return next
		})
	}
	const applyFont = (fontValue: string) => {
		setFormData(prev => {
			const next = { ...prev, font: fontValue }
			debouncedSave(next)
			return next
		})
	}
	const applyAccentColor = (color: string) => {
		setFormData(prev => {
			const next = { ...prev, nameColor: color }
			debouncedSave(next)
			return next
		})
	}

	/* ═══ COMMAND PALETTE ACTIONS ═══ */
	const commands = useMemo(
		() => [
			{
				id: 'new-resume',
				label: 'New Resume',
				icon: Plus,
				action: () => setShowCreationModal(true),
			},
			{
				id: 'download',
				label: 'Download PDF',
				icon: Download,
				action: handleClickDownloadPDF,
			},
			{
				id: 'templates',
				label: 'Change Template',
				icon: LayoutTemplate,
				action: () => setShowTemplateGallery(true),
			},
			{
				id: 'dark-mode',
				label: `Switch to ${isDark ? 'Light' : 'Dark'} Mode`,
				icon: isDark ? Sun : Moon,
				action: toggleDarkMode,
			},
			{
				id: 'sidebar',
				label: 'Toggle Sidebar',
				icon: PanelLeftClose,
				action: () => setSidebar(s => !s),
			},
			{
				id: 'score',
				label: 'Toggle Match Panel',
				icon: Target,
				action: () => setScorePanel(p => !p),
			},
			{
				id: 'add-job',
				label: 'Add Target Job',
				icon: Briefcase,
				action: () => setShowCreateJob(true),
			},
		],
		[isDark, toggleDarkMode, handleClickDownloadPDF],
	)

	const filteredCommands = cmdSearch
		? commands.filter(cmd =>
				cmd.label.toLowerCase().includes(cmdSearch.toLowerCase()),
		  )
		: commands

	const handleUploadResume = () => {
		if (!userId) {
			navigate('/login?redirectTo=/builder')
			return false
		}
		return true
	}

	const handleStartScratch = async () => {
		const blank = getDefaultFormData() as typeof formData
		setFormData(blank)
		setSelectedJob(null)
		// Save the new blank resume, then navigate to refresh the resumes list
		const form = new FormData()
		form.append('formData', JSON.stringify(blank))
		form.append('downloadPDFRequested', 'false')
		form.append('subscribe', 'false')
		await fetch('/resources/save-resume', { method: 'POST', body: form })
		navigate('/builder')
	}

	const sections = [
		{
			id: 'summary',
			l: formData.headers?.aboutHeader || 'Summary',
			icon: AlignLeft,
			visKey: 'about' as const,
		},
		{
			id: 'experience',
			l: formData.headers?.experienceHeader || 'Experience',
			icon: Briefcase,
			visKey: 'experience' as const,
		},
		{
			id: 'education',
			l: formData.headers?.educationHeader || 'Education',
			icon: GraduationCap,
			visKey: 'education' as const,
		},
		{
			id: 'skills',
			l: formData.headers?.skillsHeader || 'Skills',
			icon: Code2,
			visKey: 'skills' as const,
		},
		{
			id: 'hobbies',
			l: formData.headers?.hobbiesHeader || 'Interests',
			icon: AlignLeft,
			visKey: 'hobbies' as const,
		},
	]

	const updateHeader = (headerKey: string, val: string) => {
		setFormData(prev => {
			const newFormData = {
				...prev,
				headers: {
					...prev.headers,
					[headerKey]: val,
				} as typeof prev.headers,
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	const toggleSectionVisibility = (visKey: string) => {
		setFormData(prev => {
			const current =
				prev.visibleSections?.[
					visKey as keyof typeof prev.visibleSections
				] ?? true
			const vs = prev.visibleSections ?? {
				about: true,
				experience: true,
				education: true,
				skills: true,
				hobbies: true,
				personalDetails: true,
				photo: true,
			}
			const newFormData = {
				...prev,
				visibleSections: { ...vs, [visKey]: !current },
			}
			debouncedSave(newFormData)
			return newFormData
		})
	}

	/* ═══ IFRAME HANDLERS ═══ */
	const handleIframeFieldChange = useCallback(
		(fieldPath: string, value: string) => {
			if (
				[
					'name',
					'role',
					'email',
					'phone',
					'location',
					'website',
					'about',
				].includes(fieldPath)
			) {
				updateField(fieldPath, value)
				return
			}
			if (fieldPath.startsWith('headers.')) {
				const headerKey = fieldPath.split('.')[1]
				updateHeader(headerKey, value)
				return
			}
			if (fieldPath.startsWith('experiences.')) {
				const parts = fieldPath.split('.')
				const expIndex = parseInt(parts[1])
				const exp = formData.experiences?.[expIndex]
				if (!exp?.id) return
				if (parts[2] === 'descriptions') {
					const bulletIndex = parseInt(parts[3])
					updateBullet(exp.id, bulletIndex, value)
				} else {
					updateExpField(exp.id, parts[2] as keyof BuilderExperience, value)
				}
				return
			}
			if (fieldPath.startsWith('education.')) {
				const parts = fieldPath.split('.')
				const eduIndex = parseInt(parts[1])
				const edu = formData.education?.[eduIndex]
				if (!edu?.id) return
				updateEduField(edu.id, parts[2] as keyof BuilderEducation, value)
				return
			}
			if (fieldPath.startsWith('skills.')) {
				const skillIndex = parseInt(fieldPath.split('.')[1])
				const skill = formData.skills?.[skillIndex]
				if (!skill?.id) return
				updateSkill(skill.id, value)
				return
			}
			if (fieldPath.startsWith('hobbies.')) {
				const hobbyIndex = parseInt(fieldPath.split('.')[1])
				const hobby = formData.hobbies?.[hobbyIndex]
				if (!hobby?.id) return
				updateHobby(hobby.id, value)
				return
			}
		},
		[
			formData,
			updateField,
			updateHeader,
			updateExpField,
			updateBullet,
			updateEduField,
			updateSkill,
			updateHobby,
		],
	)

	const handleStructuralAction = useCallback(
		(action: StructuralAction) => {
			iframeComponentRef.current?.flushPendingEdits()
			iframeComponentRef.current?.markStructuralUpdate()
			switch (action.type) {
				case 'addBullet':
					addBulletPoint(action.experienceId)
					break
				case 'deleteBullet':
					deleteBullet(action.experienceId, action.bulletIndex)
					break
				case 'reorderBullet':
					reorderBullets(action.experienceId, action.oldIndex, action.newIndex)
					break
				case 'addExperience':
					addExperience()
					break
				case 'addEducation':
					addEducation()
					break
				case 'addSkill':
					addSkill()
					break
				case 'addHobby':
					addHobby()
					break
				case 'deleteExperience':
					deleteExperience(action.experienceId)
					break
				case 'deleteEducation':
					deleteEducation(action.educationId)
					break
				case 'deleteSkill':
					deleteSkill(action.skillId)
					break
				case 'deleteHobby':
					deleteHobby(action.hobbyId)
					break
				case 'reorderSection':
					setSectionOrder(prev =>
						moveArray(prev, action.oldIndex, action.newIndex),
					)
					break
				case 'toggleSection':
					toggleSectionVisibility(action.sectionId)
					break
			}
			// Hide toolbar after structural action — iframe will re-render
			setHoveredElement(null)
		},
		[
			addBulletPoint,
			deleteBullet,
			reorderBullets,
			addExperience,
			addEducation,
			addSkill,
			addHobby,
			deleteExperience,
			deleteEducation,
			deleteSkill,
			deleteHobby,
			toggleSectionVisibility,
		],
	)

	const handleHoverElement = useCallback((info: HoveredElementInfo | null) => {
		setHoveredElement(info)
	}, [])

	const handleToolbarAITailor = useCallback(
		(experienceId: string, bulletIndex: number) => {
			const exp = formData.experiences?.find(e => e.id === experienceId)
			if (!exp) return
			const bullet = exp.descriptions?.[bulletIndex]
			handleAIClick(experienceId, bulletIndex, bullet?.content || '')
			setHoveredElement(null)
		},
		[formData, handleAIClick],
	)

	/* ═══ RENDER ═══ */
	return (
		<div
			style={{
				width: '100%',
				height: '100vh',
				background: c.bg,
				color: c.text,
				fontFamily: 'Nunito Sans,system-ui,-apple-system,sans-serif',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				letterSpacing: '-0.01em',
			}}
		>
			{/* MODALS */}
			<SubscribeModal
				isOpen={showSubscribeModal}
				onClose={() => setShowSubscribeModal(false)}
				successUrl="/builder"
				redirectTo="/builder"
				cancelUrl="/builder"
				trigger={subscribeModalTrigger}
			/>
			<AIAssistantModal
				isOpen={showAIModal}
				onClose={() => {
					setShowAIModal(false)
					setDiagnosticContext(null)
					setHighlightedBullets(new Set())
					setAiModalInitialTab(undefined)
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
				setShowSubscribeModal={(show: boolean) => {
					if (show) setSubscribeModalTrigger('ai_limit')
					setShowSubscribeModal(show)
				}}
				onTailorClick={onboarding.handleTailorComplete}
				theme={c}
				diagnosticContext={diagnosticContext}
				initialTab={aiModalInitialTab}
				onBulletChange={(newContent, newExp, bulletIdx) => {
					setSelectedBullet({
						content: newContent,
						experienceId: newExp.id!,
						bulletIndex: bulletIdx,
					})
					setSelectedExperience(newExp)
				}}
			/>
			<CreateJobModal
				isOpen={showCreateJob}
				onClose={() => setShowCreateJob(false)}
				onCreate={handleJobChange}
				theme={c}
			/>
			<ResumeCreationModal
				isOpen={showCreationModal}
				onClose={() => setShowCreationModal(false)}
				onStartScratch={handleStartScratch}
				resumes={resumes}
				userId={userId}
				handleUploadResume={handleUploadResume}
				theme={c}
			/>
			{onboarding.showJobModal && (
				<JobPasteModal
					isOpen={onboarding.showJobModal}
					onSkip={() => onboarding.handleSkipJob()}
					onComplete={handleJobChange}
					theme={c}
				/>
			)}

			{/* TOP BAR */}
			<BuilderNav
				c={c}
				isDark={isDark}
				scorePanel={scorePanel}
				setScorePanel={setScorePanel}
				showCommandPalette={showCommandPalette}
				setShowCommandPalette={setShowCommandPalette}
				setCmdSearch={setCmdSearch}
				setCmdSelected={setCmdSelected}
				setShowTemplateGallery={setShowTemplateGallery}
				saveStatus={saveStatus}
				toggleDarkMode={toggleDarkMode}
				handleClickDownloadPDF={handleClickDownloadPDF}
				user={user}
				profileOpen={profileOpen}
				setProfileOpen={setProfileOpen}
				profileRef={profileRef}
				logoutFormRef={logoutFormRef}
				manageSubFormRef={manageSubFormRef}
				submitForm={submitForm}
				navigate={navigate}
				BRAND={BRAND}
				AMBER={AMBER}
				SUCCESS={SUCCESS}
			/>

			{/* MAIN */}
			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				{/* SIDEBAR */}
				<div
					style={{
						width: sW,
						borderRight: `1px solid ${c.border}`,
						background: c.bgEl,
						display: 'flex',
						flexDirection: 'column',
						flexShrink: 0,
						transition: 'width 200ms cubic-bezier(0.25,0.1,0.25,1)',
						overflow: 'hidden',
					}}
				>
					<div
						style={{
							padding: sidebar ? '16px 16px 12px' : '16px 12px 12px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						{sidebar && (
							<span
								style={{
									fontSize: 14,
									fontWeight: 600,
									color: c.dim,
									textTransform: 'uppercase',
									letterSpacing: '0.04em',
								}}
							>
								Resumes
							</span>
						)}
						<button
							onClick={() => setSidebar(!sidebar)}
							style={{
								width: 34,
								height: 34,
								borderRadius: 6,
								border: 'none',
								background: 'transparent',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								margin: sidebar ? 0 : '0 auto',
							}}
						>
							<PanelLeftClose size={18} color={c.dim} strokeWidth={1.75} />
						</button>
					</div>
					{sidebar ? (
						<div style={{ flex: 1, overflow: 'auto', padding: '0 9px' }}>
							{/* Resume list */}
							{(showAllResumes ? resumes : resumes.slice(0, 3)).map(r => (
								<div
									key={r.id}
									onClick={() => handleResumeSwitch(r.id!)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 12,
										padding: '10px 16px',
										borderRadius: 7,
										cursor: 'pointer',
										background: formData.id === r.id ? c.bgSurf : 'transparent',
										borderLeft:
											formData.id === r.id
												? `2px solid ${BRAND}`
												: '2px solid transparent',
										transition: 'all 150ms',
									}}
									onMouseEnter={e => {
										if (formData.id !== r.id)
											(e.currentTarget as HTMLElement).style.background =
												c.bgSurf
									}}
									onMouseLeave={e => {
										if (formData.id !== r.id)
											(e.currentTarget as HTMLElement).style.background =
												'transparent'
									}}
								>
									<div
										style={{
											width: 37,
											height: 46,
											borderRadius: 3,
											background: '#FAFAFA',
											border:
												formData.id === r.id
													? `1.5px solid ${BRAND}50`
													: `1px solid ${c.border}`,
											flexShrink: 0,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<div
											style={{
												width: 17,
												display: 'flex',
												flexDirection: 'column',
												gap: 2,
											}}
										>
											{[2, 1.5, 1.5, 1.5].map((h, i) => (
												<div
													key={i}
													style={{
														height: h,
														background: i === 0 ? '#333' : '#bbb',
														borderRadius: 1,
														width: i === 2 ? '80%' : '100%',
													}}
												/>
											))}
										</div>
									</div>
									<div style={{ overflow: 'hidden', flex: 1 }}>
										{editingResumeId === r.id ? (
											<input
												autoFocus
												defaultValue={r.name || r.job?.title || 'Untitled'}
												style={{
													fontSize: 16,
													color: c.text,
													fontWeight: 500,
													background: c.bgSurf,
													border: `1px solid ${BRAND}`,
													borderRadius: 3,
													padding: '2px 5px',
													width: '100%',
													outline: 'none',
													fontFamily: 'inherit',
												}}
												onClick={e => e.stopPropagation()}
												onBlur={e => {
													const val = e.currentTarget.value.trim()
													if (
														val &&
														val !== (r.name || r.job?.title || 'Untitled') &&
														r.id === formData.id
													) {
														const newFormData = { ...formData, name: val }
														setFormData(newFormData)
														debouncedSave(newFormData)
													}
													setEditingResumeId(null)
												}}
												onKeyDown={e => {
													if (e.key === 'Enter')
														(e.currentTarget as HTMLInputElement).blur()
													if (e.key === 'Escape') setEditingResumeId(null)
												}}
											/>
										) : (
											<div
												onDoubleClick={e => {
													e.stopPropagation()
													setEditingResumeId(r.id!)
												}}
												style={{
													fontSize: 16,
													color: formData.id === r.id ? c.text : c.muted,
													fontWeight: formData.id === r.id ? 500 : 400,
													whiteSpace: 'nowrap',
													textOverflow: 'ellipsis',
													overflow: 'hidden',
												}}
											>
												{r.jobId ? ([r.job?.title, r.job?.company].filter(Boolean).join(' — ') || r.name || 'Untitled') : (r.name || 'Untitled')}
											</div>
										)}
									</div>
								</div>
							))}
							{resumes.length > 3 && (
								<div
									onClick={() => setShowAllResumes(prev => !prev)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 9,
										padding: '6px 16px',
										borderRadius: 7,
										cursor: 'pointer',
										color: c.brandText,
										fontSize: 13,
										fontWeight: 500,
									}}
								>
									{showAllResumes
										? 'Show less'
										: 'View all (' + resumes.length + ')'}
								</div>
							)}
							<div
								onClick={() => setShowCreationModal(true)}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 9,
									padding: '10px 16px',
									borderRadius: 7,
									cursor: 'pointer',
									marginTop: 5,
									color: c.dim,
								}}
								onMouseEnter={e => {
									;(e.currentTarget as HTMLElement).style.color = c.brandText
								}}
								onMouseLeave={e => {
									;(e.currentTarget as HTMLElement).style.color = c.dim
								}}
							>
								<Plus size={17} strokeWidth={2} />
								<span style={{ fontSize: 16, fontWeight: 500 }}>
									New Resume
								</span>
							</div>

							{/* Job selector */}
							<div style={{ marginTop: 21, padding: '0 5px' }}>
								<span
									style={{
										fontSize: 14,
										fontWeight: 600,
										color: c.dim,
										textTransform: 'uppercase',
										letterSpacing: '0.04em',
									}}
								>
									Target Job
								</span>
								{jobs.length > 0 && (
									<div style={{ marginTop: 9 }}>
										<JobDropdown
											jobs={jobs}
											current={formData.jobId ?? null}
											onSelect={handleJobChange}
											c={c}
										/>
									</div>
								)}
								<div
									onClick={() => setShowCreateJob(true)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 7,
										marginTop: 9,
										cursor: 'pointer',
										color: c.dim,
									}}
									onMouseEnter={e => {
										;(e.currentTarget as HTMLElement).style.color = c.brandText
									}}
									onMouseLeave={e => {
										;(e.currentTarget as HTMLElement).style.color = c.dim
									}}
								>
									<Plus size={17} strokeWidth={2} />
									<span style={{ fontSize: 16, fontWeight: 500 }}>Add Job</span>
								</div>
							</div>

							{/* Section nav */}
							<div style={{ marginTop: 21, padding: '0 5px' }}>
								<span
									style={{
										fontSize: 14,
										fontWeight: 600,
										color: c.dim,
										textTransform: 'uppercase',
										letterSpacing: '0.04em',
									}}
								>
									Sections
								</span>
								<div
									style={{
										marginTop: 9,
										display: 'flex',
										flexDirection: 'column',
										gap: 2,
									}}
								>
									{sections.map(s => {
										const isVisible =
											formData.visibleSections?.[s.visKey] ?? true
										return (
											<div
												key={s.id}
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: 2,
												}}
											>
												<div
													onClick={() => {
														if (isVisible) scrollToSection(s.id)
													}}
													style={{
														flex: 1,
														display: 'flex',
														alignItems: 'center',
														gap: 12,
														padding: '9px 16px',
														borderRadius: 7,
														cursor: isVisible ? 'pointer' : 'default',
														background:
															activeSection === s.id && isVisible
																? `${BRAND}12`
																: 'transparent',
														borderLeft:
															activeSection === s.id && isVisible
																? `2px solid ${BRAND}`
																: '2px solid transparent',
														transition: 'all 150ms',
														opacity: isVisible ? 1 : 0.4,
													}}
													onMouseEnter={e => {
														if (isVisible && activeSection !== s.id)
															(
																e.currentTarget as HTMLElement
															).style.background = c.bgSurf
													}}
													onMouseLeave={e => {
														if (isVisible && activeSection !== s.id)
															(
																e.currentTarget as HTMLElement
															).style.background =
																activeSection === s.id
																	? `${BRAND}12`
																	: 'transparent'
													}}
												>
													<s.icon
														size={20}
														color={
															activeSection === s.id && isVisible
																? c.brandText
																: c.dim
														}
														strokeWidth={1.75}
													/>
													<span
														style={{
															fontSize: 16,
															color:
																activeSection === s.id && isVisible
																	? c.text
																	: c.muted,
															fontWeight:
																activeSection === s.id && isVisible ? 500 : 400,
														}}
													>
														{s.l}
													</span>
												</div>
												<button
													onClick={() => handleStructuralAction({ type: 'toggleSection', sectionId: s.visKey })}
													style={{
														width: 30,
														height: 30,
														borderRadius: 5,
														border: 'none',
														background: 'transparent',
														cursor: 'pointer',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														opacity: 0.5,
														flexShrink: 0,
													}}
													onMouseEnter={e => {
														;(e.currentTarget as HTMLElement).style.opacity =
															'1'
													}}
													onMouseLeave={e => {
														;(e.currentTarget as HTMLElement).style.opacity =
															'0.5'
													}}
												>
													{isVisible ? (
														<Eye size={15} color={c.dim} strokeWidth={1.75} />
													) : (
														<EyeOff
															size={15}
															color={c.dim}
															strokeWidth={1.75}
														/>
													)}
												</button>
											</div>
										)
									})}
								</div>
							</div>
						</div>
					) : (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 5,
								paddingTop: 9,
							}}
						>
							<div
								onClick={() => setShowCreationModal(true)}
								style={{
									width: 39,
									height: 39,
									borderRadius: 7,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									cursor: 'pointer',
								}}
							>
								<Plus size={20} color={c.dim} strokeWidth={2} />
							</div>
							<div
								style={{
									width: 34,
									height: 1,
									background: c.borderSub,
									margin: '5px 0',
								}}
							/>
							{sections.map(s => (
								<div
									key={s.id}
									onClick={() => scrollToSection(s.id)}
									style={{
										width: 39,
										height: 39,
										borderRadius: 7,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										cursor: 'pointer',
										background:
											activeSection === s.id ? `${BRAND}12` : 'transparent',
										borderLeft:
											activeSection === s.id
												? `2px solid ${BRAND}`
												: '2px solid transparent',
									}}
								>
									<s.icon
										size={20}
										color={activeSection === s.id ? c.brandText : c.dim}
										strokeWidth={1.75}
									/>
								</div>
							))}
						</div>
					)}
				</div>

				{/* CENTER CANVAS */}
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden',
						background: c.bg,
					}}
				>
					<ResumeIframe
						ref={iframeComponentRef}
						formData={formData}
						sectionOrder={sectionOrder}
						onFieldChange={handleIframeFieldChange}
						onStructuralAction={handleStructuralAction}
						onHoverElement={handleHoverElement}
						onCommandK={() => setShowCommandPalette(true)}
						canvasBackground={c.canvas}
						canvasScale={canvasScale}
					/>
					<FloatingToolbar
						hovered={hoveredElement}
						onAction={handleStructuralAction}
						onAITailor={handleToolbarAITailor}
						onToggleSection={(sectionId) => handleStructuralAction({ type: 'toggleSection', sectionId })}
						onRevertBullet={(descId) => {
							const meta = bulletUndoMapRef.current.get(descId)
							if (!meta) return
							setFormData(prev => {
								const next = { ...prev, experiences: [...(prev.experiences ?? [])] }
								const expIdx = next.experiences!.findIndex(e => e.id === meta.experienceId)
								if (expIdx === -1) return prev
								const exp = { ...next.experiences![expIdx] }
								if (meta.action === 'rewrite' && meta.originalText !== null) {
									exp.descriptions = (exp.descriptions ?? []).map(d =>
										d.id === descId ? { ...d, content: meta.originalText! } : d,
									)
								} else {
									exp.descriptions = (exp.descriptions ?? []).filter(d => d.id !== descId)
								}
								next.experiences![expIdx] = exp
								return next
							})
							bulletUndoMapRef.current.delete(descId)
							requestAnimationFrame(() => {
								iframeComponentRef.current?.markStructuralUpdate()
							})
						}}
						revertableIds={new Set(bulletUndoMapRef.current.keys())}
						sectionOrder={sectionOrder}
						formData={formData}
					/>
				</div>

				{/* SCORE PANEL */}
				{scorePanel && (
					<div
						style={{
							width: 340,
							borderLeft: `1px solid ${c.border}`,
							background: c.bgEl,
							display: 'flex',
							flexDirection: 'column',
							flexShrink: 0,
							overflow: 'auto',
							position: 'relative',
						}}
					>
						<div
							style={{
								padding: '16px 21px 12px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<span style={{ fontSize: 16, fontWeight: 600, color: c.text }}>
								Match Analysis
							</span>
							<button
								onClick={() => setScorePanel(false)}
								style={{
									width: 34,
									height: 34,
									borderRadius: 6,
									border: 'none',
									background: 'transparent',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<PanelRightClose size={18} color={c.dim} strokeWidth={1.75} />
							</button>
						</div>
						<TruthPanel
							formData={formData}
							selectedJob={selectedJob ?? null}
							theme={c}
							refetchKey={matchRefetchKey}
							onGenerateCoverLetter={() => {
								setHasTakenAction(true)
								handleGenerateCoverLetter()
							}}
							onMatchLoaded={() => setHasReviewedMatch(true)}
							onBulletsGenerated={(changes, gaps, summary) => {
								setHasTakenAction(true)
								const snapshot = structuredClone(formData)
								const highlightIds: string[] = []

								// Build per-bullet undo map
								const undoMap = new Map(bulletUndoMapRef.current)
								for (const change of changes) {
									const undoId = change.action === 'rewrite' && change.existingBulletId
										? change.existingBulletId
										: change.descriptionId
									undoMap.set(undoId, {
										action: change.action,
										experienceId: change.experienceId,
										originalText: change.originalText,
									})
								}
								bulletUndoMapRef.current = undoMap

								// Build updated formData outside the setter so we can save it
								const next = { ...formData, experiences: [...(formData.experiences ?? [])] }
								if (summary) {
									next.about = summary
								}
								for (const change of changes) {
									const expIdx = next.experiences!.findIndex(e => e.id === change.experienceId)
									if (expIdx === -1) {
										console.warn('Bullet skipped — no experience with id:', change.experienceId, 'Available:', next.experiences!.map(e => e.id))
										continue
									}
									const exp = { ...next.experiences![expIdx] }

									if (change.action === 'rewrite' && change.existingBulletId) {
										exp.descriptions = (exp.descriptions ?? []).map(d =>
											d.id === change.existingBulletId
												? { ...d, content: change.content }
												: d,
										)
										highlightIds.push(change.existingBulletId)
									} else {
										exp.descriptions = [
											...(exp.descriptions ?? []),
											{ id: change.descriptionId, content: change.content },
										]
										highlightIds.push(change.descriptionId)
									}
									next.experiences![expIdx] = exp
								}

								// Force iframe to accept the new HTML even if user is mid-edit
								iframeComponentRef.current?.markStructuralUpdate()
								setFormData(next)
								debouncedSave(next)

								// Queue highlights — the effect will apply them after formData settles
								setPendingHighlights(highlightIds)

								undoSnapshotRef.current = snapshot
								toast({
									title: `Updated ${changes.length} bullet${changes.length > 1 ? 's' : ''}${summary ? ' + summary' : ''}`,
									description: 'See changes highlighted on your resume.',
								})
								setMatchRefetchKey(k => k + 1)
							}}
							onUndoBullets={undoSnapshotRef.current ? () => {
								if (undoSnapshotRef.current) {
									setFormData(undoSnapshotRef.current)
									debouncedSave(undoSnapshotRef.current)
									undoSnapshotRef.current = null
									iframeComponentRef.current?.clearHighlights()
									setMatchRefetchKey(k => k + 1)
								}
							} : undefined}
							onSkipRole={() => {
								setSelectedJob(null)
							}}
							onDownload={handleDownloadPDF}
							onNextJob={() => {
								setSelectedJob(null)
								setShowCreateJob(true)
							}}
							hasCoverLetter={!!coverLetterText}
						/>
						{coverLetterOpen && (
							<CoverLetterPanel
								open={coverLetterOpen}
								onClose={() => setCoverLetterOpen(false)}
								formData={formData}
								selectedJob={selectedJob ?? null}
								theme={c}
								coverLetterText={coverLetterText}
								onTextChange={handleCoverLetterTextChange}
								onRegenerate={handleGenerateCoverLetter}
								isGenerating={isGeneratingCoverLetter}
							/>
						)}
					</div>
				)}
			</div>

			{/* ═══ COMMAND PALETTE ═══ */}
			{showCommandPalette && (
				<Backdrop onClick={() => setShowCommandPalette(false)}>
					<div
						onClick={e => e.stopPropagation()}
						style={{
							width: 480,
							maxWidth: '90vw',
							background: c.bgEl,
							borderRadius: 12,
							border: `1px solid ${c.border}`,
							boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
							overflow: 'hidden',
						}}
					>
						<div
							style={{
								padding: '12px 16px',
								borderBottom: `1px solid ${c.border}`,
								display: 'flex',
								alignItems: 'center',
								gap: 10,
							}}
						>
							<Search size={16} color={c.dim} strokeWidth={1.75} />
							<input
								autoFocus
								value={cmdSearch}
								onChange={e => {
									setCmdSearch(e.target.value)
									setCmdSelected(0)
								}}
								onKeyDown={e => {
									if (e.key === 'ArrowDown') {
										e.preventDefault()
										setCmdSelected(s =>
											Math.min(s + 1, filteredCommands.length - 1),
										)
									}
									if (e.key === 'ArrowUp') {
										e.preventDefault()
										setCmdSelected(s => Math.max(s - 1, 0))
									}
									if (e.key === 'Enter' && filteredCommands[cmdSelected]) {
										setShowCommandPalette(false)
										filteredCommands[cmdSelected].action()
									}
								}}
								placeholder="Type a command..."
								style={{
									flex: 1,
									border: 'none',
									outline: 'none',
									background: 'transparent',
									fontSize: 14,
									color: c.text,
									fontFamily: 'Nunito Sans,system-ui',
								}}
							/>
							<span
								style={{
									fontSize: 10,
									color: c.dim,
									background: c.bgSurf,
									border: `1px solid ${c.borderSub}`,
									borderRadius: 3,
									padding: '2px 6px',
								}}
							>
								esc
							</span>
						</div>
						<div style={{ maxHeight: 320, overflow: 'auto', padding: '6px 0' }}>
							{filteredCommands.map((cmd, i) => (
								<div
									key={cmd.id}
									onClick={() => {
										setShowCommandPalette(false)
										cmd.action()
									}}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 12,
										padding: '10px 16px',
										cursor: 'pointer',
										background:
											i === cmdSelected ? `${BRAND}12` : 'transparent',
										borderLeft:
											i === cmdSelected
												? `2px solid ${BRAND}`
												: '2px solid transparent',
									}}
									onMouseEnter={() => setCmdSelected(i)}
								>
									<cmd.icon
										size={16}
										color={i === cmdSelected ? c.brandText : c.dim}
										strokeWidth={1.75}
									/>
									<span
										style={{
											flex: 1,
											fontSize: 13,
											color: i === cmdSelected ? c.text : c.muted,
											fontWeight: i === cmdSelected ? 500 : 400,
										}}
									>
										{cmd.label}
									</span>
								</div>
							))}
							{filteredCommands.length === 0 && (
								<div
									style={{
										padding: '20px 16px',
										textAlign: 'center',
										color: c.dim,
										fontSize: 13,
									}}
								>
									No commands found
								</div>
							)}
						</div>
					</div>
				</Backdrop>
			)}

			{/* ═══ TEMPLATE GALLERY SLIDE-OVER ═══ */}
			<SlideOver
				open={showTemplateGallery}
				onClose={() => setShowTemplateGallery(false)}
				title="Customize"
				c={c}
			>
				{/* Template Picker */}
				<div style={{ marginBottom: 24 }}>
					<span
						style={{
							fontSize: 11,
							fontWeight: 600,
							color: c.dim,
							textTransform: 'uppercase',
							letterSpacing: '0.04em',
						}}
					>
						Template
					</span>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
						{TEMPLATE_META.map(t => {
							const isActive = formData.layout === t.id || (!formData.layout && t.id === 'simple') || (formData.layout === 'traditional' && t.id === 'simple')
							const accent = t.defaultAccent
							return (
								<button
									key={t.id}
									onClick={() => applyTemplate(t.id)}
									aria-label={`${t.name} template`}
									aria-pressed={isActive}
									style={{
										padding: 0,
										borderRadius: 8,
										cursor: 'pointer',
										background: isActive ? `${BRAND}08` : c.bg,
										border: `2px solid ${isActive ? BRAND : c.border}`,
										boxShadow: isActive ? `0 0 0 1px ${BRAND}30` : 'none',
										transition: 'all 150ms',
										overflow: 'hidden',
									}}
								>
									{/* Mini preview SVG */}
									<div style={{ padding: '10px 10px 6px', background: c.bg }}>
										<svg viewBox="0 0 80 100" width="100%" style={{ display: 'block' }}>
											{t.id === 'slate' && (
												<>
													{/* Bold name */}
													<rect x="4" y="6" width="36" height="5" rx="1" fill={accent} />
													{/* Pipe-separated headline bar */}
													<line x1="4" y1="15" x2="76" y2="15" stroke="#ddd" strokeWidth="0.5" />
													<rect x="4" y="17" width="14" height="2.5" rx="0.5" fill="#999" />
													<text x="20" y="19.5" fontSize="3" fill="#ccc">|</text>
													<rect x="23" y="17" width="18" height="2.5" rx="0.5" fill="#999" />
													<text x="43" y="19.5" fontSize="3" fill="#ccc">|</text>
													<rect x="46" y="17" width="12" height="2.5" rx="0.5" fill="#999" />
													<line x1="4" y1="22" x2="76" y2="22" stroke="#ddd" strokeWidth="0.5" />
													{/* Section header - thin rule */}
													<rect x="4" y="28" width="22" height="2.5" rx="0.5" fill="#333" />
													<line x1="4" y1="33" x2="76" y2="33" stroke="#e5e5e5" strokeWidth="0.5" />
													{/* Disc bullets */}
													<circle cx="8" cy="38" r="1.2" fill="#333" />
													<rect x="12" y="36.5" width="50" height="2.5" rx="0.5" fill="#ddd" />
													<circle cx="8" cy="44" r="1.2" fill="#333" />
													<rect x="12" y="42.5" width="42" height="2.5" rx="0.5" fill="#ddd" />
													{/* Skills grid */}
													<rect x="4" y="54" width="22" height="2.5" rx="0.5" fill="#333" />
													<line x1="4" y1="59" x2="76" y2="59" stroke="#e5e5e5" strokeWidth="0.5" />
													<rect x="4" y="63" width="16" height="6" rx="1" fill="#f0f0f0" />
													<rect x="23" y="63" width="20" height="6" rx="1" fill="#f0f0f0" />
													<rect x="46" y="63" width="14" height="6" rx="1" fill="#f0f0f0" />
													<rect x="4" y="72" width="18" height="6" rx="1" fill="#f0f0f0" />
													<rect x="25" y="72" width="16" height="6" rx="1" fill="#f0f0f0" />
												</>
											)}
											{t.id === 'warm' && (
												<>
													{/* Sand accent band */}
													<rect x="0" y="0" width="80" height="28" fill="#f5f0eb" />
													{/* Italic serif name */}
													<rect x="4" y="6" width="40" height="6" rx="1" fill={accent} opacity="0.9" />
													{/* Role + contact */}
													<rect x="4" y="15" width="24" height="2.5" rx="0.5" fill="#888" />
													<rect x="4" y="20" width="36" height="2" rx="0.5" fill="#aaa" />
													{/* Section header - serif style */}
													<rect x="4" y="34" width="26" height="3" rx="0.5" fill={accent} />
													<line x1="4" y1="39.5" x2="50" y2="39.5" stroke={accent} strokeWidth="0.5" opacity="0.4" />
													{/* Job anchor rule + triangle bullets */}
													<rect x="4" y="44" width="30" height="2.5" rx="0.5" fill="#333" />
													<rect x="50" y="44" width="18" height="2" rx="0.5" fill="#999" />
													<text x="6" y="53" fontSize="4" fill={accent}>▸</text>
													<rect x="12" y="50" width="52" height="2.5" rx="0.5" fill="#ddd" />
													<text x="6" y="59" fontSize="4" fill={accent}>▸</text>
													<rect x="12" y="56" width="44" height="2.5" rx="0.5" fill="#ddd" />
													{/* Em-dash skills */}
													<rect x="4" y="68" width="26" height="3" rx="0.5" fill={accent} />
													<line x1="4" y1="73.5" x2="50" y2="73.5" stroke={accent} strokeWidth="0.5" opacity="0.4" />
													<rect x="4" y="77" width="60" height="2.5" rx="0.5" fill="#ccc" />
												</>
											)}
											{t.id === 'editorial' && (
												<>
													{/* Centered header */}
													<rect x="18" y="6" width="44" height="6" rx="1" fill={accent} />
													{/* Italic role - centered */}
													<rect x="24" y="15" width="32" height="2.5" rx="0.5" fill="#888" />
													{/* Centered contact */}
													<rect x="20" y="20" width="40" height="2" rx="0.5" fill="#aaa" />
													{/* Left vertical rule */}
													<line x1="8" y1="30" x2="8" y2="95" stroke={accent} strokeWidth="1.5" opacity="0.15" />
													{/* Section header - italic, no border */}
													<rect x="14" y="32" width="24" height="2.5" rx="0.5" fill={accent} />
													{/* Square bullets */}
													<rect x="14" y="39" width="2" height="2" fill="#333" />
													<rect x="19" y="39" width="48" height="2.5" rx="0.5" fill="#ddd" />
													<rect x="14" y="45" width="2" height="2" fill="#333" />
													<rect x="19" y="45" width="40" height="2.5" rx="0.5" fill="#ddd" />
													{/* Job divider */}
													<line x1="14" y1="53" x2="72" y2="53" stroke="#eee" strokeWidth="0.5" />
													{/* Another entry */}
													<rect x="14" y="57" width="28" height="2.5" rx="0.5" fill="#333" />
													<rect x="14" y="63" width="2" height="2" fill="#333" />
													<rect x="19" y="63" width="44" height="2.5" rx="0.5" fill="#ddd" />
													<rect x="14" y="69" width="2" height="2" fill="#333" />
													<rect x="19" y="69" width="36" height="2.5" rx="0.5" fill="#ddd" />
												</>
											)}
											{t.id === 'modernist' && (
												<>
													{/* Bold name - stark */}
													<rect x="12" y="6" width="38" height="5" rx="1" fill="#111" />
													{/* Contact line */}
													<rect x="12" y="14" width="50" height="2" rx="0.5" fill="#888" />
													{/* Bold 3px rule */}
													<rect x="12" y="20" width="56" height="2" fill={accent} />
													{/* Outdented section label */}
													<rect x="2" y="28" width="18" height="2" rx="0.5" fill={accent} />
													{/* Content indented */}
													<rect x="12" y="34" width="28" height="2.5" rx="0.5" fill="#333" />
													<rect x="52" y="34" width="16" height="2" rx="0.5" fill="#999" style={{ fontStyle: 'italic' }} />
													{/* Square bullets */}
													<rect x="14" y="40" width="1.8" height="1.8" fill="#333" />
													<rect x="19" y="40" width="46" height="2.5" rx="0.5" fill="#ddd" />
													<rect x="14" y="46" width="1.8" height="1.8" fill="#333" />
													<rect x="19" y="46" width="38" height="2.5" rx="0.5" fill="#ddd" />
													{/* Another outdented label */}
													<rect x="2" y="56" width="14" height="2" rx="0.5" fill={accent} />
													<rect x="12" y="62" width="30" height="2.5" rx="0.5" fill="#333" />
													<rect x="12" y="68" width="24" height="2" rx="0.5" fill="#999" />
												</>
											)}
											{t.id === 'simple' && (
												<>
													{/* Bold name with accent */}
													<rect x="4" y="6" width="34" height="5" rx="1" fill={accent || '#111'} />
													{/* Role */}
													<rect x="4" y="14" width="20" height="2.5" rx="0.5" fill="#666" />
													{/* Contact dots */}
													<rect x="4" y="19" width="40" height="2" rx="0.5" fill="#aaa" />
													{/* Section header with accent underline */}
													<rect x="4" y="28" width="24" height="2.5" rx="0.5" fill={accent || '#111'} />
													<line x1="4" y1="33" x2="76" y2="33" stroke={accent || '#111'} strokeWidth="1" />
													{/* Disc bullets */}
													<circle cx="8" cy="39" r="1.2" fill="#333" />
													<rect x="12" y="37.5" width="52" height="2.5" rx="0.5" fill="#ddd" />
													<circle cx="8" cy="45" r="1.2" fill="#333" />
													<rect x="12" y="43.5" width="44" height="2.5" rx="0.5" fill="#ddd" />
													<circle cx="8" cy="51" r="1.2" fill="#333" />
													<rect x="12" y="49.5" width="48" height="2.5" rx="0.5" fill="#ddd" />
													{/* Education */}
													<rect x="4" y="60" width="24" height="2.5" rx="0.5" fill={accent || '#111'} />
													<line x1="4" y1="65" x2="76" y2="65" stroke={accent || '#111'} strokeWidth="1" />
													<rect x="4" y="69" width="30" height="2.5" rx="0.5" fill="#333" />
													<rect x="4" y="74" width="22" height="2" rx="0.5" fill="#888" />
												</>
											)}
										</svg>
									</div>
									{/* Label */}
									<div style={{
										padding: '4px 8px 8px',
										fontSize: 11,
										fontWeight: isActive ? 600 : 500,
										color: isActive ? c.brandText : c.text,
										textAlign: 'center',
									}}>
										{t.name}
									</div>
								</button>
							)
						})}
					</div>
				</div>

				{/* Accent Color */}
				<div style={{ marginBottom: 20 }}>
					<span
						style={{
							fontSize: 11,
							fontWeight: 600,
							color: c.dim,
							textTransform: 'uppercase',
							letterSpacing: '0.04em',
						}}
					>
						Accent Color
					</span>
					<div
						style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
					>
						{COLOR_PALETTE.map(color => (
							<button
								key={color.id}
								onClick={() => applyAccentColor(color.hex)}
								aria-label={color.name}
								aria-pressed={formData.nameColor === color.hex}
								style={{
									width: 28,
									height: 28,
									borderRadius: '50%',
									background: color.hex,
									cursor: 'pointer',
									border:
										formData.nameColor === color.hex
											? `2px solid ${c.text}`
											: '2px solid transparent',
									boxShadow:
										formData.nameColor === color.hex
											? `0 0 0 2px ${color.hex}40`
											: 'none',
									transition: 'all 150ms',
									padding: 0,
								}}
							/>
						))}
					</div>
				</div>

				{/* Font Pairing Picker */}
				<div>
					<span
						style={{
							fontSize: 11,
							fontWeight: 600,
							color: c.dim,
							textTransform: 'uppercase',
							letterSpacing: '0.04em',
						}}
					>
						Font
					</span>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 4,
							marginTop: 10,
						}}
					>
						{VISIBLE_PAIRINGS.map(p => {
							const isActive = formData.font === p.id
							return (
								<button
									key={p.id}
									onClick={() => applyFont(p.id)}
									aria-label={`${p.label} font`}
									aria-pressed={isActive}
									style={{
										padding: '8px 12px',
										borderRadius: 6,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										background: isActive ? `${BRAND}12` : 'transparent',
										border: `1px solid ${isActive ? BRAND + '40' : 'transparent'}`,
										textAlign: 'left',
									}}
								>
									<span
										style={{
											fontSize: 13,
											color: isActive ? c.brandText : c.text,
											fontFamily: p.headingFamily,
										}}
									>
										{p.label}
									</span>
									{isActive && (
										<Check size={14} color={c.brandText} strokeWidth={2} />
									)}
								</button>
							)
						})}
					</div>
				</div>

				{/* Text Size */}
				<div style={{ marginTop: 20 }}>
					<span
						style={{
							fontSize: 11,
							fontWeight: 600,
							color: c.dim,
							textTransform: 'uppercase',
							letterSpacing: '0.04em',
						}}
					>
						Text Size
					</span>
					<div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
						{(['small', 'medium', 'large'] as const).map(size => (
							<button
								key={size}
								onClick={() => {
									setFormData(prev => {
										const next = { ...prev, textSize: size }
										debouncedSave(next)
										return next
									})
								}}
								style={{
									flex: 1,
									padding: '8px 12px',
									borderRadius: 6,
									cursor: 'pointer',
									textAlign: 'center',
									background:
										formData.textSize === size ? `${BRAND}12` : 'transparent',
									border: `1px solid ${
										formData.textSize === size ? BRAND + '40' : c.border
									}`,
									fontSize: 12,
									color: formData.textSize === size ? c.brandText : c.text,
									fontWeight: 500,
									textTransform: 'capitalize' as const,
								}}
							>
								{size}
							</button>
						))}
					</div>
				</div>
			</SlideOver>

			{/* ═══ ONBOARDING WIDGET ═══ */}
			<OnboardingWidget
				isComplete={onboarding.isComplete}
				dismissed={onboardingDismissed}
				collapsed={onboardingCollapsed}
				setDismissed={setOnboardingDismissed}
				setCollapsed={setOnboardingCollapsed}
				hasResume={!!(formData.name || formData.role)}
				hasJob={!!selectedJob}
				hasReviewedMatch={hasReviewedMatch}
				hasTakenAction={hasTakenAction}
				onResumeClick={() => scrollToSection('summary')}
				onJobClick={() => setShowCreateJob(true)}
				c={c}
			/>
		</div>
	)
}
