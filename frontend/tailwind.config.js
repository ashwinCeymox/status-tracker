/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f6f8',
          100: '#e5e9ed',
          200: '#cbd4dc',
          300: '#a3b4c4',
          400: '#758ea7',
          500: '#536f8d',
          600: '#415771',
          700: '#35465b',
          800: '#2e3b4b',
          900: '#1e2630',
          950: '#0e1217',
        }
      }
    },
  },
  plugins: [],
}
