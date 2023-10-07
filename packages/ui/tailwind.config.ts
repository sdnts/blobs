import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        white: "#EDEDED",
        black: "#232323",
        gray: "#7E7E7E",
        lightGray: "#CECECE",
      },
      letterSpacing: {
        widest: "2rem",
      },
      keyframes: {
        slideInTop: {
          "0%": {
            transform: "translateY(-16rem)",
          },
          "100%": {
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        slideInTop: "slideInTop 0.6s forwards cubic-bezier(0, 0.48, 0, 1)",
      },
    },
    fontFamily: {
      sans: ["Merchant", "Impact"],
    },
  },
  plugins: [],
};

export default config;
