import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from './vendor/jsQR.cjs';
import { unitLink, qrMatrix, qrSvg } from '../qr.mjs';
test('independent decoder reads exact saved-unit URL from QR pixels', () => {
  const id = '3a954054-ea67-4f5f-a61d-0be99c63a0b6';
  for (const base of ['http://localhost:3000/', 'http://192.168.1.20:3000/', 'https://example.com/']) {
    const text = unitLink(base,id), matrix = qrMatrix(text), scale = 6, size = (matrix.length+8)*scale;
    const pixels = new Uint8ClampedArray(size*size*4).fill(255);
    matrix.forEach((row,y)=>row.forEach((dark,x)=> { if(dark) for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) { const i=(((y+4)*scale+dy)*size+(x+4)*scale+dx)*4; pixels[i]=pixels[i+1]=pixels[i+2]=0; } }));
    const decoded = jsQR(pixels,size,size);
    assert.equal(decoded?.data,text);
    assert.equal(new URL(decoded.data).hash,`#unit/${id}`);
    assert.match(qrSvg(text),/viewBox=/);
  }
});
test('QR link rejects unsafe schemes and strips old routes and queries',()=> {
  assert.throws(()=>unitLink('javascript:alert(1)','abc'));
  assert.throws(()=>unitLink('https://user:pass@example.com','abc'));
  assert.equal(unitLink('http://localhost:3000/?old=1#inventory','abc'),'http://localhost:3000/#unit/abc');
});
