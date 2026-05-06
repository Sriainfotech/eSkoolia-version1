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
        pu: 'var(--pu)',
        'pu-soft': 'var(--pu-soft)',
        'pu-deep': 'var(--pu-deep)',
        ink: {
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        surface: {
          0: 'var(--bg-0)',
          1: 'var(--bg-1)',
          2: 'var(--bg-2)',
        },
        bd: 'var(--bd)',
      },
      fontFamily: {
        sans: ['var(--font-instrument)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
