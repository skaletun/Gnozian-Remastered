/**
 * Materialize the full 229 animated GLB assets at install/build/dev time.
 * Source is committed in 14 UTF-8 chunks under assets/3d-archive/.
 * No external network, CDN, LFS or post-install download is required.
 */
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ARCHIVE = path.resolve('assets/3d-archive');
const DEST = path.resolve('public/models');
const EXPECTED = 229;
const CATEGORIES = new Set(['terrain','resources','improvements','buildings','units','wonders','cities','districts','props']);
const chunks = await Promise.all(Array.from({length:14}, async (_,i) =>
  readFile(path.join(ARCHIVE, 'part-'+String(i).padStart(2,'0')+'.txt'),'utf8')));
const packed = chunks.join('');
if (packed.length !== 6002950) throw new Error('Truncated 3D model archive');
const assets = JSON.parse(packed);
const names = Object.keys(assets);
if(names.length !== EXPECTED) throw new Error('Expected '+EXPECTED+' models, found '+names.length);
let changed = 0;
let totalBytes = 0;
for (const name of names) {
  if(!/^[a-z0-9_]+_lod[01]$/.test(name))throw new Error('Invalid model name '+name);
  const category = name.split('_')[0];
  if (!CATEGORIES.has(category))throw new Error('Unknown category '+category);
  const data = Buffer.from(assets[name],'base64');
  if(data.length < 24 || data.toString('ascii',0,4)!=='glTF' ||
      data.readUInt32LE(8)!==data.length) throw new Error('Broken GLB '+name);
  const jsonLen=data.readUInt32LE(12);
  const gltf=JSON.parse(data.subarray(20,20+jsonLen).toString('utf8'));
  if(!Array.isArray(gltf.animations)||!gltf.animations.length)throw new Error('No animation in '+name);
  const file=path.join(DEST,category,name+'.glb');
  totalBytes+=data.length;
  if(process.argv.includes('--verify')){
    const existing = await readFile(file);
    if(!existing.equals(data))throw new Error('Missing or corrupted materialized GLB: '+name);
    continue;
  }
  await mkdir(path.dirname(file),{recursive:true});
  let isCurrent=false;
  try{
    const old=await readFile(file);
    isCurrent=old.length===data.length&&createHash('sha256').update(old).digest('hex')===createHash('sha256').update(data).digest('hex');
  }catch(error){if(error.code!=='ENOENT')throw error;}
  if(!isCurrent){await writeFile(file,data);changed++;}
}
console.log('Gnozian animated 3D assets: '+names.length+' verified GLB, '+totalBytes+' bytes, '+changed+' files updated');
