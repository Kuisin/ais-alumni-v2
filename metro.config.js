const { getDefaultConfig } = require("expo/metro-config");

// UI strings (messages/<locale>/<namespace>.json) are imported through the
// "@messages/*" path in tsconfig.json, which Expo's Metro config resolves.
module.exports = getDefaultConfig(__dirname);
