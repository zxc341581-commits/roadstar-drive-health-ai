#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
mkdir -p "$temp/sdk/build-tools/35.0.0" "$temp/bin"
cat > "$temp/bin/javac" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
cat > "$temp/bin/zip" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
cat > "$temp/bin/unzip" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [[ "$FAIL_ASSETS" = 1 ]]; then printf 'mismatched\n'; else cat "app/src/main/$3"; fi
MOCK
cat > "$temp/bin/android-tool"  <<'MOCK'
#!/usr/bin/env bash
set -eu
case "$(basename "$0"):$1" in
  d8:*) exit 0 ;;
  aapt2:link) printf 'unsigned\n' > "${@: -1}" ;;
  zipalign:-f) cp "${@: -2:1}" "${@: -1}" ;;
  zipalign:-c) test -s "${@: -1}" ;;
  apksigner:sign) printf 'new apk\n' > "${@: -2:1}"; touch "${@: -2:1}.idsig" ;;
  apksigner:verify) test "$FAIL_VERIFICATION" = 0 ;;
  *) exit 88 ;;
esac
MOCK
chmod +x "$temp/bin/"*
for tool in d8 aapt2 zipalign apksigner; do
  ln -s "$temp/bin/android-tool" "$temp/sdk/build-tools/35.0.0/$tool"
done
export PATH="$temp/bin:$PATH"
export ANDROID_SDK_ROOT="$temp/sdk" DRIVE_KEYSTORE="$temp/mock.jks"
export DRIVE_KEY_ALIAS=mock DRIVE_STORE_PASS=mock DRIVE_KEY_PASS=mock FAIL_ASSETS=0
unset ANDROID_JAR BUILD_TOOLS_DIR ANDROID_CAR_JAR ECJ_JAR
printf 'existing apk\n' > "$temp/release.apk"
printf 'existing idsig\n' > "$temp/release.apk.idsig"
if FAIL_VERIFICATION=1 bash scripts/build-release.sh "$temp/release.apk"; then exit 1; fi
test "$(cat "$temp/release.apk")" = 'existing apk'
test -f "$temp/release.apk.idsig"
if FAIL_VERIFICATION=0 FAIL_ASSETS=1 bash scripts/build-release.sh "$temp/release.apk"; then exit 1; fi
test "$(cat "$temp/release.apk")" = 'existing apk'
test -f "$temp/release.apk.idsig"
FAIL_VERIFICATION=0 bash scripts/build-release.sh "$temp/release.apk"
test "$(cat "$temp/release.apk")" = 'new apk'
test ! -e "$temp/release.apk.idsig"
test -z "$(find "$temp" -maxdepth 1 -name '.drive-health-build.*' -print -quit)"
printf 'Release script mock: retained existing output on signature or source mismatch, published verified output on success.\n'
