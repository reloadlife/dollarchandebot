"use client";

import { useEffect, useRef } from "react";
import { amberField } from "@/components/amber-field";

type StageCleanup = () => void;

function hasWebGPU(): boolean {
  return "gpu" in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

/** Gold ring (three) and a slow amber pool (vgpu) framing the price board. */
export function HeroStage({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const fieldCanvas = fieldRef.current;
    const ringCanvas = ringRef.current;
    if (!root || !fieldCanvas || !ringCanvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const life = { on: true };
    const cleanups: StageCleanup[] = [];

    void (async () => {
      await mountRing(ringCanvas, reduce, life, cleanups);
      if (life.on) await mountField(fieldCanvas, reduce, life, cleanups);
    })();

    return () => {
      life.on = false;
      for (const cleanup of cleanups) cleanup();
      cleanups.length = 0;
    };
  }, []);

  return (
    <div ref={rootRef} className="relative isolate px-8 py-12 sm:px-14 sm:py-16">
      <canvas ref={fieldRef} aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
      <canvas ref={ringRef} aria-hidden className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
      <div data-board className="relative z-10">{children}</div>
    </div>
  );
}

async function mountRing(
  canvas: HTMLCanvasElement,
  reduce: boolean,
  life: { on: boolean },
  cleanups: StageCleanup[],
) {
  let renderer: import("three").WebGLRenderer | null = null;
  try {
    const THREE = await import("three");
    if (!life.on) return;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);

    try {
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      if (!life.on) {
        renderer.dispose();
        return;
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envMap;
      cleanups.push(() => {
        envMap.dispose();
        pmrem.dispose();
      });
    } catch {
      // Direct lights still read as metal when the room map fails.
    }

    const gold = new THREE.MeshPhysicalMaterial({
      color: 0xd4923a,
      emissive: 0xb86a20,
      emissiveIntensity: 0.42,
      metalness: 1,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    const wire = new THREE.MeshPhysicalMaterial({
      color: 0xffe1a8,
      emissive: 0xffb25a,
      emissiveIntensity: 0.7,
      metalness: 1,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    const gem = new THREE.MeshPhysicalMaterial({
      color: 0xfff6e4,
      emissive: 0xffd27a,
      emissiveIntensity: 2,
      metalness: 0.1,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    });

    const tilt = 0.18;
    const group = new THREE.Group();
    group.rotation.x = tilt;
    const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.052, 64, 180), gold);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.045, 0.01, 20, 140), wire);
    halo.rotation.x = 0.28;
    group.add(band, halo);

    const gemGeo = new THREE.OctahedronGeometry(0.07, 0);
    for (const angle of [Math.PI / 2, Math.PI / 2 + 0.85, -0.35, Math.PI + 0.4]) {
      const stone = new THREE.Mesh(gemGeo, gem);
      stone.position.set(Math.cos(angle), Math.sin(angle), 0);
      group.add(stone);
    }
    scene.add(group);

    scene.add(new THREE.HemisphereLight(0xfff0d4, 0x3a1a0c, 1.1));
    const key = new THREE.DirectionalLight(0xfff8ee, 4.5);
    key.position.set(2.2, 4.2, 3.4);
    scene.add(key);
    const rim = new THREE.PointLight(0xff8a24, 28, 12);
    rim.position.set(-1.4, 1.1, 2.2);
    scene.add(rim);

    let baseScale = 1.15;
    const fit = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) return;
      renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer?.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const stage = canvas.getBoundingClientRect();
      const card = canvas.parentElement?.querySelector("[data-board]")?.getBoundingClientRect();
      if (card && stage.height > 2) {
        const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
        const halfW = halfH * (width / height);
        const pxPerUnit = stage.height / (2 * halfH);
        const crownPx = Math.max(12, card.top - stage.top - 16);
        const worldY = halfH - crownPx / pxPerUnit;
        const verticalScale = worldY / Math.cos(tilt);
        const horizontalScale = (halfW * 0.98) / 1.05;
        baseScale = Math.min(2.4, Math.max(0.55, Math.min(verticalScale, horizontalScale)));
        group.scale.setScalar(baseScale);
      }
      renderer?.render(scene, camera);
    };
    fit();
    const observed = new ResizeObserver(fit);
    observed.observe(canvas);

    let frame = 0;
    let running = !reduce;
    let queued = false;
    const draw = (now: number) => {
      queued = false;
      const t = reduce ? 1.15 : now * 0.001;
      group.rotation.z = t * 0.16;
      group.rotation.y = Math.sin(t * 0.22) * 0.1;
      group.scale.setScalar(baseScale * (reduce ? 1 : 1 + Math.sin(t * 0.55) * 0.012));
      halo.rotation.z = -t * 0.12;
      rim.position.x = Math.cos(t * 0.32) * 2.15;
      rim.position.y = 0.4 + Math.sin(t * 0.32) * 1.1;
      renderer?.render(scene, camera);
      if (running) {
        queued = true;
        frame = window.requestAnimationFrame(draw);
      }
    };
    const kick = () => {
      if (queued) return;
      queued = true;
      frame = window.requestAnimationFrame(draw);
    };
    if (reduce) draw(0);
    else kick();

    const seen = new IntersectionObserver(([entry]) => {
      running = !reduce && Boolean(entry?.isIntersecting);
      if (running) kick();
    });
    seen.observe(canvas);

    const release = () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observed.disconnect();
      seen.disconnect();
      gemGeo.dispose();
      band.geometry.dispose();
      halo.geometry.dispose();
      gold.dispose();
      wire.dispose();
      gem.dispose();
      renderer?.dispose();
      renderer = null;
    };
    if (!life.on) {
      release();
      return;
    }
    cleanups.push(release);
  } catch {
    renderer?.dispose();
  }
}

async function mountField(
  canvas: HTMLCanvasElement,
  reduce: boolean,
  life: { on: boolean },
  cleanups: StageCleanup[],
) {
  try {
    if (!hasWebGPU()) return;
    const { clock, effect, frameLoop, init, surface } = await import("vgpu");
    if (!life.on) return;
    const gpu = await init();
    if (!life.on) {
      gpu.dispose();
      return;
    }
    const screen = surface(gpu, canvas, {
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
      dpr: [1, 1.5],
    });
    const glow = effect(gpu, amberField, {
      blend: "premultiplied",
      set: { params: { time: 0 } },
    });
    const time = clock(gpu);
    const loop = frameLoop(gpu, (current) => {
      glow.set({ params: { time: reduce ? 0.8 : time.time } });
      current.pass({ target: screen, clear: [0, 0, 0, 0] }, glow);
    }, reduce ? { fps: 1 } : undefined);
    if (reduce) window.setTimeout(() => loop.stop(), 40);
    cleanups.push(() => {
      loop.stop();
      gpu.dispose();
    });
  } catch {
    // The ring and the dark board remain when WebGPU is unavailable.
  }
}
