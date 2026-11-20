'use client';
/**
 * First-person player.
 *
 *  - Rapier kinematic character controller (capsule): slides along walls,
 *    auto-steps small ledges, never tunnels through furniture.
 *  - Pointer-lock mouse look with user sensitivity; pitch is clamped.
 *  - Movement is projected onto the horizontal plane of the camera yaw.
 *  - Interaction focus = distance + view cone + physics line-of-sight.
 *  - Sitting at the desk blends the camera to a fixed seat pose; while
 *    seated the cursor is free for the DOM dialogue, with gentle parallax.
 *
 * All per-frame data lives in refs / module temporaries: no React state is
 * touched inside `useFrame` except when the focused target actually changes.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audio } from '@/game/audio';
import { INTERACTABLES, MONITOR, NPC_SEAT, SEAT, SPAWN } from '@/game/manifest';
import { useGame } from '@/game/store';

const HALF_HEIGHT = 0.55;
const RADIUS = 0.3;
const CENTER_Y = HALF_HEIGHT + RADIUS + 0.02;
const EYE_OFFSET = 1.62 - CENTER_Y;
const WALK = 1.9; // m/s
const BRISK = 3.1;

const keys = new Set<string>();
const _wish = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _seat = new THREE.Vector3(...SEAT.eye);
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const damp = THREE.MathUtils.damp;

/** Shortest-path angle interpolation. */
const dampAngle = (a: number, b: number, lambda: number, dt: number) => {
  const delta = THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + delta * (1 - Math.exp(-lambda * dt));
};
const yawTo = (from: THREE.Vector3, to: readonly number[]) => Math.atan2(-(to[0] - from.x), -(to[2] - from.z));

