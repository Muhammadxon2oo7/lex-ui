'use client';
/**
 * The rooms of "Ish yoʻli", one per stage of the case. Each is a small,
 * synthetic but physically lit interior seen from the student's own seat
 * (or, at the court office window, standing). People are the rigged
 * Rocketbox avatars with mocap sitting, rising and talking.
 */
import { Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CaseLine, CaseSnapshot, CaseSpeaker, StageId } from '@/contracts/case';
import { gestureFor } from './gestures';
import { drawPaper, type PaperModel } from './paper';
import { DESK_SLOTS, type DeskDoc } from './documents';
import { DeskItems } from './DeskItems';
import type { Emotion } from '@/contracts';

/** The speaker's feeling while their line is spoken, otherwise their resting mood. */
const moodOf = (p: SceneProps, who: CaseSpeaker, fallback: Emotion): Emotion => (p.line?.speaker === who && p.line.emotion ? p.line.emotion : fallback);
import { Character, preloadCast } from '@/components/world/Character';

// everyone who can appear in a case room, fetched before they are needed
preloadCast(['client', 'clerk', 'man', 'woman', 'elder_man', 'secretary', 'lawyer', 'worker', 'investigator', 'chief']);
import CourtRoom, { useMahogany } from '@/components/world/CourtRoom';
import { Prop } from '@/components/world/Furniture';
import { UI_FONT, canvasTexture, useMaterials, type Materials } from '@/components/world/materials';
import { Flag, StateEmblem } from '@/components/world/SetDressing';
import { QualityGovernor, againstWall, DevProbe, Bookcase, Box, Desk, FitFov, Folder, FrameForPanel, Monitor, Ornament, Papers, RoomFx, SeatCamera, Shell, TrayCeiling, WallSign, Window, type V3 } from './stagecraft';

export interface SceneProps {
  /** Papers on the desk you can pick up, move and take in your hands. */
  docs?: DeskDoc[];
  onInspect?: (doc: DeskDoc) => void;
  onHover?: (name: string | null) => void;
  /** The student's own body (profile): seen when looking down. */
  avatar?: 'man' | 'woman';
  /** The claim being drafted, printed on the sheet on the desk. */
  paper?: PaperModel | null;
  /** The line being spoken (drives the speaker's gesture). */
  line?: CaseLine;
  stage: StageId;
  speaker: CaseSpeaker | null;
  scene: CaseSnapshot['scene'];
  standing: boolean;
  /** Small state cues the rooms show physically. */
  cues: { papers: number; handed: boolean; signed: boolean };
}

function Lights({ sun = [4, 6, -2] as V3 }) {
  return (
    <>
      <Environment files="/assets/env/small_empty_room_1_1k.hdr" environmentIntensity={0.55} />
      <hemisphereLight intensity={0.28} color="#ffffff" groundColor="#b6a58f" />
      <directionalLight position={sun} intensity={1.1} color="#fff0dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0004} shadow-normalBias={0.03} />
    </>
  );
}

/**
 * You, from inside: your own body sits (or stands) where the camera is, its
 * head not drawn — look down and there are your knees, your hands, your shoes.
 */
function Me({ avatar = 'man', at, rotation = 0, standing = false, chair = true }: { avatar?: 'man' | 'woman'; at: V3; rotation?: number; standing?: boolean; chair?: boolean }) {
  return (
    <>
      {chair && !standing && <Prop model="dining_chair_02" position={[at[0], 0, at[2] - Math.cos(rotation) * 0.02]} rotation={rotation} />}
      <Character model={avatar} position={at} rotation={rotation} seatTop={0.46} seed={13} mood="calm" restless={false} firstPerson
        standing={standing} enterPath={standing ? [[at[0] + Math.sin(rotation) * 0.38, at[2] + Math.cos(rotation) * 0.38], [at[0] + Math.sin(rotation) * 0.42, at[2] + Math.cos(rotation) * 0.42]] : undefined} />
    </>
  );
}

/* ───────────────────────── 1 · Advokatlik byurosi ───────────────────────── */

