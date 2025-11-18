/**
 * Formats ISO date strings for resume display based on precision
 *
 * @param isoDate - ISO format date string (e.g., "2023-06-01", "2023-01-01")
 * @param precision - How precise the date is: 'day', 'month', or 'year'
 * @returns Formatted date string (e.g., "Jun 2023", "2023", "Jun 15, 2023")
 *
 * @example
 * formatResumeDate("2023-06-01", "month") // "Jun 2023"
 * formatResumeDate("2023-01-01", "year")  // "2023"
 * formatResumeDate("2023-06-15", "day")   // "Jun 15, 2023"
 * formatResumeDate(null, null)            // "Present"
 */
export function formatResumeDate(
	isoDate: string | null,
	precision?: 'day' | 'month' | 'year' | null,
): string {
	// Handle null/Present case
	if (!isoDate) {
		return 'Present'
	}

	// Parse ISO date as local time to avoid timezone conversion issues
	// ISO format: YYYY-MM-DD
	const parts = isoDate.split('-')
	if (parts.length !== 3) {
		console.warn(`Invalid date format: ${isoDate}`)
		return isoDate
	}

	const year = parseInt(parts[0], 10)
	const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
	const day = parseInt(parts[2], 10)

	const date = new Date(year, month, day)

	// Handle invalid dates
	if (isNaN(date.getTime())) {
		console.warn(`Invalid date: ${isoDate}`)
		return isoDate // Return original if can't parse
	}

	// Format based on precision
	switch (precision) {
		case 'day':
			// "Jun 15, 2023"
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
			})

		case 'month':
			// "Jun 2023"
			return date.toLocaleDateString('en-US', {
				month: 'short',
				year: 'numeric',
			})

		case 'year':
			// "2023"
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
			})

		default:
			// Default to month precision if not specified
			return date.toLocaleDateString('en-US', {
				month: 'short',
				year: 'numeric',
			})
	}
}

/**
 * Formats a date range for resume display
 *
 * @example
 * formatResumeDateRange("2023-06-01", "month", null, null)
 * // "Jun 2023 – Present"
 *
 * formatResumeDateRange("2020-01-01", "year", "2022-12-01", "month")
 * // "2020 – Dec 2022"
 */
export function formatResumeDateRange(
	startDate: string | null,
	startPrecision?: 'day' | 'month' | 'year' | null,
	endDate?: string | null,
	endPrecision?: 'day' | 'month' | 'year' | null,
): string {
	const start = formatResumeDate(startDate, startPrecision)
	const end = formatResumeDate(endDate || null, endPrecision)
	return `${start} – ${end}`
}
