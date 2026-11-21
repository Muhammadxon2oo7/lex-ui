'use client';
/**
 * Shared pieces for the case rooms: a seated/standing first-person camera
 * you steer by dragging, the post-processing chain, and simple
 * architectural primitives built on the PBR material library.
 */
import { Environment, PerformanceMonitor, SoftShadows, useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TILE, UI_FONT, canvasTexture, ornamentTexture, tiledBox, type Materials } from '@/components/world/materials';
import { hand } from './interaction';
import { TIERS, deviceTier, markDocument, type Tier } from '@/lib/deviceTier';

export type V3 = [number, number, number];

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * First-person camera at a seat. `base` is the heading at rest (π looks
 * down +z). Drag to look around; when someone starts to speak the head turns
 * to them. Rising and sitting move the eye along a critically damped spring
 * with a slight forward lean, as a body does.
 */
export function SeatCamera({ seated, standing, up = false, base, focus, limit = 1.3 }: { seated: V3; standing?: V3; up?: boolean; base: number; focus: V3 | null; limit?: number }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const look = useRef({ yaw: 0, pitch: -0.08, dragging: false, moved: 0 });
  const aim = useRef({ yaw: 0, pitch: -0.08 });
  const eye = useRef({ p: new THREE.Vector3(...seated), v: new THREE.Vector3() });
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const dom = gl.domElement;
    const down = (e: PointerEvent) => {
      look.current.dragging = true;
      look.current.moved = 0;
      dom.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!look.current.dragging || hand.holding) return;
      look.current.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      look.current.yaw = THREE.MathUtils.clamp(look.current.yaw - e.movementX * 0.003, -limit, limit);
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * 0.003, -1.4, 0.35);
    };
    const up = () => (look.current.dragging = false);
    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', move);
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    return () => {
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', move);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('pointercancel', up);
    };
  }, [gl, limit]);

  // Turn to whoever starts speaking — unless you are steering.
  useEffect(() => {
    if (!focus || look.current.dragging) return;
    const from = up && standing ? standing : seated;
    const dx = focus[0] - from[0];
    const dz = focus[2] - from[2];
    let yaw = Math.atan2(-dx, -dz) - base;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    look.current.yaw = THREE.MathUtils.clamp(yaw * 0.9, -limit, limit);
    const dy = focus[1] - from[1];
    look.current.pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 0.9, -0.85, 0.3);
  }, [focus, base, limit, seated, standing, up]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = 1 - Math.exp(-6 * dt);
    aim.current.yaw += (look.current.yaw - aim.current.yaw) * k;
    aim.current.pitch += (look.current.pitch - aim.current.pitch) * k;
    target.set(...(up && standing ? standing : seated));
    const e = eye.current;
    if (reducedMotion()) {
      e.p.copy(target);
      e.v.set(0, 0, 0);
    } else {
      // critically damped spring, ~0.6 s to settle
      const w = 9;
      const accel = target.clone().sub(e.p).multiplyScalar(w * w).sub(e.v.clone().multiplyScalar(2 * w));
      e.v.addScaledVector(accel, dt);
      e.p.addScaledVector(e.v, dt);
    }
    // lean forward while the body is moving vertically
    const lean = THREE.MathUtils.clamp(-Math.abs(e.v.y) * 0.18, -0.12, 0);
    camera.position.copy(e.p);
    camera.rotation.set(aim.current.pitch + lean, base + aim.current.yaw, 0, 'YXZ');
  });
  return null;
}

/**
 * Lens shift: on wide screens the dialogue panel sits on the right, so the
 * picture is shifted to put the room's centre (the person you talk to) at
 * ~40% of the width instead of under the panel.
 */
export function FrameForPanel({ side = 'right' }: { side?: 'left' | 'right' }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (size.width >= 1024) {
      const shift = size.width * 0.2;
      // panel on the right: show the left part of a wider frame; panel on the left: the right part
      camera.setViewOffset(size.width + shift, size.height, side === 'right' ? shift : 0, 0, size.width, size.height);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [camera, size.width, size.height, side]);
  return null;
}

