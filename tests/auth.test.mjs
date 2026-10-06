import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { createApp } from '../server.mjs';
import { setupAuth } from '../auth.mjs';
test('authentication protects data, remembers restart, rejects cross-site posts and revokes logout',async()=>{
  const root=fileURLToPath(new URL('../../../work/',import.meta.url));await mkdir(root,{recursive:true});
  const dir=await mkdtemp(join(root,'lot-rot-auth-')),auth=join(dir,'account.json');
  const password=setupAuth(auth,'test@example.com');let server,base;
  const config=JSON.parse(readFileSync(auth,'utf8'));config.company={id:'test-dealership',name:'Freedom RV'};writeFileSync(auth,JSON.stringify(config));
  async function start(){server=createApp(join(dir,'test.sqlite'),auth);server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  async function stop(){await new Promise(resolve=>server.close(resolve));}
  await start();try{
    assert.equal((await fetch(base+'/api/units')).status,401);
    assert.equal((await fetch(base+'/api/photos/unknown')).status,401);
    assert.match(await (await fetch(base+'/')).text(),/Sign in/);
    const login=(pw,origin=base)=>fetch(base+'/login',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:'test@example.com',password:pw})});
    assert.equal((await login(password,'https://elsewhere.example')).status,403);
    assert.equal((await login('wrong')).status,401);
    const response=await login(password);assert.equal(response.status,303);
    const header=response.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/Max-Age=2592000/);
    const cookie=header.split(';')[0];
    const me=await (await fetch(base+'/api/me',{headers:{Cookie:cookie}})).json();assert.equal(me.employee.email,'test@example.com');
    assert.deepEqual(me.company,{id:'test-dealership',name:'Freedom RV'});
    const unit=await (await fetch(base+'/api/units',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({year:'2020',make:'Demo',model:'Identity',color:'White',stockNumber:'IDENTITY-TEST',vin:'1HGCM82633A004352'})})).json();
    const photoData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const event=await (await fetch(base+`/api/units/${unit.id}/trips/departure`,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({employee:'Forged name',employeeId:'forged',employeeEmail:'someone@example.com',reason:'Service',conditionPhotos:Object.fromEntries(['driverFront','passengerFront','passengerRear','driverRear'].map(angle=>[angle,photoData]))})})).json();
    assert.equal(event.employee,'test@example.com');assert.equal(event.employeeId,me.employee.id);assert.equal(event.employeeEmail,me.employee.email);
    assert.equal((await fetch(base+'/api/units',{headers:{Cookie:cookie}})).status,200);
    await stop();await start();
    assert.equal((await fetch(base+'/api/units',{headers:{Cookie:cookie}})).status,200);
    assert.equal((await fetch(base+'/api/units',{headers:{Cookie:cookie+'bad'}})).status,401);
    assert.equal((await fetch(base+'/logout',{method:'POST',redirect:'manual',headers:{Origin:base,Cookie:cookie}})).status,303);
    assert.equal((await fetch(base+'/api/units',{headers:{Cookie:cookie}})).status,401);
  }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