const OFFICE_EYE: V3 = [0, 1.22, -1.75];
const CLIENT_OFFICE: { position: V3; head: V3 } = { position: [0, 0, 0.3], head: [0, 1.2, 0.22] };

function Office({ m, p }: { m: Materials; p: SceneProps }) {
  const talking = p.speaker === 'client';
  return (
    <>
      <SeatCamera seated={OFFICE_EYE} base={Math.PI} focus={talking ? CLIENT_OFFICE.head : null} limit={1.05} />
      <Lights sun={[-5, 5, 0.5]} />
      <Shell m={m} w={5.6} d={5.4} h={3} zc={0.3} lights={[[0, 7, -0.6], [0, 6, 1.6]]} />
      <Window m={m} position={[-2.68, 1.55, 0.2]} rotation={Math.PI / 2} size={[1.8, 1.5]} />
      <Window m={m} position={[-2.68, 1.55, 2.0]} rotation={Math.PI / 2} size={[1.0, 1.5]} />
      <WallSign position={[0.6, 2.35, 2.88]} rotation={Math.PI} size={[1.9, 0.5]} title="ADVOKATLIK BYUROSI" subtitle="Mehnat nizolari · oʻquv kabineti" dark />
      <Ornament width={5.2} position={[0, 2.82, 2.885]} rotation={Math.PI} />
      {/* diplomas */}
      {[['DIPLOM', 'Yuridik fakultet'], ['LITSENZIYA', 'Advokatlik faoliyati']].map(([t, sub], i) => (
        <group key={t} position={[0.75 + i * 0.6, 1.72, 2.88]} rotation={[0, Math.PI, 0]}>
          <mesh material={m.walnut}><boxGeometry args={[0.44, 0.34, 0.02]} /></mesh>
          <WallSign position={[0, 0, 0.022]} size={[0.38, 0.28]} title={t} subtitle={sub} />
        </group>
      ))}
      <Bookcase m={m} position={[-1.55, 0, againstWall(2.9)]} rotation={Math.PI} width={1.1} seed={3} />
      <Bookcase m={m} position={[-0.45, 0, againstWall(2.9)]} rotation={Math.PI} width={1.1} seed={4} />
      <Prop model="potted_plant_04" position={[2.25, 0, 2.45]} />
      {/* walnut sideboard with files and a plant on the right wall */}
      <Box m={m.walnut} size={[0.45, 0.8, 1.6]} position={[2.55, 0.4, 0.6]} tile={1.3} />
      <Box m={m.oak} size={[0.48, 0.03, 1.64]} position={[2.55, 0.815, 0.6]} tile={1.3} />
      <Folder position={[2.5, 0.84, 0.15]} rotation={0.1} color="#7a2f2f" />
      <Folder position={[2.52, 0.862, 0.18]} rotation={-0.05} />
      <Prop model="potted_plant_02" position={[2.55, 0.83, 1.2]} scale={0.38} />
      <Prop model="wall_clock" position={[2.69, 2.45, 0.6]} rotation={-Math.PI / 2} />

      <Desk m={m} position={[0, 0, -0.8]} size={[1.7, 0.85]} panel="far" />
      <Prop model="desk_lamp_arm_01" position={[0.72, 0.76, -0.45]} rotation={Math.PI - 0.5} scale={0.5} />
      <Prop model="binder_notebook" position={[-0.62, 0.76, -0.6]} rotation={0.3} />
      <Prop model="dining_chair_02" position={[CLIENT_OFFICE.position[0], 0, CLIENT_OFFICE.position[2] + 0.02]} rotation={Math.PI} />
      <Me avatar={p.avatar} at={[OFFICE_EYE[0], 0, OFFICE_EYE[2] - 0.15]} />
      <Character model="client" restless={false} position={CLIENT_OFFICE.position} rotation={Math.PI} seatTop={0.46} seed={2} mood={moodOf(p, 'client', p.scene.clientMood)} talking={talking} lookAt={OFFICE_EYE} cue={p.line?.speaker === 'client' ? gestureFor(p.line) : null} />
    </>
  );
}

