import { useMemo } from 'react'
import {
	ChevronUp,
	ChevronDown,
	Trash2,
	Plus,
	Sparkles,
	Eye,
	EyeOff,
	type LucideIcon,
} from 'lucide-react'
import type { HoveredElementInfo, StructuralAction } from './resume-iframe.tsx'
import type { ResumeData } from '~/utils/builder-resume.server.ts'

type ToolbarAction = {
	key: string
	label: string
	icon: LucideIcon
	disabled?: boolean
	action: StructuralAction | { type: '__aiTailor' } | { type: '__toggleSection'; sectionId: string }
}

interface FloatingToolbarProps {
	hovered: HoveredElementInfo | null
	onAction: (action: StructuralAction) => void
	onAITailor?: (experienceId: string, bulletIndex: number) => void
	onToggleSection?: (sectionId: string) => void
	sectionOrder: string[]
	formData: ResumeData
}

const TOOLBAR_WIDTH = 32

function getSectionVisKey(sectionId: string): string {
	if (sectionId === 'summary' || sectionId === 'about') return 'about'
	return sectionId
}

export function FloatingToolbar({
	hovered,
	onAction,
	onAITailor,
	onToggleSection,
	sectionOrder,
	formData,
}: FloatingToolbarProps) {
	const actions = useMemo((): ToolbarAction[] => {
		if (!hovered) return []

		switch (hovered.type) {
			case 'bullet': {
				const exp = formData.experiences?.find(e => e.id === hovered.experienceId)
				const bulletCount = exp?.descriptions?.length ?? 0
				const isFirst = hovered.bulletIndex === 0
				const isLast = hovered.bulletIndex === bulletCount - 1

				const items: ToolbarAction[] = []
				if (!isFirst) {
					items.push({
						key: 'moveUp',
						label: 'Move bullet up',
						icon: ChevronUp,
						action: { type: 'reorderBullet', experienceId: hovered.experienceId!, oldIndex: hovered.bulletIndex!, newIndex: hovered.bulletIndex! - 1 },
					})
				}
				if (!isLast) {
					items.push({
						key: 'moveDown',
						label: 'Move bullet down',
						icon: ChevronDown,
						action: { type: 'reorderBullet', experienceId: hovered.experienceId!, oldIndex: hovered.bulletIndex!, newIndex: hovered.bulletIndex! + 1 },
					})
				}
				items.push({
					key: 'deleteBullet',
					label: 'Delete bullet',
					icon: Trash2,
					disabled: bulletCount <= 1,
					action: { type: 'deleteBullet', experienceId: hovered.experienceId!, bulletIndex: hovered.bulletIndex! },
				})
				items.push({
					key: 'addBullet',
					label: 'Add bullet below',
					icon: Plus,
					action: { type: 'addBullet', experienceId: hovered.experienceId! },
				})
				items.push({
					key: 'aiTailor',
					label: 'AI tailor',
					icon: Sparkles,
					action: { type: '__aiTailor' },
				})
				return items
			}

			case 'experience': {
				return [
					{
						key: 'deleteExperience',
						label: 'Delete experience',
						icon: Trash2,
						action: { type: 'deleteExperience', experienceId: hovered.experienceId! },
					},
					{
						key: 'addExperience',
						label: 'Add experience',
						icon: Plus,
						action: { type: 'addExperience' },
					},
				]
			}

			case 'education': {
				return [
					{
						key: 'deleteEducation',
						label: 'Delete education',
						icon: Trash2,
						action: { type: 'deleteEducation', educationId: hovered.educationId! },
					},
					{
						key: 'addEducation',
						label: 'Add education',
						icon: Plus,
						action: { type: 'addEducation' },
					},
				]
			}

			case 'skill': {
				return [
					{
						key: 'deleteSkill',
						label: 'Delete skill',
						icon: Trash2,
						action: { type: 'deleteSkill', skillId: hovered.skillId! },
					},
					{
						key: 'addSkill',
						label: 'Add skill',
						icon: Plus,
						action: { type: 'addSkill' },
					},
				]
			}

			case 'hobby': {
				return [
					{
						key: 'deleteHobby',
						label: 'Delete hobby',
						icon: Trash2,
						action: { type: 'deleteHobby', hobbyId: hovered.hobbyId! },
					},
					{
						key: 'addHobby',
						label: 'Add hobby',
						icon: Plus,
						action: { type: 'addHobby' },
					},
				]
			}

			case 'section': {
				const secId = hovered.sectionId!
				const currentIndex = sectionOrder.indexOf(secId)
				const isFirst = currentIndex === 0
				const isLast = currentIndex === sectionOrder.length - 1
				const visKey = getSectionVisKey(secId)
				const isVisible = formData.visibleSections?.[visKey as keyof typeof formData.visibleSections] ?? true

				const items: ToolbarAction[] = []
				if (!isFirst) {
					items.push({
						key: 'moveSectionUp',
						label: 'Move section up',
						icon: ChevronUp,
						action: { type: 'reorderSection', oldIndex: currentIndex, newIndex: currentIndex - 1 },
					})
				}
				if (!isLast) {
					items.push({
						key: 'moveSectionDown',
						label: 'Move section down',
						icon: ChevronDown,
						action: { type: 'reorderSection', oldIndex: currentIndex, newIndex: currentIndex + 1 },
					})
				}

				// Add item button based on section type
				if (secId === 'experience') {
					items.push({ key: 'addExperience', label: 'Add experience', icon: Plus, action: { type: 'addExperience' } })
				} else if (secId === 'education') {
					items.push({ key: 'addEducation', label: 'Add education', icon: Plus, action: { type: 'addEducation' } })
				} else if (secId === 'skills') {
					items.push({ key: 'addSkill', label: 'Add skill', icon: Plus, action: { type: 'addSkill' } })
				} else if (secId === 'hobbies') {
					items.push({ key: 'addHobby', label: 'Add hobby', icon: Plus, action: { type: 'addHobby' } })
				}

				items.push({
					key: 'toggleVisibility',
					label: isVisible ? 'Hide section' : 'Show section',
					icon: isVisible ? EyeOff : Eye,
					action: { type: '__toggleSection', sectionId: visKey },
				})

				return items
			}

			default:
				return []
		}
	}, [hovered, formData, sectionOrder])

	if (!hovered || actions.length === 0) return null

	// Position to the left of the hovered element, vertically centered
	let left = hovered.rect.left - TOOLBAR_WIDTH - 8
	const flipped = left < 0
	if (flipped) {
		left = hovered.rect.left + hovered.rect.width + 8
	}

	const style: React.CSSProperties = {
		position: 'fixed',
		top: hovered.rect.top + hovered.rect.height / 2,
		left,
		transform: 'translateY(-50%)',
		zIndex: 500,
	}

	const handleClick = (toolbarAction: ToolbarAction) => {
		if (toolbarAction.disabled) return

		const act = toolbarAction.action
		if ('type' in act && act.type === '__aiTailor') {
			onAITailor?.(hovered.experienceId!, hovered.bulletIndex!)
			return
		}
		if ('type' in act && act.type === '__toggleSection') {
			onToggleSection?.(act.sectionId)
			return
		}
		onAction(act as StructuralAction)
	}

	return (
		<div
			style={style}
			onMouseDown={(e) => e.preventDefault()}
			role="toolbar"
			aria-label="Element actions"
		>
			<style>{`
				.floating-toolbar-wrap {
					display: flex;
					flex-direction: column;
					gap: 2px;
					background: #fff;
					border-radius: 8px;
					border: 1px solid #e5e7eb;
					padding: 3px;
					box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06);
				}
				.floating-toolbar-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 26px;
					height: 26px;
					border-radius: 4px;
					border: none;
					background: transparent;
					color: #6b7280;
					cursor: pointer;
					transition: background 100ms, color 100ms;
					padding: 0;
				}
				.floating-toolbar-btn:hover:not(:disabled) {
					background: #f3f4f6;
					color: #374151;
				}
				.floating-toolbar-btn:disabled {
					opacity: 0.3;
					cursor: default;
				}
				.floating-toolbar-btn.danger:hover:not(:disabled) {
					background: #fef2f2;
					color: #dc2626;
				}
				.floating-toolbar-btn.ai:hover:not(:disabled) {
					background: #f5f3ff;
					color: #7c3aed;
				}
			`}</style>
			<div className="floating-toolbar-wrap">
				{actions.map(a => (
					<button
						key={a.key}
						onClick={() => handleClick(a)}
						disabled={a.disabled}
						className={`floating-toolbar-btn${a.icon === Trash2 ? ' danger' : ''}${a.icon === Sparkles ? ' ai' : ''}`}
						title={a.label}
						aria-label={a.label}
					>
						<a.icon size={14} />
					</button>
				))}
			</div>
		</div>
	)
}

// Keep the old export for backwards compatibility (used elsewhere)
export const floatingToolbarClassName =
	'absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-lg bg-muted/80 p-4 pl-5 shadow-xl shadow-accent backdrop-blur-sm md:gap-4 md:pl-7 justify-end'
