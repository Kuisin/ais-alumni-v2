import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { ApiError, getApiToken } from "@/lib/api";
import { API_URL } from "@/lib/config";

/**
 * 設定 → データのダウンロード (GET /me/export, a JSON file): the web build
 * downloads it; phones save it to the cache and open the share sheet
 * (save to Files, AirDrop, mail…).
 */
export async function exportMyData(dialogTitle: string): Promise<void> {
  const token = getApiToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/mobile/v1/me/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (!res.ok) throw new ApiError(res.status, "server_error");
  const name =
    /filename="([^"]+)"/.exec(
      res.headers.get("content-disposition") ?? "",
    )?.[1] ?? "ais-alumni-my-data.json";
  const text = await res.text();

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle,
  });
}
