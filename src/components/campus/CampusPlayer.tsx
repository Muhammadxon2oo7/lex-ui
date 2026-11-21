'use client';
/**
 * Third-person controller and the one camera of the campus.
 *
 * Each phase only describes where the camera WANTS to be - over the
 * shoulder onto the orientation terminal, or a follow camera while walking -
 * and the real camera eases toward it, so leaving the terminal and walking
 * off is one continuous move, never a cut.
 *
 * Movement: Rapier kinematic capsule (slides along walls, steps small
 * ledges), camera-relative WASD, Shift to walk briskly. The follow camera
 * is pulled in when a wall would come between it and the student.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { audio } from '@/game/audio';
import { DOORS, INFO_BOARD, KIOSK, SPAWN, doorApproach } from '@/game/campus';
import { useCampus } from '@/game/campusStore';
import type { AvatarModel } from '@/game/profile';
import { Avatar, type AvatarMotion } from './Avatar';

const HALF = 0.55;
const RADIUS = 0.28;
const CENTER_Y = HALF + RADIUS + 0.02;
const WALK = 1.45;
const BRISK = 2.5;

/** Shared, per-frame state other parts of the world read (never React state). */
export const rig = {
  position: new THREE.Vector3(...SPAWN.position),
};

const keys = new Set<string>();
const _wish = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const damp = THREE.MathUtils.damp;
const wrap = (a: number) => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
const dampAngle = (a: number, b: number, lambda: number, dt: number) => a + wrap(b - a) * (1 - Math.exp(-lambda * dt));


