'use client';
/**
 * Papers on the desk you can actually handle.
 *
 *   press and drag  → pick it up and slide it across the desk (it lifts a
 *                     little, follows your hand, and settles where you let go,
 *                     never off the edge);
 *   click           → take it in your hands (see HandView);
 *   hover           → its name.
 *
 * While you hold something the camera does not turn (hand.holding).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { drawPage, type DeskDoc } from './documents';
import { hand } from './interaction';
import { audio } from '@/game/audio';

const pageTextures = new Map<string, THREE.CanvasTexture>();
/** A page drawn once at print resolution and reused (desk, hand, folder). */
export function pageTexture(doc: DeskDoc, index: number): THREE.CanvasTexture {
  const key = `${doc.id}:${index}:${doc.pages[index]?.title}`;
  let t = pageTextures.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = 1000;
    c.height = 1414;
    drawPage(c.getContext('2d')!, c.width, c.height, doc.pages[index]);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    pageTextures.set(key, t);
  }
  return t;
}

/** Whatever you put down last lies on top (papers stack, they never share a plane). */
let stackTop = 0;

const paperSide = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.9 });
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

/** The physical shape of a document (sizes in metres, real A4 / folder / phone box). */
export function DocShape({ doc, hovered = false }: { doc: DeskDoc; hovered?: boolean }) {
  const top = useMemo(() => pageTexture(doc, 0), [doc]);
  const glow = hovered ? 0.18 : 0;
  if (doc.kind === 'folder') {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.012, 0]}>
          <boxGeometry args={[0.245, 0.024, 0.325]} />
          <meshStandardMaterial color={doc.color ?? '#2f5d8a'} roughness={0.75} emissive="#ffffff" emissiveIntensity={glow * 0.5} />
        </mesh>
        <mesh position={[0, 0.0245, 0.04]} rotation={[-Math.PI / 2, 0, Math.PI]}>
          <planeGeometry args={[0.15, 0.06]} />
          <meshStandardMaterial color="#f3efe4" roughness={0.9} />
        </mesh>
      </group>
    );
  }
  if (doc.kind === 'box') {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[0.09, 0.04, 0.17]} />
          <meshStandardMaterial color={doc.color ?? '#1b1d22'} roughness={0.4} emissive="#ffffff" emissiveIntensity={glow * 0.4} />
        </mesh>
        <mesh position={[0, 0.0405, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 0.03]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
        {/* the receipt tucked under the box */}
        <mesh position={[0.08, 0.001, 0.02]} rotation={[-Math.PI / 2, 0, 0.3]} receiveShadow>
          <planeGeometry args={[0.07, 0.15]} />
          <meshStandardMaterial map={top} roughness={0.9} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.0008, 0]} material={paperSide}>
        <boxGeometry args={[0.21, 0.0016, 0.297]} />
      </mesh>
      <mesh position={[0, 0.0017, 0]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <planeGeometry args={[0.21, 0.297]} />
        <meshStandardMaterial map={top} roughness={0.88} emissive="#ffffff" emissiveIntensity={glow} emissiveMap={top} />
      </mesh>
    </group>
  );
}

function Item({ doc, slot, top, bounds, facing, onInspect, onHover }: {
  doc: DeskDoc;
  /** Heading of the reader (papers lie the right way up for you). */
  facing: number;
  slot: [number, number];
  top: number;
  bounds: [number, number, number, number];
  onInspect: (doc: DeskDoc) => void;
  onHover: (name: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const raycaster = useThree((s) => s.raycaster);
  const pointer = useThree((s) => s.pointer);
  const gl = useThree((s) => s.gl);
  const [hovered, setHovered] = useState(false);
  const state = useRef({ x: slot[0], z: slot[1], tx: slot[0], tz: slot[1], lift: 0, held: false, dragged: false, sx: 0, sy: 0, yaw: (slot[0] * 7.3) % 0.18 - 0.09, layer: 0 });

  useEffect(() => {
    const up = () => {
      const s = state.current;
      if (!s.held) return;
      s.held = false;
      if (s.dragged) {
        s.layer = ++stackTop;
        audio.paper(); // laid down
      }
      hand.holding = false;
      gl.domElement.style.cursor = '';
      if (!s.dragged) onInspect(doc);
    };
    const move = (e: PointerEvent) => {
      const s = state.current;
      if (s.held && !s.dragged && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 6) {
        s.dragged = true;
        audio.paper(); // picked up
        gl.domElement.style.cursor = 'grabbing';
      }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', move);
    };
  }, [doc, gl, onInspect]);

  useFrame((_, dt) => {
    const s = state.current;
    if (s.held && s.dragged) {
      // follow the hand on the desk's surface, never past its edges
      _plane.constant = -top;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(_plane, _hit)) {
        s.tx = THREE.MathUtils.clamp(_hit.x, bounds[0], bounds[1]);
        s.tz = THREE.MathUtils.clamp(_hit.z, bounds[2], bounds[3]);
      }
    }
    const k = Math.min(1, dt);
    s.x = THREE.MathUtils.damp(s.x, s.tx, 14, k);
    s.z = THREE.MathUtils.damp(s.z, s.tz, 14, k);
    s.lift = THREE.MathUtils.damp(s.lift, s.held ? (s.dragged ? 0.035 : 0.012) : 0, s.held ? 16 : 10, k);
    const g = group.current;
    if (g) {
      g.position.set(s.x, top + s.lift + Math.min(s.layer, 12) * 0.0022, s.z);
      // a held sheet tilts a touch toward where it is going
      g.rotation.set((s.tz - s.z) * 1.5, s.yaw + facing, -(s.tx - s.x) * 1.5);
    }
  });

  return (
    <group
      ref={group}
      position={[slot[0], top, slot[1]]}
      onPointerDown={(e) => {
        e.stopPropagation();
        const s = state.current;
        s.held = true;
        s.dragged = false;
        s.sx = e.nativeEvent.clientX;
        s.sy = e.nativeEvent.clientY;
        hand.holding = true;
        gl.domElement.style.cursor = 'grab';
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(doc.name);
        if (!state.current.held) gl.domElement.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        if (!state.current.held) gl.domElement.style.cursor = '';
      }}
    >
      <DocShape doc={doc} hovered={hovered} />
    </group>
  );
}

export function DeskItems({ docs, top, slots, bounds, facing = 0, onInspect, onHover }: {
  docs: DeskDoc[];
  facing?: number;
  top: number;
  slots: [number, number][];
  bounds: [number, number, number, number];
  onInspect: (doc: DeskDoc) => void;
  onHover: (name: string | null) => void;
}) {
  return (
    <>
      {docs.map((doc, i) => (
        <Item key={doc.id} doc={doc} slot={slots[i % slots.length].map((v, k) => v + (i >= slots.length ? (k ? 0.05 : 0.06) : 0)) as [number, number]} top={top + (i >= slots.length ? 0.003 : 0)} bounds={bounds} facing={facing} onInspect={onInspect} onHover={onHover} />
      ))}
    </>
  );
}
