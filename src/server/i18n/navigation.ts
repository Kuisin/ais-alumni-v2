/** Page redirects don't exist in the API; code paths that would redirect throw. */
export function redirect(target: { href: string; locale?: string }): never {
  throw new Error(`redirect to ${target.href}`);
}
