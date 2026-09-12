import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...config,
    name: config.name ?? "FinHealth",
    slug: config.slug ?? "finhealth",
    plugins: [
      ...(config.plugins ?? []),
      "expo-font",
      "expo-image",
      "expo-web-browser",
    ],
    android: {
      ...config.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: { apiKey: googleMapsApiKey },
            },
          }
        : {}),
    },
  };
};
