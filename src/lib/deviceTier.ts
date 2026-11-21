/**
 * How much 3D this device can carry, decided BEFORE the first frame — so a weak laptop or an
 * office PC opens in the light mode instead of stuttering for seconds until a frame monitor notices.
 *
 *   high   — Apple silicon, a discrete GPU (NVIDIA / AMD): every effect, full pixel density;
 *   medium — integrated graphics, recent phones: no ambient occlusion / MSAA, smaller shadows;
 *   low    — software rendering, old integrated GPUs, ≤4 GB / ≤4 cores, data saver: no post effects,
 *            no shadows, one pixel per pixel, a steady 30 fps.
 *
 * Overrides: `?quality=low|medium|high` (kept for the session) or the settings' choice.
 * The running scenes may still step DOWN when frames drop (never back up: a flip-flop is a stutter).
 */
export type Tier = 'low' | 'medium' | 'high';
export const TIERS: Tier[] = ['low', 'medium', 'high'];
const KEY = 'lexsim.quality';

let cached: Tier | null = null;

function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

function detect(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const gpu = gpuName().toLowerCase();
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (gpu === 'none' || /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(gpu)) return 'low';
  if (nav.connection?.saveData) return 'low';
  if (memory <= 4 || cores <= 4) return 'low';
  // old integrated / mobile GPUs
  if (/mali-[t4]|adreno \(tm\) [3-5]\d\d|powervr|intel\(r\) hd graphics( [2-5]\d{2,3})?\b|gma/.test(gpu)) return 'low';
  if (touch) return /apple gpu|adreno \(tm\) [7-8]\d\d|mali-g7\d|mali-g[6-9]\d\d|xclipse/.test(gpu) && memory >= 6 ? 'medium' : 'low';
  if (/apple m\d|apple gpu|nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|amd radeon(?!.*graphics)|arc\b/.test(gpu)) return 'high';
  return 'medium'; // integrated graphics (Intel UHD / Iris, AMD Radeon Graphics) and the unknown
}

export function deviceTier(): Tier {
  if (cached) return cached;
  if (typeof window === 'undefined') return 'medium';
  try {
    const asked = new URLSearchParams(location.search).get('quality');
    if (asked && (TIERS as string[]).includes(asked)) sessionStorage.setItem(KEY, asked);
    const kept = sessionStorage.getItem(KEY);
    if (kept && (TIERS as string[]).includes(kept)) return (cached = kept as Tier);
  } catch {
    /* storage blocked: detect */
  }
  cached = detect();
  return cached;
}

export const lower = (a: Tier, b: Tier): Tier => (TIERS.indexOf(a) <= TIERS.indexOf(b) ? a : b);

/** The page knows the tier too: light mode drops the glass blur over the 3D view (it re-blurs every frame). */
export function markDocument(tier: Tier) {
  if (typeof document !== 'undefined') document.documentElement.dataset.quality = tier;
}
