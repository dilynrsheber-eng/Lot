import test from 'node:test';import assert from 'node:assert/strict';import {openStore} from '../store.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('sold retention respects 30 days, restore, active trips, and keeps basic unit/reference photo',()=>{
  const store=openStore(':memory:');try{
    const make=n=>store.create({year:'2020',make:'Demo',model:'Retention',color:'White',stockNumber:`RET-${n}`,vin:`1HGCM82633A00435${n}`,photoData:image});
    const input={employee:'Demo',reason:'Service',photoData:image};
    const a=make(1),b=make(2),c=make(3);const trip=store.event(a.id,'departure',input);
    assert.throws(()=>store.setSold(a.id,{sold:true,version:a.version}),/return/);
    store.point(trip.tripId,{latitude:33,longitude:-112,accuracy:5,recordedAt:new Date().toISOString()});store.event(a.id,'return',{...input,tripId:trip.tripId});
    const aSold=store.setSold(a.id,{sold:true,version:a.version});assert.ok(aSold.soldAt);assert.throws(()=>store.setSold(a.id,{sold:false,version:a.version}),/changed/);
    assert.throws(()=>store.event(a.id,'departure',input),/Restore/);
    const bTrip=store.event(b.id,'departure',input);store.event(b.id,'return',{...input,tripId:bTrip.tripId});const bSold=store.setSold(b.id,{sold:true,version:b.version});store.setSold(b.id,{sold:false,version:bSold.version});
    store.event(c.id,'departure',input);
    assert.equal(store.purgeSoldHistory(Date.now()+29*86400000).purged,0);assert.equal(store.events(a.id).length,2);
    assert.equal(store.purgeSoldHistory(Date.now()+31*86400000).purged,1);assert.equal(store.events(a.id).length,0);assert.equal(store.points(trip.tripId).length,0);assert.equal(store.getTripPhoto(trip.id),undefined);
    assert.ok(store.get(a.id).historyPurgedAt);assert.ok(store.getPhoto(a.id));assert.equal(store.events(b.id).length,2);assert.ok(store.active(c.id));
    assert.equal(store.purgeSoldHistory(Date.now()+32*86400000).purged,0);
    const restored=store.setSold(a.id,{sold:false,version:store.get(a.id).version});assert.equal(restored.soldAt,null);assert.equal(store.events(a.id).length,0);
    store.event(a.id,'departure',input);
  }finally{store.close();}
});