/** Dev only: exposes the scene to the QA scripts (tools/qa/zfight.mjs). Renders nothing. */
export function DevProbe() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    Object.assign(window as unknown as Record<string, unknown>, { __lexScene: scene, __lexCamera: camera, __lexGl: gl });
  }, [scene, camera, gl]);
  return null;
}

/* ── quality that follows the device ── */
/*
 * Decided before the first frame (lib/deviceTier) and only ever stepped DOWN while a scene runs:
 *   high   — every effect, up to 1.75 px per px, 2048 shadows;
 *   medium — bloom + vignette, no ambient occlusion / MSAA, 1.25 px per px, 1024 shadows;
 *   low    — no post chain (the renderer tone-maps), no shadows, 0.8 px per px, a steady 30 fps.
 * A flip-flop between tiers is itself a stutter, so a tier that was dropped never comes back.
 */
const quality = { tier: 'medium' as Tier, ready: false, subs: new Set<() => void>() };
function setTier(t: Tier) {
  if (quality.ready && quality.tier === t) return;
  quality.tier = t;
  quality.ready = true;
  markDocument(t);
  quality.subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  quality.subs.add(f);
  return () => quality.subs.delete(f);
};
/** The current tier (the same for every scene on the page). */
export function useTier(): Tier {
  return useSyncExternalStore(subscribe, () => (quality.ready ? quality.tier : deviceTier()), () => 'medium');
}
// low renders 0.8 px per px: a third fewer pixels, barely softer — the single biggest saving on a weak GPU
const DPR: Record<Tier, number> = { low: 0.8, medium: 1.25, high: 1.75 };
const SHADOW: Record<Tier, number> = { low: 0, medium: 1024, high: 2048 };

/** Applies the tier to the renderer (pixels, shadows, frame pace) and steps it down when frames drop. */
export function QualityGovernor() {
  const tier = useTier();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const setDpr = useThree((s) => s.setDpr);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const advance = useThree((s) => s.advance);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!quality.ready) setTier(deviceTier());
  }, []);
  // compile every shader in the background once the room has loaded: the first glance at a new
  // material then costs nothing (otherwise a 100–200 ms hitch the first time it comes into view)
  useEffect(() => {
    const t = setTimeout(() => void gl.compileAsync?.(scene, camera).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [gl, scene, camera, tier]);
  useEffect(() => {
    setDpr(Math.min(DPR[tier], window.devicePixelRatio || 1));
    // shadows: off on low, smaller on medium (the maps are rebuilt at the new size)
    const size = SHADOW[tier];
    const wasOn = gl.shadowMap.enabled;
    gl.shadowMap.enabled = size > 0;
    scene.traverse((o) => {
      const light = o as THREE.DirectionalLight;
      if (light.isLight && light.shadow && light.castShadow && size > 0 && light.shadow.mapSize.x !== size) {
        light.shadow.mapSize.set(size, size);
        light.shadow.map?.dispose();
        light.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
      // the shader programs depend on whether shadows exist: rebuild them once
      if (wasOn !== gl.shadowMap.enabled) {
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => (m.needsUpdate = true));
      }
    });
    gl.shadowMap.needsUpdate = true;
    // low: no post chain, so the renderer itself tone-maps (ACES, as the chain would)
    gl.toneMapping = tier === 'low' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    // low: a steady 30 fps — an even pace reads smoother than an uneven 40, and halves the GPU work
    if (tier !== 'low') {
      setFrameloop('always');
      return;
    }
    setFrameloop('never');
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 1000 / 30 - 2) return;
      last = t;
      advance(t);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFrameloop('always');
    };
  }, [tier, gl, scene, setDpr, setFrameloop, advance]);
  const down = () => setTier(TIERS[Math.max(0, TIERS.indexOf(quality.tier) - 1)]);
  // Frames are judged only once the room has settled: while models decode and shaders compile every
  // machine stutters, and that is not a weak device (a MacBook Pro used to be sent to the light mode
  // within ten seconds of opening a room). So: nothing is loading, then a few quiet seconds, tab visible.
  const loading = useProgress((s) => s.active);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setSettled(document.visibilityState === 'visible'), 6000);
    return () => {
      clearTimeout(t);
      setSettled(false);
    };
  }, [loading, tier]);
  // judged only while running at full pace (the 30 fps cap is not a decline); a real decline is sustained:
  // well under 40 fps for several seconds, not one slow second
  return tier === 'low' || !settled ? null : <PerformanceMonitor ms={500} iterations={8} threshold={0.8} bounds={() => [38, 200]} flipflops={2} onDecline={down} onFallback={() => setTier('low')} />;
}
/**
 * The rooms are framed for a landscape screen (~16:10). On a narrower screen
 * (portrait phone, split window) the lens widens so the desk and the people
 * stay in view instead of being cut at the sides.
 */
