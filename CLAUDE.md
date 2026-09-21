# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

ZassDeliver mobile: an Expo SDK 57 / React Native app (Android + iOS) for the **Customer, Rider and Vendor** portals of a food-delivery platform. It talks to the same NestJS API (`/var/www/zassdelivery`) as the existing Next.js web app. Admin is deliberately web-only. `ROADMAP.md` holds the phased build plan and the decisions behind it. Check it before starting a feature. The screens under `src/app/(auth|customer|rider|vendor)` are mostly still empty route groups.

## Commands

- `npm start`: Metro dev server (`expo start`). The app uses `expo-dev-client`, so it runs in a development build, not Expo Go.
- `npm run android` / `npm run ios`: start Metro and open on a device or emulator.
- `npx tsc --noEmit`: type-check. There is no `typecheck` script yet.
- `npm run lint`: `expo lint`. ESLint is not configured yet, so the first run scaffolds it.
- `npx prettier --write <files>`: Prettier with `prettier-plugin-tailwindcss` (sorts classes). There is no config file, so defaults apply.
- `eas build --profile development|preview|production`: cloud builds (see `eas.json`). The profile sets `EAS_BUILD_PROFILE`, which `app.config.ts` reads.
- There is no test runner.

`npm run reset-project` is a leftover from the template, and its script has been deleted.

## Configuration

- `app.config.ts` (dynamic; there is no `app.json`) chooses the bundle ID and app name from `EAS_BUILD_PROFILE` (`com.zassdeliver.app[.dev|.preview]`), so all three variants can be installed side by side. It defaults to `development` locally. Native secrets come from the env: `GOOGLE_MAPS_ANDROID_KEY`, `EAS_PROJECT_ID`, `EXPO_UPDATE_URL`. See `.env.example`.
- `src/lib/env.ts` resolves the API. An explicit `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL` wins. In dev it otherwise falls back to the Metro host's LAN IP on port 3002. `localhost` never works from a phone, and release builds throw if the URL is unset. The NestJS server must bind `0.0.0.0`.
- Experiments are on: `typedRoutes` and `reactCompiler`. The New Architecture is enabled.
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

## Architecture

### Data layer ported from the web app

`src/types`, `src/lib/api/*`, `src/hooks/*`, `src/lib/socket*.ts`, `src/lib/api-client.ts` and `src/store/auth-store.ts` were copied from the web app, and the header comments say so. They stay close to the originals on purpose, so the two copies can be diffed when the API changes. When you edit them:
- Keep the web-app structure and the `// MOBILE:` markers on mobile-specific divergences. Don't restyle copied files. They use the web app's style (single quotes, no semicolons), while newly written mobile files use double quotes and semicolons.
- An API change usually needs mirroring in both repos (see "Drift risk" in `ROADMAP.md`).

Layering: `types/*` (DTOs) → `lib/api/<domain>.ts` (plain objects of `apiGet/apiPost/...` calls) → `hooks/use-<domain>.ts` (TanStack Query hooks with a `<domain>Keys` query-key factory) → screens.

### API client (`src/lib/api-client.ts`)

- The `apiGet/apiPost/apiPatch/apiPut/apiDelete` helpers unwrap the `{ data, meta }` envelope. `apiGetPaginated` returns `{ items, meta }`, and `apiUpload` sends multipart with a 120s timeout.
- Every rejection is normalized to `ApiError`. Branch on `.code`, never on `.message`.
- A 401 triggers **one serialized refresh** (`refreshInFlight`), because the backend rotates refresh tokens and treats a replayed one as theft. A failed refresh means a full logout through `setSessionLostHandler`. Don't add retry loops around it.
- Pass the exported `anonymous` config (`_anonymous: true`) for requests that must skip the auth header and refresh.

### Auth and startup

- `store/auth-store.ts` (zustand + persist): tokens go in `expo-secure-store` under separate keys for access and refresh, and user metadata goes in AsyncStorage. Rehydration is **async**, unlike on the web.
- `app/_layout.tsx` keeps the splash screen up (`SplashGate`) until `useAuth().isReady` and the stored theme have loaded. Route guards must never act on `user` before `isReady`, or signed-in users get bounced to login on cold start.
- `homeRouteForRole` (`types/auth.ts`) maps a role to its portal: `/rider`, `/vendor`, or `/` for customers.

### Providers (`src/components/providers/index.tsx`)

The order is load-bearing: Theme → Query → Auth (clears the query cache on sign-out) → Realtime (needs a token) → `NotificationListener` + children + `Toaster`. Import `useAuth`, `useTheme` and `useRealtime`/`useOrderRoom`/`useRestaurantRoom`/`useRealtimeEvent` from `@/components/providers`. `QueryProvider` wires TanStack's `focusManager`/`onlineManager` to AppState and NetInfo.

### Realtime

`lib/socket.ts` is a Socket.IO singleton on the `/realtime` namespace, with reconnects handled across foreground and background. The event names and payload types are in `lib/socket-events.ts`.

### Styling

NativeWind 4 (Tailwind 3). Use `className` on RN components through the babel `jsxImportSource: "nativewind"` setting, and merge classes with `cn()` from `@/lib/utils`.
- Tokens are CSS variables in `src/global.css`, mapped to semantic utilities in `tailwind.config.js`: `bg-canvas`, `bg-surface`, `text-primary`, `text-secondary`, `border-default`, `bg-brand`, `text-danger`, `rounded-card`, and so on. The class names match the web app so markup ports directly. **Use semantic tokens, never raw hexes**, or dark mode breaks.
- Dark mode is `darkMode: "class"` and driven by `theme-provider.tsx`, where the user's choice overrides the OS setting.
- Locale is Pakistan: use the `formatPrice` (PKR), `formatDate` and `formatRelative` helpers in `lib/utils.ts`. Use `hasText()` to check optional strings, because the API sends `null` for empty ones.
