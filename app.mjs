import { clearRouteMaps } from './route-map.mjs';
import { showTrips } from './trips.mjs';
import { draft as deviceDraft } from './drafts.mjs';
import { requestJson } from './api-client.mjs?v=save5';
import { validateUnit, searchUnits, readUnits } from './domain.mjs';
import { unitLink, qrSvg } from './qr.mjs';
const app = document.querySelector('#app');
let currentProfile=null,dealershipLocations=[];
const draft=(action,key,value)=>deviceDraft(action,`${currentProfile?.company?.id || 'local'}:${currentProfile?.employee?.id || 'local'}:${key}`,value);
async function showCompany(){
  try{const profile=await requestJson('/api/me');const label=document.querySelector('#company-name');
    currentProfile=profile;document.body.classList.toggle('employee-role',profile.employee?.role==='employee');
    if(label && profile.company?.name){label.textContent=profile.company.name;label.hidden=false;}
  }catch{/* Keep inventory available if the profile request cannot complete. */}
}
await showCompany();
try{dealershipLocations=await requestJson('/api/locations');}catch{}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let units = [], legacy = [], legacyError = false, requestSequence = 0, hasLoaded = false;
try { const initial=document.querySelector('#initial-inventory'); if(initial) {units=JSON.parse(initial.textContent);hasLoaded=true;} } catch {}
try { legacy = currentProfile?.company ? [] : readUnits(localStorage); } catch { legacyError = true; }
function notify(message) { document.querySelector('#toast').textContent = message; setTimeout(() => document.querySelector('#toast').textContent = '', 5000); }
async function api(path, method = 'GET', body) {
  return requestJson(path,method,body);
}
async function load() {
  const sequence = ++requestSequence;
  if (!hasLoaded) app.innerHTML = '<div class="panel" role="status">Loading shared inventory…</div>';
  try { const data = await api('/api/units'); if (sequence !== requestSequence) return; units = data; hasLoaded=true; render(); }
  catch(error) { if (sequence !== requestSequence) return; if(hasLoaded) {notify('Could not refresh. Showing the last loaded inventory. Reload the page to renew remote sign-in.');return;} app.innerHTML = `<div class="panel"><h1>${error.code==='SIGN_IN' ? 'Sign in again to continue' : 'Inventory could not load'}</h1><p>${escape(error.message)}</p><p>Keep the computer, Lot Rot server, and remote link running. The protected remote link works outside your home Wi-Fi.</p><p class="hint">Diagnostic: ${escape(error.code || 'SCREEN_ERROR')} · ${escape(error.code ? '' : error.message)}</p><div class="actions"><button id="retry">Try again</button><button id="reload" class="secondary">Reload and sign in</button><a class="button secondary" href="/api/units" target="_blank" rel="noopener">Check server response</a></div></div>`; document.querySelector('#retry').onclick = load; document.querySelector('#reload').onclick=()=>location.reload(); }
}
const title = u => `${escape(u.year)} ${escape(u.make)} ${escape(u.model)}`;
let stopScan = () => {};
function render() {
  clearRouteMaps();
  stopScan();
  const [page, id] = location.hash.slice(1).split('/');
  if(currentProfile?.employee?.role==='employee' && ['new','edit'].includes(page)){app.innerHTML='<div class="panel"><h1>Administrator access required</h1><p>Your dealership administrator manages unit details. You can view inventory and record departures and returns.</p><a href="#home">Back to home</a></div>';return;}
  document.body.classList.toggle('home-page', !page || page === 'home');
  document.querySelector('#nav-home').setAttribute('aria-current',!page || page === 'home' ? 'page' : 'false');
  document.querySelector('#nav-inventory').setAttribute('aria-current',['inventory','list','unit','edit','tag','trips','history'].includes(page) ? 'page' : 'false');
  document.querySelector('#nav-menu').setAttribute('aria-current',page === 'menu' ? 'page' : 'false');
  document.querySelector('#nav-new').setAttribute('aria-current',page === 'new' ? 'page' : 'false');
  if(page === 'locations')return locationsPage();
  if(page === 'menu') return menu();
  if(page === 'list') return inventoryList();
  if(!page || page === 'home') return home();
  document.querySelector('#nav-new').setAttribute('aria-current',page === 'new' ? 'page' : 'false');
  if (page === 'new') return form();
  if (page === 'unit' || page === 'edit' || page === 'tag' || page === 'trips' || page === 'history') {
    const unit = units.find(u => u.id === id);
    if(unit && page==='unit'){try{let recent=JSON.parse(localStorage.getItem('lot-rot.recent.'+(currentProfile?.company?.id || 'local')) || '[]');if(!Array.isArray(recent))recent=[];localStorage.setItem('lot-rot.recent.'+(currentProfile?.company?.id || 'local'),JSON.stringify([unit.id,...recent.filter(value=>value!==unit.id)].slice(0,10)));}catch{}}
    if (!unit) { app.innerHTML = '<a class="back" href="#inventory">← Inventory</a><div class="panel"><h1>Unit not found on this server</h1><p>If this is an older tag, import the original browser records first. Check that the QR address points to the computer hosting your inventory.</p></div>'; return; }
    if (page === 'trips') return showTrips(app,unit);
    if (page === 'history') return showTrips(app,unit,false,true);
    if (page === 'tag') return tag(unit);
    if (page === 'edit') return form(unit);
    app.innerHTML = `<a class="back" href="#inventory">← Inventory</a><div class="heading"><div><div class="eyebrow">UNIT RECORD</div><h1>${title(unit)}</h1><span class="stock">Stock ${escape(unit.stockNumber)}</span></div><a class="button secondary" href="#edit/${unit.id}">Edit unit</a></div><section class="panel">${unit.photoUrl ? `<img class="unit-photo" src="${unit.photoUrl}" alt="Reference photo of ${title(unit)}">` : ""}<h2>Vehicle details</h2><dl class="details">${[['year','Year'],['make','Make'],['model','Model'],['color','Color'],['stockNumber','Stock number'],['vin','VIN'],['location','Location']].map(([k,l])=>`<div><dt>${l}</dt><dd>${escape(unit[k])}</dd></div>`).join('')}</dl></section><section class="panel"><h2>Drives</h2><p>Start or complete a drive, or view previous drives separately.</p><div class="actions"><a class="button" href="#trips/${unit.id}">Depart / Complete drive</a><a class="button secondary" href="#history/${unit.id}">Drive history</a></div></section><section class="panel unit-sale"><h2>${unit.soldAt ? "Sold unit" : "Remove from active inventory"}</h2><p>${unit.soldAt ? "This unit is archived as sold. Trip history, GPS points and condition photos are automatically deleted 30 days after the sale." : "Mark a sold vehicle to remove it from active inventory. Its trip history, GPS points and condition photos will be permanently deleted after 30 days."}</p><button id="sold-action" class="secondary">${unit.soldAt ? "Restore to active inventory" : "Mark as sold"}</button><p id="sold-message" role="status"></p></section><section class="panel"><h2>QR tag</h2><p>Print a QR tag with the stock number for manual lookup.</p><a class="button" href="#tag/${unit.id}">Generate QR tag</a></section>`;
    document.querySelector("#sold-action").onclick=async()=>{const button=document.querySelector("#sold-action");button.disabled=true;try{const saved=await api(`/api/units/${unit.id}/sold`,"POST",{sold:!unit.soldAt,version:unit.version});units[units.findIndex(value=>value.id===saved.id)]=saved;render();notify(saved.soldAt ? "Marked sold. History cleanup is scheduled for 30 days after sale." : "Restored to active inventory.");}catch(error){document.querySelector("#sold-message").textContent=error.message;button.disabled=false;}};
    return;
  }
  app.innerHTML = `<div class="heading"><div><div class="eyebrow">YOUR LOT, IN VIEW</div><h1>Inventory</h1></div><a class="button" href="#new">+ Add unit</a></div><div class="actions"><button id="refresh" class="secondary">Refresh inventory</button>${legacy.length ? `<button id="import-local" class="secondary">Import ${legacy.length} old browser record(s)</button>` : ""}</div><p class="hint">Shared from this computer’s server. Refresh to see changes from another device.</p>${legacyError ? '<p class="error">Old browser records could not be read. They have not been changed.</p>' : ""}<p id="import-result" role="status"></p><label for="inventory-status">Show units<select id="inventory-status"><option value="active">Active inventory</option><option value="sold">Sold units</option><option value="all">All units</option></select></label><label class="search-label" for="search">Find a unit</label><input class="search" id="search" type="search" placeholder="Search stock number, VIN, make, or model"><div class="counter" id="count"></div><div id="inventory"></div>`;
  const update = () => {
    const status=document.querySelector('#inventory-status').value; const visible=units.filter(u=>status==='all' || (status==='sold' ? Boolean(u.soldAt) : !u.soldAt)); const found = searchUnits(visible, document.querySelector('#search').value);
    document.querySelector('#count').textContent = `${found.length} of ${visible.length} unit${visible.length === 1 ? '' : 's'}`;
    document.querySelector('#inventory').innerHTML = found.length ? `<div class="grid">${found.map(u=>`<a class="card" href="#unit/${u.id}" aria-label="View ${title(u)} stock ${escape(u.stockNumber)}">${u.photoUrl ? `<img class="inventory-photo" src="${u.photoUrl}" alt="Reference photo of ${title(u)}" loading="lazy">` : '<div class="no-photo" aria-hidden="true">No photo</div>'}<div class="card-copy"><div class="stock">Stock ${escape(u.stockNumber)}</div><h2>${title(u)}</h2><p>${escape(u.color)}</p><p class="vin">VIN ${escape(u.vin)}</p><p>Location: ${escape(u.location || 'Not assigned')}</p></div></a>`).join('')}</div>` : `<div class="panel empty"><h2>${units.length ? 'No matching units' : 'Your inventory starts here'}</h2><p>${units.length ? 'Try another stock number, VIN, or vehicle detail.' : 'Add a car, motorhome, or trailer using the six core vehicle details.'}</p>${units.length ? '' : '<a class="button" href="#new">Add your first unit</a>'}</div>`;
  };
  document.querySelector('#refresh').onclick = load;
  const importButton = document.querySelector('#import-local');
  if (importButton) importButton.onclick = async () => {
    importButton.disabled = true;
    try { const result = await api('/api/import','POST',legacy); legacy = []; await load(); notify(`${result.imported} imported; ${result.skipped} already shared. Old browser copies are preserved.`); }
    catch (error) { document.querySelector('#import-result').textContent = error.message; importButton.disabled = false; }
  };
  document.querySelector('#inventory-status').addEventListener('change', update); document.querySelector('#search').addEventListener('input', update); update();
}

