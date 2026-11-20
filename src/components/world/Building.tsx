'use client';
/**
 * Architecture of the DXM branch: walls, floors, ceilings, windows with
 * vertical blinds, the glazed entrance, skirting, ceiling luminaires and the
 * static physics colliders — all generated from the room manifest.
 */
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, type RapierCollider } from '@react-three/rapier';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CEILING_LIGHTS, COLLIDERS, ENTRANCE, ROOM_DOOR, SKIRTING, STRUCTURE, WINDOWS, type WindowDef } from '@/game/manifest';
import { useGame } from '@/game/store';
import { TILE, canvasTexture, tiledBox, type Materials } from './materials';

/**
 * What you see through the glazing: an overexposed, out-of-focus street
 * (sky, pale buildings, trees). Values > 1 feed the bloom, the way a real
 * window blows out against an interior exposure.
 */
function makeSkyMaterial() {
  const map = canvasTexture(512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#cfe3f7');
    sky.addColorStop(0.62, '#f3f6f8');
    sky.addColorStop(1, '#d9d6cc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(5px)';
    for (let i = 0; i < 9; i++) {
      const bw = 40 + ((i * 53) % 60);
      const bh = 50 + ((i * 97) % 80);
      ctx.fillStyle = ['#c9cfd6', '#d6d2c8', '#bfc7cf'][i % 3];
      ctx.fillRect(i * 60 - 10, h * 0.72 - bh, bw, bh + 20);
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#9fb58f' : '#8aa57c';
      ctx.beginPath();
      ctx.arc(20 + i * 45, h * 0.74, 22 + ((i * 31) % 14), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = 'none';
  });
  return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(2.3, 2.35, 2.45), toneMapped: false });
}
let skyMaterialCache: THREE.MeshBasicMaterial | null = null;
const getSky = () => (skyMaterialCache ??= makeSkyMaterial());
const blindMaterial = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.85, side: THREE.DoubleSide });
const panelMaterial = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  emissive: new THREE.Color('#fff4e2'),
  emissiveIntensity: 2.2,
  roughness: 0.6,
});

function Structure({ m }: { m: Materials }) {
  const parts = useMemo(
    () => STRUCTURE.map((b) => ({ ...b, geometry: tiledBox(b.s[0], b.s[1], b.s[2], TILE[b.surface]) })),
    [],
  );
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  return (
    <>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={m[p.surface]} position={p.c} castShadow receiveShadow />
      ))}
    </>
  );
}

function Skirting({ m }: { m: Materials }) {
  return (
    <>
      {SKIRTING.map(([x0, z0, x1, z1], i) => {
        const alongX = z0 === z1;
        const len = alongX ? x1 - x0 : z1 - z0;
        return (
          <mesh key={i} material={m.trim} position={[(x0 + x1) / 2, 0.045, (z0 + z1) / 2]} receiveShadow>
            <boxGeometry args={alongX ? [len, 0.09, 0.03] : [0.03, 0.09, len]} />
          </mesh>
        );
      })}
    </>
  );
}

function Blinds({ w }: { w: WindowDef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const height = w.head - w.sill - 0.06;
  const count = Math.floor((w.z1 - w.z0 - 0.1) / 0.105);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(6.93, w.sill + 0.03 + height / 2, w.z0 + 0.08 + i * 0.105);
      // Slightly irregular louvre angle: nobody adjusts blinds perfectly.
      dummy.rotation.set(0, 0.95 + Math.sin(i * 12.9898) * 0.06, 0);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [count, height, w]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={blindMaterial} castShadow receiveShadow>
      <boxGeometry args={[0.004, height, 0.09]} />
    </instancedMesh>
  );
}

function Window({ w, m }: { w: WindowDef; m: Materials }) {
  const zc = (w.z0 + w.z1) / 2;
  const yc = (w.sill + w.head) / 2;
  const width = w.z1 - w.z0;
  const height = w.head - w.sill;
  return (
    <group>
      <mesh material={getSky()} position={[8.4 + (WINDOWS.indexOf(w) % 4) * 0.03, 1.6, zc]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[width + 3, 4.4]} />
      </mesh>
      <mesh material={m.glass} position={[7.1, yc, zc]}>
        <boxGeometry args={[0.02, height, width]} />
      </mesh>
      {/* frame: head, sill board, jambs and one mullion */}
      <mesh material={m.trim} position={[7.08, w.head - 0.025, zc]} castShadow>
        <boxGeometry args={[0.1, 0.05, width]} />
      </mesh>
      <mesh material={m.whiteLaminate} position={[6.96, w.sill + 0.015, zc]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.03, width + 0.08]} />
      </mesh>
      {[w.z0 + 0.025, zc, w.z1 - 0.025].map((z) => (
        <mesh key={z} material={m.trim} position={[7.08, yc, z]} castShadow>
          <boxGeometry args={[0.096, height, 0.05]} />
        </mesh>
      ))}
      {/* blind head rail */}
      <mesh material={m.whiteLaminate} position={[6.93, w.head - 0.02, zc]}>
        <boxGeometry args={[0.05, 0.04, width]} />
      </mesh>
      <Blinds w={w} />
    </group>
  );
}

