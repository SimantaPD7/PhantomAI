/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: { 950: '#02020a', 900: '#05050f', 800: '#0a0a1a' },
        phantom: { 500: '#7c3aed', 400: '#8b5cf6', 300: '#a78bfa' },
      },
    },
  },
  plugins: [],
};
