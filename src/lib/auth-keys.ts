/**
 * 认证缓存用到的键和有效期。
 *
 * 单独放一个没有任何 import 的模块，是为了切断 `lib/auth.ts` 和 `hooks/use-auth.ts` 之间的循环依赖：
 * use-auth.ts 在模块顶层就会调用 getPemFromCache()，如果这些常量还定义在 auth.ts 里，
 * 循环引用时 auth.ts 还没执行到 const 初始化，就会报
 * "Cannot access 'GITHUB_PEM_CACHE_KEY' before initialization"。
 */

/** GitHub Installation Token 的缓存键（sessionStorage，随标签页关闭失效） */
export const GITHUB_TOKEN_CACHE_KEY = 'github_token'

/** 加密后的私钥缓存键（localStorage） */
export const GITHUB_PEM_CACHE_KEY = 'p_info'

/** 私钥缓存的过期时间戳（localStorage） */
export const GITHUB_PEM_EXP_KEY = 'p_info_exp'

/** 私钥在本机缓存多久：2 小时 */
export const PEM_CACHE_TTL = 2 * 60 * 60 * 1000
