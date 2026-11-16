export const INIT_DELAY = 0.3
export const ANIMATION_DELAY = 0.1
export const CARD_SPACING = 36
export const CARD_SPACING_SM = 24
export const BLOG_SLUG_KEY = process.env.BLOG_SLUG_KEY || ''

/**
 * [新增] 点赞接口地址。
 * 参考仓库把原作者自己的 Cloudflare Worker 地址（blog-liker.yysuni1001.workers.dev）写死在
 * components/like-button.tsx 里，别人部署起来这个请求必然失败，控制台会报跨域/超时错误。
 * 这里改成从环境变量读取，默认留空 = 只保留本地点赞动画，不发任何网络请求。
 * 想启用就在 .env.local 里写 NEXT_PUBLIC_LIKE_API=https://你的服务/api/like
 */
export const LIKE_API = process.env.NEXT_PUBLIC_LIKE_API || ''

/**
 * GitHub 仓库配置。
 *
 * 安全约定：**这个文件会被推送到公开仓库**，所以任何口令、私钥都不许写在这里。
 * - OWNER / REPO / BRANCH / APP_ID 是公开标识（App ID 会出现在 JWT 里），可以留默认值；
 * - ENCRYPT_KEY 是加密浏览器里缓存的 .pem 私钥的口令，属于私密信息，
 *   只能来自环境变量（.env.local / 部署平台的环境变量），仓库里不保留任何默认值。
 */
export const GITHUB_CONFIG = {
    OWNER: process.env.NEXT_PUBLIC_GITHUB_OWNER || 'iusine',
    REPO: process.env.NEXT_PUBLIC_GITHUB_REPO || 'Blog-Yihe',
    BRANCH: process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main',
    APP_ID: process.env.NEXT_PUBLIC_GITHUB_APP_ID || '5776856',
    ENCRYPT_KEY: process.env.NEXT_PUBLIC_GITHUB_ENCRYPT_KEY || '',
} as const