/* ───────────────────────── 2 · Hujjatlar xonasi ───────────────────────── */

const DRAFT_EYE: V3 = [0, 1.14, -0.5];

const PAPER_AT: V3 = [0.02, 0.763, -0.08];

/** The claim on an A4 sheet on the desk, redrawn as it is written. */
function ClaimSheet({ paper }: { paper: PaperModel | null | undefined }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1240;
    c.height = 1754;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    const ctx = canvas.getContext('2d')!;
    const blank = { header: [], title: 'DAʼVO ARIZASI', subtitle: '', body: [], demandLead: 'SOʻRAYMAN:', demand: { text: '', empty: true }, attachments: [], date: '', signer: '', signature: null };
    const draw = (img: HTMLImageElement | null) => {
      drawPaper(ctx, canvas.width, canvas.height, paper ?? blank, img);
      texture.needsUpdate = true;
    };
    if (paper?.signature) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = paper.signature;
      draw(null);
    } else draw(null);
  }, [paper, canvas, texture]);
  return (
    <group position={PAPER_AT} rotation={[-Math.PI / 2, 0, Math.PI + 0.04]}>
      <mesh receiveShadow>
        <planeGeometry args={[0.21, 0.297]} />
        <meshStandardMaterial map={texture} roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  );
}

function DraftRoom({ m, paper, avatar }: { m: Materials; paper?: PaperModel | null; avatar?: 'man' | 'woman' }) {
  const screen = useMemo(
    () =>
      canvasTexture(1024, 600, (ctx, w, h) => {
        ctx.fillStyle = '#fbfaf7';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, w, 64);
        ctx.font = `700 28px ${UI_FONT}`;
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText('Daʼvo arizasi — loyiha', 28, 32);
        ctx.fillStyle = '#d9dde4';
        for (let i = 0; i < 9; i++) ctx.fillRect(60, 110 + i * 48, 520 + ((i * 131) % 330), 14);
      }),
    [],
  );
  useEffect(() => () => screen.dispose(), [screen]);
  return (
    <>
      <SeatCamera seated={DRAFT_EYE} base={Math.PI} focus={PAPER_AT} limit={1.5} />
      <Me avatar={avatar} at={[DRAFT_EYE[0], 0, DRAFT_EYE[2] - 0.16]} />
      <ClaimSheet paper={paper} />
      <Lights sun={[3, 5, -3]} />
      <Shell m={m} w={4.6} d={4.2} h={2.9} zc={0.7} lights={[[0, 6, 0.4]]} />
      <Window m={m} position={[2.18, 1.5, 0.7]} rotation={-Math.PI / 2} size={[1.4, 1.4]} />
      <Desk m={m} position={[0, 0, 0.12]} size={[1.6, 0.75]} />
      <Monitor m={m} position={[-0.35, 0.76, 0.36]} rotation={Math.PI + 0.35} screen={screen} />

      {/* printer */}
      <Box m={m.darkPlastic} size={[0.42, 0.22, 0.36]} position={[1.25, 0.86, 0.2]} />
      <Box m={m.whiteLaminate} size={[0.6, 0.75, 0.45]} position={[1.25, 0.375, 0.2]} />
      <Bookcase m={m} position={[-1.4, 0, againstWall(2.7)]} rotation={Math.PI} width={1.2} seed={5} />
      <WallSign position={[0.6, 2.25, 2.78]} rotation={Math.PI} size={[1.5, 0.4]} title="HUJJATLAR XONASI" subtitle="Ariza va ilovalar" />
      <Prop model="desk_lamp_arm_01" position={[0.66, 0.76, 0.4]} rotation={-2.4} scale={0.5} />
      <Prop model="potted_plant_02" position={[1.9, 0, 2.4]} />
    </>
  );
}

/* ───────────────────────── 3 · Sud devonxonasi ───────────────────────── */

const WINDOW_EYE: V3 = [0, 1.62, -0.35];
const CLERK: { position: V3; head: V3 } = { position: [0, 0, 1.75], head: [0, 1.2, 1.65] };

