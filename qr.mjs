import './vendor/qrcodegen.js';
export function unitLink(base, id) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http or https address without credentials.');
  url.hash = `unit/${encodeURIComponent(id)}`;
  url.search = '';
  return url.href;
}
export function qrMatrix(text) {
  const qr = globalThis.qrcodegen.QrCode.encodeText(text, globalThis.qrcodegen.QrCode.Ecc.MEDIUM);
  return Array.from({length:qr.size}, (_, y) => Array.from({length:qr.size}, (_, x) => qr.getModule(x,y)));
}
export function qrSvg(text) {
  const matrix = qrMatrix(text), size = matrix.length + 8;
  const path = matrix.flatMap((row,y) => row.flatMap((dark,x) => dark ? [`M${x+4},${y+4}h1v1h-1z`] : [])).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Unit QR code" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="black"/></svg>`;
}
