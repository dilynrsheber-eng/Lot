import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSegments } from '../route-map.mjs';
const p=(longitude,seconds,accuracy=5)=>({latitude:33,longitude,accuracy,recordedAt:new Date(seconds*1000).toISOString()});
test('route lines preserve travel order and split GPS gaps and unreliable locations',()=>{
 assert.deepEqual(routeSegments([]),[]);
 assert.deepEqual(routeSegments([p(-112,0),p(-111.999,10),p(-111.998,180)]).map(s=>s.length),[2,1]);
 assert.deepEqual(routeSegments([p(-112,0),p(-111.999,10,200),p(-111.998,20)]).map(s=>s.length),[1,1]);
 assert.deepEqual(routeSegments([p(-112,0),p(-100,10)]).map(s=>s.length),[1,1]);
 assert.deepEqual(routeSegments([{...p(-112,0),latitude:100}]),[]);
});
