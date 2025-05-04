import React from 'react'
import Hero from '~/components/thirdcomponent/hero/Hero.tsx'
// import CommonWrapper from '~/components/thirdcomponent/common/CommonWrapper.tsx'
// import Section2 from '~/components/thirdcomponent/section2/Section2.tsx'
import Section3 from '~/components/thirdcomponent/section3/Section3.tsx'
import Section4 from '~/components/thirdcomponent/section4/Section4.tsx'
import Section5 from '~/components/thirdcomponent/section5/Section5.tsx'
import Section6 from '~/components/thirdcomponent/section6/Section6.tsx'
import Section7 from '~/components/thirdcomponent/section7/Section7.tsx'
import Section8 from '~/components/thirdcomponent/section8/Section8.tsx'

const ResumeBuilder = () => {
	return (
		// px-4 sm:px-6 lg:px-8
			<div className='-my-10 mx-auto' >
				<Hero />
				{/* <Section2 /> */}
				<Section3 />
				<Section4 />
				<Section5 />
				<Section6 />
				<Section7 />
				<Section8 />
			</div>
		
	)
}

export default ResumeBuilder