/**
 * Gnozian Remastered multiplayer coordination API.
 * Cloudflare Workers + D1. The server owns sessions, player identities,
 * turn sequence and event history. It never accepts a replacement GameState
 * snapshot from a client. Rule re-simulation is a separate milestone.
 */
const ALLOWED_ORIGINS = new Set([
  'https://skaletun.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const MAX_BODY = 64 * 1024;
const MAX_STEPS = 64;
const GAME_VERSION = '7.0.0';
const CORS_METHODS = 'GET, POST, OPTIONS';

function headers(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://skaletun.github.io';
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Gnozian-Game-Version',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}
function json(value,status=200,origin='') {
  return new Response(JSON.stringify(value),{status,headers:headers(origin)});
}
function fail(message,status=400,code='bad_request',origin='') {
  return json({ok:false,error:message,code},status,origin);
}
function toString(value,max=48) {
  return typeof value==='string' ? value.trim().slice(0,max) : '';
}
function validId(s) {return /^[a-zA-Z0-9_-]{10,90}$/.test(s);}
function randomSecret(){return crypto.randomUUID()+crypto.randomUUID();}
async function digest(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function token(request){
  const h=request.headers.get('Authorization') || '';
  return /^Bearer [A-Za-z0-9-]{50,100}$/.test(h)?h.slice(7):null;
}
async function body(request) {
  const size=Number(request.headers.get('Content-Length')||0);
  if(size>MAX_BODY)throw new Error('payload_too_large');
  const text=await request.text();
  if(text.length>MAX_BODY)throw new Error('payload_too_large');
  const obj=JSON.parse(text);
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('invalid_payload');
  return obj;
}
function select(db,sql,...args) {return db.prepare(sql).bind(...args).first();}
function execute(db,sql,...args){return db.prepare(sql).bind(...args).run();}
async function session(db,matchId,request) {
  const secret=token(request);
  if(!secret)return null;
  return select(db,'SELECT slot,display_name,ready FROM seats WHERE match_id=? AND token_hash=?',matchId,await digest(secret));
}
async function hasHost(db,match,request){
  const secret=token(request);
  return !!secret && (await digest(secret))===match.host_secret_hash;
}
async function readMatch(db,id){return select(db,'SELECT * FROM matches WHERE id=?',id);}
function publicMatch(match,seats){
  return {
    matchId:match.id,label:match.label,status:match.status,maxPlayers:match.max_players,
    gameVersion:match.game_version,seed:match.seed,settings:match.settings_json?JSON.parse(match.settings_json):null,
    stateVersion:match.state_version,currentSlot:match.current_slot,turn:match.turn,
    seats:seats.map(s=>({slot:s.slot,displayName:s.display_name,ready:!!s.ready,joinedAt:s.joined_at})),
  };
}
function isSafeStep(s){
  if(!s||typeof s!=='object'||Array.isArray(s))return false;
  if(s.t==='cmd'){
    return !!s.cmd && typeof s.cmd==='object' && !Array.isArray(s.cmd) &&
      typeof s.cmd.type==='string' && s.cmd.type.length<72;
  }
  if(s.t==='invoke'){
    const funcs=new Set([
      'addToProductionQueue','declareWar','makePeace','signArmistice',
      'proposeDiplomaticSettlement','acceptDiplomaticOffer','rejectDiplomaticOffer',
      'counterDiplomaticOffer','formAlliance','leaveAlliance','addTradeRoute',
      'signTradeAgreement','cancelTradeRoute','cancelTradeAgreement',
      'purchasePatronageGreatPeopleBoost','allocateLeaderAttributePoint',
      'upgradeTownToCity','buildSettlementDistrict','setDistrictSpecialists',
      'resolveCityGrowthEvent','applyInfluenceDiplomacyAction','applyIndependentPowerAction',
      'appointUnitCommander','assignUnitCommander','unassignUnitCommander',
      'activateCommander','startCivicResearch','setCivilizationGovernment','recruitSpy',
    ]);
    return funcs.has(s.fn) && !!s.args && typeof s.args==='object' && !Array.isArray(s.args);
  }
  return false;
}

async function dispatch(request,env) {
  const origin=request.headers.get('Origin')||'';
  if(request.method==='OPTIONS')
    return new Response(null,{status:204,headers:headers(origin)});
  if(origin && !ALLOWED_ORIGINS.has(origin))
    return fail('Origin not permitted',403,'origin_forbidden',origin);
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,'')||'/';
  if(path==='/v2/health'&&request.method==='GET'){
    return json({ok:true,service:'gnozian-remastered-mp',gameVersion:GAME_VERSION,protocol:2,
      dataAuthority:'turn-log',rulesAuthority:'client-replay-pending-server-port'},200,origin);
  }
  if(path==='/v2/matches'&&request.method==='POST'){
    const input=await body(request);
    const maxPlayers=Number(input.maxPlayers||4);
    if(!Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>16)
      return fail('maxPlayers must be 2 to 16',400,'invalid_player_count',origin);
    const label=toString(input.label,72)||'Gnozian match';
    const displayName=toString(input.displayName,48)||'Host';
    const seed=Number.isSafeInteger(input.seed)?input.seed:Math.floor(Math.random()*1000000000);
    const matchId=crypto.randomUUID();
    const hostSecret=randomSecret(),playerSecret=randomSecret();
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO matches (id,label,max_players,game_version,host_secret_hash,seed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(matchId,label,maxPlayers,GAME_VERSION,await digest(hostSecret),seed,now,now),
      env.DB.prepare('INSERT INTO seats (match_id,slot,display_name,token_hash,ready,joined_at,last_seen) VALUES (?,?,?,?,?,?,?)').bind(matchId,0,displayName,await digest(playerSecret),1,now,now),
    ]);
    return json({ok:true,matchId,hostToken:hostSecret,playerToken:playerSecret,civSlot:0,
      maxPlayers,gameVersion:GAME_VERSION,seed},201,origin);
  }
  const matchRoute=path.match(/^\/v2\/matches\/([a-f0-9-]{36})(?:\/([a-z_-]+))?$/);
  if(!matchRoute)return fail('Not found',404,'not_found',origin);
  const id=matchRoute[1],action=matchRoute[2]||'';
  if(!validId(id))return fail('Invalid match ID',400,'invalid_id',origin);
  const match=await readMatch(env.DB,id);
  if(!match)return fail('Match not found',404,'not_found',origin);

  if(action==='join'&&request.method==='POST'){
    if(match.status!=='lobby')return fail('Match already started',409,'not_lobby',origin);
    const input=await body(request);
    const name=toString(input.displayName,48);
    if(name.length<2)return fail('Name too short',400,'invalid_name',origin);
    const seats=await env.DB.prepare('SELECT slot FROM seats WHERE match_id=? ORDER BY slot').bind(id).all();
    const used=new Set(seats.results.map(x=>x.slot));
    let slot=-1;
    for(let s=0;s<match.max_players;s++){if(!used.has(s)){slot=s;break;}}
    if(slot<0)return fail('Lobby is full',409,'lobby_full',origin);
    const secret=randomSecret(),now=Date.now();
    try{
      await execute(env.DB,'INSERT INTO seats (match_id,slot,display_name,token_hash,joined_at,last_seen) VALUES (?,?,?,?,?,?)',id,slot,name,await digest(secret),now,now);
    }catch{return fail('Seat conflict; retry join',409,'seat_conflict',origin);}
    return json({ok:true,matchId:id,civSlot:slot,playerToken:secret,gameVersion:match.game_version},201,origin);
  }
  const actor=await session(env.DB,id,request);
  const host=await hasHost(env.DB,match,request);
  if(!actor&&!host)return fail('Invalid player or host token',401,'unauthorized',origin);

  if(!action&&request.method==='GET'){
    const seats=await env.DB.prepare('SELECT slot,display_name,ready,joined_at FROM seats WHERE match_id=? ORDER BY slot').bind(id).all();
    return json({ok:true,...publicMatch(match,seats.results),yourSlot:actor?.slot??null,
      youAreHost:host},200,origin);
  }
  if(action==='ready'&&request.method==='POST'){
    if(!actor)return fail('Player token required',403,'player_only',origin);
    if(match.status!=='lobby')return fail('Match already started',409,'not_lobby',origin);
    const input=await body(request);
    if(typeof input.ready!=='boolean')return fail('Expected ready boolean',400,'invalid_ready',origin);
    await execute(env.DB,'UPDATE seats SET ready=?, last_seen=? WHERE match_id=? AND slot=?',
      input.ready?1:0,Date.now(),id,actor.slot);
    return json({ok:true,civSlot:actor.slot,ready:input.ready},200,origin);
  }
  if(action==='start'&&request.method==='POST'){
    if(!host)return fail('Host token required',403,'host_only',origin);
    if(match.status!=='lobby')return fail('Match already started',409,'not_lobby',origin);
    const seats=await env.DB.prepare('SELECT slot,ready FROM seats WHERE match_id=? ORDER BY slot').bind(id).all();
    if(seats.results.length<2)return fail('Need at least two players',409,'not_enough_players',origin);
    if(seats.results.some(x=>!x.ready))return fail('Not all players are ready',409,'not_ready',origin);
    const input=await body(request);
    if(!input.settings||typeof input.settings!=='object'||Array.isArray(input.settings))
      return fail('Missing game settings',400,'invalid_settings',origin);
    const settings=JSON.stringify(input.settings);
    if(settings.length>12000)return fail('Settings too large',413,'settings_too_large',origin);
    if(input.settings.seed!==match.seed)return fail('Settings seed must match lobby seed',400,'seed_mismatch',origin);
    const current=seats.results[0].slot;
    const result=await execute(env.DB,
      "UPDATE matches SET status='playing',settings_json=?,current_slot=?,updated_at=? WHERE id=? AND status='lobby'",
      settings,current,Date.now(),id);
    if(!result.meta.changes)return fail('Match start conflict',409,'conflict',origin);
    return json({ok:true,matchId:id,status:'playing',currentSlot:current,stateVersion:0},200,origin);
  }
  if(action==='turns'&&request.method==='GET'){
    const after=Math.max(0,Math.min(1000000,Number(url.searchParams.get('after')||0)||0));
    const steps=await env.DB.prepare('SELECT version,actor_slot,turn_number,operations_json,digest,created_at FROM turns WHERE match_id=? AND version>? ORDER BY version LIMIT 100').bind(id,after).all();
    return json({ok:true,matchId:id,stateVersion:match.state_version,turn:match.turn,
      currentSlot:match.current_slot,operations:steps.results.map(s=>({version:s.version,
      actorSlot:s.actor_slot,turn:s.turn_number,steps:JSON.parse(s.operations_json),
      digest:s.digest,createdAt:s.created_at}))},200,origin);
  }
  if(action==='turns'&&request.method==='POST'){
    if(!actor)return fail('Player token required',403,'player_only',origin);
    if(match.status!=='playing')return fail('Match not playing',409,'not_playing',origin);
    if(actor.slot!==match.current_slot)return fail('Not your turn',403,'wrong_turn',origin);
    const input=await body(request);
    if(!Number.isInteger(input.clientVersion)||input.clientVersion<0)
      return fail('Invalid client version',400,'invalid_version',origin);
    if(input.clientVersion!==match.state_version)
      return json({ok:false,error:'Version conflict',code:'stale_version',serverVersion:match.state_version},409,origin);
    if(!Array.isArray(input.steps)||input.steps.length>MAX_STEPS||input.steps.some(s=>!isSafeStep(s)))
      return fail('Invalid turn operations',400,'invalid_operations',origin);
    if(typeof input.digest!=='string'||!/^[a-f0-9]{64}$/i.test(input.digest))
      return fail('Expected state checksum',400,'invalid_digest',origin);
    const seats=await env.DB.prepare('SELECT slot FROM seats WHERE match_id=? ORDER BY slot').bind(id).all();
    const slots=seats.results.map(x=>x.slot);
    const position=slots.indexOf(actor.slot);
    const nextSlot=slots[(position+1)%slots.length];
    const nextTurn=match.turn+(nextSlot<=actor.slot?1:0);
    // Optimistic conditional update serializes competing requests for this match.
    const now=Date.now();
    const commit=await execute(env.DB,
      "UPDATE matches SET state_version=state_version+1,current_slot=?,turn=?,updated_at=? WHERE id=? AND status='playing' AND state_version=? AND current_slot=?",
      nextSlot,nextTurn,now,id,match.state_version,actor.slot);
    if(commit.meta.changes!==1)return fail('Concurrent update; reload match',409,'stale_version',origin);
    const version=match.state_version+1;
    await execute(env.DB,'INSERT INTO turns (match_id,version,actor_slot,turn_number,operations_json,digest,created_at) VALUES (?,?,?,?,?,?,?)',
      id,version,actor.slot,match.turn,JSON.stringify(input.steps),input.digest,now);
    return json({ok:true,matchId:id,stateVersion:version,currentSlot:nextSlot,turn:nextTurn},200,origin);
  }
  if(action==='chat'&&request.method==='GET'){
    const after=Math.max(0,Number(url.searchParams.get('after')||0)||0);
    const rows=await env.DB.prepare('SELECT id,actor_slot,message,created_at FROM chat WHERE match_id=? AND id>? ORDER BY id LIMIT 50').bind(id,after).all();
    return json({ok:true,messages:rows.results.map(x=>({id:x.id,civSlot:x.actor_slot,
      text:x.message,createdAt:x.created_at}))},200,origin);
  }
  if(action==='chat'&&request.method==='POST'){
    if(!actor)return fail('Player token required',403,'player_only',origin);
    const input=await body(request),message=toString(input.message,400);
    if(!message)return fail('Message empty',400,'invalid_message',origin);
    await execute(env.DB,'INSERT INTO chat (match_id,actor_slot,message,created_at) VALUES (?,?,?,?)',id,actor.slot,message,Date.now());
    return json({ok:true},201,origin);
  }
  return fail('Not found',404,'not_found',origin);
}
export default {
  async fetch(request,env){
    try{return await dispatch(request,env);}
    catch(e){
      const origin=request.headers.get('Origin')||'';
      if(e instanceof SyntaxError)return fail('Invalid JSON',400,'invalid_json',origin);
      if(e?.message==='payload_too_large')return fail('Request too large',413,'payload_too_large',origin);
      console.error('Gnozian API failure',e);
      return fail('Internal server error',500,'server_error',origin);
    }
  }
};