function inventoryList() {
  app.innerHTML = '<a class="back" href="#menu">← Menu</a><div class="heading"><div><div class="eyebrow">YOUR LOT, IN VIEW</div><h1>Inventory List</h1><p>Compact inventory, ready to search.</p></div><button id="list-refresh" class="secondary">Refresh</button></div><label for="list-status">Show units<select id="list-status"><option value="active">Active inventory</option><option value="sold">Sold units</option><option value="all">All units</option></select></label><label for="list-search">Search inventory</label><input id="list-search" class="search" type="search" placeholder="VIN, stock number, or year make model"><div id="list-count" class="counter" role="status" aria-live="polite"></div><div id="list-results"></div>';
  const update = () => {
    const status = document.querySelector('#list-status').value;
    const visible = units.filter(u => status === 'all' || (status === 'sold' ? Boolean(u.soldAt) : !u.soldAt));
    const found = searchUnits(visible, document.querySelector('#list-search').value);
    document.querySelector('#list-count').textContent = found.length + ' of ' + visible.length + ' units';
    document.querySelector('#list-results').innerHTML = found.length ? '<div class="compact-inventory">' + found.map(u => '<a class="inventory-row" href="#unit/' + encodeURIComponent(u.id) + '"><span class="row-vehicle"><strong>' + title(u) + '</strong><span>Stock ' + escape(u.stockNumber) + (u.soldAt ? ' · Sold' : '') + '</span></span><span class="row-vin">VIN ' + escape(u.vin) + '</span><span class="row-location">Location: ' + escape(u.location || 'Not assigned') + '</span><span aria-hidden="true">›</span></a>').join('') + '</div>' : '<div class="panel empty"><h2>No matching units</h2><p>Try another VIN, stock number, or vehicle detail, or change the inventory filter.</p></div>';
  };
  document.querySelector('#list-refresh').onclick = load;
  document.querySelector('#list-search').addEventListener('input', update);
  document.querySelector('#list-status').addEventListener('change', update);
  update();
}

