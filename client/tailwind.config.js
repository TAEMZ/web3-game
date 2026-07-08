/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                display: ["Cinzel", "serif"],
                mono: ["IBM Plex Mono", "monospace"]
            }
        }
    },
    plugins: [require("daisyui")],
    darkMode: ["class", '[data-theme="arenaDark"]'],
    daisyui: {
        themes: [
            {
                arenaDark: {
                    primary: "#C9A227",
                    "primary-content": "#0d1612",
                    secondary: "#0e7a5f",
                    "secondary-content": "#f0e4c0",
                    accent: "#E8C040",
                    "accent-content": "#0d1612",
                    neutral: "#16221a",
                    "neutral-content": "#d8ccb0",
                    "base-100": "#0d1612",
                    "base-200": "#111a15",
                    "base-300": "#16221a",
                    "base-content": "#d8ccb0",
                    info: "#0CA5E9",
                    success: "#22a058",
                    warning: "#E8C040",
                    error: "#e85050"
                },
                arenaLight: {
                    primary: "#9a7a18",
                    secondary: "#0e7a5f",
                    accent: "#C9A227",
                    neutral: "#e3ddcb",
                    "base-100": "#faf6ea",
                    "base-200": "#f2ecd9",
                    "base-300": "#e6ddc4",
                    "base-content": "#2a2416",
                    info: "#0CA5E9",
                    success: "#22a058",
                    warning: "#E8C040",
                    error: "#b81818"
                }
            }
        ],
        darkTheme: "arenaDark"
    }
};
