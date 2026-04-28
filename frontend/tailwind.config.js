/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4ff",
          100: "#e0eaff",
          200: "#c7d7fe",
          300: "#a5b4fc",
          600: "#3b5bdb",
          700: "#2d47c7",
          800: "#1e3a5f",
          900: "#152a47",
        },
      },
    },
  },
  plugins: [],
};
