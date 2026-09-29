import { useLocalSearchParams } from "expo-router";
import { HistoryEntryScreen } from "@/features/profile/history";

/** Add (no id) or edit one 学歴 / 職歴 entry. */
export default function HistoryEntryRoute() {
  const { kind, id, userId } = useLocalSearchParams<{
    kind?: string;
    id?: string;
    userId?: string;
  }>();
  return (
    <HistoryEntryScreen
      kind={kind === "work" ? "work" : "education"}
      id={id || undefined}
      userId={userId || undefined}
    />
  );
}
