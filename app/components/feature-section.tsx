import { MagnifyingGlassIcon, ChatBubbleBottomCenterTextIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'

export function FeatureSection() {
  const features = [
    {
      title: 'Spend Less Time\non Your Job Search',
      icon: MagnifyingGlassIcon,
    },
    {
      title: 'Get More\nInterviews',
      icon: ChatBubbleBottomCenterTextIcon,
    },
    {
      title: 'Land Your\nNext Job',
      icon: CheckBadgeIcon,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-8 py-12 md:grid-cols-3 md:gap-12 rounded-xl max-w-4xl mx-auto shadow-lg p-8 mt-10 bg-muted">
      {features.map((feature, index) => (
        <div key={index} className="flex flex-col items-center text-center">
          <feature.icon className="h-12 w-12 text-brand-500" />
          <h3 className="mt-4 whitespace-pre-line text-xl font-bold">
            {feature.title}
          </h3>
        </div>
      ))}
    </div>
  )
} 