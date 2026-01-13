/// <reference types="vite/client" />

// Build-time constant injected via vite.config.ts define option
declare const APP_VERSION: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ENVIRONMENT: string
  readonly VITE_PRIORITY_API_URL?: string
  readonly VITE_OFFLINE_STORAGE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
