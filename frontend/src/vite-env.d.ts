/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ENVIRONMENT: string
  readonly VITE_PRIORITY_API_URL?: string
  readonly VITE_OFFLINE_STORAGE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