export function FitFov({ base = 52, design = 1.6, max = 78 }: { base?: number; design?: number; max?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const v = THREE.MathUtils.degToRad(base);
    const fov = aspect < design ? THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(v / 2) * design) / aspect)) : base;
    camera.fov = Math.min(max, fov);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, base, design, max]);
  return null;
}

/** The post chain for the tier: full on high, light on medium, none on low (the renderer tone-maps). */
export function RoomFx() {
  const tier = useTier();
  if (tier === 'low') return null;
  return tier === 'medium' ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1.05} intensity={0.25} />
      <Vignette eskil={false} offset={0.25} darkness={0.4} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO halfRes aoRadius={1.1} distanceFalloff={0.9} intensity={3} quality="medium" color="#1a120c" />
      <Bloom mipmapBlur luminanceThreshold={1.05} intensity={0.25} />
      <Vignette eskil={false} offset={0.25} darkness={0.4} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* the grade, after the tone curve: a touch more contrast and colour (a graded photograph, not a render) */}
      <BrightnessContrast brightness={0} contrast={0.07} />
      <HueSaturation saturation={0.08} />
    </EffectComposer>
  );
}

export function Box({ m, size, position, tile = 1, rotation = 0, cast = true }: { m: THREE.Material; size: V3; position: V3; tile?: number; rotation?: number; cast?: boolean }) {
  const geometry = useMemo(() => tiledBox(size[0], size[1], size[2], tile), [size, tile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={m} position={position} rotation={[0, rotation, 0]} castShadow={cast} receiveShadow />;
}

const panelLight = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff4e2'), emissiveIntensity: 2.2, roughness: 0.6 });

/** Floor, ceiling and four walls; `zc` is the room's centre along z. */
/**
 * The light of a room, the same in every room: a warm low sun through the windows (the only light
 * that casts shadows — soft-edged, as real window light is), a cool sky fill from above and a warm
 * bounce from the floor, and the room's own reflections. Warm key against cool fill is what gives
 * a face and a desk their shape; an even white wash is what made the rooms look flat.
 */
export function RoomLight({ sun = [4, 6, -2] as V3, reach = 7, power = 2.1 }: { sun?: V3; reach?: number; power?: number }) {
  const tier = useTier();
  return (
    <>
      {tier === 'high' && <SoftShadows size={22} samples={12} focus={0.4} />}
      <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.5} />
      <hemisphereLight intensity={0.22} color="#dfe8ff" groundColor="#c9a37a" />
      <directionalLight position={sun} intensity={power} color="#ffdcb0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-reach} shadow-camera-right={reach} shadow-camera-top={reach} shadow-camera-bottom={-reach} shadow-bias={-0.0004} shadow-normalBias={0.03} />
    </>
  );
}

/**
 * A ceiling panel as what it is: a glowing rectangle. An area light gives the soft, shadowless wash
 * and the long highlights on lacquered wood that a point light cannot; a weak point light under it
 * keeps the old falloff for depth. On the light tier a single point light does the whole job.
 */
// the lookup tables area lights are shaded with (once, in the browser)
if (typeof window !== 'undefined') RectAreaLightUniformsLib.init();
export function PanelLight({ at, power, size = [1.2, 0.6] }: { at: V3; power: number; size?: [number, number] }) {
  const tier = useTier();
  if (tier === 'low') return <pointLight position={[at[0], at[1] - 0.27, at[2]]} intensity={power} distance={9} decay={2} color="#fff1dc" />;
  return (
    <>
      <rectAreaLight args={['#fff3e0', power * 1.15, size[0], size[1]]} position={at} rotation={[-Math.PI / 2, 0, 0]} />
      <pointLight position={[at[0], at[1] - 0.27, at[2]]} intensity={power * 0.45} distance={9} decay={2} color="#fff1dc" />
    </>
  );
}

export function Shell({ m, w, d, h = 3, zc = 0, floor = 'laminate', lights }: { m: Materials; w: number; d: number; h?: number; zc?: number; floor?: 'laminate' | 'terrazzo'; lights: V3[] }) {
  return (
    <group>
      <Box m={m[floor]} size={[w, 0.1, d]} position={[0, -0.05, zc]} tile={TILE[floor]} cast={false} />
      <Box m={m.ceiling} size={[w, 0.1, d]} position={[0, h + 0.05, zc]} tile={TILE.ceiling} cast={false} />
      <Box m={m.plaster} size={[w, h, 0.2]} position={[0, h / 2, zc - d / 2]} tile={TILE.plaster} cast={false} />
      <Box m={m.plaster} size={[w, h, 0.2]} position={[0, h / 2, zc + d / 2]} tile={TILE.plaster} cast={false} />
      <Box m={m.plaster} size={[0.2, h, d]} position={[-w / 2, h / 2, zc]} tile={TILE.plaster} cast={false} />
      <Box m={m.plaster} size={[0.2, h, d]} position={[w / 2, h / 2, zc]} tile={TILE.plaster} cast={false} />
      {/* skirting */}
      <Box m={m.walnut} size={[w - 0.2, 0.09, 0.02]} position={[0, 0.045, zc + d / 2 - 0.11]} tile={TILE.walnut} cast={false} />
      <Box m={m.walnut} size={[0.02, 0.09, d - 0.26]} position={[-w / 2 + 0.11, 0.045, zc - 0.01]} tile={TILE.walnut} cast={false} />
      <Box m={m.walnut} size={[0.02, 0.09, d - 0.26]} position={[w / 2 - 0.11, 0.045, zc - 0.01]} tile={TILE.walnut} cast={false} />
      {lights.map((p) => {
        // a 120 × 60 cm panel takes exactly two tiles of the ceiling grid (laid from the room's corner):
        // centred on a grid line across, in the middle of a tile along
        const x = -w / 2 + Math.round((p[0] + w / 2) / 0.6) * 0.6;
        const z = zc - d / 2 + (Math.floor((p[2] - (zc - d / 2)) / 0.6 + 1e-6) + 0.5) * 0.6;
        return (
          <group key={p.join(':')}>
            <mesh material={panelLight} position={[x, h - 0.012, z]}>
              <boxGeometry args={[1.175, 0.02, 0.575]} />
            </mesh>
            <PanelLight at={[x, h - 0.03, z]} power={p[1]} />
          </group>
        );
      })}
    </group>
  );
}

let outsideTexture: THREE.CanvasTexture | null = null;
/** What one sees through the glass: sky, a line of poplars and low city blocks (shared texture). */
function outside() {
  if (outsideTexture) return outsideTexture;
  outsideTexture = canvasTexture(512, 512, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#9cc8ec');
    sky.addColorStop(0.62, '#dcebf6');
    sky.addColorStop(1, '#eef2f2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let x = 0; x < w; ) {
      const bw = 40 + rnd() * 70;
      const bh = 60 + rnd() * 120;
      ctx.fillStyle = `hsl(35, 12%, ${78 - rnd() * 14}%)`;
      ctx.fillRect(x, h * 0.72 - bh, bw, bh + h);
      ctx.fillStyle = 'rgba(80,110,140,0.35)';
      for (let wy = h * 0.72 - bh + 10; wy < h * 0.7; wy += 16) for (let wx = x + 6; wx < x + bw - 8; wx += 14) ctx.fillRect(wx, wy, 7, 9);
      x += bw + 4;
    }
    for (let x = -10; x < w + 20; x += 18 + rnd() * 14) {
      const th = 120 + rnd() * 90;
      ctx.fillStyle = `hsl(${88 + rnd() * 20}, 16%, ${44 + rnd() * 10}%)`;
      ctx.beginPath();
      ctx.ellipse(x, h * 0.86 - th / 2, 11 + rnd() * 6, th / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9c4b8';
    ctx.fillRect(0, h * 0.86, w, h);
    // atmospheric haze: the distance is lighter and bluer
    const haze = ctx.createLinearGradient(0, h * 0.3, 0, h);
    haze.addColorStop(0, 'rgba(220,232,242,0.55)');
    haze.addColorStop(1, 'rgba(220,232,242,0.15)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  });
  return outsideTexture;
}

/** Daylight window: an outside view behind the glass, a frame and half-drawn blinds. */
export function Window({ m, position, rotation = 0, size = [1.6, 1.5] }: { m: Materials; position: V3; rotation?: number; size?: [number, number] }) {
  const [w, h] = size;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={outside()} color="#f4f4f4" toneMapped={false} />
      </mesh>
      {/* blinds over the upper third only */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} material={m.whiteLaminate} position={[0, h / 2 - 0.05 - i * 0.07, 0]} rotation={[-1.1, 0, 0]}>
          <boxGeometry args={[w - 0.04, 0.06, 0.003]} />
        </mesh>
      ))}
      <Box m={m.whiteLaminate} size={[w + 0.12, 0.06, 0.16]} position={[0, -h / 2 - 0.03, 0.04]} />
      <Box m={m.whiteLaminate} size={[w + 0.12, 0.06, 0.08]} position={[0, h / 2 + 0.03, 0]} />
      <Box m={m.whiteLaminate} size={[0.06, h, 0.08]} position={[-w / 2 - 0.03, 0, 0]} />
      <Box m={m.whiteLaminate} size={[0.06, h, 0.08]} position={[w / 2 + 0.03, 0, 0]} />
      <Box m={m.whiteLaminate} size={[0.04, h, 0.06]} position={[0, 0, 0]} />
    </group>
  );
}

/** Wall sign drawn on a canvas (title + optional subtitle). */
export function WallSign({ position, rotation = 0, size, title, subtitle, dark = false }: { position: V3; rotation?: number; size: [number, number]; title: string; subtitle?: string; dark?: boolean }) {
  const texture = useMemo(
    () =>
      canvasTexture(Math.round(size[0] * 320), Math.round(size[1] * 320), (ctx, w, h) => {
        ctx.fillStyle = dark ? '#16213e' : '#f7f3ea';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1f8a5b';
        ctx.fillRect(0, h - 10, w, 10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fit = (text: string, px: number, weight: number) => {
          let size = px;
          ctx.font = `${weight} ${size}px ${UI_FONT}`;
          while (ctx.measureText(text).width > w * 0.9 && size > 8) ctx.font = `${weight} ${(size -= 2)}px ${UI_FONT}`;
        };
        ctx.fillStyle = dark ? '#ffffff' : '#16213e';
        fit(title, Math.round(h * (subtitle ? 0.3 : 0.42)), 700);
        ctx.fillText(title, w / 2, subtitle ? h * 0.38 : h * 0.5);
        if (subtitle) {
          fit(subtitle, Math.round(h * 0.17), 500);
          ctx.fillStyle = dark ? '#9fb0cf' : '#5b6474';
          ctx.fillText(subtitle, w / 2, h * 0.72);
        }
      }),
    [size, title, subtitle, dark],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} roughness={0.6} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

export function Ornament({ width, position, rotation = 0 }: { width: number; position: V3; rotation?: number }) {
  const texture = useMemo(() => {
    const t = ornamentTexture().clone();
    t.repeat.set(width / 1.2, 1);
    t.needsUpdate = true;
    return t;
  }, [width]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <planeGeometry args={[width, 0.4]} />
      <meshStandardMaterial map={texture} roughness={0.35} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

export function Desk({ m, position, size = [1.7, 0.8], rotation = 0, panel = 'far' }: { m: Materials; position: V3; size?: [number, number]; rotation?: number; panel?: 'far' | 'near' }) {
  const [w, d] = size;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Box m={m.oak} size={[w, 0.04, d]} position={[0, 0.74, 0]} tile={TILE.oak} />
      <Box m={m.walnut} size={[0.04, 0.72, d - 0.06]} position={[-w / 2 + 0.04, 0.36, 0]} tile={TILE.walnut} />
      <Box m={m.walnut} size={[0.04, 0.72, d - 0.06]} position={[w / 2 - 0.04, 0.36, 0]} tile={TILE.walnut} />
      <Box m={m.walnut} size={[w - 0.1, 0.5, 0.02]} position={[0, 0.46, panel === 'far' ? d / 2 - 0.05 : -d / 2 + 0.05]} tile={TILE.walnut} />
    </group>
  );
}

export function Papers({ m, position, count = 3, rotation = 0 }: { m: Materials; position: V3; count?: number; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} material={m.paper} position={[i * 0.006, i * 0.0025, -i * 0.004]} rotation={[0, i * 0.05 - 0.04, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.21, 0.002, 0.297]} />
        </mesh>
      ))}
    </group>
  );
}

