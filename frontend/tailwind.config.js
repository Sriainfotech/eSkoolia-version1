/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand:       '#4729F4',
        brandSoft:   '#EEEBFF',
        brandSofter: '#F6F4FF',
        ink:         '#0B0B14',
        ink2:        '#3A3A4A',
        ink3:        '#6B6B7B',
        ink4:        '#9CA0AE',
        pageBg:      '#F0EFFE',
        cardBg:      '#FFFFFF',
        subBg:       '#FAFAFD',
        line:        '#E6E6EC',
        line2:       '#F1F1F5',
        green:       '#0A8C5A',
        greenSoft:   '#E4F6ED',
        red:         '#C2264E',
        redSoft:     '#FCE8EE',
        amber:       '#B4721B',
        amberSoft:   '#FDF1DC',
      },
    },
  },
  plugins: [],
};
