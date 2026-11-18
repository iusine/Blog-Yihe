import { commitFiles, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'

export type Skill = { id: string; name: string; category: string; level: string; description: string }
export async function pushSkills(skills: Skill[]): Promise<Skill[]> {
	return commitFiles<Skill[]>({ message: '更新技能列表', successMessage: '技能列表已保存并同步！', notifyLocalSync: true, prepare: async ctx => ({ treeItems: [fileTreeItem('src/app/more/skills/list.json', await ctx.blobFromJson(skills, 2)) as TreeItem], result: skills }) })
}