function HandedFolder({ handed }: { handed: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current = THREE.MathUtils.damp(t.current, handed ? 1 : 0, 3.5, dt);
    if (ref.current) ref.current.position.set(0.05, 1.105 + Math.sin(t.current * Math.PI) * 0.02, 0.45 + t.current * 0.62);
  });
  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={[0.25, 0.025, 0.32]} />
      <meshStandardMaterial color="#2f5d8a" roughness={0.7} />
    </mesh>
  );
}

/** Who sits behind the counter, and what the room is called. */
interface Counter {
  role: 'clerk' | 'officer';
  model: 'clerk' | 'man';
  window: string;
  board: [string, string];
  /** The person you came with stands beside you at the window. */
  companion?: boolean;
}
const COURT_OFFICE: Counter = { role: 'clerk', model: 'clerk', window: '1-DARCHA · ARIZALARNI QABUL QILISH', board: ['Fuqarolik ishlari boʻyicha', 'Namuna tumanlararo sudi · oʻquv'] };
const DUTY_DESK: Counter = { role: 'officer', model: 'man', window: 'NAVBATCHI · ARIZALAR VA XABARLARNI QABUL QILISH', board: ['Namuna tumani', 'ichki ishlar boʻlimi · oʻquv'], companion: true };
/** Nodira walks up from the door and stands at the counter beside you. */
const COMPANION: { position: V3; route: [number, number][]; head: V3 } = { position: [1.05, 0, -0.95], route: [[2.3, -2.2], [1.5, -1.7]], head: [1.05, 1.55, -0.52] };

function Registry({ m, p, desk = COURT_OFFICE }: { m: Materials; p: SceneProps; desk?: Counter }) {
  const wood = useMahogany(m);
  const talking = p.speaker === desk.role;
  const queue = useMemo(
    () =>
      canvasTexture(640, 360, (ctx, w, h) => {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#7fb3ff';
        ctx.font = `600 34px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('NAVBAT', w / 2, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 120px ${UI_FONT}`;
        ctx.fillText('A-112', w / 2, 200);
        ctx.fillStyle = '#3ddc97';
        ctx.font = `600 36px ${UI_FONT}`;
        ctx.fillText('→ 1-darcha', w / 2, 290);
      }),
    [],
  );
  useEffect(() => () => queue.dispose(), [queue]);
  return (
    <>
      <SeatCamera seated={WINDOW_EYE} limit={1.1} base={Math.PI} focus={talking ? CLERK.head : desk.companion && p.speaker === 'client' ? COMPANION.head : null} />
      <Lights sun={[3, 6, -2]} />
      <Shell m={m} w={6.4} d={6} h={3.1} zc={0.8} floor="terrazzo" lights={[[0, 7, 0.2], [0, 6, 2.4], [0, 5, -1.4]]} />
      {/* counter + glass partition with a hand slot */}
      <Box m={wood} size={[4.4, 1.05, 0.12]} position={[0, 0.525, 0.55]} tile={1.3} />
      <Box m={m.oak} size={[4.5, 0.05, 0.42]} position={[0, 1.08, 0.58]} tile={1.3} />
      <mesh material={m.glass} position={[0, 1.78, 0.62]}>
        <boxGeometry args={[4.4, 1.3, 0.012]} />
      </mesh>
      <Box m={m.metal} size={[4.4, 0.04, 0.05]} position={[0, 2.45, 0.62]} />
      {/* posts a hair thinner than the rail, so their faces never share its plane */}
      {[-2.2, -0.75, 0.75, 2.2].map((x) => <Box key={x} m={m.metal} size={[0.035, 1.34, 0.044]} position={[x, 1.78, 0.62]} />)}
      <WallSign position={[0, 2.62, 0.65]} rotation={Math.PI} size={[1.6, 0.26]} title={desk.window} dark />
      <WallSign position={[0, 2.62, 0.635]} size={[1.6, 0.26]} title="1-DARCHA" dark />
      {desk.role === 'clerk' && <HandedFolder handed={p.cues.handed} />}

      {/* clerk side */}
      <Desk m={m} position={[0, 0, 1.2]} size={[1.8, 0.75]} panel="near" />
      <Monitor m={m} position={[0.82, 0.76, 1.3]} rotation={-0.5} />
      <Papers m={m} position={[-0.5, 0.762, 1.15]} count={5} rotation={0.15} />
      <Folder position={[-0.18, 0.775, 1.05]} rotation={0.1} color="#7a2f2f" />
      <Prop model="dining_chair_02" position={[CLERK.position[0], 0, CLERK.position[2] + 0.02]} rotation={Math.PI} />
      <Me avatar={p.avatar} at={[WINDOW_EYE[0], 0, WINDOW_EYE[2] - 0.58]} standing />
      <Character model={desk.model} restless={false} position={CLERK.position} rotation={Math.PI} seatTop={0.46} seed={7} mood={moodOf(p, desk.role, 'calm')} talking={talking} lookAt={desk.companion && p.speaker === 'client' ? COMPANION.head : WINDOW_EYE} cue={p.line?.speaker === desk.role ? gestureFor(p.line) : null} />
      {desk.companion && (
        <Suspense fallback={null}><Character model="woman" restless={false} position={COMPANION.position} rotation={0} seatTop={0.46} seed={9} mood={moodOf(p, 'client', 'upset')} talking={p.speaker === 'client'}
          lookAt={p.speaker === desk.role ? CLERK.head : WINDOW_EYE} standing enterPath={COMPANION.route} cue={p.line?.speaker === 'client' ? gestureFor(p.line) : null} /></Suspense>
      )}
      {[-1.9, -0.65, 0.6, 1.85].map((x, i) => <Bookcase key={x} m={m} position={[x, 0, againstWall(3.7)]} rotation={Math.PI} width={1.2} seed={10 + i} />)}
      <Flag m={m} position={[2.75, 0, 2.7]} rotation={Math.PI} />
      <TrayCeiling m={m} w={6.4} d={6} h={3.1} zc={0.8} panels={[]} />

      {/* public side */}
      <mesh position={[-3.08, 2.0, -0.6]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 0.5]} />
        <meshBasicMaterial map={queue} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <WallSign position={[3.08, 1.7, -0.9]} rotation={-Math.PI / 2} size={[1.1, 0.7]} title={desk.board[0]} subtitle={desk.board[1]} />
      <Prop model="potted_plant_02" position={[-2.7, 0, -1.6]} />
    </>
  );
}

