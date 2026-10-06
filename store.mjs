import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateUnit, FIELDS } from './domain.mjs';
export class StoreError extends Error {
  constructor(status, message, errors = {}) { super(message); this.status = status; this.errors = errors; }
}
export function openStore(path) {
  mkdirSync(dirname(path), { recursive:true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, year TEXT NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL, color TEXT NOT NULL,
      stockNumber TEXT NOT NULL COLLATE NOCASE UNIQUE, vin TEXT NOT NULL COLLATE NOCASE UNIQUE,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);`);
  const columns = db.prepare('PRAGMA table_info(units)').all().map(c=>c.name);
  db.exec(`CREATE TABLE IF NOT EXISTS trip_events(id TEXT PRIMARY KEY, unitId TEXT NOT NULL REFERENCES units(id), tripId TEXT NOT NULL, kind TEXT NOT NULL, employee TEXT NOT NULL, reason TEXT NOT NULL, notes TEXT NOT NULL, createdAt TEXT NOT NULL, photo BLOB, photoType TEXT);
    CREATE TABLE IF NOT EXISTS trip_points(id TEXT PRIMARY KEY,tripId TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,accuracy REAL NOT NULL,recordedAt TEXT NOT NULL,receivedAt TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_departure ON trip_events(tripId) WHERE kind='departure';
    CREATE UNIQUE INDEX IF NOT EXISTS one_return ON trip_events(tripId) WHERE kind='return';`);
  let retentionMode=false;db.function('retention_allowed',()=>retentionMode ? 1 : 0);
  db.exec('CREATE TABLE IF NOT EXISTS condition_photos(eventId TEXT NOT NULL, angle TEXT NOT NULL, photo BLOB NOT NULL, photoType TEXT NOT NULL, PRIMARY KEY(eventId,angle)); CREATE TABLE IF NOT EXISTS locations(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);');
  for(const table of ['trip_events','trip_points','condition_photos']) {
    db.exec(`DROP TRIGGER IF EXISTS ${table}_delete; CREATE TRIGGER IF NOT EXISTS ${table}_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Trip history is append-only'); END;`);
    db.exec(`CREATE TRIGGER ${table}_delete BEFORE DELETE ON ${table} WHEN retention_allowed()=0 BEGIN SELECT RAISE(ABORT,'Trip history is append-only'); END;`);
  }
  const eventColumns=db.prepare('PRAGMA table_info(trip_events)').all().map(c=>c.name);
  if(!eventColumns.includes('employeeId'))db.exec('ALTER TABLE trip_events ADD COLUMN employeeId TEXT; ALTER TABLE trip_events ADD COLUMN employeeEmail TEXT;');
  if (!columns.includes('photo')) db.exec('ALTER TABLE units ADD COLUMN photo BLOB; ALTER TABLE units ADD COLUMN photoType TEXT;');
  if(!columns.includes('soldAt'))db.exec('ALTER TABLE units ADD COLUMN soldAt TEXT;');
  if(!columns.includes('historyPurgedAt'))db.exec('ALTER TABLE units ADD COLUMN historyPurgedAt TEXT;');
  if(!columns.includes('locationId'))db.exec('ALTER TABLE units ADD COLUMN locationId TEXT;');
  const locations=()=>db.prepare('SELECT id,name FROM locations ORDER BY name COLLATE NOCASE').all();
  const addLocation=name=>{name=typeof name==='string'?name.trim():'';if(!name||name.length>100)throw new StoreError(422,'Enter a location name up to 100 characters.');const found=locations().find(l=>l.name.toLowerCase()===name.toLowerCase());if(found)return found;const id=randomUUID();db.prepare('INSERT INTO locations VALUES (?,?)').run(id,name);return {id,name};};
  const renameLocation=(id,name)=>{if(!locations().some(l=>l.id===id))throw new StoreError(404,'Location not found.');name=typeof name==='string'?name.trim():'';if(!name||name.length>100)throw new StoreError(422,'Enter a location name up to 100 characters.');if(locations().some(l=>l.id!==id&&l.name.toLowerCase()===name.toLowerCase()))throw new StoreError(409,'That location name already exists.');db.prepare('UPDATE locations SET name=? WHERE id=?').run(name,id);return {id,name};};
  const seedLocations=names=>{if(!db.prepare("SELECT value FROM settings WHERE key='locations-seeded'").get()){for(const name of names)addLocation(name);db.prepare("INSERT INTO settings VALUES ('locations-seeded','1')").run();}};
  const locationOf=(input,old)=>{const id=input.locationId===undefined?(old?.locationId||null):input.locationId||null;if(id&&!locations().some(l=>l.id===id))throw new StoreError(422,'Choose a location belonging to this dealership.',{locationId:'Choose an existing dealership location.'});return id;};
  const select = 'locationId,id,year,make,model,color,stockNumber,vin,createdAt,updatedAt,version,photoType,soldAt,historyPurgedAt';
  const decorate = u => u ? {...u,location:locations().find(l=>l.id===u.locationId)?.name || '',photoUrl:u.photoType ? `/api/photos/${u.id}?v=${u.version}` : null} : undefined;
  const list = () => db.prepare(`SELECT ${select} FROM units ORDER BY createdAt DESC, id`).all().map(decorate);
  const get = id => decorate(db.prepare(`SELECT ${select} FROM units WHERE id = ?`).get(id));
  function photo(input) {
    if (input.photoData === undefined) return null;
    const match = typeof input.photoData === 'string' && input.photoData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new StoreError(422,'Choose a JPEG, PNG, or WebP reference photo.',{photo:'Unsupported photo format.'});
    const bytes=Buffer.from(match[2],'base64');
    if (bytes.length>5*1024*1024 || bytes.length<20) throw new StoreError(422,'Reference photo must be a valid image up to 5 MB.',{photo:'Choose an image up to 5 MB.'});
    const valid=match[1]==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes.at(-2)===255 && bytes.at(-1)===217 : match[1]==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.subarray(-8,-4).toString()==='IEND' : bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP' && bytes.readUInt32LE(4)+8===bytes.length;
    if (!valid || bytes.toString('base64')!==match[2]) throw new StoreError(422,'Photo content does not match its image type.',{photo:'Invalid image file.'});
    return {bytes,type:match[1]};
  }
  function validate(input, id) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StoreError(400,'Send a vehicle record.');
    const { unit, errors } = validateUnit(input,list(),id);
    const limits = {year:4,make:60,model:100,color:60,stockNumber:40,vin:17};
    for (const k of FIELDS) if (typeof input[k] !== 'string' || unit[k].length > limits[k]) errors[k] = `Enter text up to ${limits[k]} characters.`;
    if (Object.keys(errors).length) throw new StoreError(422,'Check the vehicle fields.',errors);
    return unit;
  }
  function create(input, preservedId) {
    const unit = validate(input);
    const image = photo(input),locationId=locationOf(input);
    const id = preservedId || randomUUID(), now = new Date().toISOString();
    db.prepare('INSERT INTO units (id,year,make,model,color,stockNumber,vin,createdAt,updatedAt,photo,photoType,locationId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,...FIELDS.map(k=>unit[k]),now,now,image?.bytes || null,image?.type || null,locationId);
    return get(id);
  }
  function update(id,input) {
    const old = get(id);
    if (!old) throw new StoreError(404,'Unit not found.');
    if (!input || input.version !== old.version) throw new StoreError(409,'Another device changed this unit. Open the latest details before editing again.');
    const unit = validate(input,id);
    const image=photo(input),locationId=locationOf(input,old);
    db.prepare(`UPDATE units SET year=?,make=?,model=?,color=?,stockNumber=?,vin=?,locationId=?,updatedAt=?,version=version+1 ${image ? ',photo=?,photoType=?' : ''} WHERE id=?`).run(...FIELDS.map(k=>unit[k]),locationId,new Date().toISOString(),...(image ? [image.bytes,image.type] : []),id);
    return get(id);
  }
  function importUnits(records) {
    if (!Array.isArray(records) || records.length > 500) throw new StoreError(400,'Import up to 500 records at a time.');
    db.exec('BEGIN IMMEDIATE');
    let imported=0, skipped=0;
    try {
      for (const input of records) {
        if (!input || !/^[a-f0-9-]{36}$/i.test(input.id || '')) throw new StoreError(422,'An old record has an invalid ID. Nothing was imported.');
        const matches = list().filter(u=>u.id===input.id || u.vin===String(input.vin).trim().toUpperCase() || u.stockNumber===String(input.stockNumber).trim().toUpperCase());
        if (matches.length) {
          if (matches.length===1 && FIELDS.every(k=>String(input[k] ?? '').trim().toUpperCase()===matches[0][k].toUpperCase()) && matches[0].id===input.id) { skipped++; continue; }
          throw new StoreError(409,`Import conflict for stock ${String(input.stockNumber).slice(0,40)}. Nothing was imported; local records are unchanged.`);
        }
        create(input,input.id); imported++;
      }
      db.exec('COMMIT'); return {imported,skipped};
    } catch(error) { db.exec('ROLLBACK'); throw error; }
  }
  const events=unitId=>db.prepare('SELECT id,unitId,tripId,kind,employee,employeeId,employeeEmail,reason,notes,createdAt,photoType FROM trip_events WHERE unitId=? ORDER BY rowid').all(unitId).map(e=>({...e,conditionPhotos:db.prepare('SELECT angle FROM condition_photos WHERE eventId=?').all(e.id).map(p=>({angle:p.angle,url:`/api/trip-photos/${e.id}/${p.angle}`})),photoUrl:e.photoType ? `/api/trip-photos/${e.id}` : null}));
  const active=unitId=>events(unitId).find(e=>e.kind==='departure' && !events(unitId).some(r=>r.tripId===e.tripId && r.kind==='return'));
  function event(unitId,kind,input) {
    if(!get(unitId))throw new StoreError(404,'Unit not found.');
    if(kind==='departure' && get(unitId).soldAt)throw new StoreError(409,'Restore this sold unit before recording a departure.');
    if(!input || !['departure','return','note'].includes(kind))throw new StoreError(422,'Invalid trip event.');
    const text=(key,max,required=true)=>{const value=typeof input[key]==='string' ? input[key].trim() : '';if((required && !value)||value.length>max)throw new StoreError(422,`Enter ${key} up to ${max} characters.`);return value;};
    const employee=text('employee',100),reason=text('reason',100,kind==='departure'),notes=text('notes',2000,kind==='note');
    const angles=['driverFront','passengerFront','passengerRear','driverRear'];
    const images=kind==='note'?[]:input.conditionPhotos ? angles.map(angle=>{const image=photo({photoData:input.conditionPhotos[angle]});if(!image)throw new StoreError(422,'All four condition photos are required.');return {angle,...image};}):[];
    if(kind!=='note' && input.requireFourPhotos && images.length!==4)throw new StoreError(422,'All four condition photos are required.');
    const image=kind==='note' ? null : (images[0] || photo(input));if(kind!=='note' && !image)throw new StoreError(422,'A condition photo is required.');
    db.exec('BEGIN IMMEDIATE');try {
      const current=active(unitId);
      if(kind==='departure' && current)throw new StoreError(409,'This unit already has an active trip.');
      if(kind==='return' && (!current || input.tripId!==current.tripId))throw new StoreError(409,'Refresh this unit before recording its return.');
      if(kind==='note' && !events(unitId).some(e=>e.tripId===input.tripId))throw new StoreError(404,'Trip not found.');
      const tripId=kind==='departure' ? randomUUID() : input.tripId,id=randomUUID();
      db.prepare('INSERT INTO trip_events (id,unitId,tripId,kind,employee,reason,notes,createdAt,photo,photoType,employeeId,employeeEmail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,unitId,tripId,kind,employee,reason,notes,new Date().toISOString(),image?.bytes || null,image?.type || null,input.employeeId || null,input.employeeEmail || null);
      for(const image of images)db.prepare('INSERT INTO condition_photos VALUES (?,?,?,?)').run(id,image.angle,image.bytes,image.type);
      db.exec('COMMIT');return events(unitId).find(e=>e.id===id);
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  function point(tripId,input){
    const departure=db.prepare("SELECT unitId FROM trip_events WHERE tripId=? AND kind='departure'").get(tripId);
    if(!departure || active(departure.unitId)?.tripId!==tripId)throw new StoreError(409,'This trip is not active.');
    if(!input || !Number.isFinite(input.latitude)||Math.abs(input.latitude)>90||!Number.isFinite(input.longitude)||Math.abs(input.longitude)>180||!Number.isFinite(input.accuracy)||input.accuracy<0||input.accuracy>100000)throw new StoreError(422,'Invalid GPS coordinates.');
    const now=new Date().toISOString(),time=new Date(input.recordedAt);if(!Number.isFinite(time.getTime())||time.getTime()>Date.now()+60000)throw new StoreError(422,'Invalid GPS time.');
    db.prepare('INSERT INTO trip_points VALUES (?,?,?,?,?,?,?)').run(randomUUID(),tripId,input.latitude,input.longitude,input.accuracy,time.toISOString(),now);return {receivedAt:now};
  }
  function setSold(id,input){
    const unit=get(id);if(!unit)throw new StoreError(404,'Unit not found.');
    if(!input || input.version!==unit.version)throw new StoreError(409,'This unit changed. Refresh before changing its sold status.');
    if(typeof input.sold!=='boolean')throw new StoreError(422,'Choose sold or active status.');
    if(input.sold && active(id))throw new StoreError(409,'Record the return before marking this unit sold.');
    if(Boolean(unit.soldAt)===input.sold)return unit;
    const now=new Date().toISOString();db.prepare('UPDATE units SET soldAt=?,historyPurgedAt=CASE WHEN ?=1 THEN NULL ELSE historyPurgedAt END,updatedAt=?,version=version+1 WHERE id=?').run(input.sold ? now : null,input.sold ? 1 : 0,now,id);return get(id);
  }
  function purgeSoldHistory(now=Date.now()){
    const cutoff=new Date(now-30*86400000).toISOString();let purged=0;
    db.exec('BEGIN IMMEDIATE');try{
      const eligible=db.prepare('SELECT id FROM units WHERE soldAt IS NOT NULL AND soldAt<=? AND historyPurgedAt IS NULL').all(cutoff);
      retentionMode=true;
      for(const unit of eligible){if(active(unit.id))continue;
        db.prepare('DELETE FROM trip_points WHERE tripId IN (SELECT tripId FROM trip_events WHERE unitId=?)').run(unit.id);
        db.prepare('DELETE FROM condition_photos WHERE eventId IN (SELECT id FROM trip_events WHERE unitId=?)').run(unit.id);
        db.prepare('DELETE FROM trip_events WHERE unitId=?').run(unit.id);
        db.prepare('UPDATE units SET historyPurgedAt=?,updatedAt=?,version=version+1 WHERE id=?').run(new Date(now).toISOString(),new Date(now).toISOString(),unit.id);purged++;
      }
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}finally{retentionMode=false;}
    if(purged)db.exec('VACUUM; PRAGMA wal_checkpoint(TRUNCATE)');return {purged};
  }
  return {locations,addLocation,renameLocation,seedLocations,list,get,create,update,importUnits,setSold,purgeSoldHistory,events,active,event,point,points:tripId=>db.prepare('SELECT latitude,longitude,accuracy,recordedAt,receivedAt FROM trip_points WHERE tripId=? ORDER BY rowid').all(tripId),getTripPhoto:(id,angle)=>angle?db.prepare('SELECT photo,photoType FROM condition_photos WHERE eventId=? AND angle=?').get(id,angle):db.prepare('SELECT photo,photoType FROM trip_events WHERE id=? AND photo IS NOT NULL').get(id),getPhoto:id=>db.prepare('SELECT photo,photoType FROM units WHERE id=? AND photo IS NOT NULL').get(id),close:()=>db.close()};
}
