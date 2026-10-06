import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from '../api-client.mjs';
test('API includes session credentials and reads JSON inventory',async()=>{
  let options;
  const units=await requestJson('/api/units','GET',undefined,async(_,input)=>{options=input;return new Response('[{"id":"a"}]',{headers:{'Content-Type':'application/json'}});});
  assert.equal(options.credentials,'same-origin');assert.equal(options.headers.Accept,'application/json');assert.equal(units[0].id,'a');
});
test('API distinguishes login redirects, non-JSON, timeout and field errors',async()=>{
  const login=new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}});Object.defineProperty(login,'redirected',{value:true});
  await assert.rejects(requestJson('/api/units','GET',undefined,async()=>login),{code:'SIGN_IN'});
  await assert.rejects(requestJson('/api/units','GET',undefined,async()=>new Response('Bad gateway',{status:502,headers:{'Content-Type':'text/html'}})),{code:'NON_JSON'});
  await assert.rejects(requestJson('/api/units','GET',undefined,async()=>{throw new DOMException('timeout','TimeoutError');}),{code:'NETWORK'});
  await assert.rejects(requestJson('/api/units','POST',{},async()=>new Response(JSON.stringify({message:'Invalid VIN',errors:{vin:'Invalid'}}),{status:422,headers:{'Content-Type':'application/json'}})),{status:422,errors:{vin:'Invalid'}});
});
test('a redirected successful JSON save is not mistaken for expired sign-in',async()=>{
  const response=new Response('{"id":"saved-unit"}',{status:201,headers:{'Content-Type':'application/json'}});
  Object.defineProperty(response,'redirected',{value:true});
  assert.equal((await requestJson('/api/units','POST',{},async()=>response)).id,'saved-unit');
});
