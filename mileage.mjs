// Sum recorded GPS segments; never bridge long gaps or poor location fixes.
export function gpsMileage(points){
 let meters=0,segments=0,partial=false,previous;
 for(const p of points){
  const time=Date.parse(p.recordedAt);
  if(!Number.isFinite(time)||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||!Number.isFinite(p.accuracy)||p.accuracy>100){partial=true;previous=undefined;continue;}
  if(previous){
   const seconds=(time-Date.parse(previous.recordedAt))/1000,r=Math.PI/180;
   const a=Math.sin((p.latitude-previous.latitude)*r/2)**2+Math.cos(previous.latitude*r)*Math.cos(p.latitude*r)*Math.sin((p.longitude-previous.longitude)*r/2)**2;
   const distance=6371000*2*Math.asin(Math.sqrt(Math.min(1,a)));
   if(seconds>0&&seconds<=120&&distance/seconds<=53.6448){meters+=distance;segments++;}else partial=true;
  }previous=p;
 }
 return {miles:segments?meters/1609.344:null,partial,samples:points.length};
}
