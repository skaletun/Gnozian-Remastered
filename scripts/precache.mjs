import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root='dist';
async function enumerate(dir) {
  const entries=await readdir(dir,{withFileTypes:true});
  const out=[];
  for(const e of entries){const p=path.join(dir,e.name); if(e.isDirectory())out.push(...await enumerate(p));else out.push(p);}
  return out;
}
const paths=(await enumerate(root)).filter(x=>!x.endsWith('sw.js')).map(x=>x.slice(root.length+1).split(path.sep).join('/'));
const target=path.join(root,'sw.js');
const src=await readFile(target,'utf8');
if(!src.includes('__PRECACHE_ASSETS__'))throw new Error('Service worker missing precache placeholder');
const manifest=JSON.stringify(paths.sort());
await writeFile(target,src.replace('__PRECACHE_ASSETS__',manifest));
console.log(`Offline bundle precached: ${paths.length} assets`);
