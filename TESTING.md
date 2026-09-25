# Testing the app, A to Z

Three targets, in the order they are worth doing: the **Windows emulator** (fastest to get
working), an **Android phone** (the only honest test of GPS, camera and push), and **iOS**
(which needs the most setup and cannot be built on this machine).

Read [§A](#a-before-anything) first regardless of target — the backend and networking steps are
shared, and nearly every "the app won't connect" problem comes from skipping them.

---

## A. Before anything

### A1. Restart WSL, once

WSL2 defaults to NAT: it sits on its own private subnet, so a server inside it is invisible to
your phone, and Metro inside it cannot see an emulator running on Windows.
`C:\Users\<you>\.wslconfig` has already been written to fix that. **In PowerShell:**

```powershell
wsl --shutdown
```

Reopen your terminal, then confirm:

```bash
hostname -I
```

You want your LAN address (something like `192.168.1.50`). If it still starts `192.168.84.`,
mirrored networking has not taken effect — check the file exists and shut WSL down again.

### A2. Make the API listen on every interface

`127.0.0.1` means "only this machine". In `/var/www/zassdelivery`, find the `listen` call in
`src/main.ts` and make it:

```ts
await app.listen(3002, "0.0.0.0");
```

Then start it:

```bash
cd /var/www/zassdelivery && npm run start:dev
```

### A3. Prove the API is reachable

From WSL:

```bash
curl -s http://localhost:3002/api/v1/health | head -c 200
```

Then from your phone's browser, using the address `hostname -I` gave you:

```
http://192.168.1.50:3002/api/v1/health
```

**If the phone cannot load that, stop here.** No amount of app debugging will help — it is a
networking or firewall problem, and [§E](#e-when-something-does-not-work) covers it.

### A4. Seed accounts

All seeded accounts use the password **`Zass@1234`**. You need at least two to test properly:

| Phone | Role | Use it for |
| --- | --- | --- |
| `03001234567` | Customer | Browsing, cart, checkout, tracking |
| `03009876543` | Rider | Offers, deliveries, location reporting |
| `03005551234` | Vendor owner | Order queue, menu, billing |
| `03005551236` | Vendor staff | Checking that billing is *refused* |

The API accepts `03001234567`, `923001234567` and `+923001234567` — all three are worth trying
on the sign-in form.

### A5. Why you need a development build, not Expo Go

**Expo Go will not run this app.** It ships a fixed set of native modules, and this app uses
several it does not include: `react-native-maps`, `expo-secure-store`, background
`expo-location`, `expo-notifications`. In Expo Go the app would crash on launch at the keychain
read.

A **development build** is your own app binary containing those native modules, with the same
live-reload workflow as Expo Go. You build it once and reinstall only when native dependencies
change — JavaScript edits reload instantly, exactly as before.

---

## B. Android emulator on your PC

The fastest path, and enough for most UI work. GPS and camera are simulated.

### B1. Start the emulator from Android Studio

Android Studio → **Device Manager** → ▶ on your AVD. Use an API 34+ image; the app targets
SDK 36 and `minSdkVersion` is 24.

### B2. Check WSL can see it

```bash
adb devices
```

You should see `emulator-5554  device`. Empty list → WSL was not restarted after `.wslconfig`
(§A1). This works *because* mirrored networking shares localhost with Windows.

### B3. Build and install

```bash
cd /var/www/zassdeliver-mobile
npx expo run:android
```

The first run compiles the native project (`android/` is generated here, which is why it is
gitignored) and takes 5–15 minutes. Later runs are fast. This builds entirely in WSL using the
JDK and SDK in your home directory — no cloud, no Android Studio involvement beyond the
emulator itself.

### B4. Day-to-day

```bash
npx expo start --android
```

- `r` reloads, `j` opens the debugger, `m` toggles the dev menu.
- In the emulator, **Ctrl+M** (or shake) opens the dev menu.

### B5. Faking location in the emulator

Emulator → **⋯** (extended controls) → **Location** → set a lat/long and **Send**. Good enough
to see the customer map draw. Not good enough to test rider tracking, because you cannot
produce a realistic stream of moving fixes — use a real phone for that.

---

## C. Android phone

The real test. Real GPS, real camera, real performance on the hardware your users have.

### C1. Turn on developer options

Settings → About phone → tap **Build number** seven times. Then Settings → System → Developer
options → enable **Wireless debugging**.

### C2. Pair the phone with WSL

In Developer options → Wireless debugging → **Pair device with pairing code**. It shows an
IP:port and a six-digit code. In WSL:

```bash
adb pair 192.168.1.42:37105     # the pairing port, then enter the code
adb connect 192.168.1.42:5555   # the other port shown on the main screen
adb devices
```

The phone must be on the same Wi-Fi as your PC. Pairing is once per phone; `adb connect` is
once per reboot.

### C3. Install the app

Either build locally over that adb connection:

```bash
npx expo run:android --device
```

Or build in the cloud and install the APK by hand — better if local builds are slow:

```bash
npm install -g eas-cli
eas login                                    # free Expo account
eas init                                     # writes EAS_PROJECT_ID
eas build --profile development --platform android
```

EAS gives you a URL and a QR code; open it on the phone and install the APK. You will need to
allow installing from that source once.

### C4. Connect to Metro

```bash
npx expo start
```

Scan the QR code with the **dev build itself** (not the Expo Go app). It connects over your LAN.

### C5. Grant the permissions deliberately

The app asks for each one at the moment it is needed, not on launch, so test them in order:

| Permission | Triggered by |
| --- | --- |
| Location (while using) | Profile → Add an address → *Use my current location* |
| Location (always) | Rider → accept an offer (the run starts) |
| Camera | Profile → Profile photo → *Take a photo* |
| Photos | Profile → Profile photo → *Choose from library* |
| Notifications | First launch of the rider or vendor portal |

On Android 11+, "always allow" location cannot be granted from the in-app prompt — it opens
Settings. That is an OS rule, not a bug, and the rider screen says so.

### C6. A standalone APK for testers

The development build needs Metro running on your PC. To hand someone an app that works on its
own, build the **preview** variant — it installs as "ZassDeliver (Preview)" alongside the dev
build.

A standalone build has no dev server to infer the API host from, so the API origin is
**compiled in**. Change it and you rebuild.

**Locally, in WSL:**

```bash
npm run apk                                  # API on this machine's LAN IP, port 3002
npm run apk -- https://api.zassdeliver.com   # or any other origin
adb install -r dist/zassdeliver-preview.apk
```

The script refuses a WSL NAT address (§A1), checks the API answers, and warns if the Maps key
is missing. The first build downloads Gradle and every Maven dependency (~30+ minutes on a slow
link); after that a rebuild takes about 8 minutes. The APK is ~140 MB because it carries all four
CPU architectures, so the same file runs on phones and on the x86_64 emulator. The APK is signed with the debug keystore — fine for sideloading, not for the Play
Store.

**On EAS:** `.env` is gitignored, so the cloud build never sees it. Put the values in the
`preview` environment once:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_API_URL     --value https://api.zassdeliver.com/api/v1 --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SOCKET_URL  --value https://api.zassdeliver.com        --visibility plaintext
eas env:create --environment preview --name GOOGLE_MAPS_ANDROID_KEY --value <key>                              --visibility secret
eas env:create --environment preview --name EAS_PROJECT_ID          --value <id>                               --visibility plaintext
eas build --profile preview --platform android
```

Dev and preview builds allow plain `http://` (a LAN API); production builds do not, on either
platform — that is `ALLOW_CLEARTEXT` in `app.config.ts`.

---

## D. iOS

### D1. What is and is not possible from Windows

| | Possible here? |
| --- | --- |
| iOS Simulator | **No.** Needs macOS and Xcode. There is no workaround. |
| Building the iOS app | **Yes, via EAS** — Expo compiles it on their Macs. |
| Installing on your own iPhone | **Yes**, with an Apple Developer account. |
| TestFlight / App Store | **Yes**, via EAS Submit. |

You cannot avoid the **Apple Developer Program ($99/year)** for anything installed on a real
device. That is Apple's rule, not Expo's.

### D2. One-time Apple setup

1. Enrol at [developer.apple.com/programs](https://developer.apple.com/programs/).
2. Create the app in [App Store Connect](https://appstoreconnect.apple.com) with bundle ID
   `com.zassdeliver.app`.

EAS handles certificates and provisioning profiles for you — let it, rather than creating them
by hand.

### D3. Register your iPhone, then build

```bash
eas device:create          # follow the link on the iPhone to register it
eas build --profile development --platform ios
```

`eas device:create` matters: an iOS development build only installs on devices listed in its
provisioning profile. Skip it and the build succeeds and then refuses to install.

Open the build URL on the iPhone and install, then `npx expo start` and scan.

### D4. TestFlight, for other people

```bash
eas build --profile production --platform ios
eas submit --platform ios --latest
```

TestFlight is how you get the app to testers without a Mac each. Internal testers (up to 100)
need no App Review; external testers do.

### D5. iOS-specific things worth testing

- **Keychain.** Force-quit and reopen — you should still be signed in. This is the path
  `store/auth-store.ts` splits tokens across keys for, because iOS rejects large keychain
  values.
- **Apple Maps.** iOS uses Apple Maps, Android uses Google — the tracking screen renders
  through two different SDKs and needs looking at on both.
- **Background location.** Lock the phone mid-delivery, wait two minutes, unlock. Tracking
  should have continued.

---

## E. When something does not work

| Symptom | Cause and fix |
| --- | --- |
| "No connection to ZassDelivery" | The API is unreachable from the device. Redo §A3 from the phone's browser. |
| App loads, every request fails | API bound to `127.0.0.1`. See §A2. |
| `adb devices` is empty | WSL not restarted after `.wslconfig` (§A1), or the phone is on a different Wi-Fi. |
| Metro QR code will not connect | Phone and PC on different networks, or Windows Firewall is blocking port 8081. Try `npx expo start --tunnel`. |
| Crash on launch, keychain error | You are using Expo Go. Build a development build (§A5). |
| **Order screen shows a route card, not a map** | Missing `GOOGLE_MAPS_ANDROID_KEY` in `.env`. The app deliberately skips the map: a Google `MapView` without a key crashes on Android. Get a key from Google Cloud Console, enable **Maps SDK for Android**, then rebuild — it is compiled in, so Metro reload is not enough. |
| Rider marker never appears | The rider has not accepted a run, or denied location. Check the rider dashboard for the location warning. |
| Rider marker frozen | Look for the amber "Not receiving live updates" banner on the tracking screen. That is the socket, not the rider. |
| Changes do not appear | JS changes reload; native config (`app.config.ts`, plugins, new native deps) needs a rebuild. |
| `EMFILE: too many open files` | WSL file-watcher limit. `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p` |

---

## F. Testing live tracking properly

This is the one feature that genuinely needs **two sessions at once**, because it spans two
roles. Use the emulator for the customer and your phone for the rider — the rider is the side
that needs real GPS.

1. **Emulator, as customer** (`03001234567`): order from a restaurant, and stay on the tracking
   screen. The map shows the restaurant pin; there is no rider yet.
2. **Phone, as rider** (`03009876543`): go online. Accept the offer when it arrives — you have
   about 30 seconds, and the countdown turns red at 15.
3. **Grant "always allow" location** when asked. This is the moment tracking depends on.
4. **Watch the customer screen.** Within ~15 seconds a purple rider marker appears and the
   "Live" badge shows. The marker *slides* rather than jumping — that is `AnimatedRegion`
   interpolating between fixes.
5. **Walk or drive** a few hundred metres. The marker follows, and the distance under the
   rider's name counts down.
6. **Lock the phone.** Updates should continue — that is the foreground-service notification
   doing its job. This is the step most worth doing, because it is the one that breaks.
7. **Rider: "I'm on the way", then "I'm at the door".** A four-digit code goes to the customer.
8. **Enter the code.** The order completes, the map disappears from the customer's screen, and
   the rider's earnings go up.

### Checking the two halves separately

**Is the rider reporting?** Watch the API log for `PUT /riders/me/location` (background) or the
socket for `rider:location` (foreground). No requests means a permission problem.

**Is the customer receiving?** The connection banner is the tell. No banner and no marker means
the rider is not reporting; a banner means the socket is down at the customer's end.

---

## G. A quick pass over everything else

Worth ten minutes before any release.

**Customer** — browse restaurants, filter by open-now, open a restaurant, add a dish with
variants *and* a required add-on group (the Add button must refuse until the group is chosen),
apply a coupon in the cart, check out, watch the order, cancel one.

**Rider** — go online, accept and decline offers, work a run end to end, check the earnings
ledger against what the run paid, request a withdrawal, cancel it.

**Vendor** — accept a new order, start cooking, mark it ready, mark a dish sold out and confirm
it disappears from the customer menu, adjust stock, change opening hours, add a payment QR code.

**Cross-cutting** — force-quit and reopen (still signed in), turn on aeroplane mode mid-browse
(the offline copy, not a crash), switch to dark mode in Profile → Appearance, sign in as
`03005551236` (vendor staff) and confirm **Billing** is refused rather than merely hidden.