/* ───────────────────────── 4 · Sudya kabineti ───────────────────────── */

const CHAMBER_EYE: V3 = [-0.45, 1.2, -0.42];
const JUDGE_DESK: { position: V3; head: V3 } = { position: [0, 0, 1.7], head: [0, 1.22, 1.6] };
const CLIENT_CHAMBER: { position: V3; head: V3 } = { position: [0.62, 0, -0.18], head: [0.62, 1.2, -0.1] };

/** Whose office: the judge's, the investigator's or the head of the unit's. */
interface Office {
  role: 'judge' | 'investigator' | 'chief';
  model: 'elder_man' | 'investigator' | 'chief';
  plate: string;
  sign: [string, string];
  visitor: 'client' | 'woman';
  flag: boolean;
}
const JUDGE_OFFICE: Office = { role: 'judge', model: 'elder_man', plate: 'Sudya B. Islomov', sign: ['SUDYA KABINETI', 'Fuqarolik ishlari boʻyicha Namuna tumanlararo sudi'], visitor: 'client', flag: true };
const INVESTIGATOR_OFFICE: Office = { role: 'investigator', model: 'investigator', plate: 'Tergovchi U. Rahimov', sign: ['TERGOVCHI KABINETI', 'Namuna tumani IIB tergov boʻlimi'], visitor: 'woman', flag: false };
const CHIEF_OFFICE: Office = { role: 'chief', model: 'chief', plate: 'Boʻlinma boshligʻi', sign: ['TERGOV BOʻLINMASI BOSHLIGʻI', 'Qabul xonasi · oʻquv'], visitor: 'woman', flag: true };

