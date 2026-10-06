import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { openStore } from '../store.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('atomic departure/return, immutable photos/history, GPS lifecycle and durable corrections',()=>{
  const root=fileURLToPath(new URL('../../../work/',import.meta.url));mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'lot-rot-trips-')),path=join(dir,'test.sqlite');let store=openStore(path);
  try{
    const unit=store.create({year:'2020',make:'Demo',model:'Trip',color:'White',stockNumber:'TRIP-TEST',vin:'1HGCM82633A004352'});
    assert.throws(()=>store.event(unit.id,'departure',{employee:'Employee',reason:'Service'}),/photo is required/);
    assert.equal(store.events(unit.id).length,0);
    const input={employee:'Employee',reason:'Service',notes:'Existing scratch',photoData:image};
    const departure=store.event(unit.id,'departure',input);
    assert.throws(()=>store.event(unit.id,'departure',input),/active trip/);
    assert.throws(()=>store.point(departure.tripId,{latitude:100,longitude:0,accuracy:5,recordedAt:new Date().toISOString()}),/Invalid GPS/);
    store.point(departure.tripId,{latitude:33,longitude:-112,accuracy:5,recordedAt:new Date().toISOString()});
    assert.throws(()=>store.event(unit.id,'return',{...input,tripId:'wrong'}),/Refresh/);
    store.event(unit.id,'return',{...input,tripId:departure.tripId});
    assert.equal(store.active(unit.id),undefined);
    assert.throws(()=>store.point(departure.tripId,{latitude:33,longitude:-112,accuracy:5,recordedAt:new Date().toISOString()}),/not active/);
    assert.throws(()=>store.event(unit.id,'return',{...input,tripId:departure.tripId}),/Refresh/);
    store.event(unit.id,'note',{employee:'Reviewer',notes:'Correction: scratch on left side',tripId:departure.tripId});
    assert.equal(store.events(unit.id)[0].notes,'Existing scratch');
    const direct=new DatabaseSync(path);for(const table of ['trip_events','trip_points']){assert.throws(()=>direct.exec(`DELETE FROM ${table}`),/append-only|no such function/);assert.throws(()=>direct.exec(`UPDATE ${table} SET id='changed'`),/append-only/);}direct.close();
    store.close();store=openStore(path);assert.equal(store.events(unit.id).length,3);assert.equal(store.points(departure.tripId).length,1);assert.ok(store.getTripPhoto(departure.id).photo.length);
    store.event(unit.id,'departure',input);assert.ok(store.active(unit.id));
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