export function CampusPlayer({ avatar, reducedMotion, sensitivity }: { avatar: AvatarModel; reducedMotion: boolean; sensitivity: number }) {
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<THREE.Group>(null);
  const motion = useRef<AvatarMotion>({ speed: 0 });
  const controller = useRef<ReturnType<typeof world.createCharacterController> | null>(null);

  const initial = { position: SPAWN.position, yaw: SPAWN.yaw };
  const s = useRef({
    pos: new THREE.Vector3(initial.position[0], CENTER_Y, initial.position[2]),
    yaw: initial.yaw, // avatar facing; 0 → +Z
    orbit: initial.yaw + Math.PI, // direction from the avatar to the camera
    pitch: 0.18,
    dist: 3.3,
    stride: 0,
    lean: 0,
    t: 0,
    phaseAt: 0,
    lastPhase: '',
    frame: 0,
  });

  useEffect(() => {
    const c = world.createCharacterController(0.02);
    c.enableAutostep(0.3, 0.2, true);
    c.enableSnapToGround(0.3);
    c.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
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
      Promise.resolve(dom.requestPointerLock()).catch(() => undefined);
    };
    useCampus.getState().set({ requestPointerLock: lock });

    // QA hook (fixed-camera screenshots). Dev only, opt-in via localStorage.
    if (process.env.NODE_ENV === 'development' && localStorage.getItem('lexsim.debug') === '1') {
      (window as unknown as { __campus?: unknown }).__campus = {
        teleport: (x: number, z: number, yaw: number, orbit?: number, pitch?: number) => {
          s.current.pos.set(x, CENTER_Y, z);
          s.current.yaw = yaw;
          s.current.orbit = orbit ?? yaw + Math.PI;
          if (pitch !== undefined) s.current.pitch = pitch;
        },
        store: useCampus,
      };
    }

    const interact = () => {
      const campus = useCampus.getState();
      if (campus.phase !== 'play' || !campus.focus) return;
      if (campus.focus.kind === 'kiosk') {
        campus.set({ phase: 'kiosk' });
        if (document.pointerLockElement) document.exitPointerLock();
        return;
      }
      if (campus.focus.kind === 'board') {
        campus.set({ phase: 'board' });
        if (document.pointerLockElement) document.exitPointerLock();
        return;
      }
      const door = DOORS.find((d) => d.id === campus.focus!.id)!;
      if (!door.action) {
        audio.door(false);
        campus.set({ toast: `«${door.title}» hali tayyorlanmoqda - tez orada ochiladi.` });
        return;
      }
      audio.door(true);
      campus.set({ phase: 'entering', opening: door.id, focus: null });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      keys.add(e.code);
      if (e.code === 'KeyE' && !e.repeat) interact();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const clear = () => keys.clear();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== dom || useCampus.getState().phase !== 'play') return;
      const k = 0.0022 * sensitivity;
      s.current.orbit -= e.movementX * k;
      s.current.pitch = THREE.MathUtils.clamp(s.current.pitch + e.movementY * k, -0.45, 0.95);
    };
    const onWheel = (e: WheelEvent) => {
      if (useCampus.getState().phase !== 'play') return;
      s.current.dist = THREE.MathUtils.clamp(s.current.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1), 1.6, 6);
    };
    const onLockChange = () => {
      const campus = useCampus.getState();
      if (document.pointerLockElement !== dom && campus.phase === 'play') campus.set({ phase: 'paused' });
    };
    const onClick = () => {
      const { phase } = useCampus.getState();
      if (phase !== 'play') return;
      if (document.pointerLockElement === dom) interact();
      else lock();
    };
    const onVisibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    window.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('wheel', onWheel, { passive: true });
    dom.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      window.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onVisibility);
      useCampus.getState().set({ requestPointerLock: null });
      keys.clear();
    };
  }, [gl, sensitivity]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    const campus = useCampus.getState();
    const { phase } = campus;
    st.t += dt;
    if (phase !== st.lastPhase) {
      st.lastPhase = phase;
      st.phaseAt = st.t;
      if (phase === 'play') st.orbit = st.yaw + Math.PI; // leaving the terminal: settle behind
    }
    const since = st.t - st.phaseAt;

    /* ── locomotion ── */
    _wish.set(0, 0, 0);
    const locked = document.pointerLockElement === gl.domElement;
    if (phase === 'play' && locked) {
      const f = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const r = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      if (f || r) {
        // camera-relative: forward is away from the camera
        const fx = -Math.sin(st.orbit);
        const fz = -Math.cos(st.orbit);
        _wish.set(fx * f - fz * r, 0, fz * f + fx * r).normalize();
        _wish.multiplyScalar(keys.has('ShiftLeft') || keys.has('ShiftRight') ? BRISK : WALK);
      }
    }
    _vel.x = damp(_vel.x, _wish.x, 9, dt);
    _vel.z = damp(_vel.z, _wish.z, 9, dt);
    const kcc = controller.current;
    let moved = 0;
    if (kcc && body.current && collider.current && phase === 'play') {
      kcc.computeColliderMovement(collider.current, { x: _vel.x * dt, y: -4 * dt, z: _vel.z * dt });
      const m = kcc.computedMovement();
      st.pos.x += m.x;
      st.pos.y += m.y;
      st.pos.z += m.z;
      moved = Math.hypot(m.x, m.z);
    }
    body.current?.setNextKinematicTranslation(st.pos);
    rig.position.set(st.pos.x, 0, st.pos.z);

    const speed = moved / Math.max(dt, 1e-4);
    motion.current.speed = THREE.MathUtils.damp(motion.current.speed, speed, 12, dt);
    const prevYaw = st.yaw;
    if (speed > 0.2) st.yaw = dampAngle(st.yaw, Math.atan2(_vel.x, _vel.z), 8, dt);
    // lean into turns a little, the way a walking body does
    const turnRate = wrap(st.yaw - prevYaw) / Math.max(dt, 1e-4);
    st.lean = damp(st.lean, THREE.MathUtils.clamp(-turnRate * speed * 0.018, -0.08, 0.08), 6, dt);

    if (visual.current) {
      visual.current.position.set(st.pos.x, st.pos.y - CENTER_Y, st.pos.z);
      visual.current.rotation.set(0, st.yaw, reducedMotion ? 0 : st.lean);
    }

    /* ── camera: where it wants to be ── */
    let lambda = 14;
    if (phase === 'kiosk' || (phase === 'entering' && !campus.opening?.startsWith('r'))) {
      // over the shoulder, onto the terminal screen
      _desired.set(st.pos.x + 0.62, 1.66, st.pos.z + 1.05);
      _look.set(KIOSK.screen[0] + 0.25, KIOSK.screen[1], KIOSK.screen[2]);
      lambda = THREE.MathUtils.lerp(2.5, 9, THREE.MathUtils.smoothstep(since, 0, 1.2));
    } else {
      _target.set(st.pos.x, st.pos.y - CENTER_Y + 1.6, st.pos.z);
      const cp = Math.cos(st.pitch);
      _dir.set(Math.sin(st.orbit) * cp, Math.sin(st.pitch), Math.cos(st.orbit) * cp);
      // keep the camera on our side of any wall
      let dist = st.dist;
      if (collider.current) {
        const hit = world.castRay(new rapier.Ray(_target, _dir), dist + 0.25, true, undefined, undefined, collider.current);
        const toi = hit ? ((hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi) : Infinity;
        if (toi < dist + 0.25) dist = Math.max(0.6, toi - 0.25);
      }
      // over the right shoulder
      const sx = Math.cos(st.orbit) * 0.42;
      const sz = -Math.sin(st.orbit) * 0.42;
      _desired.copy(_target).addScaledVector(_dir, dist).add(_look.set(sx, 0, sz));
      _look.set(_target.x + sx, _target.y - 0.1, _target.z + sz);
      // ease in after a phase change, then follow tightly
      lambda = THREE.MathUtils.lerp(2.2, 16, THREE.MathUtils.smoothstep(since, 0, 1.6));
    }
    camera.position.x = damp(camera.position.x, _desired.x, lambda, dt);
    camera.position.y = damp(camera.position.y, _desired.y, lambda, dt);
    camera.position.z = damp(camera.position.z, _desired.z, lambda, dt);
    _q.setFromRotationMatrix(_m.lookAt(camera.position, _look, UP));
    camera.quaternion.slerp(_q, 1 - Math.exp(-lambda * 1.2 * dt));

    /* ── what is in front of us ── */
    if (++st.frame % 5 !== 0) return;
    if (phase !== 'play') {
      if (campus.focus) campus.set({ focus: null });
      return;
    }
    let focus: typeof campus.focus = null;
    let best = 1.7;
    for (const door of DOORS) {
      const a = doorApproach(door).position;
      const d = Math.hypot(a[0] - st.pos.x, a[2] - st.pos.z);
      if (d < best) {
        best = d;
        focus = { kind: 'door', id: door.id };
      }
    }
    if (!focus && Math.hypot(KIOSK.position[0] - st.pos.x, KIOSK.position[2] - st.pos.z) < KIOSK.radius) focus = { kind: 'kiosk', id: 'kiosk' };
    if (!focus && Math.hypot(INFO_BOARD.position[0] - st.pos.x, INFO_BOARD.position[2] - st.pos.z) < INFO_BOARD.radius) focus = { kind: 'board', id: 'board' };
    if (focus?.id !== campus.focus?.id) campus.set({ focus });
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[initial.position[0], CENTER_Y, initial.position[2]]}>
        <CapsuleCollider ref={collider} args={[HALF, RADIUS]} />
      </RigidBody>
      <group ref={visual}>
        <Avatar key={avatar} model={avatar} motion={motion} reducedMotion={reducedMotion} onFootstep={() => audio.footstep(true)} />
      </group>
    </>
  );
}
