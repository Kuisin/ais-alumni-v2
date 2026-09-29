import { Image } from "expo-image";
import { StyleSheet } from "react-native";
import { absoluteUrl } from "@/lib/config";
import { colors } from "./theme";

/**
 * Profile photo. `uri` is what the API returned (already the default icon
 * when the photo isn't visible to this member); relative URLs are resolved
 * against the website.
 */
export function Avatar({
  uri,
  size = 40,
}: {
  uri: string | null | undefined;
  size?: number;
}) {
  return (
    <Image
      source={absoluteUrl(uri ?? "/avatars/default.svg")}
      style={[
        styles.img,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.slate200 },
});
