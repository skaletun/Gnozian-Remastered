import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('public/ui-2d');
await mkdir(output, { recursive: true });
const manifest = [];
const GOLD = '#eac67b';
const PALE = '#fff0be';

async function save(id, svg, category, description, width=64, height=64) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid asset id: ' + id);
  const file = id + '.svg';
  await writeFile(path.join(output, file), svg, 'utf8');
  manifest.push({ id, file: 'ui-2d/' + file, category, description, width, height });
}
const svg = (body, w=64, h=64) =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="none">' + body + '</svg>';
const paths = {
  'empire':'M9 19h46M15 12h34M19 12l13-7 13 7M17 19v25M28 19v25M38 19v25M49 19v25M13 47h38M10 52h44',
  'play':'M23 14 49 32 23 50Z',
  'continue':'M12 17 26 32 12 47M32 17 47 32 32 47',
  'save':'M12 10h36l5 6v38H11V10Zm8 0v17h25V10M19 54V37h28v17M37 12v11',
  'load':'M8 21h19l6 7h23l-8 23H8V21Zm18 7-6 16M30 13h19v15',
  'settings':'m32 7 5 4 6-2 3 6 7 2-1 7 5 7-5 6 1 7-7 2-3 7-7-3-4 4-6-4-7 3-3-7-7-2 1-7-4-6 4-7-1-7 7-2 3-6 7 2 6-4Z M23 32a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  'trophy':'M20 8h24v19a12 12 0 0 1-24 0V8ZM20 14H8v10a12 12 0 0 0 12 11M44 14h12v10a12 12 0 0 1-12 11M32 39v11M20 53h24M25 49h14',
  'book':'M6 12c10-5 19-5 26 2 7-7 16-7 26-2v38c-10-4-19-3-26 3-7-6-16-7-26-3V12ZM32 14v39',
  'map':'M8 14 26 8l15 7 15-6v41l-15 6-15-7-18 6V14ZM26 8v41M41 15v41',
  'download':'M32 8v30M21 27l11 11 11-11M12 42v12h40V42',
  'network':'M18 18a6 6 0 1 0-12 0 6 6 0 1 0 12 0M56 18a6 6 0 1 0-12 0 6 6 0 1 0 12 0M39 49a7 7 0 1 0-14 0 7 7 0 1 0 14 0m-22-27 11 20m19-20L36 42M18 18h26',
  'city':'M11 54V24l12-7 12 7v30M35 54V14l9-5 10 5v40M19 30h8v10h-8v-10ZM42 22h5M42 30h5M42 39h5M6 54h52',
  'science':'M25 7h14M28 7v21L13 51a5 5 0 0 0 5 7h28a5 5 0 0 0 5-7L36 28V7M23 42h18',
  'culture':'M13 52c-7-9-9-22-3-36M51 52c7-9 9-22 3-36M11 17l8 8-9 3M14 32l10 4-7 5M51 17l-8 8 9 3M50 32l-10 4 7 5M22 51c8 5 12 5 20 0',
  'gold':'M12 16a20 8 0 1 0 40 0 20 8 0 1 0-40 0M12 16v12c0 11 40 11 40 0V16M12 28v12c0 11 40 11 40 0V28M12 40v8c0 11 40 11 40 0v-8',
  'production':'m32 7 7 4 8-1 2 9 7 5-3 8 3 8-7 5-2 9-8-1-7 4-7-4-8 1-2-9-7-5 3-8-3-8 7-5 2-9 8 1ZM22 32a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
  'food':'M32 55V13M32 22c-13-2-17-7-17-13 12-1 18 5 17 13ZM32 32c-13-2-17-7-17-13M32 42c-13-2-17-7-17-13M32 22c13-2 17-7 17-13M32 32c13-2 17-7 17-13M32 42c13-2 17-7 17-13',
  'population':'M23 18a9 9 0 1 0 18 0a9 9 0 1 0-18 0M14 53V46c0-10 8-15 18-15s18 5 18 15v7H14ZM8 27a5 5 0 1 0 10 0a5 5 0 1 0-10 0M46 27a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
  'diplomacy':'M8 35 24 20l8 6 8-6 16 15-14 13-10-8-10 8L8 35ZM24 20l5-5h13l14 13M22 48l7 6 5-4M40 48l-5 6',
  'war':'M10 12 51 53M54 12 13 53M7 10l9-4 5 9M57 10l-9-4-5 9M8 48l8 8M56 48l-8 8',
  'scout':'M32 7 40 26 57 32 40 39 32 57 24 39 7 32l17-6 8-19Z M26 32a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
  'economy':'M11 50h42M16 45V22M28 45V14M40 45V28M52 45V9M10 31l13-10 11 9L52 10',
  'government':'M7 20h50L32 7 7 20ZM13 52h38M16 27v20M28 27v20M39 27v20M50 27v20',
  'up':'m14 39 18-18 18 18',
  'down':'m14 25 18 18 18-18',
  'left':'M48 32H14m0 0 16-16M14 32l16 16',
  'right':'M16 32h34m0 0L34 16m16 16L34 48',
  'close':'M16 16 48 48M48 16 16 48',
  'check':'M9 33 24 48 56 14',
  'info':'M8 32a24 24 0 1 0 48 0a24 24 0 1 0-48 0M32 29v18M32 17v2',
  'warning':'M32 8 59 54H5L32 8ZM32 24v15M32 46v1',
  'search':'M10 27a17 17 0 1 0 34 0a17 17 0 1 0-34 0m31 14 16 16',
  'star':'m32 6 8 18 19 3-14 13 4 19-17-9-17 9 4-19L5 27l19-3Z',
  'shield':'m32 6 23 8v17c0 15-9 22-23 28C18 53 9 46 9 31V14L32 6Z',
  'peace':'M8 32a24 24 0 1 0 48 0a24 24 0 1 0-48 0M32 9v46M32 32l-18 17M32 32l18 17',
  'trade':'M8 22h43l-10-10m10 10L41 32M56 42H13l10-10M13 42l10 10',
  'movement':'M32 6v52M6 32h52m-26-26-9 10m9-10 9 10M6 32l10-9M6 32l10 9M58 32l-10-9m10 9-10 9M32 58l-9-10m9 10 9-10',
  'health':'M32 54 9 33C-2 18 16 5 32 21 48 5 66 18 55 33L32 54Z',
  'worker':'M8 48h48M13 48l7-22 13 8 17-8 5 22M17 24l15-17 16 17M21 38h10M40 38h6',
  'settler':'M11 53h42M16 53V31l16-16 16 16v22M23 53V37h18v16M12 29 32 8l20 21',
  'fortify':'M11 55V14h9v8h9V14h9v8h8V14h9v41M8 55h48M26 55V39h12v16',
  'ship':'M32 7v35M10 44l22 11 22-11M10 44h44M32 10l20 28H32M30 13 15 37h15',
  'quest':'M18 8h28v48H18V8ZM24 20h16M24 30h16M24 40h11M13 16h5M13 32h5',
  'eye':'M6 32c15-23 37-23 52 0-15 23-37 23-52 0Z M24 32a8 8 0 1 0 16 0a8 8 0 1 0-16 0',
  'lock':'M14 28h36v28H14V28ZM21 28v-9a11 11 0 0 1 22 0v9M32 39v8',
  'plus':'M32 9v46M9 32h46',
  'minus':'M9 32h46',
  'filter':'M8 12h48L39 32v17l-14 8V32L8 12Z',
  'sort':'M22 53V11L9 24M22 11l13 13M42 11v42L29 40m13 13 13-13',
  'castle':'M9 55V13h10v8h10v-8h10v8h10v-8h9v42M19 55V35h26v20M29 55V41h8v14',
  'ruins':'M8 56h48M18 56V24M30 56V24M44 56V24M12 24h39M9 18h46L32 8 9 18ZM44 24l4 11-4 8',
  'resource':'m32 8 23 15v22L32 57 9 45V23L32 8ZM9 23l23 14 23-14M32 37v20',
  'world':'M7 32a25 25 0 1 0 50 0a25 25 0 1 0-50 0M7 32h50M32 7c-18 12-18 38 0 50M32 7c18 12 18 38 0 50M15 17h34M15 47h34',
  'hammer':'m18 9 19 19m-3 6-19 19M17 9l9-4 16 16-5 9-20-21ZM29 33l-7 7 5 5 7-7',
  'calendar':'M9 14h46v42H9V14ZM9 25h46M21 8v13M43 8v13M20 35h8M36 35h8M20 45h8',
  'cloud':'M16 49a11 11 0 0 1-2-22 17 17 0 0 1 33-4 13 13 0 1 1 1 26H16ZM32 30v18M23 39l9-9 9 9',
  'exit':'M31 9H13v46h18M23 32h36m0 0L46 19m13 13L46 45',
  'person':'M23 17a9 9 0 1 0 18 0a9 9 0 1 0-18 0M14 56V48a18 18 0 0 1 36 0v8',
  'building':'M10 55V20l16-8v43M26 55V9l27 12v34M8 55h49M34 29h6m7 0h2m-15 9h6m7 0h2',
  'minimap':'M7 7h50v50H7V7ZM11 43 23 30l11 6 9-18 11 8M22 54V33M43 19v36',
  'hex':'M32 5 55 18v28L32 59 9 46V18Z',
  'menu':'M10 18h44M10 32h44M10 46h44',
  'archer':'M17 9c29 0 29 46 0 46M17 9l-4 23 4 23M9 32h46m0 0-9-7m9 7-9 7',
  'cavalry':'M13 52h42M24 52V32l-9-12 9-9 17 5 10 13-6 23M29 16l1 13-8 9M32 52v-9',
  'mine':'m12 53 18-38M30 15 50 5m-20 10 20 13M33 9l7 6M13 54l-7-5',
  'farm':'M7 56h50M14 56V30l18-18 18 18v26M25 56V37h14v19M8 42l6-6m35 0 6 6',
  'forest':'M7 54h50M19 54V33M45 54V33M19 12 6 36h26L19 12ZM45 8 31 36h27L45 8Z',
  'mountain':'M4 53 25 13l12 23 7-12 16 29H4ZM15 33l10 5 9-5',
  'ocean':'M5 20c10-8 18 8 28 0s18 8 27 0M5 33c10-8 18 8 28 0s18 8 27 0M5 46c10-8 18 8 28 0s18 8 27 0',
  'desert':'M5 51c10-19 17-19 25-3 10-15 20-15 29 3M13 24h11M41 15h13M37 22v9m-4-5h9',
};
const groups = {
  food:'#64d5a7',science:'#72c6f1',culture:'#ca8fd8',health:'#69d49a',
  gold:'#f5d06c',production:'#e9a96a',war:'#ee8689',warning:'#f7b965',
  ocean:'#75c8e6',ship:'#85c7e1',desert:'#e7c78e',mountain:'#e9dcc2',
  forest:'#78c69f',farm:'#9dce8c'
};
for (const [name, d] of Object.entries(paths)) {
  for (const [scale, size] of [['sm',32],['md',64],['lg',128]]) {
    const color=groups[name]||GOLD;
    const shape='<circle cx="32" cy="32" r="29" fill="#0a2432" stroke="#b9975e" stroke-width="1.5"/><circle cx="32" cy="32" r="26" stroke="#acd2d6" stroke-opacity=".2"/><path d="' + d + '" stroke="' + color + '" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    await save('icon-'+name+'-'+scale, svg(shape).replace('width="64" height="64"','width="'+size+'" height="'+size+'"'), 'icon', name+' ('+scale+')',size,size);
  }
}
const themes={
  primary:['#fbe4a8','#b58540','#50300f','#fae0a6'],
  secondary:['#306879','#0c303d','#071925','#b1dbdf'],
  ghost:['#283d49','#15242e','#0a151c','#7d9aa3'],
  danger:['#b04d4d','#6e242b','#2b151e','#f7afab'],
};
for (const [family, colors] of Object.entries(themes)) {
  for (const [state, opacity, glow] of [
    ['normal',1,.2],['hover',1,.62],['pressed',.94,.11],['selected',1,.8],['disabled',.45,0]
  ]) {
    const [top,mid,low,stroke]=colors;
    const content='<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="'+(state==='pressed'?mid:top)+'"/><stop offset=".6" stop-color="'+mid+'"/><stop offset="1" stop-color="'+low+'"/></linearGradient></defs><g opacity="'+opacity+'"><rect x="4" y="5" width="592" height="150" rx="25" fill="url(#bg)" stroke="'+stroke+'" stroke-width="5"/><rect x="11" y="12" width="578" height="136" rx="19" stroke="#fff6d8" stroke-opacity=".3"/><path d="M25 24h550" stroke="#fff1ce" stroke-opacity=".22" stroke-width="2"/><path d="M24 138h552" stroke="#030b0e" stroke-opacity=".65" stroke-width="3"/><path d="M22 48v64M578 48v64" stroke="'+PALE+'" stroke-opacity="'+glow+'" stroke-width="3"/></g>';
    await save('button-'+family+'-'+state,svg(content,600,160),'button',family+' '+state,600,160);
  }
}
for (const [tone,colors] of Object.entries({
  food:['#a0f3cc','#41b17c','#14553e'],production:['#ffd093','#e28c39','#743e12'],
  gold:['#ffe59f','#d7a24e','#75511b'],science:['#b4e8fd','#43a0d6','#1b4f78'],
  culture:['#edc4fc','#b67ed9','#5d367b'],health:['#9cfbc5','#2dc573','#116037'],
  progress:['#f9df95','#d8a34b','#77561f'],empty:['#60707b','#283c48','#11232e'],
})) {
  const content='<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset=".5" stop-color="'+colors[1]+'"/><stop offset="1" stop-color="'+colors[2]+'"/></linearGradient></defs><rect x="2" y="2" rx="15" width="476" height="30" fill="url(#g)" stroke="#e8c17e" stroke-width="2"/><path d="M20 7h440" stroke="#fff9d3" stroke-opacity=".48" stroke-width="2"/>';
  await save('progress-'+tone,svg(content,480,34),'progress','Fillable resource bar: '+tone,480,34);
}
for (const [name,col] of Object.entries({
  ocean:'#326b86',coast:'#4a9ab2',grassland:'#64985b',plains:'#c5ab62',
  forest:'#3d7544',jungle:'#24704e',hills:'#887b5d',mountains:'#777f86',
  desert:'#d2b477',tundra:'#9ba9a6',snow:'#c6e0e8',swamp:'#4a6657',
  oasis:'#6da56c',river:'#3589b3',fog:'#0b1a26',
})) {
 const decoration=name==='ocean'||name==='coast'||name==='river'?
   '<path d="M14 49q12-6 23 0t25 0M13 67q11-6 23 0t26 0" stroke="#c4e6ec" stroke-opacity=".45" stroke-width="3" fill="none"/>':
   ['mountains','hills'].includes(name)?
   '<path d="m23 76 21-39 21 39m-32-16 11 6 10-6" stroke="#fff0ca" stroke-opacity=".45" stroke-width="3" fill="none"/>':
   ['forest','jungle','grassland','oasis'].includes(name)?
   '<path d="M45 75V43m0 2L33 62h24L45 45ZM66 72V56m0 0-8 9h16Z" stroke="#e6ebaa" stroke-width="2" stroke-opacity=".45" fill="none"/>': '';
 const content='<path d="M48 3 90 27v48L48 99 6 75V27Z" fill="'+col+'" stroke="#edd39a" stroke-width="3"/><path d="M48 10 83 30v42L48 92 13 72V30Z" stroke="#fbf5c5" stroke-opacity=".22"/>'+decoration;
 await save('terrain-'+name,svg(content,96,102),'terrain',name,96,102);
}
for (const [name,fill] of Object.entries({
 selected:'#f6ce70',hover:'#dcecf2',enemy:'#ea6a67',ally:'#62dcb7',neutral:'#a3bac3',move:'#f9cb62',attack:'#ed7068'
})) {
 const hex='<path d="M48 4 89 27v47L48 98 7 74V27Z" fill="'+fill+'" fill-opacity=".14" stroke="'+fill+'" stroke-width="4"/>';
 await save('overlay-'+name,svg(hex,96,102),'overlay',name,96,102);
}
const extra={
 'chrome-divider':svg('<path d="M0 12h300m40 0h300" stroke="#c09a56" stroke-width="2"/><path d="m320 2 10 10-10 10-10-10Z" fill="#e7c175"/><path d="M0 17h294m52 0h294" stroke="#467685" stroke-opacity=".65"/>',640,24),
 'chrome-corner':svg('<path d="M5 5 24 13 31 6l7 23L66 18 52 41l17 12-30 1-11 20-8-25L5 43l14-15Z" fill="#e9bf65" stroke="#855c2b" stroke-width="2"/><path d="M17 17 27 32 16 42 34 40 43 27" stroke="#fff2bd" stroke-opacity=".5"/>',80,80),
 'chrome-panel':svg('<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1a4351"/><stop offset=".5" stop-color="#0b2734"/><stop offset="1" stop-color="#091723"/></linearGradient></defs><rect x="4" y="4" width="592" height="392" rx="22" fill="url(#b)" stroke="#cba765" stroke-width="4"/><rect x="12" y="12" width="576" height="376" rx="17" stroke="#e6d1a0" stroke-opacity=".37"/><path d="M24 80h552" stroke="#dfba76" stroke-opacity=".45"/><path d="M26 26h70M504 26h70" stroke="#f3dfb0" stroke-opacity=".5"/>',600,400),
 'chrome-slider-thumb':svg('<circle cx="32" cy="32" r="28" fill="#0f2b39" stroke="#c69d57" stroke-width="3"/><circle cx="32" cy="32" r="22" fill="#edcb7f" stroke="#fff3cc" stroke-width="3"/>'),
 'chrome-ribbon':svg('<path d="m8 20 52 15h440l52-15-20 40 20 40-52-15H60L8 100l20-40Z" fill="#133341" stroke="#deb877" stroke-width="4"/><path d="M65 35h430v50H65Z" stroke="#f7dea1" stroke-opacity=".4"/>',560,120),
 'chrome-minimap':svg('<rect x="4" y="4" width="592" height="392" rx="17" fill="#071c2a" stroke="#d7b66e" stroke-width="5"/><rect x="12" y="12" width="576" height="376" rx="11" stroke="#7bb1bd" stroke-opacity=".54"/><path d="M24 340h552" stroke="#e2bc71" stroke-opacity=".5"/>',600,400),
};
for (const [id,content] of Object.entries(extra)) {
 const match=content.match(/width="(\d+)" height="(\d+)"/);
 await save(id,content,'chrome',id,Number(match?.[1]||64),Number(match?.[2]||64));
}
manifest.sort((a,b)=>a.id.localeCompare(b.id));
await writeFile(path.join(output,'manifest.json'),JSON.stringify({schema:1,version:'2d-remaster-v1',count:manifest.length,assets:manifest},null,2),'utf8');
const all = await readdir(output);
for (const file of all) {
  if (file.endsWith('.svg') && !manifest.some(entry => entry.id+'.svg'===file)) {
    throw new Error('Unexpected old UI asset in generated directory: '+file);
  }
}
console.log('Generated '+manifest.length+' independent SVG assets in public/ui-2d');
