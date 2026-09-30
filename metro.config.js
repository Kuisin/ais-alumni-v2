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
  // Not Next.js: satori's HarfBuzz, loaded lazily (see the file).
  harfbuzzjs: "src/server/shims/harfbuzzjs.js",
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = SHIMS[moduleName];
  if (shim) return { type: "sourceFile", filePath: path.join(__dirname, shim) };
  return context.resolveRequest(context, moduleName, platform);
};

// Keep Metro's cache in node_modules/.cache, which Vercel keeps between
// builds (Metro's default, the OS temp dir, starts empty on every build).
// metro-cache isn't a direct dependency (pnpm): load the one Expo's Metro uses.
const { FileStore } = require(
  require.resolve("metro-cache", {
    paths: [
      require.resolve("metro/package.json", {
        paths: [require.resolve("expo/package.json")],
      }),
    ],
  }),
);
config.cacheStores = [
  new FileStore({ root: path.join(__dirname, "node_modules/.cache/metro") }),
];

module.exports = config;
