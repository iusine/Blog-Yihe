'use client'

import { useEffect, useRef } from 'react'

/**
 * Neuro Noise 背景。
 *
 * 一个全屏 WebGL 片元着色器：用两层 domain warping 的 fbm 噪声做出缓慢流动的
 * 「神经噪声」纹理，再叠一点发光的脉络和暗角，整体压得很暗，玻璃卡片和白字压在上面。
 *
 * 性能取舍：
 * - 画布按 0.8 倍分辨率渲染，再由 CSS 拉满，噪声本身平滑，看不出糊；
 * - 上限约 250 万像素，4K 屏也不会把显卡跑满；
 * - 30fps 就够了（运动很慢），页面隐藏时暂停，系统开了「减少动态效果」就只画一帧。
 */

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
	gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	mat2 rotation = mat2(0.8, 0.6, -0.6, 0.8);

	for (int i = 0; i < 5; i++) {
		value += amplitude * noise(p);
		p = rotation * p * 2.03;
		amplitude *= 0.5;
	}

	return value;
}

void main() {
	vec2 uv = gl_FragCoord.xy / uResolution.xy;
	vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
	p *= 2.15;

	float t = uTime * 0.06;

	// 两次 domain warp，噪声才会像流动的神经组织而不是普通云雾
	vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
	vec2 r = vec2(
		fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.5),
		fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.4)
	);
	float f = fbm(p + 4.0 * r);

	// 细的发光脉络
	float veins = 1.0 - smoothstep(0.0, 0.42, abs(f - 0.5));

	vec3 base = vec3(0.016, 0.024, 0.047);
	vec3 teal = vec3(0.10, 0.62, 0.76);
	vec3 indigo = vec3(0.16, 0.30, 0.80);
	vec3 violet = vec3(0.46, 0.20, 0.82);
	vec3 magenta = vec3(0.62, 0.16, 0.46);

	vec3 color = base;
	color += teal * smoothstep(0.20, 0.80, f) * 0.40;
	color += indigo * (1.0 - smoothstep(0.0, 0.95, length(q))) * 0.55;
	color += violet * r.x * 0.42;
	color += magenta * smoothstep(0.55, 0.95, q.x) * 0.16;
	color += mix(teal, violet, q.y) * veins * 0.26;

	// 暗角：四周压下去，中间的玻璃卡片更突出
	float vignette = smoothstep(0.32, 0.98, length((uv - 0.5) * vec2(1.06, 1.0)));
	color *= 1.0 - 0.58 * vignette;

	// 整体压一档，保证白字在卡片上的对比度（最亮处也留在 40% 亮度左右）
	color *= 0.86;

	// 轻微颗粒，避免深色区域出现色带
	color += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.012;

	gl_FragColor = vec4(color, 1.0);
}
`

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)
	if (!shader) return null
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('Neuro noise shader compile failed:', gl.getShaderInfoLog(shader))
		gl.deleteShader(shader)
		return null
	}
	return shader
}

export default function NeuroNoiseBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }) ||
			canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null

		if (!gl) {
			canvas.dataset.status = 'fallback'
			return
		}

		const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
		const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
		const program = gl.createProgram()

		if (!vertex || !fragment || !program) {
			canvas.dataset.status = 'fallback'
			return
		}

		gl.attachShader(program, vertex)
		gl.attachShader(program, fragment)
		gl.linkProgram(program)

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Neuro noise program link failed:', gl.getProgramInfoLog(program))
			canvas.dataset.status = 'fallback'
			return
		}

		gl.useProgram(program)

		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

		const position = gl.getAttribLocation(program, 'aPosition')
		gl.enableVertexAttribArray(position)
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

		const resolutionUniform = gl.getUniformLocation(program, 'uResolution')
		const timeUniform = gl.getUniformLocation(program, 'uTime')

		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
		let raf = 0
		let lastFrame = 0
		let elapsed = 0
		let running = true

		const resize = () => {
			const width = window.innerWidth
			const height = window.innerHeight
			const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1) * 0.8, 1.25)
			let pixelWidth = Math.floor(width * scale)
			let pixelHeight = Math.floor(height * scale)

			// 大屏封顶，别让 4K 白烧 GPU
			const maxPixels = 2_500_000
			const pixels = pixelWidth * pixelHeight
			if (pixels > maxPixels) {
				const factor = Math.sqrt(maxPixels / pixels)
				pixelWidth = Math.floor(pixelWidth * factor)
				pixelHeight = Math.floor(pixelHeight * factor)
			}

			if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
				canvas.width = pixelWidth
				canvas.height = pixelHeight
			}

			gl.viewport(0, 0, canvas.width, canvas.height)
			gl.uniform2f(resolutionUniform, canvas.width, canvas.height)
		}

		const draw = (time: number) => {
			gl.uniform1f(timeUniform, time)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
		}

		const frame = (now: number) => {
			if (!running) return
			// 30fps 节流
			if (now - lastFrame >= 1000 / 30) {
				elapsed = now / 1000
				draw(elapsed)
				lastFrame = now
				if (process.env.NODE_ENV !== 'production') (window as any).__neuroFrames = ((window as any).__neuroFrames ?? 0) + 1
			}
			raf = requestAnimationFrame(frame)
		}

		const onVisibility = () => {
			running = !document.hidden
			if (running) {
				lastFrame = 0
				raf = requestAnimationFrame(frame)
			} else {
				cancelAnimationFrame(raf)
			}
		}

		resize()
		draw(0)

		if (reduceMotion) {
			canvas.dataset.status = 'static'
		} else {
			canvas.dataset.status = 'running'
			raf = requestAnimationFrame(frame)
		}

		window.addEventListener('resize', resize)
		document.addEventListener('visibilitychange', onVisibility)

		// 开发环境留一个取样口，方便自动化里确认真的画出了颜色
		if (process.env.NODE_ENV !== 'production') {
			;(window as any).__neuroNoiseSample = (nx = 0.5, ny = 0.5) => {
				draw(elapsed || 0)
				const pixel = new Uint8Array(4)
				gl.readPixels(
					Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * nx))),
					Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * ny))),
					1,
					1,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					pixel
				)
				return Array.from(pixel)
			}
		}

		return () => {
			running = false
			cancelAnimationFrame(raf)
			window.removeEventListener('resize', resize)
			document.removeEventListener('visibilitychange', onVisibility)
			gl.deleteBuffer(buffer)
			gl.deleteProgram(program)
			gl.deleteShader(vertex)
			gl.deleteShader(fragment)
			delete (window as any).__neuroNoiseSample
		}
	}, [])

	return (
		<div className='pointer-events-none fixed inset-0 z-0 overflow-hidden' aria-hidden>
			{/* WebGL 不可用时的兜底渐变，效果接近，不会露出白底 */}
			<div
				className='absolute inset-0 -z-10'
				style={{
					background:
						'radial-gradient(70% 60% at 30% 20%, rgba(24,120,150,0.35), transparent 65%), radial-gradient(60% 55% at 78% 15%, rgba(70,60,190,0.3), transparent 60%), linear-gradient(160deg, #0b1220, #080f1a)'
				}}
			/>
			<canvas ref={canvasRef} className='h-full w-full' />
			{/* 一层很淡的暗角，让边缘更沉一点 */}
			<div className='absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]' />
		</div>
	)
}
