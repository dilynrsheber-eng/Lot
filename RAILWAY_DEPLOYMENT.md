# Railway deployment preparation

Status: deployment files prepared; no Railway project created or published yet.

Use outputs/lot-rot as the build/source root. Docker image runs Node 24 and uses Railway's PORT. Mount a persistent volume at /data for the inventory database, reference photos stored in the database, and persistent login session configuration. Run one app replica. Do not upload local account.json, passwords, SQLite files, or draft/browser data into the source repository or Docker image.

Health check: /healthz, returns status only, with no inventory or session data. Production startup currently requires /data/account.json; missing configuration fails startup rather than exposing inventory. Never use --email-gated-tunnel on Railway: it is only for the locally protected temporary tunnel.

Remaining before publication:

- Railway connection/tools must be available in the chat and the intended workspace selected.
- Finish app email-code authentication with a configured email delivery provider. The existing Cloudflare quick-tunnel email gate cannot be transferred to Railway. Current Docker preparation deliberately does not bypass authentication.
- Create one app service and persistent /data volume, set up a public HTTPS domain, and configure email delivery secrets securely.
- Configure and verify volume backups and a database restore. Backups are not enabled by these source files. Choose retention and account for storage cost.
- Validate authenticated phone creation, photo upload, editing, QR link, sign-out, and persistence after a redeploy before declaring the migration complete.
- User review of the concrete paid resource setup before launching it; Railway Hobby is a $5 monthly minimum and resource usage can exceed it.

There are only labeled demo units in the current local inventory. Existing device drafts are tied to their previous tunnel/browser origin and do not move to the Railway domain automatically.
