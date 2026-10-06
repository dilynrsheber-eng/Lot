# Lot Rot — agreed scope and current increment

Phone-oriented vehicle movement and condition tracking for car dealerships, RV dealerships, and mixed inventory. Freedom RV is the proposed first pilot, not a connected customer in this build.

## Implemented
- Responsive entry, searchable inventory, detail and edit screens.
- Required year, make, model, color, stock number and VIN. Modern 17-character VIN validation; pre-1981 units need a future validation policy.
- Server-backed SQLite records with unique stock number/VIN, validation, durable writes and optimistic edit version checks.
- Optional reference photo: phone photo selection/camera where supported, entry preview, inventory thumbnail, detail display and editing replacement. JPEG/PNG/WebP up to 5 MB. Stored with the record in SQLite. This reference image is distinct from condition photos at movement checkpoints.
- Save and generate QR at the end of entry; also available from details. Stable unit links, printable stock number fallback, editable app address and print styling. Network-reachable links retrieve the same unit/photo from the shared server.
- Explicit import from untouched old browser storage, preserving IDs and blocking conflicting imports atomically.
- Manual search covers all six fields. Refresh loads other-device changes.

## Next increments
1. Individual employee accounts tied to a dealership, with dealership-level access controls, secure hosting, backup and upload hardening. Current unauthenticated computer-hosted server is a development prototype, not production/cloud storage.
2. QR scanning integrated into the app and pilot-ready printable tag placement: windshield for cars/motorhomes; entry door for trailers.
3. Exactly two movement checkpoints: departure from dealership and return to dealership, photos required at both. Associate employee ID, dealership ID, unit ID, reason, timestamps, condition notes, and photo references. One open departure per unit; return closes that movement. Validate photos and permissions on the server.

No off-site arrival/departure check-ins or moves within the lot. GPS, analytics, AI damage detection, insurance integration and billing are outside the first prototype.

## Structure
`app.mjs`: responsive UI and routing. `domain.mjs`: validation/search plus legacy storage reader. `qr.mjs`: unit links and SVG QR generation. `server.mjs`: static files and shared JSON/photo API. `store.mjs`: SQLite storage, validation, atomic import and photo bytes. `data/`: durable local database, excluded from source control.

Before pilot: agree condition questions/photo count, roles and retention; implement authentication, deployment, access controls, secure uploads and backups. Deletion is deliberately not exposed in this increment; create/read/edit are available.

## Supplied design references
The supplied logo is preserved at assets/lot-rot-logo.jpg and the app mockup at design-references/app-mockup.jpg. Applied navy branding, orange primary actions, gray/white backgrounds, rounded photo cards with prominent stock numbers, and bottom Inventory/Add unit navigation. Future movement, history, map and account concepts in the mockup are not implemented as placeholder screens. The agreed departure/return scope remains unchanged.
