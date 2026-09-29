#!/bin/bash
# Local testing: an iOS Simulator with Expo Go for this project's SDK, ready
# for `pnpm ios` and the Maestro flows in maestro/ (needs Xcode).
#   scripts/sim-setup.sh ["Device name"]   → prints the simulator's UDID
set -euo pipefail
NAME=${1:-"AIS Alumni"}
MODEL=${SIM_MODEL:-"iPhone 17"}
cd "$(dirname "$0")/.."

UDID=$(xcrun simctl list devices | grep "$NAME (" | grep -oE "[0-9A-F-]{36}" | head -1 || true)
if [ -z "$UDID" ]; then
  RUNTIME=$(xcrun simctl list runtimes | grep -oE "com.apple.CoreSimulator.SimRuntime.iOS-[0-9-]+" | tail -1)
  UDID=$(xcrun simctl create "$NAME" "$MODEL" "$RUNTIME")
fi
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null

# Expo Go for this SDK (skip if already installed).
if ! xcrun simctl listapps "$UDID" 2>/dev/null | grep -q host.exp.Exponent; then
  SDK=$(node -p "require('expo/package.json').version.split('.')[0]").0.0
  URL=$(curl -s https://exp.host/--/api/v2/versions | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).sdkVersions['$SDK'].iosClientUrl))")
  TMP=$(mktemp -d)
  curl -sL "$URL" | tar -xz -C "$TMP"
  mv "$TMP" "$TMP.app"
  xcrun simctl install "$UDID" "$TMP.app"
  rm -rf "$TMP.app"
fi

# Open exp:// links without the "Open in Expo Go?" prompt (as Expo CLI does),
# and skip Expo Go's first-run screens.
PLIST="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Preferences/com.apple.launchservices.schemeapproval.plist"
/usr/libexec/PlistBuddy -c "Delete :com.apple.CoreSimulator.CoreSimulatorBridge-->exp" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :com.apple.CoreSimulator.CoreSimulatorBridge-->exp string host.exp.Exponent" "$PLIST" >/dev/null
# The same for aisalumni:// links into a development build.
/usr/libexec/PlistBuddy -c "Delete :com.apple.CoreSimulator.CoreSimulatorBridge-->aisalumni" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :com.apple.CoreSimulator.CoreSimulatorBridge-->aisalumni string net.kailab.aisalumni" "$PLIST" >/dev/null
xcrun simctl spawn "$UDID" defaults write net.kailab.aisalumni EXDevMenuIsOnboardingFinished -bool YES
for key in EXDevMenuIsOnboardingFinished ExpoGoOnboardingFinished EXHomeIsNuxFinishedDefaultsKey EXKernelDisableNuxDefaultsKey; do
  xcrun simctl spawn "$UDID" defaults write host.exp.Exponent "$key" -bool YES
done
echo "$UDID"