function Chamber({ m, p, office = JUDGE_OFFICE }: { m: Materials; p: SceneProps; office?: Office }) {
  const wood = useMahogany(m);
  const focus = p.speaker === office.role ? JUDGE_DESK.head : p.speaker === 'client' ? CLIENT_CHAMBER.head : null;
  return (
    <>
      <SeatCamera seated={CHAMBER_EYE} base={Math.PI} focus={focus} limit={1.05} />
      <Lights sun={[-4, 6, 1]} />
      <Shell m={m} w={5.6} d={5.4} h={3.1} zc={1.0} lights={[[0, 7, 0.2], [0, 6, 2.4]]} />
      <Window m={m} position={[-2.68, 1.6, 1.4]} rotation={Math.PI / 2} size={[1.6, 1.6]} />
      {/* the judge's desk */}
      <Box m={wood} size={[2.1, 0.05, 0.95]} position={[0, 0.76, 1.05]} tile={1.3} />
      <Box m={wood} size={[2.0, 0.72, 0.04]} position={[0, 0.37, 0.6]} tile={1.3} />
      <Box m={wood} size={[0.04, 0.72, 0.9]} position={[-1.0, 0.37, 1.05]} tile={1.3} />
      <Box m={wood} size={[0.04, 0.72, 0.9]} position={[1.0, 0.37, 1.05]} tile={1.3} />
      <Papers m={m} position={[-0.15, 0.786, 0.95]} count={3} rotation={0.05} />
      <Folder position={[0.45, 0.8, 1.0]} rotation={-0.1} color="#7a2f2f" />
      <Prop model="desk_lamp_arm_01" position={[-0.78, 0.785, 1.3]} rotation={0.5} scale={0.5} />
      <WallSign position={[0, 0.66, 0.565]} rotation={Math.PI} size={[0.5, 0.11]} title={office.plate} />
      <Prop model="dining_chair_02" position={[JUDGE_DESK.position[0], 0, JUDGE_DESK.position[2] + 0.02]} rotation={Math.PI} />
      <Me avatar={p.avatar} at={[CHAMBER_EYE[0], 0, CHAMBER_EYE[2] - 0.15]} />
      <Character model={office.model} restless={false} position={JUDGE_DESK.position} rotation={Math.PI} seatTop={0.46} seed={11} mood={moodOf(p, office.role, 'calm')} talking={p.speaker === office.role} lookAt={p.speaker === 'client' ? CLIENT_CHAMBER.head : CHAMBER_EYE} cue={p.line?.speaker === office.role ? gestureFor(p.line) : null} />

      {/* the visitors' chairs */}
      <Prop model="dining_chair_02" position={[CLIENT_CHAMBER.position[0], 0, CLIENT_CHAMBER.position[2] - 0.02]} rotation={0} />
      {p.scene.clientPresent && (
        <Character model={office.visitor} restless={false} position={CLIENT_CHAMBER.position} rotation={0} seatTop={0.46} seed={2} mood={moodOf(p, 'client', p.scene.clientMood)} talking={p.speaker === 'client'} lookAt={p.speaker === 'client' ? CHAMBER_EYE : JUDGE_DESK.head} cue={p.line?.speaker === 'client' ? gestureFor(p.line) : null} />
      )}

      {/* code books behind the judge, flag, coat of the office */}
      {[-1.75, 1.75].map((x, i) => <Bookcase key={x} m={m} position={[x, 0, againstWall(3.6)]} rotation={Math.PI} width={1.3} seed={20 + i} />)}
      {/* the flag stands at the host's right hand (behind his right shoulder) */}
      {office.flag && <Flag m={m} position={[0.95, 0, 3.0]} rotation={Math.PI} />}
      <WallSign position={[-1.35, 2.35, 3.58]} rotation={Math.PI} size={[1.2, 0.36]} title={office.sign[0]} subtitle={office.sign[1]} dark />
      <TrayCeiling m={m} w={5.6} d={5.4} h={3.1} zc={1.0} panels={[]} />
      {office.role === 'judge' && <StateEmblem position={[0, 2.5, 3.585]} rotation={Math.PI} radius={0.26} />}
      <Prop model="potted_plant_04" position={[2.3, 0, -1.0]} />
      <Prop model="wall_clock" position={[2.69, 2.5, 2.4]} rotation={-Math.PI / 2} />
    </>
  );
}

