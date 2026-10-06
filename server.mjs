import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, basename } from 'node:path';
import { openStore, StoreError } from './store.mjs';
import { createAuth } from './auth.mjs';
import { createDealershipAuth } from './dealership-auth.mjs';
import { gpsMileage } from './mileage.mjs';
import { initializeAuth } from './bootstrap-auth.mjs';
const files = { "/stock-walk.mjs":["stock-walk.mjs","text/javascript"], "/geofence.mjs":["geofence.mjs","text/javascript"], "/route-map.mjs":["route-map.mjs","text/javascript"], "/mileage.mjs":["mileage.mjs","text/javascript"], "/vendor/leaflet.js":["vendor/leaflet.js","text/javascript"], "/vendor/leaflet.css":["vendor/leaflet.css","text/css"], "/vendor/jsQR.js":["vendor/jsQR.js","text/javascript"], '/trips.mjs':['trips.mjs','text/javascript'], '/drafts.mjs':['drafts.mjs','text/javascript'], '/api-client.mjs':['api-client.mjs','text/javascript'], '/assets/lot-rot-logo.jpg':['assets/lot-rot-logo.jpg','image/jpeg'], '/': ['index.html','text/html'], '/styles.css':['styles.css','text/css'], '/app.mjs':['app.mjs','text/javascript'], '/domain.mjs':['domain.mjs','text/javascript'], '/qr.mjs':['qr.mjs','text/javascript'], '/vendor/qrcodegen.js':['vendor/qrcodegen.js','text/javascript'] };
export function createApp(dbPath = fileURLToPath(new URL('./data/lot-rot.sqlite',import.meta.url)), authPath, options={}) {
  const dealerships=options.dealerships ?? process.env.LOT_ROT_DEALERSHIPS==='1';
  const authenticate=authPath ? (dealerships ? createDealershipAuth(authPath,process.env.LOT_ROT_DEFAULT_COMPANY || 'Freedom RV',process.env.LOT_ROT_PASSWORD_SETUP) : createAuth(authPath, process.env.LOT_ROT_PASSWORD_SETUP)) : null;
  const primaryStore = openStore(dbPath), stores=new Map([['primary',primaryStore]]);
  if(dealerships)for(const file of readdirSync(dirname(dbPath))){
    const prefix=basename(dbPath)+'.company-';
    if(file.startsWith(prefix) && file.endsWith('.sqlite')){
      const id=file.slice(prefix.length,-7);
      if(/^[a-f0-9-]{36}$/i.test(id))stores.set(id,openStore(resolve(dirname(dbPath),file)));
    }
  }
  const cleanup=()=>{for(const store of stores.values())try{store.purgeSoldHistory();}catch(error){console.error('Sold-history cleanup failed:',error.message);}};
  cleanup();const cleanupTimer=setInterval(cleanup,3600000);cleanupTimer.unref();
  const server = http.createServer(async (req,res)=> {
    const json = (status,value)=> { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); };
    try {
      if(req.url==='/healthz' && req.method==='GET') return json(200,{status:'ok'});
      if(authenticate && await authenticate(req,res)) return;
      let store=primaryStore;
      if(dealerships && req.company && req.company.id!==req.defaultCompanyId){
        if(!/^[a-f0-9-]{36}$/i.test(req.company.id))throw new StoreError(403,'Invalid dealership.');
        if(!stores.has(req.company.id))stores.set(req.company.id,openStore(dbPath+'.company-'+req.company.id+'.sqlite'));
        store=stores.get(req.company.id);
      }
      if(req.company?.name==='Freedom RV')store.seedLocations(['SV2','Irvington','Ina']);
      const path = new URL(req.url,'http://localhost').pathname;
      if(req.employee?.role==='employee' && ['POST','PUT','DELETE'].includes(req.method) && !/^\/api\/(?:stock-walks(?:\/[a-f0-9-]{36}\/(?:scan|complete))?|units\/[a-f0-9-]{36}\/trips\/(?:departure|return|note)|trips\/[a-f0-9-]{36}\/points)$/i.test(path))throw new StoreError(403,'Only dealership administrators can add, edit, import, or mark units sold.');
      if(path==='/api/me' && req.method==='GET')return json(200,{employee:req.employee || null,company:req.company || null});
      if(path==='/save-unit' && req.method==='POST') {
        let input, destination='new';
        try {
          if(!req.headers.origin || new URL(req.headers.origin).host!==req.headers.host) throw new StoreError(403,'Open the app on this server before saving.');
          if(!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) throw new StoreError(415,'Use the vehicle entry form to save.');
          let raw='';for await(const chunk of req) {raw+=chunk;if(Buffer.byteLength(raw)>12*1024*1024) throw new StoreError(413,'Choose a reference photo up to 5 MB.');}
          const form=new URLSearchParams(raw);input=JSON.parse(form.get('record') || 'null');
          const id=form.get('id');if(id && !/^[a-f0-9-]{36}$/i.test(id)) throw new StoreError(400,'Invalid unit ID.');
          destination=id ? `edit/${id}` : 'new';
          const saved=id ? store.update(id,input) : store.create(input);
          const route=form.get('action')==='tag' ? 'tag' : 'unit';
          const key=id ? `edit-${id}` : 'new';
          res.writeHead(303,{'Location':`/?savedDraft=${encodeURIComponent(key)}#${route}/${saved.id}`,'Cache-Control':'no-store'});res.end();return;
        } catch(error) {
          const message=error.status ? error.message : 'Could not save the unit. Your device draft is preserved.';
          res.writeHead(303,{'Location':`/?saveError=${encodeURIComponent(message)}#${destination}`,'Cache-Control':'no-store'});res.end();return;
        }
      }
      if (path.startsWith('/api/')) {
        const movement=path.match(/^\/api\/units\/([a-f0-9-]{36})\/trips(?:\/(departure|return|note))?$/i);
        const coordinates=path.match(/^\/api\/trips\/([a-f0-9-]{36})\/points$/i);
        const stockWalk=path.match(/^\/api\/stock-walks\/([a-f0-9-]{36})(?:\/(scan|complete))?$/i);
        if (req.method==='GET') {
          if(stockWalk&&!stockWalk[2]){if(!req.employee)throw new StoreError(401,'Sign in to view stock walks.');return json(200,store.ownWalk(stockWalk[1],req.employee));}
          if(movement && !movement[2])return json(200,{events:store.events(movement[1]).map(e=>e.kind==='return'?{...e,mileage:gpsMileage(store.points(e.tripId))}:e),active:store.active(movement[1]) || null});
          if(coordinates)return json(200,store.points(coordinates[1]));
          const tripPhoto=path.match(/^\/api\/trip-photos\/([a-f0-9-]{36})(?:\/(driverFront|passengerFront|passengerRear|driverRear))?$/i);
          if(tripPhoto){const image=store.getTripPhoto(tripPhoto[1],tripPhoto[2]);if(!image)return json(404,{message:'Photo not found.'});res.writeHead(200,{'Content-Type':image.photoType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(image.photo);return;}
          const imageMatch=path.match(/^\/api\/photos\/([a-f0-9-]{36})$/i);
          if (imageMatch) { const image=store.getPhoto(imageMatch[1]); if (!image) return json(404,{message:'Photo not found.'}); res.writeHead(200,{'Content-Type':image.photoType,'Content-Length':image.photo.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'"}); res.end(image.photo); return; }
          if(path==='/api/locations')return json(200,store.locations());
          if (path==='/api/units') return json(200,store.list());
          const match = path.match(/^\/api\/units\/([a-f0-9-]{36})$/i);
          if (match) { const unit=store.get(match[1]); return unit ? json(200,unit) : json(404,{message:'Unit not found on this server.'}); }
          return json(404,{message:'Not found.'});
        }
        if (!['POST','PUT'].includes(req.method)) return json(405,{message:'Method not allowed.'});
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(403,{message:'Use the app on this server to save records.'});
        if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(415,{message:'JSON required.'});
        let raw=''; for await (const chunk of req) { raw+=chunk; if (Buffer.byteLength(raw)>30*1024*1024) throw new StoreError(413,'Request too large. Choose a photo up to 5 MB.'); }
        let body; try { body=JSON.parse(raw); } catch { throw new StoreError(400,'Invalid JSON.'); }
        if(req.method==='POST' && path==='/api/stock-walks'){if(!req.employee)throw new StoreError(401,'Sign in to start a stock walk.');return json(201,store.startWalk(body.locationId,req.employee));}
        if(req.method==='POST' && stockWalk?.[2]){if(!req.employee)throw new StoreError(401,'Sign in to scan units.');return json(200,stockWalk[2]==='scan'?store.scanWalk(stockWalk[1],body.unitId,req.employee):store.completeWalk(stockWalk[1],req.employee));}
        if(movement && movement[2] && req.method==='POST'){
          if(!req.employee)throw new StoreError(401,'Sign in with an individual employee account before recording a trip or correction.');
          const saved=store.event(movement[1],movement[2],{...body,requireFourPhotos:true,requireDestination:true,employee:req.employee.name,employeeId:req.employee.id,employeeEmail:req.employee.email});return json(201,{...saved,unit:store.get(movement[1])});
        }
        if(coordinates && req.method==='POST'){
          if(!req.employee)throw new StoreError(401,'Sign in with an individual employee account before recording GPS.');
          return json(201,store.point(coordinates[1],body));
        }
        const locationMatch=path.match(/^\/api\/locations\/([a-f0-9-]{36})$/i);if(locationMatch && req.method==='PUT')return json(200,store.renameLocation(locationMatch[1],body.name,body));
        if(path==='/api/locations' && req.method==='POST')return json(201,store.addLocation(body.name));
        if (path==='/api/units' && req.method==='POST') return json(201,store.create(body));
        if (path==='/api/import' && req.method==='POST') return json(200,store.importUnits(body));
        const sold=path.match(/^\/api\/units\/([a-f0-9-]{36})\/sold$/i);
        if(sold && req.method==='POST')return json(200,store.setSold(sold[1],body));
        const match=path.match(/^\/api\/units\/([a-f0-9-]{36})$/i);
        if (match && req.method==='PUT') return json(200,store.update(match[1],body));
        return json(404,{message:'Not found.'});
      }
      const file=files[path];
      if (!file || req.method!=='GET') {res.writeHead(404);res.end('Not found');return;}
      let body=await readFile(new URL(file[0],import.meta.url));
      if(path === '/') { const initial=JSON.stringify(store.list()).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026'); body=Buffer.from(body.toString('utf8').replace('<!-- INITIAL_INVENTORY -->',`<script type="application/json" id="initial-inventory">${initial}</script>`)); }
      res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(body);
    } catch(error) { console.error(error.message); json(error.status || 500,{message:error.status ? error.message : 'The server could not save or load data. Please try again.',errors:error.errors || {}}); }
  });
  server.on('close',()=>{clearInterval(cleanupTimer);for(const store of stores.values())store.close();});
  return server;
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const emailGated=process.argv.includes('--email-gated-tunnel');
  const authPath=process.env.LOT_ROT_AUTH || fileURLToPath(new URL('../../work/auth/account.json',import.meta.url));
  if (!emailGated) initializeAuth(authPath, process.env.LOT_ROT_INITIAL_ACCOUNT);
  const server=createApp(process.env.LOT_ROT_DB,emailGated ? undefined : authPath);
  server.listen(Number(process.env.PORT || 3000),emailGated ? '127.0.0.1' : '0.0.0.0',()=>console.log(`Lot Rot shared prototype: http://localhost:${server.address().port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
}

