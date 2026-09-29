/**
 * Schools and companies shared by 学歴 / 職歴 (pure helpers).
 */
export type OrgKind = "school" | "company";

/** Display name as entered, with whitespace tidied (full-width spaces too). */
export function cleanOrgName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Key used to spot the same organization written differently: width,
 * case, spaces and common punctuation are ignored
 * ("名古屋大学" = "名古屋 大学", "Toyota Motor Corp." = "toyota motor corp").
 */
export function orgNameKey(name: string): string {
  return cleanOrgName(name)
    .toLowerCase()
    .replace(/[\s.,・･'’"“”()（）\-‐―—_/]/g, "");
}

export type OrgOption = { id: string; name: string; count: number };
