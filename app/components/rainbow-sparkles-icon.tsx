export function RainbowSparklesIcon({
	className = '',
	id = 'default',
}: {
	className?: string
	id?: string
}) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			className={className}
		>
			<defs>
				<linearGradient id={`rainbow-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="#ff0000">
						<animate
							attributeName="stop-color"
							values="#ff0000;#ff4000;#ff8000;#ffbf00;#ffff00;#80ff00;#00ff00;#00ff80;#00ffff;#0080ff;#0000ff;#8000ff;#ff00ff;#ff0080;#ff0000"
							dur="4s"
							repeatCount="indefinite"
							calcMode="spline"
							keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
						/>
					</stop>
					<stop offset="100%" stopColor="#ff8000">
						<animate
							attributeName="stop-color"
							values="#ff8000;#ffbf00;#ffff00;#80ff00;#00ff00;#00ff80;#00ffff;#0080ff;#0000ff;#8000ff;#ff00ff;#ff0080;#ff0000;#ff4000;#ff8000"
							dur="4s"
							repeatCount="indefinite"
							calcMode="spline"
							keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
						/>
					</stop>
				</linearGradient>
			</defs>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				stroke={`url(#rainbow-${id})`}
				d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
			/>
		</svg>
	)
}
