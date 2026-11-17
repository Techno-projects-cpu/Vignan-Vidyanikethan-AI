# Getting Vignan Vidyanikethan AI onto a phone or a laptop

The app is a website that installs itself, plus two optional build routes for a
real `.apk` or `.exe`. This page says exactly what works today, what needs a
build machine, and what does **not** exist, so nobody downloads a promise.

---

## 1. Install it today — no build, no store, no account

This is a Progressive Web App (PWA). Installing it gives you:

- an icon on the home screen or Start menu,
- a full-screen window with no browser address bar,
- the whole app cached on the device, so it opens with the network off,
- the same data as the browser tab (books, decks, chats stay on the device).

**Android (Chrome, Edge, Samsung Internet)**

1. Open the site while online.
2. Tap the **⋮** menu (Chrome) or **⋯** (Samsung) → **Add to Home screen** /
   **Install app**.
3. Confirm. The icon appears with the rest of your apps.

**iPhone / iPad (Safari)**

1. Open the site in Safari (not an in-app browser).
2. Tap **Share** → **Add to Home Screen**.
3. Confirm.

**Windows / macOS / Linux (Chrome or Edge)**

1. Open the site.
2. Click the **install** icon in the address bar (a small screen with an arrow),
   or **⋮** → **Cast, save and share** → **Install page as app** in Chrome,
   **⋯** → **Apps** → **Install this site as an app** in Edge.

The same sheet is inside the app: **logo (bottom-left) → Install the app**. If
the browser offers its own install prompt, a button appears there too.

---

## 2. A real Android `.apk`

Not built in this repository, because a `.apk` needs the Android SDK, a JDK and a
signing key — none of which exist on a static host. The app is already a
self-contained static folder, so wrapping it is a short job on any machine:

```bash
# on a machine with Node 18+, a JDK 17 and Android Studio installed
npm install --no-save @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Vignan Vidyanikethan AI" ai.vignan.study --web-dir=.
npx cap add android
npx cap open android      # builds in Android Studio; Run ▶ installs on a phone
```

Then build a signed release:

```bash
cd android && ./gradlew assembleRelease
# app/build/outputs/apk/release/app-release-unsigned.apk
```

Notes that matter for this app:

- **Serve it from a real path.** Capacitor's `web-dir` must contain `index.html`
  at the root, which this repository already does. The service worker still
  works inside Capacitor's WebView, so offline mode behaves the same.
- **File picking works** through the WebView's document picker, so PDF upload
  from the phone's Downloads folder is unchanged.
- **The local model stays a download.** WebLLM loads its weights at runtime; a
  build that ships the weights inside the APK is 300 MB–1 GB larger. Keep the
  download, or bundle one small model only (`SmolLM2-135M`).
- **Android TV / older WebViews** may not have WebGPU: the cited-excerpt engine
  still answers offline, which is the fallback the app already documents.

## 3. A real Windows `.exe`

Same idea, different wrapper. Tauri produces a small installer (a few MB) using
the system WebView2; Electron produces a large one but needs nothing installed.

```bash
# Tauri (recommended: small, uses the Windows WebView2 runtime)
npm install --no-save @tauri-apps/cli
npx tauri init --app-name "Vignan Vidyanikethan AI" --frontend-dist . --dev-url http://localhost:8787
npx tauri build
# src-tauri/target/release/bundle/msi/*.msi and *.exe
```

- Tauri's window and WebView2 both support service workers, so the offline cache
  works. Start the local server with `npm start` during `tauri dev`, or point
  `--frontend-dist` at this folder for the packaged build.
- Electron works too (`npx electron-packager .`), but the installer is ~100 MB
  before the app does anything.

## 4. What a packaged build would **not** change

Being an `.apk` or an `.exe` does not make answers better or offline answers
bigger. What it changes is how the app is delivered:

| | Website / PWA | APK | EXE |
| --- | --- | --- | --- |
| Opens full screen | yes, after install | yes | yes |
| Works offline | yes, cached on first visit | yes | yes |
| Local model | downloaded once | downloaded once (or bundled) | downloaded once (or bundled) |
| Updates | automatic, every visit | you publish a new APK | you publish a new installer |
| Store listing | none | needs a Play Console account | none (or the Microsoft Store) |
| Cost | $0 | $25 one-off for Play | $0 (or ~$19 for a code-signing certificate) |

That last row is why the website stays the primary build: it reaches every
student, updates itself, and costs nothing. The APK and the EXE are packaging
choices for a school that wants an icon it can hand out, not a different app.

---

## 5. Checking a build

Whatever the wrapper, the same checks apply:

1. Open the app with the network off — the starter shelf and cited answers must
   still work.
2. **Logo → Settings → App & offline → Check offline readiness** should read
   *Ready · N/N files*.
3. Ask one question from a starter page and open its citation.
4. If the local model is bundled, disconnect the network before opening
   **Settings → Real local model** and confirm it reports the cached model.
