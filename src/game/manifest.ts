/**
 * Room manifest: `dxm-centre-01` (synthetic DXM branch, not a copy of a real one).
 *
 * World units are metres, Y is up. The lobby is X∈[-7,7] × Z∈[0,10]; the
 * consultation room ("3-xona") is X∈[1,7] × Z∈[-6,0]. Everything the
 * renderer, the physics world and the interaction system need is data here,
 * so a new room is a new manifest — not new engine code.
 */
export type Vec3 = [number, number, number];
export type Surface = 'plaster' | 'terrazzo' | 'laminate' | 'ceiling' | 'trim';

export interface Box {
  c: Vec3;
  s: Vec3;
  surface: Surface;
}

export const H = 3; // ceiling height
const T = 0.2; // wall thickness

const wallX = (z: number, x0: number, x1: number, y0 = 0, y1 = H): Box => ({
  c: [(x0 + x1) / 2, (y0 + y1) / 2, z],
  s: [x1 - x0, y1 - y0, T],
  surface: 'plaster',
});
const wallZ = (x: number, z0: number, z1: number, y0 = 0, y1 = H): Box => ({
  c: [x, (y0 + y1) / 2, (z0 + z1) / 2],
  s: [T, y1 - y0, z1 - z0],
  surface: 'plaster',
});

export interface WindowDef {
  /** Centre of the opening on the east wall (x = 7). */
  z0: number;
  z1: number;
  sill: number;
  head: number;
}
export const WINDOWS: WindowDef[] = [
  { z0: -4.6, z1: -1.6, sill: 0.9, head: 2.6 },
  { z0: 2.0, z1: 4.6, sill: 0.9, head: 2.6 },
  { z0: 5.6, z1: 8.2, sill: 0.9, head: 2.6 },
];

export const ENTRANCE = { x0: -1.1, x1: 1.1, head: 2.4, z: 10 };
export const ROOM_DOOR = { x0: 2.4, x1: 3.5, head: 2.1, z: 0 };

const eastWall: Box[] = [
  wallZ(7.1, -6, WINDOWS[0].z0),
  wallZ(7.1, WINDOWS[0].z1, WINDOWS[1].z0),
  wallZ(7.1, WINDOWS[1].z1, WINDOWS[2].z0),
  wallZ(7.1, WINDOWS[2].z1, 10),
  ...WINDOWS.flatMap((w) => [wallZ(7.1, w.z0, w.z1, 0, w.sill), wallZ(7.1, w.z0, w.z1, w.head, H)]),
];

export const STRUCTURE: Box[] = [
  // floors & ceilings
  { c: [0, -0.05, 5], s: [14.4, 0.1, 10.4], surface: 'terrazzo' },
  // the room's floor and ceiling overlap the hall's at the doorway: 2 mm apart, never in one plane
  { c: [4, -0.052, -3], s: [6.4, 0.1, 6.2], surface: 'laminate' },
  { c: [0, H + 0.05, 5], s: [14.4, 0.1, 10.4], surface: 'ceiling' },
  { c: [4, H + 0.052, -3], s: [6.4, 0.1, 6.2], surface: 'ceiling' },
  // south (entrance) wall
  wallX(10.1, -7.2, ENTRANCE.x0),
  wallX(10.1, ENTRANCE.x1, 7.2),
  wallX(10.1, ENTRANCE.x0, ENTRANCE.x1, ENTRANCE.head, H),
  // west wall, lobby
  wallZ(-7.1, 0, 10),
  // partition lobby ↔ back rooms
  wallX(0, -7.2, ROOM_DOOR.x0),
  wallX(0, ROOM_DOOR.x1, 7.2),
  wallX(0, ROOM_DOOR.x0, ROOM_DOOR.x1, ROOM_DOOR.head, H),
  // consultation room
  wallZ(0.9, -6, -0.1),
  wallX(-6.1, 0.8, 7.2),
  ...eastWall,
];

