import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { setupAuth } from '../auth.mjs';

test('dealership isolation, administrator invitations, locked employee identity and durable sessions',async()=>{
 const dir=await mkdtemp(resolve('work/dealership-test-')),auth=join(dir,'account.json'),db=join(dir,'inventory.sqlite');
 const password=setupAuth(auth,'owner@example.com');let server,base;
 const start=async()=>{server=createApp(db,auth,{dealerships:true});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;};
 const stop=()=>new Promise(r=>server.close(r));
 const post=(path,body,cookie='',json=false)=>fetch(base+path,{method:'POST',redirect:'manual',headers:{Origin:base,Cookie:cookie,'Content-Type':json?'application/json':'application/x-www-form-urlencoded'},body:json?JSON.stringify(body):new URLSearchParams(body)});
 const login=async(email,pw)=>{const r=await post('/login',{email,password:pw});assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];};
 const get=(path,cookie)=>fetch(base+path,{headers:{Cookie:cookie}});
 await start();try{
  const owner=await login('owner@example.com',password),me=await (await get('/api/me',owner)).json();assert.equal(me.company.name,'Freedom RV');assert.equal(me.employee.role,'admin');
  const p='Example password 12345';assert.equal((await post('/register',{company:'Second RV',name:'Second Admin',email:'second@example.com',password:p,confirm:p})).status,201);
  const second=await login('second@example.com',p);
  const record={year:'2020',make:'Demo',model:'RV',color:'White',stockNumber:'SAME-1',vin:'1HGCM82633A004352'};
  const a=await (await post('/api/units',record,owner,true)).json(),b=await (await post('/api/units',record,second,true)).json();assert.ok(a.id);assert.ok(b.id);assert.notEqual(a.id,b.id);
  assert.equal((await get('/api/units/'+a.id,second)).status,404);assert.equal((await get('/api/photos/'+a.id,second)).status,404);assert.equal((await (await get('/api/units',second)).json()).length,1);
  const invite=await post('/team',{name:'Pat Employee',email:'pat@example.com',role:'employee'},owner);const code=(await invite.text()).match(/<code>([^<]+)<\/code>/)[1];
  assert.equal((await post('/join',{email:'wrong@example.com',code,password:p,confirm:p})).status,401);
  assert.equal((await post('/join',{email:'pat@example.com',code,password:p,confirm:p})).status,200);
  assert.equal((await post('/join',{email:'pat@example.com',code,password:p,confirm:p})).status,401);
  const employee=await login('pat@example.com',p);assert.equal((await get('/team',employee)).status,403);assert.equal((await post('/api/units',record,employee,true)).status,403);
  const photoData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const trip=await (await post(`/api/units/${a.id}/trips/departure`,{employee:'Forged',reason:'Service',photoData},employee,true)).json();assert.equal(trip.employee,'Pat Employee');assert.equal(trip.employeeEmail,'pat@example.com');
  assert.equal((await get('/api/trip-photos/'+trip.id,second)).status,404);
  const otherHistory=await (await get(`/api/units/${a.id}/trips`,second)).json();assert.deepEqual(otherHistory.events,[]);
  assert.equal((await post('/team',{name:'Other',email:'pat@example.com'},second)).status,409);
  const inviteAdmin=await post('/team',{name:'Co Admin',email:'co@example.com',role:'admin'},owner);const adminCode=(await inviteAdmin.text()).match(/<code>([^<]+)<\/code>/)[1];
  assert.equal((await post('/join',{email:'co@example.com',code:adminCode,password:p,confirm:p})).status,200);
  const co=await login('co@example.com',p);assert.equal((await get('/team',co)).status,200);
  await stop();await start();assert.equal((await get('/api/units',employee)).status,200);assert.equal((await get('/api/units/'+a.id,second)).status,404);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
