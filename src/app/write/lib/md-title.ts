/** Strip common inline markdown markers from a plain title string. */
export function stripInlineMarkdown(text: string): string {
	let cur = text.trim()
	let prev = ''
	while (prev !== cur) {
		prev = cur
		cur = cur
			.replace(/\*\*(.+?)\*\*/g, '$1')
			.replace(/__(.+?)__/g, '$1')
			.replace(/\*(.+?)\*/g, '$1')
			.replace(/_(.+?)_/g, '$1')
			.replace(/`(.+?)`/g, '$1')
			.replace(/\\([\\`*_[\]{}()#+\-.!|>])/g, '$1')
			.trim()
	}
	return cur
}

/** 只匹配文档开头的 ATX h1（标题独立成行）。 */
const LEADING_H1 = /^#\s+([^\n]+)\n?/

/** Extract the leading ATX h1 (`# title`) from markdown. */
export function extractFirstH1(md: string): string {
	const match = md.match(LEADING_H1)
	return stripInlineMarkdown(match?.[1] || '')
}

/** Rewrite the leading h1 so TipTap bold/italic marks don't leak into `# **title**`. */
export function normalizeLeadingH1(md: string): string {
	return md.replace(LEADING_H1, (_, title: string) => `# ${stripInlineMarkdown(title)}\n`)
}

/** Remove the leading ATX h1 line from markdown. */
export function stripFirstH1(md: string): string {
	return md.replace(LEADING_H1, '').replace(/^\n+/, '')
}

/** 只有当正文首行 h1 与文章标题重复时才移除，避免误删正文里的 h1 章节。 */
export function stripLeadingH1IfMatches(md: string, title: string): string {
	const match = md.match(LEADING_H1)
	if (!match) return md
	const clean = stripInlineMarkdown(title)
	if (!clean) return md
	return stripInlineMarkdown(match[1]) === clean ? stripFirstH1(md) : md
}

/** Prepend `# title` when markdown has no leading h1 yet. */
export function ensureLeadingH1(md: string, title: string): string {
	const clean = stripInlineMarkdown(title)
	if (!clean || extractFirstH1(md)) return md
	const body = md.trimStart()
	return body ? `# ${clean}\n\n${body}` : `# ${clean}\n`
}
