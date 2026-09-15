/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        gray1: "#E5E5E5",
        gray2: "#B3B3B3",
        gray3: "#6B6B6B",
        gray4: "#2B2B2B",
        ink: "#000000",
        signal: "#FF2B2B",
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
        pixel: "4px 4px 0 0 #000000",
        "pixel-sm": "2px 2px 0 0 #000000",
        "pixel-in": "inset 2px 2px 0 0 #000000",
      },
    },
  },
  plugins: [],
};
