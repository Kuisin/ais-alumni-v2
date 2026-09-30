/**
 * "harfbuzzjs" (satori's text shaping) for the API bundle. The package
 * starts loading hb.wasm from next to itself as soon as it's imported —
 * which Metro doesn't bundle, so the server crashed on start. This stand-in
 * is a thenable that loads the binary from the npm CDN (pinned to the
 * installed version, like resvg in src/server/lib/og/image-response.ts)
 * only when satori first awaits it, i.e. when an image is drawn.
 * CommonJS on purpose: satori takes `require("harfbuzzjs")` as the promise.
 */
const hb = require("harfbuzzjs/hb.js");
const hbjs = require("harfbuzzjs/hbjs.js");

const WASM = "https://cdn.jsdelivr.net/npm/harfbuzzjs@0.10.0/hb.wasm";

let loading = null;

function load() {
  loading ??= fetch(WASM)
    .then((res) => {
      if (!res.ok) throw new Error(`hb.wasm: HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((bin) => hb({ wasmBinary: new Uint8Array(bin) }))
    .then((instance) => hbjs(instance))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

module.exports = {
  // biome-ignore lint/suspicious/noThenProperty: a lazy promise on purpose
  then(onFulfilled, onRejected) {
    return load().then(onFulfilled, onRejected);
  },
};