/** Skirting boards: [x0, z0, x1, z1] along the visible wall faces. */
export const SKIRTING: [number, number, number, number][] = [
  [-7, 0.1, -7, 10],
  [-7, 10, ENTRANCE.x0, 10],
  [ENTRANCE.x1, 10, 7, 10],
  [-7, 0.1, ROOM_DOOR.x0, 0.1],
  [ROOM_DOOR.x1, 0.1, 7, 0.1],
  [7, 0.1, 7, 10],
  [1, -6, 1, -0.1],
  [1, -6, 7, -6],
  [7, -6, 7, -0.1],
  [1, -0.1, ROOM_DOOR.x0, -0.1],
  [ROOM_DOOR.x1, -0.1, 7, -0.1],
];

/** Static physics: simplified cuboids only (never the render meshes). */
export const COLLIDERS: { c: Vec3; half: Vec3 }[] = [
  { c: [0, -0.5, 2], half: [8, 0.5, 9] }, // floor
  { c: [0, 1.5, 10.1], half: [7.2, 1.5, 0.1] }, // south incl. glass doors
  { c: [-7.1, 1.5, 5], half: [0.1, 1.5, 5.1] },
  { c: [7.1, 1.5, 2], half: [0.1, 1.5, 8.1] }, // east incl. windows
  { c: [(-7.2 + ROOM_DOOR.x0) / 2, 1.5, 0], half: [(ROOM_DOOR.x0 + 7.2) / 2, 1.5, 0.1] },
  { c: [(ROOM_DOOR.x1 + 7.2) / 2, 1.5, 0], half: [(7.2 - ROOM_DOOR.x1) / 2, 1.5, 0.1] },
  { c: [0.9, 1.5, -3], half: [0.1, 1.5, 3] },
  { c: [4, 1.5, -6.1], half: [3.2, 1.5, 0.1] },
  // furniture
  { c: [4.4, 0.4, -3.4], half: [0.92, 0.4, 0.42] }, // desk
  { c: [4.4, 0.6, -2.4], half: [0.38, 0.6, 0.4] }, // visitor chair + citizen
  { c: [4.4, 0.45, -4.5], half: [0.36, 0.45, 0.3] }, // staff chair
  { c: [2.2, 0.95, -5.72], half: [0.58, 0.95, 0.26] }, // cabinet
  { c: [6.0, 1.05, -5.85], half: [0.52, 1.05, 0.14] }, // shelf
  { c: [-4.4, 0.55, 1.5], half: [1.5, 0.55, 0.4] }, // reception counter
  { c: [-6.45, 0.45, 4.4], half: [0.48, 0.45, 1.4] }, // sofa
  { c: [-6.45, 0.45, 7.7], half: [0.48, 0.45, 1.4] }, // sofa
  { c: [-5.0, 0.2, 6.05], half: [0.32, 0.2, 0.62] }, // coffee table
  { c: [6.42, 0.5, 3.3], half: [0.3, 0.5, 1.3] }, // waiting chairs
  { c: [6.42, 0.5, 6.9], half: [0.3, 0.5, 1.3] },
  { c: [2.1, 0.7, 8.6], half: [0.28, 0.7, 0.24] }, // queue kiosk
  { c: [-2.35, 0.6, 0.62], half: [0.2, 0.6, 0.2] }, // flag stand
  { c: [-6.4, 0.5, 9.3], half: [0.35, 0.5, 0.35] }, // plants
  { c: [6.3, 0.5, 9.35], half: [0.35, 0.5, 0.35] },
  { c: [6.35, 0.5, -5.3], half: [0.35, 0.5, 0.35] },
];

export const SPAWN = { position: [0, 0, 8.4] as Vec3, yaw: 0 };

