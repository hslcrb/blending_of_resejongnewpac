import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
const root = process.cwd(), pub = path.join(root, 'public');
const load = p => JSON.parse(readFileSync(p, 'utf8'));
const manifest=load(path.join(pub,'model/streaming-manifest.json'));
const original=load(path.join(pub,'model/stream-shared/source-streaming-manifest.json'));
const raw=load(path.join(pub,'model/trees-20261104/source-manifest.json'));
function parse(url){const file=path.join(pub,url.replace(/^\//,''));const b=readFileSync(file);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));}
function uniqueVertices(j){let ids=new Set(j.meshes.flatMap(mesh=>mesh.primitives.map(p=>p.attributes.POSITION)));return [...ids].reduce((s,i)=>s+j.accessors[i].count,0)}
test('each tree partition retains every original scene node and geometry remains within Pages limits',()=>{
 const modified=raw.chunks.filter(c=>c.url.includes('/trees-20261104/'));assert.equal(modified.length,12);
 for(const entry of modified){const old=original.chunks.find(c=>c.id===entry.id);assert.ok(old);const a=parse(entry.url),b=parse(old.url);assert.deepEqual(a.nodes.map(n=>n.name).sort(),b.nodes.map(n=>n.name).sort(),entry.id);assert.ok(statSync(path.join(pub,entry.url.slice(1))).size<25*1024*1024,entry.id);assert.ok(uniqueVertices(a)<=uniqueVertices(b)*1.05,entry.id+' vertices');}
});
test('production tree chunks and all shared buffers resolve and match declared lengths',()=>{
 const modified=manifest.chunks.filter(c=>c.url.includes('/trees-smooth-shared-20261104/'));assert.equal(modified.length,12);
 for(const entry of modified){const file=path.join(pub,entry.url.slice(1));assert.equal(statSync(file).size,entry.bytes);const j=parse(entry.url);for(const buffer of j.buffers.filter(x=>x.uri)){const target=path.resolve(path.dirname(file),buffer.uri);assert.ok(target.startsWith(path.join(pub,'model','trees-smooth-shared-20261104')+path.sep));assert.ok(existsSync(target));assert.equal(statSync(target).size,buffer.byteLength);}}
});
