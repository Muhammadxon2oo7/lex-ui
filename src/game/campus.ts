/**
 * Layout of the LexSim practice centre (synthetic building).
 * Metres, Y up. The facade is at z = 0, the plaza lies at z > 0, the foyer
 * spans z ∈ [-9, 0] and the corridor runs from z = -9 to z = -43.
 */
export type Vec3 = [number, number, number];

export const FACADE = { width: 36, height: 9.6, depth: 46 };
export const FOYER = { x0: -7, x1: 7, z0: -9, z1: 0, height: 4.4 };
export const CORRIDOR = { x0: -2.3, x1: 2.3, z0: -43, z1: -9, height: 3.3 };
export const ENTRANCE = { x0: -1.6, x1: 1.6, height: 2.7 };
export const GLASS = { x0: -7, x1: 7, height: 4.4 };

export type DoorAction = 'case' | 'dxm' | 'court' | 'tools' | 'library';
import type { StageId } from '@/contracts/case';
export type CaseStage = StageId;

export interface DoorDef {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  /** -1 = left wall (x0), +1 = right wall (x1), 0 = end wall. */
  side: -1 | 0 | 1;
  /** Centre of the opening along the corridor. */
  z: number;
  action: DoorAction | null;
  /** For 'case' doors: the stage of "Ish yoʻli" behind this door. */
  stage?: CaseStage;
  /** Shown on the orientation terminal. */
  role: string;
  basis: string;
  minutes: string;
}

/**
 * The corridor: doors 1-5 are the stages of the labour dispute (FPK, in
 * procedural order), door 6 the law library, doors 7-9 the stages of the
 * theft report (JPK).
 */
export const DOORS: DoorDef[] = [
  { id: 'r1', number: '1', title: 'Advokatlik byurosi', subtitle: 'Mijoz bilan maslahat', side: -1, z: -13, action: 'case', stage: 'consult', role: 'Advokat', basis: 'Holatlar va dalillarni aniqlash, vakolat (FPK 65, 67, 68)', minutes: '5-8' },
  { id: 'r2', number: '2', title: 'Hujjatlar', subtitle: 'Daʼvo arizasini tuzish', side: 1, z: -13, action: 'case', stage: 'draft', role: 'Advokat', basis: 'Ariza mazmuni va ilovalar (FPK 188-191)', minutes: '5-8' },
  { id: 'r3', number: '3', title: 'Sud devonxonasi', subtitle: 'Arizani topshirish · ajrim', side: -1, z: -20.5, action: 'case', stage: 'filing', role: 'Advokat', basis: 'Qabul qilish yoki qaytarish (FPK 192, 193, 195)', minutes: '3-5' },
  { id: 'r4', number: '4', title: 'Sudya kabineti', subtitle: 'Ishni sud muhokamasiga tayyorlash', side: 1, z: -20.5, action: 'case', stage: 'chamber', role: 'Daʼvogar vakili', basis: 'Taraflarni soʻroq qilish, dalillar, kelishuv (FPK 203-205)', minutes: '4-6' },
  { id: 'r5', number: '5', title: 'Sud majlisi zali', subtitle: 'Ishni koʻrish · hal qiluv qarori', side: -1, z: -28, action: 'case', stage: 'hearing', role: 'Daʼvogar vakili', basis: 'Majlis tartibi, «Hurmatli sud!», tik turib (FPK 210-248)', minutes: '8-12' },
  { id: 'r6', number: '6', title: 'Huquqiy kutubxona', subtitle: 'Protsess xaritasi · kodekslar', side: 1, z: -28, action: 'library', role: 'Oʻrganish', basis: 'Ariza berishdan qarorgacha - moddalar lex.uz saytidan', minutes: '-' },
  { id: 'r7', number: '7', title: 'IIB navbatchi qismi', subtitle: 'Ish 2 · jinoyat toʻgʻrisida ariza', side: -1, z: -35.5, action: 'case', stage: 'report', role: 'Jabrlanuvchi vakili', basis: 'Arizani qabul qilish (JPK 323, 324, 329)', minutes: '3-5' },
  { id: 'r8', number: '8', title: 'Tergovchi kabineti', subtitle: 'Ish 2 · jabrlanuvchini soʻroq qilish', side: 1, z: -35.5, action: 'case', stage: 'interview', role: 'Jabrlanuvchi vakili', basis: 'Huquqlar, soʻroq, bayonnoma (JPK 55, 64, 100, 106, 114)', minutes: '3-5' },
  { id: 'r9', number: '9', title: 'Tergov boʻlinmasi boshligʻi', subtitle: 'Ish 2 · tergovchi ustidan shikoyat', side: 0, z: -43, action: 'case', stage: 'complaint', role: 'Jabrlanuvchi vakili', basis: 'Shikoyat berish (JPK 358)', minutes: '2-4' },
];

/** Door of each stage, so leaving a room puts you in front of the next one. */
export const STAGE_DOOR: Record<CaseStage, string> = { consult: 'r1', draft: 'r2', filing: 'r3', chamber: 'r4', hearing: 'r5', report: 'r7', interview: 'r8', complaint: 'r9', trial: 'r5' };

export const DOOR_WIDTH = 1.05;
export const DOOR_HEIGHT = 2.15;

/** Point in the corridor, in front of a door, where the student stands to use it. */
export function doorApproach(door: DoorDef): { position: Vec3; yaw: number } {
  if (door.side === 0) return { position: [0, 0, door.z + 1.4], yaw: Math.PI };
  const x = door.side * (CORRIDOR.x1 - 1.05);
  // yaw convention: 0 faces +Z
  return { position: [x, 0, door.z], yaw: door.side === -1 ? -Math.PI / 2 : Math.PI / 2 };
}

/** The orientation terminal in the foyer: everyone arrives in front of it. */
export const KIOSK = { position: [-2.4, 0, -4.6] as Vec3, screen: [-2.4, 1.38, -4.5] as Vec3, radius: 1.7 };
export const SPAWN = { position: [-2.4, 0, -3.45] as Vec3, yaw: Math.PI };
export const INFO_BOARD = { position: [-5.5, 1.5, -2.2] as Vec3, radius: 2.2 };
