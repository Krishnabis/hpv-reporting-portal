/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hpv: {
          purple: {
            DEFAULT: "#3B1C63",
            dark: "#2D1250",
            light: "#522B85",
            soft: "#F4EFFB"
          },
          teal: {
            DEFAULT: "#0EA5E9",
            dark: "#0284C7",
            light: "#38BDF8",
            soft: "#E0F2FE"
          },
          pink: {
            DEFAULT: "#EC4899",
            dark: "#DB2777",
            light: "#F472B6",
            soft: "#FCE7F3"
          }
        }
      }
    },
  },
  plugins: [],
}
