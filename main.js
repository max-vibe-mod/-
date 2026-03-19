const REPO = "dorofo/max-vibe";
const RELEASES_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;

const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

async function initLatestApkDownload() {
  const meta = qs("[data-release-meta]");
  const btn = qs("[data-download-btn]");
  const label = qs("[data-download-label]");
  if (!meta || !btn || !label) return;

  const fallbackUrl = `https://github.com/${REPO}/releases/latest`;

  try {
    const res = await fetch(RELEASES_LATEST, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);

    const data = await res.json();
    const tag = data?.tag_name || data?.name || "latest";
    const publishedAt = data?.published_at ? new Date(data.published_at) : null;
    const assets = Array.isArray(data?.assets) ? data.assets : [];

    const apk = assets.find((a) => typeof a?.name === "string" && a.name.toLowerCase().endsWith(".apk"));

    if (!apk?.browser_download_url) {
      meta.textContent = `Latest: ${tag}. APK не найден в assets — открываю релизы.`;
      btn.href = fallbackUrl;
      btn.target = "_blank";
      btn.rel = "noreferrer";
      label.textContent = "Открыть релизы";
      return;
    }

    const sizeMb = typeof apk.size === "number" ? (apk.size / 1024 / 1024).toFixed(1) : null;
    const when = publishedAt
      ? publishedAt.toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "2-digit" })
      : null;

    meta.textContent = `Latest: ${tag}${when ? ` · ${when}` : ""}${sizeMb ? ` · ${sizeMb} MB` : ""}`;
    btn.href = apk.browser_download_url;
    btn.target = "_self";
    btn.rel = "";
    label.textContent = "Скачать APK";
  } catch (e) {
    meta.textContent = "Не удалось получить latest release — открываю релизы.";
    btn.href = fallbackUrl;
    btn.target = "_blank";
    btn.rel = "noreferrer";
    label.textContent = "Открыть релизы";
  }
}

function initDeletedMessagesDemo() {
  const root = qs("[data-chat]");
  const toast = qs("[data-demo-toast]");
  if (!root || !toast) return;

  const isDeleted = new Set();

  const setToast = (t) => {
    toast.textContent = t;
  };

  root.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-delete]");
    if (!btn) return;
    const msg = btn.closest?.(".msg");
    if (!msg) return;

    const id = msg.getAttribute("data-msg") ?? "";
    if (!id) return;

    if (isDeleted.has(id)) {
      isDeleted.delete(id);
      msg.dataset.state = "";
      const text = qs(".msg__text", msg);
      if (text && text.dataset.orig) text.textContent = text.dataset.orig;
      setToast("Восстановлено (демо). Нажмите «Удалить», чтобы увидеть метку ❌.");
      return;
    }

    isDeleted.add(id);
    msg.dataset.state = "deleted";
    const text = qs(".msg__text", msg);
    if (text) {
      text.dataset.orig = text.textContent;
      text.textContent = `❌ ${text.textContent}`;
    }
    setToast("Удалено в чате, но сохранено в MaxVibe и помечено «❌» (демо).");
  });
}

