import { Icon } from '~/components/ui/icon.tsx'
import { SkillEditor } from '~/routes/resources+/skill-editor.tsx'

export const handle = {
	breadcrumb: <Icon name="plus">Add Skill</Icon>,
}

export default function EditSkillRoute() {
	return <SkillEditor />
}
