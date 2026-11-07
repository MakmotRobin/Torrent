/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        utorrent: {
          dark: '#1e1e1e',
          darker: '#181818',
          sidebar: '#252526',
          border: '#333333',
          hover: '#2a2d2e',
          accent: '#007acc',
          active: '#094771',
        },
      },
    },
  },
  plugins: [],
};
