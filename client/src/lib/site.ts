// Public base URL of the app, for share links and social/OG metadata.
//
// - In the browser, share handlers use `window.location.origin` directly so a
//   copied link always points at whatever host the app is actually running on.
// - For server-rendered metadata (no window), this constant is used. Set
//   NEXT_PUBLIC_SITE_URL to your real domain in production; defaults to
//   localhost for local development.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Origin to build share links from — real page origin on the client.
export function shareOrigin(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return SITE_URL;
}
