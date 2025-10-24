/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        system: [
          "Noto Sans SC",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
        serif: ["Source Han Serif SC", "Songti SC", "SimSun", "serif"],
        reading: ["LXGW WenKai", "STKaiti", "KaiTi", "serif"],
      },
    },
  },
  plugins: [],
};
