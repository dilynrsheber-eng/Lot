# Temporary remote access

Active link: https://lenses-nam-myth-gary.trycloudflare.com

Cloudflare Protected Quick Tunnel admits only dilyn.r.sheber@gmail.com using an emailed one-time PIN. The computer still stores records/photos and must stay awake with both the Lot Rot server and tunnel running. This is temporary personal access, not employee/dealership authentication or production hosting. Local Wi-Fi access remains unauthenticated.

The hostname changes when the tunnel is restarted. Generate remote QR tags while using the HTTPS link, or set the tag base to that link. Earlier localhost/Wi-Fi QR tags do not work remotely. A protected QR link requires sign-in.

Tunnel tool is saved in ../../work/tunnel/cloudflared.exe. To restart from the projectless workspace root:

```powershell
& .\work\tunnel\cloudflared.exe tunnel --no-autoupdate --edge-ip-version 4 --protocol http2 --url http://127.0.0.1:3000 --allowed-mail dilyn.r.sheber@gmail.com
```

Stop the tunnel with Ctrl+C in its terminal to end remote access. No router port forwarding or Windows firewall changes were made.

Verified unauthenticated requests to the root, inventory API and photo API redirect to Cloudflare Access, rather than returning inventory/photo content. The user must complete the emailed-code sign-in; the authenticated remote session has not been tested by the agent.

Current access: https://students-handed-incoming-barbie.trycloudflare.com/ uses app email/password sign-in with 30-day browser sessions. Start server normally; it requires work/auth/account.json and fails startup if unavailable. Start cloudflared without --allowed-mail only while this app authentication is enabled. Credentials are hashed in work/auth/account.json; protect/back up this file locally. Keep computer awake and both processes running. Tunnel restart changes URL, so sessions and drafts on the old origin do not transfer. Menu has Sign out.

Restored email-code gate at user's request. Current link https://those-five-currencies-attend.trycloudflare.com/; allowed email dilyn.r.sheber@gmail.com. Server runs server.mjs --email-gated-tunnel, binding loopback only and bypassing app password gate. Use this mode ONLY behind cloudflared --allowed-mail. Previous password-protected tunnel stopped. Persistent background cloudflared launch was rejected by automatic approval policy; foreground tunnel remains temporary.
