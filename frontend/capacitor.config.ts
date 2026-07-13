import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for iOS (and future Android).
 *
 * Two deployment modes:
 * 1. Bundled (default): frontend/dist is packaged in the native app.
 *    Set VITE_API_BASE_URL when building so API calls hit your Vercel backend.
 * 2. Remote: set CAPACITOR_SERVER_URL to load the live Vercel site in the WebView
 *    (simplest for auth/cookies — no cross-origin cookie issues).
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.coinco.house",
  appName: "CoinCo House",
  webDir: "dist",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
      }
    : undefined,
  ios: {
    contentInset: "automatic",
    scheme: "CoinCo House",
    allowsLinkPreview: false,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f5f5f0",
    },
  },
};

export default config;
