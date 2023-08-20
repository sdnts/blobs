/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
