// back-end server url.
// - In the browser this defaults to "" so every request is RELATIVE to the page's
//   origin: works via the public IP, a domain, or an SSH/VS Code port-forward alike
//   (the single-origin proxy routes /v1 + /socket.io to the API server).
//   Set NEXT_PUBLIC_API_URL at build time only for split deployments (e.g. Vercel client
//   + Render API on different origins).
// - During SSR there is no page origin to be relative to, so server-side fetches talk
//   to the API directly over loopback (override with API_URL_INTERNAL).
export const API_URL =
    typeof window === "undefined"
        ? process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        : process.env.NEXT_PUBLIC_API_URL || "";

// Platform fee taken from the winner's pot (e.g. 15 = 15%).
// Must match the value in the ArenaEscrow contract and server .env.
export const HOUSE_FEE_PERCENT = Number(process.env.NEXT_PUBLIC_HOUSE_FEE_PERCENT || "15");
