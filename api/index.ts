/**
 * Vercel entry: every request that isn't a static file (dist/client) goes
 * through Expo Router's server — API routes (src/app/**\/+api.ts) and
 * server-rendered pages (dist/server, from `expo export -p web`).
 */
const path = require("node:path");
const { createRequestHandler } = require("expo-server/adapter/vercel");

module.exports = createRequestHandler({
  build: path.join(__dirname, "../dist/server"),
});
