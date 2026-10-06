import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { matchLocation } from '../geofence.mjs';
import { openStore } from '../store.mjs';
const center={latitude:32.25,longitude:-110.95,radiusMeters:200};
const fix=(extra={})=>({...center,accuracy:10,recordedAt:new Date().toISOString(),...extra});
test('geofence requires fresh accurate GPS confidently inside exactly one boundary',()=>{
 const locations=[{id:'a',...center}];assert.equal(matchLocation(locations,fix()).id,'a');
 for(const p of [fix({accuracy:101}),fix({recordedAt:new Date(Date.now()-180000).toISOString()}),fix({latitude:33}),fix({accuracy:-1}),fix({recordedAt:'bad'})])assert.equal(matchLocation(locations,p),null);
 assert.equal(matchLocation([...locations,{id:'b',...center}],fix()),null);
 assert.equal(matchLocation([{id:'a',...center,radiusMeters:5}],fix()),null);
});
test('completion moves inventory and records source atomically; unmatched GPS needs a manual choice',()=>{
 const dir=mkdtempSync(resolve('work/geofence-')),path=join(dir,'db.sqlite');let store=openStore(path);
 try{
  const a=store.addLocation('Origin'),b=store.addLocation('Destination');store.renameLocation(b.id,b.name,{...center,address:'Example dealership'});
  assert.throws(()=>store.renameLocation(a.id,a.name,{latitude:32,longitude:'',radiusMeters:200}),/both GPS/);
  const unit=store.create({year:'2020',make:'Demo',model:'RV',color:'White',stockNumber:'GEO',vin:'1HGCM82633A004352',locationId:a.id});
  const photoData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',input={employee:'Pat',reason:'Transfer',photoData};
  const departure=store.event(unit.id,'departure',input);
  assert.throws(()=>store.event(unit.id,'return',{...input,tripId:departure.tripId,requireDestination:true,arrivalGps:fix({accuracy:999})}),/Select the arrival/);assert.equal(store.get(unit.id).locationId,a.id);assert.ok(store.active(unit.id));
  const completed=store.event(unit.id,'return',{...input,tripId:departure.tripId,requireDestination:true,arrivalGps:fix()});assert.equal(store.get(unit.id).locationId,b.id);assert.equal(completed.locationChange.from,'Origin');assert.equal(completed.locationChange.to,'Destination');assert.equal(completed.locationChange.method,'gps');
  store.close();store=openStore(path);assert.equal(store.events(unit.id)[1].locationChange.method,'gps');assert.equal(store.get(unit.id).locationId,b.id);
  const next=store.event(unit.id,'departure',input);const manual=store.event(unit.id,'return',{...input,tripId:next.tripId,requireDestination:true,destinationLocationId:a.id});assert.equal(manual.locationChange.method,'manual');assert.equal(store.get(unit.id).locationId,a.id);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
