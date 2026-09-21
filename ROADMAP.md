# ZassDeliver Mobile — build roadmap

React Native (Expo SDK 57) app for Android + iOS, reaching the same NestJS API at
`/var/www/zassdelivery` that the Next.js web app uses.

## Decisions taken

| Decision | Choice | Why |
| --- | --- | --- |
| Framework | **Expo SDK 57** (RN 0.87.1), not bare RN CLI | iOS has to be built on macOS. EAS Build compiles it on Expo's Macs, which is the only way to ship iOS from a Windows machine. Config plugins also beat hand-editing Gradle and Xcode projects. |
| Routing | **expo-router 57** (file-based) | Same mental model as the Next.js `app/` directory, so the 51-route map ports across almost name-for-name. |
| Styling | **NativeWind 4** | Tailwind class names, so the web app's design tokens and utility classes carry over instead of being rewritten as `StyleSheet` objects. |
| Data layer | **Copied and adapted** from the web app | `lib/api`, `types`, `hooks` and `lib/socket` are already platform-agnostic (axios + TanStack Query + zustand + socket.io-client). Zero risk to the live web app. See [Drift risk](#drift-risk). |
| Portals | **Customer, Rider, Vendor** | The 23 screens that are actually built and actually mobile. Admin is a desktop sidebar dashboard whose content is 12/13 placeholder on the web — it stays there. |
| iOS delivery | **EAS Build → TestFlight** | Needs an Apple Developer account ($99/yr) and a free Expo account. |
| Dev targets | Windows emulator **and** a physical Android phone | Emulator for fast UI work; the phone for GPS, camera and push, which emulators fake badly. Rider tracking cannot be validated on an emulator. |

## Why not bare React Native CLI

You could, and you would keep full control of `android/` and `ios/`. But you would also need
a Mac to produce a single iOS build, forever. Expo's prebuild (Continuous Native Generation)
still gives you real native projects on demand — `npx expo prebuild` writes `android/` and
`ios/` whenever you need to inspect or patch them — so this is not the sandboxed Expo of years
past. Every native library this app needs (maps, camera, background location, push, secure
storage, QR) has a config plugin or is in the Expo SDK.

---

## Status

**Phases 0–6 are complete.** Every screen in the customer, rider and vendor portals is
built on live data — there are no placeholders left in `src/app`.

Live rider tracking works end to end: the rider's phone reports its position (socket in the
foreground, `PUT /riders/me/location` from a background task when the screen is off) and the
customer watches an interpolated marker on a map. See [TESTING.md](TESTING.md) §F for how to
exercise it with two devices.

Remaining: **Phase 7** push notifications, QR scanning and deep links, and **Phase 8**
store release.

Verified: `tsc --noEmit` clean, `eslint` 0 errors, `expo-doctor` 21/21, drift check in step,
and the app bundles for Android (4,024 modules → 8.1 MB Hermes bytecode).

---

## Phase 0 — WSL toolchain

Nothing is installed with `sudo`; everything lands in `$HOME`, so WSL stays disposable.

- [x] JDK 17 (Temurin) → `~/.local/share/jdk`
- [x] Android SDK command-line tools → `~/Android/Sdk`
- [x] `platform-tools`, `build-tools;36.0.0`, `platforms;android-36`, NDK
- [x] `ANDROID_HOME`, `JAVA_HOME`, `PATH` in `~/.bashrc`
- [x] Accept SDK licences
- [x] `.wslconfig` with mirrored networking (lets Metro in WSL reach the Windows emulator)
- [ ] Wireless debugging paired with the physical phone *(needs the phone to hand)*

**Why a second SDK inside WSL** when Android Studio already has one on Windows: Gradle cannot
build a Linux-side project against a Windows-side SDK. Path separators, executable bits and
`/mnt/c` I/O latency all break it. The two SDKs coexist; Android Studio keeps using its own for
the emulator and the AVD manager.

## Phase 1 — Scaffold

- [x] `create-expo-app` with the TypeScript template
- [x] expo-router, NativeWind, Reanimated, safe-area, gesture-handler
- [x] `app.config.ts` (dynamic, so env drives bundle IDs and API URLs)
- [x] Directory layout mirroring the web app
- [x] `tsconfig` path aliases (`@/*`) matching the web app so copied files need no import edits
- [x] ESLint + Prettier, `typecheck` script

## Phase 2 — Data layer port