const folderMaterial = new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.7 });
export function Folder({ position, rotation = 0, color }: { position: V3; rotation?: number; color?: string }) {
  const mat = useMemo(() => (color ? new THREE.MeshStandardMaterial({ color, roughness: 0.7 }) : folderMaterial), [color]);
  return (
    <mesh material={mat} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.25, 0.02, 0.32]} />
    </mesh>
  );
}

/** A row of binders on a shelf, colour-varied. */
export function Binders({ position, rotation = 0, count = 8 }: { position: V3; rotation?: number; count?: number }) {
  const colors = ['#2f5d8a', '#7a2f2f', '#2f6a4a', '#555b66', '#8a6a2f', '#2f5d8a', '#4a3f6b', '#666e2f'];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[i * 0.075 - (count * 0.075) / 2, 0.16, 0]} castShadow>
          <boxGeometry args={[0.065, 0.32, 0.26]} />
          <meshStandardMaterial color={colors[i % colors.length]} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

/** Low monitor with a screen texture, facing +z of its group. */
export function Monitor({ m, position, rotation = 0, screen }: { m: Materials; position: V3; rotation?: number; screen?: THREE.Texture }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={m.metal} position={[0, 0.006, 0]} castShadow>
        <boxGeometry args={[0.24, 0.012, 0.17]} />
      </mesh>
      <mesh material={m.metal} position={[0, 0.16, -0.03]} castShadow>
        <boxGeometry args={[0.035, 0.3, 0.02]} />
      </mesh>
      <mesh material={m.darkPlastic} position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.58, 0.35, 0.025]} />
      </mesh>
      <mesh position={[0, 0.365, 0.016]}>
        <planeGeometry args={[0.55, 0.32]} />
        {screen ? <meshBasicMaterial map={screen} toneMapped={false} color="#d8d8d8" /> : <meshStandardMaterial color="#0d1118" roughness={0.2} />}
      </mesh>
    </group>
  );
}

