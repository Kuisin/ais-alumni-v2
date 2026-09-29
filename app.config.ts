import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * AIS Alumni — the native app for the website at ais.kai-lab.net. The
 * server it talks to is EXPO_PUBLIC_API_URL (set per build profile in
 * eas.json; otherwise src/lib/config.ts: staging in development, production
 * in release builds).
 */
const IDENTIFIER = "net.kailab.aisalumni";
const BRAND = "#1e3a8a";
/**
 * The EAS project @kaisei0807s/ais-alumni (builds, submissions, push
 * notification tokens). EAS_PROJECT_ID overrides it (e.g. a fork).
 */
const EAS_PROJECT_ID =
  process.env.EAS_PROJECT_ID?.trim() || "9f724ed6-6adf-4933-afd3-e15b48d0ffc0";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AIS Alumni",
  slug: "ais-alumni",
  owner: "kaisei0807s",
  // Google / LINE sign-in returns to aisalumni://auth (src/lib/auth.tsx).
  scheme: "aisalumni",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: IDENTIFIER,
    supportsTablet: false,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
      // Scanning tickets at check-in; photos and documents to upload.
      // Localized in locales/*.json (these are the fallback).
      NSCameraUsageDescription:
        "Used to scan attendees' QR tickets at event check-in and to take photos you upload.",
      NSPhotoLibraryUsageDescription:
        "Used to choose photos and documents to upload, such as your profile photo.",
    },
    // "Required reason" APIs used by React Native and the Expo modules
    // (Apple rejects builds that don't declare them).
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["0A2A.1", "3B52.1", "C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
        },
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
    },
  },
  android: {
    package: IDENTIFIER,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/monochrome-icon.png",
      backgroundColor: BRAND,
    },
    predictiveBackGestureEnabled: false,
    // Ticket scanning at check-in, and "take photo" on uploads.
    permissions: ["android.permission.CAMERA"],
  },
  locales: {
    ja: "./locales/ja.json",
    en: "./locales/en.json",
  },
  web: {
    // The web app (ais-alumni.kai-lab.net) with its API routes (src/server).
    output: "server",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: BRAND,
        image: "./assets/images/splash-icon.png",
        imageWidth: 160,
      },
    ],
    "expo-secure-store",
    "expo-web-browser",
    "expo-localization",
    "expo-image",
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: BRAND,
        defaultChannel: "news",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Used to scan attendees' QR tickets at event check-in and to take photos you upload.",
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Used to choose photos and documents to upload, such as your profile photo.",
        cameraPermission:
          "Used to scan attendees' QR tickets at event check-in and to take photos you upload.",
        microphonePermission: false,
      },
    ],
    "@react-native-community/datetimepicker",
    // Native project fixes for building with Xcode 27 / from paths with
    // spaces (see each file).
    "./plugins/ios-scene-lifecycle",
    "./plugins/ios-paths-with-spaces",
  ],
  extra: {
    ...config.extra,
    eas: { ...config.extra?.eas, projectId: EAS_PROJECT_ID },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
