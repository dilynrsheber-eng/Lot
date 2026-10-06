# Railway deployment

Project: Lot Rot App (d4e2b84c-c466-4a8a-9e73-05b37153a082).
Service: Lot Rot (4facf0da-6028-4a7d-9331-04a0b8ef0495).
Source: https://github.com/dilynrsheber-eng/Lot, main branch, repository root.
Public URL: https://lot-rot-production.up.railway.app

One replica with a 500 MB volume at /data. SQLite includes reference photos, trip photos and GPS records. Password hashes and sessions persist in /data/account.json; LOT_ROT_INITIAL_ACCOUNT initializes it only when missing. No local inventory or credentials are committed to GitHub. Never use --email-gated-tunnel in production.

HTTPS sign-in, unauthenticated API rejection, profile identity, photo upload and save-and-generate-QR redirect verified. Remaining: real-phone trial, backup scheduling and restore validation, individual employee accounts, and native background GPS. Automatic volume backups are not yet configured.