const SPINES = ['#2f5d8a', '#7a2f2f', '#2f6a4a', '#555b66', '#8a6a2f', '#4a3f6b', '#1f3550', '#6b2a3a', '#3d5a3a', '#a08a5c'];

/**
 * Walnut bookcase filled with code books and case binders. Built in code so
 * it stays crisp and every shelf reads as used (seeded variation, no two rows alike).
 */
/** Depth of a bookcase, and where its centre goes so its back stands 15 mm clear of a wall's inner face. */
export const BOOKCASE_DEPTH = 0.34;
export const againstWall = (wallInner: number, facing: 1 | -1 = -1) => wallInner + facing * (BOOKCASE_DEPTH / 2 + 0.015);

export function Bookcase({ m, position, rotation = 0, width = 1.0, height = 2.1, shelves = 5, seed = 1 }: { m: Materials; position: V3; rotation?: number; width?: number; height?: number; shelves?: number; seed?: number }) {
  const depth = BOOKCASE_DEPTH;
  const rows = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const gap = (height - 0.12) / shelves;
    return Array.from({ length: shelves }, (_, r) => {
      const y = 0.06 + r * gap + 0.02;
      const books: { x: number; w: number; h: number; color: string; tilt: number }[] = [];
      let x = -width / 2 + 0.05;
      const end = width / 2 - 0.05 - rnd() * 0.25;
      while (x < end) {
        const w = 0.035 + rnd() * 0.05;
        const h = Math.min(gap - 0.05, 0.2 + rnd() * 0.12);
        const tilt = x + w > end - 0.08 && rnd() > 0.5 ? 0.25 : 0;
        books.push({ x: x + w / 2, w, h, color: SPINES[Math.floor(rnd() * SPINES.length)], tilt });
        x += w + 0.004;
      }
      return { y, books };
    });
  }, [seed, width, height, shelves]);
  const mats = useMemo(() => Object.fromEntries(SPINES.map((c) => [c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.72 })])), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* no two faces share a plane (that is what makes surfaces shimmer): every part sits inside or clear of its neighbour */}
      <Box m={m.walnut} size={[width - 0.064, height - 0.034, 0.016]} position={[0, (height - 0.03) / 2, -depth / 2 + 0.012]} tile={1.3} cast={false} />
      <Box m={m.walnut} size={[0.03, height - 0.032, depth]} position={[-width / 2 + 0.015, (height - 0.032) / 2, 0]} tile={1.3} />
      <Box m={m.walnut} size={[0.03, height - 0.032, depth]} position={[width / 2 - 0.015, (height - 0.032) / 2, 0]} tile={1.3} />
      <Box m={m.walnut} size={[width + 0.01, 0.03, depth + 0.012]} position={[0, height - 0.015, 0.002]} tile={1.3} />
      {rows.map((row, i) => (
        <group key={i}>
          <Box m={m.walnut} size={[width - 0.066, 0.025, depth - 0.03]} position={[0, row.y - 0.0125, 0.004]} tile={1.3} cast={false} />
          {row.books.map((b, j) => (
            <mesh key={j} material={mats[b.color]} position={[b.x, row.y + b.h / 2 + 0.002, 0.012]} rotation={[0, 0, b.tilt]} castShadow>
              <boxGeometry args={[b.w, b.h, 0.24]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const ceilingLed = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#f6f8ff'), emissiveIntensity: 2.2, roughness: 0.6 });
/**
 * The court building's ceiling: a lowered plaster border round the room and
 * square LED panels — as in real Uzbek court premises.
 */
export function TrayCeiling({ m, w, d, h, zc = 0, panels }: { m: Materials; w: number; d: number; h: number; zc?: number; panels: [number, number][] }) {
  return (
    <group>
      <Box m={m.plaster} size={[w, 0.22, 0.5]} position={[0, h - 0.11, zc - d / 2 + 0.25]} tile={TILE.plaster} cast={false} />
      <Box m={m.plaster} size={[w, 0.22, 0.5]} position={[0, h - 0.11, zc + d / 2 - 0.25]} tile={TILE.plaster} cast={false} />
      <Box m={m.plaster} size={[0.5, 0.22, d - 1]} position={[-w / 2 + 0.25, h - 0.11, zc]} tile={TILE.plaster} cast={false} />
      <Box m={m.plaster} size={[0.5, 0.22, d - 1]} position={[w / 2 - 0.25, h - 0.11, zc]} tile={TILE.plaster} cast={false} />
      {panels.map(([x, z]) => (
        <mesh key={`${x}:${z}`} material={ceilingLed} position={[x, h - 0.012, z]}>
          <boxGeometry args={[0.6, 0.02, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}
