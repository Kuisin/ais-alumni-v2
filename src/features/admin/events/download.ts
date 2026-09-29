import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getApiToken } from "@/lib/api";
import { API_URL } from "@/lib/config";

export type Download = {
  /** path under /api/mobile/v1, e.g. "/admin/events/x/csv" */
  path: string;
  mimeType: string;
  /** iOS Uniform Type Identifier */
  uti: string;
  dialogTitle: string;
};

/**
 * An export (CSV / Excel) on a phone: downloaded with the session's bearer
 * token into the cache (named by the server's Content-Disposition), then
 * the share sheet — save to Files, AirDrop, mail, open in Excel.
 */
export async function downloadFile(d: Download): Promise<void> {
  const token = getApiToken();
  const dir = new Directory(Paths.cache, "exports");
  if (!dir.exists) dir.create({ intermediates: true });
  const file = await File.downloadFileAsync(
    `${API_URL}/api/mobile/v1${d.path}`,
    dir,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    },
  );
  if (!(await Sharing.isAvailableAsync())) throw new Error("sharing");
  await Sharing.shareAsync(file.uri, {
    mimeType: d.mimeType,
    UTI: d.uti,
    dialogTitle: d.dialogTitle,
  });
}
