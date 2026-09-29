// From the website's server actions; here plain functions the API calls.

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  AVATAR_MAX_BYTES,
  detectAvatarType,
} from "@/server/components/profile/image-type";
import {
  isHttpUrl,
  SOCIAL_KEYS,
  SOCIAL_URL_MAX,
  type SocialLinks,
} from "@/server/components/profile/social-links";
import type { Prisma } from "@/server/generated/prisma/client";
import { RoleKey } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { PARENT_ROLES } from "@/server/lib/directory";
import { isPersonalField, PERSONAL_FIELDS } from "@/server/lib/personal-fields";
import {
  AuthError,
  actionActive,
  type CurrentUser,
} from "@/server/lib/session";
import { deletePrivate, putPrivate } from "@/server/lib/storage";

/**
 * Own-profile edits (§10.2). AIS record fields (roles, years, division) are
 * admin-editable only and are never accepted here.
 * `message` is a key in the "profile" namespace; `fields` lists invalid inputs.
 */
export type ProfileActionState = {
  ok: boolean;
  message: string;
  fields?: string[];
} | null;

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const socialUrl = z
  .string()
  .trim()
  .max(SOCIAL_URL_MAX)
  .refine((v) => v === "" || isHttpUrl(v));

// Names are fixed after approval: they change through a name request
// (src/app/actions/name-requests.ts), never here.
const ProfileSchema = z.object({
  bio: optionalText(1000),
  phone: optionalText(40).refine((v) => v === null || /^[0-9+\-() ]+$/.test(v)),
  autoAcceptSameYear: z.boolean(),
  instagram: socialUrl,
  linkedin: socialUrl,
  facebook: socialUrl,
  x: socialUrl,
  website: socialUrl,
});

async function member(): Promise<CurrentUser | null> {
  try {
    return await actionActive();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

const FORBIDDEN = { ok: false, message: "errors.forbidden" } as const;

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const me = await member();
  if (!me) return FORBIDDEN;
  const parsed = ProfileSchema.safeParse({
    bio: field(formData, "bio"),
    phone: field(formData, "phone"),
    autoAcceptSameYear: formData.get("autoAcceptSameYear") === "on",
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, field(formData, k)])),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "errors.validation",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const d = parsed.data;
  const socialLinks: SocialLinks = {};
  for (const k of SOCIAL_KEYS) if (d[k]) socialLinks[k] = d[k];
  await db.user.update({
    where: { id: me.id },
    data: {
      bio: d.bio,
      phone: d.phone,
      autoAcceptSameYear: d.autoAcceptSameYear,
      socialLinks: socialLinks as Prisma.InputJsonValue,
    },
  });
  refresh();
  return { ok: true, message: "saved" };
}

/** Which personal fields followers may see too (all off by default). */
export async function updateFollowerFieldsAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const me = await member();
  if (!me) return FORBIDDEN;
  const chosen = new Set(
    formData.getAll("share").map(String).filter(isPersonalField),
  );
  await db.user.update({
    where: { id: me.id },
    // Stored in the catalog order.
    data: { followerFields: PERSONAL_FIELDS.filter((f) => chosen.has(f)) },
  });
  refresh();
  return { ok: true, message: "saved" };
}

/** Whether every member may see the photo (性別 is fixed: gender-requests). */
export async function updateAvatarSettingsAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const me = await member();
  if (!me) return FORBIDDEN;
  await db.user.update({
    where: { id: me.id },
    data: { avatarPublic: formData.get("avatarPublic") === "on" },
  });
  refresh();
  return { ok: true, message: "saved" };
}

/** Parents only: whether to be listed in the member directory. */
export async function updateDirectorySettingsAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const me = await member();
  if (!me || !me.roles.some((r) => PARENT_ROLES.includes(r.role)))
    return FORBIDDEN;
  await db.user.update({
    where: { id: me.id },
    data: { hideFromDirectory: formData.get("listed") !== "on" },
  });
  refresh();
  return { ok: true, message: "saved" };
}

/** Keys we created for this user; Google avatar URLs are never deleted. */
function ownedAvatarKey(userId: string, value: string | null): string | null {
  return value?.startsWith(`avatars/${userId}/`) ? value : null;
}

async function deleteOldAvatar(userId: string, value: string | null) {
  const key = ownedAvatarKey(userId, value);
  if (!key) return;
  try {
    await deletePrivate(key);
  } catch (e) {
    console.error("[profile] failed to delete old avatar", e);
  }
}

export async function uploadAvatarAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const me = await member();
  if (!me) return FORBIDDEN;
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: "errors.fileMissing", fields: ["avatar"] };
  if (file.size > AVATAR_MAX_BYTES)
    return { ok: false, message: "errors.fileSize", fields: ["avatar"] };
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectAvatarType(buf);
  if (!type)
    return { ok: false, message: "errors.fileType", fields: ["avatar"] };

  const stored = await putPrivate(
    `avatars/${me.id}/${randomUUID()}.${type.ext}`,
    buf,
    type.mime,
  );
  await db.user.update({ where: { id: me.id }, data: { avatarUrl: stored } });
  await deleteOldAvatar(me.id, me.avatarUrl);
  refresh();
  return { ok: true, message: "photoUploaded" };
}

export async function removeAvatarAction(): Promise<void> {
  const me = await actionActive();
  await db.user.update({ where: { id: me.id }, data: { avatarUrl: null } });
  await deleteOldAvatar(me.id, me.avatarUrl);
  refresh();
}

function _isFormerStudent(me: CurrentUser): boolean {
  return me.roles.some((r) => r.role === RoleKey.FORMER_STUDENT);
}
