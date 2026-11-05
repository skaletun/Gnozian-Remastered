/** Cloudflare v2 multiplayer transport; independent from legacy PHP API. */
import type { EngineStep } from './mpEngineProtocol';

export const CLOUDFLARE_MP_BASE = 'https://gnozian-remastered-mp.workertink-directory.workers.dev/v2';
export type LobbySeat = {slot:number;displayName:string;ready:boolean;joinedAt:number};
export type CloudflareMatch = {
 ok:true;matchId:string;label:string;status:'lobby'|'playing'|'finished';
 maxPlayers:number;gameVersion:string;seed:number;settings:Record<string,unknown>|null;
 stateVersion:number;currentSlot:number;turn:number;seats:LobbySeat[];
 yourSlot:number|null;youAreHost:boolean;
};
export type CreatedMatch = {ok:true;matchId:string;hostToken:string;playerToken:string;civSlot:number;maxPlayers:number;gameVersion:string;seed:number};
export type JoinedMatch = {ok:true;matchId:string;playerToken:string;civSlot:number;gameVersion:string};
export type TurnEvent = {version:number;actorSlot:number;turn:number;steps:EngineStep[];digest:string;createdAt:number};
export type TurnHistory = {ok:true;matchId:string;stateVersion:number;turn:number;currentSlot:number;operations:TurnEvent[]};
export type MpChat = {id:number;civSlot:number;text:string;createdAt:number};
export class CloudflareMpError extends Error {
 constructor(message:string,readonly status:number,readonly code:string,readonly serverVersion?:number) {
   super(message);this.name='CloudflareMpError';
 }
}
export class CloudflareMpClient {
 constructor(readonly base=CLOUDFLARE_MP_BASE) {
   if(!base.startsWith('https://')&&!base.startsWith('http://localhost:'))throw Error('HTTPS required');
 }
 private async call<T>(path:string,opts:{method?:'GET'|'POST';body?:unknown;token?:string;signal?:AbortSignal}={}):Promise<T> {
   const headers:Record<string,string>={Accept:'application/json','X-Gnozian-Game-Version':'7.0.0'};
   if(opts.body!==undefined)headers['Content-Type']='application/json';
   if(opts.token)headers.Authorization='Bearer '+opts.token;
   const response=await fetch(this.base.replace(/\/+$/,'')+path,{
     method:opts.method||'GET',headers,signal:opts.signal,cache:'no-store',
     body:opts.body===undefined?undefined:JSON.stringify(opts.body)
   });
   let data:unknown;
   try{data=JSON.parse(await response.text());}
   catch{throw new CloudflareMpError('Invalid server JSON',response.status,'invalid_response');}
   if(!data||typeof data!=='object')throw new CloudflareMpError('Invalid response',response.status,'invalid_response');
   if(!response.ok){
     const err=data as {error?:string;code?:string;serverVersion?:number};
     throw new CloudflareMpError(err.error||'Request failed',response.status,err.code||'http_error',err.serverVersion);
   }
   return data as T;
 }
 health(signal?:AbortSignal){return this.call<{ok:true;service:string;protocol:number}>('/health',{signal});}
 createMatch(v:{label:string;displayName:string;maxPlayers:number;seed?:number}){
   return this.call<CreatedMatch>('/matches',{method:'POST',body:v});
 }
 joinMatch(id:string,displayName:string){
   return this.call<JoinedMatch>('/matches/'+encodeURIComponent(id)+'/join',{method:'POST',body:{displayName}});
 }
 getMatch(id:string,token:string,signal?:AbortSignal){
   return this.call<CloudflareMatch>('/matches/'+encodeURIComponent(id),{token,signal});
 }
 setReady(id:string,token:string,ready:boolean){
   return this.call<{ok:true;civSlot:number;ready:boolean}>('/matches/'+encodeURIComponent(id)+'/ready',{method:'POST',token,body:{ready}});
 }
 startMatch(id:string,hostToken:string,settings:Record<string,unknown>){
   return this.call<{ok:true;matchId:string;status:'playing';currentSlot:number;stateVersion:number}>('/matches/'+encodeURIComponent(id)+'/start',{method:'POST',token:hostToken,body:{settings}});
 }
 fetchTurns(id:string,token:string,after=0,signal?:AbortSignal){
   return this.call<TurnHistory>('/matches/'+encodeURIComponent(id)+'/turns?after='+Math.max(0,Math.floor(after)),{token,signal});
 }
 submitTurn(id:string,token:string,payload:{clientVersion:number;steps:EngineStep[];digest:string}){
   return this.call<{ok:true;stateVersion:number;currentSlot:number;turn:number}>('/matches/'+encodeURIComponent(id)+'/turns',{method:'POST',token,body:payload});
 }
 getChat(id:string,token:string,after=0,signal?:AbortSignal){
   return this.call<{ok:true;messages:MpChat[]}>('/matches/'+encodeURIComponent(id)+'/chat?after='+Math.max(0,Math.floor(after)),{token,signal});
 }
 postChat(id:string,token:string,message:string){
   return this.call<{ok:true}>('/matches/'+encodeURIComponent(id)+'/chat',{method:'POST',token,body:{message}});
 }
}
export const cloudflareMp = new CloudflareMpClient();
