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

vec2 hash2(vec2 p) {
	return vec2(hash(p), hash(p + 17.13));
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

	for (int i = 0; i < 4; i++) {
		value += amplitude * noise(p);
		p = rotation * p * 2.03;
		amplitude *= 0.5;
	}

	return value;
}

// F1 / F2 / F3：最近、次近、第三近的细胞核距离。
// F2 - F1 小 = 靠近两个细胞的边界；F3 - F1 小 = 三个细胞交汇的节点。
vec3 voronoi(vec2 p, float t) {
	vec2 cell = floor(p);
	vec2 local = fract(p);

	float d1 = 8.0;
	float d2 = 8.0;
	float d3 = 8.0;

	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 offset = vec2(float(x), float(y));
			vec2 point = hash2(cell + offset);
			// 细胞核缓慢游动，边界就会跟着流动
			point = 0.5 + 0.42 * sin(t + 6.2831 * point);

			vec2 r = offset + point - local;
			float d = dot(r, r);

			if (d < d1) {
				d3 = d2;
				d2 = d1;
				d1 = d;
			} else if (d < d2) {
				d3 = d2;
				d2 = d;
			} else if (d < d3) {
				d3 = d;
			}
		}
	}

	return vec3(sqrt(d1), sqrt(d2), sqrt(d3));
}

void main() {
	vec2 uv = gl_FragCoord.xy / uResolution.xy;
	vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
	p *= 3.4;

	float t = uTime * 0.045;

	// 先用低频噪声揉一下坐标，细胞边界才会像神经纤维一样弯曲
	vec2 warp = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(4.7, 1.3) - t));
	vec2 q = p + 0.6 * warp;

	vec3 v = voronoi(q, uTime * 0.16);

	float edgeDistance = v.y - v.x;
	float edge = 1.0 - smoothstep(0.0, 0.07, edgeDistance);
	float halo = exp(-edgeDistance * 8.0);
	float node = 1.0 - smoothstep(0.0, 0.05, v.z - v.x);

	vec3 base = vec3(0.003, 0.008, 0.02);
	vec3 glowBlue = vec3(0.10, 0.36, 1.0);
	vec3 liftBlue = vec3(0.38, 0.66, 1.0);
	vec3 core = vec3(0.93, 0.97, 1.0);

	vec3 color = base;
	color += glowBlue * halo * 0.32;
	color += glowBlue * pow(edge, 2.0) * 1.15;
	color += liftBlue * pow(edge, 5.0) * 0.75;
	color += core * pow(node, 4.0) * 1.0;

	// 大尺度明暗，避免整屏亮度完全一致
	color *= 0.7 + 0.55 * smoothstep(0.15, 0.9, fbm(p * 0.55 + t * 0.5));

	// 暗角：四周压下去，中间的玻璃卡片更突出
	float vignette = smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.05, 1.0)));
	color *= 1.0 - 0.32 * vignette;

	// 轻微颗粒，避免深色区域出现色带
	color += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.01;

	gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
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

			// 把当前画面压成 ASCII 缩略图，便于在终端里直接看纹理结构
			;(window as any).__neuroNoiseAscii = (cols = 90, rows = 34) => {
				draw(elapsed || 0)
				const width = canvas.width
				const height = canvas.height
				const pixels = new Uint8Array(width * height * 4)
				gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

				const ramp = ' .:-=+*#%@'
				const lines: string[] = []
				for (let row = 0; row < rows; row++) {
					let line = ''
					for (let col = 0; col < cols; col++) {
						const x0 = Math.floor((col / cols) * width)
						const x1 = Math.max(x0 + 1, Math.floor(((col + 1) / cols) * width))
						// 图像坐标上下翻转
						const y0 = Math.floor(((rows - 1 - row) / rows) * height)
						const y1 = Math.max(y0 + 1, Math.floor(((rows - row) / rows) * height))

						let sum = 0
						let count = 0
						for (let y = y0; y < y1; y += 3) {
							for (let x = x0; x < x1; x += 3) {
								const i = (y * width + x) * 4
								sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
								count++
							}
						}
						const lum = count ? sum / count : 0
						line += ramp[Math.min(ramp.length - 1, Math.floor((lum / 255) * ramp.length))]
					}
					lines.push(line)
				}
				return lines.join('\n')
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
