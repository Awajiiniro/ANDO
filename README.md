# ANDO

ANDO is a local test messenger with browser-side end-to-end encryption, 24-hour disappearing messages, and a privacy-focused interface.

## Run

For the React UI with auth, run the full dev stack from the project root:

```powershell
npm.cmd run dev
```

This starts the API on `http://127.0.0.1:3000` and the Vite UI on `http://127.0.0.1:5173`. If you run only the UI dev server, login/register will fail with a Vite proxy `ECONNREFUSED` error because `/api/auth/*` has no backend to reach.

On this Windows workspace, the older static test UI can also use the built-in PowerShell backend:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -Port 3000
```

Then open:

```text
http://localhost:3000
```

If Node.js is installed, this also works:

```powershell
npm start
```

## Testing Conversations

Open ANDO in two different browsers or browser profiles so each profile gets a separate local private key. Save a different display name in each window, then select the other tester from the people list and send a message.

## Security Model

- Messages are encrypted in the browser using ECDH P-256 key agreement and AES-GCM.
- The backend stores encrypted envelopes only: sender, recipient, sender public key, ciphertext, IV, creation time, and expiry time.
- Messages expire after 24 hours and are pruned by the backend.
- The screen guard deters screenshots with blur shielding, print blocking, context-menu/copy blocking, and capture-key handling.

Important: a web app cannot fully prevent operating-system screenshots or screen recording. Real enforcement requires native mobile or desktop APIs such as Android `FLAG_SECURE`, iOS screen-capture detection, or platform-specific desktop controls.
