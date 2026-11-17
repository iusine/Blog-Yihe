/**
 * 当前会话里的私钥（只在内存）。
 *
 * 单独放一个没有任何 import 的模块，让 `lib/auth.ts` 能读到私钥，
 * 而不用去 import zustand store（`hooks/use-auth.ts`）——那样会形成
 * auth → use-auth → auth 的循环依赖，模块初始化顺序一变就在顶层的
 * localStorage 访问上报 TDZ / undefined 错误。
 *
 * 写入时机：导入私钥、从本地缓存恢复、清除登录态。
 */

let currentPrivateKey: string | null = null

export function getPrivateKey(): string | null {
	return currentPrivateKey
}

export function setPrivateKeyValue(key: string | null): void {
	currentPrivateKey = key
}
