# Publishing ZassDeliver to Google Play and the App Store

This guide takes the app from this repo to a live listing on both stores. It
is written for this project specifically: Expo SDK 57, EAS Build and Submit,
and the three build profiles already defined in `eas.json` and
`app.config.ts`.

| Profile       | Bundle ID / package             | Used for                                |
| ------------- | ------------------------------- | --------------------------------------- |
| `development` | `com.zassdeliver.app.dev`       | Dev client on your own phone            |
| `preview`     | `com.zassdeliver.app.preview`   | Internal testers (APK / ad hoc)         |
| `production`  | `com.zassdeliver.app`           | **The store build. Only this one ships.** |

You do not need a Mac. EAS builds and signs the iOS app in the cloud.

---

## 0. Blockers to fix before submitting

Both stores will reject the app, or hold it in review, until these are done.

### 0.1 In-app account deletion (required by both stores)

Apple (Guideline 5.1.1(v)) and Google Play (User Data policy) both require
that any app with account sign-up let users **delete their account from
inside the app**. Google also requires a **public web URL** where people can
request deletion without installing the app.

As things stand:
- The API only has admin soft-delete (`users.use-cases.ts`: "You cannot
  delete your own account").
- The mobile app has no "Delete account" action.

What's needed:
1. API: `DELETE /me` (or `POST /me/delete`) that soft-deletes the caller,
   revokes their tokens, and anonymises personal data (name, phone, email,
   photo). Order history can stay for accounting.
2. Mobile: a "Delete account" row in Profile with a confirmation step, for
   customers, vendors and riders.
3. Web: a page such as `https://zassdeliver.com/delete-account` that explains
   the steps and gives a contact route. This URL goes in the Play Console.

### 0.2 Production API over HTTPS

The production build turns off cleartext traffic (`ALLOW_CLEARTEXT` in
`app.config.ts`). The API must be reachable at a real HTTPS domain, e.g.
`https://api.zassdeliver.com/api/v1`, with a valid certificate. Socket.IO
must be served on the same HTTPS host.

### 0.3 Public privacy policy

The web app already has `/privacy`. Make sure it's live at a public URL, and
that it mentions **background location for riders**, camera use (QR scan),
photo uploads, push notifications, and which data is shared with vendors and
riders.

### 0.4 Vendor subscription paid outside the app (App Store risk)

Vendors pay the monthly platform fee by bank or wallet transfer and then
enter the transaction ID in the app (`vendor/billing.tsx`). Apple normally
requires digital subscriptions to go through In-App Purchase. Food ordering
itself is exempt, because it's a physical good or service (3.1.3(e)). The
vendor fee is a B2B platform charge, which is usually accepted, but a
reviewer may question it.

To reduce the risk:
- Keep the billing screen free of "Subscribe" or "Buy" wording. It already
  describes the transfer as a declaration, which helps.
- Explain it in the App Review notes (see step 2.8).
- If Apple still objects, a fallback is to hide the billing screen on iOS and
  send vendors to the web dashboard instead.

---

## 1. One-time setup (shared by both stores)

### 1.1 Accounts you need

| Account                     | Cost              | Notes |
| --------------------------- | ----------------- | ----- |
| Expo account (expo.dev)     | Free tier is fine | Holds the EAS project, builds and credentials |
| Google Play Console         | USD 25 one-time   | Register as an **Organization** if possible (see 3.1) |
| Apple Developer Program     | USD 99 / year     | An Organization account needs a **D-U-N-S number** (free, takes 1–2 weeks) |

Start the Apple and Google enrollments now. Identity checks can take days.

### 1.2 Install and link EAS

```bash
cd /var/www/zassdeliver-mobile
npm install -g eas-cli
eas login
eas init            # creates the project on expo.dev and prints the project ID
```

Copy the printed project ID into `.env` as `EAS_PROJECT_ID`.

### 1.3 Production environment variables on EAS

`.env` is gitignored, so cloud builds never see it. Put the production values
into the EAS `production` environment:

```bash
eas env:create --environment production --name EAS_PROJECT_ID \
  --value <project-id> --visibility plaintext

eas env:create --environment production --name EXPO_PUBLIC_API_URL \
  --value https://api.zassdeliver.com/api/v1 --visibility plaintext

eas env:create --environment production --name EXPO_PUBLIC_SOCKET_URL \
  --value https://api.zassdeliver.com --visibility plaintext

eas env:create --environment production --name GOOGLE_MAPS_ANDROID_KEY \
  --value <key> --visibility secret
```

Check them with `eas env:list --environment production`.

### 1.4 Pre-flight checks

```bash
npm run typecheck
npm run lint
npm run doctor      # expo-doctor: dependency and config problems
```

Then confirm:
- `version` in `app.config.ts` is what you want users to see (`1.0.0`). The
  build number is handled for you (`appVersionSource: remote` and
  `autoIncrement: true`).
- `assets/images/icon.png` is 1024×1024 with **no transparency**. Apple
  rejects icons with an alpha channel.
- You've tested a `preview` build against the production API on a real
  phone, for all three roles (customer, vendor, rider).

### 1.5 Create reviewer demo accounts

Both reviewers need to log in and reach every role. On the **production**
API, create:
- a customer account
- a vendor-owner account whose business is active, with a menu
- a rider account that's approved and able to go online

Write down the credentials. You'll enter them in both consoles.

---

## 2. Apple App Store

### 2.1 Create the App ID and app record

1. Go to **App Store Connect** → *Apps* → **+** → *New App*.
   - Platform: iOS
   - Name: `ZassDeliver` (must be unique on the store)
   - Primary language: English
   - Bundle ID: `com.zassdeliver.app`. If it isn't in the list yet, EAS
     registers it on the first build (step 2.2), and you can come back here
     afterwards.
   - SKU: `zassdeliver-ios`
2. Copy the **Apple ID** of the app (a number, shown under *App
   Information*). This is the `ascAppId`.

### 2.2 Build

```bash
eas build --platform ios --profile production
```

The first time, EAS asks you to sign in to your Apple account. Let it
generate and manage the **distribution certificate**, **provisioning
profile** and **push notification key**. The push key is required for
`expo-notifications`. The finished build is an `.ipa` stored on expo.dev.

### 2.3 Upload to App Store Connect

Add the iOS submit config to `eas.json` once:

```json
"submit": {
  "production": {
    "android": { "track": "internal" },
    "ios": { "ascAppId": "<the Apple ID number from 2.1>" }
  }
}
```

Then upload:

```bash
eas submit --platform ios --profile production --latest
```

Processing on Apple's side takes 5–30 minutes. The build then appears under
*TestFlight*.

### 2.4 TestFlight (recommended before review)

1. Go to *TestFlight* → answer the **export compliance** question. The app
   only uses standard HTTPS, so choose "None of the algorithms mentioned". To
   skip this question on future builds, add
   `ITSAppUsesNonExemptEncryption: false` to `ios.infoPlist` in
   `app.config.ts`.
2. Add internal testers (up to 100 App Store Connect users), install through
   the TestFlight app, and run through all three roles once more.

### 2.5 App Privacy (nutrition labels)

Go to *App Privacy* → *Get Started*. Based on what the app collects, declare:

| Data type                                 | Linked to user | Purpose |
| ----------------------------------------- | -------------- | ------- |
| Name, phone number, email                 | Yes            | App functionality |
| Precise location                          | Yes            | App functionality (delivery address, rider tracking) |
| Photos                                    | Yes            | App functionality (profile, menu images) |
| Purchase history (orders)                 | Yes            | App functionality |
| User ID, device ID (push token)           | Yes            | App functionality |

Choose "not used for tracking" unless you add ad or analytics SDKs later.

### 2.6 Store listing

Under the version page (*iOS App 1.0*):
- **Screenshots**: 6.9" iPhone (1320×2868) is required. Take 3–10. iPad
  screenshots aren't needed because `supportsTablet: false`.
- **Promotional text** (optional), **Description**, **Keywords** (100
  characters), **Support URL**, **Marketing URL** (optional).
- **Privacy Policy URL** (under *App Information*).
- **Category**: Food & Drink. Secondary: Shopping or Business.
- **Age rating**: fill in the questionnaire. This app should come out as 4+.
- **Price**: Free.

### 2.7 Background location justification

`UIBackgroundModes: location` and the "Always" permission get extra scrutiny.
Make sure that:
- only riders are asked for "Always", and only when they go online for a run
  (customers and vendors never are)
- the permission strings in `app.config.ts` explain the rider use clearly
  (they already do)

### 2.8 App Review information

- **Sign-in required**: yes. Enter the demo credentials from 1.5. Put the
  vendor and rider logins in the Notes field.
- **Notes**: something like the text below.

> ZassDeliver is a food delivery marketplace with three roles: customer,
> food business (vendor) and rider. Demo accounts for each are provided.
> Customers pay the business directly (cash or bank/wallet transfer). No
> payment is processed in the app. Background location is used only by riders
> during an active delivery, so customers can track their order. Businesses
> pay ZassDeliver a monthly business service fee by bank transfer outside the
> app. This is a B2B charge for listing on the platform and unlocks no
> consumer digital content.

### 2.9 Submit

Pick the build under *Build* → **Add for Review** → **Submit to App Review**.
Review usually takes 1–3 days. Choose *Manually release* if you want to pick
the launch moment yourself.

### 2.10 Common rejections for this kind of app

| Reason | Fix |
| ------ | --- |
| 5.1.1(v) no account deletion | Section 0.1 |
| 2.1 app crashes or reviewer can't log in | Production API up, demo accounts working |
| 5.1.1 permission strings too vague | Say what the data is used for and who sees it |
| 2.5.4 background location not justified | Section 2.7 + the review notes |
| 3.1.1 external payment | Section 0.4 + the review notes |
| 4.2 minimum functionality (empty app) | Make sure there are live businesses in the reviewer's area, or explain in the notes that it serves Pakistan only |

---

## 3. Google Play Store

### 3.1 Developer account

Register at **play.google.com/console**. Two things to know:
- **Personal** accounts created after Nov 2023 must run a **closed test with
  at least 12 testers for 14 consecutive days** before they're allowed to
  publish to production.
- **Organization** accounts skip that requirement, but need a D-U-N-S number.

### 3.2 Create the app

*All apps* → **Create app** → name `ZassDeliver`, default language English,
App, Free. Accept the declarations.

### 3.3 Google Maps key: restrict it to the Play signing key

Google Play re-signs the app with its own **app signing key**. A Maps key
restricted to your upload key's SHA-1 therefore works in your own builds but
shows a **blank map or crashes** in the store build.

After the first upload (3.5):
1. Play Console → *Test and release* → *App integrity* → *App signing* → copy
   the **SHA-1 of the app signing key**.
2. Google Cloud Console → *Credentials* → your Maps key → *Android apps* →
   add package `com.zassdeliver.app` with that SHA-1. Keep the EAS upload key
   SHA-1 as well (see `eas credentials -p android`).

### 3.4 Build

```bash
eas build --platform android --profile production
```

EAS generates and stores an **upload keystore** on the first run. Let it.
Back it up with `eas credentials -p android` → *Download keystore*, and store
it somewhere safe. The output is an `.aab` (app bundle), as required by Play.

### 3.5 First upload has to be manual

The Play API can't create the first release, so `eas submit` fails until one
bundle has been uploaded by hand.

1. Download the `.aab` from the build page on expo.dev.
2. Play Console → *Test and release* → *Testing* → **Internal testing** →
   *Create new release*.
3. Accept **Play App Signing** when asked.
4. Upload the `.aab`, add release notes, then *Save* → *Review release* →
   *Start rollout*.

### 3.6 Automate later uploads with `eas submit`

1. Google Cloud Console (same project linked to Play) → *IAM* → *Service
   accounts* → create one, then create a **JSON key**.
2. Play Console → *Users and permissions* → *Invite new users* → the service
   account email → grant *Release* permissions for this app.
3. Save the JSON as `google-service-account.json` in the repo root and **add
   it to `.gitignore`**.
4. Point `eas.json` at it:

   ```json
   "android": {
     "track": "internal",
     "serviceAccountKeyPath": "./google-service-account.json"
   }
   ```

5. From then on:

   ```bash
   eas submit --platform android --profile production --latest
   ```

   This goes to the **internal** track, as `eas.json` already sets. You
   promote to closed, open or production from the Console.

### 3.7 App content (Policy → App content)

Every item must be complete before the app can go to production:

| Section | What to enter |
| ------- | ------------- |
| **Privacy policy** | Public URL from 0.3 |
| **App access** | "All or some functionality is restricted", then add the demo credentials from 1.5 for all three roles |
| **Ads** | No ads |
| **Content rating** | IARC questionnaire. The app is a food delivery utility |
| **Target audience** | 18+ (keeps you out of the Families policy) |
| **Data safety** | Same data as the Apple table in 2.5. Encrypted in transit: yes. Users can request deletion: yes, with the URL from 0.1 |
| **Account deletion** | In-app path + the web URL from 0.1 |
| **Government / financial features** | None |
| **Health** | None |

### 3.8 Sensitive permission declarations

This app requests permissions Google treats as sensitive. Each one gets its
own form under *App content*:

- **Location permissions (`ACCESS_BACKGROUND_LOCATION`)**
  - Describe the rider use: "Riders share live location with the customer
    during an active delivery, including when the screen is off."
  - Upload a **short video** (YouTube, unlisted) showing: a rider going
    online → the in-app disclosure → the permission prompt → the
    notification from the foreground service → the customer seeing the
    rider move.
  - The app must show a **prominent in-app disclosure** *before* the system
    prompt, explaining background use. Check that the rider flow does this.
- **Foreground service (`FOREGROUND_SERVICE_LOCATION`)**: declare the
  location type, with the same justification and video.
- **Camera**: no form, but it must be requested only when scanning a QR code.

### 3.9 Store listing (Grow → Store presence → Main store listing)

- App name (30 characters), short description (80), full description (4000)
- **App icon** 512×512 PNG
- **Feature graphic** 1024×500
- **Phone screenshots**: at least 2 (16:9 or 9:16, 320–3840 px)
- Category: Food & Drink. Contact email, website, privacy policy

### 3.10 Testing and going live

1. **Internal testing** (instant, up to 100 testers): sanity-check the store
   build, especially the Maps key (3.3) and push notifications.
2. **Closed testing**: required for personal accounts (12 testers × 14 days,
   see 3.1). Create a testers email list and share the opt-in link.
3. **Production** → *Create new release* → *Promote* the tested build →
   choose countries (Pakistan) → staged rollout (e.g. 20%) → *Send for
   review*.

The first review usually takes 1–7 days. Background location can add time.

---

## 4. Shipping updates

### JS-only changes: over the air, no store review

`expo-updates` is set up with `runtimeVersion: { policy: "appVersion" }`. Any
change that only touches JS and assets can go out as an update:

```bash
eas update --channel production --message "Fix cart total rounding"
```

Installed apps pick it up on their next launch or two.

### Native changes: new store build

You need a new binary when you add or upgrade a native module, change
`app.config.ts` (permissions, plugins, icons) or upgrade the Expo SDK.

1. Bump `version` in `app.config.ts` (e.g. `1.0.0` → `1.1.0`). With the
   `appVersion` runtime policy, this also stops old binaries from receiving
   JS they can't run.
2. Build and submit both platforms:

   ```bash
   eas build --platform all --profile production
   eas submit --platform ios --profile production --latest
   eas submit --platform android --profile production --latest
   ```

3. iOS: create the new version in App Store Connect, attach the build, and
   submit for review.
   Android: promote from internal to production in the Play Console.

---

## 5. Checklist

**Before the first submission**
- [ ] In-app account deletion + public deletion URL (0.1)
- [ ] Production API on HTTPS (0.2)
- [ ] Privacy policy live and covering location, camera, photos, push (0.3)
- [ ] EAS project created, production env vars set (1.2, 1.3)
- [ ] Icon 1024×1024 with no alpha
- [ ] Demo accounts for customer, vendor and rider on production (1.5)

**Apple**
- [ ] App record + `ascAppId` in `eas.json`
- [ ] Build → submit → TestFlight run-through
- [ ] Export compliance, App Privacy, age rating
- [ ] Screenshots, description, URLs
- [ ] Review notes (external vendor fee, background location)

**Google**
- [ ] First `.aab` uploaded manually, Play App Signing on
- [ ] Maps key restricted with the Play signing SHA-1
- [ ] Service account for `eas submit`
- [ ] App content: data safety, app access, account deletion, content rating
- [ ] Background location declaration + video
- [ ] Store listing assets
- [ ] Closed test (12 × 14 days) if on a personal account
- [ ] Promote to production
