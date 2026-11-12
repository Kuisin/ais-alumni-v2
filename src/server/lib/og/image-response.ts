import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { ReactElement } from "react";
import satori from "satori";

/**
 * `next/og`'s ImageResponse for this server (no Next.js): satori lays the
 * element out as SVG, resvg (WebAssembly) draws the PNG.
 *
 * The resvg binary is loaded once per instance from the npm CDN, pinned to
 * the installed package's version (Metro can't bundle .wasm files) — like
 * the fonts, which come from Google Fonts. Unlike next/og there is no
 * built-in font: callers pass one (satori draws no text without it).
 */
const RESVG_WASM =
  "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

let ready: Promise<void> | null = null;

function loadResvg(): Promise<void> {
  ready ??= initWasm(fetch(RESVG_WASM)).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/**
 * A photo (JPEG / PNG bytes) cropped to a circle — filling it, centred —
 * as a PNG `size` px wide: for iOS header buttons, which can't round an
 * image themselves.
 */
export async function roundImagePng(
  bytes: Uint8Array,
  mime: string,
  size: number,
): Promise<Uint8Array> {
  await loadResvg();
  const r = size / 2;
  const data = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="c"><circle cx="${r}" cy="${r}" r="${r}"/></clipPath></defs><image xlink:href="${data}" href="${data}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/></svg>`;
  return new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
}

export type ImageOptions = {
  width: number;
  height: number;
  fonts?: {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }[];
};

/**
 * Emoji as Twemoji images (next/og draws them the same way): satori asks
 * for each emoji the fonts don't have. Without the network: no emoji.
 */
async function loadEmoji(code: string, segment: string) {
  if (code !== "emoji") return [];
  // Twemoji's file names: code points in hex, without VS16 unless a ZWJ
  // sequence.
  const chars = segment.includes("\u200d")
    ? segment
    : segment.replaceAll("\ufe0f", "");
  const name = [...chars].map((c) => c.codePointAt(0)?.toString(16)).join("-");
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${name}.svg`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return [];
    const svg = await res.text();
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return [];
  }
}

/** The element as a PNG response (like `new ImageResponse(element, opts)`). */
export async function imageResponse(
  element: ReactElement,
  { width, height, fonts }: ImageOptions,
): Promise<Response> {
  if (!fonts?.length) throw new Error("image font unavailable");
  const svg = await satori(element, {
    width,
    height,
    fonts,
    loadAdditionalAsset: loadEmoji,
  });
  await loadResvg();
  const png = new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
  return new Response(png as BodyInit, {
    headers: { "Content-Type": "image/png" },
  });
}
