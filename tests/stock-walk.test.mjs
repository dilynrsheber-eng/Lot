import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { openStore } from '../store.mjs';
import { qrUnitId } from '../stock-walk.mjs';
test('stock walk updates only scanned units, deduplicates, remembers employee and completion across restart',()=>{
 const dir=mkdtempSync(resolve('work/stock-walk-')),path=join(dir,'db.sqlite');let store=openStore(path);const employee={id:'pat',name:'Pat',role:'employee'};
 try{
  const origin=store.addLocation('Origin'),destination=store.addLocation('Destination');const record={year:'2020',make:'Demo',model:'RV',color:'White',stockNumber:'WALK1',vin:'1HGCM82633A004352',locationId:origin.id};const a=store.create(record),b=store.create({...record,stockNumber:'WALK2',vin:'1HGCM82633A004353'});
  assert.throws(()=>store.startWalk('other-company',employee),/your dealership/);const walk=store.startWalk(destination.id,employee);
  assert.throws(()=>store.scanWalk(walk.id,a.id,{id:'other',role:'employee'}),/another employee/);
  const result=store.scanWalk(walk.id,a.id,employee);assert.equal(result.unit.locationId,destination.id);assert.equal(result.walk.scans.length,1);assert.equal(result.walk.scans[0].previousLocation,'Origin');assert.equal(result.walk.employeeName,'Pat');assert.equal(store.get(b.id).locationId,origin.id);
  const duplicate=store.scanWalk(walk.id,a.id,employee);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.unit.version,result.unit.version);assert.equal(duplicate.walk.scans.length,1);
  assert.throws(()=>store.scanWalk(walk.id,'wrong-unit',employee),/your dealership/);
  store.setSold(b.id,{sold:true,version:b.version});assert.throws(()=>store.scanWalk(walk.id,b.id,employee),/marked sold/);
  store.completeWalk(walk.id,employee);assert.throws(()=>store.scanWalk(walk.id,a.id,employee),/complete/);
  store.close();store=openStore(path);assert.ok(store.ownWalk(walk.id,employee).completedAt);assert.equal(store.walk(walk.id).scans.length,1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('stock walk decoder accepts saved-unit tags and rejects unrelated or unsafe QR codes',()=>{
 const id='b54f0c10-1e43-418d-b8b1-f98cd18c5622';assert.equal(qrUnitId('https://lotrotapp.com/#unit/'+id),id);
 for(const value of ['javascript:alert(1)','https://lotrotapp.com/#home','not a URL','https://lotrotapp.com/#unit/not-an-id'])assert.equal(qrUnitId(value),null);
});