async function initThreeStage() {
  const stage = qs("[data-stage]");
  const canvas = qs("[data-stage-canvas]");
  const ctrl = qs("[data-stage-ctrl]");
  const fallback = qs("[data-stage-fallback]");
  if (!stage || !canvas) return;
  if (ctrl) ctrl.hidden = true;
  if (fallback) {
    fallback.hidden = true;
    fallback.dataset.mode = "";
    fallback.setAttribute("aria-hidden", "true");
  }
  if (prefersReducedMotion) return;

  // Lightweight safety: disable 3D on low-concurrency devices.
  if (typeof navigator?.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) return;

  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
    if (ctrl) ctrl.hidden = false;
    if (fallback) {
      fallback.hidden = false;
      fallback.dataset.mode = "hint";
      fallback.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (!fallback) return;
        if (fallback.dataset.mode !== "hint") return;
        fallback.hidden = true;
      }, 2600);
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    camera.position.set(0, 0.2, 4.2);

    const lightA = new THREE.PointLight(0xff3bd4, 38, 12);
    lightA.position.set(1.8, 1.2, 2.2);
    scene.add(lightA);

    const lightB = new THREE.PointLight(0xa78bfa, 28, 12);
    lightB.position.set(-2.0, -0.2, 2.1);
    scene.add(lightB);

    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(0, 2.4, 1.6);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    // "Logo coin" — torus knot + inset disc, premium neon material.
    const knot = new THREE.TorusKnotGeometry(0.86, 0.23, 220, 22, 2, 5);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.45,
      roughness: 0.25,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
      transmission: 0.02,
      ior: 1.4,
    });

    const mesh = new THREE.Mesh(knot, mat);
    group.add(mesh);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.78, 0.10, 60, 1, false),
      new THREE.MeshStandardMaterial({
        color: 0x0b0a12,
        metalness: 0.2,
        roughness: 0.35,
        emissive: 0x120717,
        emissiveIntensity: 0.7,
      })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.z = -0.02;
    group.add(disc);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 26, 18),
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.05,
      })
    );
    group.add(glow);

    let raf = 0;
    let t0 = performance.now();

    const resize = () => {
      const r = stage.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const pointer = { x: 0, y: 0 };
    const drag = { active: false, x0: 0, y0: 0, px: 0, py: 0 };
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (!drag.active) {
        pointer.x = (x - 0.5) * 2;
        pointer.y = (0.5 - y) * 2;
        return;
      }
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      drag.px = dx;
      drag.py = dy;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const onDown = (e) => {
      drag.active = true;
      drag.x0 = e.clientX;
      drag.y0 = e.clientY;
      drag.px = 0;
      drag.py = 0;
      if (fallback && fallback.dataset.mode === "hint") fallback.hidden = true;
    };

    const onUp = () => {
      drag.active = false;
      drag.px = 0;
      drag.py = 0;
    };

    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp, { passive: true });

    const onScroll = () => {
      // Slight scroll-reactive depth.
      const y = window.scrollY || 0;
      const amt = clamp(y / 900, 0, 1);
      group.position.y = -0.06 * amt;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let paused = false;
    let spinBoost = 1;

    const setPaused = (v) => {
      paused = Boolean(v);
      if (ctrl) ctrl.textContent = paused ? "Запуск" : "Пауза";
    };

    if (ctrl) {
      ctrl.addEventListener("click", () => {
        setPaused(!paused);
      });
    }

    const tick = (now) => {
      const dt = (now - t0) / 1000;
      t0 = now;

      if (!paused) group.rotation.y += dt * 0.55 * spinBoost;
      spinBoost = THREE.MathUtils.lerp(spinBoost, drag.active ? 0.15 : 1, 0.08);

      if (drag.active) {
        group.rotation.y += drag.px * 0.0008;
        group.rotation.x += drag.py * 0.0008;
        drag.px *= 0.92;
        drag.py *= 0.92;
      } else {
        group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.y * 0.18, 0.06);
        group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -pointer.x * 0.10, 0.06);
      }

      // Color drift between violet and pink, subtle and premium.
      const k = 0.5 + 0.5 * Math.sin(now * 0.00065);
      const c1 = new THREE.Color(0xa78bfa);
      const c2 = new THREE.Color(0xff3bd4);
      const c = c1.lerp(c2, k);
      lightA.color.copy(c2);
      lightB.color.copy(c1);
      mat.emissive = c.clone();
      mat.emissiveIntensity = 0.16 + 0.08 * Math.sin(now * 0.001);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const start = () => {
      if (raf) return;
      resize();
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(stage);

    window.addEventListener("resize", resize, { passive: true });
    resize();
  } catch {
    if (ctrl) ctrl.hidden = true;
    if (fallback) {
      fallback.hidden = false;
      fallback.dataset.mode = "error";
      fallback.innerHTML = "3D недоступно на этом устройстве";
      fallback.setAttribute("aria-hidden", "true");
    }
  }
}

function initSmoothAnchors() {
  if (prefersReducedMotion) return;
  qsa('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState({}, "", href);
    });
  });
}

initSmoothAnchors();
initDeletedMessagesDemo();
initLatestApkDownload();
initThreeStage();

