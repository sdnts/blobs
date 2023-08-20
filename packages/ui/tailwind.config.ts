import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        white: "#EDEDED",
        black: "#232323",
        gray: "#7E7E7E",
      },
      letterSpacing: {
        widest: "2rem",
      },
    },
    fontFamily: {
      merchant: ["Merchant"],
    },
  },
  plugins: [],
};

export default config;
