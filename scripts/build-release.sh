#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}"
: "${DRIVE_KEYSTORE:?Set DRIVE_KEYSTORE to a local signing keystore}"
: "${DRIVE_KEY_ALIAS:?Set DRIVE_KEY_ALIAS}"
: "${DRIVE_STORE_PASS:?Set DRIVE_STORE_PASS}"
: "${DRIVE_KEY_PASS:?Set DRIVE_KEY_PASS}"
tools="${BUILD_TOOLS_DIR:-$ANDROID_SDK_ROOT/build-tools/35.0.0}"
platform="${ANDROID_JAR:-$ANDROID_SDK_ROOT/platforms/android-35/android.jar}"
car_jar="${ANDROID_CAR_JAR:-$(dirname "$platform")/optional/android.car.jar}"
output="${1:-apk/DriveHealthAI_release.apk}"
work="$(mktemp -d)"
pending=
trap 'rm -rf "$work"; if [[ -n "$pending" ]]; then rm -rf "$pending"; fi' EXIT
mkdir -p "$(dirname "$output")" "$work/classes" "$work/dex"
pending="$(mktemp -d "$(dirname "$output")/.drive-health-build.XXXXXX")"
sources=(app/src/main/java/com/drivehealthai/demo/*.java)
if [[ -n "${ECJ_JAR:-}" ]]; then
  java -jar "$ECJ_JAR" -1.8 -proc:none -bootclasspath "$platform:$car_jar" -d "$work/classes" "${sources[@]}"
else
  javac --release 8 -classpath "$platform:$car_jar" -d "$work/classes" "${sources[@]}"
fi
(cd "$work/classes" && zip -qr "$work/classes.jar" .)
"$tools/d8" --release --min-api 28 --lib "$platform" --lib "$car_jar" --output "$work/dex" "$work/classes.jar"
"$tools/aapt2" link --manifest app/src/main/AndroidManifest.xml -I "$platform" --min-sdk-version 28 --target-sdk-version 35 --version-code 12 --version-name 0.5.4 -A app/src/main/assets -o "$work/base.apk"
(cd "$work/dex" && zip -q -j "$work/base.apk" classes.dex)
"$tools/zipalign" -f 4 "$work/base.apk" "$work/aligned.apk"
"$tools/apksigner" sign --ks "$DRIVE_KEYSTORE" --ks-key-alias "$DRIVE_KEY_ALIAS" --ks-pass env:DRIVE_STORE_PASS --key-pass env:DRIVE_KEY_PASS --out "$pending/DriveHealthAI.apk" "$work/aligned.apk"
"$tools/apksigner" verify --verbose "$pending/DriveHealthAI.apk"
"$tools/zipalign" -c 4 "$pending/DriveHealthAI.apk"
for asset in app/src/main/assets/*; do
  unzip -p "$pending/DriveHealthAI.apk" "assets/$(basename "$asset")" | cmp - "$asset"
done
mv -f -- "$pending/DriveHealthAI.apk" "$output"
rm -f -- "$output.idsig"
