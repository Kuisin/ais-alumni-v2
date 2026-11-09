import type { TestAccount, TestAccountList } from "@contract/admin-members";
import { z } from "zod";
import { adminOnly } from "@/server/lib/mobile/admin";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  createTestAccount,
  listTestAccounts,
} from "@/server/lib/test-accounts";

const Body = z.object({
  type: z.enum([
    "PARENT",
    "CURRENT_STUDENT",
    "GRADUATE",
    "CURRENT_TEACHER",
    "FORMER_TEACHER",
  ]),
  email: z.email().max(254),
  name: z.string().trim().min(1).max(100),
});

/** 管理モード → テストアカウント: the list (admins). */
export const GET = mobileRoute(async ({ user }): Promise<TestAccountList> => {
  adminOnly(user);
  return { accounts: await listTestAccounts() };
});

/** Make a test account: ACTIVE, signs in with the email code. */
export const POST = mobileRoute(
  async ({ request, user }): Promise<TestAccount> => {
    adminOnly(user);
    return createTestAccount(user, await readJson(request, Body));
  },
);
