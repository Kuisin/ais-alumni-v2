/**
 * Japanese glyphs for generated images (next/og): a Noto Sans JP subset
 * with just the characters on the image. null if Google Fonts is
 * unreachable (the image then falls back to the default font).
 */
export async function loadNotoSansJp(
  text: string,
  weight: 400 | 700 = 700,
): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(3000) },
      )
    ).text();
    const src = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!src) return null;
    return await (
      await fetch(src, { signal: AbortSignal.timeout(3000) })
    ).arrayBuffer();
  } catch {
    return null;
  }
}
