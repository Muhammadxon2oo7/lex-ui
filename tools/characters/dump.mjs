// Debug helper: print node tree, skins and morph target names of a GLB.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const r = (n, d) => {
  const t = n.getTranslation().map((v) => +v.toFixed(4)), q = n.getRotation().map((v) => +v.toFixed(4)), s = n.getScale().map((v) => +v.toFixed(3));
  console.log(`${'  '.repeat(d)}${n.getName()} t=${t} q=${q} s=${s}${n.getMesh() ? ' [mesh ' + n.getMesh().getName() + ']' : ''}${n.getSkin() ? ' [skin]' : ''}`);
  n.listChildren().forEach((c) => r(c, d + 1));
};
root.listScenes()[0].listChildren().forEach((n) => r(n, 0));
for (const s of root.listSkins()) console.log('skin joints', s.listJoints().length, 'skeleton', s.getSkeleton()?.getName());
for (const m of root.listMeshes()) {
  console.log('mesh', m.getName(), 'prims', m.listPrimitives().length, 'targets', m.listPrimitives().map((p) => p.listTargets().length), 'tris', m.listPrimitives().map((p) => p.getIndices().getCount() / 3), 'mats', m.listPrimitives().map((p) => p.getMaterial()?.getName()));
  console.log('targetNames', JSON.stringify(m.getExtras().targetNames));
}