function Entrance({ m }: { m: Materials }) {
  const width = ENTRANCE.x1 - ENTRANCE.x0;
  return (
    <group>
      <mesh material={getSky()} position={[0, 1.4, 11.6]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width + 3, 4]} />
      </mesh>
      {[-width / 4, width / 4].map((x) => (
        <group key={x} position={[x, ENTRANCE.head / 2, 10.05]}>
          <mesh material={m.glass}>
            <boxGeometry args={[width / 2 - 0.06, ENTRANCE.head - 0.08, 0.02]} />
          </mesh>
          <mesh material={m.metal} position={[-Math.sign(x) * (width / 4 - 0.14), -0.1, -0.05]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.5, 12]} />
          </mesh>
        </group>
      ))}
      {[ENTRANCE.x0 + 0.03, 0, ENTRANCE.x1 - 0.03].map((x) => (
        <mesh key={x} material={m.trim} position={[x, ENTRANCE.head / 2, 10.05]}>
          <boxGeometry args={[0.06, ENTRANCE.head, 0.08]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, ENTRANCE.head - 0.03, 10.05]}>
        <boxGeometry args={[width, 0.06, 0.076]} />
      </mesh>
      {/* entrance mat */}
      <mesh material={m.trim} position={[0, 0.006, 9.2]} receiveShadow>
        <boxGeometry args={[2, 0.012, 1.1]} />
      </mesh>
    </group>
  );
}

/** Hinged door of room 3: E / click swings it; the blocking collider follows its state. */
function RoomDoor({ m }: { m: Materials }) {
  const width = ROOM_DOOR.x1 - ROOM_DOOR.x0;
  const open = useGame((s) => s.doorOpen);
  const leaf = useRef<THREE.Group>(null);
  const closedCollider = useRef<RapierCollider>(null);
  const openCollider = useRef<RapierCollider>(null);

  useEffect(() => {
    closedCollider.current?.setEnabled(!open);
    openCollider.current?.setEnabled(open);
  }, [open]);

  useFrame((_, dt) => {
    if (!leaf.current) return;
    const target = useGame.getState().doorOpen ? -1.46 : 0;
    // Critically damped: a door closer, not a spring toy.
    leaf.current.rotation.y = THREE.MathUtils.damp(leaf.current.rotation.y, target, 6.5, Math.min(dt, 0.05));
  });

  return (
    <group>
      {[ROOM_DOOR.x0 + 0.02, ROOM_DOOR.x1 - 0.02].map((x) => (
        <mesh key={x} material={m.walnut} position={[x, ROOM_DOOR.head / 2, 0]} castShadow>
          <boxGeometry args={[0.05, ROOM_DOOR.head, 0.24]} />
        </mesh>
      ))}
      <mesh material={m.walnut} position={[(ROOM_DOOR.x0 + ROOM_DOOR.x1) / 2, ROOM_DOOR.head - 0.025, 0]}>
        <boxGeometry args={[width, 0.05, 0.236]} />
      </mesh>
      <group ref={leaf} position={[ROOM_DOOR.x1 - 0.05, 0, 0]}>
        <mesh material={m.walnut} position={[-0.5, 1.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 2.02, 0.042]} />
        </mesh>
        {/* lever handles, both faces */}
        {[1, -1].map((side) => (
          <group key={side} position={[-0.9, 1.02, side * 0.045]}>
            <mesh material={m.metal} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.012, 16]} />
            </mesh>
            <mesh material={m.metal} position={[0.05, 0, side * 0.03]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.009, 0.009, 0.12, 10]} />
            </mesh>
          </group>
        ))}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider ref={closedCollider} args={[width / 2, 1.05, 0.06]} position={[(ROOM_DOOR.x0 + ROOM_DOOR.x1) / 2, 1.05, 0]} />
        <CuboidCollider ref={openCollider} args={[0.06, 1, 0.5]} position={[ROOM_DOOR.x1 + 0.02, 1, -0.62]} />
      </RigidBody>
    </group>
  );
}

function Luminaires({ lights }: { lights: boolean }) {
  return (
    <>
      {CEILING_LIGHTS.map(([x, y, z], i) => (
        <mesh key={i} material={panelMaterial} position={[x, y - 0.012, z]}>
          <boxGeometry args={[1.2, 0.02, 0.6]} />
        </mesh>
      ))}
      {lights && (
        <>
          <pointLight position={[0, 2.6, 3.2]} intensity={6} distance={11} decay={2} color="#fff1dc" />
          <pointLight position={[0, 2.6, 6.6]} intensity={6} distance={11} decay={2} color="#fff1dc" />
          <pointLight position={[3.6, 2.6, -3.2]} intensity={5} distance={8} decay={2} color="#fff1dc" />
        </>
      )}
    </>
  );
}

export function Building({ m, lights }: { m: Materials; lights: boolean }) {
  return (
    <group>
      <Structure m={m} />
      <Skirting m={m} />
      {WINDOWS.map((w) => (
        <Window key={w.z0} w={w} m={m} />
      ))}
      <Entrance m={m} />
      <RoomDoor m={m} />
      <Luminaires lights={lights} />
      <RigidBody type="fixed" colliders={false}>
        {COLLIDERS.map((c, i) => (
          <CuboidCollider key={i} args={c.half} position={c.c} />
        ))}
      </RigidBody>
    </group>
  );
}
