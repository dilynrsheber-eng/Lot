import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUnit, searchUnits, readUnits, saveUnits } from '../domain.mjs';
const valid = { year:'2025', make:'Winnebago', model:'View', color:'White', stockNumber:'frv-1', vin:'1hgcm82633a004352' };
test('six required fields and VIN format', () => { assert.equal(Object.keys(validateUnit({}).errors).length,6); assert.equal(validateUnit({...valid, vin:'INVALID'}).errors.vin.startsWith('Enter 17'),true); assert.ok(validateUnit({...valid, year:'abcd'}).errors.year); });
test('normalizes, rejects duplicates, allows own edit', () => { const {unit, errors} = validateUnit(valid); assert.deepEqual(errors,{}); assert.equal(unit.stockNumber,'FRV-1'); const units = [{...unit,id:'a'}]; assert.ok(validateUnit(valid,units).errors.vin); assert.deepEqual(validateUnit(valid,units,'a').errors,{}); });
test('search matches all six fields without case sensitivity', () => { const unit = validateUnit(valid).unit; for (const value of Object.values(unit)) assert.equal(searchUnits([unit],value.toLowerCase()).length,1); assert.equal(searchUnits([unit],'no match').length,0); });
test('storage round trip and damaged data protection', () => { let value = null; const storage = { getItem:()=>value, setItem:(_,v)=>value=v }; assert.deepEqual(readUnits(storage),[]); const units = [{...validateUnit(valid).unit,id:'a'}]; saveUnits(storage,units); assert.deepEqual(readUnits(storage),units); value='{}'; assert.throws(()=>readUnits(storage)); value='invalid'; assert.throws(()=>readUnits(storage)); });
