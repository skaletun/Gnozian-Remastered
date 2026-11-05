import {afterEach,describe,expect,it,vi} from 'vitest';
import {CloudflareMpClient,CloudflareMpError} from './cloudflareApi';
const client=new CloudflareMpClient('https://api.example.com/v2');
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;vi.restoreAllMocks();});
describe('Cloudflare multiplayer client',()=>{
 it('creates match via JSON without leaking token',async()=>{
   const fn=vi.fn().mockResolvedValue({ok:true,status:201,text:async()=>JSON.stringify({ok:true,playerToken:'secret'})});
   globalThis.fetch=fn;
   const result=await client.createMatch({label:'Test',displayName:'Host',maxPlayers:2,seed:41});
   expect(result.playerToken).toBe('secret');
   const [url,options]=fn.mock.calls[0] as [string,RequestInit];
   expect(url).toBe('https://api.example.com/v2/matches');
   expect(options.method).toBe('POST');
   expect((options.headers as Record<string,string>).Authorization).toBeUndefined();
 });
 it('authenticates readiness with bearer token',async()=>{
   const fn=vi.fn().mockResolvedValue({ok:true,status:200,text:async()=>JSON.stringify({ok:true})});
   globalThis.fetch=fn;await client.setReady('match','token',true);
   expect((fn.mock.calls[0][1] as RequestInit).headers).toMatchObject({Authorization:'Bearer token'});
 });
 it('surfaces version conflicts',async()=>{
   globalThis.fetch=vi.fn().mockResolvedValue({ok:false,status:409,text:async()=>JSON.stringify({code:'stale_version',error:'Conflict',serverVersion:5})});
   await expect(client.submitTurn('id','token',{clientVersion:4,steps:[],digest:'a'.repeat(64)})).rejects.toMatchObject({code:'stale_version',serverVersion:5,status:409});
 });
 it('rejects insecure remote endpoints',()=>{
   expect(()=>new CloudflareMpClient('http://example.org')).toThrow('HTTPS');
 });
 it('rejects invalid JSON',async()=>{
   globalThis.fetch=vi.fn().mockResolvedValue({ok:true,status:200,text:async()=>'<html>'});
   await expect(client.health()).rejects.toBeInstanceOf(CloudflareMpError);
 });
});
