#!/usr/bin/env bash
#
# Diffs the copied data layer against the web app it was taken from.
#
# The mobile app carries its own copies of `types/`, `lib/api/` and most of
# `hooks/` rather than importing a shared package. That is a deliberate trade
# (see README), and this script is the thing that stops it rotting: run it after
# any API change and it names every file that has moved on without its twin.
#
# Exits non-zero when anything has drifted, so CI can fail on it.

set -uo pipefail

WEB="${WEB_APP_DIR:-/var/www/zassdeliver-frontend/src}"
MOBILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src"

if [[ ! -d "$WEB" ]]; then
  echo "Web app not found at $WEB." >&2
  echo "Set WEB_APP_DIR if it lives somewhere else." >&2
  exit 2
fi

# Files that are expected to differ, each for a platform reason documented in
# the README. Listing them here rather than skipping silently means a *new*
# divergence still gets reported.
EXPECTED_DIFFERENT=(
  "lib/api-client.ts"
  "lib/socket.ts"
  "store/auth-store.ts"
  "hooks/use-quick-add.ts"
  "lib/business-types.ts"
  # Rewritten for the platform: the web takes a DOM `File`, RN takes a URI.
  "lib/api/uploads.ts"
  "hooks/use-uploads.ts"
  # Rewritten: browser geolocation has no counterpart; uses expo-location.
  "hooks/use-geo.ts"
)

drifted=0
missing=0
checked=0

is_expected() {
  local needle="$1"
  for entry in "${EXPECTED_DIFFERENT[@]}"; do
    [[ "$entry" == "$needle" ]] && return 0
  done
  return 1
}

echo "Comparing $MOBILE against $WEB"
echo

# Only the directories that are meant to be verbatim copies.
while IFS= read -r mobile_file; do
  rel="${mobile_file#"$MOBILE"/}"
  web_file="$WEB/$rel"

  # Mobile-only additions (e.g. use-restaurants-infinite.ts) have no twin.
  [[ -f "$web_file" ]] || continue

  checked=$((checked + 1))

  if is_expected "$rel"; then
    continue
  fi

  if ! diff -q "$web_file" "$mobile_file" >/dev/null 2>&1; then
    echo "DRIFTED  $rel"
    diff -u "$web_file" "$mobile_file" | sed -n '3,$p' | head -20 | sed 's/^/         /'
    echo
    drifted=$((drifted + 1))
  fi
done < <(find "$MOBILE/types" "$MOBILE/lib" "$MOBILE/hooks" -name '*.ts' -type f 2>/dev/null)

# The other direction: an API module added to the web app and never ported is
# invisible to the loop above, and is the more dangerous of the two cases.
while IFS= read -r web_file; do
  rel="${web_file#"$WEB"/}"

  if [[ ! -f "$MOBILE/$rel" ]]; then
    echo "NOT PORTED  $rel"
    missing=$((missing + 1))
  fi
done < <(find "$WEB/types" "$WEB/lib/api" -name '*.ts' -type f 2>/dev/null)

echo "Checked $checked shared files."

if (( drifted == 0 && missing == 0 )); then
  echo "In step with the web app."
  exit 0
fi

echo
(( drifted > 0 )) && echo "$drifted file(s) drifted."
(( missing > 0 )) && echo "$missing file(s) exist on the web and were never ported."
exit 1
