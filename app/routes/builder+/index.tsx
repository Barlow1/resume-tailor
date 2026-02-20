import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import {
	useLoaderData,
	useFetcher,
	useNavigate,
	useSubmit,
	Form,
	Link,
} from '@remix-run/react'
import { useOptionalUser } from '~/utils/user.ts'
import { getUserImgSrc } from '~/utils/misc.ts'
import { useTheme } from '~/routes/resources+/theme/index.tsx'
import {
	ChevronDown,
	Search,
	Sun,
	Moon,
	Sparkles,
	Download,
	LayoutTemplate,
	Check,
	X,
	Plus,
	Minus,
	Briefcase,
	GraduationCap,
	Code2,
	AlignLeft,
	Target,
	TrendingUp,
	Zap,
	ArrowRight,
	CheckCircle2,
	Circle,
	PanelLeftClose,
	PanelRightClose,
	Palette,
	Eye,
	EyeOff,
	ChevronRight,
	Rocket,
	LogOut,
	User as UserIcon,
	CreditCard,
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
import { useResumeScore } from '~/hooks/use-resume-score.ts'
import {
	type ChecklistItem,
	type KeywordMatch,
} from '~/utils/resume-scoring.ts'
import { parseTieredKeywords } from '~/utils/keyword-utils.ts'
import { trackEvent } from '~/utils/analytics.ts'
import { trackEvent as trackLegacyEvent } from '~/utils/tracking.client.ts'
import { track } from '~/lib/analytics.client.ts'
import { toast } from '~/components/ui/use-toast.ts'
import { useOnboardingFlow } from '~/hooks/use-onboarding-flow.ts'
import { JobPasteModal } from '~/components/job-paste-modal.tsx'

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
const WARN = '#F76B15'
const ERROR = '#E5484D'
const AMBER = '#F5D90A'

const lightTheme = {
	bg: '#FAFAFA',
	bgEl: '#FFFFFF',
	bgSurf: '#F4F4F5',
	border: '#E0E0E6',
	borderSub: '#EBEBEF',
	text: '#111113',
	muted: '#63636A',
	dim: '#9C9CA3',
	canvas: '#E8E8EC',
	white: '#FFFFFF',
}
const darkTheme = {
	bg: '#111113',
	bgEl: '#18181B',
	bgSurf: '#1E1E22',
	border: '#2B2B31',
	borderSub: '#222228',
	text: '#ECECEE',
	muted: '#8B8B8F',
	dim: '#636366',
	canvas: '#0C0C0E',
	white: '#FFFFFF',
}
type Theme = typeof lightTheme

const tiers = [
	{ min: 0, max: 25, color: ERROR, label: 'Needs work' },
	{ min: 26, max: 50, color: WARN, label: 'Getting there' },
	{ min: 51, max: 70, color: AMBER, label: 'Good' },
	{ min: 71, max: 85, color: SUCCESS, label: 'Great match' },
	{ min: 86, max: 100, color: BRAND, label: 'Excellent' },
]
const getTier = (s: number) =>
	tiers.find(t => s >= t.min && s <= t.max) || tiers[0]
const scoreMsg = (s: number) =>
	s <= 25
		? 'Your resume is off to a start. Here are 3 quick wins.'
		: s <= 50
		? "You're building momentum. A few targeted changes will make a big difference."
		: s <= 70
		? "Looking good. Let's sharpen it for this specific role."
		: s <= 85
		? 'Strong resume. Fine-tune these details to really stand out.'
		: 'Your resume is in great shape. Apply with confidence.'

/* ═══ FONT / TEMPLATE OPTIONS ═══ */
const FONT_OPTIONS = [
	{
		value: 'font-crimson',
		label: 'Crimson Pro',
		family: 'Crimson Pro, Georgia, serif',
	},
	{
		value: 'font-sans',
		label: 'Arial',
		family: 'Arial, Helvetica, sans-serif',
	},
	{
		value: 'font-serif',
		label: 'Georgia',
		family: 'Georgia, "Times New Roman", serif',
	},
	{
		value: 'font-mono',
		label: 'Courier',
		family: '"Courier New", Courier, monospace',
	},
	{
		value: 'font-garamond',
		label: 'Garamond',
		family: 'Garamond, "Times New Roman", serif',
	},
	{
		value: 'font-trebuchet',
		label: 'Trebuchet',
		family: '"Trebuchet MS", Helvetica, sans-serif',
	},
	{
		value: 'font-verdana',
		label: 'Verdana',
		family: 'Verdana, Geneva, sans-serif',
	},
]
const ACCENT_COLORS = [
	'#6B45FF',
	'#2563EB',
	'#059669',
	'#E11D48',
	'#F76B15',
	'#7C3AED',
	'#111113',
	'#1E3A5F',
]
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

/* ═══ SCORE ARC ═══ */
function ScoreArc({
	score,
	size = 148,
	onClick,
	c,
}: {
	score: number
	size?: number
	onClick?: () => void
	c: Theme
}) {
	const [a, setA] = useState(0)
	const t = getTier(score)
	useEffect(() => {
		let s: number | null = null
		const ease = (t: number) =>
			t === 0
				? 0
				: t === 1
				? 1
				: Math.pow(2, -10 * t) *
						Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) +
				  1
		const f = (ts: number) => {
			if (!s) s = ts
			const p = Math.min((ts - s) / 1200, 1)
			setA(ease(p) * score)
			if (p < 1) requestAnimationFrame(f)
		}
		setA(0)
		requestAnimationFrame(f)
	}, [score])
	const r = 54,
		cx = 64,
		cy = 64,
		sw = 8,
		sA = -220,
		eA = 40,
		rng = eA - sA,
		fA = sA + (rng * a) / 100,
		toR = (d: number) => (d * Math.PI) / 180
	const arc = (s: number, e: number) => {
		const p1 = { x: cx + r * Math.cos(toR(s)), y: cy + r * Math.sin(toR(s)) },
			p2 = { x: cx + r * Math.cos(toR(e)), y: cy + r * Math.sin(toR(e)) }
		return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${p2.x} ${
			p2.y
		}`
	}
	return (
		<div
			onClick={onClick}
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				padding: '16px 0 8px',
				cursor: onClick ? 'pointer' : 'default',
			}}
		>
			<svg width={size} height={size * 0.78} viewBox="0 0 128 100">
				<path
					d={arc(sA, eA)}
					fill="none"
					stroke={c.border}
					strokeWidth={sw}
					strokeLinecap="round"
				/>
				<path
					d={arc(sA, fA)}
					fill="none"
					stroke={t.color}
					strokeWidth={sw}
					strokeLinecap="round"
					style={{ filter: `drop-shadow(0 0 6px ${t.color}44)` }}
				/>
				<text
					x={cx}
					y={cy - 2}
					textAnchor="middle"
					fill={c.text}
					fontSize="34"
					fontWeight="600"
					fontFamily="Nunito Sans,system-ui"
				>
					{Math.round(a)}
				</text>
				<text
					x={cx}
					y={cy + 16}
					textAnchor="middle"
					fill={c.muted}
					fontSize="14"
					fontFamily="Nunito Sans,system-ui"
				>
					/ 100
				</text>
			</svg>
			<span
				style={{ fontSize: 16, fontWeight: 600, color: t.color, marginTop: -4 }}
			>
				{t.label}
			</span>
		</div>
	)
}

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
	const [keywordPopover, setKeywordPopover] = useState<{
		keyword: string
		status: 'missing' | 'partial'
		anchorRect: DOMRect
	} | null>(null)
	const [selectedJob, setSelectedJob] = useState<BuilderJob | null | undefined>(
		formData.job,
	)
	const [downloadClicked, setDownloadClicked] = useState(false)
	const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER)
	const [showScoreDetail, setShowScoreDetail] = useState(false)
	const [showTemplateGallery, setShowTemplateGallery] = useState(false)
	const [showCommandPalette, setShowCommandPalette] = useState(false)
	const [showAllResumes, setShowAllResumes] = useState(false)
	const [cmdSearch, setCmdSearch] = useState('')
	const [cmdSelected, setCmdSelected] = useState(0)
	const [onboardingDismissed, setOnboardingDismissed] = useState(false)
	const [onboardingCollapsed, setOnboardingCollapsed] = useState(false)
	const [editingResumeId, setEditingResumeId] = useState<string | null>(null)
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

	/* ═══ SAVE ═══ */
	const fetcher = useFetcher<{ success: boolean; error?: string }>()
	const pdfFetcher = useFetcher<{ fileData: string; fileType: string }>()
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

	/* ═══ SCORING ═══ */
	const tieredKeywords = parseTieredKeywords(
		formData.job?.extractedKeywords ?? null,
	)
	const extractedKeywords = tieredKeywords?.all ?? null
	const primaryKeywords = tieredKeywords?.primary ?? null

	const { scores, checklist } = useResumeScore({
		resumeData: formData,
		jobDescription: formData.job?.content ?? undefined,
		extractedKeywords,
		primaryKeywords,
		debounceMs: 500,
	})

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

	/* ═══ EDIT HANDLERS ═══ */
	const updateField = (field: string, val: string) => {
		const newFormData = { ...formData, [field]: val }
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const updateExpField = (
		expId: string,
		field: keyof BuilderExperience,
		val: string,
	) => {
		if (!formData.experiences) return
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp =>
				exp.id === expId ? { ...exp, [field]: val } : exp,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const updateBullet = (expId: string, bulletIndex: number, val: string) => {
		if (!formData.experiences) return
		const newFormData = {
			...formData,
			experiences: formData.experiences.map(exp => {
				if (exp.id !== expId || !exp.descriptions) return exp
				return {
					...exp,
					descriptions: exp.descriptions.map((b, i) =>
						i === bulletIndex ? { id: b.id, content: val } : b,
					),
				}
			}),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
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
		if (!formData.education) return
		const newFormData = {
			...formData,
			education: formData.education.map(edu =>
				edu.id === eduId ? { ...edu, [field]: val } : edu,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const updateSkill = (skillId: string, val: string) => {
		if (!formData.skills) return
		const newFormData = {
			...formData,
			skills: formData.skills.map(s =>
				s.id === skillId ? { ...s, name: val } : s,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
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
		if (!formData.hobbies) return
		const newFormData = {
			...formData,
			hobbies: formData.hobbies.map(h =>
				h.id === hobbyId ? { ...h, name: val } : h,
			),
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
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

	const handleJobChange = useCallback(
		(job: any) => {
			setSelectedJob(job)
			const newFormData = {
				...formData,
				jobId: job?.id ?? null,
				job: job ?? null,
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
			trackLegacyEvent('job_selected', {
				jobId: job?.id,
				hasJobDescription: !!(job?.content && job.content.trim().length > 0),
				userId,
				category: 'Resume Builder',
			})
			// Auto-extract keywords if job has content but no extracted keywords
			if (job?.id && job?.content?.trim() && !job.extractedKeywords) {
				keywordExtractFetcher.submit(
					{ jobId: job.id },
					{ method: 'POST', action: '/resources/extract-keywords' },
				)
			}
		},
		[formData, debouncedSave, userId, keywordExtractFetcher],
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

	const handleKeywordRolePick = (experience: BuilderExperience) => {
		const keyword = keywordPopover?.keyword
		setKeywordPopover(null)
		if (!keyword || !experience.id) return
		setSelectedExperience(experience)
		setSelectedBullet({
			content: '',
			experienceId: experience.id,
			bulletIndex: -1,
		})
		setDiagnosticContext({
			issueType: 'missing-keywords',
			reason: `Incorporate the keyword "${keyword}" naturally into this achievement`,
			missingKeywords: [keyword],
		})
		setAiModalInitialTab('tailor')
		setShowAIModal(true)
	}

	const handleKeywordAddToSkills = () => {
		const keyword = keywordPopover?.keyword
		setKeywordPopover(null)
		if (!keyword || !formData.skills) return
		const capitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1)
		const alreadyExists = formData.skills.some(s =>
			(s.name || '').toLowerCase().includes(keyword.toLowerCase()),
		)
		if (alreadyExists) return
		// Append to the last skill entry with a comma
		const lastIdx = formData.skills.length - 1
		if (lastIdx >= 0 && formData.skills[lastIdx].name?.trim()) {
			const updatedSkills = formData.skills.map((s, i) =>
				i === lastIdx ? { ...s, name: `${s.name}, ${capitalized}` } : s,
			)
			const newFormData = { ...formData, skills: updatedSkills }
			setFormData(newFormData)
			debouncedSave(newFormData)
		} else {
			// No existing skills with content — create a new entry
			const newFormData = {
				...formData,
				skills: [
					...formData.skills,
					{ id: crypto.randomUUID(), name: capitalized },
				],
			}
			setFormData(newFormData)
			debouncedSave(newFormData)
		}
	}

	const handleChecklistFix = (item: ChecklistItem) => {
		if (!item.flaggedBullets || item.flaggedBullets.length === 0) return

		// Highlight all flagged bullets
		const bulletKeys = new Set(
			item.flaggedBullets.map(b => `${b.experienceId}_${b.bulletIndex}`),
		)
		setHighlightedBullets(bulletKeys)

		// Open AI modal on the first flagged bullet
		const first = item.flaggedBullets[0]
		const issueType: DiagnosticContext['issueType'] =
			item.id === 'metrics' || item.id === 'metrics-good'
				? 'no-metrics'
				: item.id === 'action-verbs' || item.id === 'action-verbs-good'
				? 'weak-verb'
				: 'missing-keywords'

		handleAIClick(first.experienceId, first.bulletIndex, first.content, {
			issueType,
			reason: first.reason,
			missingKeywords: item.missingKeywords,
		})
	}

	const handleBulletUpdate = (newContent: string) => {
		if (!selectedBullet) return
		if (selectedBullet.bulletIndex === -1) {
			// Append new bullet to the experience
			const newFormData = {
				...formData,
				experiences: (formData.experiences ?? []).map(exp =>
					exp.id === selectedBullet.experienceId
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
		} else {
			updateBullet(
				selectedBullet.experienceId,
				selectedBullet.bulletIndex,
				newContent,
			)
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
									{ content: firstBullet },
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
		hasTailored: (gettingStartedProgress?.tailorCount ?? 0) > 0,
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
	}, [formData.name, pdfFetcher.data, pdfFetcher.state])

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
				label: 'View Score Details',
				icon: Target,
				action: () => setShowScoreDetail(true),
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

	const handleStartScratch = () => {
		const blank = getDefaultFormData() as typeof formData
		setFormData(blank)
		setSelectedJob(null)
		debouncedSave(blank)
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
		const newFormData = {
			...formData,
			headers: {
				...formData.headers,
				[headerKey]: val,
			} as typeof formData.headers,
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
	}

	const toggleSectionVisibility = (visKey: string) => {
		const current =
			formData.visibleSections?.[
				visKey as keyof typeof formData.visibleSections
			] ?? true
		const vs = formData.visibleSections ?? {
			about: true,
			experience: true,
			education: true,
			skills: true,
			hobbies: true,
			personalDetails: true,
			photo: true,
		}
		const newFormData = {
			...formData,
			visibleSections: { ...vs, [visKey]: !current },
		}
		setFormData(newFormData)
		debouncedSave(newFormData)
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
				setShowSubscribeModal={setShowSubscribeModal}
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

			{/* KEYWORD ROLE-PICKER POPOVER */}
			{keywordPopover && (
				<>
					<div
						onClick={() => setKeywordPopover(null)}
						style={{ position: 'fixed', inset: 0, zIndex: 90 }}
					/>
					<div
						style={{
							position: 'fixed',
							zIndex: 91,
							width: 280,
							...(keywordPopover.anchorRect.bottom + 250 > window.innerHeight
								? {
										bottom:
											window.innerHeight - keywordPopover.anchorRect.top + 6,
								  }
								: { top: keywordPopover.anchorRect.bottom + 6 }),
							left: Math.min(
								keywordPopover.anchorRect.left,
								window.innerWidth - 296,
							),
							background: c.bgEl,
							borderRadius: 10,
							border: `1px solid ${c.border}`,
							boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
							overflow: 'hidden',
						}}
					>
						<div
							style={{
								padding: '10px 14px',
								borderBottom: `1px solid ${c.border}`,
								display: 'flex',
								alignItems: 'center',
								gap: 8,
							}}
						>
							<Plus size={14} color={BRAND} strokeWidth={2.5} />
							<span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
								Add "
								<span style={{ color: BRAND }}>{keywordPopover.keyword}</span>"
							</span>
						</div>
						<div style={{ maxHeight: 240, overflow: 'auto' }}>
							{/* Add to Skills — instant, no AI */}
							<div
								onClick={handleKeywordAddToSkills}
								style={{
									padding: '10px 14px',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									gap: 10,
									transition: 'background 100ms',
									borderBottom: `1px solid ${c.border}`,
								}}
								onMouseEnter={e => {
									;(
										e.currentTarget as HTMLElement
									).style.background = `${BRAND}10`
								}}
								onMouseLeave={e => {
									;(e.currentTarget as HTMLElement).style.background =
										'transparent'
								}}
							>
								<Code2 size={14} color={BRAND} strokeWidth={1.75} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>
										Add to Skills
									</div>
									<div style={{ fontSize: 11, color: c.dim }}>
										Instant — no AI needed
									</div>
								</div>
								<Plus size={13} color={c.dim} strokeWidth={1.75} />
							</div>
							{/* Generate bullet for a role — AI */}
							{(formData.experiences ?? [])
								.filter(exp => exp.id)
								.map(exp => (
									<div
										key={exp.id}
										onClick={() => handleKeywordRolePick(exp)}
										style={{
											padding: '10px 14px',
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											gap: 10,
											transition: 'background 100ms',
										}}
										onMouseEnter={e => {
											;(
												e.currentTarget as HTMLElement
											).style.background = `${BRAND}10`
										}}
										onMouseLeave={e => {
											;(e.currentTarget as HTMLElement).style.background =
												'transparent'
										}}
									>
										<Briefcase size={14} color={c.dim} strokeWidth={1.75} />
										<div style={{ flex: 1, minWidth: 0 }}>
											<div
												style={{
													fontSize: 13,
													fontWeight: 500,
													color: c.text,
													whiteSpace: 'nowrap',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
												}}
											>
												{exp.role || 'Untitled Role'}
											</div>
											{exp.company && (
												<div
													style={{
														fontSize: 11,
														color: c.dim,
														whiteSpace: 'nowrap',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
													}}
												>
													{exp.company}
												</div>
											)}
										</div>
										<Sparkles size={13} color={c.dim} strokeWidth={1.75} />
									</div>
								))}
						</div>
					</div>
				</>
			)}

			{/* TOP BAR */}
			<div
				style={{
					height: 48,
					borderBottom: `1px solid ${c.border}`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '0 16px',
					flexShrink: 0,
					background: c.bgEl,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
					<Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
						<img
							src="/RT_Logo_stacked.png"
							alt="Resume Tailor"
							style={{ height: 28 }}
							className="dark:brightness-0 dark:invert"
						/>
					</Link>
				</div>
				{/* ⌘K Quick Actions */}
				<div
					onClick={() => {
						setShowCommandPalette(true)
						setCmdSearch('')
						setCmdSelected(0)
					}}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						padding: '5px 12px',
						borderRadius: 6,
						border: `1px solid ${c.border}`,
						background: c.bgSurf,
						cursor: 'pointer',
						minWidth: 200,
					}}
					onMouseEnter={e => {
						;(e.currentTarget as HTMLElement).style.borderColor = BRAND + '60'
					}}
					onMouseLeave={e => {
						;(e.currentTarget as HTMLElement).style.borderColor = c.border
					}}
				>
					<Search size={13} color={c.dim} strokeWidth={1.75} />
					<span style={{ fontSize: 12, color: c.dim, flex: 1 }}>
						Quick actions...
					</span>
					<span
						style={{
							fontSize: 10,
							color: c.dim,
							background: c.bgSurf,
							border: `1px solid ${c.borderSub}`,
							borderRadius: 3,
							padding: '1px 5px',
							fontFamily: 'system-ui',
						}}
					>
						⌘K
					</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<span
						style={{
							fontSize: 11,
							color:
								saveStatus === 'saving'
									? AMBER
									: saveStatus === 'saved'
									? SUCCESS
									: c.dim,
							display: 'flex',
							alignItems: 'center',
							gap: 4,
							transition: 'color 300ms',
						}}
					>
						<Check size={12} strokeWidth={2} />
						{saveStatus === 'saving'
							? 'Saving...'
							: saveStatus === 'saved'
							? 'Saved'
							: saveStatus === 'error'
							? 'Error'
							: ''}
					</span>
					<button
						onClick={() => setShowTemplateGallery(true)}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							padding: '5px 10px',
							borderRadius: 5,
							border: `1px solid ${c.border}`,
							background: 'transparent',
							color: c.muted,
							fontSize: 12,
							cursor: 'pointer',
						}}
					>
						<Palette size={14} color={c.dim} strokeWidth={1.75} />
						Customize
					</button>
					<button
						onClick={toggleDarkMode}
						style={{
							width: 32,
							height: 32,
							borderRadius: 6,
							border: 'none',
							background: 'transparent',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						{isDark ? (
							<Sun size={16} color={c.dim} strokeWidth={1.75} />
						) : (
							<Moon size={16} color={c.dim} strokeWidth={1.75} />
						)}
					</button>
					<div
						style={{
							width: 1,
							height: 20,
							background: c.border,
							margin: '0 4px',
						}}
					/>
					<button
						onClick={() => {
							setScorePanel(!scorePanel)
						}}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 5,
							padding: '5px 10px',
							borderRadius: 5,
							border: `1px solid ${c.border}`,
							background: 'transparent',
							color: c.muted,
							fontSize: 12,
							cursor: 'pointer',
						}}
					>
						<Target size={14} color={c.dim} strokeWidth={1.75} />
						<span
							style={{ color: getTier(scores.overall).color, fontWeight: 600 }}
						>
							{scores.overall}
						</span>
					</button>
					<button
						onClick={handleClickDownloadPDF}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							padding: '6px 14px',
							borderRadius: 5,
							border: 'none',
							background: BRAND,
							color: '#fff',
							fontSize: 13,
							fontWeight: 500,
							cursor: 'pointer',
						}}
					>
						<Download size={14} strokeWidth={2} />
						Download Resume
					</button>
					{user ? (
						<div ref={profileRef} style={{ position: 'relative' }}>
							<button
								onClick={() => setProfileOpen(!profileOpen)}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									padding: '4px 10px 4px 4px',
									borderRadius: 6,
									border: `1px solid ${c.border}`,
									background: 'transparent',
									cursor: 'pointer',
									color: c.text,
									fontSize: 13,
									fontWeight: 500,
								}}
							>
								<img
									src={getUserImgSrc(user.imageId)}
									alt={user.name ?? user.username}
									style={{
										width: 28,
										height: 28,
										borderRadius: '50%',
										objectFit: 'cover' as const,
									}}
								/>
								<span
									style={{
										maxWidth: 120,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap' as const,
									}}
								>
									{user.name ?? user.username}
								</span>
								<ChevronDown size={12} color={c.dim} />
							</button>
							{profileOpen && (
								<div
									style={{
										position: 'absolute',
										top: '100%',
										right: 0,
										marginTop: 4,
										width: 200,
										background: c.bgEl,
										border: `1px solid ${c.border}`,
										borderRadius: 8,
										boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
										zIndex: 250,
										overflow: 'hidden',
										padding: '4px 0',
									}}
								>
									<Link
										to={`/users/${user.username}`}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 8,
											padding: '8px 12px',
											color: c.text,
											fontSize: 13,
											textDecoration: 'none',
											cursor: 'pointer',
										}}
										onMouseEnter={e => {
											;(e.currentTarget as HTMLElement).style.background =
												c.bgSurf
										}}
										onMouseLeave={e => {
											;(e.currentTarget as HTMLElement).style.background =
												'transparent'
										}}
									>
										<UserIcon size={14} color={c.dim} strokeWidth={1.75} />
										Profile
									</Link>
									<Form
										action={`/resources/stripe/manage-subscription?redirectTo=${encodeURIComponent(
											'/builder',
										)}`}
										method="POST"
										ref={manageSubFormRef}
										style={{ display: 'contents' }}
									>
										<input type="hidden" name="userId" value={user.id} />
										<button
											type="button"
											onClick={() => {
												submitForm(manageSubFormRef.current)
												setProfileOpen(false)
											}}
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												padding: '8px 12px',
												color: c.text,
												fontSize: 13,
												background: 'transparent',
												border: 'none',
												width: '100%',
												textAlign: 'left' as const,
												cursor: 'pointer',
											}}
											onMouseEnter={e => {
												;(e.currentTarget as HTMLElement).style.background =
													c.bgSurf
											}}
											onMouseLeave={e => {
												;(e.currentTarget as HTMLElement).style.background =
													'transparent'
											}}
										>
											<CreditCard size={14} color={c.dim} strokeWidth={1.75} />
											Manage Subscription
										</button>
									</Form>
									<div
										style={{ height: 1, background: c.border, margin: '4px 0' }}
									/>
									<Form
										action="/logout"
										method="POST"
										ref={logoutFormRef}
										style={{ display: 'contents' }}
									>
										<button
											type="button"
											onClick={() => {
												submitForm(logoutFormRef.current)
												setProfileOpen(false)
											}}
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												padding: '8px 12px',
												color: c.text,
												fontSize: 13,
												background: 'transparent',
												border: 'none',
												width: '100%',
												textAlign: 'left' as const,
												cursor: 'pointer',
											}}
											onMouseEnter={e => {
												;(e.currentTarget as HTMLElement).style.background =
													c.bgSurf
											}}
											onMouseLeave={e => {
												;(e.currentTarget as HTMLElement).style.background =
													'transparent'
											}}
										>
											<LogOut size={14} color={c.dim} strokeWidth={1.75} />
											Logout
										</button>
									</Form>
								</div>
							)}
						</div>
					) : (
						<button
							onClick={() => navigate('/login?redirectTo=/builder')}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 6,
								padding: '6px 14px',
								borderRadius: 5,
								border: `1px solid ${c.border}`,
								background: 'transparent',
								color: c.text,
								fontSize: 13,
								fontWeight: 500,
								cursor: 'pointer',
							}}
						>
							Log in
						</button>
					)}
				</div>
			</div>

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
							{(showAllResumes ? resumes : resumes.slice(0, 5)).map(r => (
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
														val !== (r.name || r.job?.title || 'Untitled')
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
												{r.name || r.job?.title || 'Untitled'}
											</div>
										)}
									</div>
								</div>
							))}
							{resumes.length > 5 && (
								<div
									onClick={() => setShowAllResumes(prev => !prev)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 9,
										padding: '6px 16px',
										borderRadius: 7,
										cursor: 'pointer',
										color: BRAND,
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
									;(e.currentTarget as HTMLElement).style.color = BRAND
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
										;(e.currentTarget as HTMLElement).style.color = BRAND
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
																? BRAND
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
													onClick={() => toggleSectionVisibility(s.visKey)}
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
										color={activeSection === s.id ? BRAND : c.dim}
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
						canvasBackground={c.canvas}
					/>
					<FloatingToolbar
						hovered={hoveredElement}
						onAction={handleStructuralAction}
						onAITailor={handleToolbarAITailor}
						onToggleSection={toggleSectionVisibility}
						sectionOrder={sectionOrder}
						formData={formData}
					/>
				</div>

				{/* SCORE PANEL */}
				{scorePanel && (
					<div
						style={{
							width: 390,
							borderLeft: `1px solid ${c.border}`,
							background: c.bgEl,
							display: 'flex',
							flexDirection: 'column',
							flexShrink: 0,
							overflow: 'auto',
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
								Fit Score
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
						{!formData.jobId ? (
							<div
								style={{
									padding: '40px 21px',
									textAlign: 'center',
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									gap: 12,
								}}
							>
								<Target size={32} color={c.dim} strokeWidth={1.5} />
								<div style={{ fontSize: 15, fontWeight: 500, color: c.muted }}>
									Select a target job to see your Fit Score
								</div>
								<div style={{ fontSize: 13, color: c.dim, lineHeight: 1.4 }}>
									Your resume will be scored against the job description's
									keywords and requirements.
								</div>
								<button
									onClick={() => setShowCreateJob(true)}
									style={{
										marginTop: 8,
										padding: '8px 18px',
										borderRadius: 6,
										border: 'none',
										background: BRAND,
										color: '#fff',
										fontSize: 13,
										fontWeight: 500,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										gap: 6,
									}}
								>
									<Plus size={14} strokeWidth={2} />
									Add a Job
								</button>
							</div>
						) : (
							<>
								<ScoreArc
									score={scores.overall}
									onClick={() => setShowScoreDetail(true)}
									c={c}
								/>
								<div style={{ padding: '0 21px 5px', textAlign: 'center' }}>
									<span
										onClick={() => setShowScoreDetail(true)}
										style={{
											fontSize: 14,
											color: BRAND,
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											gap: 5,
											justifyContent: 'center',
										}}
									>
										View full analysis <ArrowRight size={14} />
									</span>
								</div>
								<div style={{ padding: '9px 21px 14px' }}>
									<div
										style={{
											padding: '12px 14px',
											borderRadius: 7,
											background: `${getTier(scores.overall).color}08`,
											border: `1px solid ${getTier(scores.overall).color}20`,
											fontSize: 16,
											color: getTier(scores.overall).color,
											lineHeight: 1.4,
										}}
									>
										{scoreMsg(scores.overall)}
									</div>
								</div>

								{/* Section scores */}
								<div style={{ padding: '0 21px 18px' }}>
									<span
										style={{
											fontSize: 14,
											fontWeight: 600,
											color: c.dim,
											textTransform: 'uppercase',
											letterSpacing: '0.04em',
										}}
									>
										Section Scores
									</span>
									<div style={{ marginTop: 9 }}>
										{(
											[
												['Keyword Match', scores.keyword, Target],
												['Metrics', scores.metrics, TrendingUp],
												['Action Verbs', scores.actionVerbs, Zap],
												['Length', scores.length, AlignLeft],
											] as [string, number, any][]
										).map(([l, s, I]) => (
											<div
												key={l}
												style={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													padding: '8px 0',
												}}
											>
												<div
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: 9,
													}}
												>
													<I size={17} color={c.dim} strokeWidth={1.75} />
													<span style={{ fontSize: 16, color: c.muted }}>
														{l}
													</span>
												</div>
												<div
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: 7,
													}}
												>
													<div
														style={{
															width: 60,
															height: 6,
															borderRadius: 3,
															background: c.border,
															overflow: 'hidden',
														}}
													>
														<div
															style={{
																width: `${s}%`,
																height: '100%',
																borderRadius: 3,
																background: getTier(s).color,
																transition: 'width 0.8s',
															}}
														/>
													</div>
													<span
														style={{
															fontSize: 15,
															color: getTier(s).color,
															fontWeight: 500,
															width: 28,
															textAlign: 'right',
														}}
													>
														{s}
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
								<div
									style={{ height: 1, background: c.border, margin: '0 21px' }}
								/>

								{/* Opportunities */}
								<div style={{ padding: '18px 21px 9px' }}>
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											marginBottom: 12,
										}}
									>
										<span
											style={{
												fontSize: 14,
												fontWeight: 600,
												color: c.dim,
												textTransform: 'uppercase',
												letterSpacing: '0.04em',
											}}
										>
											Opportunities
										</span>
										<span style={{ fontSize: 14, color: c.dim }}>
											{checklist.filter(ch => !ch.completed).length} remaining
										</span>
									</div>
									{checklist.map((ch, i) => (
										<div
											key={ch.id || i}
											style={{
												display: 'flex',
												alignItems: 'flex-start',
												gap: 9,
												padding: '10px 0',
												borderBottom: `1px solid ${c.borderSub}`,
												opacity: ch.completed ? 0.5 : 1,
												cursor: ch.completed ? 'default' : 'pointer',
											}}
										>
											{ch.completed ? (
												<CheckCircle2
													size={20}
													color={SUCCESS}
													strokeWidth={1.75}
													style={{ marginTop: 1, flexShrink: 0 }}
												/>
											) : (
												<Circle
													size={20}
													color={c.dim}
													strokeWidth={1.75}
													style={{ marginTop: 1, flexShrink: 0 }}
												/>
											)}
											<div style={{ flex: 1 }}>
												<span
													style={{
														fontSize: 16,
														color: ch.completed ? c.dim : c.text,
														lineHeight: 1.4,
														textDecoration: ch.completed
															? 'line-through'
															: 'none',
														display: 'block',
													}}
												>
													{ch.text}
												</span>
												{!ch.completed &&
													ch.flaggedBullets &&
													ch.flaggedBullets.length > 0 && (
														<div
															onClick={() => handleChecklistFix(ch)}
															style={{
																fontSize: 12,
																color: BRAND,
																cursor: 'pointer',
																marginTop: 4,
																display: 'flex',
																alignItems: 'center',
																gap: 4,
																fontWeight: 500,
															}}
														>
															<Sparkles
																size={11}
																color={BRAND}
																strokeWidth={2}
															/>
															Fix with AI ({ch.flaggedBullets.length} bullet
															{ch.flaggedBullets.length !== 1 ? 's' : ''})
														</div>
													)}
											</div>
											{!ch.completed && (
												<span
													style={{
														fontSize: 13,
														fontWeight: 600,
														padding: '2px 7px',
														borderRadius: 5,
														background:
															ch.priority === 'high'
																? `${WARN}18`
																: `${BRAND}18`,
														color: ch.priority === 'high' ? WARN : BRAND,
														textTransform: 'uppercase',
														letterSpacing: '0.04em',
														flexShrink: 0,
														marginTop: 1,
													}}
												>
													{ch.priority}
												</span>
											)}
										</div>
									))}
								</div>

								{/* Keywords — uses consolidated keywordMatches from scoring engine */}
								{scores.keywordMatches.length > 0 &&
									(() => {
										const primaryMatches = scores.keywordMatches.filter(
											(m: KeywordMatch) => m.tier === 'primary',
										)
										const secondaryMatches = scores.keywordMatches.filter(
											(m: KeywordMatch) => m.tier === 'secondary',
										)
										const hasTiers = primaryMatches.length > 0

										const renderChip = (
											m: KeywordMatch,
											isPrimary: boolean,
										) => {
											const chipColor =
												m.status === 'full'
													? SUCCESS
													: m.status === 'partial'
													? WARN
													: ERROR
											const chipBg =
												m.status === 'full'
													? `${SUCCESS}15`
													: m.status === 'partial'
													? `${WARN}12`
													: `${ERROR}12`
											const isClickable = m.status !== 'full'
											const tooltip =
												m.status === 'full'
													? `Found in ${m.sections.join(', ')}`
													: m.status === 'partial'
													? `In ${m.sections[0]} only — click to add to another role`
													: 'Missing — click to generate a bullet'
											return (
												<span
													key={m.keyword}
													title={tooltip}
													onClick={
														isClickable
															? e => {
																	const rect = (
																		e.currentTarget as HTMLElement
																	).getBoundingClientRect()
																	setKeywordPopover({
																		keyword: m.keyword,
																		status: m.status as 'missing' | 'partial',
																		anchorRect: rect,
																	})
															  }
															: undefined
													}
													style={{
														display: 'inline-flex',
														alignItems: 'center',
														gap: 4,
														fontSize: isPrimary ? 14 : 13,
														padding: isPrimary ? '6px 12px' : '4px 9px',
														borderRadius: 5,
														fontWeight: 500,
														background: chipBg,
														color: chipColor,
														border: `1px solid ${chipColor}30`,
														cursor: isClickable ? 'pointer' : 'default',
														transition: 'filter 150ms',
													}}
													onMouseEnter={
														isClickable
															? e => {
																	;(
																		e.currentTarget as HTMLElement
																	).style.filter = 'brightness(1.15)'
															  }
															: undefined
													}
													onMouseLeave={
														isClickable
															? e => {
																	;(
																		e.currentTarget as HTMLElement
																	).style.filter = 'none'
															  }
															: undefined
													}
												>
													{m.status === 'full' ? (
														<Check size={13} strokeWidth={2.5} />
													) : m.status === 'partial' ? (
														<Minus size={13} strokeWidth={2.5} />
													) : (
														<X size={13} strokeWidth={2.5} />
													)}
													{m.keyword}
													{m.status === 'partial' && (
														<span style={{ fontSize: 11, opacity: 0.8 }}>
															({m.sections[0]})
														</span>
													)}
													{m.status === 'full' && (
														<span style={{ fontSize: 11, opacity: 0.8 }}>
															({m.sectionCount})
														</span>
													)}
													{isClickable && (
														<Plus
															size={11}
															strokeWidth={2.5}
															style={{ marginLeft: 2, opacity: 0.7 }}
														/>
													)}
												</span>
											)
										}

										return (
											<>
												<div
													style={{
														height: 1,
														background: c.border,
														margin: '0 21px',
													}}
												/>
												<div style={{ padding: 21 }}>
													{hasTiers ? (
														<>
															<span
																style={{
																	fontSize: 14,
																	fontWeight: 600,
																	color: c.dim,
																	textTransform: 'uppercase',
																	letterSpacing: '0.04em',
																}}
															>
																Must-Haves
															</span>
															<div
																style={{
																	display: 'flex',
																	flexWrap: 'wrap',
																	gap: 6,
																	marginTop: 12,
																}}
															>
																{primaryMatches.map((m: KeywordMatch) =>
																	renderChip(m, true),
																)}
															</div>
															{secondaryMatches.length > 0 && (
																<>
																	<span
																		style={{
																			fontSize: 14,
																			fontWeight: 600,
																			color: c.dim,
																			textTransform: 'uppercase',
																			letterSpacing: '0.04em',
																			display: 'block',
																			marginTop: 18,
																		}}
																	>
																		Supporting
																	</span>
																	<div
																		style={{
																			display: 'flex',
																			flexWrap: 'wrap',
																			gap: 6,
																			marginTop: 12,
																		}}
																	>
																		{secondaryMatches.map((m: KeywordMatch) =>
																			renderChip(m, false),
																		)}
																	</div>
																</>
															)}
														</>
													) : (
														<>
															<span
																style={{
																	fontSize: 14,
																	fontWeight: 600,
																	color: c.dim,
																	textTransform: 'uppercase',
																	letterSpacing: '0.04em',
																}}
															>
																Keyword Match
															</span>
															<div
																style={{
																	display: 'flex',
																	flexWrap: 'wrap',
																	gap: 6,
																	marginTop: 12,
																}}
															>
																{scores.keywordMatches
																	.slice(0, 12)
																	.map((m: KeywordMatch) =>
																		renderChip(m, false),
																	)}
															</div>
														</>
													)}
												</div>
											</>
										)
									})()}
							</>
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
										color={i === cmdSelected ? BRAND : c.dim}
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
						{ACCENT_COLORS.map(color => (
							<div
								key={color}
								onClick={() => applyAccentColor(color)}
								style={{
									width: 28,
									height: 28,
									borderRadius: '50%',
									background: color,
									cursor: 'pointer',
									border:
										formData.nameColor === color
											? `2px solid ${c.text}`
											: '2px solid transparent',
									boxShadow:
										formData.nameColor === color
											? `0 0 0 2px ${color}40`
											: 'none',
									transition: 'all 150ms',
								}}
							/>
						))}
					</div>
				</div>

				{/* Font Picker */}
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
						{FONT_OPTIONS.map(f => (
							<div
								key={f.value}
								onClick={() => applyFont(f.value)}
								style={{
									padding: '8px 12px',
									borderRadius: 6,
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									background:
										formData.font === f.value ? `${BRAND}12` : 'transparent',
									border: `1px solid ${
										formData.font === f.value ? BRAND + '40' : 'transparent'
									}`,
								}}
								onMouseEnter={e => {
									if (formData.font !== f.value)
										(e.currentTarget as HTMLElement).style.background = c.bgSurf
								}}
								onMouseLeave={e => {
									if (formData.font !== f.value)
										(e.currentTarget as HTMLElement).style.background =
											'transparent'
								}}
							>
								<span
									style={{
										fontSize: 13,
										color: formData.font === f.value ? BRAND : c.text,
										fontFamily: f.family,
									}}
								>
									{f.label}
								</span>
								{formData.font === f.value && (
									<Check size={14} color={BRAND} strokeWidth={2} />
								)}
							</div>
						))}
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
							<div
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
									color: formData.textSize === size ? BRAND : c.text,
									fontWeight: 500,
									textTransform: 'capitalize' as const,
								}}
							>
								{size}
							</div>
						))}
					</div>
				</div>
			</SlideOver>

			{/* ═══ SCORE DETAIL SLIDE-OVER ═══ */}
			<SlideOver
				open={showScoreDetail}
				onClose={() => setShowScoreDetail(false)}
				title="Score Analysis"
				c={c}
			>
				<ScoreArc score={scores.overall} size={184} c={c} />
				<div style={{ padding: '8px 0 16px', textAlign: 'center' }}>
					<div
						style={{
							padding: '10px 12px',
							borderRadius: 6,
							background: `${getTier(scores.overall).color}08`,
							border: `1px solid ${getTier(scores.overall).color}20`,
							fontSize: 13,
							color: getTier(scores.overall).color,
							lineHeight: 1.4,
						}}
					>
						{scoreMsg(scores.overall)}
					</div>
				</div>

				{/* Section Scores */}
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
						Section Breakdown
					</span>
					<div style={{ marginTop: 10 }}>
						{(
							[
								['Keyword Match', scores.keyword, Target],
								['Metrics', scores.metrics, TrendingUp],
								['Action Verbs', scores.actionVerbs, Zap],
								['Length', scores.length, AlignLeft],
							] as [string, number, any][]
						).map(([l, s, I]) => (
							<div
								key={l}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									padding: '10px 0',
									borderBottom: `1px solid ${c.borderSub}`,
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
									<div
										style={{
											width: 32,
											height: 32,
											borderRadius: 6,
											background: `${getTier(s).color}12`,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<I size={16} color={getTier(s).color} strokeWidth={1.75} />
									</div>
									<div>
										<div
											style={{ fontSize: 13, color: c.text, fontWeight: 500 }}
										>
											{l}
										</div>
										<div style={{ fontSize: 11, color: c.dim }}>
											{getTier(s).label}
										</div>
									</div>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<div
										style={{
											width: 60,
											height: 5,
											borderRadius: 3,
											background: c.border,
											overflow: 'hidden',
										}}
									>
										<div
											style={{
												width: `${s}%`,
												height: '100%',
												borderRadius: 3,
												background: getTier(s).color,
												transition: 'width 0.8s',
											}}
										/>
									</div>
									<span
										style={{
											fontSize: 14,
											color: getTier(s).color,
											fontWeight: 600,
											width: 28,
											textAlign: 'right',
										}}
									>
										{s}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Strengths */}
				{checklist.filter(ch => ch.completed).length > 0 && (
					<div style={{ marginBottom: 20 }}>
						<span
							style={{
								fontSize: 11,
								fontWeight: 600,
								color: SUCCESS,
								textTransform: 'uppercase',
								letterSpacing: '0.04em',
							}}
						>
							Strengths
						</span>
						<div style={{ marginTop: 8 }}>
							{checklist
								.filter(ch => ch.completed)
								.map((ch, i) => (
									<div
										key={ch.id || i}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 8,
											padding: '6px 0',
										}}
									>
										<CheckCircle2
											size={14}
											color={SUCCESS}
											strokeWidth={1.75}
										/>
										<span style={{ fontSize: 13, color: c.muted }}>
											{ch.text}
										</span>
									</div>
								))}
						</div>
					</div>
				)}

				{/* Opportunities with Fix This → */}
				{checklist.filter(ch => !ch.completed).length > 0 && (
					<div>
						<span
							style={{
								fontSize: 11,
								fontWeight: 600,
								color: WARN,
								textTransform: 'uppercase',
								letterSpacing: '0.04em',
							}}
						>
							Opportunities
						</span>
						<div style={{ marginTop: 8 }}>
							{checklist
								.filter(ch => !ch.completed)
								.map((ch, i) => {
									const hasFlaggedBullets =
										ch.flaggedBullets && ch.flaggedBullets.length > 0
									const targetSec =
										ch.text.toLowerCase().includes('experience') ||
										ch.text.toLowerCase().includes('bullet') ||
										ch.text.toLowerCase().includes('achievement')
											? 'experience'
											: ch.text.toLowerCase().includes('skill') ||
											  ch.text.toLowerCase().includes('keyword')
											? 'skills'
											: ch.text.toLowerCase().includes('summary') ||
											  ch.text.toLowerCase().includes('about')
											? 'summary'
											: ch.text.toLowerCase().includes('education')
											? 'education'
											: 'experience'
									return (
										<div
											key={ch.id || i}
											style={{
												display: 'flex',
												alignItems: 'flex-start',
												gap: 8,
												padding: '8px 0',
												borderBottom: `1px solid ${c.borderSub}`,
											}}
										>
											<Circle
												size={14}
												color={c.dim}
												strokeWidth={1.75}
												style={{ marginTop: 2, flexShrink: 0 }}
											/>
											<div style={{ flex: 1 }}>
												<span
													style={{
														fontSize: 13,
														color: c.text,
														lineHeight: 1.4,
													}}
												>
													{ch.text}
												</span>
												{hasFlaggedBullets ? (
													<div
														onClick={() => {
															setShowScoreDetail(false)
															handleChecklistFix(ch)
														}}
														style={{
															fontSize: 11,
															color: BRAND,
															cursor: 'pointer',
															marginTop: 4,
															display: 'flex',
															alignItems: 'center',
															gap: 4,
															fontWeight: 500,
														}}
													>
														<Sparkles size={10} color={BRAND} strokeWidth={2} />
														Fix with AI ({ch.flaggedBullets!.length} bullet
														{ch.flaggedBullets!.length !== 1 ? 's' : ''})
													</div>
												) : (
													<div
														onClick={() => {
															setShowScoreDetail(false)
															scrollToSection(targetSec)
														}}
														style={{
															fontSize: 11,
															color: BRAND,
															cursor: 'pointer',
															marginTop: 4,
															display: 'flex',
															alignItems: 'center',
															gap: 4,
														}}
													>
														Fix this <ArrowRight size={10} />
													</div>
												)}
											</div>
											<span
												style={{
													fontSize: 10,
													fontWeight: 600,
													padding: '2px 6px',
													borderRadius: 4,
													background:
														ch.priority === 'high' ? `${WARN}18` : `${BRAND}18`,
													color: ch.priority === 'high' ? WARN : BRAND,
													textTransform: 'uppercase',
													flexShrink: 0,
												}}
											>
												{ch.priority}
											</span>
										</div>
									)
								})}
						</div>
					</div>
				)}
			</SlideOver>

			{/* ═══ ONBOARDING WIDGET ═══ */}
			{!onboarding.isComplete && !onboardingDismissed && (
				<div
					style={{
						position: 'fixed',
						bottom: 20,
						right: 20,
						zIndex: 150,
						width: onboardingCollapsed ? 48 : 280,
						background: c.bgEl,
						borderRadius: 12,
						border: `1px solid ${c.border}`,
						boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
						overflow: 'hidden',
						transition: 'width 200ms',
					}}
				>
					{onboardingCollapsed ? (
						<div
							onClick={() => setOnboardingCollapsed(false)}
							style={{
								width: 48,
								height: 48,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								cursor: 'pointer',
							}}
						>
							<Rocket size={20} color={BRAND} strokeWidth={1.75} />
						</div>
					) : (
						<>
							<div
								style={{
									padding: '12px 16px 8px',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<Rocket size={16} color={BRAND} strokeWidth={1.75} />
									<span
										style={{ fontSize: 13, fontWeight: 600, color: c.text }}
									>
										Getting Started
									</span>
								</div>
								<div style={{ display: 'flex', gap: 2 }}>
									<button
										onClick={() => setOnboardingCollapsed(true)}
										style={{
											width: 24,
											height: 24,
											borderRadius: 4,
											border: 'none',
											background: 'transparent',
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<ChevronDown size={14} color={c.dim} />
									</button>
									<button
										onClick={() => setOnboardingDismissed(true)}
										style={{
											width: 24,
											height: 24,
											borderRadius: 4,
											border: 'none',
											background: 'transparent',
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<X size={14} color={c.dim} />
									</button>
								</div>
							</div>
							<div style={{ padding: '4px 16px 16px' }}>
								{[
									{
										id: 'resume',
										label: 'Create a resume',
										done: !!(formData.name || formData.role),
										action: () => scrollToSection('summary'),
									},
									{
										id: 'job',
										label: 'Add a target job',
										done: !!selectedJob,
										action: () => setShowCreateJob(true),
									},
									{
										id: 'tailor',
										label: 'Tailor with AI',
										done: (gettingStartedProgress?.tailorCount ?? 0) > 0,
										action: () => {
											const firstExp = formData.experiences?.[0]
											const firstBullet = firstExp?.descriptions?.[0]
											if (firstExp?.id && firstBullet)
												handleAIClick(firstExp.id, 0, firstBullet.content || '')
										},
									},
								].map(step => (
									<div
										key={step.id}
										onClick={!step.done ? step.action : undefined}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 10,
											padding: '8px 0',
											cursor: step.done ? 'default' : 'pointer',
											opacity: step.done ? 0.6 : 1,
										}}
									>
										{step.done ? (
											<CheckCircle2
												size={16}
												color={SUCCESS}
												strokeWidth={1.75}
											/>
										) : (
											<Circle size={16} color={c.dim} strokeWidth={1.75} />
										)}
										<span
											style={{
												fontSize: 13,
												color: step.done ? c.dim : c.text,
												textDecoration: step.done ? 'line-through' : 'none',
											}}
										>
											{step.label}
										</span>
										{!step.done && (
											<ChevronRight
												size={12}
												color={c.dim}
												style={{ marginLeft: 'auto' }}
											/>
										)}
									</div>
								))}
								{/* Progress bar */}
								<div
									style={{
										marginTop: 8,
										height: 3,
										borderRadius: 2,
										background: c.border,
										overflow: 'hidden',
									}}
								>
									<div
										style={{
											height: '100%',
											borderRadius: 2,
											background: BRAND,
											transition: 'width 300ms',
											width: `${
												([
													!!(formData.name || formData.role),
													!!selectedJob,
													(gettingStartedProgress?.tailorCount ?? 0) > 0,
												].filter(Boolean).length /
													3) *
												100
											}%`,
										}}
									/>
								</div>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	)
}

export const action = async ({ request }: ActionFunctionArgs) => {
	const formData = await request.formData()
	console.log(formData)
	return null
}
