/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./dashboard.html",
    "./popup.html",
    "./src/**/*.{html,js}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#06b6d4',
      }
    },
  },
  plugins: [],
}
