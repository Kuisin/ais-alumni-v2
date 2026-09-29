import { getApiToken } from "@/lib/api";
import { API_URL } from "@/lib/config";
import type { Download } from "./download";

export type { Download } from "./download";

/**
 * An export (CSV / Excel) in the browser: fetched with the bearer token
 * (a plain link can't send it), then saved under the server's file name.
 */
export async function downloadFile(d: Download): Promise<void> {
  const token = getApiToken();
  const res = await fetch(`${API_URL}/api/mobile/v1${d.path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "download";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