export function Player() {
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);

  const state = useRef({
    pos: new THREE.Vector3(SPAWN.position[0], CENTER_Y, SPAWN.position[2]),
    yaw: SPAWN.yaw,
    pitch: 0,
    seat: 0,
    seatYaw: SEAT.yaw,
    seatPitch: SEAT.pitch,
    mouseX: 0,
    mouseY: 0,
    stride: 0,
    free: 1,
    settle: 0,
    settleSeat: '',
    frame: 0,
    fov: 68,
  });

  // Created in an effect (not useMemo): StrictMode's mount → unmount → mount
  // would otherwise free the WASM controller while the memo still holds it.
  const controller = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  useEffect(() => {
    const c = world.createCharacterController(0.02);
    c.enableAutostep(0.25, 0.2, true);
    c.enableSnapToGround(0.3);
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(false);
    controller.current = c;
    return () => {
      controller.current = null;
      world.removeCharacterController(c);
    };
  }, [world]);

  useEffect(() => {
    const dom = gl.domElement;
    const lock = () => {
      if (document.pointerLockElement === dom) return;
      // Some browsers reject the request without a fresh gesture: stay paused then.
      Promise.resolve(dom.requestPointerLock()).catch(() => useGame.getState().pause());
    };
    useGame.setState({ requestPointerLock: lock });

    // QA hook (fixed-camera screenshots, visual regression). Off unless explicitly enabled.
    const debug =
      process.env.NEXT_PUBLIC_LEXSIM_DEBUG === '1' ||
      (process.env.NODE_ENV === 'development' && localStorage.getItem('lexsim.debug') === '1');
    if (debug) {
      (window as unknown as { __lexsimDebug?: unknown }).__lexsimDebug = {
        teleport: (x: number, z: number, yaw = 0, pitch = 0) => {
          state.current.pos.set(x, CENTER_Y, z);
          state.current.yaw = yaw;
          state.current.pitch = pitch;
        },
        game: useGame,
      };
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      keys.add(e.code);
      if (e.code === 'KeyE' && !e.repeat) interact();
      if (e.code === 'KeyG' && !e.repeat && useGame.getState().mode === 'resting') useGame.getState().stand();
    };
    /** E or left click on whatever the crosshair is resting on. */
    const interact = () => {
      const game = useGame.getState();
      if (game.mode === 'resting') return game.stand();
      if (game.mode !== 'exploring' || !game.focus) return;
      const target = INTERACTABLES.find((i) => i.id === game.focus!.id);
      if (target?.item) game.inspect(target.item);
      else if (target?.seat) game.rest(target.seat);
      else if (game.focus.id === 'staff-seat') void game.sit();
      else if (game.focus.id === 'terminal') void game.openTerminal();
      else if (game.focus.id === 'room-door') {
        // Never swing the door shut onto someone standing in the doorway.
        const { pos } = state.current;
        const inDoorway = Math.abs(pos.z) < 0.75 && Math.abs(pos.x - 2.95) < 0.9;
        if (!game.doorOpen || !inDoorway) game.toggleDoor();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const clear = () => keys.clear();
    const onMouseMove = (e: MouseEvent) => {
      const s = state.current;
      if (document.pointerLockElement === dom) {
        const k = 0.0021 * useGame.getState().settings.sensitivity;
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) s.settle = 0;
        s.yaw -= e.movementX * k;
        s.pitch = THREE.MathUtils.clamp(s.pitch - e.movementY * k, -1.35, 1.35);
      } else {
        s.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        s.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      }
    };
    const onLockChange = () => {
      const game = useGame.getState();
      if (document.pointerLockElement !== dom && !game.inspecting && (game.mode === 'exploring' || game.mode === 'resting')) game.pause(); // Esc
    };
    const onClick = () => {
      const { mode } = useGame.getState();
      if ((mode !== 'exploring' && mode !== 'resting') || useGame.getState().inspecting) return;
      if (document.pointerLockElement === dom) {
        if (mode === 'exploring') interact();
      }
      else lock();
    };
    const onVisibility = () => {
      if (document.hidden) {
        clear();
        useGame.getState().pause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('visibilitychange', onVisibility);
    dom.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onVisibility);
      dom.removeEventListener('click', onClick);
      useGame.setState({ requestPointerLock: null });
      keys.clear();
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    const game = useGame.getState();
    const { mode, settings } = game;
    const locked = document.pointerLockElement === gl.domElement;
    const walking = mode === 'exploring' && locked;

    /* ── locomotion ── */
    _wish.set(0, 0, 0);
    if (walking) {
      const f = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const r = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      if (f || r) {
        const sin = Math.sin(s.yaw);
        const cos = Math.cos(s.yaw);
        _wish.set(-sin * f + cos * r, 0, -cos * f - sin * r).normalize();
        _wish.multiplyScalar(keys.has('ShiftLeft') || keys.has('ShiftRight') ? BRISK : WALK);
      }
    }
    // Quick but not instant acceleration: responsive without feeling robotic.
    _vel.x = damp(_vel.x, _wish.x, 12, dt);
    _vel.z = damp(_vel.z, _wish.z, 12, dt);

    const kcc = controller.current;
    if (kcc && body.current && collider.current) {
      kcc.computeColliderMovement(collider.current, { x: _vel.x * dt, y: -4 * dt, z: _vel.z * dt });
      const m = kcc.computedMovement();
      s.pos.x += m.x;
      s.pos.y += m.y;
      s.pos.z += m.z;
      body.current.setNextKinematicTranslation(s.pos);

      const moved = Math.hypot(m.x, m.z);
      s.stride += moved;
      if (s.stride > 0.72) {
        s.stride = 0;
        audio.footstep(s.pos.z > 0); // terrazzo in the lobby, laminate in the room
      }
    }

    /* ── camera ── */
    // Two kinds of sitting: at your desk (camera frames the citizen) or resting on
    // any free seat (you keep full control of where you look).
    const resting = (mode === 'resting' || (mode === 'paused' && game.resumeMode === 'resting')) && game.restSeat !== null;
    const seated = resting || mode === 'seated' || mode === 'document' || (mode === 'paused' && game.resumeMode !== 'exploring') || (mode === 'ended' && s.seat > 0.5);
    s.seat = settings.reducedMotion ? Number(seated) : damp(s.seat, Number(seated), 5.5, dt);
    if (resting) {
      _seat.set(...game.restSeat!.eye);
      // Sitting down turns you to face the room; the first mouse move hands control back.
      if (s.settleSeat !== game.restSeat!.id) {
        s.settleSeat = game.restSeat!.id;
        s.settle = 1;
      }
      if (s.settle > 0.02) {
        s.yaw = dampAngle(s.yaw, game.restSeat!.yaw, 5, dt);
        s.pitch = damp(s.pitch, -0.06, 5, dt);
        s.settle = damp(s.settle, 0, 2.2, dt);
      }
    } else {
      s.settleSeat = '';
      if (mode === 'seated' || mode === 'document') _seat.set(...SEAT.eye);
    }
    s.free = damp(s.free, Number(resting || !seated), 6, dt);

    _eye.set(s.pos.x, s.pos.y + EYE_OFFSET, s.pos.z);
    // While seated: look at the citizen, or at the monitor when the form is open.
    // Aim at his chest so the face sits in the upper third, clear of the dialogue sheet.
    const lookAt = mode === 'document' ? [MONITOR.position[0], 1.12, MONITOR.position[2]] : [NPC_SEAT.head[0], 0.82, NPC_SEAT.head[2]];
    const parallax = settings.reducedMotion ? 0 : 1;
    const targetYaw = yawTo(_seat, lookAt) - s.mouseX * 0.07 * parallax;
    const targetPitch = Math.atan2(lookAt[1] - _seat.y, Math.hypot(lookAt[0] - _seat.x, lookAt[2] - _seat.z)) - s.mouseY * 0.04 * parallax;
    s.seatYaw = dampAngle(s.seatYaw, targetYaw, 5, dt);
    s.seatPitch = damp(s.seatPitch, targetPitch, 5, dt);

    camera.position.lerpVectors(_eye, _seat, s.seat);
    // Blend yaw along the shortest arc so sitting down never spins the long way round.
    const arc = THREE.MathUtils.euclideanModulo(s.seatYaw - s.yaw + Math.PI, Math.PI * 2) - Math.PI;
    const framed = s.seat * (1 - s.free); // 0 → the player's own view, 1 → the desk framing
    _euler.set(THREE.MathUtils.lerp(s.pitch, s.seatPitch, framed), s.yaw + arc * framed, 0);
    camera.quaternion.setFromEuler(_euler);

    const fov = settings.fov - framed * 16; // seated framing is tighter, like leaning in
    if (Math.abs(fov - s.fov) > 0.01) {
      s.fov = fov;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    /* ── interaction focus (every 4th frame) ── */
    if (++s.frame % 4 !== 0) return;
    if (mode !== 'exploring' || !collider.current) {
      if (game.focus) game.setFocus(null);
      return;
    }
    camera.getWorldDirection(_fwd);
    let best: (typeof INTERACTABLES)[number] | null = null;
    let bestDot = 0.86; // ≈ 30° cone
    for (const item of INTERACTABLES) {
      _dir.set(item.point[0] - _eye.x, item.point[1] - _eye.y, item.point[2] - _eye.z);
      const dist = _dir.length();
      if (dist > item.radius) continue;
      _dir.divideScalar(dist);
      const dot = _dir.dot(_fwd);
      if (dot < bestDot) continue;
      // Line of sight: nothing solid may sit clearly in front of the target.
      const hit = world.castRay(new rapier.Ray(_eye, _dir), dist, true, undefined, undefined, collider.current);
      const toi = hit ? ((hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi) : Infinity;
      if (toi < dist - 0.9) continue;
      best = item;
      bestDot = dot;
    }
    const prompt = best?.id === 'room-door' ? (game.doorOpen ? 'Eshikni yopish' : 'Eshikni ochish') : best?.prompt;
    game.setFocus(best && prompt ? { id: best.id, prompt } : null);
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[SPAWN.position[0], CENTER_Y, SPAWN.position[2]]}>
      <CapsuleCollider ref={collider} args={[HALF_HEIGHT, RADIUS]} />
    </RigidBody>
  );
}
