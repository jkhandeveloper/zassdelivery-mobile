# ZassDeliver Mobile

The Android and iOS app, built on Expo SDK 57 / React Native 0.86, talking to the
same NestJS API as the web app at `/var/www/zassdeliver-frontend`.

See [ROADMAP.md](ROADMAP.md) for what is built and what is not.

---

## One-time setup

Phase 0 of the roadmap is already done in this WSL instance: JDK 17 lives in
`~/.local/share/jdk`, the Android SDK in `~/Android/Sdk`, and `JAVA_HOME` /
`ANDROID_HOME` are exported from `~/.bashrc`. Nothing was installed with `sudo`.

Two steps remain, and both are on the Windows side.

### 1. Restart WSL so it can reach your phone

WSL2 defaults to NAT: it sits on its own private subnet, so a server running
inside it is invisible to everything else on your network. Your phone asking for
the API would get nowhere.

`C:\Users\<you>\.wslconfig` has been written to switch WSL to *mirrored*
networking, which gives it the Windows host's own network interfaces. **In
PowerShell:**

```powershell
wsl --shutdown
```

Then reopen your terminal. To undo this, delete the file and shut down again.

Check it worked — `hostname -I` should now report your LAN address (something
like `192.168.1.50`) rather than a `192.168.84.x` WSL address.

### 2. Bind the API to all interfaces

The API must listen on `0.0.0.0`, not `127.0.0.1`, or it will only answer
requests from inside WSL. In `/var/www/zassdelivery`:

```ts
await app.listen(3002, "0.0.0.0");
```

---

## Running it

Three things need to be up: the API, Metro, and a device.

```bash
# 1. The API (in /var/www/zassdelivery)
npm run start:dev

# 2. Metro (here)
npx expo start
```

You do **not** need to set `EXPO_PUBLIC_API_URL` for local development.
`src/lib/env.ts` derives the API host from whichever machine served the JS
bundle — which is by definition reachable from the device, because that is how
the app got there. Set it explicitly only when the API is somewhere else.

### On a physical phone

Real GPS and a real camera, which is the only way to test rider tracking and
the QR scanner properly.

The first run needs a **development build**, not Expo Go, because this app
contains native modules Expo Go does not ship (maps, secure store, background
location):

```bash
npx eas build --profile development --platform android
```

Install the resulting APK, then `npx expo start` and scan the QR code. You only
rebuild when native dependencies change — JavaScript changes reload instantly.

To debug over USB instead of Wi-Fi, enable wireless debugging on the phone
(Developer options → Wireless debugging) and:

```bash
adb pair <phone-ip>:<pairing-port>
adb connect <phone-ip>:<port>
adb devices
```

### On the Windows emulator

Start the AVD from Android Studio first, then from WSL:

```bash
adb devices          # mirrored networking lets WSL see the Windows emulator
npx expo start --android
```

If `adb devices` is empty, WSL has not been restarted since `.wslconfig` was
written.

### Building locally instead of on EAS

Android can be built entirely in WSL, no cloud needed:

```bash
npx expo prebuild --platform android   # generates android/
npx expo run:android
```

`android/` and `ios/` are generated, not committed — they are rewritten from
`app.config.ts` on every prebuild, so edit the config or a plugin, never the
native project.

iOS cannot be built here at all; Apple requires macOS and Xcode. That is what
EAS Build is for.

---

## Layout

```
src/
  app/              expo-router routes, mirroring the web app's app/ directory
    (auth)/         login, register
    (customer)/     the public storefront + the customer's own screens
    (rider)/rider/  the rider portal, guarded
    (vendor)/vendor the vendor portal, guarded
  components/
    providers/      query, auth, realtime, theme — ported from the web app
    shared/         cross-screen pieces (cards, guards)
    ui/             the design system as touch targets
  hooks/            TanStack Query hooks, copied from the web app
  lib/
    api/            the 16 API modules, copied verbatim
    api-client.ts   axios + refresh-token rotation
    socket.ts       Socket.IO singleton + app-state reconnect
    env.ts          API host resolution
  store/            the auth store (keychain-backed)
  types/            the API's types, copied verbatim
```

## Scripts

| Command | What it does |
| --- | --- |
| `npx expo start` | Metro, for a device or emulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npx expo-doctor` | Checks dependency and config health |
| `./scripts/check-api-drift.sh` | Diffs the copied data layer against the web app |

## The shared data layer

`types/`, `lib/api/` and most of `hooks/` are **copies** of the web app's files,
not a shared package. That was a deliberate trade: it ships fast and cannot
break the live web app, at the cost of two copies to keep in step.

`./scripts/check-api-drift.sh` is what keeps that honest — run it after any API
change. When the duplication starts costing more than the refactor would, the
copied files are written to make promotion to an npm workspace a move rather
than a rewrite.

Four files are intentionally **not** identical, each for a platform reason:

| File | Why it differs |
| --- | --- |
| `store/auth-store.ts` | Tokens in the OS keychain, split across keys because iOS rejects large values. Rehydration is async. |
| `lib/api-client.ts` | Base URL from `env.ts`, 30s timeout, offline copy. |
| `lib/socket.ts` | Websocket-only transport, plus a reconnect on return to foreground. |
| `hooks/use-quick-add.ts` | `expo-router` instead of `next/navigation`. |
| `lib/business-types.ts` | `lucide-react-native` instead of `lucide-react` — same icon names. |
| `lib/api/uploads.ts` | React Native `FormData` takes `{ uri, name, type }`, not a DOM `File`. |
| `hooks/use-uploads.ts` | Same reason — the mutation takes an `UploadAsset`. |
| `hooks/use-geo.ts` | `expo-location` in place of `navigator.geolocation`. |

