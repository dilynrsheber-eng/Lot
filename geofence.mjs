export function matchLocation(locations,fix,now=Date.now()){
 if(!fix || !Number.isFinite(fix.latitude)||Math.abs(fix.latitude)>90||!Number.isFinite(fix.longitude)||Math.abs(fix.longitude)>180||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>100)return null;
 const time=Date.parse(fix.recordedAt);if(!Number.isFinite(time)||now-time>120000||time-now>30000)return null;
 const r=Math.PI/180;
 const matches=locations.filter(l=>{
  if(!Number.isFinite(l.latitude)||!Number.isFinite(l.longitude)||!Number.isFinite(l.radiusMeters))return false;
  const a=Math.sin((fix.latitude-l.latitude)*r/2)**2+Math.cos(l.latitude*r)*Math.cos(fix.latitude*r)*Math.sin((fix.longitude-l.longitude)*r/2)**2;
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,a)))+fix.accuracy<=l.radiusMeters;
 });
 return matches.length===1?matches[0]:null;
}
