const REPO = 'dorofo/max-vibe'
const RELEASES_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`

const prefersReducedMotion =
	window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false

function qs(sel, root = document) {
	return root.querySelector(sel)
}

function qsa(sel, root = document) {
	return Array.from(root.querySelectorAll(sel))
}

function clamp(n, a, b) {
	return Math.max(a, Math.min(b, n))
}

async function initLatestApkDownload() {
	const meta = qs('[data-release-meta]')
	const btn = qs('[data-download-btn]')
	const label = qs('[data-download-label]')
	if (!meta || !btn || !label) return

	const fallbackUrl = `https://github.com/${REPO}/releases/latest`

	try {
		const res = await fetch(RELEASES_LATEST, {
			headers: { Accept: 'application/vnd.github+json' },
		})
		if (!res.ok) throw new Error(`GitHub API: ${res.status}`)

		const data = await res.json()
		const tag = data?.tag_name || data?.name || 'latest'
		const publishedAt = data?.published_at ? new Date(data.published_at) : null
		const assets = Array.isArray(data?.assets) ? data.assets : []
		const apk = assets.find(
			a => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk'),
		)

		if (!apk?.browser_download_url) {
			meta.textContent = `Latest: ${tag}. APK не найден в assets — открываю релизы.`
			btn.href = fallbackUrl
			btn.target = '_blank'
			btn.rel = 'noreferrer'
			label.textContent = 'Открыть релизы'
			return
		}

		const sizeMb =
			typeof apk.size === 'number' ? (apk.size / 1024 / 1024).toFixed(1) : null
		const when = publishedAt
			? publishedAt.toLocaleDateString('ru-RU', {
					year: 'numeric',
					month: 'short',
					day: '2-digit',
				})
			: null

		meta.textContent = `Latest: ${tag}${when ? ` · ${when}` : ''}${sizeMb ? ` · ${sizeMb} MB` : ''}`
		btn.href = apk.browser_download_url
		btn.target = '_self'
		btn.rel = ''
		label.textContent = 'Скачать APK'
	} catch {
		meta.textContent = 'Не удалось получить latest release — открываю релизы.'
		btn.href = fallbackUrl
		btn.target = '_blank'
		btn.rel = 'noreferrer'
		label.textContent = 'Открыть релизы'
	}
}

function setMsgDeleted(msg, deleted) {
	const label = qs('.msg__deleted', msg)
	if (!label) return
	label.hidden = !deleted
	msg.dataset.state = deleted ? 'deleted' : ''
}

function initDeletedMessagesDemo() {
	const root = qs('[data-chat]')
	const toast = qs('[data-demo-toast]')
	if (!root || !toast) return

	const isDeleted = new Set()

	root.addEventListener('click', e => {
		const btn = e.target?.closest?.('[data-delete]')
		if (!btn) return
		const msg = btn.closest?.('.msg')
		if (!msg) return
		const id = msg.getAttribute('data-msg') ?? ''
		if (!id) return

		if (isDeleted.has(id)) {
			isDeleted.delete(id)
			setMsgDeleted(msg, false)
			toast.textContent =
				'Восстановлено (демо). Нажмите «Удалить», чтобы увидеть метку deleted.'
			return
		}

		isDeleted.add(id)
		setMsgDeleted(msg, true)
		toast.textContent =
			'Удалено в чате, но сохранено в MaxVibe — под сообщением появилась красная метка deleted (демо).'
	})
}

