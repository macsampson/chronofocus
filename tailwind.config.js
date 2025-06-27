/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Custom colors from the original CSS
        primary: {
          50: "#f4f6f8",
          100: "#e9ecef",
          500: "#3498db",
          600: "#2980b9",
        },
        danger: {
          500: "#e74c3c",
          600: "#c0392b",
        },
        success: {
          500: "#2ecc71",
          600: "#27ae60",
        },
        xp: {
          from: "#4facfe",
          to: "#00f2fe",
        },
        hub: {
          from: "#667eea",
          to: "#764ba2",
        },
        battle: {
          from: "#ff6b6b",
          to: "#ee5a24",
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },
      animation: {
        "xp-shine": "xp-shine 2s infinite",
        "monster-attack": "monster-attack 0.4s",
        "level-up-pulse": "level-up-pulse 0.6s ease-out",
        "xp-explosion": "xp-explosion 1s ease-out",
        "level-badge-pulse": "level-badge-pulse 1s ease-out",
        "healing-float-1": "healing-float-1 2s infinite ease-in-out",
        "healing-float-2": "healing-float-2 2.5s infinite ease-in-out",
        "healing-float-3": "healing-float-3 3s infinite ease-in-out",
        "healing-glow": "healing-glow 2s infinite alternate ease-in-out",
        "milestone-achieved": "milestone-achieved 0.6s ease-out",
      },
      keyframes: {
        "xp-shine": {
          "0%": { left: "-100%" },
          "100%": { left: "100%" },
        },
        "monster-attack": {
          "0%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-5px)" },
          "40%": { transform: "translateX(5px)" },
          "60%": { transform: "translateX(-5px)" },
          "80%": { transform: "translateX(5px)" },
          "100%": { transform: "translateX(0)" },
        },
        "level-up-pulse": {
          "0%": { transform: "translate(-50%, -50%) scale(0.8)", opacity: "0" },
          "50%": {
            transform: "translate(-50%, -50%) scale(1.1)",
            opacity: "1",
          },
          "100%": { transform: "translate(-50%, -50%) scale(1)", opacity: "1" },
        },
        "xp-explosion": {
          "0%": { boxShadow: "0 0 0 0 rgba(79, 172, 254, 0.7)" },
          "20%": { boxShadow: "0 0 0 10px rgba(79, 172, 254, 0.7)" },
          "40%": { boxShadow: "0 0 0 20px rgba(79, 172, 254, 0.4)" },
          "60%": { boxShadow: "0 0 0 30px rgba(79, 172, 254, 0.2)" },
          "100%": { boxShadow: "0 0 0 40px rgba(79, 172, 254, 0)" },
        },
        "level-badge-pulse": {
          "0%": {
            transform: "scale(1)",
            background: "rgba(255, 255, 255, 0.9)",
          },
          "25%": {
            transform: "scale(1.2)",
            background: "linear-gradient(135deg, #ffd93d 0%, #ff6b35 100%)",
            color: "white",
          },
          "50%": { transform: "scale(1.1)" },
          "75%": { transform: "scale(1.15)" },
          "100%": {
            transform: "scale(1)",
            background: "rgba(255, 255, 255, 0.9)",
            color: "#667eea",
          },
        },
        "healing-float-1": {
          "0%": {
            opacity: "0",
            transform: "translateY(0px) translateX(0px) scale(0.5)",
          },
          "20%": {
            opacity: "1",
            transform: "translateY(-10px) translateX(5px) scale(1)",
          },
          "80%": {
            opacity: "1",
            transform: "translateY(-40px) translateX(-8px) scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "translateY(-60px) translateX(-15px) scale(0.3)",
          },
        },
        "healing-float-2": {
          "0%": {
            opacity: "0",
            transform: "translateY(0px) translateX(0px) scale(0.3)",
          },
          "25%": {
            opacity: "1",
            transform: "translateY(-15px) translateX(-10px) scale(1)",
          },
          "75%": {
            opacity: "1",
            transform: "translateY(-35px) translateX(12px) scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "translateY(-55px) translateX(20px) scale(0.2)",
          },
        },
        "healing-float-3": {
          "0%": {
            opacity: "0",
            transform: "translateY(0px) translateX(0px) scale(0.4)",
          },
          "30%": {
            opacity: "1",
            transform: "translateY(-8px) translateX(15px) scale(1)",
          },
          "70%": {
            opacity: "1",
            transform: "translateY(-45px) translateX(-5px) scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "translateY(-70px) translateX(-18px) scale(0.1)",
          },
        },
        "healing-glow": {
          "0%": {
            boxShadow: "0 0 5px rgba(46, 204, 113, 0.3)",
            filter: "brightness(1)",
          },
          "100%": {
            boxShadow: "0 0 20px rgba(46, 204, 113, 0.6)",
            filter: "brightness(1.1)",
          },
        },
        "milestone-achieved": {
          "0%": { transform: "scale(1)", backgroundColor: "#4facfe" },
          "50%": { transform: "scale(1.05)", backgroundColor: "#ffd93d" },
          "100%": { transform: "scale(1)", backgroundColor: "#4facfe" },
        },
      },
      boxShadow: {
        hub: "0 4px 15px rgba(102, 126, 234, 0.3)",
        battle: "0 4px 15px rgba(238, 90, 36, 0.3)",
        "monster-hover": "0 4px 12px rgba(52, 152, 219, 0.15)",
        "monster-selected": "0 6px 20px rgba(33, 150, 243, 0.3)",
        "xp-feedback": "0 4px 20px rgba(102, 126, 234, 0.4)",
        modal: "0 4px 24px rgba(0, 0, 0, 0.18)",
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
}
