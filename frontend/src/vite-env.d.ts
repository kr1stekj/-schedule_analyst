/// <reference types="vite/client" />

/** Переменные Vite (префикс VITE_); см. .env / документацию Vite. */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