/** Where the camera rests when the player sits at their desk. */
export const SEAT = { eye: [4.4, 1.2, -4.62] as Vec3, yaw: Math.PI, pitch: -0.04 };
export const NPC_SEAT = { position: [4.4, 0, -2.36] as Vec3, rotation: Math.PI, head: [4.4, 1.22, -2.42] as Vec3 };
export const MONITOR = { position: [3.66, 0.76, -3.42] as Vec3, rotation: Math.PI + 0.5 };
export const DESK = { position: [4.4, 0, -3.4] as Vec3, top: 0.76 };

/** Somewhere the player may sit down and look around freely. */
export interface RestSeat {
  id: string;
  eye: Vec3;
  /** Camera yaw when facing straight ahead from the seat. */
  yaw: number;
}

const chair = (z: number): RestSeat => ({ id: `chair-${z}`, eye: [6.28, 1.17, z], yaw: Math.PI / 2 });
const sofa = (z: number): RestSeat => ({ id: `sofa-${z}`, eye: [-6.22, 1.08, z], yaw: -Math.PI / 2 });
/** Every free seat in the lobby (two waiting chairs are taken by other citizens). */
export const REST_SEATS: RestSeat[] = [
  ...[2.25, 3.65, 4.35, 5.85, 6.55, 7.95].map(chair),
  ...[3.7, 5.1, 7.0, 8.4].map(sofa),
];

export interface Interactable {
  id: string;
  point: Vec3;
  radius: number;
  prompt: string;
  seat?: RestSeat;
  /** Picking this up opens the in-hand inspection view. */
  item?: 'stamp' | 'code-book' | 'case-folder' | 'queue-ticket';
}
export const INTERACTABLES: Interactable[] = [
  { id: 'room-door', point: [2.95, 1.15, 0], radius: 2.1, prompt: 'Eshikni ochish' },
  { id: 'staff-seat', point: [4.4, 1.0, -4.45], radius: 2.4, prompt: 'Oʻtirib, qabulni boshlash' },
  { id: 'terminal', point: [3.66, 1.0, -3.42], radius: 1.9, prompt: 'Terminaldan foydalanish' },
];

/** Where the handleable objects lie in the world (also used to place their meshes). */
export const ITEM_SPOTS = {
  stamp: [4.82, DESK.top, -3.74] as Vec3,
  'code-book': [5.02, DESK.top, -3.42] as Vec3,
  'case-folder': [4.42, DESK.top, -3.66] as Vec3,
  'queue-ticket': [2.1, 0.86, 8.5] as Vec3,
};
INTERACTABLES.push(
  { id: 'item-stamp', item: 'stamp', point: [ITEM_SPOTS.stamp[0], 0.82, ITEM_SPOTS.stamp[2]], radius: 1.5, prompt: 'Muhrni qoʻlga olish' },
  { id: 'item-book', item: 'code-book', point: [ITEM_SPOTS['code-book'][0], 0.8, ITEM_SPOTS['code-book'][2]], radius: 1.5, prompt: 'Toʻplamni qoʻlga olish' },
  { id: 'item-folder', item: 'case-folder', point: [ITEM_SPOTS['case-folder'][0], 0.78, ITEM_SPOTS['case-folder'][2]], radius: 1.5, prompt: 'Jildni qoʻlga olish' },
  { id: 'item-ticket', item: 'queue-ticket', point: [2.1, 1.05, 8.5], radius: 1.6, prompt: 'Navbat chiptasini olish' },
);
INTERACTABLES.push(
  ...REST_SEATS.map((seat): Interactable => ({
    id: seat.id,
    point: [seat.eye[0] + (seat.eye[0] > 0 ? 0.14 : -0.2), 0.62, seat.eye[2]],
    radius: 1.7,
    prompt: 'Oʻtirish',
    seat,
  })),
);

export const CEILING_LIGHTS: Vec3[] = [
  [-3.5, H, 2.6], [0, H, 2.6], [3.5, H, 2.6],
  [-3.5, H, 6.6], [0, H, 6.6], [3.5, H, 6.6],
  [2.6, H, -3.2], [5.2, H, -3.2],
];
