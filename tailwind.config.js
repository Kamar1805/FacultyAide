/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00008b', // Deep Blue
          foreground: '#ffffff',
        },
        secondary: '#579044', // Nile Green
        background: '#f8fafc', // Slight off-white for dashboard bg
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
