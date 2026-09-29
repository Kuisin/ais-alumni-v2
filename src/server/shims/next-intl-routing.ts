/** `next-intl/routing`'s defineRouting: the config object as given. */
export function defineRouting<const T extends { locales: readonly string[] }>(
  config: T,
): T {
  return config;
}
