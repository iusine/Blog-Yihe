import { commitFiles, fileTreeItem } from '@/lib/github-commit'
import type { TreeItem } from '@/lib/github-client'

export type Device = {
	id: string
	name: string
	model: string
	category: string
	year?: string
	brand?: string
	status?: string
	description: string
	specs: string
	image: string
}

export async function pushDevices(devices: Device[]): Promise<Device[]> {
	return commitFiles<Device[]>({
		message: '更新设备列表',
		successMessage: '设备列表已保存并同步！',
		notifyLocalSync: true,
		prepare: async ctx => {
			const treeItems: TreeItem[] = [
				fileTreeItem('src/app/more/devices/list.json', await ctx.blobFromJson(devices, 2))
			]
			return { treeItems, result: devices }
		}
	})
}
