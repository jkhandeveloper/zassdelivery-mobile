#!/usr/bin/env bash
#
# Build a standalone "ZassDeliver (Preview)" APK in WSL — no Metro, no cloud.
#
#   ./scripts/build-apk.sh                          # API on this machine's LAN IP
#   ./scripts/build-apk.sh http://192.168.1.50:3002 # API somewhere specific
#   ./scripts/build-apk.sh https://api.zassdeliver.com
#
# A standalone build has no dev server to infer the API host from, so the
# origin is compiled into the JS bundle here. Change it → rebuild.
#
# The APK is signed with the debug keystore: fine for sideloading onto test
# phones, not accepted by the Play Store (use `eas build --profile production`).

set -euo pipefail

cd "$(dirname "$0")/.."

# ~/.bashrc exports these below its "not interactive → return" guard, so a
# script (or an editor task) never sees them. Fall back to the Phase 0 paths.
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/share/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

origin="${1:-}"

if [[ -z "$origin" ]]; then
  ip="$(hostname -I | awk '{print $1}')"

  if [[ "$ip" == 192.168.84.* || "$ip" == 172.* ]]; then
    echo "✗ This machine reports $ip, a WSL NAT address a phone cannot reach." >&2
    echo "  Run 'wsl --shutdown' in PowerShell to enable mirrored networking," >&2
    echo "  or pass the API origin explicitly: $0 http://<LAN-IP>:3002" >&2
    exit 1
  fi

  origin="http://$ip:3002"
fi

origin="${origin%/}"

export EAS_BUILD_PROFILE=preview
export EXPO_PUBLIC_API_URL="$origin/api/v1"
export EXPO_PUBLIC_SOCKET_URL="$origin"
export NODE_ENV=production

echo "→ API: $EXPO_PUBLIC_API_URL"

if curl -fsS --max-time 5 "$EXPO_PUBLIC_API_URL/health" > /dev/null 2>&1; then
  echo "✓ API is reachable from here"
else
  echo "⚠ API did not answer at $EXPO_PUBLIC_API_URL/health — the APK will build, but will not connect until it does."
fi

if [[ -z "$(grep -E '^GOOGLE_MAPS_ANDROID_KEY=.+' .env 2>/dev/null || true)" && -z "${GOOGLE_MAPS_ANDROID_KEY:-}" ]]; then
  echo "⚠ GOOGLE_MAPS_ANDROID_KEY is not set — order tracking shows a route card instead of a map."
fi

# --clean: android/ is generated from app.config.ts, and a stale one would keep
# the previous variant's package name.
#
# Prebuild also rewrites the "android"/"ios" scripts in package.json to
# `expo run:*`, which cannot work for iOS on Linux — so put them back.
cp package.json package.json.prebuild-bak
trap 'mv -f package.json.prebuild-bak package.json 2>/dev/null || true' EXIT
npx expo prebuild --platform android --clean --no-install
mv -f package.json.prebuild-bak package.json

# Metro caches NativeWind's compiled stylesheet keyed on src/global.css alone,
# so a change to tailwind.config.js (fonts, colours, radii) is silently served
# from the old cache and the APK ships the previous design. A release build is
# rare enough that a cold bundle is worth it.
rm -rf "$(node -p 'require("os").tmpdir()')/metro-cache"

# The wrapper gives up after 10s of network silence, which a slow link hits
# while fetching Gradle itself (~130 MB) on the first build.
sed -i 's/^networkTimeout=.*/networkTimeout=300000/' android/gradle/wrapper/gradle-wrapper.properties

(cd android && ./gradlew assembleRelease)

mkdir -p dist
out="dist/zassdeliver-preview.apk"
cp android/app/build/outputs/apk/release/app-release.apk "$out"

echo
echo "✓ Built $out ($(du -h "$out" | cut -f1))"
echo "  Install over adb:  adb install -r $out"
echo "  Or copy the file to the phone and open it."
