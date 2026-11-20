// Debug helper: print animation channels / root-node keyframes of a GLB.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const depth = +(process.argv[3] ?? 3);
const r = (n, d) => {
  if (d > depth) return;
  const t = n.getTranslation().map((v) => +v.toFixed(4)), q = n.getRotation().map((v) => +v.toFixed(4)), s = n.getScale().map((v) => +v.toFixed(3));
  console.log(`${'  '.repeat(d)}${n.getName()} t=${t} q=${q} s=${s}${n.getMesh() ? ' [mesh]' : ''}`);
  n.listChildren().forEach((c) => r(c, d + 1));
};
root.listScenes()[0].listChildren().forEach((n) => r(n, 0));
console.log('nodes', root.listNodes().length, 'meshes', root.listMeshes().length);
for (const a of root.listAnimations()) {
  const ch = a.listChannels();
  const byPath = {};
  let dur = 0, keys = 0;
  for (const c of ch) {
    (byPath[c.getTargetPath()] ??= []).push(c.getTargetNode()?.getName());
    const inp = c.getSampler().getInput();
    keys = Math.max(keys, inp.getCount());
    dur = Math.max(dur, inp.getMax([0])[0]);
  }
  console.log(`anim "${a.getName()}" channels=${ch.length} dur=${dur.toFixed(3)} maxKeys=${keys}`, Object.fromEntries(Object.entries(byPath).map(([k, v]) => [k, v.length])));
  for (const c of ch) {
    const n = c.getTargetNode()?.getName();
    if (!/^(Bip01|Bip01[ _]Pelvis|RootNode)$/.test(n)) continue;
    const s = c.getSampler(), o = s.getOutput(), i = s.getInput();
    const N = o.getCount();
    const f = (k) => o.getElement(k, []).map((v) => +v.toFixed(4)).join(',');
    console.log(`  ${n}.${c.getTargetPath()} n=${N} t0=${i.getScalar(0).toFixed(3)} first=[${f(0)}] mid=[${f(N >> 1)}] last=[${f(N - 1)}]`);
  }
}
