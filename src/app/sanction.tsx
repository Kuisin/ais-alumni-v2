import { Redirect } from "expo-router";
import { blockingSanction } from "@/features/sanction/api";
import { SanctionScreen } from "@/features/sanction/sanction-screen";
import { useAuth } from "@/lib/auth";

/**
 * 一時停止 / 永久追放 (src/features/sanction): the only screen while the
 * member's account is suspended or banned (the root layout's guard).
 */
export default function SanctionRoute() {
  const { me } = useAuth();
  const sanction = blockingSanction(me);
  if (!sanction) return <Redirect href="/" />;
  return <SanctionScreen sanction={sanction} />;
}
