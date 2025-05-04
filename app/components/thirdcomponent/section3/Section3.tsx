import React from 'react'

import right from '../../thirdcomponent/assets/right.svg'
import girl from '../../thirdcomponent/assets/girl-clear.png'
import man from '../../thirdcomponent/assets/man-clear.png'
import man2 from '../../thirdcomponent/assets/paper-clear.png'
import arrow from '../../thirdcomponent/assets/arw.svg'
import { Link } from '@remix-run/react'

function Section3() {
	return (
		<div className="mx-auto ">
			<section
				className="mx-auto flex h-auto  w-full flex-col items-center  justify-between px-12 pb-20 pt-64 md:flex-row md:px-20"
				style={{
					background:
						'linear-gradient(2deg, rgba(223, 228, 245, 1) 27%, rgba(245, 247, 252, 1) 50%, rgba(245, 247, 252, 1) 100%)',
				}}
			>
				<div className="mb-12 w-full md:mb-0 md:w-1/2">
					<h2 className="font-poppins mb-4 text-3xl font-semibold leading-tight text-gray-900 sm:text-[40px] md:text-[45px]">
						Trying To Find A New Job is Exhausting
					</h2>
					<p className="mb-2 text-lg text-[#757575] sm:text-[18px]">
						80% of resumes get rejected by robots before a human sees them.
					</p>
					<p className="mb-2 text-lg text-[#757575] sm:text-[18px]">
						Hours wasted applying... only to get auto-rejected.
					</p>
					<p className="mb-6 text-lg text-[#757575] sm:text-[18px]">
						Missed interviews for jobs you’re perfect for.
					</p>

					<h3 className="mb-3 text-lg font-semibold text-black sm:text-[22px] md:text-[30px]">
						The ATS doesn’t care about:
					</h3>
					<ul className="mb-6 space-y-2 text-[#757575]">
						{['Your hard work', 'Your career story', 'Your unique skills'].map(
							(item, index) => (
								<React.Fragment key={index}>
									<li className="flex items-start gap-2 text-lg text-[#757575] sm:text-[18px]">
										<img src={right} alt="icon" className="mt-1 h-4 w-4" />
										<span className="text-gray-800">{item}</span>
									</li>
									<hr className="border-t border-gray-300" />
								</React.Fragment>
							),
						)}
					</ul>

					<p className="mb-6 text-lg text-[#757575] sm:text-[18px]">
						It only cares about keywords. We’ll give your resume the right
						keywords in a way that still makes sense to recruiters.
					</p>

					<Link to={"/builder"} >
					<button className="font-poppins mx-auto mt-2 flex items-center gap-2 rounded-md bg-[#40BEA7] px-4 py-4 text-xl  text-white lg:mx-0">
						Build your AI Resume
						<img src={arrow} alt="arrow" className="h-6 w-6" />
					</button>
					</Link>
				</div>

				<div className="flex w-full items-center justify-center md:w-1/2">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div className="mb-6 flex flex-col items-center justify-center">
							<img
								src={girl}
								alt="Person reading resume"
								className="h-[234px] w-[226px] rounded-xl object-cover shadow-md"
							/>
							<div className="mt-4 flex h-[105px] w-[228px] items-center justify-center bg-[#6B45FE] text-center text-lg font-bold text-[#FFFFFF] shadow-md">
								2000+ <br /> Satisfied Clients
							</div>
						</div>

						<div className="flex flex-col items-center justify-center gap-4">
							<img
								src={man}
								alt="Person working at desk"
								className="h-[234px] w-[226px] rounded-xl object-cover shadow-md"
							/>
							<img
								src={man2}
								alt="Person with hologram UI"
								className="h-[234px] w-[226px] rounded-xl object-cover shadow-md"
							/>
						</div>
					</div>
				</div>
			</section>
		</div>
	)
}

export default Section3
