import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EditableContent } from '~/components/editable-content.tsx'
import { RainbowSparklesIcon } from './rainbow-sparkles-icon.tsx'
import {
	ChevronUpDownIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import { useContext } from 'react'
import { DraggingContext } from '~/routes/builder+/index.tsx'

interface SortableBulletPointProps {
	id: string
	content: string
	onInput: (e: React.FormEvent<HTMLDivElement>) => void
	onAIClick: () => void
	onAddClick: () => void
	onRemoveClick: () => void
	rerenderRef?: React.MutableRefObject<boolean>
	onEnter?: () => void
}

export function SortableBulletPoint({
	id,
	content,
	onInput,
	onAIClick,
	onAddClick,
	onRemoveClick,
	rerenderRef,
	onEnter,
}: SortableBulletPointProps) {
	const { isDraggingAny } = useContext(DraggingContext)
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id,
		data: {
			type: 'bullet',
			bullet: content,
			experienceId: id.toString().split('_')[0],
			bulletIndex: parseInt(id.toString().split('_')[1]),
		},
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 1 : 0,
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`group/expItem relative flex items-start gap-2`}
		>
			<span className="text-black">•</span>
			<EditableContent
				content={content}
				onInput={onInput}
				rerenderRef={rerenderRef}
				onEnter={onEnter}
				className={`flex-1 text-gray-600 outline-none ${
					!isDraggingAny &&
					!isDragging &&
					'group-focus-within/expItem:bg-gray-100 group-hover/expItem:bg-gray-100'
				}`}
				placeholder="Add achievement or responsibility..."
				id={id}
			/>
			<div
				className={`absolute -right-5 -top-5 gap-2 rounded-3xl bg-white px-2 py-1 shadow-md ${
					isDraggingAny && !isDragging
						? 'hidden'
						: 'hidden group-focus-within/expItem:flex group-hover/expItem:flex'
				}`}
			>
				<button
					type="button"
					onClick={onAIClick}
					className="hidden group-focus-within/expItem:block group-hover/expItem:block"
					title="AI Assistant"
				>
					<div className="flex items-center gap-1">
						<span className="animate-rainbow-text text-sm text-gray-600">
							AI Assistant
						</span>
						<RainbowSparklesIcon className="h-5 w-5" id={id} />
					</div>
				</button>
				<button
					type="button"
					onClick={onAddClick}
					className="hidden group-focus-within/expItem:block group-hover/expItem:block"
					title="Add Bullet Point"
				>
					<PlusIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
				</button>
				<button
					className="mt-1 hidden cursor-grab touch-none group-focus-within/expItem:block group-hover/expItem:block"
					{...attributes}
					{...listeners}
				>
					<ChevronUpDownIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
				</button>
				<button
					type="button"
					onClick={onRemoveClick}
					className="hidden text-gray-400 hover:text-gray-600 group-focus-within/expItem:block group-hover/expItem:block"
				>
					<TrashIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}
