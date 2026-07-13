/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base, e.g. https://your-app.vercel.app/api/v1 (required for bundled iOS) */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
