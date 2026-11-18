'use client'

/**
 * 「仅站主看见」和「代发邮箱」用到的加密。
 *
 * 思路是标准的混合加密：
 * 1. 随机生成一把 AES-GCM 256 位一次性密钥，加密正文；
 * 2. 用站主的 RSA 公钥（RSA-OAEP / SHA-256）加密这把一次性密钥；
 * 3. 两段一起存进仓库。访客手上没有私钥，解不开；站主导入 .pem 后才能解。
 *
 * 公钥由站主从私钥推导出来，发布到 `public/message/owner-key.pem`（公钥公开是安全的）。
 */

function pemToArrayBuffer(pem: string): ArrayBuffer {
	const base64 = pem
		.replace(/-----BEGIN [^-]+-----/g, '')
		.replace(/-----END [^-]+-----/g, '')
		.replace(/\s+/g, '')
	const binary = atob(base64)
	const buffer = new ArrayBuffer(binary.length)
	const bytes = new Uint8Array(buffer)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return buffer
}

function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
	return btoa(binary)
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
	const binary = atob(value)
	const buffer = new ArrayBuffer(binary.length)
	const bytes = new Uint8Array(buffer)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return buffer
}

/** 把 base64 按 64 列折行，拼成标准 PEM */
function wrapPem(base64: string, label: string): string {
	const lines = base64.match(/.{1,64}/g) ?? [base64]
	return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

/** 把私钥统一规整成 PKCS#8，WebCrypto 只认这个格式（用户的 .pem 可能是 PKCS#1） */
async function normalizePrivatePem(privatePem: string): Promise<string> {
	// jsrsasign 只在这里用到，按需加载，访客打开留言墙时不必下载它
	const { KEYUTIL } = await import('jsrsasign')
	const key = KEYUTIL.getKey(privatePem) as any
	if (!key) throw new Error('私钥无法解析')
	return KEYUTIL.getPEM(key, 'PKCS8PRV')
}

/** 从私钥 PEM 推导出公钥 PEM（公钥可以公开） */
export async function derivePublicKeyPem(privatePem: string): Promise<string> {
	const normalized = await normalizePrivatePem(privatePem)
	const privateKey = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(normalized), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'])

	// 不能直接把私钥导出成 spki，先取 n/e 组出公钥 JWK，再导出 SPKI
	const jwk = await crypto.subtle.exportKey('jwk', privateKey)
	const publicKey = await crypto.subtle.importKey(
		'jwk',
		{ kty: 'RSA', n: jwk.n, e: jwk.e, ext: true },
		{ name: 'RSA-OAEP', hash: 'SHA-256' },
		true,
		['encrypt']
	)
	const spki = await crypto.subtle.exportKey('spki', publicKey)
	return wrapPem(bufferToBase64(spki), 'PUBLIC KEY')
}

async function importOwnerPublicKey(publicPem: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('spki', pemToArrayBuffer(publicPem), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
}

async function importOwnerPrivateKey(privatePem: string): Promise<CryptoKey> {
	const normalized = await normalizePrivatePem(privatePem)
	return crypto.subtle.importKey('pkcs8', pemToArrayBuffer(normalized), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
}

/** 用站主公钥加密一段文字 */
export async function encryptForOwner(plain: string, publicPem: string): Promise<string> {
	const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
	const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
	const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plain))
	const rawKey = await crypto.subtle.exportKey('raw', aesKey)

	const publicKey = await importOwnerPublicKey(publicPem)
	const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey)

	return `v1.${bufferToBase64(iv.buffer as ArrayBuffer)}.${bufferToBase64(wrappedKey)}.${bufferToBase64(cipherBuffer)}`
}

/** 用站主私钥解密（只有导入 .pem 之后才能调用） */
export async function decryptFromOwner(cipher: string, privatePem: string): Promise<string> {
	const [version, ivPart, keyPart, dataPart] = cipher.split('.')
	if (version !== 'v1' || !ivPart || !keyPart || !dataPart) throw new Error('密文格式不正确')

	const privateKey = await importOwnerPrivateKey(privatePem)
	const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToArrayBuffer(keyPart))
	const aesKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'])

	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToArrayBuffer(ivPart) }, aesKey, base64ToArrayBuffer(dataPart))
	return new TextDecoder().decode(plain)
}
