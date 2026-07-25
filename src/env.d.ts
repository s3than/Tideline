/// <reference types="astro/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    JELLYFIN_URL: string;
    JELLYFIN_API_KEY: string;
  }
}

declare namespace App {
  interface Locals {
    user: import('./lib/db').UserRow | null;
    jellyfinToken: string;
  }
}
