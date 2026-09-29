import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Camera, CameraOff } from "lucide-react-native";
import { useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, colors, radius, space, Text } from "@/ui";

/** Web: expo-camera decodes with the browser's BarcodeDetector (Chrome, Android). */
const WEB_SCAN =
  Platform.OS !== "web" ||
  (typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis);

/**
 * Camera preview that reads QR tickets (the website's Scanner): off until
 * started; the same code held in front of the camera is read once per 4 s.
 * Where the camera can't scan, staff type the code or pick from the list.
 */
export function Scanner({
  onScan,
  paused,
}: {
  onScan: (text: string) => void;
  paused: boolean;
}) {
  const t = useTranslations("events.checkIn.scan");
  const tm = useTranslations("mobile.compose");
  const [permission, requestPermission] = useCameraPermissions();
  const [on, setOn] = useState(false);
  const [error, setError] = useState<"noCamera" | "denied" | null>(null);
  const last = useRef({ text: "", at: 0 });

  const start = async () => {
    setError(null);
    if (!WEB_SCAN) {
      setError("noCamera");
      return;
    }
    const p = permission?.granted ? permission : await requestPermission();
    if (!p.granted) {
      setError(p.canAskAgain || Platform.OS === "web" ? "noCamera" : "denied");
      return;
    }
    setOn(true);
  };

  return (
    <View style={styles.wrap}>
      {on ? (
        <View style={styles.preview}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onMountError={() => {
              setOn(false);
              setError("noCamera");
            }}
            onBarcodeScanned={
              paused
                ? undefined
                : ({ data }) => {
                    const now = Date.now();
                    // Ignore the same code held in front of the camera.
                    if (
                      !data ||
                      (data === last.current.text &&
                        now - last.current.at < 4000)
                    )
                      return;
                    last.current = { text: data, at: now };
                    void Haptics.selectionAsync().catch(() => {});
                    onScan(data);
                  }
            }
          />
          <View pointerEvents="none" style={styles.frame} />
        </View>
      ) : null}
      <Text variant="small" tone="muted">
        {t("hint")}
      </Text>
      {error ? (
        <View style={styles.warning}>
          <Text variant="small" style={styles.warningText}>
            {error === "denied" ? tm("scanPermission") : t("noCamera")}
          </Text>
          {error === "denied" ? (
            <Button
              variant="secondary"
              compact
              label={tm("scanSettings")}
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </View>
      ) : null}
      <Button
        variant={on ? "secondary" : "primary"}
        label={on ? t("stop") : t("start")}
        icon={(c) =>
          on ? (
            <CameraOff size={18} color={c} aria-hidden />
          ) : (
            <Camera size={18} color={c} aria-hidden />
          )
        }
        onPress={() => (on ? setOn(false) : void start())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  preview: {
    width: "100%",
    maxWidth: 384,
    alignSelf: "center",
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.slate900,
  },
  frame: {
    position: "absolute",
    top: "15%",
    left: "15%",
    right: "15%",
    bottom: "15%",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: radius.lg,
  },
  warning: {
    gap: space.sm,
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    padding: space.md,
  },
  warningText: { color: colors.amber900 },
});
