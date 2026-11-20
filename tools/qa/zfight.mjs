// QA: finds surfaces that would shimmer (z-fight) in every room — two faces of different meshes
// lying in the same plane (within 1 mm), facing the same way and overlapping.
// Needs the dev server (DevProbe exposes the scene). Usage: node tools/qa/zfight.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const ROOMS = { labour: ['consult', 'draft', 'filing', 'chamber', 'hearing'], theft: ['report', 'interview', 'complaint'] };

function probe() {
      const scene = window.__lexScene;
      scene.updateMatrixWorld(true);
      const faces = [];
      const aligned = (e) => e.every((v) => Math.abs(v) < 1e-3 || Math.abs(Math.abs(v) - 1) < 1e-3);
      const label = (o) => {
        const names = [];
        for (let p = o; p && names.length < 4; p = p.parent) if (p.name) names.push(p.name);
        return `${o.geometry.type}${names.length ? ` (${names.join(' < ')})` : ''}`;
      };
      scene.traverseVisible((o) => {
        if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
        // imported models: their bounding boxes are not faces — only primitives are judged
        if (!/^(Box|Plane|Cylinder)Geometry$/.test(o.geometry.type) && !o.geometry.userData?.tiled) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m.polygonOffset || m.depthWrite === false)) return; // deliberately layered
        const m = o.matrixWorld.elements;
        // rotation part must map axes to axes (no tilt), otherwise skip
        if (!aligned([m[0], m[1], m[2]].map((v, _, a) => v / Math.hypot(...a))) || !aligned([m[4], m[5], m[6]].map((v, _, a) => v / Math.hypot(...a))) || !aligned([m[8], m[9], m[10]].map((v, _, a) => v / Math.hypot(...a)))) return;
        o.geometry.computeBoundingBox();
        const box = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        const min = [box.min.x, box.min.y, box.min.z], max = [box.max.x, box.max.y, box.max.z];
        const size = max.map((v, i) => v - min[i]);
        const flat = size.findIndex((v) => v < 1e-4);
        const double = mats.some((mm) => mm.side === 2);
        // a cylinder has flat faces only at its two caps (along its own axis)
        const capAxis = o.geometry.type === 'CylinderGeometry' ? [m[4], m[5], m[6]].map(Math.abs).indexOf(Math.max(...[m[4], m[5], m[6]].map(Math.abs))) : -1;
        for (let a = 0; a < 3; a++) {
          if (capAxis >= 0 && a !== capAxis) continue;
          const [b, c] = [0, 1, 2].filter((k) => k !== a);
          if (size[b] < 0.01 || size[c] < 0.01) continue;
          const rect = [min[b], max[b], min[c], max[c]];
          if (flat === a) {
            // a plane: which way does it face?
            const n = o.geometry.attributes.normal;
            let dir = 1;
            if (n) {
              const v = [n.getX(0), n.getY(0), n.getZ(0)];
              const w = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
              dir = Math.sign(w[a]) || 1;
            }
            faces.push({ a, dir, v: min[a], rect, o, l: label(o) });
            if (double) faces.push({ a, dir: -dir, v: min[a], rect, o, l: label(o) });
          } else if (flat < 0) {
            faces.push({ a, dir: 1, v: max[a], rect, o, l: label(o), size });
            faces.push({ a, dir: -1, v: min[a], rect, o, l: label(o), size });
          }
        }
      });
      // only faces the student can see: turned toward the eye, and not buried inside a third solid
      const eye = window.__lexCamera.position.toArray();
      const solids = faces.filter((f) => f.size).map((f) => f.o).filter((o, i, all) => all.indexOf(o) === i)
        .map((o) => { const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); return { o, min: b.min.toArray(), max: b.max.toArray() }; });
      const buried = (f, rect, skip) => solids.some((s) => {
        if (skip.includes(s.o)) return false;
        const [b, c] = [0, 1, 2].filter((k) => k !== f.a);
        const ahead = f.v + f.dir * 0.003;
        return s.min[f.a] <= ahead && s.max[f.a] >= ahead && s.min[b] <= rect[0] + 1e-3 && s.max[b] >= rect[1] - 1e-3 && s.min[c] <= rect[2] + 1e-3 && s.max[c] >= rect[3] - 1e-3;
      });
      const out = [];
      for (let i = 0; i < faces.length; i++)
        for (let j = i + 1; j < faces.length; j++) {
          const f = faces[i], g = faces[j];
          if (f.o === g.o || f.a !== g.a || f.dir !== g.dir || Math.abs(f.v - g.v) > 0.001) continue;
          const w = Math.min(f.rect[1], g.rect[1]) - Math.max(f.rect[0], g.rect[0]);
          const h = Math.min(f.rect[3], g.rect[3]) - Math.max(f.rect[2], g.rect[2]);
          if (w < 0.02 || h < 0.02) continue;
          if ((eye[f.a] - f.v) * f.dir <= 0) continue; // faces away from the student
          const [b, c] = [0, 1, 2].filter((k) => k !== f.a);
          const rect = [Math.max(f.rect[0], g.rect[0]), Math.min(f.rect[1], g.rect[1]), Math.max(f.rect[2], g.rect[2]), Math.min(f.rect[3], g.rect[3])];
          void b; void c;
          if (buried(f, rect, [f.o, g.o])) continue;
          const at = f.o.getWorldPosition(new f.o.position.constructor());
          out.push(`${'xyz'[f.a]}${f.dir > 0 ? '+' : '−'}=${f.v.toFixed(3)} overlap ${(w * h).toFixed(3)} m² · ${f.l} @${at.toArray().map((v) => v.toFixed(2))} ↔ ${g.l} @${g.o.getWorldPosition(new g.o.position.constructor()).toArray().map((v) => v.toFixed(2))}`);
        }
      return out;
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'QA', avatar: 'woman', role: 'student' })));
let total = 0;
const report = (name, found) => {
  total += found.length;
  console.log(`${found.length ? '✗' : '✓'} ${name}: ${found.length} coplanar pair(s)`);
  for (const f of found.slice(0, 60)) console.log('   ', f);
};
for (const [kind, stages] of Object.entries(ROOMS)) {
  const id = await page.evaluate(async (kind) => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, kind }) })).json()).case.caseId, kind);
  for (const stage of stages) {
    await page.goto(`${BASE}/ish/${id}/${stage}`);
    await page.waitForFunction(() => window.__lexScene, null, { timeout: 30000 });
    await page.waitForTimeout(6000);
    const found = await page.evaluate(probe);
    report(`${kind}/${stage}`, found);
  }
}
// the campus corridor and the DXM office (other canvases, same probe)
await page.goto(`${BASE}/`);
await page.waitForFunction(() => window.__lexScene && window.__lexCamera, null, { timeout: 30000 });
await page.waitForTimeout(6000);
report('campus', await page.evaluate(probe));
await page.evaluate(() => { window.__lexScene = undefined; });
await page.goto(`${BASE}/hub`);
await page.getByRole('button', { name: 'Boshlash' }).click();
await page.waitForURL(/simulation\/sim_/);
await page.waitForFunction(() => window.__lexScene && window.__lexCamera, null, { timeout: 90000 });
await page.waitForTimeout(6000);
report('dxm', await page.evaluate(probe));

await browser.close();
process.exit(total ? 1 : 0);
