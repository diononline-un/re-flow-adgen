/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        gray1: "rgb(var(--gray1) / <alpha-value>)",
        gray2: "rgb(var(--gray2) / <alpha-value>)",
        gray3: "rgb(var(--gray3) / <alpha-value>)",
        gray4: "rgb(var(--gray4) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        signal: "rgb(var(--signal) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Archivo Black"', "sans-serif"],
        mono: ['"Space Mono"', "monospace"],
      },
      borderWidth: {
        2: "2px",
        4: "4px",
      },
      borderRadius: {
        none: "0px",
      },
      boxShadow: {
        pixel: "4px 4px 0 0 rgb(var(--shadow-c))",
        "pixel-sm": "2px 2px 0 0 rgb(var(--shadow-c))",
        "pixel-in": "inset 2px 2px 0 0 rgb(var(--shadow-c))",
      },
    },
  },
  plugins: [],
};
