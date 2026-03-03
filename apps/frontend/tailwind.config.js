/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: "#0f1512",
                surface: "#181f1c",
                'surface-light': "#222b27",
                mint: "#3edb9f",
                purple: "#8b7af0",
                yellow: "#ddf274",
            },
        },
    },
    plugins: [],
}
