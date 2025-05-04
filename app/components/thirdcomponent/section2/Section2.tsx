import React from 'react'

import img1 from '../../thirdcomponent/assets/paper.svg'
import paper3 from '../../thirdcomponent/assets/paper3.svg'
import img2 from '../../thirdcomponent/assets/adminIcon.svg'
import img3 from '../../thirdcomponent/assets/magnify.svg'
import img4 from '../../thirdcomponent/assets/magnify2.svg'
import img5 from '../../thirdcomponent/assets/dollar.svg'
import img6 from '../../thirdcomponent/assets/lines.svg'

function Section2() {
	return (
		<div className="mx-auto mb-3 md:mb-0 text-center flex md:h-[275.98px] lg:w-[1196px] flex-col rounded-xl shadow-lg p-20 md:p-0 gap-10 md:gap-0 bg-white md:flex-row">
			<div className="flex   h-full flex-1 items-center justify-center  ">
				<div className=' flex flex-col gap-4 ' >
				<div className=" relative m-auto h-[67.64px] w-[54.27px] bg-white">
					{/* First/Main SVG */}
					<img src={img1} alt="Main Icon" className="h-full w-full" />

					{/* Second SVG - Center of First */}
					<img
						src={img2}
						alt="Center Icon"
						className="absolute inset-0 m-auto h-[45.58px] w-[33.66px]"
					/>

					{/* Third SVG - Bottom Right of First */}
					<div className="absolute -bottom-2.5 -right-2.5 z-10 h-[31.1px] w-[31.1px]">
						<img
							src={img3}
							alt="Corner Icon"
							className="h-full w-full bg-white"
						/>

						{/* Fourth SVG - Bottom Right of Third */}
						<img
							src={img4}
							alt="Small Corner Icon"
							className="absolute -bottom-1.5 -right-1.5 z-20 h-[13.41px] w-[13.41px]"
						/>
					</div>
					
				</div>
				<p className='text-[22.75px] font-bold text-black font-inter ' >Pass ATS screens</p>
				</div>
			</div>

			<div className="flex  h-full flex-1 items-center justify-center ">
				<div className='flex flex-col gap-4' >
				<div className="relative m-auto h-[67.64px] w-[54.27px] bg-white">
					{/* First SVG - base icon */}
					<img src={img1} alt="Paper Icon" className="h-full w-full" />

					{/* Second SVG - centered over the first */}
					<img
						src={img2}
						alt="Vector Icon"
						className="absolute left-1/2 top-1/2 h-[45.58px] w-[33.66px] -translate-x-1/2 -translate-y-1/2"
					/>
				</div>
				<p className='text-[22.75px] font-bold text-black font-inter ' >2x more interviews</p>
				</div>
			</div>

			{/* Third Column */}
			<div className="flex  h-full flex-1 items-center justify-center ">
				<div className='flex flex-col gap-4' >
				<div className="relative z-50 m-auto h-[67.64px] w-[54.27px] ">
			
					{/* Main SVG (Base) */}
					<img src={paper3} alt="Paper Icon" className="h-full w-full" />

					{/* Second SVG - Centered in the main */}
					<img
						src={img5}
						alt="Overlay Icon 1"
						className="absolute left-1/3 top-1/3 z-50 h-[22.83px] w-[12.24px] translate-x-0.5 -translate-y-[50%] "
					/>

					{/* Third SVG - Just below the second SVG */}
					<img
						src={img6}
						alt="Overlay Icon 2"
						className="absolute left-4 top-1/2 h-[11.85px] w-[28.4px] translate-y-[40%]"
					/>
				</div>
				<p className='text-[22.75px] font-bold text-black font-inter ' >Higher paying jobs</p>
				</div>
			</div>
		</div>
	)
}

export default Section2
