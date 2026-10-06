import { gpsMileage } from './mileage.mjs';
const maps=new Set();
export function clearRouteMaps(){for(const map of maps)map.remove();maps.clear();}
export function routeSegments(points){
 const segments=[];let current=[],previous;
 for(const p of points){
  if(!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180||!Number.isFinite(p.accuracy)||p.accuracy>100||!Number.isFinite(Date.parse(p.recordedAt))){previous=undefined;current=[];continue;}
  if(!previous || gpsMileage([previous,p]).miles===null){current=[];segments.push(current);}
  current.push([p.latitude,p.longitude]);previous=p;
 }
 return segments;
}
export function showRouteMap(target,points){
 const segments=routeSegments(points),locations=segments.flat();
 target.replaceChildren();
 if(!locations.length){target.textContent='No reliable GPS locations were recorded for this drive.';return;}
 if(!window.L)throw Error('The map could not load. Reload this page and try again.');
 const canvas=document.createElement('div');canvas.className='drive-route-map';canvas.setAttribute('aria-label','Recorded drive route on OpenStreetMap');
 const note=document.createElement('p');note.className='hint';note.textContent='Green: first recorded location. Orange: last recorded location. Lines connect recorded GPS samples; gaps and unreliable locations are excluded.';
 const warning=document.createElement('p');warning.className='hint';warning.setAttribute('role','status');target.append(canvas,note,warning);
 const L=window.L,map=L.map(canvas,{scrollWheelZoom:false});maps.add(map);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).on('tileerror',()=>{warning.textContent='Background map tiles could not load. The recorded route is still shown.';}).addTo(map);
 for(const segment of segments)if(segment.length>1)L.polyline(segment,{color:'#0877bb',weight:5}).addTo(map);
 const marker=(where,color,label)=>L.circleMarker(where,{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).bindPopup(label).addTo(map);
 marker(locations[0],'#198754','First recorded location');marker(locations.at(-1),'#fb8500','Last recorded location');
 map.fitBounds(L.latLngBounds(locations),{padding:[25,25],maxZoom:16});
}
