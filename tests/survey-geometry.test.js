import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractSurveyGeometry,hideReplacedSurveyGeometry} from '../src/surveyGeometry.js';
const manifest=JSON.parse(await readFile(new URL('../public/model/survey-20261115/colonnade-replacements.json',import.meta.url)));
function fake(){const scene=new Group();for(const name of manifest.meshNames){const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());mesh.userData.name=name;scene.add(mesh);}return {scene,scenes:[scene]};}
test('replacement validation is atomic: missing or extra assets leave originals untouched',()=>{
 const g=fake();g.scene.remove(g.scene.children[0]);const before=[...g.scene.children];assert.throws(()=>extractSurveyGeometry(g,manifest),/Incomplete/);assert.deepEqual(g.scene.children,before);
 const extra=fake();extra.scene.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));assert.throws(()=>extractSurveyGeometry(extra,manifest),/Unexpected/);assert.equal(extra.scene.children.length,5);
});
test('exact names only are hidden, including later streamed chunks',()=>{
 const patch=extractSurveyGeometry(fake(),manifest);const core=fake();const other=new Mesh(new BoxGeometry(),new MeshStandardMaterial());other.name='stone interior retained';core.scene.add(other);
 assert.equal(hideReplacedSurveyGeometry(core.scene,patch),4);assert.equal(other.visible,true);assert.ok(patch.root.children.every(x=>x.visible));
 const chunk=new Group();const mesh=new Mesh();mesh.name='sanitized';mesh.userData.name=manifest.meshNames[1];chunk.add(mesh);assert.equal(hideReplacedSurveyGeometry(chunk,patch),1);assert.equal(mesh.visible,false);
});
test('actual patch GLB has exactly four replacements and preserves source transforms',async()=>{
 const data=await readFile(new URL('../public/model/survey-20261115/colonnade-geometry.glb',import.meta.url));
 const gltf=await new GLTFLoader().register(()=>({name:'TEST_HEADLESS_TEXTURE',loadTexture:()=>Promise.resolve(new Texture())})).parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 gltf.scene.updateWorldMatrix(true,true);const transforms=new Map();gltf.scene.traverse(o=>{if(manifest.meshNames.includes(o.userData.name||o.name))transforms.set(o.userData.name||o.name,o.matrixWorld.elements.slice());});
 const patch=extractSurveyGeometry(gltf,manifest);assert.equal(patch.root.children.length,4);patch.root.updateWorldMatrix(true,true);for(const o of patch.root.children)assert.deepEqual(o.matrixWorld.elements,transforms.get(o.userData.name||o.name));assert.equal(manifest.changedVertices.stone,112);
});
