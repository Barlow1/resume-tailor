import customer from '../../thirdcomponent/assets/image 33.png'
import svg from '../../thirdcomponent/assets/image 41.svg'

const testimonial = {
	name: 'Christian Barlow',
	role: 'Software Engineer',
	text: `"This might be the best ai resume builder I've used. Most cost $20-30 a month... For $7.99 I sent 20 resumes and got 3 interviews. Game-changer."`,
	image: customer,
}

const Section6 = () => {
	const { name, role, text, image } = testimonial

	return (
		<div className="mx-auto w-full bg-white px-6 py-16 text-black">
			<h2 className="poppins-semibold mb-10 text-center text-[32px] font-bold text-black md:text-[45px]">
				Success Stories
			</h2>

			<div className="relative mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-12 rounded-xl p-6 md:flex-row md:p-10">
				{/* Left - Image */}
				<div className="relative w-full max-w-[300px] flex-shrink-0 md:max-w-[350px]">
					<div className="relative">
						<img
							src={image}
							alt={name}
							className="h-auto w-full rounded-xl object-cover"
						/>

						{/* Star Badge */}
						<div className="absolute -left-4 top-4 flex h-14 w-14 items-center justify-center rounded-full bg-white p-3 shadow-md">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="#FACC15"
								viewBox="0 0 24 24"
								className="h-10 w-10"
							>
								<path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.78 1.4 8.17L12 18.896l-7.334 3.864 1.4-8.17L.132 9.21l8.2-1.192z" />
							</svg>
						</div>

						{/* Curved Arrow */}
						<div className="absolute -right-12 top-1/2 hidden -translate-y-1/2 md:block">
							<img src={svg} alt="Curved Arrow" className="h-auto w-24" />
						</div>
					</div>
				</div>

				{/* Right - Text Section */}
				<div className="relative flex w-full max-w-[520px] text-center md:text-justify flex-col justify-between">
					<p className="mb-6 whitespace-pre-line break-words text-base leading-relaxed text-gray-700 md:text-[20px] md:leading-[30px]">
						{text}
					</p>

					<div>
						<h3 className="text-[24px] font-bold text-black md:text-[30px]">
							{name}
						</h3>
						<p className="text-[18px] text-gray-500 md:text-[23px]">{role}</p>
					</div>
				</div>
			</div>
		</div>
	)
}

export default Section6
