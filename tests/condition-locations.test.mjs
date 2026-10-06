import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { openStore } from '../store.mjs';
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const angles=['driverFront','passengerFront','passengerRear','driverRear'];
test('four photos are atomic, immutable, survive restart and follow sold retention; locations persist and rename',()=>{
 const dir=mkdtempSync(resolve('work/condition-locations-')),path=join(dir,'db.sqlite');let store=openStore(path);
 try{
  store.seedLocations(['SV2','Irvington','Ina']);const sv=store.locations().find(l=>l.name==='SV2');
  const record={year:'2020',make:'Demo',model:'RV',color:'White',stockNumber:'FOUR',vin:'1HGCM82633A004352',locationId:sv.id};const unit=store.create(record);
  assert.equal(unit.location,'SV2');assert.throws(()=>store.update(unit.id,{...record,version:unit.version,locationId:'other-company'}),/location belonging/);
  store.renameLocation(sv.id,'SV2 renamed');assert.equal(store.get(unit.id).location,'SV2 renamed');store.addLocation('New lot');assert.equal(store.locations().length,4);
  const input={employee:'Pat',reason:'Service',requireFourPhotos:true};
  assert.throws(()=>store.event(unit.id,'departure',{...input,photoData:photo}),/four condition/);
  assert.throws(()=>store.event(unit.id,'departure',{...input,conditionPhotos:{driverFront:photo}}),/four condition/);
  assert.equal(store.events(unit.id).length,0);
  const conditionPhotos=Object.fromEntries(angles.map(a=>[a,photo]));const departure=store.event(unit.id,'departure',{...input,conditionPhotos});assert.equal(departure.conditionPhotos.length,4);
  for(const angle of angles)assert.ok(store.getTripPhoto(departure.id,angle).photo.length);
  assert.throws(()=>store.event(unit.id,'return',{...input,tripId:departure.tripId,conditionPhotos:{...conditionPhotos,driverRear:'bad'}}),/photo/i);assert.ok(store.active(unit.id));
  store.event(unit.id,'return',{...input,tripId:departure.tripId,conditionPhotos});assert.equal(store.active(unit.id),undefined);
  store.close();store=openStore(path);assert.equal(store.events(unit.id)[1].conditionPhotos.length,4);assert.equal(store.get(unit.id).location,'SV2 renamed');store.seedLocations(['SV2']);assert.equal(store.locations().length,4);
  const sold=store.setSold(unit.id,{sold:true,version:store.get(unit.id).version});store.purgeSoldHistory(Date.parse(sold.soldAt)+31*86400000);assert.equal(store.getTripPhoto(departure.id,'driverRear'),undefined);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
