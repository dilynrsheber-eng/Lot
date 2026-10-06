import test from 'node:test';
import assert from 'node:assert/strict';
import { gpsMileage } from '../mileage.mjs';
const point=(longitude,seconds,accuracy=5)=>({latitude:0,longitude,accuracy,recordedAt:new Date(seconds*1000).toISOString()});
test('GPS mileage sums recorded travel and distinguishes no capture from zero travel',()=>{
 assert.equal(gpsMileage([]).miles,null);
 assert.equal(gpsMileage([point(0,0)]).miles,null);
 assert.equal(gpsMileage([point(0,0),point(0,10)]).miles,0);
 assert.ok(Math.abs(gpsMileage([point(0,0),point(.01,60)]).miles-.69093)<.001);
});
test('GPS mileage does not bridge gaps, inaccurate fixes or impossible jumps',()=>{
 for(const points of [[point(0,0),point(.01,180)],[point(0,0),point(.01,60,200),point(.02,120)],[point(0,0),point(10,10)]]){
  const result=gpsMileage(points);assert.equal(result.miles,null);assert.equal(result.partial,true);
 }
});
