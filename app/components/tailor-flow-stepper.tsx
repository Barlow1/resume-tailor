/**
 * In-builder progress stepper to guide users through the tailoring flow
 */

import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'
import type { BuilderJob } from '~/utils/builder-resume.server.ts'

interface TailorFlowStepperProps {
	hasResume: boolean
	selectedJob: BuilderJob | null | undefined
	hasTailored?: boolean
	className?: string
}

interface StepProps {
	number: number
	status: 'complete' | 'active' | 'disabled'
	label: string
}

function Step({ number, status, label }: StepProps) {
	const statusStyles = {
		complete: 'bg-green-600 text-white border-green-600',
		active: 'bg-blue-600 text-white border-blue-600',
		disabled: 'bg-gray-200 text-gray-500 border-gray-300',
	}

	const labelStyles = {
		complete: 'text-gray-900 font-medium',
		active: 'text-blue-900 font-bold',
		disabled: 'text-gray-500',
	}

	return (
		<div className="flex flex-col items-center">
			<div
				className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${statusStyles[status]} ${status === 'active' ? 'animate-pulse-border' : ''}`}
			>
				{status === 'complete' ? (
					<CheckCircleSolidIcon className="h-6 w-6" />
				) : (
					<span className="text-sm font-bold">{number}</span>
				)}
			</div>
			<div className={`text-sm mt-2 text-center ${labelStyles[status]}`}>{label}</div>
		</div>
	)
}

function Arrow({ active }: { active: boolean }) {
	return (
		<ArrowRightIcon
			className={`h-5 w-5 mx-2 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-300'}`}
		/>
	)
}

export function TailorFlowStepper({ hasResume, selectedJob, hasTailored = false, className = '' }: TailorFlowStepperProps) {
	// Determine current step
	const currentStep = !hasResume ? 1 : !selectedJob ? 2 : !hasTailored ? 3 : 4

	const steps = [
		{
			number: 1,
			status: hasResume ? 'complete' : 'active',
			label: 'Upload Resume',
		},
		{
			number: 2,
			status: !hasResume ? 'disabled' : selectedJob ? 'complete' : 'active',
			label: 'Select Job',
		},
		{
			number: 3,
			status: !selectedJob ? 'disabled' : hasTailored ? 'complete' : 'active',
			label: 'Tailor Resume',
		},
		{
			number: 4,
			status: !hasTailored ? 'disabled' : 'active',
			label: 'Download & Apply',
		},
	] as const

	// Get next action message
	const getNextActionMessage = () => {
		if (!hasResume) {
			return '👆 Start by uploading your resume or creating one from scratch above'
		}
		if (!selectedJob) {
			return '👆 Select a job from the dropdown to tailor your resume'
		}
		if (!hasTailored) {
			return '👆 Click "Tailor to Job" to optimize your resume for this position'
		}
		return '🎉 Great! Your resume is tailored. Download it and start applying!'
	}

	return (
		<div className={`bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg ${className}`}>
			{/* Steps */}
			<div className="flex items-center justify-center mb-4">
				{steps.map((step, index) => (
					<div key={step.number} className="flex items-center">
						<Step {...step} />
						{index < steps.length - 1 && <Arrow active={step.status === 'complete'} />}
					</div>
				))}
			</div>

			{/* Next Action Message */}
			<div className="bg-white rounded-lg p-3 border border-blue-200">
				<p className="text-base text-blue-900 text-center font-medium">
					{getNextActionMessage()}
				</p>
			</div>

			{/* Optional: Progress bar */}
			<div className="mt-3">
				<div className="w-full bg-gray-200 rounded-full h-2">
					<div
						className="bg-blue-600 h-2 rounded-full transition-all duration-500"
						style={{ width: `${(currentStep / 4) * 100}%` }}
					/>
				</div>
			</div>
		</div>
	)
}
