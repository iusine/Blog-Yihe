export type MessageVisibility = 'public' | 'owner'

/** 仓库里 public/message/list.json 的一条留言 */
export type Message = {
	id: string
	createdAt: string
	visibility: MessageVisibility
	/** 是否匿名（匿名的留言不显示留言者） */
	anonymous: boolean
	/** 公开留言才有：留言者名字 */
	author?: string
	/** 公开留言才有：留言内容（明文） */
	content?: string
	/** 仅站主看见：加密后的 { author, content, deliverEmail } */
	cipher?: string
	/** 需要代发时，加密后的收件邮箱 */
	deliverCipher?: string
	/** 站主标记：已代发 */
	sent?: boolean
}

/** 前端解密后的仅站主留言 */
export type OwnerMessage = {
	author?: string
	content: string
	deliverEmail?: string
}

export type MessageDraft = {
	author: string
	anonymous: boolean
	content: string
	sendToOther: boolean
	deliverEmail: string
	ownerOnly: boolean
}

/** 代发邮件正文的开头，按需求自动填充 */
export const MAIL_PREFIX = '您好，这里是一禾邮箱代发：\n我的邮箱号是 yh_film@163.com，需要什么关键信息你和我说。'

export const OWNER_EMAIL = 'yh_film@163.com'

/** 普通留言最多 100 字，勾选代发后放宽到 2000 字 */
export const CONTENT_LIMIT = 100
export const CONTENT_LIMIT_LONG = 2000

export function contentLimit(sendToOther: boolean): number {
	return sendToOther ? CONTENT_LIMIT_LONG : CONTENT_LIMIT
}

/** 拼出要复制/发送给 TA 的邮件正文 */
export function buildMailBody(message: { content: string; author?: string; anonymous?: boolean }): string {
	const who = message.anonymous ? '一位匿名访客' : message.author || '一位访客'
	return `${MAIL_PREFIX}\n\n${message.content}\n\n—— 来自留言墙 · ${who}`
}
