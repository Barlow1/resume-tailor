type HRFlowOptions = {
	api_email: string
	api_key: string
}

class HrFlow {
	api_email: string
	api_key: string
	headers: Record<string, string>
	url = 'https://api.hrflow.ai'
	constructor(options: HRFlowOptions) {
		this.api_email = options.api_email
		this.api_key = options.api_key

		this.headers = {
			accept: 'application/json',
			'X-API-KEY': this.api_key,
			'X-USER-EMAIL': this.api_email,
		}
	}
	authenticate() {
		const options = {
			method: 'GET',
			headers: this.headers,
			path: 'resumePath',
			baseUrl: this.url,
			hr: '',
		}
		const authUrl = `${this.url}/v1/auth`
		fetch(authUrl, options)
			.then(res => res.json())
			.then(json => console.log(json))
			.catch(err => console.error('error:' + err))
	}

	async parseResume(buffer: File) {
		const formData = new FormData()
		const parseUrl = `${this.url}/v1/profile/parsing/file`
		formData.append('source_key', process.env.HRFLOWAI_SOURCE_KEY ?? '')
		formData.append('file', buffer, buffer.name)
		formData.append('sync_parsing', '1')
		formData.append('sync_parsing_indexing', '1')

		const request = new Request(parseUrl, {
			body: formData,
			method: 'POST',
			headers: this.headers,
		})

		const response = (await fetch(request).then(res =>
			res.json(),
		)) as ResumeParsingResult
		return response.data
	}
}

export async function parseResume(buffer: File) {
	const hrflow = new HrFlow({
		api_email: process.env.HRFLOWAI_EMAIL ?? '',
		api_key: process.env.HRFLOWAI_API_KEY ?? '',
	})
	return hrflow.parseResume(buffer)
}

export interface ResumeParsingResult {
	code: number
	message: string
	data: {
		profile: Profile
		parsing: Parsing
	}
}

export interface Profile {
	source_key: string
	id: number
	key: string
	reference: any
	consent_algorithmic: ConsentAlgorithmic
	source: Source
	archive: any
	archived_at: any
	updated_at: string
	created_at: string
	info: Info
	text_language: string
	text: string
	experiences_duration: number
	educations_duration: number
	experiences: Experience[]
	educations: Education[]
	attachments: Attachment[]
	skills: Skill[]
	languages: any[]
	certifications: any[]
	courses: any[]
	tasks: any[]
	interests: any[]
	labels: any[]
	tags: Tag[]
	metadatas: any[]
}

export interface ConsentAlgorithmic {
	owner: Owner
	controller: Controller
}

export interface Owner {
	parsing: boolean
	revealing: boolean
	embedding: boolean
	searching: boolean
	scoring: boolean
	reasoning: boolean
}

export interface Controller {
	parsing: boolean
	revealing: boolean
	embedding: boolean
	searching: boolean
	scoring: boolean
	reasoning: boolean
}

export interface Source {
	key: string
	name: string
	type: string
	subtype: string
	environment: string
}

export interface Info {
	full_name: string
	first_name: string
	last_name: string
	email: string
	phone: string
	date_birth: string
	location: Location
	urls: Url[]
	picture: string
	gender: string
	summary: string
}

export interface Location {
	text: string
	lat: number
	lng: number
	gmaps: any
	fields: Fields
}

export interface Fields {
	category: any
	city: string
	city_district: any
	country: string
	country_region: any
	entrance: any
	house: any
	house_number: any
	island: any
	level: any
	near: any
	po_box: any
	postcode: any
	road: any
	staircase: any
	state: string
	state_district: string
	suburb: any
	text: string
	unit: any
	world_region: any
}

export interface Url {
	type: string
	url: string
}

export interface Experience {
	key: string
	title: string
	description: string
	location: Location
	date_start: string
	date_end: string
	skills: Skill[]
	certifications: any[]
	courses: any[]
	tasks: Task[]
	company: string
}

export interface Skill {
	name: string
	type: string
	value: any
}

export interface Task {
	name: string
	value: any
}

export interface Education {
	key: string
	title: string
	description: string
	location: Location
	date_start: string
	date_end: string
	skills: any[]
	certifications: any[]
	courses: any[]
	tasks: any[]
	school: string
}

export interface Attachment {
	type: string
	alt: string
	file_size: number
	file_name: string
	original_file_name: string
	extension: string
	public_url: string
	updated_at: string
	created_at: string
}

export interface Tag {
	name: string
	value: any
}

export interface Parsing {
	certifications: any[]
	content_uid: string
	courses: any[]
	date_birth: DateBirth
	driving_license: any
	educations: Education[]
	educations_duration: number
	emails: string[]
	experiences: Experience[]
	experiences_duration: number
	file_name: string
	file_size: number
	gender: string
	images: any
	interests: any[]
	key: string
	languages: any[]
	location: Location
	persons: Person[]
	phones: string[]
	picture: string
	processed_pages: number
	skills: Skill[]
	summary: string
	tasks: any[]
	text: string
	text_language: string
	total_pages: number
	urls: Url[]
}

export interface DateBirth {
	iso8601: string
	text: string
	timestamp: number
}

export interface DateEnd {
	iso8601: string
	text: string
	timestamp: number
}

export interface DateStart {
	iso8601: string
	text: string
	timestamp: number
}

export interface Geojson {
	category: any
	city: any
	city_district: any
	country: any
	country_region: any
	entrance: any
	house: any
	house_number: any
	island: any
	level: any
	near: any
	po_box: any
	postcode: any
	road: any
	staircase: any
	state: any
	state_district: any
	suburb: any
	unit: any
	world_region: any
}

export interface Person {
	first_name: string
	full_name: string
	last_name: string
}
