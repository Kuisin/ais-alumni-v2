import { useLocalSearchParams } from "expo-router";
import { HistoryScreen } from "@/features/profile/history";

/**
 * 学歴・職歴 (the website's /app/profile/history). `userId`: an admin
 * editing that member's (the server checks).
 */
export default function HistoryRoute() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  return <HistoryScreen userId={userId || undefined} />;
}
