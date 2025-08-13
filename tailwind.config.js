
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nssg: {
          black: '#1F1F1F',
          yellow: '#FFD521',
        }
      },
      borderRadius: { '2xl': '1rem' }
    }
  },
  plugins: [],
}
