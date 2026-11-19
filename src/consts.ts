export const INIT_DELAY = 0.3
export const ANIMATION_DELAY = 0.1
export const CARD_SPACING = 36
export const CARD_SPACING_SM = 24

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
    /** 留言、随笔等动态数据放在这个分支，写入不会触发生产部署 */
    DATA_BRANCH: process.env.NEXT_PUBLIC_GITHUB_DATA_BRANCH || 'data',
    APP_ID: process.env.NEXT_PUBLIC_GITHUB_APP_ID || '5776856',
    ENCRYPT_KEY: process.env.NEXT_PUBLIC_GITHUB_ENCRYPT_KEY || '',
} as const