function initVibePanel() {
	const root = qs('[data-vibe]')
	const phone = qs('.vibe__phone', root || document)
	const feed = qs('[data-vibe-feed]')
	const status = qs('[data-vibe-status]')
	if (!root || !phone || !feed) return

	const lines = [
		{ text: 'прочитал… и никто не узнал', side: 'out' },
		{ text: 'всегда офлайн 👻', side: 'in' },
		{ text: 'это удалили, но у тебя осталось', side: 'out', ghost: true, deleted: true },
		{ text: '@pic котики', side: 'in' },
		{ text: 'сторис без отметки ✨', side: 'out' },
		{ text: 'ссылка проверена — ок', side: 'in' },
		{ text: 'печатает… никому не светит', side: 'out' },
		{ text: 'маскировка под MAX', side: 'in' },
	]
	const statuses = [
		'всегда офлайн',
		'тихо читает…',
		'без «печатает»',
		'сторис инкогнито',
		'вайб 4.0.0',
	]

	let i = 0
	let timer = 0

	const pushBubble = () => {
		const item = lines[i % lines.length]
		i += 1
		const bubble = document.createElement('div')
		bubble.className = `vibe-bubble vibe-bubble--${item.side}${item.ghost ? ' vibe-bubble--ghost' : ''}`

		if (item.deleted) {
			const text = document.createElement('span')
			text.className = 'vibe-bubble__text'
			text.textContent = item.text
			const label = document.createElement('span')
			label.className = 'vibe-bubble__deleted'
			label.textContent = 'deleted'
			bubble.append(text, label)
		} else {
			bubble.textContent = item.text
		}

		feed.appendChild(bubble)
		while (feed.children.length > 3) feed.firstElementChild?.remove()
		if (status) status.textContent = statuses[i % statuses.length]
	}

	pushBubble()

	const start = () => {
		if (prefersReducedMotion || timer) return
		timer = window.setInterval(pushBubble, 2800)
	}
	const stop = () => {
		if (!timer) return
		clearInterval(timer)
		timer = 0
	}

	if (!prefersReducedMotion) {
		const io = new IntersectionObserver(
			entries => {
				entries.forEach(e => {
					if (e.isIntersecting) start()
					else stop()
				})
			},
			{ threshold: 0.2 },
		)
		io.observe(root)

		if (!isCoarse) {
			let frame = 0
			root.addEventListener(
				'pointermove',
				e => {
					if (document.body.classList.contains('is-scrolling')) return
					if (frame) return
					frame = requestAnimationFrame(() => {
						frame = 0
						const r = root.getBoundingClientRect()
						const x = (e.clientX - r.left) / r.width - 0.5
						const y = (e.clientY - r.top) / r.height - 0.5
						phone.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`
					})
				},
				{ passive: true },
			)
			root.addEventListener('pointerleave', () => {
				phone.style.transform = ''
			})
		}
	} else {
		lines.slice(1, 3).forEach(item => {
			const bubble = document.createElement('div')
			bubble.className = `vibe-bubble vibe-bubble--${item.side}`
			bubble.textContent = item.text
			feed.appendChild(bubble)
		})
	}
}

function initSmoothAnchors() {
	qsa('a[href^="#"]').forEach(a => {
		a.addEventListener('click', e => {
			const href = a.getAttribute('href')
			if (!href || href === '#') return
			const el = document.getElementById(href.slice(1))
			if (!el) return
			e.preventDefault()
			el.scrollIntoView({
				behavior: prefersReducedMotion ? 'auto' : 'smooth',
				block: 'start',
			})
			history.pushState({}, '', href)
		})
	})
}

function initReveals() {
	const nodes = qsa('[data-reveal]')
	if (!nodes.length) return
	if (prefersReducedMotion) {
		nodes.forEach(n => n.classList.add('is-in'))
		return
	}

	const io = new IntersectionObserver(
		entries => {
			entries.forEach(e => {
				if (!e.isIntersecting) return
				e.target.classList.add('is-in')
				io.unobserve(e.target)
			})
		},
		{ threshold: 0.08, rootMargin: '0px 0px -5% 0px' },
	)
	nodes.forEach(n => io.observe(n))
}

function initSplitHeadline() {
	const lines = qsa('[data-split]')
	if (!lines.length) return

	lines.forEach(line => {
		const text = line.textContent ?? ''
		line.textContent = ''
		const chars = [...text]
		chars.forEach((ch, i) => {
			if (ch === '') return
			const span = document.createElement('span')
			if (ch === ' ' || ch === '\u00a0') {
				span.className = 'split-space'
				span.innerHTML = '&nbsp;'
			} else {
				span.className = 'split-char'
				const next = chars[i + 1]
				if (next && /[.,!?]/.test(next) && !/[.,!?]/.test(ch)) {
					span.textContent = ch + next
					chars[i + 1] = ''
				} else {
					span.textContent = ch
				}
			}
			line.appendChild(span)
		})
	})

	qsa('.split-char').forEach(c => c.classList.add('is-in'))
}

function initStepCycle() {
	const steps = qsa('[data-step]')
	const demo = qs('#demo')
	if (steps.length < 2) return

	let i = 0
	let timer = 0
	const activate = idx => {
		steps.forEach((s, n) => {
			s.dataset.active = n === idx ? 'true' : 'false'
		})
	}
	activate(0)
	if (prefersReducedMotion) return

	const start = () => {
		if (timer) return
		timer = window.setInterval(() => {
			i = (i + 1) % steps.length
			activate(i)
		}, 3200)
	}
	const stop = () => {
		if (!timer) return
		clearInterval(timer)
		timer = 0
	}

	if (demo) {
		const io = new IntersectionObserver(
			entries => {
				entries.forEach(e => {
					if (e.isIntersecting) start()
					else stop()
				})
			},
			{ threshold: 0.25 },
		)
		io.observe(demo)
	} else start()

	steps.forEach((step, idx) => {
		step.addEventListener('pointerenter', () => {
			i = idx
			activate(i)
		})
	})
}

function initScrollSystem() {
	const bar = qs('[data-progress]')
	const topbar = qs('.topbar')
	const acts = qsa('[data-act]')
	const rails = qsa('[data-rail]')
	const nav = qs('[data-act-nav]')
	const navDots = qsa('[data-act-jump]')

	let ticking = false
	let scrollEndTimer = 0
	let lastAct = ''
	let lastInStory = false
	let lastScrolled = false

	const setRail = (act, title) => {
		if (act === lastAct) return
		lastAct = act
		const left = rails[0]
		if (left) {
			const label = qs('[data-rail-label]', left)
			const titleEl = qs('[data-rail-title]', left)
			if (label) label.textContent = `ACT ${act}`
			if (titleEl) titleEl.textContent = title || ''
		}
		navDots.forEach(dot => {
			dot.classList.toggle('is-active', dot.getAttribute('data-act-jump') === act)
		})
		acts.forEach(a => a.classList.toggle('is-in-view', a.dataset.act === act))
	}

	const sync = () => {
		ticking = false
		const y = window.scrollY || 0
		const max = document.documentElement.scrollHeight - window.innerHeight
		const p = max > 0 ? y / max : 0

		if (bar) bar.style.transform = `scaleX(${clamp(p, 0, 1)})`

		const scrolled = y > 12
		if (topbar && scrolled !== lastScrolled) {
			lastScrolled = scrolled
			topbar.classList.toggle('is-scrolled', scrolled)
		}

		if (!acts.length) return

		const mid = window.innerHeight * 0.42
		let current = null
		for (let n = 0; n < acts.length; n++) {
			const r = acts[n].getBoundingClientRect()
			if (r.top <= mid && r.bottom >= mid) {
				current = acts[n]
				break
			}
		}

		const first = acts[0].getBoundingClientRect()
		const last = acts[acts.length - 1].getBoundingClientRect()
		const inStory =
			first.top < window.innerHeight * 0.85 && last.bottom > window.innerHeight * 0.15

		if (nav && inStory !== lastInStory) {
			lastInStory = inStory
			nav.classList.toggle('is-on', inStory)
		}

		if (!current) {
			if (lastAct) {
				lastAct = ''
				rails.forEach(r => r.classList.remove('is-on'))
			}
			return
		}

		rails.forEach(r => r.classList.add('is-on'))
		setRail(current.dataset.act || '', current.dataset.actTitle || '')
	}

	const onScroll = () => {
		document.body.classList.add('is-scrolling')
		clearTimeout(scrollEndTimer)
		scrollEndTimer = window.setTimeout(() => {
			document.body.classList.remove('is-scrolling')
		}, 120)

		if (ticking) return
		ticking = true
		requestAnimationFrame(sync)
	}

	navDots.forEach(dot => {
		dot.addEventListener('click', () => {
			const id = dot.getAttribute('data-act-jump')
			const target = acts.find(a => a.dataset.act === id)
			if (!target) return
			target.scrollIntoView({
				behavior: prefersReducedMotion ? 'auto' : 'smooth',
				block: 'start',
			})
		})
	})

	if (bar) {
		bar.style.transformOrigin = 'left center'
		bar.style.width = '100%'
		bar.style.transform = 'scaleX(0)'
	}

	sync()
	window.addEventListener('scroll', onScroll, { passive: true })
	window.addEventListener('resize', onScroll, { passive: true })
}

function initMobileNav() {
	const toggle = qs('[data-nav-toggle]')
	const nav = qs('[data-nav]')
	if (!toggle || !nav) return

	const setOpen = open => {
		nav.classList.toggle('is-open', open)
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
		toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню')
		const label = qs('.nav-toggle__label', toggle)
		if (label) label.textContent = open ? 'Закрыть' : 'Меню'
	}

	toggle.addEventListener('click', e => {
		e.stopPropagation()
		setOpen(!nav.classList.contains('is-open'))
	})
	nav.addEventListener('click', e => {
		if (e.target?.closest?.('a')) setOpen(false)
	})
	document.addEventListener('click', e => {
		if (!nav.classList.contains('is-open')) return
		if (e.target?.closest?.('[data-nav], [data-nav-toggle]')) return
		setOpen(false)
	})
	window.addEventListener('keydown', e => {
		if (e.key === 'Escape') setOpen(false)
	})
}

initSmoothAnchors()
initDeletedMessagesDemo()
initLatestApkDownload()
initVibePanel()
initReveals()
initSplitHeadline()
initStepCycle()
initScrollSystem()
initMobileNav()
initCursorAura()
initCardGlow()
initSoftMagnetic()

function initCursorAura() {
	const aura = qs('[data-cursor-aura]')
	if (!aura || prefersReducedMotion || isCoarse) return

	let x = -9999
	let y = -9999
	let cx = x
	let cy = y
	let raf = 0

	const loop = () => {
		cx += (x - cx) * 0.14
		cy += (y - cy) * 0.14
		aura.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
		if (Math.abs(x - cx) > 0.5 || Math.abs(y - cy) > 0.5) {
			raf = requestAnimationFrame(loop)
		} else {
			raf = 0
		}
	}

	window.addEventListener(
		'pointermove',
		e => {
			x = e.clientX
			y = e.clientY
			aura.classList.add('is-on')
			if (!raf) raf = requestAnimationFrame(loop)
		},
		{ passive: true },
	)

	window.addEventListener(
		'pointerleave',
		() => aura.classList.remove('is-on'),
		{ passive: true },
	)
}

function initCardGlow() {
	if (prefersReducedMotion || isCoarse) return
	qsa('.story .card, .card').forEach(card => {
		let frame = 0
		card.addEventListener(
			'pointermove',
			e => {
				if (document.body.classList.contains('is-scrolling')) return
				if (frame) return
				frame = requestAnimationFrame(() => {
					frame = 0
					const r = card.getBoundingClientRect()
					card.style.setProperty('--mx', `${e.clientX - r.left}px`)
					card.style.setProperty('--my', `${e.clientY - r.top}px`)
				})
			},
			{ passive: true },
		)
	})
}

function initSoftMagnetic() {
	if (prefersReducedMotion || isCoarse) return
	qsa('[data-magnetic]').forEach(btn => {
		btn.addEventListener('pointermove', e => {
			if (document.body.classList.contains('is-scrolling')) return
			const r = btn.getBoundingClientRect()
			const x = e.clientX - (r.left + r.width / 2)
			const y = e.clientY - (r.top + r.height / 2)
			btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`
		})
		btn.addEventListener('pointerleave', () => {
			btn.style.transform = ''
		})
	})
}
