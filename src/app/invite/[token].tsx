import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { INVITE_KEY, savePendingInvite } from "@/lib/invite";
import { Loading } from "@/ui";

/**
 * Opening an invitation link (https://…/invite/<token> on the web,
 * aisalumni://invite/<token> in the app) — the website's /api/invite/[token]:
 * remember the token and go on to sign-in (or wherever the account
 * belongs). Sign-in says who invited, or that the link can't be used.
 */
export default function InviteLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (token && token.length <= 100) await savePendingInvite(token);
      await queryClient.invalidateQueries({ queryKey: INVITE_KEY });
      if (live) setDone(true);
    })();
    return () => {
      live = false;
    };
  }, [token, queryClient]);

  return done ? <Redirect href="/" /> : <Loading />;
}
