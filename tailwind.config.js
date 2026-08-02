/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkbg: '#0b0e14',
        darkcard: 'rgba(22, 27, 38, 0.75)',
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 25px rgba(245, 158, 11, 0.4)',
        'glow-cyan': '0 0 25px rgba(6, 182, 212, 0.4)',
        'glow-legend': '0 0 35px rgba(168, 85, 247, 0.6)',
      }
    },
  },
  plugins: [],
};
