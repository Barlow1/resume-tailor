/**
 * Modal showing what changed after tailoring
 */

import { type DiffSummary } from '~/utils/tailor-diff.ts'
import { Button } from './ui/button.tsx'
import { DialogModal } from './ui/dialog-modal.tsx'
import { CheckCircleIcon, PlusIcon, MinusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface TailorDiffModalProps {
	isOpen: boolean
	onClose: () => void
	onKeepChanges: () => void
	onRevert: () => void
	diffSummary: DiffSummary
	scoreImprovement?: number
}

export function TailorDiffModal({
	isOpen,
	onClose,
	onKeepChanges,
	onRevert,
	diffSummary,
	scoreImprovement,
}: TailorDiffModalProps) {
	const hasChanges = diffSummary.totalChanges > 0

	return (
		<DialogModal
			isOpen={isOpen}
			onClose={onClose}
			size="lg"
			title={
				<div className="flex items-center gap-2">
					<CheckCircleIcon className="h-6 w-6 text-green-600" />
					Tailoring Complete!
				</div>
			}
		>
			<div className="max-h-[60vh] overflow-y-auto">
				<p className="text-sm text-gray-600 mb-4">
					{hasChanges
						? 'Here\'s what was optimized for the job:'
						: 'No changes were made to your resume.'}
				</p>

				<div className="space-y-6 py-4">
					{/* Summary Stats */}
					<div className="grid grid-cols-3 gap-4">
						<div className="bg-blue-50 p-4 rounded-lg text-center">
							<div className="text-2xl font-bold text-blue-900">
								{diffSummary.addedKeywords.length}
							</div>
							<div className="text-sm text-blue-700">Keywords Added</div>
						</div>
						<div className="bg-purple-50 p-4 rounded-lg text-center">
							<div className="text-2xl font-bold text-purple-900">
								{diffSummary.modifiedBullets.length}
							</div>
							<div className="text-sm text-purple-700">Bullets Enhanced</div>
						</div>
						{scoreImprovement !== undefined && (
							<div className="bg-green-50 p-4 rounded-lg text-center">
								<div className="text-2xl font-bold text-green-900">
									+{scoreImprovement}
								</div>
								<div className="text-sm text-green-700">Score Improved</div>
							</div>
						)}
					</div>

					{/* Added Keywords */}
					{diffSummary.addedKeywords.length > 0 && (
						<div>
							<h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
								<PlusIcon className="h-4 w-4 text-green-600" />
								Added Keywords ({diffSummary.addedKeywords.length})
							</h3>
							<div className="flex flex-wrap gap-2">
								{diffSummary.addedKeywords.slice(0, 15).map((keyword: string, index: number) => (
									<span
										key={index}
										className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
									>
										{keyword}
									</span>
								))}
								{diffSummary.addedKeywords.length > 15 && (
									<span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
										+{diffSummary.addedKeywords.length - 15} more
									</span>
								)}
							</div>
						</div>
					)}

					{/* Modified Bullets */}
					{diffSummary.modifiedBullets.length > 0 && (
						<div>
							<h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
								<ArrowPathIcon className="h-4 w-4 text-purple-600" />
								Enhanced Bullet Points ({diffSummary.modifiedBullets.length})
							</h3>
							<div className="space-y-4 max-h-64 overflow-y-auto">
								{diffSummary.modifiedBullets.slice(0, 5).map((bullet: any, index: number) => (
									<div key={index} className="border rounded-lg p-3 bg-gray-50">
										<div className="text-xs font-medium text-gray-500 mb-2">
											{bullet.location}
										</div>
										<div className="space-y-2">
											<div className="flex items-start gap-2">
												<MinusIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
												<div className="text-sm text-gray-700 line-through opacity-75">
													{bullet.before}
												</div>
											</div>
											<div className="flex items-start gap-2">
												<PlusIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
												<div className="text-sm text-gray-900 font-medium">
													{bullet.after}
												</div>
											</div>
										</div>
									</div>
								))}
								{diffSummary.modifiedBullets.length > 5 && (
									<div className="text-center text-sm text-gray-500 py-2">
										+{diffSummary.modifiedBullets.length - 5} more changes
									</div>
								)}
							</div>
						</div>
					)}

					{/* Added Bullets */}
					{diffSummary.addedBullets.length > 0 && (
						<div>
							<h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
								<PlusIcon className="h-4 w-4 text-green-600" />
								New Bullet Points ({diffSummary.addedBullets.length})
							</h3>
							<div className="space-y-2">
								{diffSummary.addedBullets.map((bullet: any, index: number) => (
									<div key={index} className="border-l-4 border-green-500 pl-3 py-1">
										<div className="text-xs text-gray-500 mb-1">{bullet.location}</div>
										<div className="text-sm text-gray-900">{bullet.content}</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Removed Bullets */}
					{diffSummary.removedBullets.length > 0 && (
						<div>
							<h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
								<MinusIcon className="h-4 w-4 text-red-600" />
								Removed Bullet Points ({diffSummary.removedBullets.length})
							</h3>
							<div className="space-y-2">
								{diffSummary.removedBullets.map((bullet: any, index: number) => (
									<div key={index} className="border-l-4 border-red-500 pl-3 py-1">
										<div className="text-xs text-gray-500 mb-1">{bullet.location}</div>
										<div className="text-sm text-gray-700 line-through opacity-75">
											{bullet.content}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{!hasChanges && (
						<div className="text-center py-8 text-gray-500">
							<p>Your resume is already well-optimized for this position!</p>
						</div>
					)}
				</div>

			</div>

			<div className="flex gap-2 mt-6 pt-4 border-t">
				<Button variant="outline" onClick={onRevert} className="flex-1">
					Revert Changes
				</Button>
				<Button
					onClick={onKeepChanges}
					className="flex-1 bg-green-600 hover:bg-green-700 text-white"
				>
					Keep Changes
				</Button>
			</div>
		</DialogModal>
	)
}
