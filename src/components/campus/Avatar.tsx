'use client';
/**
 * The student's own body: a rigged Rocketbox avatar driven by motion-captured
 * clips (Rocketbox, MIT) - idle, walk and an occasional look-around -
 * blended by the speed the controller reports.
 *
 * `motion.current.speed` is metres per second along the ground. The walk
 * clip is in place, so its playback rate follows the real speed: feet do
 * not slide.
 */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarModel } from '@/game/profile';

const FILES: Record<AvatarModel, { body: string; anims: string; walkSpeed: number }> = {
  // inPlaceSpeed from public/assets/characters/anims.json
  man: { body: '/assets/characters/man.glb', anims: '/assets/characters/anims_m.glb', walkSpeed: 1.4024 },
  woman: { body: '/assets/characters/woman.glb', anims: '/assets/characters/anims_f.glb', walkSpeed: 1.2946 },
};
for (const f of Object.values(FILES)) {
  useGLTF.preload(f.body);
  useGLTF.preload(f.anims);
}

export interface AvatarMotion {
  speed: number;
}

export function Avatar({ model, motion, reducedMotion = false, onFootstep }: { model: AvatarModel; motion: React.RefObject<AvatarMotion>; reducedMotion?: boolean; onFootstep?: () => void }) {
  const files = FILES[model];
  const body = useGLTF(files.body);
  const anims = useGLTF(files.anims);

  const scene = useMemo(() => {
    const clone = cloneSkinned(body.scene) as THREE.Group;
    clone.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });
    return clone;
  }, [body.scene]);

  // Mixer lives with the effect, so StrictMode's mount → unmount → mount
  // builds a fresh one instead of reusing actions whose cache was released.
  const anim = useRef<{ mixer: THREE.AnimationMixer; idle: THREE.AnimationAction; walk: THREE.AnimationAction; look: THREE.AnimationAction } | null>(null);
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(scene);
    const clip = (name: string) => {
      const c = anims.animations.find((a) => a.name === name);
      if (!c) throw new Error(`animation clip ${name} missing`);
      return mixer.clipAction(c, scene);
    };
    const idle = clip('stand_idle');
    const walk = clip('walk');
    const look = clip('stand_look_around');
    look.setLoop(THREE.LoopOnce, 1);
    idle.play();
    walk.play();
    walk.setEffectiveWeight(0);
    anim.current = { mixer, idle, walk, look };
    return () => {
      anim.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    };
  }, [scene, anims.animations]);

  const state = useRef({ blend: 0, still: 0, phase: 0 });

  useFrame((_, rawDt) => {
    if (!anim.current) return;
    const { mixer, idle, walk, look } = anim.current;
    const dt = Math.min(rawDt, 0.05);
    const speed = motion.current?.speed ?? 0;
    const s = state.current;
    // 0 → standing, 1 → walking; quick to start, a touch slower to settle
    const target = THREE.MathUtils.clamp(speed / 0.6, 0, 1);
    s.blend = THREE.MathUtils.damp(s.blend, target, target > s.blend ? 9 : 6, dt);
    walk.setEffectiveWeight(s.blend);
    walk.timeScale = THREE.MathUtils.clamp(speed / files.walkSpeed, 0.6, 1.9);

    // left alone for a while → glance around, like people do while waiting
    s.still = speed < 0.05 ? s.still + dt : 0;
    if (!reducedMotion && s.still > 9 && !look.isRunning()) {
      s.still = -6;
      look.reset().setEffectiveWeight(1).fadeIn(0.5).play();
      idle.fadeOut(0.5);
    }
    if (look.isRunning() && (speed > 0.05 || look.time > look.getClip().duration - 0.6)) {
      look.fadeOut(0.5);
      idle.reset().fadeIn(0.5).play();
    }
    idle.setEffectiveWeight(look.isRunning() ? Math.max(0, 1 - s.blend) * 0.2 : 1 - s.blend);
    mixer.update(dt);

    // a footstep sounds where a foot actually lands in the walk cycle (twice per loop)
    const cycle = walk.time / walk.getClip().duration;
    const half = Math.floor(cycle * 2);
    if (half !== s.phase) {
      s.phase = half;
      if (s.blend > 0.45) onFootstep?.();
    }
  });

  return <primitive object={scene} />;
}
