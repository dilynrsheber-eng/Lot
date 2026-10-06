# Run Lot Rot

Lot Rot now shares inventory and optional reference photos through a SQLite database on this computer. There are no packages to install. Requires Node.js 24 or newer (the Codex bundled runtime is already available).

1. Open PowerShell in this folder.
2. Run `node server.mjs` or `npm start`.
3. Computer: http://localhost:3000. Phone on the same Wi-Fi: http://192.168.1.237:3000.
4. Keep the computer awake and server running. Ctrl+C stops it. If the computer’s network address changes, update the phone URL and generated tags.

On this Codex computer:

```powershell
& 'C:\Users\dilyn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.mjs
```

Refresh your already-open phone page once to load this update. Add a unit using year, make, model, color, stock number, and VIN. Optional Reference photo lets the phone select a photo or use its camera where supported by the browser. JPEG, PNG, and WebP up to 5 MB are supported; convert HEIC photos first. Preview appears before saving. Choose Save unit or Save and generate QR. The vehicle and photo save together; a failed save retains your form and selected image. Edit unit can replace the photo; leaving the picker empty preserves the current photo.

## Search and QR tags

Find a unit is visible on Inventory. It searches stock number, VIN, year, make, model, and color. Open a result to see vehicle details and the reference photo. No scanning is required. Refresh inventory loads changes made by another device; changes are not pushed live into an already-open page.

Save and generate QR validates and saves first, then opens a printable tag. Existing unit details also offer Generate QR tag. The QR encodes a stable unit URL; the tag includes stock number for manual fallback. Click Print tag and print or choose Save as PDF. Use windshield placement for cars/motorhomes and entry-door placement for trailers.

On the phone’s network URL, QR addresses default to that reachable address. If generating on localhost on the computer, change App address for the QR link to `http://192.168.1.237:3000/` and click Generate QR. Localhost on a phone points to the phone, not the computer. Records and photos now open from other devices connected to this server. Old localhost tags need regeneration for phone scans. Old unit IDs are preserved by import.

## Preserve earlier browser records

Old browser-local data is untouched. Open the app at the same address and in the same browser where you entered the old records. Inventory offers Import old browser record(s) when it finds those copies. Import copies them into the shared database and keeps the local originals. Matching imports are skipped; conflicting IDs, VINs, or stock numbers stop the whole import with a message, rather than overwriting anything. If you entered units on the phone before this update, use the import button there too. Each old browser origin has its own old data. Up to 500 old records per import.

## Storage and limits

`data/lot-rot.sqlite` stores records and photo bytes. SQLite uses WAL and FULL synchronous writes; unique constraints protect VIN/stock number. Version checks reject stale edits from another device. Back up the entire data directory with the server stopped; do not delete it or replace it while copying updated source files. The server never serves database files as web pages. `LOT_ROT_DB` can point to a different database file; `PORT` changes the listening port.

This is a shared development backend hosted by your computer, not cloud hosting or secure employee/dealership accounts. Anyone with access to this app on your network can view and edit inventory. Use only a trusted private network and sample data; do not expose it to the public internet. Employee sign-in and dealership access controls are the next practical step, followed by departure and return workflows with required condition photos. No movement, GPS, or within-lot tracking is implemented.

## Checks

Run `node --test tests/*.test.mjs` or `npm test`. Tests cover validation, duplicates, concurrent submission, stale edits, shared client reads/updates, all six search fields, independent QR decoding, photo persistence, invalid photo rejection, transactional import, and reopening the server/database. Physical printing and a real phone camera were not automated.

QR generation uses the vendored MIT-licensed Project Nayuki encoder (https://www.nayuki.io/page/qr-code-generator-library). Tests use MIT-licensed jsQR 1.4.0. Licenses are preserved. No online QR or photo service receives the records.

The supplied logo and mockup are preserved in assets/ and design-references/. The interface now follows their navy/orange styling, photo cards and bottom navigation for implemented screens.

Unsaved entries now keep a device draft of vehicle fields and the selected photo in IndexedDB. Drafts restore in the same browser/origin after reloading and clear after a confirmed save. This is not shared storage. Private browsing or storage restrictions may prevent draft saving; the form displays that limitation.