function Desk3D(props: SceneProps) {
  const desk = DESK_SLOTS[props.stage];
  if (!desk || !props.docs?.length) return null;
  return <DeskItems docs={props.docs} top={desk.top} slots={desk.slots} bounds={desk.bounds} facing={desk.facing} onInspect={props.onInspect ?? (() => {})} onHover={props.onHover ?? (() => {})} />;
}

function Room(props: SceneProps) {
  const m = useMaterials();
  if (props.stage === 'consult') return <Office m={m} p={props} />;
  if (props.stage === 'draft') return <DraftRoom m={m} paper={props.paper} avatar={props.avatar} />;
  if (props.stage === 'filing') return <Registry m={m} p={props} />;
  if (props.stage === 'report') return <Registry m={m} p={props} desk={DUTY_DESK} />;
  if (props.stage === 'interview') return <Chamber m={m} p={props} office={INVESTIGATOR_OFFICE} />;
  if (props.stage === 'complaint') return <Chamber m={m} p={props} office={CHIEF_OFFICE} />;
  return <Chamber m={m} p={props} />;
}

const LABEL: Record<StageId, string> = {
  report: '3D Namuna tumani IIB: navbatchining qabul darchasi',
  interview: '3D tergovchi kabineti',
  complaint: '3D tergov boʻlinmasi boshligʻi kabineti',
  consult: '3D advokatlik byurosi: mijoz roʻparangizda oʻtiribdi',
  draft: '3D hujjatlar xonasi: ish stoli va kompyuter',
  filing: '3D sud devonxonasi: qabul darchasi',
  chamber: '3D sudya kabineti',
  hearing: '3D sud majlisi zali',
};

export default function CaseScene(props: SceneProps) {
  if (props.stage === 'hearing') {
    const map: Partial<Record<CaseSpeaker, 'judge' | 'secretary' | 'claimant' | 'respondent' | 'witness'>> = { judge: 'judge', secretary: 'secretary', client: 'claimant', respondent: 'respondent', witness: 'witness' };
    const speaker = props.speaker ? (map[props.speaker] ?? null) : null;
    const standing = props.scene.everyoneStands ? (['secretary', 'claimant', 'respondent', 'witness'] as const) : speaker === 'respondent' ? (['respondent'] as const) : [];
    return (
      <CourtRoom
        view="advocate"
        speaker={speaker}
        witnessPresent={props.scene.witnessIn}
        witnessCalled={props.scene.witnessIn}
        standing={[...standing]}
        judgePresent={props.scene.judgeIn}
        judgeEntries={props.scene.judgeEntries}
        advocateStanding={props.standing}
        advocateSpeaking={props.speaker === 'you'}
        avatar={props.avatar}
        extra={<Desk3D {...props} />}
        moods={props.line?.emotion ? { [speaker ?? 'system']: props.line.emotion } : undefined}
        cue={props.line && speaker ? { speaker, cue: gestureFor(props.line) } : undefined}
      />
    );
  }
  return (
    <Canvas shadows="percentage" dpr={[1, 1.75]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 60, near: 0.1, far: 30, position: [0, 1.2, 0] }} role="img" aria-label={LABEL[props.stage]} className="cursor-grab active:cursor-grabbing" onCreated={({ gl }) => (gl.toneMapping = THREE.NoToneMapping)}>
      <color attach="background" args={['#0c0f14']} />
      <Suspense fallback={null}>
        <Room {...props} />
        <Desk3D {...props} />
        <FrameForPanel side={props.stage === 'draft' ? 'left' : 'right'} />
        <FitFov />
        <QualityGovernor />
        <DevProbe />
        <RoomFx />
      </Suspense>
    </Canvas>
  );
}