function home() {
  let recent=[];try{recent=JSON.parse(localStorage.getItem('lot-rot.recent.'+(currentProfile?.company?.id || 'local')) || '[]');if(!Array.isArray(recent))recent=[];}catch{}
  const recentUnits=recent.map(id=>units.find(u=>u.id===id && !u.soldAt)).filter(Boolean).slice(0,3);
  app.innerHTML='<section class="scan-home"><img class="home-logo" src="/assets/lot-rot-logo.jpg" alt="Lot Rot"><h1>Scan a QR code</h1><p class="scan-subtitle">or enter a stock number below</p><form id="lookup-form"><label class="sr-only" for="stock-lookup">Stock number or VIN</label><input id="stock-lookup" type="search" enterkeyhint="search" placeholder="Stock number or VIN" autocomplete="off"><button type="button" id="scan-qr" class="scan-button">▣ &nbsp; Scan QR code</button><a class="button secondary lookup-button" style="text-align:center" href="#new">New Unit</a><a class="button secondary lookup-button" style="text-align:center" href="#list">Inventory list</a></form><p id="scan-message" role="status" aria-live="polite"></p><div id="camera-panel" hidden><video id="qr-video" autoplay muted playsinline></video><button id="stop-camera" class="secondary">Cancel scan</button></div><div id="lookup-results"></div><section class="recent-units"><h2>Recent Units</h2>'+ (recentUnits.length ? recentUnits.map(u=>'<a class="recent-row" href="#unit/'+encodeURIComponent(u.id)+'">'+(u.photoUrl ? '<img src="'+escape(u.photoUrl)+'" alt="">' : '<span class="recent-placeholder" aria-hidden="true">RV</span>')+'<span><strong>'+escape(u.stockNumber)+'</strong><small>'+title(u)+'</small></span><span aria-hidden="true">›</span></a>').join('') : '<p class="recent-empty">Units you open will appear here.</p>') + '</section></section>';
  const message=document.querySelector('#scan-message');
  document.querySelector('#lookup-form').onsubmit=e=>{e.preventDefault();const q=document.querySelector('#stock-lookup').value.trim();if(!q){message.textContent='Enter a stock number or VIN.';return;}const active=units.filter(u=>!u.soldAt);const exact=active.filter(u=>[u.stockNumber,u.vin].some(v=>v.toLowerCase()===q.toLowerCase()));const found=exact.length?exact:searchUnits(active,q);if(found.length===1){location.hash='#unit/'+found[0].id;return;}message.textContent=found.length ? 'Choose a matching unit below.' : 'No matching active unit. Try another stock number or VIN.';document.querySelector('#lookup-results').innerHTML=found.map(u=>'<a class="recent-row" href="#unit/'+encodeURIComponent(u.id)+'"><span><strong>'+escape(u.stockNumber)+'</strong><small>'+title(u)+'</small></span><span aria-hidden="true">›</span></a>').join('');};
  let stream, frame, cancelled=false;
  stopScan=()=>{cancelled=true;cancelAnimationFrame(frame);if(stream)stream.getTracks().forEach(t=>t.stop());};
  document.querySelector('#stop-camera').onclick=()=>{stopScan();document.querySelector('#camera-panel').hidden=true;document.querySelector('#scan-qr').disabled=false;message.textContent='Scan cancelled.';};
  document.querySelector('#scan-qr').onclick=async()=>{
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){message.textContent='Camera access requires a secure connection. Use your phone camera to scan the Lot Rot QR tag, or enter the stock number here.';return;}
    if(typeof window.jsQR!=='function'){message.textContent='The QR reader could not load. Reload the app and try again.';return;}
    const button=document.querySelector('#scan-qr');button.disabled=true;cancelled=false;
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}const video=document.querySelector('#qr-video');video.srcObject=stream;document.querySelector('#camera-panel').hidden=false;await video.play();message.textContent='Point your camera at a Lot Rot QR tag.';
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});let lastFrame=0;
      const tick=time=>{if(cancelled)return;try{if(video.readyState>=2 && video.videoWidth && time-lastFrame>=125){lastFrame=time;const scale=Math.min(1,720/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);context.drawImage(video,0,0,canvas.width,canvas.height);const pixels=context.getImageData(0,0,canvas.width,canvas.height);const code=window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});if(code){let link;try{link=new URL(code.data);}catch{}const match=link && ['http:','https:'].includes(link.protocol) && link.hash.match(new RegExp('^#unit/([a-f0-9-]{36})$', 'i'));if(match && units.some(u=>u.id===match[1])){stopScan();location.hash='#unit/'+match[1];return;}message.textContent='That QR code does not match a unit in this inventory.';}}}catch{message.textContent='Could not read this frame. Keep the tag in view.';}if(!cancelled)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
    }catch{stopScan();if(button.isConnected){button.disabled=false;document.querySelector('#camera-panel').hidden=true;message.textContent='Could not open the camera. Allow camera access and try again, or enter the stock number.';}}
  };
}
function menu() {
  app.innerHTML = `<div class="eyebrow">LOT ROT</div><h1>Menu</h1><p>Choose what you want to do.</p><div class="menu-options"><a class="panel menu-option" href="#home"><h2>Home &amp; Scan</h2><p>Scan a QR tag or look up a stock number.</p></a><a class="panel menu-option" href="#list"><h2>Inventory List</h2><p>A compact list. Search by VIN, stock number, or year, make and model.</p></a><a class="panel menu-option" href="#new"><h2>Add a vehicle</h2><p>Enter vehicle details, add an optional photo, and save or generate a printable QR tag.</p></a></div><div class="panel menu-help"><h2>Print or replace a QR tag</h2><p>Open Inventory, select a unit, then choose Generate QR tag. The tag includes the stock number for manual lookup.</p><a class="button secondary" href="#inventory">Find a unit</a></div><p class="hint">Open a unit for departure, return, condition photos and trip history. Browser GPS capture requires an open page.</p><button id="reload-app" class="secondary">Reload latest app</button>`;
  document.querySelector('#reload-app').onclick=()=>location.reload();
  if(currentProfile?.employee?.role==='admin'){const link=document.createElement('a');link.href='/team';link.className='panel menu-option';link.innerHTML='<h2>Team &amp; invitations</h2><p>Invite employees or another administrator to your dealership.</p>';document.querySelector('.menu-options').append(link);const locationsLink=document.createElement('a');locationsLink.href='#locations';locationsLink.className='panel menu-option';locationsLink.innerHTML='<h2>Locations</h2><p>Add or rename dealership locations.</p>';document.querySelector('.menu-options').append(locationsLink);}
}
function tag(unit) {
  app.innerHTML = `<div class="tag-controls"><a class="back" href="#unit/${unit.id}">← Unit details</a><div class="eyebrow">READY TO LABEL</div><h1>Print a unit tag</h1><p>The vehicle has been saved. Generate its QR below, then print.</p><label for="tag-base">App address for the QR link</label><input id="tag-base" type="url" value="${escape(location.origin + location.pathname)}"><p class="hint">For a phone scan, use this computer’s address reachable on your Wi-Fi, such as http://192.168.1.237:3000/. Localhost on a phone points to the phone itself.</p><div class="notice">Inventory is shared by the computer’s server. Phones on the same Wi-Fi can open this unit with a reachable server address. Keep the computer and server running. The app requires sign-in. Individual employee accounts are planned.</div><div class="actions"><button id="generate-tag">Generate QR</button><button id="print-tag" class="secondary" disabled>Print tag</button></div><p id="tag-error" class="error" role="alert"></p></div><section id="tag-preview" aria-live="polite"></section>`;
  const generate = () => {
    document.querySelector('#print-tag').disabled = true;
    document.querySelector('#tag-preview').innerHTML = '';
    try {
      const link = unitLink(document.querySelector('#tag-base').value, unit.id);
      const svg = qrSvg(link);
      document.querySelector('#tag-preview').innerHTML = `<article class="print-tag"><div class="tag-brand">LOT ROT</div><h2>Stock ${escape(unit.stockNumber)}</h2><div class="qr-image">${svg}</div><p>${title(unit)}</p><p>${escape(unit.color)}</p><p class="vin">VIN ${escape(unit.vin)}</p><div class="tag-link">${escape(link)}</div><small>Shared prototype · Keep the inventory server running</small></article>`;
      document.querySelector('#tag-error').textContent = '';
      document.querySelector('#print-tag').disabled = false;
    } catch { document.querySelector('#tag-error').textContent = 'Enter a valid http or https app address. If the address is too long, use a shorter address.'; }
  };
  document.querySelector('#generate-tag').onclick = generate;
  document.querySelector('#tag-base').oninput = () => { document.querySelector('#print-tag').disabled = true; document.querySelector('#tag-preview').innerHTML = ''; };
  document.querySelector('#print-tag').onclick = () => window.print();
  generate();
}
async function form(existing) {
  let photoData;
  const fields = [['year','Year','2026',4],['make','Make','Winnebago',60],['model','Model','View 24D',100],['color','Color','White / silver',60],['stockNumber','Stock number','FRV-1001',40],['vin','VIN','17-character vehicle identification number',17]];
  app.innerHTML = `<a class="back" href="${existing ? '#unit/'+existing.id : '#inventory'}">← ${existing ? 'Unit details' : 'Inventory'}</a><div class="eyebrow">VEHICLE ENTRY</div><h1>${existing ? 'Edit unit' : 'Add a unit'}</h1><p>All six fields are required. Use the VIN from the vehicle or title.</p><form id="unit-form" class="panel" novalidate><div class="form-grid">${fields.map(([k,l,p,max])=>`<label for="${k}">${l}<input id="${k}" name="${k}" value="${escape(existing?.[k] || '')}" placeholder="${p}" maxlength="${max}" ${k==='year'?'inputmode="numeric"':''} required aria-describedby="${k}-error"><span class="error" id="${k}-error"></span></label>`).join('')}</div><label for="locationId">Location<select id="locationId" name="locationId"><option value="">Not assigned</option>${dealershipLocations.map(l=>`<option value="${l.id}" ${existing?.locationId===l.id ? 'selected' : ''}>${escape(l.name)}</option>`).join('')}</select><span class="error" id="locationId-error"></span></label><div class="photo-field"><label for="photo">Reference photo (optional)</label><input id="photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="hint">Take or choose a photo to help employees recognize this unit. JPEG, PNG, or WebP, up to 5 MB. This is separate from departure and return condition photos.</p><p id="photo-error" class="error" role="alert"></p><img id="photo-preview" class="unit-photo" ${existing?.photoUrl ? `src="${existing.photoUrl}"` : "hidden"} alt="Reference photo preview"></div><div class="actions"><button type="submit" name="action" value="save">${existing ? 'Save changes' : 'Save unit'}</button><button type="submit" name="action" value="tag">Save and generate QR</button><a class="button secondary" href="${existing ? '#unit/'+existing.id : '#inventory'}">Cancel</a></div><p id="save-error" class="error" role="alert"></p><p id="draft-status" class="hint" role="status"></p></form>`;
  const saveError=new URLSearchParams(location.search).get('saveError');if(saveError) document.querySelector('#save-error').textContent=saveError;
  const draftKey=existing ? `edit-${existing.id}` : 'new';
  const currentForm=document.querySelector('#unit-form');
  let draftTouched=false, saveDraftQueue=Promise.resolve();
  const remember=()=>{
    draftTouched=true;
    const value={fields:Object.fromEntries(new FormData(currentForm)),photoData,version:existing?.version};
    saveDraftQueue=saveDraftQueue.catch(()=>{}).then(()=>draft('put',draftKey,value)).then(()=>{if(currentForm.isConnected) document.querySelector('#draft-status').textContent='Draft saved on this device. It can be restored after reloading this page.';}).catch(()=>{if(currentForm.isConnected) document.querySelector('#draft-status').textContent='Could not save a device draft. Keep this page open until the vehicle saves.';});
  };
  currentForm.addEventListener('input',event=>{if(event.target.type!=='file') remember();});
  try {
    const saved=await draft('get',draftKey);
    if(saved && !draftTouched && currentForm.isConnected && (!existing || saved.version===existing.version)) {
      for(const [k] of [...fields,['locationId']]) document.querySelector(`#${k}`).value=saved.fields[k] || '';
      if(saved.photoData) {photoData=saved.photoData;const preview=document.querySelector('#photo-preview');preview.src=photoData;preview.hidden=false;}
      document.querySelector('#draft-status').textContent='Restored your unsaved vehicle draft and selected photo from this device.';
    }
  } catch {}
  if(!currentForm.isConnected) return;
  const photoInput=document.querySelector('#photo');
  let photoPending=false;
  photoInput.onchange=async () => {
    const file=photoInput.files[0]; if (!file) return;
    const error=document.querySelector('#photo-error');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024) {error.textContent='Choose a JPEG, PNG, or WebP image up to 5 MB. The current photo is unchanged.'; photoInput.value='';return;}
    photoPending=true;
    try {
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=data;});
      photoData=data; const preview=document.querySelector('#photo-preview');preview.src=data;preview.hidden=false;error.textContent='';remember();
    } catch {error.textContent='Could not read this photo. Choose another image. The current photo is unchanged.';photoInput.value='';}
    finally {photoPending=false;}
  };
  currentForm.onsubmit = async event => {
    event.preventDefault();
    if (photoPending) {document.querySelector('#save-error').textContent='Wait for the photo preview before saving.';return;}
    const {unit, errors} = validateUnit(Object.fromEntries(new FormData(event.target)), units, existing?.id);
    for (const [k] of fields) { document.querySelector(`#${k}-error`).textContent = errors[k] || ''; document.querySelector(`#${k}`).setAttribute('aria-invalid', !!errors[k]); }
    if (Object.keys(errors).length) { document.querySelector(`#${Object.keys(errors)[0]}`).focus(); return; }
    remember();
    const action = event.submitter?.value;
    const buttons = [...event.target.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
    try {
      await saveDraftQueue;
      const saved=await api(existing ? `/api/units/${existing.id}` : '/api/units',existing ? 'PUT' : 'POST',{...unit,locationId:currentForm.elements.locationId.value,...(photoData ? {photoData} : {}),...(existing ? {version:existing.version} : {})});
      const index=units.findIndex(value=>value.id===saved.id);
      if(index<0) units.unshift(saved);else units[index]=saved;
      await draft('delete',draftKey).catch(()=>{});
      location.hash=`#${action==='tag' ? 'tag' : 'unit'}/${saved.id}`;
    } catch(error) {
      for (const [k] of fields) { document.querySelector(`#${k}-error`).textContent = (error.errors || {})[k] || ''; document.querySelector(`#${k}`).setAttribute('aria-invalid',!!(error.errors || {})[k]); }
      document.querySelector('#save-error').textContent = error.message;
      if(error.errors?.photo) document.querySelector('#photo-error').textContent=error.errors.photo;
      buttons.forEach(b=>b.disabled=false);
    }
  };
}
window.addEventListener('hashchange', () => { ++requestSequence; render(); window.scrollTo(0,0); });
const savedDraft=new URLSearchParams(location.search).get('savedDraft');
if(savedDraft) {
  draft('delete',savedDraft).catch(()=>{});
  const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('savedDraft');
  history.replaceState(null,'',cleanUrl);
}
if(hasLoaded) render(); else load();












async function locationsPage(){
 if(currentProfile?.employee?.role!=='admin'){app.innerHTML='<p>Administrator access required.</p>';return;}
 try{dealershipLocations=await api('/api/locations');if(location.hash!=='#locations')return;app.innerHTML='<a class="back" href="#menu">Menu</a><h1>Locations</h1><p>Rename a location without changing the units assigned to it.</p><section class="panel">'+dealershipLocations.map(l=>'<form class="location-edit" data-id="'+l.id+'"><label>Location name<input name="name" maxlength="100" required value="'+escape(l.name)+'"></label><button>Save name</button><p class="error" role="alert"></p></form>').join('')+'</section><form id="add-location" class="panel"><h2>Add location</h2><label>Name<input name="name" maxlength="100" required></label><button>Add location</button><p class="error" role="alert"></p></form>';
 for(const form of app.querySelectorAll('.location-edit,#add-location'))form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api(form.dataset.id?'/api/locations/'+form.dataset.id:'/api/locations',form.dataset.id?'PUT':'POST',{name:form.elements.name.value});units=await api('/api/units');await locationsPage();}catch(error){form.querySelector('.error').textContent=error.message;button.disabled=false;}};
 }catch(error){app.textContent=error.message;}
}
