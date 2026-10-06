export const FIELDS = ['year', 'make', 'model', 'color', 'stockNumber', 'vin'];
export const STORAGE_KEY = 'lot-rot.units.v1';
export function validateUnit(input, units = [], editingId = null) {
  const unit = Object.fromEntries(FIELDS.map(k => [k, String(input[k] ?? '').trim()]));
  unit.vin = unit.vin.toUpperCase();
  unit.stockNumber = unit.stockNumber.toUpperCase();
  const errors = {};
  for (const k of FIELDS) if (!unit[k]) errors[k] = 'This field is required.';
  if (unit.year && !/^(19|20)\d{2}$/.test(unit.year)) errors.year = 'Enter a four-digit year from 1900 to 2099.';
  if (unit.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(unit.vin)) errors.vin = 'Enter 17 letters and numbers. VINs do not use I, O, or Q.';
  for (const k of ['vin', 'stockNumber']) if (units.some(u => u.id !== editingId && u[k].toUpperCase() === unit[k])) errors[k] = `This ${k === 'vin' ? 'VIN' : 'stock number'} is already in inventory.`;
  return { unit, errors };
}
export function searchUnits(units, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return units.filter(u => terms.every(term => FIELDS.some(k => String(u[k] ?? '').toLowerCase().includes(term))));
}
export function readUnits(storage) {
  const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
  if (!Array.isArray(value) || value.some(u => !u || typeof u.id !== 'string' || FIELDS.some(k => typeof u[k] !== 'string'))) throw new Error('Invalid saved inventory');
  return value;
}
export function saveUnits(storage, units) { storage.setItem(STORAGE_KEY, JSON.stringify(units)); }
