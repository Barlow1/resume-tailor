import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EditableContent } from '~/components/editable-content.tsx'
import {
	ChevronUpDownIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import { type CSSProperties, useContext } from 'react'
import { DraggingContext } from '~/routes/builder+/index.tsx'
import { type BuilderEducation } from '~/utils/builder-resume.server.ts'

interface SortableEducationProps {
	education: BuilderEducation
	onEducationEdit: (
		content: string,
		id: string,
		field: keyof BuilderEducation,
	) => void
	onRemoveEducation: (id: string) => void
	onAddEducation: () => void
}

export function SortableEducation({
	education,
	onEducationEdit,
	onRemoveEducation,
	onAddEducation,
}: SortableEducationProps) {
	const { isDraggingAny } = useContext(DraggingContext)
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: education.id!,
		data: {
			type: 'education',
			education,
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

	return (
		<div
			ref={setNodeRef}
			style={style}
			id={`education-${education.id}`}
			className={`group relative rounded p-4 ${
				!isDraggingAny &&
				!isDragging &&
				'hover:border hover:border-dashed hover:border-gray-400'
			}`}
		>
			<div
				className={`absolute -right-5 -top-5 gap-2 rounded-3xl bg-white px-2 py-1 shadow-md ${
					isDraggingAny && !isDragging
						? 'hidden'
						: 'hidden group-focus-within:flex group-hover:flex'
				}`}
			>
				<button
					type="button"
					onClick={onAddEducation}
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
					onClick={() => onRemoveEducation(education.id!)}
					className="rounded-full bg-white p-1 text-gray-400 shadow-sm hover:bg-gray-100 hover:text-gray-600"
				>
					<TrashIcon className="h-5 w-5" />
				</button>
			</div>

			<div className="mb-4 grid grid-flow-row grid-cols-12 items-start justify-between">
				<div className="col-span-8">
					<EditableContent
						content={education.school}
						onInput={e =>
							onEducationEdit(e.currentTarget.innerText, education.id!, 'school')
						}
						className="mb-1 text-lg font-medium text-gray-700 outline-none"
						placeholder="School Name"
					/>
					<EditableContent
						content={education.degree}
						onInput={e =>
							onEducationEdit(e.currentTarget.innerText, education.id!, 'degree')
						}
						className="text-gray-600 outline-none"
						placeholder="Degree / Field of Study"
					/>
				</div>
				<div className="col-span-4 flex justify-end gap-2 text-sm text-gray-500">
					<EditableContent
						content={education.startDate}
						onInput={e =>
							onEducationEdit(
								e.currentTarget.innerText,
								education.id!,
								'startDate',
							)
						}
						className="text-right outline-none"
						placeholder="Start Date"
					/>
					<span>-</span>
					<EditableContent
						content={education.endDate}
						onInput={e =>
							onEducationEdit(
								e.currentTarget.innerText,
								education.id!,
								'endDate',
							)
						}
						className="outline-none"
						placeholder="End Date"
					/>
				</div>
			</div>

			<EditableContent
				multiline
				content={education.description}
				onInput={e =>
					onEducationEdit(
						e.currentTarget.innerText,
						education.id!,
						'description',
					)
				}
				className="whitespace-pre-line text-gray-600 outline-none"
				placeholder="Additional details (honors, activities, etc.)"
			/>
		</div>
	)
}
