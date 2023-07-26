import { Icon } from '~/components/ui/icon.tsx'
import { ExperienceEditor } from '~/routes/resources+/experience-editor.tsx'
export const handle = {
	breadcrumb: <Icon name="plus">Add Experience</Icon>,
}
export default function NewExperienceRoute() {
	return <ExperienceEditor />
}
