/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#f48c25",
                "background-light": "#f8f7f5",
                "background-dark": "#121212",
                "surface-dark": "#1E1E1E",
                "surface-light": "#2C2C2C",
            },
            fontFamily: {
                "display": ["Lexend", "sans-serif"]
            },
        },
    },
    plugins: [
        require('@tailwindcss/container-queries'),
        require('@tailwindcss/forms')
    ],
}
