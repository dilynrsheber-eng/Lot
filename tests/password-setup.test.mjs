import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { createAuth, setupAuth } from '../auth.mjs';

test('password setup requires code and account, revokes sessions, and cannot replay after restart', async()=>{
  const dir=mkdtempSync(join(fileURLToPath(new URL('../../../work/',import.meta.url)),'lot-rot-password-'));
  const path=join(dir,'account.json'),email='owner@example.com',old=setupAuth(path,email),code='test-code-with-long-random-secret';
  const setup=JSON.stringify({tokenHash:createHash('sha256').update(code).digest('hex'),expiresAt:Date.now()+60000});
  let server,base;
  async function start(configuration=setup){const auth=createAuth(path,configuration);server=http.createServer(async(req,res)=>{if(!await auth(req,res)){res.writeHead(200);res.end('Protected');}});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  const stop=()=>new Promise(resolve=>server.close(resolve));
  const post=(route,body,origin=base)=>fetch(base+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'});
  const body={email,code,password:'my-new-password-123',confirm:'my-new-password-123'};
  await start();try {
    const login=await post('/login',{email,password:old});const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.match(await(await fetch(base+'/')).text(),/Create or reset password/);
    assert.equal((await post('/create-password',body,'https://other.example')).status,403);
    assert.equal((await post('/create-password',{...body,code:'wrong'})).status,401);
    assert.equal((await post('/create-password',{...body,email:'stranger@example.com'})).status,401);
    assert.equal((await post('/create-password',{...body,confirm:'different'})).status,422);
    assert.equal((await post('/create-password',body)).status,200);
    assert.equal((await fetch(base+'/api/data',{headers:{Cookie:cookie}})).status,401);
    await stop();await start();
    assert.equal((await post('/create-password',body)).status,401);
    assert.equal((await post('/login',{email,password:old})).status,401);
    assert.equal((await post('/login',{email,password:body.password})).status,303);
    await stop();await start(JSON.stringify({tokenHash:'a'.repeat(64),expiresAt:Date.now()-1}));
    assert.equal((await post('/create-password',body)).status,401);
  } finally {await stop();rmSync(dir,{recursive:true,force:true});}
});
