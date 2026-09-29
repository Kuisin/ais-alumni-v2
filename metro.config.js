const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// UI strings (messages/<locale>/<namespace>.json) are imported through the
// "@messages/*" path in tsconfig.json, which Expo's Metro config resolves.

/**
 * The API's server code (src/server) was written for Next.js; these few
 * Next.js modules resolve to small stand-ins (src/server/shims). Keep in
 * step with "paths" in tsconfig.json.
 */
const SHIMS = {
  "next/headers": "src/server/shims/next-headers.ts",
  "next/cache": "src/server/shims/next-cache.ts",
  "next/server": "src/server/shims/next-server.ts",
  "next-intl/server": "src/server/shims/next-intl-server.ts",
  "next-intl/routing": "src/server/shims/next-intl-routing.ts",
  "next-intl": "src/server/shims/next-intl.ts",
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = SHIMS[moduleName];
  if (shim) return { type: "sourceFile", filePath: path.join(__dirname, shim) };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
