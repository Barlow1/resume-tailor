import {
	useSortable,
	SortableContext,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EditableContent } from '~/components/editable-content.tsx'
import {
	ChevronUpDownIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import { SortableBulletPoint } from './sortable-bullet-point.tsx'
import { type CSSProperties, useContext } from 'react'
import { DraggingContext } from '~/routes/builder+/index.tsx'
import { type BuilderExperience } from '~/utils/builder-resume.server.ts'

interface SortableExperienceProps {
	experience: BuilderExperience
	onExperienceEdit: (
		content: string,
		id: string,
		field: keyof BuilderExperience,
	) => void
	onRemoveExperience: (id: string) => void
	onAddExperience: () => void
	onAIClick: (id: string, index: number, content: string) => void
	onAddBullet: (id: string, index: number) => void
	onRemoveBullet: (id: string, index: number) => void
	onBulletEdit: (content: string, id: string, index: number) => void
	rerenderRef: React.MutableRefObject<boolean>
	/** Index of this experience in the list (0-indexed) */
	experienceIndex?: number
}

export function SortableExperience({
	experience,
	onExperienceEdit,
	onRemoveExperience,
	onAddExperience,
	onAIClick,
	onAddBullet,
	onRemoveBullet,
	onBulletEdit,
	rerenderRef,
	experienceIndex,
}: SortableExperienceProps) {
	const { isDraggingAny } = useContext(DraggingContext)
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: experience.id!,
		data: {
			type: 'experience',
			experience,
		},
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.3 : 1,
		zIndex: isDragging ? 1 : 0,
		position: isDragging
			? ('relative' as CSSProperties['position'])
			: undefined,
		background: isDragging ? 'var(--background)' : undefined,
		pointerEvents: isDragging
			? ('none' as CSSProperties['pointerEvents'])
			: undefined,
		border: isDragging ? '2px dashed #e5e7eb' : undefined,
	}

	const experienceContent = (
		<div className="w-full">
			{/* Company name and dates on same line */}
			<div className="flex items-baseline justify-between">
				<EditableContent
					content={experience.company}
					onInput={e =>
						onExperienceEdit(
							e.currentTarget.innerText,
							experience.id!,
							'company',
						)
					}
					className="resume-company text-gray-700 outline-none"
					placeholder="Company"
				/>
				<div className="flex gap-1 resume-dates text-gray-700">
					<EditableContent
						content={experience.startDate}
						onInput={e =>
							onExperienceEdit(
								e.currentTarget.innerText,
								experience.id!,
								'startDate',
							)
						}
						className="text-right outline-none"
						placeholder="Start"
					/>
					<span>–</span>
					<EditableContent
						content={experience.endDate}
						onInput={e =>
							onExperienceEdit(
								e.currentTarget.innerText,
								experience.id!,
								'endDate',
							)
						}
						className="outline-none"
						placeholder="End"
					/>
				</div>
			</div>
			{/* Job title below company */}
			<EditableContent
				content={experience.role}
				onInput={e =>
					onExperienceEdit(e.currentTarget.innerText, experience.id!, 'role')
				}
				className="resume-job-title text-gray-700 outline-none"
				placeholder="Role / Title"
			/>

			{/* Bullet points */}
			<div>
				{experience.descriptions?.length ? (
					<SortableContext
					items={experience.descriptions?.map(
						(_, index) => `${experience.id}_${index}`,
					)}
					strategy={verticalListSortingStrategy}
				>
					{experience.descriptions?.map((bullet, index) => (
						<SortableBulletPoint
							key={`${experience.id}_${index}`}
							id={`${experience.id}_${index}`}
							content={bullet.content ?? ''}
							onInput={e =>
								onBulletEdit(e.currentTarget.innerText, experience.id!, index)
							}
							onAIClick={() => onAIClick(experience.id!, index, bullet.content ?? '')}
							onAddClick={() => onAddBullet(experience.id!, index)}
							onRemoveClick={() => onRemoveBullet(experience.id!, index)}
							rerenderRef={rerenderRef}
							onEnter={() => onAddBullet(experience.id!, index)}
							isFirstBullet={experienceIndex === 0 && index === 0}
						/>
						))}
					</SortableContext>
				) : null}
			</div>
		</div>
	)

	return (
		<div
			ref={setNodeRef}
			style={style}
			id={`experience-${experience.id}`}
			className={`group relative rounded p-1 ${
				!isDraggingAny &&
				!isDragging &&
				'hover:border hover:border-dashed hover:border-gray-400'
			}`}
			key={`experience-${experience.id}_${rerenderRef.current}`}
		>
			<div
				className={`preview-only absolute -right-5 -top-5 gap-2 rounded-3xl bg-white px-2 py-1 shadow-md ${
					isDraggingAny && !isDragging
						? 'hidden'
						: 'hidden group-focus-within:flex group-hover:flex'
				}`}
			>
				<button
					type="button"
					onClick={onAddExperience}
					className="rounded-full bg-white p-1 text-gray-400 shadow-sm hover:bg-gray-100 hover:text-gray-600"
				>
					<PlusIcon className="h-5 w-5" />
				</button>
				<button
					className="cursor-grab touch-none rounded-full bg-white p-1 text-gray-400 shadow-sm hover:bg-gray-100 hover:text-gray-600"
					{...attributes}
					{...listeners}
				>
					<ChevronUpDownIcon className="h-5 w-5" />
				</button>
				<button
					type="button"
					onClick={() => onRemoveExperience(experience.id!)}
					className="rounded-full bg-white p-1 text-gray-400 shadow-sm hover:bg-gray-100 hover:text-gray-600"
				>
					<TrashIcon className="h-5 w-5" />
				</button>
			</div>

			{experienceContent}
		</div>
	)
}
