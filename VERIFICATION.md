# Verification — October 4, 2026

Seven automated tests pass with `node --test tests/*.test.mjs`.

- Required fields, VIN/year validation, normalization, duplicate protection, search across all six fields and legacy storage handling.
- Independent jsQR decoder reads exact unit URLs from generated QR pixels for localhost, private IP and HTTPS addresses.
- Shared API test uses two distinct client origins, simultaneous duplicate creation (one accepted), shared read/update/photo bytes, stale version conflict, invalid photo rejection, atomic import rollback and idempotent import, database reopening after server shutdown, and private database URL rejection.
- Photo and edited record persist after server/database restart.

Browser verification:
- Imported earlier two demo records through the explicit migration button. Browser originals remain untouched.
- Entered a clearly labeled 2018 Jayco DEMO-PHOTO-003 record with a synthetic test reference image; saw entry preview and saved through Save and generate QR.
- Generated network QR URL and opened its exact unit route at http://192.168.1.237:3000 from another browser origin; reference image and six fields appeared.
- Manual Inventory search for 2018 opened the same record/photo. All six search fields also verified automatically.
- Edited color and reselected reference photo through network origin; saved successfully.
- Restarted the live server and confirmed edited color and photo still display; image natural width 800.
- Applied supplied logo and mockup styling. Logo loads; inventory and entry checked at 390 × 844 with no horizontal overflow. Six required text fields, optional photo input and Save and generate QR remain available. Bottom navigation opens implemented Inventory/Add unit screens.

Saved previews: updated-phone-preview.jpg and shared-photo-preview.jpg. Photo is a labeled test image, not an actual Jayco photograph. Physical printer output and a real phone camera have not been automated. Server is a computer-hosted, unauthenticated development prototype; production accounts/access controls and movement condition-photo workflows remain future work.

Menu/navigation update: Nine tests passed. Initial page embeds safely escaped JSON inventory from the same database, avoiding a second request before showing records. Browser verified Menu, Add unit, and return to Inventory with the server deliberately stopped; failed refresh preserved the loaded list. Server restarted after the check. Latest HTML uses versioned script/style URLs so reopening the remote page loads the new navigation. Phone authenticated session still requires user confirmation.

Save/sign-in handling: corrected overly broad redirected-response check; successful JSON redirects now accepted. Regression test passes; ten tests total. Added IndexedDB drafts for entered fields and selected reference photo. Browser verified restoring both after reload. Genuine remote session expiry still requires sign-in; phone session has not been reproduced. Existing old forms must be copied before first reload because that page lacks the draft update.

Native browser saving: added same-origin POST /save-unit with the existing validation, photo handling, and duplicate/version protection. Ten tests pass, including native photo creation, duplicate rejection and editing. Local browser saved DEMO-NATIVE-004 with restored test photo and reached its QR screen. Successful submission clears its draft and removes the one-time query marker. Remote authenticated iPhone behavior remains unverified; user retry required. Generic HTTP 500 responses no longer claim the sign-in has expired.

Remote save retry: user's Safari native save returned a remote Network connection lost stack page. Server remained running; no new user unit in inventory. Restored JSON saves with in-form error handling and device drafts to avoid navigation to tunnel error pages. Ten automated tests pass. Underlying authenticated remote transport failure remains unresolved.

Device login: enabled server-side email/password gate on all app/API/photo routes; scrypt password hash, random 256-bit session token stored hashed, HttpOnly/Secure public-host cookie, 30-day expiry persisted across restart, same-origin submission checks, throttled login attempts and logout revocation. Eleven tests pass. Replaced email-gated tunnel with app-protected tunnel https://students-handed-incoming-barbie.trycloudflare.com/. Browser remotely signed in and saved DEMO-REMOTE-005 to QR screen. iPhone remains user verification. Previous-origin drafts do not migrate automatically.

Departure/return prototype: 12 tests passed, including required photo rejection, active-trip conflicts, immutable SQL history/points, correction notes, post-return GPS rejection and restart durability. Browser completed departure and return for DEMO-REMOTE-005 using a synthetic test image; displayed both condition photos and returned status At dealership. Actual GPS permission, capture, native background tracking, and dealership employee authorization have not been verified/implemented. Server restarted with the new trip API and module. Browser times explicitly use America/Phoenix.

Profile identity: 12 tests pass. Regression posts a forged employee name/ID/email and verifies the event stores the authenticated account identity instead. Missing app-session identity blocks trip/correction/GPS writes; temporary tunnel code alone is insufficient. Original demo identities remain preserved and are labeled unverified.

Sold/archive and 30-day history retention: 13 tests pass. Verified sale marking is blocked during active trips, stale versions conflict, sold units reject departure, restore cancels pending cleanup, 29-day retention retains records, 31-day retention removes only eligible sold-unit events/points/condition photos, reference photo/basic unit survive, cleanup is repeatable, and restored units may start new trips. No live unit history was deleted in verification.

Company header: reads dealership name from authenticated server profile; uses textContent to avoid HTML injection and hides when no company is assigned. Auth test verifies configured company Freedom RV is returned for its signed-in account. Existing temporary gate has no dealership profile and does not display a fabricated company name. Dealership isolation/multi-account onboarding still pending.
