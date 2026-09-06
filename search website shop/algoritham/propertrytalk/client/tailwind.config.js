/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./expert.html",
    "./admin.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16a34a', // Trustworthy green
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16',
        },
        navy: {
          800: '#0f172a',
          900: '#090d16',
          950: '#030712',
        },
        accent: {
          gold: '#f59e0b',
          blue: '#2563eb',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