- [x] `types/*` — copied verbatim (17 files, pure TypeScript)
- [x] `lib/api/*` — copied verbatim (16 modules)
- [x] `lib/api-client.ts` — adapted: same refresh-rotation logic, RN-safe `FormData`
- [x] `store/auth-store.ts` — **rewritten**: `localStorage` → `expo-secure-store`, async storage means rehydration is genuinely async
- [x] `lib/socket.ts` — adapted: add foreground/background reconnect handling
- [x] `hooks/*` — copied, minus the DOM-dependent ones
- [x] `lib/env.ts` — `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`, with LAN-IP resolution for device testing

The single biggest correctness risk in this phase: the web store persists tokens
**synchronously**, so `hydrated` flips in the same tick. SecureStore is async, so every route
guard has to wait on it or the app will bounce a signed-in user to the login screen on cold
start.

## Phase 3 — Auth and navigation shells

- [x] Root layout: providers (QueryClient, auth, theme, toast), splash held until hydrated
- [x] `(auth)` group — login, register with role selection
- [x] Role-based redirect to the right portal on sign-in
- [x] Route guards per portal group
- [x] The vendor/rider **gates** (not registered / pending / rejected / suspended)
- [x] Session-lost handler wired to the axios interceptor
- [x] Bottom tab navigators, one per portal

## Phase 4 — Customer app

- [x] Home (cuisines, open now, top rated)
- [x] Restaurant list — search, cuisine, price, open-now, infinite scroll (replaces web pagination)
- [x] Restaurant detail — menu by category, item sheet, add to cart
- [x] Cart — quantities, coupon entry
- [x] Checkout — address, payment method, place order
- [x] Orders — active / previous
- [x] **Order tracking** — status timeline, rider position on a live map, realtime
- [x] Favorites, Offers, Notifications, Profile
- [x] Legal screens (Privacy is mandatory for App Store review)

## Phase 5 — Rider app

- [x] Dashboard — availability switch, earnings summary, active run
- [x] Offers — per-offer countdown, accept/decline, realtime + push
- [x] Deliveries — pickup → delivery-code steps, history
- [x] Earnings ledger, Wallet, Withdrawals (request / track / cancel)
- [x] Support tickets and threads
- [x] **Background location** reporting to `rider:location`

## Phase 6 — Vendor app

- [x] Dashboard — live counts, today's takings, accepting-orders switch
- [x] Order queue — new / cooking / ready, realtime, with sound and push
- [x] Menu — search, status filter, sold-out, stock adjustment
- [x] Staff — owner creates kitchen accounts
- [x] Settings — profile, hours, gallery (camera upload), payments (QR)
- [x] Billing — monthly platform fee, pay-to QR, history (renders while suspended, owner-only)
- [x] Support

## Phase 7 — Native capabilities

- [ ] Push notifications (`expo-notifications` + FCM + APNs), registered per role
- [x] Camera / image picker → the existing `/uploads` multipart endpoint
- [x] Maps (`react-native-maps`, Google on Android, Apple on iOS) replacing Leaflet
- [ ] QR display and scanning (`expo-camera`)
- [ ] Deep links and universal links (`zassdeliver://order/[id]`)
- [ ] Offline handling and optimistic cart

## Phase 8 — Production release

- [ ] Icons, adaptive icon, splash
- [ ] EAS profiles: `development`, `preview`, `production`
- [ ] Dev client build for the phone
- [ ] Android: AAB, Play signing, internal testing track
- [ ] iOS: TestFlight
- [ ] OTA updates (`expo-updates`) with release channels
- [ ] Sentry, and API error reporting keyed on `requestId`
- [ ] Store listings, privacy questionnaires, screenshots

---

## Drift risk

The data layer is duplicated. When the API changes, both copies need it. Guard rails:

1. Every copied file keeps a header comment naming its web-app origin.
2. `scripts/check-api-drift.sh` diffs the copied files against the web app and fails loudly.
3. When the duplication starts costing more than the refactor would, promote to npm workspaces
   with `packages/core` — the copied files are already written to make that a move, not a rewrite.

## Environment reference

| Thing | Value |
| --- | --- |
| API | `http://<LAN-IP>:3002/api/v1` |
| Socket | `http://<LAN-IP>:3002` |
| Web app dev | `http://localhost:8005` |
| JDK | `~/.local/share/jdk` |
| Android SDK (WSL) | `~/Android/Sdk` |
| Android SDK (Windows) | `/mnt/c/Users/<you>/AppData/Local/Android/Sdk` |

`localhost` is meaningless to a phone on your LAN, so the API URL must be your machine's LAN IP
even in development. The NestJS server also has to bind `0.0.0.0`, not `127.0.0.1`.
